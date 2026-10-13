/**
 * As tabelas com filtro do relatório do município, da entidade, do laudo e do Pix do ente (onda 15, fase 2, lote B,
 * 13/10/2026): ids válidos e únicos na página, a regra do público (valor e contagem não ordenam, nem pelo endereço;
 * ordem padrão alfabética; sem o corte dos 15 maiores), os valores crus das colunas ocultas, o recorte do público sem
 * campo de análise e o CSV.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COLUNAS_EMENDAS,
  COLUNAS_TCE,
  ORDEM_EMENDAS,
  ORDEM_TCE,
  RECORTES_DO_PUBLICO,
  TABELA_CONVENIOS,
  TABELA_EMENDAS,
  TABELA_TCE,
  colunasConvenios,
  conveniosNaOrdem,
  emendasNaOrdem,
  montarRelatorio,
  ordemPadraoConvenios,
  rotuloTipoParlamentar,
  trechoDoArquivo,
  valoresDaEmenda,
  valoresDaTce,
  valoresDoConvenio,
  type EntradaRelatorio,
  type InstrumentoRelatorio,
  type LinhaDoRecorte,
  type PropostaRelatorio,
  type RecorteConvenios,
} from "./relatorio-municipio.ts";
import { relatorioDoNivel } from "./pagina-municipio.ts";
import {
  COLUNAS_CARTEIRA,
  COLUNAS_ORGAOS,
  COLUNAS_PROPOSTAS,
  ORDEM_ORGAOS,
  ORDEM_PROPOSTAS,
  TABELA_CARTEIRA,
  TABELA_ORGAOS,
  TABELA_PROPOSTAS,
  carteiraEmLinhas,
  carteiraPorSituacao,
  numeroDaProposta,
  orgaosEmOrdem,
  propostasNaOrdem,
  valoresDaCarteira,
  valoresDaProposta,
  valoresDoOrgao,
} from "./pagina-entidade.ts";
import { aplicar, csvDaTabela, idValido, lerEstado, type ColunaTabela, type LinhaTabela } from "./tabela-filtro.ts";

const HOJE = "2026-10-01";
const RECORTES: RecorteConvenios[] = ["execucao", "vencida", "contas", "liminar", "nunca", "pc33"];

const inst = (x: Partial<InstrumentoRelatorio>): InstrumentoRelatorio => ({
  nr_convenio: "900000", modalidade: "Convênio", situacao: "Em execução", subsituacao: null, orgao_sup: "MINISTERIO DA AGRICULTURA", programa: null,
  objeto: null, vl_global: 1_000_000, vl_repasse: 950_000, vl_desembolsado: 500_000, vl_pago: 400_000, vl_saldo_conta: 100_000, pct_fisico: 0.5,
  dt_assinatura: "2024-06-01", dt_fim_vigencia: "2027-12-31", dt_limite_contas: null, dt_primeiro_desembolso: "2025-01-10",
  dt_ultimo_desembolso: "2026-08-01", dt_ultimo_pagamento: "2026-08-20", situacao_contratacao: null,
  pc33_regime: null, pc33_nivel: null, pc33_pior: null, pc33_itens: null, ...x,
});

/** Uma entrada só com convênios e emendas: o resto como fonte que não respondeu (null), sem falta registrada. */
function entrada(x: Partial<EntradaRelatorio> = {}): EntradaRelatorio {
  return {
    ibge: "2510808",
    nome: "Patos",
    fiscal: null,
    serie: null,
    instrumentos: [
      // Em execução: o de MAIOR valor tem o MAIOR número, para a ordem por número não coincidir com a de valor.
      inst({ nr_convenio: "942082", orgao_sup: "MINISTERIO DA SAUDE", vl_global: 900_000, pct_fisico: 0.456, dt_fim_vigencia: "2026-09-30", vl_saldo_conta: 935_000 }),
      inst({ nr_convenio: "990001", orgao_sup: "MINISTERIO DA SAUDE", vl_global: 66_000_000, vl_desembolsado: 31_000_000 }),
      inst({ nr_convenio: "905000", vl_global: 5_000_000, pct_fisico: null }),
      inst({ nr_convenio: "826152", situacao: "Aguardando Prestação de Contas", orgao_sup: "MINISTERIO DAS COMUNICACOES", dt_limite_contas: "2020-02-29" }),
      inst({ nr_convenio: "703764", situacao: "Prestação de Contas Rejeitada", orgao_sup: "MINISTERIO DO TURISMO" }),
      inst({ nr_convenio: "989358", situacao_contratacao: "Liminar Judicial", dt_fim_vigencia: "2027-06-30" }),
      inst({ nr_convenio: "991000", situacao: "Proposta/Plano de Trabalho Aprovado", vl_global: 300_000, dt_fim_vigencia: "2027-01-31", vl_desembolsado: null }),
    ],
    referenciaPainel: "2026-09-29",
    emendas: [],
    propostas: [],
    tcu: null,
    contasObras: null,
    pix: null,
    pixTce: null,
    fundo: null,
    conciliacao: null,
    fornecedores: null,
    janelas: null,
    faltas: [],
    ...x,
  };
}

