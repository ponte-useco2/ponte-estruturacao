/** Federal e estadual lado a lado (E3, 16/10/2026): por ano, de 2021 em diante, sem somar. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { federalPorAno, ladoALado, ladoALado3 } from "./lado-a-lado.ts";

test("o federal por ano soma só o que é válido; o favorecido (sempre válido) entra no pago", () => {
  const f = federalPorAno([
    { ano: 2025, valido: true, indicado: 542_000, pago: 542_000 },     // Pix
    { ano: 2025, valido: true, indicado: 2_361_000, pago: 642_000 },   // convênio
    { ano: 2025, valido: false, indicado: 900_000, pago: 0 },          // proposta que não virou instrumento
    { ano: 2025, valido: true, indicado: null, pago: 200_000 },        // pago ao favorecido
    { ano: null, valido: true, indicado: 1, pago: 1 },                 // FNS ainda sem o autor: sem ano
    { ano: 2020, valido: true, indicado: 10_066_000, pago: 4_066_000 },
  ]);
  assert.deepEqual(f, [
    { ano: 2020, valido: 10_066_000, pago: 4_066_000 },
    { ano: 2025, valido: 2_903_000, pago: 1_384_000 },
  ]);
});

test("lado a lado: de 2021 em diante, do mais novo ao mais velho, sem somar federal e estadual", () => {
  const linhas = ladoALado(
    [
      { ano: 2020, valido: 10_066_000, pago: 4_066_000 },
      { ano: 2025, valido: 2_903_000, pago: 1_384_000 },
    ],
    [
      { ano: 2025, empenhado: 630_000, pago: 630_000 },
      { ano: 2024, empenhado: 1_070_000, pago: 1_070_000 },
    ],
  );
  assert.deepEqual(linhas, [
    { ano: 2025, federalValido: 2_903_000, federalPago: 1_384_000, estadualEmpenhado: 630_000, estadualPago: 630_000 },
    { ano: 2024, federalValido: 0, federalPago: 0, estadualEmpenhado: 1_070_000, estadualPago: 1_070_000 },
  ]);
  assert.equal(Object.keys(linhas[0]).some((k) => /total|soma/i.test(k)), false, "não há coluna de soma");
  assert.deepEqual(ladoALado([], []), []);
});

test("com o municipal (J3): a terceira esfera ao lado, de 2021 em diante, sem somar", () => {
  const linhas = ladoALado3(
    [{ ano: 2025, valido: 2_903_000, pago: 1_384_000 }],
    [{ ano: 2024, empenhado: 1_070_000, pago: 1_070_000 }],
    [
      { ano: 2026, atual: 230_000, pago: 50_000 },
      { ano: 2025, atual: 90, pago: 90 },
      { ano: 2020, atual: 5, pago: 5 },
    ],
  );
  assert.deepEqual(linhas, [
    { ano: 2026, federalValido: 0, federalPago: 0, estadualEmpenhado: 0, estadualPago: 0, municipalAtual: 230_000, municipalPago: 50_000 },
    { ano: 2025, federalValido: 2_903_000, federalPago: 1_384_000, estadualEmpenhado: 0, estadualPago: 0, municipalAtual: 90, municipalPago: 90 },
    { ano: 2024, federalValido: 0, federalPago: 0, estadualEmpenhado: 1_070_000, estadualPago: 1_070_000, municipalAtual: 0, municipalPago: 0 },
  ]);
  assert.equal(Object.keys(linhas[0]).some((k) => /total|soma/i.test(k)), false, "não há coluna de soma");
  // Sem o municipal, as linhas são as do lado a lado de duas esferas.
  const f = [{ ano: 2025, valido: 1, pago: 1 }];
  const e = [{ ano: 2023, empenhado: 2, pago: 2 }];
  assert.deepEqual(ladoALado3(f, e, []).map(({ municipalAtual, municipalPago, ...l }) => (assert.equal(municipalAtual + municipalPago, 0), l)), ladoALado(f, e));
});
