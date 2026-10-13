/**
 * As tabelas filtráveis das telas de administrador (onda 15, fase 2, lote C, 13/10/2026): as colunas e os valores crus
 * que `rodadas.ts`, `tce.ts`, `fiscal.ts` e `padroes.ts` entregam às telas, e os endereços antigos do fiscal e das
 * suspensivas, que redirecionam para o filtro da tabela.
 *
 * Sem `Date` local: as contas de dia são do fuso de Brasília (UTC−3 fixo) e os instantes vão com "Z". Rodar também com
 * TZ=America/Sao_Paulo e TZ=Asia/Tokyo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  COLUNAS_FISCAL,
  TABELA_FISCAL,
  filtrarMunicipios,
  urlFiscalDoFiltroAntigo,
  urlFiscalPorDecisao,
  valoresDoMunicipioFiscal,
  type ConclusaoFiscal,
  type MunicipioFiscal,
  type ParametrosFiscal,
} from "./fiscal.ts";
import { nivelPrazo } from "./laudo.ts";
import {
  COLUNAS_PADROES_ANALISTAS,
  COLUNAS_PADROES_CONDICOES,
  COLUNAS_PADROES_DOCUMENTOS,
  COLUNAS_PADROES_ORGAOS,
  COLUNAS_SUSPENSIVAS,
  MINIMO_PADRAO,
  ROTULO_URGENCIA_PRAZO,
  TABELA_PADROES_ANALISTAS,
  TABELA_PADROES_CONDICOES,
  TABELA_PADROES_DOCUMENTOS,
  TABELA_PADROES_ORGAOS,
  TABELA_SUSPENSIVAS,
  perfilDecisao,
  tituloOrgao,
  urlSuspensivasDoFiltroAntigo,
  valoresDaCondicao,
  valoresDaSuspensiva,
  valoresDoAnalista,
  valoresDoOrgaoHistorico,
  valoresDoRequisito,
  type ItemListaSuspensiva,
  type LinhaHistorico,
  type PerfilAnalista,
} from "./padroes.ts";
import { COLUNAS_RODADAS, JOBS_RODADAS, TABELA_RODADAS, avaliarRodada, valoresDaRodada } from "./rodadas.ts";
import { aplicar, csvDaTabela, idValido, lerEstado, type ColunaTabela, type LinhaTabela, type ValorCelula } from "./tabela-filtro.ts";
import {
  COLUNAS_TCE_CONCILIACAO,
  COLUNAS_TCE_EMPRESAS_PIX,
  COLUNAS_TCE_PARES,
  COLUNAS_TCE_PIX,
  TABELA_TCE_CONCILIACAO,
  TABELA_TCE_EMPRESAS_PIX,
  TABELA_TCE_PARES,
  TABELA_TCE_PIX,
  valoresTceConciliacao,
  valoresTceCredor,
  valoresTcePar,
  valoresTcePix,
  type TceFederalMunicipio,
  type TcePixMunicipio,
} from "./tce.ts";

/** As linhas de uma tabela a partir dos valores, para filtrar com `aplicar` como o componente faz. */
const linhas = (valores: Record<string, ValorCelula>[]): LinhaTabela[] => valores.map((v, i) => ({ chave: String(i), valores: v, celulas: {} }));
/** O estado da tabela que um endereço escreve. */
const estadoDe = (tabela: string, colunas: ColunaTabela[], url: string) => lerEstado(tabela, colunas, new URLSearchParams(url.split("?")[1] ?? ""));

// ================================================================ as colunas

const TABELAS: [string, ColunaTabela[]][] = [
  [TABELA_RODADAS, COLUNAS_RODADAS],
  [TABELA_TCE_PIX, COLUNAS_TCE_PIX],
  [TABELA_TCE_CONCILIACAO, COLUNAS_TCE_CONCILIACAO],
  [TABELA_TCE_EMPRESAS_PIX, COLUNAS_TCE_EMPRESAS_PIX],
  [TABELA_TCE_PARES, COLUNAS_TCE_PARES],
  [TABELA_FISCAL, COLUNAS_FISCAL],
  [TABELA_PADROES_ORGAOS, COLUNAS_PADROES_ORGAOS],
  [TABELA_PADROES_CONDICOES, COLUNAS_PADROES_CONDICOES],
  [TABELA_PADROES_ANALISTAS, COLUNAS_PADROES_ANALISTAS],
  [TABELA_PADROES_DOCUMENTOS, COLUNAS_PADROES_DOCUMENTOS],
  [TABELA_SUSPENSIVAS, COLUNAS_SUSPENSIVAS],
];