const ids = (cs: readonly ColunaTabela[]) => cs.map((c) => c.id);
const porId = (cs: readonly ColunaTabela[], id: string) => cs.find((c) => c.id === id) as ColunaTabela;
const linhasDe = (valores: Record<string, string | number | null>[]): LinhaTabela[] => valores.map((v, k) => ({ chave: String(k), valores: v, celulas: {} }));

/** As tabelas que o público (nível 0) vê: a regra "sem ranking" vale nelas. */
const PUBLICAS: [string, ColunaTabela[]][] = [
  [TABELA_CONVENIOS.execucao, colunasConvenios("execucao")],
  [TABELA_EMENDAS, COLUNAS_EMENDAS],
  [TABELA_CARTEIRA, COLUNAS_CARTEIRA],
  [TABELA_PROPOSTAS, COLUNAS_PROPOSTAS],
  [TABELA_ORGAOS, COLUNAS_ORGAOS],
];
/** Os números que não são valor nem contagem: o ano e a execução física (percentual) ordenam também no público. */
const NUMERO_SEM_RANKING = new Set(["ano", "fisico"]);

// ================================================================ ids

test("onda 15, lote B: ids de tabela e de coluna válidos, e únicos na página que junta todas", () => {
  const tabelas: [string, ColunaTabela[]][] = [
    ...RECORTES.map((r): [string, ColunaTabela[]] => [TABELA_CONVENIOS[r], colunasConvenios(r)]),
    [TABELA_TCE, COLUNAS_TCE],
    [TABELA_EMENDAS, COLUNAS_EMENDAS],
    [TABELA_CARTEIRA, COLUNAS_CARTEIRA],
    [TABELA_PROPOSTAS, COLUNAS_PROPOSTAS],
    [TABELA_ORGAOS, COLUNAS_ORGAOS],
  ];
  for (const [id, colunas] of tabelas) {
    assert.ok(idValido(id), id);
    assert.equal(new Set(ids(colunas)).size, colunas.length, `${id}: coluna repetida`);
    for (const c of colunas) assert.ok(idValido(c.id), `${id}.${c.id}`);
    // A primeira coluna desenhada é o cabeçalho da linha: o número, o nome ou o órgão.
    assert.ok(!colunas[0].oculta && colunas[0].filtravel !== false, `${id}: a primeira coluna filtra`);
  }
  // O relatório da entidade para imprimir junta todas: nenhum id se repete.
  assert.equal(new Set(tabelas.map(([id]) => id)).size, tabelas.length);
});

// ================================================================ a regra do público

