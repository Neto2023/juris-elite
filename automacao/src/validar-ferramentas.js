/**
 * Valida o schema das ferramentas contra a API da Anthropic, sem gastar
 * resposta de modelo e sem precisar de conversa real.
 *
 *     docker exec juris-agent node src/validar-ferramentas.js
 *
 * Existe porque um schema invalido nao falha no boot nem nos testes: falha
 * no meio do primeiro atendimento, e o candidato fica sem resposta nenhuma.
 * Foi exatamente o que aconteceu com registrar_interesse, que declarava
 * type ["string","null"] junto com um enum de strings.
 */
import { FERRAMENTAS } from "./agente.js";

const CHAVE = process.env.ANTHROPIC_API_KEY;
if (!CHAVE) {
  console.error("ANTHROPIC_API_KEY ausente.");
  process.exit(2);
}

const resposta = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
  method: "POST",
  headers: {
    "x-api-key": CHAVE,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-haiku-5-5",
    tools: FERRAMENTAS,
    messages: [{ role: "user", content: "oi" }],
  }),
});

const corpo = await resposta.json();

if (resposta.ok) {
  console.log(`schema das ${FERRAMENTAS.length} ferramentas: VALIDO`);
  console.log("ferramentas:", FERRAMENTAS.map((f) => f.name).join(", "));
  console.log("tokens do conjunto:", corpo.input_tokens);
  process.exit(0);
}

console.error("schema INVALIDO");
console.error(corpo?.error?.message || JSON.stringify(corpo).slice(0, 400));
process.exit(1);