test("lote C: ids de tabela e de coluna válidos e únicos; tela de administrador, toda coluna filtra e ordena", () => {
  for (const [tabela, colunas] of TABELAS) {
    assert.ok(idValido(tabela), tabela);
    const ids = colunas.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `${tabela}: coluna repetida`);
    for (const id of ids) assert.ok(idValido(id), `${tabela}.${id}`);
    assert.ok(colunas.every((c) => c.ordenavel !== false && c.filtravel !== false), `${tabela}: toda coluna ordena e filtra`);
    // A primeira coluna desenhada é o cabeçalho da linha: nunca oculta.
    assert.notEqual(colunas[0].oculta, true, `${tabela}: a primeira coluna aparece`);
  }
  // Na mesma página, os ids não se repetem (padrões: 4 tabelas; TCE: 2 em cada página).
  assert.equal(new Set([TABELA_PADROES_ORGAOS, TABELA_PADROES_CONDICOES, TABELA_PADROES_ANALISTAS, TABELA_PADROES_DOCUMENTOS]).size, 4);
  assert.notEqual(TABELA_TCE_PIX, TABELA_TCE_CONCILIACAO);
  assert.notEqual(TABELA_TCE_EMPRESAS_PIX, TABELA_TCE_PARES);
});

/** Os valores de uma linha têm exatamente as colunas da tabela, nem mais nem menos. */
function confereChaves(colunas: ColunaTabela[], valores: Record<string, ValorCelula>, nome: string) {
  assert.deepEqual(Object.keys(valores).sort(), colunas.map((c) => c.id).sort(), nome);
}

// ================================================================ rodadas

const HORA = 3600 * 1000;
const AGORA = Date.parse("2026-10-13T15:00:00Z"); // 12h00 em Brasília
const jobPainel = JOBS_RODADAS.find((j) => j.id === "painel");
assert.ok(jobPainel);

test("rodadas: a última concluída é o dia de Brasília; as horas e o gravando saem da linha", () => {
  // Concluída às 01h30 UTC de 13/10: em Brasília ainda era 12/10, 22h30.
  const l = avaliarRodada(
    jobPainel,
    {
      estado: "ok",
      ultima: { id: 1, iniciada_em: "2026-10-13T01:00:00Z", concluida_em: "2026-10-13T01:30:00Z", contagens: {} },
      abertas: [{ id: 2, status: "gravando", iniciada_em: new Date(AGORA - HORA).toISOString() }],
    },
    AGORA,
  );
  const v = valoresDaRodada(l);
  confereChaves(COLUNAS_RODADAS, v, "rodadas");
  assert.equal(v.concluida, "2026-10-12");
  assert.equal(v.horas, 13.5);
  assert.equal(v.gravando, "em curso");
  assert.equal(v.job, jobPainel.nome);
  assert.equal(v.cadencia, "diária");
  assert.equal(v.workflow, jobPainel.workflow);
});

test("rodadas: a linha 'não lido' fica só com nome, estado e cadência; o filtro de estado acha só ela", () => {
  const naoLido = valoresDaRodada(avaliarRodada(jobPainel, { estado: "nao_lido", motivo: "ausente" }, AGORA));
  assert.equal(naoLido.estado, "não lido");
  assert.deepEqual([naoLido.concluida, naoLido.horas, naoLido["dado-ate"], naoLido.dado, naoLido.gravando], [null, null, null, null, null]);
  const ok = valoresDaRodada(
    avaliarRodada(jobPainel, { estado: "ok", ultima: { id: 1, iniciada_em: "2026-10-13T12:00:00Z", concluida_em: "2026-10-13T12:10:00Z", contagens: {} }, abertas: [] }, AGORA),
  );
  assert.equal(ok.gravando, "não");
  const ls = linhas([naoLido, ok]);
  const filtradas = aplicar(COLUNAS_RODADAS, ls, estadoDe(TABELA_RODADAS, COLUNAS_RODADAS, "?t.jobs.estado=nao%20lido"));
  assert.deepEqual(filtradas.map((x) => x.valores.estado), ["não lido"]);
  // Ordem pela concluída: o vazio vai para o fim nos dois sentidos.
  const desc = aplicar(COLUNAS_RODADAS, ls, { filtros: {}, ordem: { coluna: "concluida", sentido: "desc" } });
  assert.equal(desc.at(-1)?.valores.estado, "não lido");
});