test("onda 15, lote B: nas tabelas do público, valor e contagem filtram, mas não ordenam; o resto ordena", () => {
  for (const [id, colunas] of PUBLICAS) {
    for (const c of colunas) {
      if (c.tipo === "numero" && !NUMERO_SEM_RANKING.has(c.id)) {
        assert.equal(c.ordenavel, false, `${id}.${c.id} não ordena`);
        assert.notEqual(c.filtravel, false, `${id}.${c.id} filtra`);
      } else if (c.id !== "nota") {
        assert.notEqual(c.ordenavel, false, `${id}.${c.id} ordena`);
      }
    }
  }
  assert.deepEqual(RECORTES_DO_PUBLICO, ["execucao"]);
  // As listas de análise (só do cadastro) e as tomadas de contas ordenam por qualquer coluna (menos a nota composta).
  for (const r of RECORTES.filter((x) => x !== "execucao")) {
    for (const c of colunasConvenios(r)) if (c.id !== "nota") assert.notEqual(c.ordenavel, false, `${r}.${c.id}`);
  }
  for (const c of COLUNAS_TCE) assert.notEqual(c.ordenavel, false, `tce.${c.id}`);
});

test("onda 15, lote B: o endereço não força ranking nas tabelas do público", () => {
  for (const [id, colunas, coluna] of [
    [TABELA_CONVENIOS.execucao, colunasConvenios("execucao"), "valor"],
    [TABELA_CONVENIOS.execucao, colunasConvenios("execucao"), "desembolsado"],
    [TABELA_EMENDAS, COLUNAS_EMENDAS, "valor"],
    [TABELA_EMENDAS, COLUNAS_EMENDAS, "convenios"],
    [TABELA_CARTEIRA, COLUNAS_CARTEIRA, "valor"],
    [TABELA_PROPOSTAS, COLUNAS_PROPOSTAS, "repasse"],
    [TABELA_ORGAOS, COLUNAS_ORGAOS, "instrumentos"],
  ] as [string, ColunaTabela[], string][]) {
    const e = lerEstado(id, colunas, new URLSearchParams(`t.${id}.o=${coluna}.desc&t.${id}.${coluna}=1..`));
    assert.equal(e.ordem, null, `${id}: ordem por ${coluna} ignorada`);
    assert.ok(e.filtros[coluna], `${id}: o filtro por ${coluna} vale`);
  }
  // Na lista de análise, a ordem por valor vale.
  assert.deepEqual(lerEstado(TABELA_CONVENIOS.vencida, colunasConvenios("vencida"), new URLSearchParams(`t.${TABELA_CONVENIOS.vencida}.o=valor.desc`)).ordem, {
    coluna: "valor",
    sentido: "desc",
  });
});

// ================================================================ convênios

test("onda 15, lote B: os em execução saem pelo número (antes, pelo valor) e o empate volta ao número, não ao valor", () => {
  const r = montarRelatorio(entrada(), HOJE);
  const exec = r.convenios?.emExecucao ?? [];
  assert.deepEqual(exec.map((l) => l.nr_convenio), ["990001", "905000", "989358", "942082"], "o relatório continua do maior valor para o menor");
  assert.deepEqual(ordemPadraoConvenios("execucao"), { ordem: { coluna: "convenio", sentido: "asc" } });
  const naOrdem = conveniosNaOrdem(exec, "execucao");
  assert.deepEqual(naOrdem.map((l) => l.nr_convenio), ["905000", "942082", "989358", "990001"]);
  // Ordenar pelo órgão: os dois da Saúde ficam pelo número (942082 antes de 990001), e não pelo valor.
  const colunas = colunasConvenios("execucao");
  const linhas: LinhaTabela[] = naOrdem.map((l) => ({ chave: l.nr_convenio, valores: valoresDoConvenio(l, "execucao"), celulas: {} }));
  const porOrgao = aplicar(colunas, linhas, { filtros: {}, ordem: { coluna: "orgao", sentido: "desc" } }).map((l) => l.chave);
  assert.deepEqual(porOrgao.slice(0, 2), ["942082", "990001"]);
});

