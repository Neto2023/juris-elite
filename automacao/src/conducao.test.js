import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comandoDe, pedeHumano, listaDeNumeros, liberado, calaOAgente, NOTA_DO_AGENTE,
  NOTA_COMPROVANTE, primeiroNome,
} from "./conducao.js";

test("/assumir tira o agente da conversa", () => {
  assert.equal(comandoDe("/assumir"), "equipe");
  assert.equal(comandoDe("  /ASSUMIR  "), "equipe");
  assert.equal(comandoDe("/assumir vou ligar pra ela agora"), "equipe");
});

test("/agente devolve a conversa ao atendente", () => {
  assert.equal(comandoDe("/agente"), "agente");
  assert.equal(comandoDe("/Agente pode seguir"), "agente");
});

test("comando no meio da frase é conversa, não comando", () => {
  assert.equal(comandoDe("depois eu digito /agente pra ele voltar"), null);
  assert.equal(comandoDe("manda /assumir ali"), null);
});

test("mensagem comum da equipe não é comando", () => {
  assert.equal(comandoDe("Bom dia, Polyana! Segue a chave pix"), null);
  assert.equal(comandoDe(""), null);
  assert.equal(comandoDe(null), null);
  assert.equal(comandoDe("/outra coisa"), null);
});

test("reconhece quem pede uma pessoa de verdade", () => {
  const pedidos = [
    "quero falar com alguém da equipe",
    "tem como falar com um atendente?",
    "queria conversar com uma pessoa",
    "quero falar com o professor",
    "posso falar com alguém de verdade",
    "quero falar com a equipe por favor",
    "tem como me passar o contato de alguém?",
  ];
  for (const p of pedidos) assert.equal(pedeHumano(p), true, p);
});

test("lista vazia atende todo mundo", () => {
  const nenhuma = listaDeNumeros("");
  assert.equal(nenhuma.size, 0);
  assert.equal(liberado("5594999990000", nenhuma), true);
  assert.equal(liberado("5594999990000", listaDeNumeros(null)), true);
});

test("com lista, só a lista é atendida", () => {
  const lista = listaDeNumeros("5594999990000, 5594988887777");
  assert.equal(lista.size, 2);
  assert.equal(liberado("5594999990000", lista), true);
  assert.equal(liberado("5594988887777", lista), true);
  assert.equal(liberado("5594911112222", lista), false);
});

test("o nono dígito não derruba o reconhecimento", () => {
  const lista = listaDeNumeros("5594999990000"); // com o 9
  assert.equal(liberado("559499990000", lista), true); // mesmo número, sem o 9
  assert.equal(liberado("+55 (94) 99999-0000", lista), true);
});

test("lixo na lista é descartado, não vira número", () => {
  const lista = listaDeNumeros("5594999990000,,123,abc, ");
  assert.equal(lista.size, 1);
  assert.equal(liberado("123", lista), false);
});

test("não confunde conversa normal com pedido de humano", () => {
  const normais = [
    "quero a pasta 1 de 9,99",
    "bom dia",
    "qual o valor da mentoria?",
    "vou falar com meu marido e já te respondo",
    "o direito é o que mais me preocupa",
    "já fiz o pix, segue o comprovante",
  ];
  for (const n of normais) assert.equal(pedeHumano(n), false, n);
});

test("gente assumindo na mao cala o agente no meio da resposta", () => {
  assert.equal(calaOAgente("equipe", "Suporte Juris Elite"), true);
  assert.equal(calaOAgente("equipe", "Bruna"), true);
  assert.equal(calaOAgente("equipe", null), true);
});

test("o agente escalando nao cala a si mesmo", () => {
  assert.equal(calaOAgente("equipe", NOTA_DO_AGENTE), false);
});

test("conversa do agente segue falando", () => {
  assert.equal(calaOAgente("agente", null), false);
  assert.equal(calaOAgente("agente", NOTA_DO_AGENTE), false);
});

test("a equipe confirma o pagamento por comando", () => {
  assert.equal(comandoDe("/confirmado"), "confirmado");
  assert.equal(comandoDe("/CONFIRMADO"), "confirmado");
  assert.equal(comandoDe("/pago"), "confirmado");
  assert.equal(comandoDe("/confirmar"), "confirmado");
  assert.equal(comandoDe("/confirmado caiu agora"), "confirmado");
});

test("confirmar pagamento nao se confunde com conversa normal", () => {
  assert.equal(comandoDe("confirmado"), null);
  assert.equal(comandoDe("pode confirmar que caiu"), null);
  assert.equal(comandoDe("ja esta pago"), null);
});

test("comprovante em conferencia tambem cala o agente", () => {
  assert.equal(calaOAgente("equipe", NOTA_COMPROVANTE), true);
});

test("primeiroNome usa a primeira palavra e normaliza", () => {
  assert.equal(primeiroNome("João Silva"), "João");
  assert.equal(primeiroNome("MARIA DAS DORES"), "Maria");
  assert.equal(primeiroNome("  ana  "), "Ana");
  assert.equal(primeiroNome("Zé 💛", "5594999990000"), "Zé");
});

test("primeiroNome devolve vazio quando nao da para confiar", () => {
  assert.equal(primeiroNome(""), "");
  assert.equal(primeiroNome(null), "");
  assert.equal(primeiroNome("💛🔥"), "");
  assert.equal(primeiroNome("+55 94 99999-0000"), "");
  // pushName que é o próprio número do contato
  assert.equal(primeiroNome("5594999990000", "94999990000"), "");
});
