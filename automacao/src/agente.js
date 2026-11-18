import Anthropic from "@anthropic-ai/sdk";
import * as evo from "./evolution.js";
import * as db from "./db.js";

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

const MODELO = "claude-haiku-5-5";

// ---------------------------------------------------------------------------
// Fatos verificados do Edital 01/2026-GMM (conferidos no PDF oficial da Fadesp
// em 17/11/2026). O modelo NUNCA inventa data: tudo sai desta tabela via
// ferramenta. Se o edital for retificado, muda-se aqui e só aqui.
// ---------------------------------------------------------------------------
const CRONOGRAMA = {
  inscricoes: "17/11/2026 a 28/12/2026, até as 17h do último dia, pelo site da Fadesp. Taxa de R$ 115,00.",
  isencao: "Pedido de isenção da taxa: 17 a 19/11/2026. Resultado preliminar em 27/11/2026, recursos em 30/11 e 01/12/2026, resultado definitivo em 04/12/2026. Têm direito: inscritos no CadÚnico, doadores de sangue, doadores de medula óssea, doadoras de leite materno, mulheres vítimas de violência doméstica e familiar, e pessoas com deficiência.",
  pagamento: "Último dia para pagar o boleto da inscrição: 28/12/2026.",
  homologacao: "Resultado preliminar das inscrições homologadas: 06/01/2027. Recursos em 07 e 08/01/2027. Resultado definitivo em 13/01/2027.",
  concorrencia: "Publicação da demanda e concorrência (candidatos por vaga): 13/01/2027.",
  local_de_prova: "Cartão de inscrição com o local de prova: 18/01/2027.",
  prova: "Prova objetiva: domingo, 24/01/2027. Ingresso das 7h às 8h, prova das 8h30 às 12h30, em Marabá. Duração de 4 horas.",
  gabarito: "Gabarito preliminar: 25/01/2027 até as 17h. Recursos em 26 e 27/01/2027. Gabarito definitivo em 05/02/2027.",
  taf: "Teste de Aptidão Física: 06 e 07/03/2027. É eliminatório, mas não pontua.",
  psicologica: "Avaliação psicológica: 03 e 04/04/2027. Eliminatória.",
  curso_de_formacao: "Curso de Formação: 01/09/2027 a 01/12/2027. É obrigatório e eliminatório.",
  resultado_final: "Resultado final definitivo: 20/12/2027.",
  vagas: "127 vagas no total: 60 de provimento imediato e 67 de cadastro de reserva. Apenas os 60 primeiros são convocados para a primeira turma do Curso de Formação.",
  requisitos: "Ensino médio completo, CNH categoria AB na posse, idade de 18 a 35 anos na inscrição, altura mínima de 1,60 m (homens) e 1,55 m (mulheres). Pela retificação do Edital 02/2026, de 17/11/2026, basta completar 18 anos até o início do Curso de Formação — candidato menor precisa de autorização do responsável, com firma reconhecida (Anexo VI).",
  salario: "Salário-base de R$ 2.076,40, mais as vantagens legais, para jornada de 40 horas semanais.",
  pontuacao: "A prova tem 40 questões e 100 pontos, com pesos diferentes: Conhecimentos Específicos (todo jurídico) são 15 questões de peso 4, valendo 60 pontos; Conhecimentos do Município de Marabá são 10 questões de peso 2, valendo 20 pontos; Língua Portuguesa são 5 questões de peso 2, valendo 10 pontos; Matemática e Raciocínio Lógico são 5 questões de peso 1, valendo 5 pontos; Noções de Informática são 5 questões de peso 1, valendo 5 pontos.",
  corte: "Para não ser eliminado é preciso fazer no mínimo 60 pontos (item 11.3) E ficar entre os 254 primeiros, que é o dobro das vagas (itens 11.4 e 11.7). A nota final do concurso é apenas a da prova objetiva (item 21.1): o TAF e a psicológica eliminam, mas não pontuam.",
};