test("onda 15, lote B: os valores crus de cada recorte batem com as colunas, e as ocultas trazem o dado da nota", () => {
  const r = montarRelatorio(entrada(), HOJE);
  const c = r.convenios;
  assert.ok(c);
  const listas: Record<RecorteConvenios, LinhaDoRecorte[]> = {
    execucao: c.emExecucao,
    vencida: c.vigenciaVencida,
    contas: [...c.contasAtrasadas, ...c.contasNegativas],
    liminar: c.liminar,
    nunca: c.nuncaAssinados,
    pc33: [{ ...c.emExecucao[0], nota: "Sem meta física cadastrada", nivel: "alto" }],
  };
  for (const recorte of RECORTES) {
    assert.ok(listas[recorte].length > 0, recorte);
    for (const l of listas[recorte]) assert.deepEqual(Object.keys(valoresDoConvenio(l, recorte)).sort(), ids(colunasConvenios(recorte)).sort(), recorte);
  }
  const v = valoresDoConvenio(c.emExecucao.find((l) => l.nr_convenio === "942082") as LinhaDoRecorte, "execucao");
  assert.equal(v.vigencia, "2026-09-30");
  assert.equal(v.fisico, 46, "o físico em pontos percentuais, como a nota (46%)");
  assert.equal(v.orgao, "Ministério da Saúde");
  assert.equal(valoresDoConvenio(c.emExecucao.find((l) => l.nr_convenio === "905000") as LinhaDoRecorte, "execucao").fisico, null);
  // A nota que junta dois dados não filtra, não ordena e não vai ao CSV; as ocultas fazem isso.
  const nota = porId(colunasConvenios("execucao"), "nota");
  assert.deepEqual([nota.filtravel, nota.ordenavel, nota.semCsv, nota.oculta], [false, false, true, undefined]);
  assert.ok(porId(colunasConvenios("execucao"), "vigencia").oculta && porId(colunasConvenios("execucao"), "fisico").oculta);

  const vencida = valoresDoConvenio(c.vigenciaVencida[0], "vencida");
  assert.deepEqual([vencida.convenio, vencida.vigencia, vencida.saldo], ["942082", "2026-09-30", 935_000]);
  const contas = Object.fromEntries(listas.contas.map((l) => [l.nr_convenio, valoresDoConvenio(l, "contas")]));
  assert.deepEqual([contas["826152"].situacao, contas["826152"]["prazo-contas"]], ["Aguardando Prestação de Contas", "2020-02-29"]);
  assert.deepEqual([contas["703764"].situacao, contas["703764"]["prazo-contas"]], ["Prestação de Contas Rejeitada", null]);
  assert.equal(valoresDoConvenio(c.liminar[0], "liminar").contratacao, "Liminar Judicial");
  assert.equal(valoresDoConvenio(c.nuncaAssinados[0], "nunca").vigencia, "2027-01-31");
  assert.deepEqual(valoresDoConvenio(listas.pc33[0], "pc33").nivel, "Alto");
  // A ordem de cada lista de análise: a vencida pelo valor; as contas como chegam; as outras pelo número.
  assert.deepEqual(ordemPadraoConvenios("vencida").ordem, { coluna: "valor", sentido: "desc" });
  assert.equal(ordemPadraoConvenios("contas").ordem, null);
  assert.deepEqual(conveniosNaOrdem(listas.contas, "contas").map((l) => l.nr_convenio), ["826152", "703764"]);
});

