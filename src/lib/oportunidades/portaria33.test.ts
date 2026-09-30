import test from "node:test";
import assert from "node:assert/strict";
import type { ItemLaudo } from "./itens-laudo.ts";
import { riscoPc33, rotuloDemaisPc33, secaoPc33 } from "./portaria33.ts";

const it = (item: string, estado: ItemLaudo["estado"], nivel: ItemLaudo["nivel"] = null): ItemLaudo => ({
  item, titulo: `título ${item}`, dispositivo: "PC 33/2023", estado, nivel, fato: `fato ${item}`,
});

const itens = [it("P0", "informativo"), it("P1", "atendido"), it("P5", "nao_atendido", "moderado"), it("P9", "nao_atendido", "alto"),
  it("P6", "informativo")];

test("seção: abre com o regime e separa o que pede atenção do resto", () => {
  const s = secaoPc33({ pc33_regime: "pc33", pc33_nivel: "I", pc33_pior: "alto", pc33_itens: itens })!;
  assert.equal(s.rotulo, "Portaria Conjunta 33/2023, Nível I");
  assert.equal(s.abertura?.item, "P0");
  assert.deepEqual(s.conferir.map((x) => x.item), ["P9", "P5"]);     // alto antes de moderado
  assert.deepEqual(s.demais.map((x) => x.item), ["P1", "P6"]);
});

test("sem as colunas (fora da PB ou antes da oport_24) não há seção nem risco", () => {
  assert.equal(secaoPc33({}), null);
  assert.equal(secaoPc33({ pc33_regime: "pc33", pc33_itens: [] }), null);
  assert.equal(riscoPc33({}), null);
});

test("risco do laudo: o nível do pior ponto e os títulos", () => {
  const r = riscoPc33({ pc33_regime: "pc33", pc33_itens: itens })!;
  assert.equal(r.nivel, "alto");
  assert.equal(r.titulo, "Execução pela Portaria 33: 2 pontos a conferir");
  assert.ok(r.fato.startsWith("A conferir: título P9 (alto); título P5 (moderado)."));
  const antigo = riscoPc33({ pc33_regime: "anterior", pc33_itens: [it("P0", "informativo"), it("P9", "nao_atendido", "alto")] })!;
  assert.equal(antigo.titulo, "Execução pela norma da época: 1 ponto a conferir");
  assert.equal(antigo.fato, "fato P9 O detalhe está na seção de execução.");     // um ponto só: o fato dele
  const simples = riscoPc33({ pc33_regime: "simplificado", pc33_itens: [it("P0", "informativo"), it("P11", "nao_atendido", "moderado")] })!;
  assert.equal(simples.titulo, "Execução pelo regime simplificado: 1 ponto a conferir");
  assert.equal(riscoPc33({ pc33_regime: "pc33", pc33_itens: [it("P0", "informativo"), it("P1", "atendido")] }), null);
  // o P3 (um ano parado) já é risco próprio do laudo: não entra no resumo, para não repetir
  assert.equal(riscoPc33({ pc33_regime: "pc33", pc33_itens: [it("P0", "informativo"), it("P3", "nao_atendido", "alto")] }), null);
});

test("resumo dos demais itens no singular e no plural", () => {
  assert.equal(rotuloDemaisPc33(1, true), "O outro item conferido");
  assert.equal(rotuloDemaisPc33(1, false), "O item conferido");
  assert.equal(rotuloDemaisPc33(9, true), "Os outros 9 itens conferidos");
  assert.equal(rotuloDemaisPc33(9, false), "Os 9 itens conferidos");
});
