import express from "express";
import * as db from "./db.js";
import * as evo from "./evolution.js";
import { responder, avisarEquipe, avisarEquipeTexto, CATALOGO } from "./agente.js";
import { conferirCadastro } from "./validacao.js";
import {
  comandoDe, pedeHumano, listaDeNumeros, liberado, calaOAgente, NOTA_COMPROVANTE,
  chaveDeNumero,
} from "./conducao.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 3001);

/**
 * Modo de teste: enquanto NUMEROS_LIBERADOS tiver alguém, o atendente só
 * responde a esses números. Todo o resto cai no colo da equipe, que já
 * responde na mão. Vazio ou ausente, volta a atender todo mundo.
 */
const LIBERADOS = listaDeNumeros(process.env.NUMEROS_LIBERADOS);

/** Extrai o texto de qualquer um dos formatos de mensagem da Evolution. */
function extrairTexto(message) {
  if (!message) return null;
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    null
  );
}

/**
 * Que tipo de arquivo veio junto, se veio algum.
 *
 * O atendente não lê imagem nem PDF. Mas precisa saber que chegou um, porque
 * foto sem legenda é quase sempre comprovante de Pix, e até 19/11 ela caía
 * num `return` silencioso: a pessoa pagava, mandava o print e ninguém via.
 */
function extrairMidia(message) {
  if (!message) return null;
  if (message.imageMessage) return "imagem";
  if (message.documentMessage) return "documento";
  if (message.documentWithCaptionMessage) return "documento";
  if (message.audioMessage) return "audio";
  if (message.videoMessage) return "video";
  if (message.stickerMessage) return "figurinha";
  return null;
}

