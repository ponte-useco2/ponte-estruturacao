import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filaRelatorios,
  funilEspeciais,
  fundoPor,
  motivosSomados,
  parametrosPix,
  percentual1,
  reapresentacao,
  rotuloMotivo,
  soma,
  urlPix,
  type LinhaEspecialAno,
  type LinhaEspecialMotivo,
  type LinhaFundoAno,
  type LinhaFundoRelatorio,
} from "./pix.ts";

const ano = (recorte: string, a: number, campos: Partial<LinhaEspecialAno>): LinhaEspecialAno => ({
  recorte, ano: a, planos: 0, indicado: 0, nao_impedido: 0, impedidos: 0, valor_impedido: 0, duplicados: 0, valor_duplicado: 0,
  empenhado: 0, planos_pagos: 0, pago: 0, pago_pt_aprovado: 0, pago_com_relatorio: 0, pago_com_final: 0, executado_declarado: 0,
  planos_pagos_12m: 0, pago_12m: 0, planos_12m_sem_relatorio: 0, pago_12m_sem_relatorio: 0,
  planos_execucao_encerrada: 0, planos_encerrada_sem_final: 0, pago_encerrada_sem_final: 0, ...campos,
});

const motivo = (recorte: string, a: number, m: string | null, campos: Partial<LinhaEspecialMotivo>): LinhaEspecialMotivo => ({
  recorte, ano: a, motivo: m, impedidos: 0, valor_impedido: 0, impedidos_ciclo1: 0, reapresentados: 0, valor_reapresentado: 0,
  pago_no_gemeo: 0, ...campos,
});

test("parâmetros: aba e UF válidas; o resto cai no padrão", () => {
  assert.deepEqual(parametrosPix({}), { aba: "especiais", uf: null });
  assert.deepEqual(parametrosPix({ aba: "fundo", uf: "pb" }), { aba: "fundo", uf: "PB" });
  assert.deepEqual(parametrosPix({ aba: "x", uf: "ZZ" }), { aba: "especiais", uf: null });
  assert.deepEqual(parametrosPix({ aba: ["fundo", "especiais"], uf: ["RN"] }), { aba: "fundo", uf: "RN" });
});

test("url: só o que difere do padrão", () => {
  const p = { aba: "especiais" as const, uf: null };
  assert.equal(urlPix(p, {}), "/mapa/painel/pix");
  assert.equal(urlPix(p, { aba: "fundo", uf: "PB" }), "/mapa/painel/pix?aba=fundo&uf=PB");
  assert.equal(urlPix({ aba: "fundo", uf: "PB" }, { uf: null }), "/mapa/painel/pix?aba=fundo");
});

test("soma por recorte e anos, sem misturar Brasil e UF", () => {
  const l = [ano("BR", 2024, { pago: 10 }), ano("BR", 2025, { pago: 5 }), ano("PB", 2025, { pago: 1 })];
  assert.equal(soma(l, "BR", "pago"), 15);
  assert.equal(soma(l, "BR", "pago", [2025]), 5);
  assert.equal(soma(l, "PB", "pago"), 1);
  assert.equal(soma(l, "RN", "pago"), 0);
});

test("funil: frações do indicado; indicado zero não divide", () => {
  const f = funilEspeciais([ano("PB", 2025, { indicado: 200, nao_impedido: 150, pago: 100, pago_com_relatorio: 21.4 })], "PB");
  assert.equal(f[0].fracao, 1);
  assert.equal(f.find((e) => e.rotulo.startsWith("Pago (ordem"))?.fracao, 0.5);
  assert.equal(percentual1(f.find((e) => e.rotulo.includes("algum relatório"))?.fracao), "10,7%");
  assert.equal(funilEspeciais([], "PB")[0].fracao, null);
});

