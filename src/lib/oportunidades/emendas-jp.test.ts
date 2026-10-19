import test from "node:test";
import assert from "node:assert/strict";
import {
  anosDaCamara,
  chaveEmendaJp,
  emendaJpDaUrl,
  emendasDoRetrato,
  emendasJpDaEntidade,
  etapaDe,
  filaDaExecucao,
  fonteDoAno,
  municipalDaEntidadeNaLeitura,
  municipalDaEntidadePorAno,
  municipalDaLeitura,
  municipalPorAno,
  pontosParaOlhar,
  resumoDasEtapas,
  slugVereador,
  urlEmendaJp,
  urlVereadorJp,
  vereadoresDoRetrato,
  type LinhaEjp,
  type RetratoEjp,
} from "./emendas-jp.ts";

const CNPJ = "08939944000130";

function linha(x: Partial<LinhaEjp>): LinhaEjp {
  return {
    ano: 2026, codigo: 1, ug: "FUNDO MUNICIPAL DE SAÚDE", vereador_publicado: "APELIDO - NOME", pessoa: "APELIDO", sapl_materia: 194000,
    objeto: "Objeto", cnpj_objeto: null, cnpj_objeto_invalido: false, dotacao: 0, empenhado: 0, liquidado: 0, pago: 0, situacao: "ativo",
    remanejada: false, empenhos_n: 0, pagamentos_n: 0, ...x,
  };
}

/** O retrato de uma rodada pequena: duas emendas no painel (uma remanejada de unidade) e uma do portal. */
function retrato(): RetratoEjp {
  return {
    execucao: { id: 1, concluidaEm: "2026-10-16T21:56:31Z", dadoAte: "2026-10-16T21:55:18Z", referencia: "2026-10-16", exercicio: 2026 },
    vereadores: [
      { pessoa: "APELIDO", tipo: "vereador", sapl_autor: 81, grafias_painel: ["APELIDO - NOME"], grafias_loa: [], anos: [2026] },
      { pessoa: "MESA DIRETORA", tipo: "colegiado", sapl_autor: null, grafias_painel: [], grafias_loa: ["MESA DIRETORA"], anos: [2024] },
    ],
    linhas: [
      linha({ codigo: 171, dotacao: 150000, empenhado: 100000, liquidado: 50000, pago: 50000, cnpj_objeto: CNPJ }),
      linha({ codigo: 171, ug: "FUNJOPE", dotacao: 0, remanejada: true }),
      linha({ codigo: 200, dotacao: 80000 }),
    ],
    dotacoes: [{ ano: 2026, codigo: 171, seq: 1, data: "2026-01-07", valor_original: 160000, valor_atual: 150000 }],
    credores: [],
    empenhos: [
      { ano: 2026, ug_codigo: "610095", ug_nome: "Fundo Municipal de Saúde", numero_empenho: "1984", seq: 1, data_empenho: "2026-04-14",
        credor_cnpj: CNPJ, credor_nome: "INSTITUTO X", empenhado: 100000, liquidado: 50000, pago: 50000, elemento: "43", modalidade_licitacao: null,
        numero_licitacao: null, historico: "EMENDA IMPOSITIVA Nº 171/2025", codigo_citado: 171, ano_citado: 2025 },
      { ano: 2026, ug_codigo: "610095", ug_nome: null, numero_empenho: "1990", seq: 1, data_empenho: "2026-05-01", credor_cnpj: CNPJ,
        credor_nome: "INSTITUTO X", empenhado: 1, liquidado: 0, pago: 0, elemento: null, modalidade_licitacao: null, numero_licitacao: null,
        historico: "cita a emenda 171/2026, outro exercício", codigo_citado: 171, ano_citado: 2026 },
    ],
    pf: [],
    hist: [
      { ano: 2024, mes_referencia: "Dezembro", ug_codigo: "080101/00001", ug_nome: "SECRETARIA", codigo: 5, objetivo: "A", cnpj_objeto: null, cnpj_objeto_invalido: true,
        autor_publicado: "MESA DIRETORA", pessoa: "MESA DIRETORA", original: 100, atual: 90, empenhado: 90, liquidado: 90, pago: 90 },
    ],
    loa: [],
  };
}

