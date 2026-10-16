/** O dinheiro do Estado no TCE-PB (E3, 16/10/2026): os anos lado a lado, com o caso real de Bayeux (2024 → 2025). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { anosNoTce, temAlgoNoTce, type CoberturaEstado, type DespesaEstado, type ReceitaEstado } from "./tce-estado.ts";

const COB: CoberturaEstado[] = [
  { ano: 2024, receitas_lidas: true, despesas_lidas: true, motivo: null },
  { ano: 2025, receitas_lidas: true, despesas_lidas: true, motivo: null },
  { ano: 2026, receitas_lidas: false, despesas_lidas: true, motivo: "o arquivo ainda não foi lido (fica para a próxima rodada)" },
];
// Bayeux, 2025: R$ 2,924 mi com o CO 3210 = R$ 2,224 mi das emendas de 2025 + R$ 700 mil da de 2024, recebida em janeiro.
const REC: ReceitaEstado[] = [
  { ano: 2025, fonte: "710", co: "3210", tipo: "principal", valor: 2_924_000 },
  { ano: 2025, fonte: "710", co: "3210", tipo: "rendimento", valor: 224_000 },
  { ano: 2025, fonte: "701", co: null, tipo: "principal", valor: 175_000 },
  { ano: 2025, fonte: "701", co: null, tipo: "deducao", valor: -5_000 },
];
const DESP: DespesaEstado[] = [
  { ano: 2025, fonte: "710", co: "3210", grupo: "4", empenhado: 328_000, pago: 328_000 },
  { ano: 2025, fonte: "701", co: null, grupo: "3", empenhado: 63_000, pago: 63_000 },
  { ano: 2026, fonte: "710", co: "3210", grupo: "3", empenhado: 100_000, pago: 50_000 },
  { ano: 2026, fonte: "710", co: "3210", grupo: "4", empenhado: 150_000, pago: 150_000 },
];
const PAGO = new Map([
  [2024, 700_000],
  [2025, 2_224_000],
]);

test("os anos do TCE lado a lado com o pago pelo Estado, do mais novo ao mais velho", () => {
  const anos = anosNoTce({ cobertura: COB, receita: REC, despesa: DESP }, PAGO);
  assert.deepEqual(anos.map((a) => a.ano), [2026, 2025, 2024]);
  const a25 = anos[1];
  assert.deepEqual(
    [a25.pagoPeloEstado, a25.recebidoEmenda, a25.recebidoPix, a25.rendimentoPix, a25.recebidoConvenio, a25.gastoPix, a25.pctCapitalPix, a25.gastoConvenio],
    [2_224_000, 2_924_000, 2_924_000, 224_000, 175_000, 328_000, 100, 63_000],
    "a dedução e o rendimento não entram no principal",
  );
  // 2026: receitas não lidas → não verificado (null), nunca zero; a despesa lida segue.
  const a26 = anos[0];
  assert.deepEqual([a26.recebidoEmenda, a26.recebidoPix, a26.gastoPix, a26.pctCapitalPix, a26.pagoPeloEstado], [null, null, 200_000, 75, 0]);
  assert.match(a26.motivo ?? "", /próxima rodada/);
  // 2024 lido e sem nada: zero de verdade.
  assert.deepEqual([anos[2].recebidoEmenda, anos[2].gastoPix, anos[2].pctCapitalPix, anos[2].pagoPeloEstado], [0, 0, null, 700_000]);
  assert.equal(temAlgoNoTce(anos), true);
});

test("sem nada lido nem pago, não há o que mostrar", () => {
  const anos = anosNoTce({ cobertura: [{ ano: 2025, receitas_lidas: false, despesas_lidas: false, motivo: "x" }], receita: [], despesa: [] }, new Map());
  assert.equal(temAlgoNoTce(anos), false);
  assert.deepEqual([anos[0].recebidoEmenda, anos[0].gastoPix], [null, null]);
});
