/**
 * Testes da validação do cadastro. Rode com:
 *
 *     node src/validacao.test.js
 *
 * Sem dependência nenhuma, de propósito: tem de rodar numa máquina limpa.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { telefoneBr, emailValido, conferirCadastro } from "./validacao.js";

test("telefone: aceita celular com DDD, em qualquer formatação", () => {
  assert.equal(telefoneBr("(94) 99127-7972"), "5594991277972");
  assert.equal(telefoneBr("94991277972"), "5594991277972");
  assert.equal(telefoneBr("+55 94 99127-7972"), "5594991277972");
  assert.equal(telefoneBr("5594991277972"), "5594991277972");
  assert.equal(telefoneBr(" 94 9 9127 7972 "), "5594991277972");
});

test("telefone: recusa o que não recebe WhatsApp", () => {
  assert.equal(telefoneBr("3412-3456"), null, "sem DDD");
  assert.equal(telefoneBr("(94) 3321-1234"), null, "fixo, oito dígitos");
  assert.equal(telefoneBr("(94) 81277-7972"), null, "nono dígito não é 9");
  assert.equal(telefoneBr("(09) 99127-7972"), null, "DDD inexistente");
  assert.equal(telefoneBr("999999999999999"), null, "dígitos demais");
  assert.equal(telefoneBr(""), null);
  assert.equal(telefoneBr(null), null);
});

test("e-mail: aceita o comum e normaliza caixa", () => {
  assert.equal(emailValido("Walter@Gmail.com"), "walter@gmail.com");
  assert.equal(emailValido("  diego.souza@uol.com.br "), "diego.souza@uol.com.br");
});

test("e-mail: recusa o que não entrega", () => {
  assert.equal(emailValido("walter@gmail"), null, "sem ponto no domínio");
  assert.equal(emailValido("walter gmail.com"), null, "sem arroba");
  assert.equal(emailValido("@gmail.com"), null, "sem usuário");
  assert.equal(emailValido("a@b.c"), null, "curto demais");
  assert.equal(emailValido(""), null);
});

test("cadastro completo passa e devolve dados limpos", () => {
  const r = conferirCadastro({
    nome: "  Walter   Ruiz ",
    telefone: "(94) 99127-7972",
    email: "WALTER@gmail.com",
    interesse: "rotina",
    consentimento: true,
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.faltando, []);
  assert.equal(r.dados.nome, "Walter Ruiz");
  assert.equal(r.dados.telefone, "5594991277972");
  assert.equal(r.dados.email, "walter@gmail.com");
  assert.equal(r.dados.etiqueta, "rotina");
});

test("sem consentimento não passa, por mais completo que esteja", () => {
  const r = conferirCadastro({
    nome: "Walter", telefone: "94991277972", email: "w@gmail.com",
    consentimento: false,
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.faltando, ["consentimento"]);
});

test("consentimento só vale como booleano verdadeiro", () => {
  for (const v of ["true", "on", 1, "sim"]) {
    const r = conferirCadastro({
      nome: "Walter", telefone: "94991277972", email: "w@gmail.com", consentimento: v,
    });
    assert.equal(r.ok, false, "aceitou consentimento como " + JSON.stringify(v));
  }
});

test("interesse inválido vira nulo, e não derruba o cadastro", () => {
  const r = conferirCadastro({
    nome: "Walter", telefone: "94991277972", email: "w@gmail.com",
    interesse: "'; DROP TABLE leads; --", consentimento: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.dados.etiqueta, null);
});

test("corpo vazio acusa os quatro campos", () => {
  const r = conferirCadastro({});
  assert.equal(r.ok, false);
  assert.deepEqual(r.faltando, ["nome", "telefone", "email", "consentimento"]);
});

test("nome gigante é cortado, não rejeitado", () => {
  const r = conferirCadastro({
    nome: "a".repeat(300), telefone: "94991277972",
    email: "w@gmail.com", consentimento: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.dados.nome.length, 80);
});
