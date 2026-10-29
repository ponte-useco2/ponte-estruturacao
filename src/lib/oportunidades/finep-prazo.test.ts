import test from "node:test";
import assert from "node:assert/strict";
import { PRAZO_FINEP_SUBVENCAO, finepSubvencaoAberta } from "./finep-prazo.ts";

test("a subvenção da FINEP fecha às 18h de Brasília de 07/04/2026", () => {
  assert.equal(finepSubvencaoAberta(new Date("2026-04-07T20:59:59Z")), true);
  assert.equal(finepSubvencaoAberta(new Date("2026-04-07T21:00:00Z")), true);
  assert.equal(finepSubvencaoAberta(new Date("2026-04-07T21:00:01Z")), false);
  assert.equal(finepSubvencaoAberta(new Date("2026-10-29T12:00:00Z")), false);
  assert.ok(!Number.isNaN(Date.parse(PRAZO_FINEP_SUBVENCAO)));
});