test("endereço da emenda: ano do exercício e número com quatro dígitos", () => {
  assert.equal(chaveEmendaJp(2026, 171), "2026-0171");
  assert.equal(urlEmendaJp(2026, 171), "/mapa/parlamentares/camara-jp/emenda/2026-0171");
  assert.deepEqual(emendaJpDaUrl("2026-0171"), { ano: 2026, codigo: 171 });
  for (const ruim of ["171-2026", "2026/0171", "1999-0001", "2026-00001", null]) assert.equal(emendaJpDaUrl(ruim), null, String(ruim));
  assert.equal(slugVereador("CARLÃO PELO BEM"), "carlao-pelo-bem");
  assert.equal(urlVereadorJp("ÍCARO CHAVES"), "/mapa/parlamentares/camara-jp/icaro-chaves");
});

test("etapa: pela execução sobre o valor atual", () => {
  const e = (atual: number, empenhado: number, liquidado: number, pago: number) => etapaDe({ atual, empenhado, liquidado, pago });
  assert.equal(e(0, 0, 0, 0), "sem_valor");
  assert.equal(e(100, 0, 0, 0), "sem_empenho");
  assert.equal(e(100, 100, 0, 0), "empenhada");
  assert.equal(e(100, 100, 100, 0), "liquidada");
  assert.equal(e(100, 100, 100, 40), "paga_em_parte");
  assert.equal(e(100, 100, 100, 99.6), "paga", "tolerância de R$ 0,50");
});

test("a emenda junta as linhas do painel e a do portal fica à parte", () => {
  const es = emendasDoRetrato(retrato());
  assert.deepEqual(es.map((e) => e.chave), ["2026-0171", "2026-0200", "2024-0005"]);
  const e171 = es[0];
  assert.deepEqual([e171.atual, e171.empenhado, e171.pago, e171.original, e171.etapa, e171.remanejada], [150000, 100000, 50000, 160000, "paga_em_parte", true]);
  assert.deepEqual(e171.unidades, ["FUNDO MUNICIPAL DE SAÚDE"], "a unidade de onde a emenda saiu não conta");
  assert.equal(e171.cnpj, CNPJ);
  // Só o empenho que cita a emenda com o ano da apresentação (2025 para o exercício de 2026).
  assert.deepEqual([e171.empenhosTce, e171.primeiroEmpenho], [1, "2026-04-14"]);
  assert.deepEqual([es[1].etapa, es[1].original], ["sem_empenho", null]);
  assert.deepEqual([es[2].origem, es[2].mesReferencia, es[2].original, es[2].atual, es[2].etapa], ["portal", "Dezembro", 100, 90, "paga"]);
});

test("cada ano tem a sua fonte, e a lista abre por nome", () => {
  const r = retrato();
  const es = emendasDoRetrato(r);
  const anos = anosDaCamara(es);
  assert.deepEqual(anos.map((a) => [a.ano, a.emendas, a.atual, a.pago, a.semEmpenho]), [[2026, 2, 230000, 50000, 1], [2024, 1, 90, 90, 0]]);
  assert.equal(fonteDoAno(anos[0]), "painel da Prefeitura (diário)");
  assert.equal(fonteDoAno(anos[1]), "portal da Prefeitura, posição de dezembro");
  const vs = vereadoresDoRetrato(r, es);
  assert.deepEqual(vs.map((v) => [v.pessoa, v.tipo, v.emendas, v.exercicioEmendas, v.exercicioSemEmpenho]), [
    ["APELIDO", "vereador", 2, 2, 1],
    ["MESA DIRETORA", "colegiado", 1, 0, 0],
  ]);
});

