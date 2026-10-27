import test from "node:test";
import assert from "node:assert/strict";
import { enderecoComSecoes, gravarSecoes, lerSecoes, nomeDoRelatorio } from "./relatorio-parcial.ts";

const TODAS = ["rel-municipio", "rel-convenios", "rel-fornecedores", "rel-fontes"];

test("M4: sem parâmetro, ou sem seção válida, o relatório é o completo", () => {
  assert.deepEqual([...lerSecoes(null, TODAS)], TODAS);
  assert.deepEqual([...lerSecoes("", TODAS)], TODAS);
  assert.deepEqual([...lerSecoes("nada,lixo", TODAS)], TODAS);
});

test("M4: as seções pedidas que existem, na ordem da página", () => {
  assert.deepEqual([...lerSecoes("rel-fontes, rel-convenios,inexistente", TODAS)], ["rel-convenios", "rel-fontes"]);
});

test("M4: o completo grava nada; o parcial grava na ordem da página", () => {
  assert.equal(gravarSecoes(new Set(TODAS), TODAS), null);
  assert.equal(gravarSecoes(new Set(), TODAS), null);
  assert.equal(gravarSecoes(new Set(["rel-fontes", "rel-municipio"]), TODAS), "rel-municipio,rel-fontes");
});

test("M4: o nome diz se é completo ou parcial e quantas seções", () => {
  assert.equal(nomeDoRelatorio(4, 4), "Relatório completo");
  assert.equal(nomeDoRelatorio(0, 4), "Relatório completo");
  assert.equal(nomeDoRelatorio(2, 4), "Relatório parcial · 2 de 4 seções");
  assert.equal(nomeDoRelatorio(1, 9), "Relatório parcial · 1 de 9 seções");
});

test("M4: o endereço troca só o parâmetro das seções, e guarda o resto", () => {
  assert.equal(enderecoComSecoes("/mapa/municipio/2510808/relatorio", "a,b"), "/mapa/municipio/2510808/relatorio?secoes=a%2Cb");
  assert.equal(enderecoComSecoes("/mapa/uf/pb/relatorio?x=1&secoes=a#topo", null), "/mapa/uf/pb/relatorio?x=1#topo");
  assert.equal(enderecoComSecoes("/r?secoes=a", "b"), "/r?secoes=b");
});