// ================================================================ TCE-PB

function pix(extra: Partial<TcePixMunicipio> = {}): TcePixMunicipio {
  return {
    ibge: "2510808", ano: 2025, municipio: "Patos", empenhado: 1_000_000, liquidado: 1_000_000, pago: 1_000_000,
    pago_pessoal: 0, pago_juros: 0, pago_correntes: 100_000, pago_investimentos: 900_000, pago_inversoes: 0, pago_amortizacao: 0,
    pct_capital: 0.9, n_empenhos: 10, n_credores_pj: 3, pago_pj: 1_000_000, pago_pf: 0, pago_emenda_individual: 1_000_000,
    pago_emenda_bancada: 0, pago_emenda_comissao: 0, pago_com_licitacao: 900_000, pago_com_obra: 800_000, ...extra,
  };
}

test("TCE-PB: o Pix por município leva as marcas, a contagem delas e o capital de 0 a 100", () => {
  const limpo = valoresTcePix(pix());
  confereChaves(COLUNAS_TCE_PIX, limpo, "pix");
  assert.deepEqual([limpo.marcas, limpo["n-marcas"], limpo.capital, limpo["pessoal-divida"]], [null, 0, 90, 0]);
  const marcado = valoresTcePix(pix({ ibge: "2500106", municipio: null, pago_pessoal: 20_000, pago_juros: 5_000, pago_amortizacao: 10_000, pct_capital: 0.6234 }));
  assert.deepEqual([marcado.municipio, marcado.marcas, marcado["n-marcas"], marcado.capital, marcado["pessoal-divida"]], ["IBGE 2500106", "pessoal, dívida, capital < 70%", 3, 62.3, 35_000]);
  // "dívida" com ou sem acento acha a marca.
  const ls = linhas([limpo, marcado]);
  assert.equal(aplicar(COLUNAS_TCE_PIX, ls, estadoDe(TABELA_TCE_PIX, COLUNAS_TCE_PIX, "?t.pix.marcas=divida")).length, 1);
  assert.equal(aplicar(COLUNAS_TCE_PIX, ls, estadoDe(TABELA_TCE_PIX, COLUNAS_TCE_PIX, "?t.pix.capital=..70")).length, 1);
});

test("TCE-PB: a conciliação dá o achado sobre o verificado; sem verificado, vazio", () => {
  const base: TceFederalMunicipio = {
    ibge: "2510808", ano: 2025, municipio: "Patos", coberto: true, siconv_pj: 1000, siconv_casado: 600, siconv_so: 200,
    siconv_nao_verificado: 200, tce_convenio_pj: 500, tce_convenio_pf: 0, tce_convenio_casado: 300, tce_convenio_so: 200, n_so_siconv: 2, n_so_tce: 1,
  };
  const v = valoresTceConciliacao(base);
  confereChaves(COLUNAS_TCE_CONCILIACAO, v, "conciliação");
  assert.deepEqual([v.achado, v.arquivo], [75, "lido"]);
  const nada = valoresTceConciliacao({ ...base, coberto: false, siconv_pj: 0, siconv_casado: 0, siconv_nao_verificado: 0 });
  assert.deepEqual([nada.achado, nada.arquivo], [null, "ainda não lido"]);
});