test("a fila: só o exercício, sem as pagas, da etapa mais atrás", () => {
  const es = emendasDoRetrato(retrato());
  assert.deepEqual(filaDaExecucao(es, 2026).map((e) => e.codigo), [200, 171]);
  assert.deepEqual(resumoDasEtapas(es, 2026).map((x) => [x.etapa, x.emendas]), [["sem_empenho", 1], ["paga_em_parte", 1]]);
  assert.deepEqual(filaDaExecucao(es, null), []);
});

test("a entidade: citada no objeto e credora do empenho", () => {
  const r = retrato();
  const es = emendasDoRetrato(r);
  const x = emendasJpDaEntidade(r, es, CNPJ);
  assert.deepEqual(x.map((y) => [y.emenda.chave, y.como, y.empenhadoTce]), [["2026-0171", "objeto_e_credor", 100000]]);
  assert.deepEqual(emendasJpDaEntidade(r, es, "00000000000000"), []);
});

test("o municipal por ano (J3): a Câmara inteira e a entidade, sem a emenda sem valor", () => {
  const r = retrato();
  const es = emendasDoRetrato(r);
  assert.deepEqual(municipalPorAno(es), [
    { ano: 2024, atual: 90, pago: 90 },
    { ano: 2026, atual: 230000, pago: 50000 },
  ]);
  assert.deepEqual(municipalDaEntidadePorAno(emendasJpDaEntidade(r, es, CNPJ)), [{ ano: 2026, atual: 150000, pago: 50000 }]);
  assert.deepEqual(municipalDaLeitura({ estado: "ok", retrato: r }), municipalPorAno(es));
  assert.equal(municipalDaLeitura({ estado: "falha" }), undefined);
  assert.equal(municipalDaLeitura(undefined), undefined);
  assert.deepEqual(municipalDaEntidadeNaLeitura({ estado: "ok", retrato: r }, CNPJ), [{ ano: 2026, atual: 150000, pago: 50000 }]);
  assert.equal(municipalDaEntidadeNaLeitura({ estado: "ok", retrato: r }, "00000000000000"), undefined, "sem emenda, sem coluna");
  assert.equal(municipalDaEntidadeNaLeitura({ estado: "sem_dado" }, CNPJ), undefined);
});

test("pontos para olhar (J3): CNPJ com dígito errado, empenho a outro CNPJ e empenho sem o TCE-PB", () => {
  const OUTRO = "11222333000181";
  const r = retrato();
  r.linhas.push(linha({ codigo: 300, dotacao: 9000, empenhado: 5000 }), linha({ codigo: 400, dotacao: 0, empenhado: 0, cnpj_objeto_invalido: true }));
  r.empenhos.push({
    ano: 2026, ug_codigo: "610095", ug_nome: null, numero_empenho: "2001", seq: 1, data_empenho: "2026-06-01", credor_cnpj: OUTRO,
    credor_nome: "EMPRESA Y", empenhado: 7000.5, liquidado: 0, pago: 0, elemento: "30", modalidade_licitacao: null, numero_licitacao: null,
    historico: "EMENDA 171/2025", codigo_citado: 171, ano_citado: 2025,
  });
  const ps = pontosParaOlhar(r, emendasDoRetrato(r));
  assert.deepEqual(ps.map((p) => [p.ponto, p.emenda.chave]), [
    ["cnpj_invalido", "2024-0005"],
    ["credor_diferente", "2026-0171"],
    ["sem_empenho_tce", "2026-0300"],
  ], "a emenda sem valor (400) não entra; a 200, sem empenho no painel, também não");
  assert.equal(ps[1].detalhe, "1 empenho no TCE-PB a outro CNPJ (R$ 7.000,50).");
  assert.equal(ps[2].detalhe, "R$ 5.000,00 empenhados no painel; nenhum empenho do TCE-PB cita a emenda.");
  assert.equal(ps.some((p) => /irregular/i.test(p.detalhe)), false);
  assert.deepEqual(pontosParaOlhar(retrato(), emendasDoRetrato(retrato())).map((p) => p.ponto), ["cnpj_invalido"]);
});
