import assert from "node:assert/strict";
import { test } from "node:test";
import { apararPontas, semBarraNoFim, semHifenNasPontas, semPontuacaoNasPontas, semPontuacaoNoFim, soLetrasENumerosNasPontas } from "./pontas.ts";

test("semBarraNoFim tira só as barras do fim", () => {
  assert.equal(semBarraNoFim("https://x/"), "https://x");
  assert.equal(semBarraNoFim("https://x///"), "https://x");
  assert.equal(semBarraNoFim("https://x"), "https://x");
  assert.equal(semBarraNoFim("/a/b/"), "/a/b");
  assert.equal(semBarraNoFim("///"), "");
});

test("semHifenNasPontas é o antigo ^-+|-+$", () => {
  assert.equal(semHifenNasPontas("--carlao-pelo-bem--"), "carlao-pelo-bem");
  assert.equal(semHifenNasPontas("-"), "");
  assert.equal(semHifenNasPontas("a-b"), "a-b");
});

test("soLetrasENumerosNasPontas respeita letras com acento e pontos de código fora do BMP", () => {
  assert.equal(soLetrasENumerosNasPontas("«são josé»."), "são josé");
  assert.equal(soLetrasENumerosNasPontas("(2024)"), "2024");
  assert.equal(soLetrasENumerosNasPontas("😀abc😀"), "abc");
  assert.equal(soLetrasENumerosNasPontas("..."), "");
});

test("semPontuacaoNoFim e NasPontas", () => {
  assert.equal(semPontuacaoNoFim("texto cortado, ", ",;.:"), "texto cortado");
  assert.equal(semPontuacaoNoFim("texto. ok", ",;.:"), "texto. ok");
  assert.equal(semPontuacaoNasPontas(" – e, ok –", ",;.:–—-"), "e, ok");
});

test("apararPontas devolve a mesma string quando nada muda e não toca o meio", () => {
  const s = "a--b";
  assert.equal(apararPontas(s, (c) => c === "-"), s);
  assert.equal(apararPontas("xx a xx", (c) => c === "x", "inicio"), " a xx");
});

test("texto longo de separadores não custa quadrático", () => {
  const s = `${"/".repeat(200_000)}a${"/".repeat(200_000)}`;
  const t0 = performance.now();
  assert.equal(semBarraNoFim(s), `${"/".repeat(200_000)}a`);
  assert.ok(performance.now() - t0 < 500);
});