test("reapresentação: por ano, só onde houve ciclo posterior, mais recente primeiro", () => {
  const m = [
    motivo("BR", 2025, "falta_analise", { impedidos_ciclo1: 1996, reapresentados: 1620, pago_no_gemeo: 925 }),
    motivo("BR", 2025, "rejeicao_pt", { impedidos_ciclo1: 899, reapresentados: 486, pago_no_gemeo: 360 }),
    motivo("BR", 2026, "falta_complementacao", { impedidos_ciclo1: 300, reapresentados: 0 }),
    motivo("PB", 2025, "falta_analise", { impedidos_ciclo1: 87, reapresentados: 75 }),
  ];
  const r = reapresentacao(m, "BR");
  assert.equal(r.length, 1);
  assert.equal(r[0].ano, 2025);
  assert.equal(r[0].impedidosCiclo1, 2895);
  assert.equal(percentual1(r[0].fracao), "72,7%");
  assert.equal(r[0].pagoNoGemeo, 1285);
});

test("motivos somados: maior valor primeiro, rótulo e lado de quem devia agir", () => {
  const m = [
    motivo("BR", 2024, "rejeicao_pt", { impedidos: 1, valor_impedido: 5 }),
    motivo("BR", 2025, "falta_analise", { impedidos: 2, valor_impedido: 50 }),
    motivo("BR", 2025, "rejeicao_pt", { impedidos: 3, valor_impedido: 10 }),
    motivo("BR", 2025, null, { impedidos: 1, valor_impedido: 1 }),
  ];
  const s = motivosSomados(m, "BR");
  assert.deepEqual(s.map((x) => [x.motivo, x.impedidos, x.valor]), [["falta_analise", 2, 50], ["rejeicao_pt", 4, 15], ["sem_motivo", 1, 1]]);
  assert.equal(s[0].lado, "orgao");
  assert.equal(motivosSomados(m, "BR", [2024]).length, 1);
  assert.equal(rotuloMotivo("desconhecido"), "Impedido sem motivo registrado");
});

test("fundo por ano e por órgão", () => {
  const base = { planos: 1, entes: 1, planos_autorizados: 1, planos_com_saldo: 0, planos_vigencia_encerrada: 0, planos_encerrada_com_saldo: 0, saldo_encerrada: 0 };
  const l: LinhaFundoAno[] = [
    { ...base, recorte: "BR", ano: 2023, orgao: "MEC", repasse: 10, repasse_autorizado: 8, saldo_contas: 2 },
    { ...base, recorte: "BR", ano: 2023, orgao: "MJSP", repasse: 30, repasse_autorizado: 30, saldo_contas: 1 },
    { ...base, recorte: "BR", ano: 2022, orgao: "MEC", repasse: 5, repasse_autorizado: 5, saldo_contas: 0 },
    { ...base, recorte: "PB", ano: 2023, orgao: "MEC", repasse: 99, repasse_autorizado: 99, saldo_contas: 9 },
  ];
  assert.deepEqual(fundoPor(l, "BR", "ano").map((x) => [x.chave, x.repasse, x.saldo]), [["2022", 5, 0], ["2023", 40, 3]]);
  assert.deepEqual(fundoPor(l, "BR", "orgao").map((x) => [x.chave, x.repasse]), [["MJSP", 30], ["MEC", 15]]);
});

test("fila de relatórios: o que espera alguém primeiro, com a data mais antiga", () => {
  const l: LinhaFundoRelatorio[] = [
    { recorte: "BR", ano: 2020, orgao: "MTur", situacao: "APROVADO", tipo: "FINAL", planos: 5, repasse: 50, relatorio_mais_antigo: "2021-01-01" },
    { recorte: "BR", ano: 2020, orgao: "MTur", situacao: "ENVIADO_ANALISE", tipo: "FINAL", planos: 3, repasse: 30, relatorio_mais_antigo: "2022-05-01" },
    { recorte: "BR", ano: 2021, orgao: "MEC", situacao: "ENVIADO_ANALISE", tipo: "PARCIAL", planos: 1, repasse: 10, relatorio_mais_antigo: "2021-03-01" },
    { recorte: "BR", ano: 2021, orgao: "MEC", situacao: "NOVA_SITUACAO", tipo: "-", planos: 1, repasse: 1, relatorio_mais_antigo: null },
  ];
  const f = filaRelatorios(l, "BR");
  assert.deepEqual(f.map((x) => x.situacao), ["ENVIADO_ANALISE", "APROVADO", "NOVA_SITUACAO"]);
  assert.equal(f[0].planos, 4);
  assert.equal(f[0].maisAntigo, "2021-03-01");
  assert.equal(f[2].rotulo, "NOVA_SITUACAO");
});
