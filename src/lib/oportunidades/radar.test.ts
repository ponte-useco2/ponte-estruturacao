import test from "node:test";
import assert from "node:assert/strict";
import { ORDEM_PADRAO, janela24hTocaFimDeSemana, moedaCurta, ordemDaTabela, ordenar, parametrosRadar, proximaOrdem, rotuloTipo, urlRadar, variacao } from "./radar.ts";

test("variação com base: delta e percentual", () => {
  const v = variacao(1178, 2466);
  assert.equal(v.delta, -1288);
  assert.equal(v.percentual, -52);
  assert.equal(v.sentido, "caiu");
  assert.equal(v.texto, "−1288 (−52%)");
});

test("variação sem base não inventa percentual", () => {
  const v = variacao(7, 0);
  assert.equal(v.percentual, null);
  assert.equal(v.texto, "+7 (antes: 0)");
});

test("variação igual", () => {
  assert.equal(variacao(5, 5).texto, "igual ao período anterior");
});

test("parâmetros válidos passam; inválidos caem no padrão", () => {
  assert.deepEqual(parametrosRadar({ uf: "pb", dias: "7", categoria: "revisada" }), {
    uf: "PB",
    dias: 7,
    categoria: "revisada",
    ordem: null,
  });
  assert.deepEqual(parametrosRadar({ uf: "XX", dias: "5", categoria: "drop", ordem: "programa.inventada.asc" }), {
    uf: null,
    dias: 30,
    categoria: "nova",
    ordem: null,
  });
  assert.deepEqual(parametrosRadar({}), { uf: null, dias: 30, categoria: "nova", ordem: null });
  assert.deepEqual(parametrosRadar({ ordem: "programa.valor.asc" }).ordem, { tabela: "programa", coluna: "valor", sentido: "asc" });
  assert.deepEqual(parametrosRadar({ ordem: "pb.valor.seja-o-que-for" }).ordem, { tabela: "pb", coluna: "valor", sentido: "desc" });
});

test("a URL omite o que é padrão", () => {
  const base = { uf: null, dias: 30 as const, categoria: "nova" as const, ordem: null };
  assert.equal(urlRadar(base, {}), "/mapa/radar");
  assert.equal(urlRadar(base, { uf: "PB" }), "/mapa/radar?uf=PB");
  assert.equal(urlRadar({ ...base, uf: "PB" }, { dias: 7 }), "/mapa/radar?uf=PB&dias=7");
  assert.equal(urlRadar({ ...base, uf: "PB" }, { uf: null }), "/mapa/radar");
  assert.equal(urlRadar(base, { ordem: { tabela: "disputa", coluna: "valor", sentido: "asc" } }), "/mapa/radar?ordem=disputa.valor.asc");
});

test("janela de 24h que toca o fim de semana, no horário de Brasília", () => {
  // O caso real: o último dado era de sábado, 12/09/2026, 22h51 em Brasília.
  assert.equal(janela24hTocaFimDeSemana("2026-09-12T22:51:08-03:00"), true);
  // Quarta 10/09, 15h: a janela vai de terça a quarta.
  assert.equal(janela24hTocaFimDeSemana("2026-09-09T15:00:00-03:00"), false);
  // Segunda 14/09, 02h: a janela começa no domingo.
  assert.equal(janela24hTocaFimDeSemana("2026-09-14T02:00:00-03:00"), true);
  // Sexta 22h em Brasília já é sábado em UTC — e não pode contar como fim de semana.
  assert.equal(janela24hTocaFimDeSemana("2026-09-11T22:00:00-03:00"), false);
});

test("moeda curta", () => {
  assert.equal(moedaCurta(1_250_000), "R$ 1,3 mi");
  assert.equal(moedaCurta(350_000), "R$ 350 mil");
  assert.equal(moedaCurta(2_100_000_000), "R$ 2,1 bi");
  assert.equal(moedaCurta(900), "R$ 900");
  assert.equal(moedaCurta(null), "—");
});

test("tipo de proponente desconhecido vira Outro", () => {
  assert.equal(rotuloTipo("municipio"), "Município");
  assert.equal(rotuloTipo("qualquer"), "Outro");
});

test("cabeçalho: coluna nova começa do maior, texto começa de A e a mesma coluna inverte", () => {
  const padrao = ORDEM_PADRAO.programa;
  assert.deepEqual(proximaOrdem(padrao, "programa", "valor"), { tabela: "programa", coluna: "valor", sentido: "desc" });
  assert.deepEqual(proximaOrdem(padrao, "programa", "rotulo", true), { tabela: "programa", coluna: "rotulo", sentido: "asc" });
  assert.deepEqual(proximaOrdem(padrao, "programa", "atual"), { tabela: "programa", coluna: "atual", sentido: "asc" }, "mesma coluna inverte");
  const p = { uf: null, dias: 30 as const, categoria: "nova" as const, ordem: { tabela: "pb", coluna: "valor", sentido: "asc" as const } };
  assert.equal(ordemDaTabela(p, "pb").coluna, "valor", "a tabela ordenada usa a ordem da URL");
  assert.deepEqual(ordemDaTabela(p, "programa"), ORDEM_PADRAO.programa, "as outras ficam no padrão");
});

test("ordenar: número, texto com acento e sem valor no fim dos dois sentidos", () => {
  const linhas = [{ n: "Água", v: 2 }, { n: "Barra", v: null }, { n: "Cabedelo", v: 10 }, { n: "Areia", v: 2 }];
  assert.deepEqual(ordenar(linhas, (l) => l.v, "desc").map((l) => l.n), ["Cabedelo", "Água", "Areia", "Barra"]);
  assert.deepEqual(ordenar(linhas, (l) => l.v, "asc").map((l) => l.n), ["Água", "Areia", "Cabedelo", "Barra"]);
  assert.deepEqual(ordenar(linhas, (l) => l.n, "asc").map((l) => l.n), ["Água", "Areia", "Barra", "Cabedelo"]);
  assert.deepEqual(ordenar(linhas, (l) => l.n, "desc").map((l) => l.n), ["Cabedelo", "Barra", "Areia", "Água"]);
});
