import test from "node:test";
import assert from "node:assert/strict";
import { mesAno, parcelasPorResponsavel, periodo, somarItens, type ItemPlano } from "./plano-trabalho.ts";

const item = (tipo: string | null, valor: number | null): ItemPlano => ({
  descricao: "x", aquisicao: null, tipo, natureza: null, cod_natureza: null, situacao: null, quantidade: 1, valor_unitario: valor, valor_total: valor,
});

test("somarItens soma por chave, do maior valor ao menor, e chama de 'não informado' o vazio", () => {
  assert.deepEqual(somarItens([item("OBRA", 100), item("BEM", 30), item("OBRA", 50), item(null, null)], (i) => i.tipo), [
    { chave: "OBRA", itens: 2, valor: 150 },
    { chave: "BEM", itens: 1, valor: 30 },
    { chave: "não informado", itens: 1, valor: 0 },
  ]);
});

test("parcelas por responsável, mês/ano e período", () => {
  assert.deepEqual(
    parcelasPorResponsavel([
      { nr: 1, mes: 3, ano: 2025, responsavel: "Concedente", valor: 30000 },
      { nr: 1, mes: 3, ano: 2025, responsavel: "Convenente", valor: 1000 },
      { nr: 2, mes: 6, ano: 2025, responsavel: "Concedente", valor: 20000 },
    ]),
    [
      { chave: "Concedente", itens: 2, valor: 50000 },
      { chave: "Convenente", itens: 1, valor: 1000 },
    ],
  );
  assert.equal(mesAno({ mes: 3, ano: 2025 }), "mar/2025");
  assert.equal(mesAno({ mes: null, ano: 2025 }), "2025");
  assert.equal(mesAno({ mes: 13, ano: null }), "—");
  assert.equal(periodo("2025-01-01", "2025-03-31"), "01/01/2025 a 31/03/2025");
  assert.equal(periodo(null, "2025-03-31"), "31/03/2025");
  assert.equal(periodo(null, null), "—");
});
