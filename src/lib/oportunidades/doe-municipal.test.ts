import test from "node:test";
import assert from "node:assert/strict";
import {
  atosPorAno,
  atosPorClasse,
  avisoDespesaLocal,
  despesaLocalPorAno,
  repassesPorAno,
  separarConvenios,
  totalConcedente,
  transferenciasPorOrgao,
  type ConvenioTpb,
  type MesDoe,
  type RepasseTpb,
} from "./doe-municipal.ts";

const mes = (m: string, classe: string, n: number): MesDoe => ({ mes: m, esfera: "municipal", classe, subclasse: "", n_atos: n, valor_max_soma: null, confianca_classe: "alta" });

test("atos por classe e por ano", () => {
  const ms = [mes("2025-01", "licitação", 3), mes("2025-02", "contrato", 1), mes("2026-01", "licitação", 2)];
  assert.deepEqual(atosPorClasse(ms).map((x) => [x.classe, x.n]), [["licitação", 5], ["contrato", 1]]);
  assert.deepEqual(atosPorAno(ms), [{ ano: "2025", n: 4 }, { ano: "2026", n: 2 }]);
});

const rep = (m: string, tipo: string, pago: number, confianca = "alta", orgao = "SES"): RepasseTpb => ({
  mes: m, orgao, funcao: null, grupo_natureza: null, modalidade: null, tipo_pagamento: tipo, credor: "prefeitura", confianca, pago, empenhado: pago,
});

test("só a transferência é repasse; o pagamento direto fica à parte e não soma", () => {
  const r = [rep("2025-01", "transferência", 100), rep("2025-03", "pagamento direto à prefeitura (tributo…)", 900), rep("2026-01", "transferência", 50, "media", "SEDH")];
  assert.deepEqual(repassesPorAno(r), [
    { ano: "2025", transferencia: 100, direto: 900, mediaConfianca: false },
    { ano: "2026", transferencia: 50, direto: 0, mediaConfianca: true },
  ]);
  assert.deepEqual(transferenciasPorOrgao(r), [{ orgao: "SES", pago: 100 }, { orgao: "SEDH", pago: 50 }]);
});

test("convênios do ente e de quem tem sede: duas listas", () => {
  const c = (tipo: ConvenioTpb["convenente_tipo"], v: number, ano = 2025): ConvenioTpb => ({
    ano, numero: null, instrumento: null, concedente: null, convenente: null, convenente_tipo: tipo, objeto: null, inicio: null, fim: null,
    valor_concedente: v, valor_total: v, link: null,
  });
  const s = separarConvenios([c("ente municipal", 10), c("sediado no município", 99), c("ente municipal", 20, 2026)]);
  assert.deepEqual(s.ente.map((x) => x.valor_concedente), [20, 10]);
  assert.equal(s.sediado.length, 1);
  assert.equal(totalConcedente(s.ente), 30);
});

test("despesa local por ano e o aviso da capital", () => {
  assert.deepEqual(despesaLocalPorAno([{ mes: "2025-01", orgao: null, funcao: null, pago: 1, empenhado: 1 }, { mes: "2025-02", orgao: null, funcao: null, pago: 2, empenhado: 2 }]), [{ ano: "2025", pago: 3 }]);
  assert.match(avisoDespesaLocal("2507507"), /não é mostrada para João Pessoa/);
  assert.match(avisoDespesaLocal("2511004"), /^A conferir/);
});
