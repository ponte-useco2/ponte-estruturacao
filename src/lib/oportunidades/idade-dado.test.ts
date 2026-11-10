import test from "node:test";
import assert from "node:assert/strict";
import { LIMIAR_HORAS, idadeDoDado, textoIdade } from "./idade-dado.ts";

test("idade do dado: fresco dentro do limiar, antigo fora, e os dias contam certo", () => {
  const hoje = "2026-11-10";
  assert.equal(idadeDoDado("2026-11-10", hoje, LIMIAR_HORAS.diario).estado, "fresco");
  assert.equal(idadeDoDado("2026-11-09", hoje, LIMIAR_HORAS.diario).estado, "fresco");
  const antigo = idadeDoDado("2026-11-07", hoje, LIMIAR_HORAS.diario);
  assert.equal(antigo.estado, "antigo");
  assert.equal(antigo.dias, 3);
  assert.equal(textoIdade(antigo), "há 3 dias");
  assert.equal(textoIdade(idadeDoDado("2026-11-09", hoje, LIMIAR_HORAS.diario)), "há 1 dia");
  assert.equal(textoIdade(idadeDoDado("2026-11-10", hoje, LIMIAR_HORAS.diario)), "hoje");
});

test("idade do dado: aceita carimbo com hora e o limiar da coleta", () => {
  const hoje = new Date("2026-11-10T15:00:00Z");
  assert.equal(idadeDoDado("2026-11-09T12:00:00Z", hoje, LIMIAR_HORAS.diario).estado, "fresco");
  assert.equal(idadeDoDado("2026-09-28T12:00:00Z", hoje, LIMIAR_HORAS.coleta).estado, "fresco", "43 dias de coleta ainda não é antigo");
  assert.equal(idadeDoDado("2026-07-01T12:00:00Z", hoje, LIMIAR_HORAS.coleta).estado, "antigo");
});

test("idade do dado: sem data, data ilegível ou do futuro é desconhecido, nunca fresco", () => {
  assert.equal(idadeDoDado(null, "2026-11-10", 48).estado, "desconhecido");
  assert.equal(idadeDoDado("ontem", "2026-11-10", 48).estado, "desconhecido");
  assert.equal(idadeDoDado("2026-11-12", "2026-11-10", 48).estado, "desconhecido");
  assert.equal(textoIdade(idadeDoDado(null, "2026-11-10", 48)), "");
});
