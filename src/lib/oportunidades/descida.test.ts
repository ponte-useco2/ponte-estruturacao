import test from "node:test";
import assert from "node:assert/strict";
import { TIPO_DESCER, TIPO_SUBIR, caminhoDe, direcaoDoLink, nivelDoCaminho, tiposDaTransicao } from "./descida.ts";

test("M0: o caminho sai limpo de origem, busca, âncora e barra final", () => {
  assert.equal(caminhoDe("/mapa/uf/pb?aba=municipios#regiao-sousa"), "/mapa/uf/pb");
  assert.equal(caminhoDe("https://ponteprojetos.com.br/mapa/brasil/"), "/mapa/brasil");
  assert.equal(caminhoDe("  /mapa  "), "/mapa");
  assert.equal(caminhoDe("?aba=x"), "/");
});

test("M0: os seis níveis da descida, e nada debaixo deles", () => {
  assert.equal(nivelDoCaminho("/mapa/brasil"), 1);
  assert.equal(nivelDoCaminho("/mapa/uf/PB"), 2);
  assert.equal(nivelDoCaminho("/mapa/municipio/2510808"), 3);
  assert.equal(nivelDoCaminho("/mapa/municipio/2510808/investimentos"), 3);
  assert.equal(nivelDoCaminho("/mapa/municipio/2510808/organizacoes?pagina=2"), 3);
  assert.equal(nivelDoCaminho("/mapa/entidade/09084815000170"), 4);
  assert.equal(nivelDoCaminho("/mapa/instrumento/962210"), 5);
  assert.equal(nivelDoCaminho("/mapa/proposta/123"), 5);
  assert.equal(nivelDoCaminho("/mapa/fornecedor/12345678000190"), 6);
  // fora: imprimir, CSV, laudo, janelas, busca, endereço malformado
  for (const fora of ["/mapa/brasil/relatorio", "/mapa/uf/pb/csv", "/mapa/instrumento/962210/laudo", "/mapa", "/mapa/busca", "/mapa/municipio/25", "/mapa/uf/pbx", "/"])
    assert.equal(nivelDoCaminho(fora), null, fora);
});

test("M0: desce para o nível de baixo, sobe para o de cima, inclusive pulando níveis", () => {
  assert.equal(direcaoDoLink("/mapa/brasil", "/mapa/uf/pb"), "descer");
  assert.equal(direcaoDoLink("/mapa/uf/pb", "/mapa/municipio/2510808"), "descer");
  assert.equal(direcaoDoLink("/mapa/entidade/09084815000170", "/mapa/instrumento/962210"), "descer");
  assert.equal(direcaoDoLink("/mapa/instrumento/962210", "/mapa/uf/pb?aba=municipios#regiao-patos"), "subir");
  assert.equal(direcaoDoLink("/mapa/municipio/2510808", "/mapa/brasil"), "subir");
});

test("M0: sem direção na mesma camada, fora da descida ou sem página aberta", () => {
  assert.equal(direcaoDoLink("/mapa/municipio/2510808", "/mapa/municipio/2510808?aba=dinheiro"), null);
  assert.equal(direcaoDoLink("/mapa/municipio/2510808", "/mapa/municipio/2510808/investimentos"), null);
  assert.equal(direcaoDoLink("/mapa/municipio/2510808", "/mapa/municipio/2504009"), null);
  assert.equal(direcaoDoLink("/mapa", "/mapa/uf/pb"), null);
  assert.equal(direcaoDoLink("/mapa/brasil", "/mapa/brasil/relatorio"), null);
  assert.equal(direcaoDoLink(null, "/mapa/uf/pb"), null);
  assert.equal(direcaoDoLink(undefined, "/mapa/uf/pb"), null);
});

test("M0: o tipo da transição é o nome que o CSS espera", () => {
  assert.deepEqual(tiposDaTransicao("/mapa/brasil", "/mapa/uf/pb"), [TIPO_DESCER]);
  assert.deepEqual(tiposDaTransicao("/mapa/uf/pb", "/mapa/brasil"), [TIPO_SUBIR]);
  assert.equal(tiposDaTransicao("/mapa", "/mapa/brasil"), undefined);
  assert.equal(TIPO_DESCER, "mp-descer");
  assert.equal(TIPO_SUBIR, "mp-subir");
});