test("onda 15, lote B: no público, os em execução não levam campo de análise, e as listas de análise vêm vazias", () => {
  const inteiro = montarRelatorio(entrada(), HOJE);
  const pub = relatorioDoNivel(inteiro, 0);
  const exec = pub.convenios?.emExecucao ?? [];
  assert.ok(exec.length > 0);
  for (const l of exec) {
    assert.equal(l.saldoConta, undefined, l.nr_convenio);
    assert.equal(l.prazoContas, undefined, l.nr_convenio);
    const v = valoresDoConvenio(l, "execucao");
    assert.ok(!("saldo" in v) && !("prazo-contas" in v));
  }
  for (const k of ["vigenciaVencida", "contasAtrasadas", "contasNegativas", "liminar", "nuncaAssinados", "pc33"] as const) assert.deepEqual(pub.convenios?.[k], [], k);
  // O saldo e o prazo existem no relatório inteiro (o cadastro vê), só nas listas de análise.
  assert.equal(inteiro.convenios?.vigenciaVencida[0].saldoConta, 935_000);
  assert.equal(inteiro.convenios?.contasAtrasadas[0].prazoContas, "2020-02-29");
});

test("onda 15, lote B: o CSV do recorte leva as colunas ocultas e não leva a nota composta", () => {
  const r = montarRelatorio(entrada(), HOJE);
  const colunas = colunasConvenios("execucao");
  const linhas: LinhaTabela[] = conveniosNaOrdem(r.convenios?.emExecucao ?? [], "execucao").map((l) => ({
    chave: l.nr_convenio,
    valores: valoresDoConvenio(l, "execucao"),
    celulas: {},
  }));
  const csv = csvDaTabela(colunas, linhas);
  const [cabeca, primeira] = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  assert.equal(cabeca, "Convênio;Órgão;Objeto;Valor;Desembolsado;Fim da vigência;Execução física (%)");
  assert.match(primeira, /^"=""905000""";/, "o número sai como texto (a forma do `paraCsv`)");
  assert.match(primeira, /;31\/12\/2027;$/, "a vigência oculta vai ao CSV; o físico vazio fica vazio");
});

// ================================================================ tomadas de contas e emendas

test("onda 15, lote B: as tomadas de contas especiais — valores crus e ordem pelo convênio", () => {
  const v = valoresDaTce({ nr_convenio: "703764", numero_processo: "0703764/2024-0", situacao: "Processo autuado", debito_original: 300_000, debito_com_juros: 900_000 });
  assert.deepEqual(Object.keys(v).sort(), ids(COLUNAS_TCE).sort());
  assert.deepEqual(v, { convenio: "703764", processo: "0703764/2024-0", situacao: "Processo autuado", debito: 300_000, "com-juros": 900_000 });
  assert.deepEqual(ORDEM_TCE, { coluna: "convenio", sentido: "asc" });
  assert.ok(porId(COLUNAS_TCE, "processo").textoNoCsv, "o processo sai no CSV como texto");
});

test("onda 15, lote B: as emendas — todos os parlamentares, em ordem alfabética, sem o corte dos 15 maiores", () => {
  const emendas = Array.from({ length: 20 }, (_, k) => ({
    nr_convenio: `9${String(k).padStart(5, "0")}`,
    parlamentar: `PARLAMENTAR ${String.fromCharCode(84 - k)}`, // T, S, R… até A: o de maior valor é o último do alfabeto
    tipo_parlamentar: k % 2 ? "BANCADA" : "INDIVIDUAL",
    valor: 1_000_000 - k * 10_000,
  }));
  const r = montarRelatorio(entrada({ emendas }), HOJE);
  assert.equal(r.emendas?.length, 20, "o relatório traz os 20");
  assert.equal(relatorioDoNivel(r, 0).emendas?.length, 20, "o público também");
  const naOrdem = emendasNaOrdem(r.emendas ?? []);
  assert.deepEqual(naOrdem.slice(0, 3).map((e) => e.parlamentar), ["PARLAMENTAR A", "PARLAMENTAR B", "PARLAMENTAR C"]);
  assert.equal(naOrdem.length, 20);
  assert.deepEqual(ORDEM_EMENDAS, { coluna: "parlamentar", sentido: "asc" });
  const v = valoresDaEmenda(naOrdem[0]);
  assert.deepEqual(Object.keys(v).sort(), ids(COLUNAS_EMENDAS).sort());
  assert.deepEqual(v, { parlamentar: "PARLAMENTAR A", tipo: "Bancada", convenios: 1, valor: 810_000 });
  // O tipo filtra pela categoria; o valor, pelo intervalo.
  const linhas = linhasDe(naOrdem.map(valoresDaEmenda));
  assert.equal(aplicar(COLUNAS_EMENDAS, linhas, { filtros: { tipo: { tipo: "categoria", valores: ["individual"] } }, ordem: null }).length, 10);
  assert.equal(aplicar(COLUNAS_EMENDAS, linhas, { filtros: { valor: { tipo: "numero", de: 900_000, ate: null } }, ordem: null }).length, 11);
});