test("TCE-PB: empresas e pares levam o nome e o CNPJ da tela, o ano como número e todos os convênios", () => {
  const id = { nome: "CONSTRUTORA EXEMPLO LTDA", cnpj: "12.345.678/0001-90" };
  const c = valoresTceCredor({ ibge: "2510808", ano: 2024, cnpj: "12345678000190", nome: "x", pago: 10, pago_investimentos: 5, n_empenhos: 1 }, id);
  confereChaves(COLUNAS_TCE_EMPRESAS_PIX, c, "empresas do Pix");
  assert.deepEqual([c.empresa, c.cnpj, c.ano], [id.nome, id.cnpj, 2024]);
  const p = valoresTcePar(
    { ibge: "2510808", ano: 2024, cnpj: "12345678000190", nome: "x", tce_convenio: 100, tce_pix: 50, tce_outras: 10, siconv: 0, convenios: ["1", "2", "3", "4", "5"], situacao: "so_tce" },
    id,
  );
  confereChaves(COLUNAS_TCE_PARES, p, "pares");
  assert.deepEqual([p.tce, p.convenios, p.situacao], [160, "1, 2, 3, 4, 5", "só no TCE-PB"]);
  // O CNPJ sai no CSV como texto.
  assert.match(csvDaTabela(COLUNAS_TCE_PARES, linhas([p])), /CNPJ/);
});

// ================================================================ fiscal

const conclusao = (decisao: "A" | "B" | "C", estado: ConclusaoFiscal["estado"], bloqueantes: string[] = []): ConclusaoFiscal => ({
  decisao, nome: decisao, estado, bloqueantes, alertas: [], sem_dado: [], documentais: [], versao: "v",
});
const municipio = (ibge: string, nome: string, a: ConclusaoFiscal["estado"], b: ConclusaoFiscal["estado"]): MunicipioFiscal => ({
  ibge, nome, populacao: 1000, tce: "001", estados: {}, indicadores: { pessoal_pct: 48.5, cauc_pendencias: ["3.2.1"] },
  conclusoes: [conclusao("A", a, a === "nao_atendido" ? ["G1"] : []), conclusao("B", b), conclusao("C", "nao_verificavel")],
});
const MS = [
  municipio("2513802", "Santa Teresinha", "nao_atendido", "nao_atendido"),
  municipio("2500106", "Água Branca", "atendido", "desatualizado"),
  municipio("2507507", "João Pessoa", "atendido", "atencao"),
];

test("fiscal: a decisão leva o rótulo da célula; desatualizado e atenção são 'Com alertas'", () => {
  const v = valoresDoMunicipioFiscal(MS[1]);
  confereChaves(COLUNAS_FISCAL, v, "fiscal");
  assert.deepEqual([v["decisao-a"], v["decisao-b"], v["decisao-c"], v.pessoal, v.cauc, v["cauc-itens"]], ["Sem bloqueio", "Com alertas", "Em aberto", 48.5, 1, "3.2.1"]);
  assert.equal(valoresDoMunicipioFiscal(MS[0])["bloqueios-a"], "Entregas");
});

test("fiscal: o endereço antigo redireciona para o filtro da tabela, que acha os mesmos municípios", () => {
  const ls = linhas(MS.map(valoresDoMunicipioFiscal));
  const casos: ParametrosFiscal[] = [
    { q: "agua", decisao: null, estado: null },
    { q: "25075", decisao: null, estado: null },
    { q: "", decisao: "B", estado: "atencao" },
    { q: "", decisao: "B", estado: "desatualizado" },
    { q: "", decisao: "A", estado: "nao_atendido" },
    { q: "joão", decisao: "B", estado: "atencao" },
  ];
  for (const p of casos) {
    const url = urlFiscalDoFiltroAntigo(p);
    assert.ok(url && url.startsWith("/mapa/fiscal?t.fiscal."), JSON.stringify(p));
    const novo = aplicar(COLUNAS_FISCAL, ls, estadoDe(TABELA_FISCAL, COLUNAS_FISCAL, url)).map((l) => l.valores.municipio).sort();
    const antigo = filtrarMunicipios(MS, p).map((m) => m.nome).sort();
    assert.deepEqual(novo, antigo, JSON.stringify(p));
  }
  // Sem filtro antigo, nada a redirecionar; situação sem decisão não filtrava e vira a lista limpa.
  assert.equal(urlFiscalDoFiltroAntigo({ q: "", decisao: null, estado: null }), null);
  assert.equal(urlFiscalDoFiltroAntigo({ q: "", decisao: null, estado: "atencao" }), "/mapa/fiscal");
  assert.equal(urlFiscalDoFiltroAntigo({ q: "", decisao: "C", estado: null }), "/mapa/fiscal");
  // O destino nunca leva os parâmetros antigos: o redirecionamento não volta para si mesmo.
  assert.doesNotMatch(urlFiscalDoFiltroAntigo({ q: "agua", decisao: "B", estado: "atencao" }) ?? "", /[?&](q|decisao|estado)=/);
});