/** Pausa aleatória entre dois limites, em milissegundos. */
function espera(min, max) {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

/**
 * Mostra "digitando..." por um tempo proporcional ao tamanho do texto, e só
 * então devolve. Mensagem longa que aparece no mesmo instante que uma curta
 * é o que faz a conversa parecer máquina.
 *
 * Cerca de 30 caracteres por segundo, que é datilografia rápida de celular,
 * com piso de 1,2s e teto de 6s: ninguém espera meio minuto por um "oi".
 */
async function digitando(telefone, texto) {
  const ms = Math.min(6000, Math.max(1200, 400 + (texto?.length || 0) * 33));
  await evo.simularDigitacao(telefone, ms);
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Envia um texto ao candidato e deixa rastro de que fomos nós.
 *
 * O id que a Evolution devolve é guardado: quando o webhook trouxer essa mesma
 * mensagem de volta (ela sai do nosso número, então volta como fromMe), o
 * agente reconhece a própria voz e não a confunde com a equipe digitando.
 */
async function enviarAoCandidato(lead, texto) {
  await digitando(lead.telefone, texto);
  const resp = await evo.enviarTexto(lead.telefone, texto);
  await db.registrarNossoEnvio(resp?.key?.id);
  await db.salvarMensagem(lead.id, "enviada", texto);
}

/**
 * Chegou comprovante (ou outro arquivo) do candidato.
 *
 * Quem confere dinheiro é gente. O atendente avisa a pessoa que recebeu,
 * entrega a conversa à equipe e fica calado até alguém digitar /confirmado.
 * Ele NUNCA diz que o pagamento caiu: foi dizendo isso por conta própria que
 * ele desmentiu uma venda já fechada em 19/11.
 */
async function comprovanteRecebido(lead, midia, legenda) {
  const chave = lead.pagamento_item;
  const item = chave ? CATALOGO[chave] : null;
  // Comprovante so e "esperado" se a gente tinha mesmo uma compra em curso.
  // Pela Cakto a baixa e automatica, entao comprovante aqui costuma ser de
  // quem pagou no Pix direto ao professor, fora da plataforma.
  const esperado = ["checkout_enviado", "pix_enviado"].includes(lead.pagamento_estado);

  await db.marcarPagamento(lead.id, "comprovante", null);
  await db.definirConducao(lead.id, "equipe", NOTA_COMPROVANTE);
  await db.registrarEvento(lead.id, "comprovante_recebido", {
    midia, item: chave || null, esperado,
  });

  await espera(900, 1800);
  await enviarAoCandidato(lead, esperado
    ? "Recebi o comprovante. Já mandei para a equipe conferir, e assim que confirmarem eu te aviso aqui mesmo."
    : "Recebi seu arquivo. Já chamei alguém da equipe para olhar e te responder aqui mesmo.");

  const linhas = [
    "*Comprovante para conferir*",
    `Candidato: ${lead.nome || "sem nome"} (${lead.telefone})`,
  ];
  linhas.push(item
    ? `Compra: ${item.nome}, ${item.preco}`
    : `Chegou ${midia}, mas não havia Pix em aberto nessa conversa. Confiram o que é.`);
  if (legenda?.trim()) linhas.push(`Ele escreveu junto: ${legenda.trim()}`);
  linhas.push(
    "",
    "O atendente está parado nessa conversa, esperando vocês.",
    "Conferido o pagamento, digitem */confirmado* aqui dentro: ele avisa a pessoa e volta a atender.",
  );
  await avisarEquipeTexto(lead, linhas.join("\n"));
  console.log(`[comprovante] ${lead.telefone} aguardando conferência da equipe`);
}

/**
 * Alguém da equipe conferiu o pagamento e digitou /confirmado na conversa.
 *
 * A mensagem de confirmação é escrita aqui, fixa, e não pelo modelo: dizer que
 * entrou dinheiro que não entrou é o erro mais caro que esse atendente pode
 * cometer, e texto gerado na hora não dá para auditar depois.
 */
async function pagamentoConfirmado(lead, quem) {
  if (lead.pagamento_estado === "confirmado") return; // webhook repetido
  await db.marcarPagamento(lead.id, "confirmado", null);
  await db.definirConducao(lead.id, "agente", null);
  await db.registrarEvento(lead.id, "pagamento_confirmado", { por: quem || null });

  const item = lead.pagamento_item ? CATALOGO[lead.pagamento_item] : null;
  const primeiro = (lead.nome || "").trim().split(/\s+/)[0];
  const linhas = [primeiro ? `Pagamento confirmado, ${primeiro}!` : "Pagamento confirmado!"];
  if (item) {
    linhas.push(`A equipe conferiu e liberou: *${item.nome}*.`);
    if (item.apos_pagamento) linhas.push(item.apos_pagamento);
  } else {
    linhas.push("A equipe conferiu e liberou o seu pedido.");
  }

  await espera(900, 1800);
  await enviarAoCandidato(lead, linhas.join("\n"));
  // O formulário não atravessa a venda, vem logo depois dela. Quem acabou
  // de pagar responde, e é dele que os professores tiram a rotina para
  // direcionar o aluno. Atravessar a compra com formulário perde a venda.
  const formulario = CATALOGO.diagnostico && CATALOGO.diagnostico.link;
  if (formulario && item && item.pede_diagnostico) {
    await espera(1400, 2200);
    await enviarAoCandidato(lead, item.pede_diagnostico + "\n\n" + formulario);
    await db.marcarLead(lead.id, { etiqueta: "rotina" });
    await db.registrarEvento(lead.id, "diagnostico_enviado", { depois_de: lead.pagamento_item });
  }

  console.log(`[pagamento] ${lead.telefone} confirmado${quem ? ` por ${quem}` : ""}`);
}

/**
 * Mensagem que saiu do nosso número e não foi o agente: é alguém da equipe
 * digitando na conversa, pelo celular ou pelo WhatsApp Web.
 *
 * Duas coisas acontecem aqui. Comando (/assumir, /agente) troca quem conduz.
 * Qualquer outra mensagem também passa a conversa para a equipe, sem comando
 * nenhum: se um professor entrou para responder, o agente não tem o que
 * acrescentar, e foi exatamente falando por cima que ele desmentiu uma venda
 * já fechada.
 */
/**
 * A equipe entrou nesta conversa enquanto o modelo pensava?
 *
 * Entre a mensagem do candidato e a resposta do agente passam vários segundos,
 * e é justamente aí que um professor costuma responder na mão. Sem esta
 * conferência, a fala do robô sai por cima da dele.
 */
async function humanoAssumiu(leadId) {
  const { conduz, nota } = await db.conduzDetalhe(leadId);
  return calaOAgente(conduz, nota);
}

async function mensagemDaEquipe(telefone, texto, quem) {
  const destino = comandoDe(texto);

  // Confirmação de pagamento não troca quem conduz: devolve a conversa ao
  // atendente E avisa o candidato, nessa ordem.
  if (destino === "confirmado") {
    const lead = await db.obterLeadPorTelefone(telefone);
    if (!lead) return;
    await pagamentoConfirmado(lead, quem);
    return;
  }

  if (destino) {
    const lead = await db.obterOuCriarLead(telefone, null);
    await db.definirConducao(lead.id, destino, quem || null);
    await db.registrarEvento(lead.id, destino === "equipe" ? "equipe_assumiu" : "agente_retomou", {
      comando: String(texto).trim().split(/\s+/)[0].toLowerCase(),
      por: quem || null,
    });
    console.log(`[conduz] ${telefone} -> ${destino}${quem ? ` (por ${quem})` : ""}`);
    return;
  }

  // Sem comando: só mexe em conversa que já existe. Mensagem da equipe para
  // quem nunca escreveu não precisa virar lead.
  const lead = await db.obterLeadPorTelefone(telefone);
  if (!lead) return;
  if (texto) await db.salvarMensagem(lead.id, "enviada", texto);
  if (lead.conduz === "equipe") return;

  await db.definirConducao(lead.id, "equipe", quem || "respondeu na conversa");
  await db.registrarEvento(lead.id, "equipe_assumiu", { comando: null, por: quem || null });
  console.log(`[conduz] ${telefone} -> equipe (respondeu na mão)`);
}

app.get("/health", async (_req, res) => {
  try {
    await db.ping();
    res.json({ status: "ok", servico: "juris-agent" });
  } catch (e) {
    res.status(503).json({ status: "degradado", erro: e.message });
  }
});

app.get("/funil", async (_req, res) => {
  try {
    res.json(await db.resumoFunil());
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ---------------------------------------------------------------------------
// Cadastro vindo do formulário da landing
// ---------------------------------------------------------------------------

/** Origens autorizadas a chamar o cadastro. Sem isto, qualquer site enche a base. */
const ORIGENS = (process.env.ORIGENS_PERMITIDAS ||
  "https://juriselite.com.br,https://www.juriselite.com.br")
  .split(",").map((s) => s.trim()).filter(Boolean);

app.use("/api", (req, res, next) => {
  const origem = req.headers.origin;
  if (origem && ORIGENS.includes(origem)) {
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/**
 * Freio por IP. Não é segurança, é higiene: impede que um script encha a base
 * de lixo numa tarde. Janela curta e memória do processo bastam aqui.
 */
const BALDE = new Map();
function excedeuLimite(ip, limite = 5, janelaMs = 10 * 60 * 1000) {
  const agora = Date.now();
  const marcas = (BALDE.get(ip) || []).filter((t) => agora - t < janelaMs);
  marcas.push(agora);
  BALDE.set(ip, marcas);
  if (BALDE.size > 5000) BALDE.clear();
  return marcas.length > limite;
}

app.post("/api/cadastro", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket.remoteAddress || "desconhecido";
  if (excedeuLimite(ip)) {
    return res.status(429).json({ erro: "muitos cadastros deste endereço. Tente mais tarde." });
  }

  const corpo = req.body || {};
  // Armadilha para robô: campo escondido no formulário, que gente não preenche.
  if (String(corpo.site || "").trim() !== "") {
    return res.status(200).json({ ok: true });
  }

  const conferido = conferirCadastro(corpo);
  if (!conferido.ok) {
    return res.status(400).json({ erro: "dados incompletos", campos: conferido.faltando });
  }
  const { nome, telefone, email, etiqueta } = conferido.dados;

  let lead;
  try {
    lead = await db.registrarCadastro({
      telefone, nome, email, etiqueta,
      consentimentoTexto: String(corpo.consentimento_texto || "").slice(0, 600) || null,
    });
    await db.registrarEvento(lead.id, "cadastro_landing", {
      etiqueta, ja_existia: lead.novo === false,
    });
  } catch (e) {
    console.error("[cadastro] falhou ao gravar:", e);
    return res.status(500).json({ erro: "não consegui registrar agora" });
  }

  // Responde já: a pessoa não espera o WhatsApp para ver a confirmação.
  res.json({ ok: true, nome: nome.split(" ")[0] });

  // Entrega em segundo plano. Se falhar, o lead está salvo e o evento registra
  // a falha, de modo que ninguém se perde por causa da Evolution fora do ar.
  entregarBoasVindas(lead, nome).catch((e) =>
    console.error("[cadastro] entrega falhou:", e.message));
});

/** Manda o Mapa de Pontos e o convite do grupo para quem acabou de se cadastrar. */
async function entregarBoasVindas(lead, nome) {
  // Em modo de teste, nem o cadastro do site dispara mensagem para fora da
  // lista: o número está no Instagram, e um cadastro de verdade no meio do
  // teste viraria atendimento automático sem ninguém esperar por isso.
  if (!liberado(lead.telefone, LIBERADOS)) {
    await db.registrarEvento(lead.id, "fora_do_teste", { origem: "cadastro" });
    return;
  }
  const primeiro = nome.split(" ")[0];
  const mapa = process.env.MAPA_PONTOS_URL;
  const grupo = process.env.GRUPO_CONVITE_URL;
  const falhas = [];

  try {
    await evo.enviarTexto(lead.telefone,
      `${primeiro}, aqui é da Juris Elite. Recebi seu cadastro e já te mando o Mapa de Pontos.`);
  } catch (e) { falhas.push("saudacao: " + e.message); }

  if (mapa) {
    try {
      await evo.enviarDocumento(lead.telefone, mapa, "Mapa-de-Pontos-Juris-Elite.pdf",
        "O Mapa de Pontos da Guarda de Marabá: onde estão os 100 pontos da sua prova.");
      await db.marcarLead(lead.id, { mapa_enviado: true });
      await db.registrarEvento(lead.id, "mapa_enviado", { origem: "landing" });
    } catch (e) { falhas.push("mapa: " + e.message); }
  } else {
    falhas.push("mapa: MAPA_PONTOS_URL vazio no .env");
  }

  if (grupo) {
    try {
      await evo.enviarTexto(lead.telefone,
        `Entra também no grupo da mentoria, é onde eu aviso de prazo, retificação e aula: ${grupo}`);
      await db.marcarLead(lead.id, { convite_enviado: true, estagio: "no_grupo" });
      await db.registrarEvento(lead.id, "convite_enviado", { origem: "landing" });
    } catch (e) { falhas.push("convite: " + e.message); }
  } else {
    falhas.push("convite: GRUPO_CONVITE_URL vazio no .env");
  }

  if (falhas.length) {
    await db.registrarEvento(lead.id, "entrega_incompleta", { falhas });
    console.warn("[cadastro] entrega incompleta para lead", lead.id, falhas);
  }
}

/**
 * Procura, em qualquer canto do corpo do webhook, o que parece telefone.
 *
 * O formato exato do payload da Cakto nao esta documentado campo a campo, so
 * por exemplo. Em vez de apostar num caminho fixo que quebra calado, varre a
 * arvore atras de chaves com cara de telefone e deixa a comparacao decidir.
 */
function telefonesDe(obj, achados = []) {
  if (!obj || typeof obj !== "object" || achados.length > 20) return achados;
  for (const [chave, valor] of Object.entries(obj)) {
    if (typeof valor === "string") {
      if (/(phone|telefone|celular|whats)/i.test(chave) && /[0-9]{8}/.test(valor)) {
        achados.push(valor);
      }
    } else if (typeof valor === "object") {
      telefonesDe(valor, achados);
    }
  }
  return achados;
}

/** O mesmo, para o nome do produto, que diz qual dos dois foi vendido. */
function produtosDe(obj, achados = []) {
  if (!obj || typeof obj !== "object" || achados.length > 20) return achados;
  for (const [chave, valor] of Object.entries(obj)) {
    if (typeof valor === "string" && /(product|produto|offer|oferta|name|nome|title)/i.test(chave)) {
      achados.push(valor);
    } else if (typeof valor === "object") {
      produtosDe(valor, achados);
    }
  }
  return achados;
}

function itemDoProduto(nomes) {
  const texto = nomes.join(" ").toLowerCase();
  if (/pasta|legisla|quest/.test(texto)) return "pastas";
  if (/planejamento|organiza|mentoria/.test(texto)) return "mentoria";
  return null;
}

/**
 * Webhook da Cakto: a venda cai la e precisa chegar aqui.
 *
 * A Cakto trata QUALQUER resposta como entregue, inclusive erro, e nao tenta
 * de novo. Entao isto responde 200 na hora e trabalha depois, e toda falha
 * vira evento no banco em vez de sumir sem deixar rastro.
 */
app.post("/api/cakto", async (req, res) => {
  res.status(200).json({ recebido: true });

  try {
    const corpo = req.body || {};
    const recebido = String(corpo.secret || "");

    // Aprendizado travado do segredo. O webhook foi criado no painel da Cakto
    // e o segredo nasce la; para ele nunca precisar passar pela minha mao, o
    // receptor aprende na PRIMEIRA entrega autentica e grava no banco. A trava
    // CAKTO_APRENDER_SEGREDO=1 so fica ligada na janela de segundos em que eu
    // disparo o "Testar" do painel; depois disso a propria gravacao a desliga.
    if (
      process.env.CAKTO_APRENDER_SEGREDO === "1" &&
      !(process.env.CAKTO_WEBHOOK_SECRET || "").trim() &&
      recebido
    ) {
      try {
        await db.gravarConfig("cakto_webhook_secret", recebido);
        process.env.CAKTO_WEBHOOK_SECRET = recebido;
        process.env.CAKTO_APRENDER_SEGREDO = "";
        console.log("[cakto] segredo aprendido na primeira entrega e gravado no banco");
      } catch (e) {
        console.error("[cakto] falhei ao gravar o segredo aprendido:", e.message);
      }
    }

    // Aceita mais de um segredo, separado por virgula, por seguranca; na
    // pratica o banco guarda um so. A conferencia compara pelo valor e o log
    // diz apenas que bateu, nunca o segredo em si.
    const segredos = (process.env.CAKTO_WEBHOOK_SECRET || "")
      .split(",").map((x) => x.trim()).filter(Boolean);
    if (!segredos.length) {
      console.warn("[cakto] CAKTO_WEBHOOK_SECRET vazio: chamada ignorada");
      return;
    }
    const qual = segredos.indexOf(recebido);
    if (qual < 0) {
      console.warn("[cakto] segredo nao confere, chamada ignorada");
      return;
    }
    console.log(`[cakto] segredo confere (o ${qual + 1}o da lista)`);

    const evento = corpo.event || corpo.evento || "";
    if (evento !== "purchase_approved") {
      console.log(`[cakto] evento ${evento || "sem nome"}, nada a fazer`);
      return;
    }

    const finais = telefonesDe(corpo).map(chaveDeNumero).filter((n) => n.length === 8);
    let lead = null;
    for (const final of finais) {
      lead = await db.acharLeadPorFinal(final);
      if (lead) break;
    }

    const item = itemDoProduto(produtosDe(corpo));

    if (!lead) {
      // Comprou sem passar pelo atendente, ou com outro numero. A venda esta
      // feita e a Cakto ja liberou o material: o que falta e o diagnostico,
      // e so gente consegue alcancar essa pessoa.
      await db.registrarEvento(null, "cakto_sem_lead", { item, campos: Object.keys(corpo) });
      console.log("[cakto] venda aprovada sem conversa correspondente");
      const equipe = (process.env.EQUIPE_WHATSAPP || "").split(",").map((n) => n.trim()).filter(Boolean);
      if (equipe.length) {
        const texto =
          "*Venda aprovada na Cakto*" + "\n" +
          (item ? `Produto: ${CATALOGO[item]?.nome || item}` + "\n" : "") +
          "Não achei essa pessoa em nenhuma conversa do WhatsApp. " +
          "Mandem o Formulário Diagnóstico para ela.";
        await Promise.allSettled(equipe.map((n) => evo.enviarTexto(n, texto)));
      }
      return;
    }

    if (item && lead.pagamento_item !== item) {
      await db.marcarPagamento(lead.id, lead.pagamento_estado || "checkout_enviado", item);
      lead.pagamento_item = item;
    }

    await db.registrarEvento(lead.id, "cakto_aprovado", { item: item || lead.pagamento_item });
    console.log(`[cakto] venda aprovada de ${lead.telefone}`);
    await pagamentoConfirmado(lead, "Cakto");
  } catch (erro) {
    console.error("[cakto] falhou:", erro);
  }
});

app.post("/webhook", async (req, res) => {
  // Responde imediatamente: a Evolution não deve esperar o modelo.
  res.status(200).json({ recebido: true });

  try {
    const corpo = req.body || {};
    const evento = corpo.event || corpo.Event;
    if (evento !== "messages.upsert") return;

    const dados = Array.isArray(corpo.data) ? corpo.data[0] : corpo.data;
    if (!dados?.key) return;

    const { remoteJid, fromMe, id: evolutionId } = dados.key;

    if (!remoteJid || remoteJid.endsWith("@g.us")) return; // grupo: o bot não responde
    if (remoteJid === "status@broadcast") return;

    const telefone = evo.telefoneDoJid(remoteJid);
    if (!telefone) return;

    const texto = extrairTexto(dados.message);
    const midia = extrairMidia(dados.message);

    if (fromMe) {
      // Pode ser a nossa própria mensagem voltando. O id dela é gravado logo
      // depois do envio, e a volta costuma ser mais rápida que a gravação:
      // esperar uns segundos antes de decidir evita o agente se calar sozinho
      // ao ouvir a própria voz.
      await espera(2500, 3200);
      if (await db.conheceEnvio(evolutionId)) return;
      await mensagemDaEquipe(telefone, texto, dados.pushName);
      return;
    }

    if (!texto?.trim() && !midia) return;

    if (await db.jaProcessada(evolutionId)) return;

    const lead = await db.obterOuCriarLead(telefone, dados.pushName);
    const anteriores = await db.historico(lead.id);
    await db.salvarMensagem(lead.id, "recebida", texto?.trim() || `[${midia}]`);

    // Fora da lista de teste: guarda a mensagem e não responde. A conversa
    // é da equipe, que já vinha atendendo na mão.
    if (!liberado(telefone, LIBERADOS)) {
      await db.registrarEvento(lead.id, "fora_do_teste", {});
      return;
    }

    // A equipe está conduzindo: o agente lê, guarda no histórico e fica
    // quieto. Volta a falar só quando alguém digitar /agente.
    if (lead.conduz === "equipe") {
      await db.registrarEvento(lead.id, "silencio_equipe_conduz", {});
      return;
    }

    // Chegou arquivo. O atendente não abre imagem nem PDF, então não tem o
    // que responder sozinho: avisa a equipe e para. Com Pix em aberto, é
    // comprovante; sem Pix em aberto, é coisa que só gente resolve.
    if (midia === "imagem" || midia === "documento") {
      await comprovanteRecebido(lead, midia, texto);
      return;
    }

    // Pedido explícito de falar com gente. Não gasta modelo e não insiste.
    if (pedeHumano(texto)) {
      await db.definirConducao(lead.id, "equipe", "o candidato pediu");
      await db.marcarLead(lead.id, { escalado: true });
      await db.registrarEvento(lead.id, "pediu_humano", { texto: texto.slice(0, 200) });
      await espera(900, 1800);
      await enviarAoCandidato(
        lead,
        "Claro. Já chamei alguém da equipe para falar com você. Aguarde uns instantes, por favor.",
      );
      await avisarEquipe(lead, "O próprio candidato pediu para falar com alguém da equipe.");
      return;
    }

    // Uma pausa antes de começar a "pensar". Resposta instantânea é a coisa
    // que mais denuncia automação: ninguém lê e responde em 300ms.
    await espera(900, 1800);

    const { texto: resposta, pendentes } = await responder(lead, anteriores, texto);
    if (!resposta && !pendentes.length) return;

    // Quebra em parágrafos para parecer conversa, não comunicado.
    // Cada parágrafo vira um balão, mas no MÁXIMO dois por resposta: o resto
    // é juntado no segundo. Cinco balões em cima de um "boa tarde" foi uma
    // das queixas da auditoria, e ninguém lê rajada.
    const pedacos = (resposta || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const partes = pedacos.length <= 2
      ? pedacos
      : [pedacos[0], pedacos.slice(1).join("\n\n")];
    for (const parte of partes) {
      if (await humanoAssumiu(lead.id)) return;
      await enviarAoCandidato(lead, parte);
    }

    // Só agora sai o que as ferramentas prepararam: link, PDF, chave Pix.
    // Depois da fala, nunca antes dela.
    for (const item of pendentes) {
      if (await humanoAssumiu(lead.id)) return;
      await espera(700, 1400);
      if (item.tipo === "documento") {
        const resp = await evo.enviarDocumento(telefone, item.url, item.arquivo, item.legenda || "");
        await db.registrarNossoEnvio(resp?.key?.id);
        await db.salvarMensagem(lead.id, "enviada", `[documento] ${item.arquivo}`);
      } else {
        await enviarAoCandidato(lead, item.texto);
      }
    }
  } catch (erro) {
    console.error("[webhook] falhou:", erro);
  }
});

const servidor = async () => {
  try {
    await db.garantirEsquema();
  } catch (e) {
    // Base indisponível no boot não deve impedir o processo de subir: o
    // /health já denuncia, e o Docker reinicia.
    console.error("[boot] nao consegui garantir o esquema:", e.message);
  }
  // O segredo do webhook da Cakto vive no banco, nao no .env: ele foi
  // aprendido em producao, na primeira entrega, e nunca passou pela maquina
  // local. Se o ambiente nao trouxe um, busca o guardado.
  if (!process.env.CAKTO_WEBHOOK_SECRET) {
    try {
      const guardado = await db.lerConfig("cakto_webhook_secret");
      if (guardado) {
        process.env.CAKTO_WEBHOOK_SECRET = guardado;
        console.log("[boot] segredo do webhook da Cakto carregado do banco");
      }
    } catch (e) {
      console.error("[boot] nao consegui ler o segredo da Cakto:", e.message);
    }
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`juris-agent ouvindo na porta ${PORT}`);
    // Conta, nunca os números: log de servidor não é lugar de dado pessoal.
    console.log(LIBERADOS.size
      ? `[modo] TESTE: respondendo só a ${LIBERADOS.size} número(s) liberado(s)`
      : "[modo] ABERTO: respondendo a qualquer número");
  });
};
servidor();

process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));