test("onda 15, lote B: o tipo do parlamentar com o rótulo do laudo e a inicial maiúscula", () => {
  assert.equal(rotuloTipoParlamentar("INDIVIDUAL"), "Individual");
  assert.equal(rotuloTipoParlamentar("COMISSAO"), "Comissão");
  assert.equal(rotuloTipoParlamentar("RELATOR GERAL"), "Relator-geral");
  assert.equal(rotuloTipoParlamentar("bancada"), "Bancada");
  assert.equal(rotuloTipoParlamentar("Deputado Federal"), "Deputado federal");
  assert.equal(rotuloTipoParlamentar(null), null);
  assert.equal(rotuloTipoParlamentar("  "), null);
});

// ================================================================ entidade

test("onda 15, lote B: a carteira vira uma tabela, com a situação como categoria e a ordem de antes", () => {
  const xs = [
    inst({ nr_convenio: "1", situacao: "Prestação de Contas Concluída", dt_assinatura: "2020-01-01" }),
    inst({ nr_convenio: "2", situacao: "Em execução", dt_assinatura: "2023-01-01", vl_global: 10 }),
    inst({ nr_convenio: "3", situacao: "Em execução", dt_assinatura: "2025-01-01", vl_global: 1 }),
    inst({ nr_convenio: "4", situacao: "Aguardando Prestação de Contas", dt_assinatura: "2024-01-01" }),
  ];
  const linhas = carteiraEmLinhas(xs);
  assert.deepEqual(
    linhas.map(({ i }) => i.nr_convenio),
    carteiraPorSituacao(xs).flatMap((g) => g.itens.map((i) => i.nr_convenio)),
    "a mesma ordem dos grupos de antes",
  );
  assert.deepEqual(linhas.map(({ i }) => i.nr_convenio).slice(0, 2), ["3", "2"], "em execução primeiro, da assinatura mais recente (não do maior valor)");
  const tabela: LinhaTabela[] = linhas.map(({ i, situacao }) => ({ chave: i.nr_convenio, valores: valoresDaCarteira(i, situacao), celulas: {} }));
  for (const l of tabela) assert.deepEqual(Object.keys(l.valores).sort(), ids(COLUNAS_CARTEIRA).sort());
  assert.equal(tabela[0].valores.situacao, "Em execução");
  assert.equal(tabela[0].valores["situacao-siconv"], "Em execução");
  assert.equal(tabela[0].valores.orgao, "Ministério da Agricultura");
  const soExecucao = aplicar(COLUNAS_CARTEIRA, tabela, { filtros: { situacao: { tipo: "categoria", valores: ["em execucao"] } }, ordem: null });
  assert.deepEqual(soExecucao.map((l) => l.chave), ["3", "2"]);
  assert.ok(porId(COLUNAS_CARTEIRA, "situacao-siconv").oculta);
});

