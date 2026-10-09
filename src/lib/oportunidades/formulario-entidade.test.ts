import assert from "node:assert/strict";
import { test } from "node:test";
import { MUNICIPIOS_PB } from "./municipios-pb.ts";
import { MUNICIPIOS_PB_POR_NOME, campoDoErro, municipioPeloNome } from "./formulario-entidade.ts";

// ------------------------------------------------------------------ N08: o formulário da entidade

test("MUNICIPIOS_PB_POR_NOME: os 223, cada IBGE uma vez, em ordem alfabética do nome", () => {
  assert.equal(MUNICIPIOS_PB_POR_NOME.length, 223);
  assert.equal(MUNICIPIOS_PB_POR_NOME.length, MUNICIPIOS_PB.length);
  assert.equal(new Set(MUNICIPIOS_PB_POR_NOME.map((m) => m.ibge)).size, 223);
  for (let i = 1; i < MUNICIPIOS_PB_POR_NOME.length; i++) {
    assert.ok(MUNICIPIOS_PB_POR_NOME[i - 1].nome.localeCompare(MUNICIPIOS_PB_POR_NOME[i].nome, "pt-BR") <= 0, MUNICIPIOS_PB_POR_NOME[i].nome);
  }
  assert.equal(MUNICIPIOS_PB_POR_NOME[0].nome, "Água Branca");
  // O valor enviado continua sendo o IBGE de 7 dígitos, como o campo de antes.
  assert.ok(MUNICIPIOS_PB_POR_NOME.every((m) => /^25\d{5}$/.test(m.ibge)));
  assert.equal(MUNICIPIOS_PB_POR_NOME.find((m) => m.nome === "Patos")?.ibge, "2510808");
});

test("campoDoErro: as mensagens de hoje da ação do servidor apontam o campo certo", () => {
  assert.equal(campoDoErro("O nome precisa ter entre 2 e 160 caracteres."), "nome");
  assert.equal(campoDoErro("Escolha o tipo de agente."), "tipo");
  assert.equal(campoDoErro("UF inválida."), "uf");
  assert.equal(campoDoErro("O código do IBGE tem sete dígitos."), "municipio");
  assert.equal(campoDoErro("CNPJ inválido."), "cnpj");
  assert.equal(campoDoErro("Escolha um MUNICÍPIO da lista."), "municipio");
});

test("campoDoErro: a mensagem que não fala de campo fica sem ligação", () => {
  for (const m of [
    "Sem permissão.",
    "Cadastro indisponível no momento.",
    "O cadastro de organizações ainda não foi ativado no banco.",
    "Seu acesso ainda não foi aprovado.",
    "Não foi possível salvar. Tente de novo.",
    "",
  ]) {
    assert.equal(campoDoErro(m), null, m);
  }
  assert.equal(campoDoErro(null), null);
  assert.equal(campoDoErro(undefined), null);
});

test("municipioPeloNome: a lista pelo nome sem UF e na PB; o código do IBGE nas outras UFs", () => {
  assert.equal(municipioPeloNome(""), true);
  assert.equal(municipioPeloNome(null), true);
  assert.equal(municipioPeloNome("PB"), true);
  assert.equal(municipioPeloNome("PE"), false);
});