const SISTEMA = `Você é o atendente da Juris Elite no WhatsApp. A Juris Elite é um projeto de preparação para carreiras jurídicas em Marabá, no Pará, tocado por dois juristas — um deles delegado de polícia em atividade, aprovado em concursos de agente administrativo, agente da Polícia Civil de São Paulo, escrevente técnico do TJ-SP e delegado em São Paulo e em Minas Gerais.

CONTEXTO DO MOMENTO
Está aberto o concurso da Guarda Municipal de Marabá (Edital 01/2026, banca Fadesp). Quase todo mundo que te procura agora é candidato desse concurso.

O ARGUMENTO CENTRAL, QUE É VERDADE E ESTÁ NO EDITAL
A prova vale 100 pontos distribuídos com pesos desiguais. Conhecimentos Específicos, que é todo direito, vale 60 pontos sozinho. Conhecimentos do Município de Marabá vale 20. Juntos são 80 dos 100 pontos.
Consequência: quem acerta 100% de Português, Matemática, Informática e Marabá, mas zera o direito, faz 40 pontos — e o corte é 60. Está eliminado. É aritmeticamente impossível passar sem o bloco jurídico.
Outra forma de dizer: uma questão de direito vale o mesmo que quatro de informática. Quem divide o tempo de estudo igualmente entre as matérias está jogando pontos fora.
Use esse argumento. Ele convence porque é verificável, não porque é promessa.

O QUE A JURIS ELITE VENDE
Não vendemos videoaula nem concorremos com Gran, Estratégia ou CERS. Vendemos direção: o que estudar, em que ordem e por quanto tempo. Se a pessoa já paga outro curso, ótimo — nós organizamos o que ela já tem.
Temos duas coisas que nenhum curso nacional tem: o material dos 20 pontos de Marabá (bairros, hidrografia, história, patrimônio) e as cinco leis municipais da Guarda de Marabá, que caem em Legislação Extravagante.

A ESCADA
1. Mapa de Pontos — PDF gratuito com a tabela de pesos. É o que você oferece primeiro.
2. Grupo de WhatsApp — gratuito, conteúdo diário.
3. Aulão ao vivo — gratuito.
4. Pacote Guarda Marabá — R$ 197, ou 3x de R$ 70.
Não empurre o Pacote na primeira mensagem. Primeiro entrega valor, qualifica e convida para o grupo.

COMO VOCÊ ESCREVE
- Mensagem de WhatsApp: curta. No máximo 4 ou 5 linhas. Se precisar de mais, quebre em duas mensagens.
- Português do Brasil, informal e respeitoso, do jeito que se fala em Marabá. Pode usar "você". Nada de juridiquês com quem é de nível médio.
- Negrito do WhatsApp é com asterisco simples: *assim*. Nunca use markdown de título, nem ## nem **.
- No máximo um emoji por mensagem, e só quando couber. Normalmente nenhum.
- Não se apresente como inteligência artificial a não ser que perguntem diretamente. Se perguntarem, responda com honestidade que é um atendente automático da Juris Elite e que pode chamar um dos professores.

REGRAS QUE VOCÊ NÃO QUEBRA
- NUNCA prometa aprovação, vaga ou resultado. Nem "você vai passar", nem "garantimos". O argumento dos pesos já é forte sozinho.
- NUNCA invente data, prazo, número de vaga, valor de taxa ou conteúdo do edital. Para QUALQUER informação do edital, chame a ferramenta consultar_cronograma antes de responder. Se a ferramenta não tiver a informação, diga que vai confirmar e chame escalar_para_humano.
- NUNCA dê consultoria jurídica individual, nem opine sobre a situação processual, criminal ou trabalhista de ninguém. Se puxarem esse assunto, chame escalar_para_humano.
- Não invente preço. O único preço que existe é o Pacote a R$ 197, ou 3x de R$ 70. Se pedirem desconto, condição especial ou falarem de dinheiro além disso, chame escalar_para_humano.
- Se a pessoa estiver irritada, reclamando, ou pedir para falar com uma pessoa de verdade, chame escalar_para_humano na hora, sem insistir.

SEU OBJETIVO EM CADA CONVERSA, NESTA ORDEM
1. Entregar o Mapa de Pontos (ferramenta enviar_mapa_de_pontos).
2. Descobrir qual bloco mais preocupa a pessoa e registrar com registrar_interesse. As opções são: direito (os 60 pontos), maraba (os 20 pontos do município), basicas (português, matemática e informática) ou rotina (a pessoa não consegue manter constância nos estudos — este é o perfil mais valioso, é o aluno da mentoria).
3. Convidar para o grupo (ferramenta convidar_para_grupo).
Faça isso conversando, não como formulário. Uma pergunta por vez.`;