test("onda 15, lote B: as propostas, da mais recente para a mais antiga, e o número que a pessoa conhece", () => {
  const p = (id: string, ano: number | null, x: Partial<PropostaRelatorio> = {}): PropostaRelatorio => ({
    id_proposta: id, ano_envio: ano, desfecho: "assinada", orgao_sup: "MINISTERIO DA SAUDE", programa: "Programa", valor_repasse: 100, dias_sem_evento: null,
    dt_ultimo_evento: null, ...x,
  });
  const xs = [p("10", 2020), p("2", 2025, { valor_repasse: 1 }), p("9", 2025, { valor_repasse: 999 }), p("1", null)];
  assert.deepEqual(propostasNaOrdem(xs).map((x) => x.id_proposta), ["2", "9", "10", "1"], "ano decrescente; no ano, pelo número, e não pelo repasse");
  assert.deepEqual(ORDEM_PROPOSTAS, { coluna: "ano", sentido: "desc" });
  assert.equal(numeroDaProposta({ ...p("77", 2024), nr_proposta: " 12345/2024 " } as PropostaRelatorio), "12345/2024");
  assert.equal(numeroDaProposta(p("77", 2024)), "77");
  const v = valoresDaProposta(p("3", 2024, { desfecho: "assinada" }));
  assert.deepEqual(Object.keys(v).sort(), ids(COLUNAS_PROPOSTAS).sort());
  assert.deepEqual([v.proposta, v.ano, v.orgao, v.repasse], ["3", 2024, "Ministério da Saúde", 100]);
  assert.equal(v.desfecho, "Assinada", "o desfecho com o rótulo da tela");
});

test("onda 15, lote B: de onde vem o dinheiro, em ordem alfabética do órgão (antes, do maior valor)", () => {
  const xs = [
    inst({ nr_convenio: "1", orgao_sup: "MINISTERIO DA SAUDE", vl_global: 9_000_000 }),
    inst({ nr_convenio: "2", orgao_sup: "MINISTERIO DA AGRICULTURA", vl_global: 1_000 }),
    inst({ nr_convenio: "3", orgao_sup: "MINISTERIO DA SAUDE", vl_global: 1_000_000, vl_desembolsado: 0 }),
  ];
  const os = orgaosEmOrdem(xs);
  assert.deepEqual(os.map((o) => o.titulo), ["Ministério da Agricultura", "Ministério da Saúde"]);
  assert.deepEqual(valoresDoOrgao(os[1]), { orgao: "Ministério da Saúde", instrumentos: 2, valor: 10_000_000, desembolsado: 500_000 });
  assert.deepEqual(Object.keys(valoresDoOrgao(os[0])).sort(), ids(COLUNAS_ORGAOS).sort());
  assert.deepEqual(ORDEM_ORGAOS, { coluna: "orgao", sentido: "asc" });
});

test("onda 15, lote B: o pedaço do nome do arquivo do CSV", () => {
  assert.equal(trechoDoArquivo("João Pessoa"), "joao-pessoa");
  assert.equal(trechoDoArquivo("MUNICÍPIO DE PATOS"), "municipio-de-patos");
  assert.equal(trechoDoArquivo("  "), "relatorio");
  assert.ok(!trechoDoArquivo(`${"a".repeat(59)} b`).endsWith("-"));
});

// ================================================================ as telas (fonte)

const RAIZ_MAPA = path.join(import.meta.dirname, "..", "..", "app", "mapa");
const ler = (...p: string[]) => fs.readFileSync(path.join(RAIZ_MAPA, ...p), "utf8");
const RELATORIO = ler("municipio", "[ibge]", "relatorio", "RelatorioConteudo.tsx");
const ENTIDADE = ler("entidade", "[cnpj]", "EntidadeConteudo.tsx");
const DIAGNOSTICO = ler("instrumento", "[numero]", "laudo", "DiagnosticoConteudo.tsx");
const LAUDO = ler("instrumento", "[numero]", "laudo", "LaudoConteudo.tsx");
const PIX = ler("pix", "ente", "[chave]", "EntePixConteudo.tsx");

