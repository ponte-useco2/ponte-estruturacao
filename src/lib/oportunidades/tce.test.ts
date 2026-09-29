import test from "node:test";
import assert from "node:assert/strict";
import {
  REGRAS_PIX,
  descreverCobertura,
  marcasPix,
  resumirConciliacao,
  tceDoFornecedor,
  type TceFederalMunicipio,
  type TceFederalPar,
  type TcePixMunicipio,
} from "./tce.ts";

function pix(extra: Partial<TcePixMunicipio> = {}): TcePixMunicipio {
  return {
    ibge: "2510808", ano: 2025, municipio: "Patos", empenhado: 1_000_000, liquidado: 1_000_000, pago: 1_000_000,
    pago_pessoal: 0, pago_juros: 0, pago_correntes: 100_000, pago_investimentos: 900_000, pago_inversoes: 0, pago_amortizacao: 0,
    pct_capital: 0.9, n_empenhos: 10, n_credores_pj: 3, pago_pj: 1_000_000, pago_pf: 0, pago_emenda_individual: 1_000_000,
    pago_emenda_bancada: 0, pago_emenda_comissao: 0, pago_com_licitacao: 900_000, pago_com_obra: 800_000, ...extra,
  };
}

test("Pix dentro das regras: nenhuma marca", () => {
  assert.deepEqual(marcasPix(pix()), []);
});

test("Pix em pessoal, em dívida e abaixo de 70% de capital: cada marca cita o dispositivo", () => {
  const m = marcasPix(pix({ pago_pessoal: 20_000, pago_juros: 5_000, pago_amortizacao: 10_000, pct_capital: 0.6 }));
  assert.deepEqual(m.map((x) => x.regra), ["pessoal", "divida", "capital"]);
  assert.equal(m[0].dispositivo, "CF, art. 166-A, § 1º, I (EC 105/2019)");
  assert.match(m[1].fato, /R\$ 15 mil pagos em juros e amortização/);
  assert.match(m[2].fato, /60% do pago com o Pix foi capital/);
  assert.ok(Object.values(REGRAS_PIX).every((r) => /EC 105\/2019/.test(r.dispositivo)));
});

test("Pix pequeno não é lido pela fatia de capital", () => {
  assert.deepEqual(marcasPix(pix({ pago: 30_000, pct_capital: 0 })), []);
});

function municipio(extra: Partial<TceFederalMunicipio>): TceFederalMunicipio {
  return {
    ibge: "2504009", ano: 2025, municipio: "Campina Grande", coberto: true, siconv_pj: 0, siconv_casado: 0, siconv_so: 0,
    siconv_nao_verificado: 0, tce_convenio_pj: 0, tce_convenio_pf: 0, tce_convenio_casado: 0, tce_convenio_so: 0, n_so_siconv: 0,
    n_so_tce: 0, ...extra,
  };
}

test("resumo da conciliação: a taxa é sobre o que foi verificado", () => {
  const r = resumirConciliacao([
    municipio({ siconv_pj: 100, siconv_casado: 90, siconv_so: 10, n_so_siconv: 1, tce_convenio_pj: 120, tce_convenio_so: 20, n_so_tce: 2 }),
    municipio({ ano: 2026, coberto: false, siconv_pj: 50, siconv_nao_verificado: 50 }),
  ]);
  assert.equal(r.siconv, 150);
  assert.equal(r.taxa, 0.9);                      // 90 de 100 verificados; os 50 não verificados ficam fora
  assert.deepEqual([r.siconvSo, r.naoVerificado, r.tceConvenio, r.tceSo, r.nSoSiconv, r.nSoTce], [10, 50, 120, 20, 1, 2]);
  assert.equal(resumirConciliacao([municipio({ siconv_pj: 5, siconv_nao_verificado: 5 })]).taxa, null);
});

function par(ano: number, situacao: TceFederalPar["situacao"], convenios = ["900001"], siconv = 100): TceFederalPar {
  return { ibge: "2504009", ano, cnpj: "11111111000111", nome: "A LTDA", tce_convenio: 0, tce_pix: 0, tce_outras: 0, siconv, convenios, situacao };
}

test("o fornecedor no TCE-PB, pelo convênio do laudo", () => {
  const pares = [par(2024, "casado"), par(2025, "so_siconv"), par(2026, "nao_verificado"), par(2025, "casado", ["900999"])];
  const t = tceDoFornecedor(pares, "11111111000111", "900001");
  assert.equal(t?.frase, "no TCE-PB em 2024; sem registro no TCE-PB em 2025; TCE-PB não verificado em 2026");
  assert.deepEqual(t?.soSiconv.map((p) => p.ano), [2025]);
  // Par de outro convênio ou de outro CNPJ não entra.
  assert.equal(tceDoFornecedor(pares, "22222222000122", "900001"), null);
  assert.equal(tceDoFornecedor([par(2025, "so_tce", [], 0)], "11111111000111", "900001"), null);
});

test("cobertura: quantos arquivos e a data mais recente", () => {
  const c = [
    { ibge: "1", ano: 2025, lido: true, modificado: null, coletado_em: "2026-09-29T12:00:00Z", motivo: null },
    { ibge: "1", ano: 2026, lido: false, modificado: null, coletado_em: null, motivo: "x" },
  ];
  assert.equal(descreverCobertura(c), "1 de 2 arquivos de despesa lidos (o mais recente em 29/09/2026)");
});