const FERRAMENTAS = [
  {
    name: "consultar_cronograma",
    description:
      "Consulta os dados oficiais verificados do Edital 01/2026 da Guarda Municipal de Marabá. Use SEMPRE antes de afirmar qualquer data, prazo, requisito, valor de taxa, salário, número de vagas, regra de pontuação ou corte. Nunca responda essas informações de memória.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        assunto: {
          type: "string",
          enum: Object.keys(CRONOGRAMA),
          description: "O tópico a consultar.",
        },
      },
      required: ["assunto"],
    },
  },
  {
    name: "enviar_mapa_de_pontos",
    description:
      "Envia ao candidato o PDF gratuito do Mapa de Pontos, com a tabela de pesos da prova. Use assim que a conversa permitir, normalmente na primeira ou segunda mensagem. Não envie duas vezes.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    name: "registrar_interesse",
    description:
      "Registra no sistema o nome do candidato e qual bloco da prova mais o preocupa. Chame assim que descobrir qualquer um dos dois — não espere ter os dois.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        nome: { type: ["string", "null"], description: "Primeiro nome do candidato, se ele disse." },
        etiqueta: {
          type: ["string", "null"],
          enum: ["direito", "maraba", "basicas", "rotina", null],
          description:
            "direito = os 60 pontos de Conhecimentos Específicos; maraba = os 20 pontos do município; basicas = português, matemática e informática; rotina = não consegue manter constância no estudo.",
        },
      },
      required: ["nome", "etiqueta"],
    },
  },
  {
    name: "convidar_para_grupo",
    description:
      "Envia o link do grupo de WhatsApp dos candidatos. Use depois de já ter entregue o Mapa de Pontos e conversado um pouco. Não envie duas vezes.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    name: "escalar_para_humano",
    description:
      "Avisa a equipe da Juris Elite que esta conversa precisa de um professor. Use em: pedido de desconto ou qualquer negociação de valor, reclamação, pessoa irritada, pedido explícito de falar com uma pessoa, dúvida jurídica individual, ou qualquer pergunta sobre o edital que a ferramenta consultar_cronograma não responde.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        motivo: { type: "string", description: "Uma frase dizendo por que precisa de um humano." },
      },
      required: ["motivo"],
    },
  },
];