/** Os `id="…"` das `<TabelaFiltravel` e os `{ id: "…", titulo` das colunas escritas na tela. */
function idsNaFonte(fonte: string): { tabelas: string[]; colunas: string[] } {
  const tabelas = [...fonte.matchAll(/<TabelaFiltravel\s+id="([^"]+)"/g)].map((m) => m[1]);
  const colunas = [...fonte.matchAll(/\{ id: "([^"]+)", titulo:/g)].map((m) => m[1]);
  return { tabelas, colunas };
}

test("onda 15, lote B: o laudo e o Pix do ente — ids válidos e únicos na página", () => {
  // O laudo da suspensiva junta o complemento do diagnóstico às tabelas de `LaudoConteudo`: os ids não se repetem.
  const laudo = [...idsNaFonte(DIAGNOSTICO).tabelas, ...idsNaFonte(LAUDO).tabelas];
  assert.deepEqual(laudo.sort(), ["laudo-analistas", "laudo-contratos", "laudo-documentos", "laudo-emendas", "laudo-empresas", "laudo-siafi"]);
  const pix = idsNaFonte(PIX).tabelas;
  assert.deepEqual(pix.sort(), ["pix-impedidos", "pix-planos"]);
  for (const id of [...laudo, ...pix, ...idsNaFonte(DIAGNOSTICO).colunas, ...idsNaFonte(LAUDO).colunas, ...idsNaFonte(PIX).colunas]) assert.ok(idValido(id), id);
  for (const item of ["A4b", "A5", "C1", "C1b", "D1"]) assert.ok(idValido(item.toLowerCase()), item);
});

test("onda 15, lote B: as telas usam o componente, sem o corte dos 15, sem `Link` cru e sem tabela de lista à mão", () => {
  assert.ok(!/\.slice\(0,\s*15\)/.test(RELATORIO), "o corte nos 15 maiores saiu");
  assert.match(RELATORIO, /emendasNaOrdem\(r\.emendas\)/);
  for (const [nome, fonte] of [
    ["RelatorioConteudo", RELATORIO],
    ["EntidadeConteudo", ENTIDADE],
    ["DiagnosticoConteudo", DIAGNOSTICO],
    ["LaudoConteudo", LAUDO],
    ["EntePixConteudo", PIX],
  ] as const) {
    assert.ok(!/from "next\/link"/.test(fonte), `${nome}: os links são LinkMapa`);
    assert.match(fonte, /<TabelaFiltravel\b/, nome);
  }
  // A entidade e o Pix do ente não têm mais `<table>` à mão: todas as listas passaram ao componente.
  assert.ok(!/<table\b/.test(ENTIDADE), "EntidadeConteudo");
  assert.ok(!/<table\b/.test(PIX), "EntePixConteudo");
  assert.ok(!/<table\b/.test(LAUDO), "LaudoConteudo");
  // No relatório, as que sobram são os resumos: as decisões fiscais, os convênios por situação, as propostas por
  // desfecho e os indicadores (catálogo fixo).
  assert.equal(RELATORIO.match(/<table\b/g)?.length, 4);
});

test("onda 15, lote B: o CSV filtrado das tabelas do público é do cadastro (D1)", () => {
  // O relatório e a entidade só ligam o CSV pelo nível: `PODE.cadastro(nivel)`.
  assert.match(RELATORIO, /function csvDoNivel\([^)]*\)[^{]*\{\s*return PODE\.cadastro\(nivel\)/);
  assert.match(ENTIDADE, /function csvDaEntidade\([^)]*\)[^{]*\{\s*return PODE\.cadastro\(nivel\)/);
  assert.match(RELATORIO, /csvDoNivel\(nivel, "emendas", r\)/);
  for (const parte of ["instrumentos", "propostas", "orgaos"]) assert.match(ENTIDADE, new RegExp(`csvDaEntidade\\(nivel, "${parte}", e\\.cnpj\\)`));
});