test("fiscal: o link de cada contagem dos cartões é o filtro da decisão", () => {
  assert.equal(urlFiscalPorDecisao("B", "atencao"), "/mapa/fiscal?t.fiscal.decisao-b=Com+alertas");
  const ls = linhas(MS.map(valoresDoMunicipioFiscal));
  const achados = aplicar(COLUNAS_FISCAL, ls, estadoDe(TABELA_FISCAL, COLUNAS_FISCAL, urlFiscalPorDecisao("A", "nao_atendido")));
  assert.deepEqual(achados.map((l) => l.valores.municipio), ["Santa Teresinha"]);
});

// ================================================================ padrões

test("padrões: órgão com poucos casos fica sem mediana; percentual de 0 a 100", () => {
  const conta = (n: number) => ({ n, valor: 0 });
  const o = (total: number): LinhaHistorico => ({
    orgao: "MINISTERIO DA SAUDE", total, destinos: { saiu: conta(2), morreu: conta(1), encerrou: conta(0), segue: conta(total - 3) },
    mediana: 120.4, p75: 200, pctPerdido: 1 / 3,
  });
  const muitos = valoresDoOrgaoHistorico(o(MINIMO_PADRAO));
  confereChaves(COLUNAS_PADROES_ORGAOS, muitos, "órgãos");
  assert.deepEqual([muitos.orgao, muitos.mediana, muitos.perda, muitos.extintos], [tituloOrgao("MINISTERIO DA SAUDE"), 120, 33.3, 1]);
  assert.equal(valoresDoOrgaoHistorico(o(MINIMO_PADRAO - 1)).mediana, null);
  confereChaves(COLUNAS_PADROES_CONDICOES, valoresDaCondicao({ condicao: "Licença ambiental", convenios: 3, valor: 10, medianaEmSuspensiva: 99.6, prazoApertado: 1 }), "condições");
  const doc = valoresDoRequisito({ requisito: "CERTIDÃO TJ", convenios: 4, documentos: 5, comValidade: 0, vencidos: 0 });
  confereChaves(COLUNAS_PADROES_DOCUMENTOS, doc, "documentos");
  assert.deepEqual([doc.vencidos, doc["vencidos-pct"]], [null, null]);
  assert.deepEqual(Object.values(valoresDoRequisito({ requisito: "X", convenios: 4, documentos: 5, comValidade: 4, vencidos: 1 })).slice(3), [1, 25]);
});

test("padrões: o analista leva o que decide em palavras e em %, e o lote de um convênio não conta", () => {
  const a: PerfilAnalista = {
    nome: "Servidor Exemplo", atribuicao: "Analista", atos: 12, convenios: 8,
    orgao: { valor: "MINISTERIO DA SAUDE", fatia: 0.75 }, programa: { valor: "Programa X", fatia: 0.5 },
    exigencias: 3, atendimentos: 1, recusas: 0, maiorLote: { dia: "2026-09-17", convenios: 1 },
    ultimaPalavra: { convenios: 0, medianaDias: null, valor: 0 },
  };
  const v = valoresDoAnalista(a);
  confereChaves(COLUNAS_PADROES_ANALISTAS, v, "analistas");
  assert.deepEqual([v.decide, v.complementacao, v["fatia-orgao"], v["maior-lote"], v["dia-lote"], v["ultima-ha"]], [perfilDecisao(3, 1, 0), 75, 75, null, null, null]);
  assert.equal(perfilDecisao(3, 1, 0), "pede complementação em 75% (3 de 4)");
  assert.equal(valoresDoAnalista({ ...a, maiorLote: { dia: "2026-09-17", convenios: 4 } })["dia-lote"], "2026-09-17");
});

// ================================================================ suspensivas

