import test from "node:test";
import assert from "node:assert/strict";
import type { EventoInstrumento } from "./busca.ts";
import {
  ABAS_INSTRUMENTO,
  abaDoInstrumento,
  barrasDaExecucao,
  fasesDoInstrumento,
  pagamentosPorMes,
  resumoFornecedores,
  urlInstrumentoNaAba,
} from "./pagina-instrumento.ts";

const ev = (data: string, tipo: EventoInstrumento["tipo"], extra: Partial<EventoInstrumento> = {}): EventoInstrumento => ({
  data,
  tipo,
  descricao: null,
  categoria: null,
  valor: null,
  quantidade: null,
  data_fim: null,
  ...extra,
});

test("M2: a aba aberta é a pedida, se existe; senão a visão geral", () => {
  assert.deepEqual(
    ABAS_INSTRUMENTO.map((a) => a.id),
    ["geral", "fase", "execucao"],
  );
  assert.equal(abaDoInstrumento("execucao"), "execucao");
  assert.equal(abaDoInstrumento(["fase", "geral"]), "fase");
  assert.equal(abaDoInstrumento("laudo"), "geral");
  assert.equal(abaDoInstrumento(undefined), "geral");
});

test("M2: o endereço da visão geral é o de sempre; as outras abas vão na busca", () => {
  assert.equal(urlInstrumentoNaAba("962210"), "/mapa/instrumento/962210");
  assert.equal(urlInstrumentoNaAba("962210", "geral"), "/mapa/instrumento/962210");
  assert.equal(urlInstrumentoNaAba("962210", "execucao"), "/mapa/instrumento/962210?aba=execucao");
  assert.equal(urlInstrumentoNaAba("a/b", "fase"), "/mapa/instrumento/a%2Fb?aba=fase");
});

test("M2: as barras da execução ficam entre 0 e 1, e sem dado viram null", () => {
  const [fin, fis, pago] = barrasDaExecucao({ vl_repasse: 1000, vl_desembolsado: 250, vl_pago: 200, pct_fisico: 0.4 });
  assert.equal(fin.fracao, 0.25);
  assert.equal(fis.fracao, 0.4);
  assert.equal(pago.fracao, 0.8);
  // o 999% do job antigo e o repasse zerado não passam
  const b = barrasDaExecucao({ vl_repasse: 0, vl_desembolsado: 10, vl_pago: null, pct_fisico: 9.99 });
  assert.equal(b[0].fracao, null);
  assert.equal(b[1].fracao, 1);
  assert.equal(b[2].fracao, null);
  assert.equal(barrasDaExecucao({ vl_repasse: 100, vl_desembolsado: 300, vl_pago: 0, pct_fisico: null })[0].fracao, 1);
});

test("M2: pagamentos somados por mês, com os meses vazios no meio", () => {
  const m = pagamentosPorMes([
    ev("2024-11-03", "pagamento", { valor: 100, quantidade: 2 }),
    ev("2024-11-20", "pagamento", { valor: 50.5 }),
    ev("2025-02-01", "pagamento", { valor: 10, quantidade: 1 }),
    ev("2024-12-15", "desembolso", { valor: 999 }),
    ev("2025-01-10", "pagamento", { valor: null }),
  ]);
  assert.deepEqual(
    m.map((x) => [x.mes, x.rotulo, x.valor, x.lancamentos]),
    [
      ["2024-11", "nov/24", 150.5, 3],
      ["2024-12", "dez/24", 0, 0],
      ["2025-01", "jan/25", 0, 0],
      ["2025-02", "fev/25", 10, 1],
    ],
  );
  assert.deepEqual(pagamentosPorMes([ev("2024-01-01", "desembolso", { valor: 5 })]), []);
});

test("M2: as fases seguem a ordem do tempo e não repetem a mesma situação seguida", () => {
  const f = fasesDoInstrumento([
    ev("2023-05-02", "situacao", { descricao: "EM_EXECUCAO" }),
    ev("2023-01-10", "situacao", { descricao: "ASSINADO" }),
    ev("2023-03-01", "situacao", { descricao: "ASSINADO" }),
    ev("2023-04-01", "pagamento", { valor: 10 }),
    ev("2024-02-01", "situacao", { descricao: "PRESTACAO_CONTAS_ENVIADA_ANALISE" }),
    ev("2024-06-01", "situacao", { descricao: null }),
  ]);
  assert.deepEqual(f, [
    { codigo: "ASSINADO", desde: "2023-01-10" },
    { codigo: "EM_EXECUCAO", desde: "2023-05-02" },
    { codigo: "PRESTACAO_CONTAS_ENVIADA_ANALISE", desde: "2024-02-01" },
  ]);
  assert.deepEqual(fasesDoInstrumento([]), []);
});

test("M2: os fornecedores somados, sem nome, e o total só com o que existe", () => {
  const r = resumoFornecedores({ vl_repasse: 1, vl_desembolsado: 1, vl_pago: 1, pct_fisico: null, pago_pj: 800, n_fornecedores_pj: 3, pago_pf: 50, n_pagamentos_pf: 4, pago_convenente: null });
  assert.equal(r.pj, 800);
  assert.equal(r.nPj, 3);
  assert.equal(r.pf, 50);
  assert.equal(r.convenente, null);
  assert.equal(r.total, 850);
  assert.equal(resumoFornecedores({ vl_repasse: 1, vl_desembolsado: 1, vl_pago: 1, pct_fisico: null }).total, null);
  // o resumo não carrega nenhum campo de identificação
  assert.deepEqual(Object.keys(r).sort(), ["convenente", "nPagamentosPf", "nPj", "pf", "pj", "total"]);
});

test("M2: as abas vizinhas param nas pontas", async () => {
  const { abasVizinhas } = await import("./pagina-instrumento.ts");
  assert.deepEqual(abasVizinhas("geral"), { anterior: null, proxima: "fase" });
  assert.deepEqual(abasVizinhas("fase"), { anterior: "geral", proxima: "execucao" });
  assert.deepEqual(abasVizinhas("execucao"), { anterior: "fase", proxima: null });
});

test("M2: a faixa da empresa cai dentro da janela do convênio", async () => {
  const { janelaDoPagamento } = await import("./pagina-instrumento.ts");
  assert.deepEqual(janelaDoPagamento("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31"), [0, 1]);
  const j = janelaDoPagamento("2024-07-01", "2024-07-01", "2024-01-01", "2024-12-31");
  assert.ok(j && j[0] === j[1] && j[0] > 0.49 && j[0] < 0.51);
  // fora da janela não passa das bordas; datas trocadas se acertam
  assert.deepEqual(janelaDoPagamento("2025-03-01", "2023-01-01", "2024-01-01", "2024-12-31"), [0, 1]);
  assert.deepEqual(janelaDoPagamento("2024-05-05", "2024-05-05", "2024-05-05", "2024-05-05"), [0, 1]);
  assert.equal(janelaDoPagamento(null, "2024-01-01", "2024-01-01", "2024-02-01"), null);
  assert.equal(janelaDoPagamento("ontem", "2024-01-01", "2024-01-01", "2024-02-01"), null);
});
