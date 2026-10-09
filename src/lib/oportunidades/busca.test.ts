import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRUPOS_SITUACAO,
  PAGINA_MAXIMA,
  buscaSemFiltro,
  contagem,
  desfechosDoGrupo,
  fracoesDaMaior,
  grupoDaSituacao,
  linhasDe,
  numeroValido,
  urlDoMunicipio,
  parametrosBusca,
  porAno,
  resumoEventos,
  rotuloModalidade,
  rotuloSituacaoHistorico,
  saidasIndisponivel,
  situacoesDoGrupo,
  termosDaBusca,
  totalDePaginas,
  urlBusca,
  type EventoInstrumento,
} from "./busca.ts";

test("contagem: a palavra concorda com o número, que sai no formato brasileiro", () => {
  assert.equal(contagem(1, "desembolso", "desembolsos"), "1 desembolso");
  assert.equal(contagem(0, "aditivo", "aditivos"), "0 aditivos");
  assert.equal(contagem(1234, "convênio", "convênios"), "1.234 convênios");
});

test("modalidade: o SICONV grava sem acento; a tela mostra com acento e em minúsculas", () => {
  assert.equal(rotuloModalidade("CONVENIO"), "convênio");
  assert.equal(rotuloModalidade("TERMO DE COLABORACAO"), "termo de colaboração");
  assert.equal(rotuloModalidade("CONTRATO DE REPASSE"), "contrato de repasse");
  assert.equal(rotuloModalidade("MODALIDADE NOVA"), "modalidade nova");
  assert.equal(rotuloModalidade(null), null);
  assert.equal(rotuloModalidade(""), null);
});

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
  // C2 (08/10/2026): a entrada da busca é a unificada.
  assert.deepEqual(p, { aba: "tudo", q: "", uf: null, municipio: null, tema: null, grupo: null, pagina: 1 });
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
  // C2: as listas levam a aba sempre (sem aba é a unificada).
  assert.equal(urlBusca(p, { pagina: 4 }), "/mapa/busca?aba=instrumentos&q=creche&uf=PB&municipio=2507507&grupo=execucao&pagina=4");
  assert.equal(urlBusca(p, { tema: "educacao" }), "/mapa/busca?aba=instrumentos&q=creche&uf=PB&municipio=2507507&tema=educacao&grupo=execucao");
  assert.equal(urlBusca(p, { aba: "propostas" }), "/mapa/busca?aba=propostas&q=creche&uf=PB&municipio=2507507");
  assert.equal(urlBusca(p, { uf: "RN" }), "/mapa/busca?aba=instrumentos&q=creche&uf=RN&grupo=execucao");
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

test("F1c: o município vai para a página em abas na PB e para os investimentos fora dela", () => {
  assert.equal(urlDoMunicipio("2513802"), "/mapa/municipio/2513802");
  assert.equal(urlDoMunicipio("2513802", "dinheiro"), "/mapa/municipio/2513802?aba=dinheiro");
  assert.equal(urlDoMunicipio("2513802", "trava"), "/mapa/municipio/2513802");
  assert.equal(urlDoMunicipio("3550308", "dinheiro"), "/mapa/municipio/3550308/investimentos");
});

test("teste da E3: sem termo nem filtro, a busca de convênios e propostas não consulta", () => {
  assert.equal(buscaSemFiltro(parametrosBusca({})), true);
  assert.equal(buscaSemFiltro(parametrosBusca({ aba: "propostas", q: " % " })), true, "termo que não filtra não conta");
  assert.equal(buscaSemFiltro(parametrosBusca({ q: "creche" })), false);
  assert.equal(buscaSemFiltro(parametrosBusca({ uf: "PB" })), false);
  assert.equal(buscaSemFiltro(parametrosBusca({ tema: "saude" })), false);
  assert.equal(buscaSemFiltro(parametrosBusca({ aba: "organizacoes" })), false, "o cadastro das OSC é leve: lista sem termo");
});

test("B12: indisponível — sem endereço, busca e janelas; com endereço, 'Tentar de novo' e sem link para a própria página", () => {
  assert.deepEqual(saidasIndisponivel(), {
    tentar: null,
    saidas: [
      { rotulo: "Procurar na busca", href: "/mapa/busca" },
      { rotulo: "Voltar às janelas", href: "/mapa" },
    ],
  });
  assert.deepEqual(saidasIndisponivel("/mapa/busca?q=creche&pagina=2"), {
    tentar: "/mapa/busca?q=creche&pagina=2",
    saidas: [{ rotulo: "Voltar às janelas", href: "/mapa" }],
  });
  const mun = saidasIndisponivel("/mapa/municipio/2516201/relatorio", { rotulo: "Voltar ao município", href: "/mapa/municipio/2516201" });
  assert.deepEqual(mun.saidas.map((s) => s.rotulo), ["Voltar ao município", "Procurar na busca", "Voltar às janelas"]);
  // A volta para a mesma página é o próprio "Tentar de novo"; endereço de fora do Mapa não vira link.
  assert.deepEqual(saidasIndisponivel("/mapa/carteira", { rotulo: "Carteira", href: "/mapa/carteira?x=1" }).saidas.length, 2);
  assert.deepEqual(saidasIndisponivel("https://exemplo.com/mapa", { rotulo: "Fora", href: "//exemplo.com" }), {
    tentar: null,
    saidas: [
      { rotulo: "Procurar na busca", href: "/mapa/busca" },
      { rotulo: "Voltar às janelas", href: "/mapa" },
    ],
  });
  assert.equal(saidasIndisponivel("/mapageral").tentar, null, "prefixo parecido não vale");
});

