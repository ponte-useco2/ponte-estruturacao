import { test } from "node:test";
import assert from "node:assert/strict";
import { dataBrasilia, diaBrasilia } from "./datas.ts";
import { diaBrasilia as diaBrasiliaDoLaudo } from "./laudo.ts";

test("A4x: o carimbo da noite em Brasília fica no dia de Brasília, não no de UTC", () => {
  // O arquivo do painel de 07/10/2026, 22h34 em Brasília (execução 42).
  assert.equal(diaBrasilia("2026-10-08T01:34:18+00:00"), "2026-10-07");
  assert.equal(diaBrasilia("2026-10-08T01:34:18Z"), "2026-10-07");
  assert.equal(dataBrasilia("2026-10-08T01:34:18+00:00"), "07/10/2026");
  // A meia-noite de Brasília (o `dado_ate` do Pix) e o meio do dia não mudam.
  assert.equal(dataBrasilia("2026-10-06T03:00:00+00:00"), "06/10/2026");
  assert.equal(dataBrasilia("2026-10-07T17:06:15.156545+00:00"), "07/10/2026");
  // Com o fuso de Brasília escrito, o dia é o que está escrito.
  assert.equal(dataBrasilia("2026-10-07T22:34:18-03:00"), "07/10/2026");
  // A virada do ano também segue Brasília.
  assert.equal(diaBrasilia("2027-01-01T02:00:00Z"), "2026-12-31");
});

test("A4x: a data pura (coluna date) passa direto, sem conversão", () => {
  assert.equal(diaBrasilia("2026-10-07"), "2026-10-07");
  assert.equal(dataBrasilia("2026-10-07"), "07/10/2026");
  assert.equal(dataBrasilia("2026-01-01"), "01/01/2026", "data pura de 1º de janeiro não volta para 31/12");
});

test("A4x: o Last-Modified das planilhas (formato HTTP) também vira o dia de Brasília", () => {
  assert.equal(dataBrasilia("Wed, 04 Dec 2024 14:17:33 GMT"), "04/12/2024");
  assert.equal(dataBrasilia("Wed, 04 Dec 2024 01:17:33 GMT"), "03/12/2024");
});

test("A4x: vazio ou texto que não é data dá o traço (ou o vazio pedido)", () => {
  assert.equal(dataBrasilia(null), "—");
  assert.equal(dataBrasilia(undefined), "—");
  assert.equal(dataBrasilia(""), "—");
  assert.equal(dataBrasilia("sem data"), "—");
  assert.equal(dataBrasilia(null, "data desconhecida"), "data desconhecida");
});

test("A4x: o laudo continua exportando a mesma função", () => {
  assert.equal(diaBrasiliaDoLaudo, diaBrasilia);
});