const HOJE = "2026-10-13";
const susp = (numero: string, orgao: string | null, prazo: string | null, retirada: string | null = null): ItemListaSuspensiva => ({
  numero, vez_de: "concedente", parado_desde: "2026-09-13", rodadas_de_exigencia: 2,
  contexto: { municipio: "Patos", programa: "Programa X", orgao_sup: orgao, vl_repasse: 100_000, dt_suspensiva: prazo, dt_retirada_suspensiva: retirada },
});
const SUSPENSIVAS = [
  susp("900001", "MINISTERIO DA SAUDE", "2026-10-01"), // vencido
  susp("900002", "MINISTERIO DA SAUDE", "2026-11-01"), // 19 dias
  susp("900003", "MINISTERIO DAS CIDADES", "2026-12-20"), // 68 dias
  susp("900004", "MINISTERIO DAS CIDADES", "2027-06-01"), // mais de 90
  susp("900005", "MINISTERIO DA SAUDE", "2026-10-20", "2026-10-05"), // retirada
  susp("900006", null, null), // sem prazo nem órgão
];

test("suspensivas: prazo, dias para o prazo, urgência e o tempo parado contados como as células", () => {
  const v = SUSPENSIVAS.map((l) => valoresDaSuspensiva(l, HOJE, "2026-10-10"));
  confereChaves(COLUNAS_SUSPENSIVAS, v[0], "suspensivas");
  assert.deepEqual(v.map((x) => x["dias-prazo"]), [-12, 19, 68, 231, null, null]);
  assert.deepEqual(v.map((x) => x.urgencia), [
    ROTULO_URGENCIA_PRAZO.critico, ROTULO_URGENCIA_PRAZO.critico, ROTULO_URGENCIA_PRAZO.alto,
    ROTULO_URGENCIA_PRAZO.moderado, ROTULO_URGENCIA_PRAZO.informativo, ROTULO_URGENCIA_PRAZO.informativo,
  ]);
  // Com a retirada, o prazo fica vazio e a data da retirada vai para a coluna oculta.
  assert.deepEqual([v[4].prazo, v[4].retirada], [null, "2026-10-05"]);
  assert.deepEqual([v[0].parado, v[0].vez, v[0].orgao], [27, "concedente", tituloOrgao("MINISTERIO DA SAUDE")]);
});

test("suspensivas: os chips antigos redirecionam para o filtro da tabela, que acha os mesmos convênios", () => {
  const orgaos = ["MINISTERIO DA SAUDE", "MINISTERIO DAS CIDADES"];
  const ls = linhas(SUSPENSIVAS.map((l) => valoresDaSuspensiva(l, HOJE, HOJE)));
  const NIVEIS: Record<string, string[]> = { urgente: ["critico"], "90": ["critico", "alto"] };
  const casos = [
    { prazo: "urgente", orgao: null },
    { prazo: "90", orgao: null },
    { prazo: null, orgao: "MINISTERIO DA SAUDE" },
    { prazo: "90", orgao: "MINISTERIO DAS CIDADES" },
  ];
  for (const f of casos) {
    const url = urlSuspensivasDoFiltroAntigo(f, orgaos);
    assert.ok(url && url.startsWith("/mapa/suspensivas?t.susp."), JSON.stringify(f));
    const novo = aplicar(COLUNAS_SUSPENSIVAS, ls, estadoDe(TABELA_SUSPENSIVAS, COLUNAS_SUSPENSIVAS, url)).map((l) => l.valores.convenio).sort();
    // O filtro de antes, como estava em `SuspensivasConteudo`: o nível do prazo e o órgão como o banco grava.
    const antigo = SUSPENSIVAS.filter(
      (l) =>
        (!f.prazo || NIVEIS[f.prazo].includes(nivelPrazo({ dt_suspensiva: l.contexto?.dt_suspensiva ?? null, dt_retirada_suspensiva: l.contexto?.dt_retirada_suspensiva ?? null }, HOJE))) &&
        (!f.orgao || l.contexto?.orgao_sup === f.orgao),
    ).map((l) => l.numero).sort();
    assert.deepEqual(novo, antigo, JSON.stringify(f));
  }
  // Valor desconhecido não filtra, como antes ("todos"), e o destino não leva os parâmetros antigos.
  assert.equal(urlSuspensivasDoFiltroAntigo({ prazo: "180", orgao: "ORGAO QUE NAO ESTA" }, orgaos), "/mapa/suspensivas");
  assert.equal(urlSuspensivasDoFiltroAntigo({ prazo: null, orgao: null }, orgaos), null);
});
