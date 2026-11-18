import express from "express";
import * as db from "./db.js";
import * as evo from "./evolution.js";
import { responder } from "./agente.js";
import { conferirCadastro } from "./validacao.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 3001);

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

    if (fromMe) return;                                   // eco da nossa própria mensagem
    if (!remoteJid || remoteJid.endsWith("@g.us")) return; // grupo: o bot não responde
    if (remoteJid === "status@broadcast") return;

    const texto = extrairTexto(dados.message);
    if (!texto || !texto.trim()) return;

    if (await db.jaProcessada(evolutionId)) return;

    const telefone = evo.telefoneDoJid(remoteJid);
    if (!telefone) return;

    const lead = await db.obterOuCriarLead(telefone, dados.pushName);
    const anteriores = await db.historico(lead.id);
    await db.salvarMensagem(lead.id, "recebida", texto);

    await evo.simularDigitacao(telefone, 1500);

    const resposta = await responder(lead, anteriores, texto);
    if (!resposta) return;

    // Quebra em parágrafos para parecer conversa, não comunicado.
    const partes = resposta.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const parte of partes) {
      await evo.enviarTexto(telefone, parte);
      await db.salvarMensagem(lead.id, "enviada", parte);
      if (partes.length > 1) await new Promise((r) => setTimeout(r, 900));
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`juris-agent ouvindo na porta ${PORT}`);
  });
};
servidor();

process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));