test("E3: a aba das organizações é só da PB, sem tema nem grupo", () => {
  const p = parametrosBusca({ aba: "organizacoes", uf: "SP", tema: "saude", grupo: "execucao", municipio: "2510808", q: "laureano" });
  assert.deepEqual(p, { aba: "organizacoes", q: "laureano", uf: "PB", municipio: "2510808", tema: null, grupo: null, pagina: 1 });
  assert.equal(parametrosBusca({ aba: "organizacoes", municipio: "3550308" }).municipio, null, "município de fora da PB não vale");
  assert.equal(urlBusca(p, { pagina: 2 }), "/mapa/busca?aba=organizacoes&q=laureano&municipio=2510808&pagina=2");
  const conv = parametrosBusca({ q: "creche", uf: "SP", tema: "saude" });
  assert.equal(urlBusca(conv, { aba: "organizacoes" }), "/mapa/busca?aba=organizacoes&q=creche");
  assert.equal(urlBusca(parametrosBusca({ aba: "organizacoes", q: "x" }), { aba: "instrumentos" }), "/mapa/busca?aba=instrumentos&q=x", "de volta, sem a PB fixa");
});

test("C2: sem aba na URL — termo vai à unificada; tema, situação, município ou página vão aos convênios, como antes", () => {
  assert.equal(parametrosBusca({ q: "patos" }).aba, "tudo");
  assert.equal(parametrosBusca({ q: "patos", uf: "SP" }).aba, "tudo");
  assert.equal(parametrosBusca({ q: "creche", tema: "educacao" }).aba, "instrumentos");
  assert.equal(parametrosBusca({ q: "creche", grupo: "execucao" }).aba, "instrumentos");
  assert.equal(parametrosBusca({ uf: "PB", municipio: "2510808" }).aba, "instrumentos", "o link dos investimentos do município");
  assert.equal(parametrosBusca({ q: "creche", pagina: "2" }).aba, "instrumentos", "a página 2 é de uma lista");
  assert.equal(parametrosBusca({ uf: "SP" }).aba, "instrumentos", "só a UF, sem termo: a lista");
  assert.equal(parametrosBusca({ aba: "tudo", uf: "SP" }).aba, "tudo");
  // A unificada não guarda tema, situação, município nem página, e a PB é o padrão (fora da URL).
  assert.deepEqual(parametrosBusca({ aba: "tudo", q: " Patos ", uf: "pb", tema: "saude", grupo: "execucao", municipio: "2510808", pagina: "3" }), {
    aba: "tudo",
    q: "Patos",
    uf: null,
    municipio: null,
    tema: null,
    grupo: null,
    pagina: 1,
  });
  assert.equal(parametrosBusca({ q: "patos", uf: "XX" }).uf, null);
});

test("C2: endereços — a unificada sem aba; as listas com aba; de fora, tema e município continuam nos convênios", () => {
  const vazia = parametrosBusca({});
  assert.equal(urlBusca(vazia, { q: "patos" }), "/mapa/busca?q=patos");
  assert.equal(urlBusca(vazia, { q: "patos", uf: "PB" }), "/mapa/busca?q=patos", "a PB é o padrão da unificada");
  assert.equal(urlBusca(vazia, { q: "patos", uf: "SP" }), "/mapa/busca?q=patos&uf=SP");
  assert.equal(urlBusca(vazia, { uf: "SP" }), "/mapa/busca?aba=instrumentos&uf=SP", "sem termo e com UF: a lista, como antes");
  // As etiquetas do convênio e os investimentos do município partem de `parametrosBusca({})`.
  assert.equal(urlBusca(vazia, { tema: "saude", uf: "PB" }), "/mapa/busca?aba=instrumentos&uf=PB&tema=saude");
  assert.equal(urlBusca(vazia, { uf: "PB", municipio: "2510808" }), "/mapa/busca?aba=instrumentos&uf=PB&municipio=2510808");
  assert.equal(urlBusca(vazia, { aba: "propostas", uf: "PB", municipio: "2510808" }), "/mapa/busca?aba=propostas&uf=PB&municipio=2510808");
  // De uma lista para a unificada: solta tema, situação, município e página; a UF fica (menos a PB).
  const lista = parametrosBusca({ aba: "instrumentos", q: "creche", uf: "SP", tema: "saude", grupo: "execucao", pagina: "4" });
  assert.equal(urlBusca(lista, { aba: "tudo" }), "/mapa/busca?q=creche&uf=SP");
  assert.equal(urlBusca(parametrosBusca({ aba: "organizacoes", q: "x" }), { aba: "tudo" }), "/mapa/busca?q=x");
  assert.equal(urlBusca(parametrosBusca({ aba: "instrumentos", uf: "RN" }), { aba: "tudo" }), "/mapa/busca?aba=tudo&uf=RN");
  // Ida e volta: o endereço da unificada é lido como unificada.
  for (const u of ["/mapa/busca?q=patos", "/mapa/busca?q=x&uf=SP", "/mapa/busca?aba=tudo&uf=RN"]) {
    const sp = Object.fromEntries(new URLSearchParams(u.split("?")[1]));
    assert.equal(parametrosBusca(sp).aba, "tudo", u);
  }
});
