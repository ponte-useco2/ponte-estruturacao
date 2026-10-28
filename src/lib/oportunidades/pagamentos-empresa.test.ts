import test from "node:test";
import assert from "node:assert/strict";
import { documentoLegivel, listaCompleta, pagamentosPorEmpresa, posicaoNaJanela, type PagamentoEmpresa } from "./pagamentos-empresa.ts";

const p = (cnpj: string, data: string | null, valor: number | string, mov: string | null = null): PagamentoEmpresa => ({
  cnpj,
  nr_mov_fin: mov,
  data,
  valor: valor as number,
  documento: "NOTA FISCAL",
  nr_documento: "12",
});

test("onda 19: os pagamentos de cada empresa, por data, os sem data por último", () => {
  const m = pagamentosPorEmpresa([p("A", "2024-05-01", 10, "3"), p("B", "2024-01-01", 5), p("A", null, 1, "9"), p("A", "2024-02-01", "20.5", "2"), p("A", "2024-02-01", 7, "10")]);
  assert.deepEqual(
    m.get("A")?.map((x) => [x.data, x.valor, x.nr_mov_fin]),
    [
      ["2024-02-01", 20.5, "2"],
      ["2024-02-01", 7, "10"],
      ["2024-05-01", 10, "3"],
      [null, 1, "9"],
    ],
  );
  assert.equal(m.get("B")?.length, 1);
});

test("onda 19: o ponto do pagamento na janela do convênio", () => {
  assert.equal(posicaoNaJanela("2024-01-01", "2024-01-01", "2024-12-31"), 0);
  assert.equal(posicaoNaJanela("2024-12-31", "2024-01-01", "2024-12-31"), 1);
  assert.equal(posicaoNaJanela("2024-07-01", "2024-01-01", "2024-12-31"), 0.499); // 182 de 365 dias (2024 é bissexto)
  assert.equal(posicaoNaJanela("2025-03-01", "2024-01-01", "2024-12-31"), 1);
  assert.equal(posicaoNaJanela("2024-03-01", "2024-03-01", "2024-03-01"), 0.5);
  assert.equal(posicaoNaJanela(null, "2024-01-01", "2024-12-31"), null);
});

test("onda 19: o documento como se lê e a lista completa", () => {
  assert.equal(documentoLegivel("NOTA FISCAL", "001"), "Nota fiscal 001");
  assert.equal(documentoLegivel("RECIBO", null), "Recibo");
  assert.equal(documentoLegivel(null, " 77 "), "77");
  assert.equal(documentoLegivel(null, null), null);
  assert.equal(listaCompleta(3, 3), true);
  assert.equal(listaCompleta(2, 3), false);
  assert.equal(listaCompleta(0, 0), false);
});
