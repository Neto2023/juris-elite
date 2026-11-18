// Cliente mínimo da Evolution API v2.
const BASE = (process.env.EVOLUTION_SERVER_URL || "http://juris-evolution:8080").replace(/\/$/, "");
const KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE || "juriselite";

async function chamar(caminho, corpo, metodo = "POST") {
  const resp = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", apikey: KEY },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resp.text();
  if (!resp.ok) {
    throw new Error(`Evolution ${metodo} ${caminho} -> ${resp.status}: ${texto.slice(0, 400)}`);
  }
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

/** Normaliza para apenas dígitos (a Evolution rejeita +, espaço e traço). */
export function normalizarNumero(valor) {
  return String(valor || "").replace(/\D/g, "");
}

/** Extrai o telefone de um remoteJid tipo "5594999998888@s.whatsapp.net". */
export function telefoneDoJid(jid) {
  return normalizarNumero(String(jid || "").split("@")[0].split(":")[0]);
}

export async function enviarTexto(numero, texto) {
  return chamar(`/message/sendText/${INSTANCE}`, {
    number: normalizarNumero(numero),
    text: texto,
  });
}

export async function enviarDocumento(numero, url, nomeArquivo, legenda = "") {
  return chamar(`/message/sendMedia/${INSTANCE}`, {
    number: normalizarNumero(numero),
    mediatype: "document",
    mimetype: "application/pdf",
    media: url,
    fileName: nomeArquivo,
    caption: legenda,
  });
}

/** Mostra "digitando..." — a conversa fica bem menos robótica. */
export async function simularDigitacao(numero, ms = 1200) {
  try {
    await chamar(`/chat/sendPresence/${INSTANCE}`, {
      number: normalizarNumero(numero),
      presence: "composing",
      delay: ms,
    });
  } catch {
    // Presença é cosmética: nunca deve derrubar o atendimento.
  }
}

export async function criarInstancia() {
  return chamar("/instance/create", {
    instanceName: INSTANCE,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  });
}

export async function estadoConexao() {
  return chamar(`/instance/connectionState/${INSTANCE}`, null, "GET");
}

export async function conectar() {
  return chamar(`/instance/connect/${INSTANCE}`, null, "GET");
}
