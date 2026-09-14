import test from "node:test";
import assert from "node:assert/strict";
import { janela24hTocaFimDeSemana, moedaCurta, parametrosRadar, rotuloTipo, urlRadar, variacao } from "./radar.ts";

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
  });
  assert.deepEqual(parametrosRadar({ uf: "XX", dias: "5", categoria: "drop" }), {
    uf: null,
    dias: 30,
    categoria: "nova",
  });
  assert.deepEqual(parametrosRadar({}), { uf: null, dias: 30, categoria: "nova" });
});

test("a URL omite o que é padrão", () => {
  const base = { uf: null, dias: 30 as const, categoria: "nova" as const };
  assert.equal(urlRadar(base, {}), "/mapa/radar");
  assert.equal(urlRadar(base, { uf: "PB" }), "/mapa/radar?uf=PB");
  assert.equal(urlRadar({ ...base, uf: "PB" }, { dias: 7 }), "/mapa/radar?uf=PB&dias=7");
  assert.equal(urlRadar({ ...base, uf: "PB" }, { uf: null }), "/mapa/radar");
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
