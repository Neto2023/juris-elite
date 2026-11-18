/**
 * Validação dos dados do formulário da landing.
 *
 * Mora num módulo sem dependência nenhuma de propósito: dá para rodar os
 * testes com `node src/validacao.test.js`, sem Postgres, sem Docker e sem
 * instalar nada. Regra de validação que não se testa é regra que se descobre
 * errada quando o lead já entrou torto na base.
 */

/** Só os dígitos. A Evolution rejeita +, espaço e traço. */
export function soDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

/**
 * Celular brasileiro em formato internacional (55 + DDD + 9 dígitos).
 * Devolve null quando não dá para confiar no que veio.
 *
 * Fixo é recusado de propósito: o Mapa vai por WhatsApp, e número fixo
 * aceito aqui vira lead que nunca recebe nada e ninguém entende por quê.
 */
export function telefoneBr(valor) {
  let d = soDigitos(valor);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d[2] !== "9") return null;
  return "55" + d;
}

/** Devolve o e-mail limpo, ou null. Não tenta ser RFC 5322: tenta ser útil. */
export function emailValido(valor) {
  const e = String(valor || "").trim().toLowerCase();
  if (e.length < 6 || e.length > 120) return null;
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

export const ETIQUETAS = new Set(["direito", "maraba", "basicas", "rotina"]);

export function nomeLimpo(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

/**
 * Confere o corpo inteiro do cadastro.
 * Devolve { ok, dados, faltando } — nunca lança.
 */
export function conferirCadastro(corpo = {}) {
  const nome = nomeLimpo(corpo.nome);
  const telefone = telefoneBr(corpo.telefone);
  const email = emailValido(corpo.email);
  const etiqueta = ETIQUETAS.has(corpo.interesse) ? corpo.interesse : null;

  const faltando = [];
  if (nome.length < 2) faltando.push("nome");
  if (!telefone) faltando.push("telefone");
  if (!email) faltando.push("email");
  if (corpo.consentimento !== true) faltando.push("consentimento");

  return {
    ok: faltando.length === 0,
    faltando,
    dados: { nome, telefone, email, etiqueta },
  };
}