async function executarFerramenta(nome, entrada, lead) {
  switch (nome) {
    case "consultar_cronograma": {
      const texto = CRONOGRAMA[entrada.assunto];
      return texto || "Esse dado não consta na base verificada. Chame escalar_para_humano.";
    }

    case "enviar_mapa_de_pontos": {
      if (lead.mapa_enviado) return "O Mapa de Pontos já foi enviado antes. Não envie de novo.";
      const url = process.env.MAPA_PONTOS_URL;
      if (!url) {
        await db.registrarEvento(lead.id, "mapa_sem_url", {});
        return "Ainda não há PDF configurado. Explique a tabela de pesos em texto e siga a conversa.";
      }
      await evo.enviarDocumento(
        lead.telefone,
        url,
        "Mapa-de-Pontos-Guarda-Maraba.pdf",
        "Mapa de Pontos da Guarda de Marabá",
      );
      await db.marcarLead(lead.id, { mapa_enviado: true });
      await db.registrarEvento(lead.id, "mapa_enviado", {});
      lead.mapa_enviado = true;
      return "PDF enviado com sucesso. Comente em uma linha o que ele mostra.";
    }

    case "registrar_interesse": {
      const campos = {};
      if (entrada.nome) campos.nome = entrada.nome;
      if (entrada.etiqueta) {
        campos.etiqueta = entrada.etiqueta;
        campos.estagio = "qualificado";
      }
      if (Object.keys(campos).length === 0) return "Nada a registrar.";
      await db.marcarLead(lead.id, campos);
      await db.registrarEvento(lead.id, "interesse_registrado", entrada);
      Object.assign(lead, campos);
      return "Registrado.";
    }

    case "convidar_para_grupo": {
      if (lead.convite_enviado) return "O convite do grupo já foi enviado antes.";
      const url = process.env.GRUPO_CONVITE_URL;
      if (!url) return "Ainda não há grupo configurado. Não prometa convite agora.";
      await evo.enviarTexto(lead.telefone, `Entra no grupo dos candidatos: ${url}`);
      await db.marcarLead(lead.id, { convite_enviado: true, estagio: "no_grupo" });
      await db.registrarEvento(lead.id, "convite_enviado", {});
      lead.convite_enviado = true;
      return "Convite enviado.";
    }

    case "escalar_para_humano": {
      await db.marcarLead(lead.id, { escalado: true });
      await db.registrarEvento(lead.id, "escalado", entrada);
      const equipe = process.env.EQUIPE_WHATSAPP;
      if (equipe) {
        const aviso =
          `*Atendimento precisa de vocês*\n` +
          `Candidato: ${lead.nome || "sem nome"} (${lead.telefone})\n` +
          `Motivo: ${entrada.motivo}`;
        await evo.enviarTexto(equipe, aviso).catch(() => {});
      }
      return "Equipe avisada. Diga ao candidato que um dos professores responde em breve, e não tente resolver sozinho.";
    }

    default:
      return `Ferramenta desconhecida: ${nome}`;
  }
}

/**
 * Processa uma mensagem recebida e devolve o texto a enviar de volta.
 * Faz o laço de tool use manualmente para poder persistir cada passo.
 */
export async function responder(lead, historico, mensagemRecebida) {
  const mensagens = [
    ...historico.map((m) => ({
      role: m.direcao === "recebida" ? "user" : "assistant",
      content: m.conteudo,
    })),
    { role: "user", content: mensagemRecebida },
  ];

  let resposta;
  for (let volta = 0; volta < 6; volta++) {
    resposta = await client.messages.create({
      model: MODELO,
      max_tokens: 2048, // resposta de WhatsApp é curta de propósito
      output_config: { effort: "low" }, // atendimento precisa ser rápido e barato
      // tools e system formam o prefixo estável do cache: ambos são fixos.
      tools: FERRAMENTAS,
      system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
      messages: mensagens,
    });

    if (resposta.stop_reason === "refusal") {
      await db.registrarEvento(lead.id, "recusa_modelo", { detalhes: resposta.stop_details ?? null });
      return "Deixa eu chamar um dos professores para te responder isso direitinho. Só um instante.";
    }

    if (resposta.stop_reason !== "tool_use") break;

    const chamadas = resposta.content.filter((b) => b.type === "tool_use");
    mensagens.push({ role: "assistant", content: resposta.content });

    const resultados = [];
    for (const chamada of chamadas) {
      let saida;
      try {
        saida = await executarFerramenta(chamada.name, chamada.input, lead);
        resultados.push({ type: "tool_result", tool_use_id: chamada.id, content: String(saida) });
      } catch (erro) {
        console.error(`[ferramenta:${chamada.name}]`, erro.message);
        await db.registrarEvento(lead.id, "erro_ferramenta", {
          ferramenta: chamada.name,
          erro: erro.message,
        });
        resultados.push({
          type: "tool_result",
          tool_use_id: chamada.id,
          content: `Falhou: ${erro.message}`,
          is_error: true,
        });
      }
    }
    // Todos os tool_result vão numa ÚNICA mensagem de usuário.
    mensagens.push({ role: "user", content: resultados });
  }

  const texto = (resposta?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (resposta?.usage) {
    await db.registrarEvento(lead.id, "uso_modelo", {
      entrada: resposta.usage.input_tokens,
      saida: resposta.usage.output_tokens,
      cache_leitura: resposta.usage.cache_read_input_tokens ?? 0,
      cache_escrita: resposta.usage.cache_creation_input_tokens ?? 0,
    });
  }

  return texto;
}
