import test from "node:test";
import assert from "node:assert/strict";
import { ABAS_MUNICIPIO, PODE, abaEscolhida, destinoConvenio, nivelDeAcesso, urlMunicipio } from "./pagina-municipio.ts";

test("nível de acesso: público, cadastrado, cliente do próprio município e administrador", () => {
  assert.equal(nivelDeAcesso({ aprovado: false, administrador: true, clienteDoMunicipio: true }), 0, "sem aprovação não há nível, nem de administrador");
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: false, clienteDoMunicipio: false }), 1);
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: false, clienteDoMunicipio: true }), 2);
  assert.equal(nivelDeAcesso({ aprovado: true, administrador: true, clienteDoMunicipio: false }), 3);
});

test("aba: a pedida quando o nível alcança; senão a de entrada", () => {
  assert.equal(abaEscolhida(undefined, 1), "trava");
  assert.equal(abaEscolhida("contas", 1), "contas");
  assert.equal(abaEscolhida(["controle", "x"], 2), "controle");
  assert.equal(abaEscolhida("inventada", 3), "trava");
  assert.equal(abaEscolhida("contas", 0), "resumo", "o público não vê as contas e cai no resumo");
  assert.equal(abaEscolhida("indicadores", 0), "indicadores");
  assert.deepEqual(ABAS_MUNICIPIO.filter((a) => a.minimo === 0).map((a) => a.id), ["resumo", "dinheiro", "indicadores"], "a D1 abre ao público o resumo, o dinheiro e os indicadores");
});

test("endereços e o que cada nível alcança dentro das abas", () => {
  assert.equal(urlMunicipio("2510808"), "/mapa/municipio/2510808");
  assert.equal(urlMunicipio("2510808", "trava"), "/mapa/municipio/2510808");
  assert.equal(urlMunicipio("2510808", "contas"), "/mapa/municipio/2510808?aba=contas");
  assert.equal(destinoConvenio(1)("942082"), "/mapa/instrumento/942082", "o cadastrado vai à página do instrumento");
  assert.equal(destinoConvenio(2)("942082"), "/mapa/instrumento/942082/laudo");
  assert.deepEqual([PODE.simulador(1), PODE.simulador(2), PODE.interno(2), PODE.interno(3)], [false, true, false, true]);
});
