import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRUPOS_SITUACAO,
  PAGINA_MAXIMA,
  desfechosDoGrupo,
  fracoesDaMaior,
  grupoDaSituacao,
  linhasDe,
  numeroValido,
  parametrosBusca,
  porAno,
  resumoEventos,
  rotuloSituacaoHistorico,
  situacoesDoGrupo,
  termosDaBusca,
  totalDePaginas,
  urlBusca,
  type EventoInstrumento,
} from "./busca.ts";

test("termos: sem acento, minúsculas, CNPJ só dígitos, sem curinga do LIKE e sem repetição", () => {
  assert.deepEqual(termosDaBusca("  Pavimentação   JOÃO Pessoa "), ["pavimentacao", "joao", "pessoa"]);
  assert.deepEqual(termosDaBusca("08.778.326/0001-56"), ["08778326000156"]);
  assert.deepEqual(termosDaBusca("100% _creche_ a"), ["100", "creche"]);
  assert.deepEqual(termosDaBusca("escola escola ESCOLA"), ["escola"]);
  assert.deepEqual(termosDaBusca("11218/2008"), ["11218/2008"]);
  assert.deepEqual(termosDaBusca("\\ %%"), []);
  assert.equal(termosDaBusca("a1 b2 c3 d4 e5 f6 g7 h8").length, 6);
});

test("parâmetros: valores fora da lista caem no padrão; município só vale na UF dele", () => {
  const p = parametrosBusca({});
  assert.deepEqual(p, { aba: "instrumentos", q: "", uf: null, municipio: null, tema: null, grupo: null, pagina: 1 });
  assert.equal(parametrosBusca({ aba: "x", tema: "nao_existe", grupo: "nao", pagina: "-3" }).tema, null);
  const mun = parametrosBusca({ municipio: "2507507" });
  assert.equal(mun.uf, "PB");
  assert.equal(parametrosBusca({ uf: "RN", municipio: "2507507" }).municipio, null);
  assert.equal(parametrosBusca({ aba: "propostas", grupo: "execucao" }).grupo, null, "grupo de instrumento não vale em propostas");
  assert.equal(parametrosBusca({ aba: "propostas", grupo: "negada" }).grupo, "negada");
  assert.equal(parametrosBusca({ pagina: "99999" }).pagina, PAGINA_MAXIMA);
  assert.equal(parametrosBusca({ tema: "esporte" }).tema, "esporte");
});

test("url: filtro volta à primeira página, trocar de aba solta o grupo, trocar a UF solta o município", () => {
  const p = parametrosBusca({ q: "creche", uf: "PB", municipio: "2507507", grupo: "execucao", pagina: "3" });
  assert.equal(urlBusca(p, { pagina: 4 }), "/mapa/busca?q=creche&uf=PB&municipio=2507507&grupo=execucao&pagina=4");
  assert.equal(urlBusca(p, { tema: "educacao" }), "/mapa/busca?q=creche&uf=PB&municipio=2507507&tema=educacao&grupo=execucao");
  assert.equal(urlBusca(p, { aba: "propostas" }), "/mapa/busca?aba=propostas&q=creche&uf=PB&municipio=2507507");
  assert.equal(urlBusca(p, { uf: "RN" }), "/mapa/busca?q=creche&uf=RN&grupo=execucao");
  assert.equal(urlBusca(parametrosBusca({}), {}), "/mapa/busca");
});

test("grupos de situação e desfecho", () => {
  assert.deepEqual(situacoesDoGrupo("execucao"), ["Em execução"]);
  assert.equal(situacoesDoGrupo(null), null);
  assert.deepEqual(desfechosDoGrupo("negada"), ["reprovada", "impedimento", "eliminada"]);
  assert.equal(grupoDaSituacao("Prestação de Contas Rejeitada"), "contas");
  assert.equal(grupoDaSituacao("Situação nova do SICONV"), null);
  const todas = GRUPOS_SITUACAO.flatMap((g) => g.situacoes);
  assert.equal(new Set(todas).size, todas.length, "uma situação em um grupo só");
});

test("páginas e números", () => {
  assert.equal(totalDePaginas(0), 1);
  assert.equal(totalDePaginas(31), 2);
  assert.equal(totalDePaginas(1_000_000), PAGINA_MAXIMA);
  assert.ok(numeroValido("700853") && numeroValido("7AACFT"));
  assert.ok(!numeroValido("../x") && !numeroValido("") && !numeroValido(undefined) && !numeroValido("1".repeat(21)));
});

test("linha do tempo: rótulos, mais recente primeiro por ano e resumo", () => {
  assert.equal(rotuloSituacaoHistorico("ASSINADA"), "Instrumento assinado");
  assert.equal(rotuloSituacaoHistorico("PROPOSTA_REJEITADA_IMPEDIMENTO_TECNICO"), "Proposta rejeitada impedimento tecnico");
  const ev = (data: string, tipo: EventoInstrumento["tipo"], valor: number | null = null, quantidade: number | null = null): EventoInstrumento =>
    ({ data, tipo, descricao: null, categoria: null, valor, quantidade, data_fim: null });
  const grupos = porAno([ev("2024-03-01", "situacao"), ev("2025-01-10", "pagamento", 150, 2), ev("2024-12-31", "desembolso", 400, 1)]);
  assert.deepEqual(grupos.map((g) => g.ano), [2025, 2024]);
  assert.deepEqual(grupos[1].eventos.map((e) => e.data), ["2024-12-31", "2024-03-01"]);
  const r = resumoEventos([ev("2025-01-10", "pagamento", 150, 2), ev("2025-01-11", "pagamento", 50, 1), ev("2025-02-01", "aditivo", -10)]);
  assert.deepEqual(r.pagamento, { n: 3, valor: 200 });
  assert.deepEqual(r.aditivo, { n: 1, valor: -10 });
  assert.deepEqual(r.licitacao, { n: 0, valor: 0 });
});

test("investimentos: linhas por dimensão do maior para o menor e barras relativas à maior", () => {
  const l = [
    { dimensao: "tema" as const, chave: "saude", n: 3, valor: 100, executado: 50 },
    { dimensao: "tema" as const, chave: "educacao", n: 2, valor: 400, executado: 10 },
    { dimensao: "tipo" as const, chave: "convenio", n: 5, valor: 500, executado: 60 },
  ];
  assert.deepEqual(linhasDe(l, "tema").map((x) => x.chave), ["educacao", "saude"]);
  assert.deepEqual(fracoesDaMaior(linhasDe(l, "tema"), (x) => x.valor ?? 0).map((x) => x.fracao), [1, 0.25]);
  assert.deepEqual(fracoesDaMaior([], () => 0), []);
});
