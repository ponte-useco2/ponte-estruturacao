import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anoPadrao,
  anosAssinatura,
  anosEnvio,
  canceladas,
  datasAssinatura,
  diasPorExtenso,
  MOTIVOS_ADITIVO,
  ROTULO_MOTIVO_ADITIVO,
  paraCsv,
  urlExportar,
  urlExportarFicha,
  parametrosFicha,
  periodoPorExtenso,
  somaMotivos,
  ufDoIbge,
  urlFicha,
  vezDaProposta,
  etapasDe,
  exigenciasDe,
  fracao,
  idadePorExtenso,
  inicioJanela,
  maisLento,
  matrizEtapas,
  medianaComparavel,
  parametrosPainel,
  semDesfecho,
  type LinhaDesfecho,
  type LinhaEtapa,
  percentual,
  prazoPorExtenso,
  resumoDe,
  sinaisDe,
  urlPainel,
} from "./painel.ts";

const PADRAO = {
  visao: "suspensiva",
  uf: null,
  orgao: null,
  lado: "atrasada",
  dimensao: "orgao",
  ano: null,
  municipio: null,
  assinadoDe: null,
  assinadoAte: null,
  movimento: null,
};

test("movimentação: só nas visões de convênio, valor fora da lista cai fora, e segue na URL", () => {
  const p = parametrosPainel({ visao: "fisico", movimento: "parado_1ano", municipio: "2507507" });
  assert.deepEqual([p.movimento, p.uf], ["parado_1ano", "PB"]);
  assert.equal(parametrosPainel({ visao: "nunca", movimento: "x" }).movimento, null);
  assert.equal(parametrosPainel({ visao: "tempos", movimento: "recente_30d" }).movimento, null);
  assert.equal(urlPainel(p, { visao: "saldo" }), "/mapa/painel?visao=saldo&uf=PB&municipio=2507507&movimento=parado_1ano");
  assert.equal(urlPainel(p, { visao: "aprovacao" }), "/mapa/painel?visao=aprovacao&uf=PB");
  const f = parametrosFicha("2507507", { movimento: "recente_30d" });
  assert.equal(urlFicha(f!), "/mapa/painel/municipio/2507507?movimento=recente_30d");
});

test("tempos por ano: o ano vai na URL de tempos e some ao trocar de visão", () => {
  const t = parametrosPainel({ visao: "tempos", ano: "2024" });
  assert.equal(t.ano, 2024);
  assert.equal(urlPainel(t, {}), "/mapa/painel?visao=tempos&ano=2024");
  assert.equal(urlPainel(t, { ano: null }), "/mapa/painel?visao=tempos");
  assert.equal(urlPainel(t, { visao: "aprovacao" }), "/mapa/painel?visao=aprovacao");
  assert.equal(parametrosPainel({ visao: "suspensiva", ano: "2024" }).ano, null);
});

test("motivos dos aditivos: soma dos anos pedidos, com a falta de motivo no fim", () => {
  const l = (ano: number, motivo: string, aditivos: number) => ({ recorte: "BR", ano, motivo, aditivos, convenios: aditivos });
  const r = somaMotivos(
    [l(2023, "chuvas", 100), l(2024, "licitacao", 30), l(2025, "licitacao", 30), l(2025, "nao_classificado", 500), l(2025, "chuvas", 5)],
    2024,
  );
  assert.deepEqual(r, [
    { motivo: "licitacao", aditivos: 60 },
    { motivo: "chuvas", aditivos: 5 },
    { motivo: "nao_classificado", aditivos: 500 },
  ]);
  assert.ok(MOTIVOS_ADITIVO.every((m) => ROTULO_MOTIVO_ADITIVO[m]));
});

test("endereços do CSV repetem os filtros da tela, com a visão explícita", () => {
  assert.equal(urlExportar(parametrosPainel({})), "/mapa/painel/exportar?visao=suspensiva");
  assert.equal(
    urlExportar(parametrosPainel({ municipio: "2507507", movimento: "parado_1ano" })),
    "/mapa/painel/exportar?visao=suspensiva&uf=PB&municipio=2507507&movimento=parado_1ano",
  );
  assert.equal(
    urlExportar(parametrosPainel({ visao: "contas", lado: "tce", uf: "PB" })),
    "/mapa/painel/exportar?visao=contas&uf=PB&lado=tce",
  );
  const f = parametrosFicha("2507507", { quem: "todos", assinado_de: "2020" })!;
  assert.equal(urlExportarFicha(f), "/mapa/painel/exportar?ficha=2507507&quem=todos&assinado_de=2020");
  assert.equal(urlExportarFicha(f, "propostas"), "/mapa/painel/exportar?ficha=2507507&tipo=propostas&quem=todos&assinado_de=2020");
});

test("CSV para o Excel em português", () => {
  const csv = paraCsv(
    [
      { titulo: "Convênio", valor: (x: { nr: string }) => x.nr },
      { titulo: "Valor", valor: () => 1234.5 },
      { titulo: "Data", valor: () => "2026-09-12" },
      { titulo: "Ativo", valor: () => true },
      { titulo: "Nota", valor: () => 'tem ; e "aspas"' },
      { titulo: "Fórmula", valor: () => "=HYPERLINK(1)" },
      { titulo: "Vazio", valor: () => null },
    ],
    [{ nr: "981395" }],
  );
  assert.ok(csv.startsWith("﻿Convênio;Valor;Data;Ativo;Nota;Fórmula;Vazio\r\n"));
  assert.equal(csv.split("\r\n")[1], `981395;1234,5;12/09/2026;sim;"tem ; e ""aspas""";"'=HYPERLINK(1)";`);
});

test("município: a UF sai do código IBGE, e UF diferente na URL solta o município", () => {
  assert.equal(ufDoIbge("2507507"), "PB");
  assert.equal(ufDoIbge("5300108"), "DF");
  assert.equal(ufDoIbge("1600303"), "AP");
  assert.equal(ufDoIbge("3400000"), null); // 34 não é UF
  assert.equal(ufDoIbge("250750"), null);
  const p = parametrosPainel({ visao: "nunca", municipio: "2507507" });
  assert.deepEqual([p.uf, p.municipio], ["PB", "2507507"]);
  assert.deepEqual(
    [parametrosPainel({ municipio: "2507507", uf: "PB" }).municipio, parametrosPainel({ municipio: "2507507", uf: "RN" }).uf],
    ["2507507", "RN"],
  );
  assert.equal(parametrosPainel({ municipio: "2507507", uf: "RN" }).municipio, null);
  // Tempos, aprovação e municípios não leem convênio a convênio.
  assert.equal(parametrosPainel({ visao: "tempos", municipio: "2507507" }).municipio, null);
  assert.equal(parametrosPainel({ visao: "municipios", municipio: "2507507" }).uf, null);
});

test("período de assinatura: anos válidos, invertidos são trocados, e só nas visões de convênio", () => {
  const p = parametrosPainel({ visao: "saldo", assinado_de: "2024", assinado_ate: "2019" });
  assert.deepEqual([p.assinadoDe, p.assinadoAte], [2019, 2024]);
  assert.deepEqual([parametrosPainel({ assinado_de: "2007" }).assinadoDe, parametrosPainel({ assinado_ate: "20x" }).assinadoAte], [null, null]);
  assert.equal(parametrosPainel({ visao: "aprovacao", assinado_de: "2020" }).assinadoDe, null);
  assert.deepEqual(datasAssinatura(2019, 2024), { de: "2019-01-01", ate: "2024-12-31" });
  assert.deepEqual(datasAssinatura(null, null), { de: null, ate: null });
  assert.equal(periodoPorExtenso(2019, 2024), "assinados de 2019 a 2024");
  assert.equal(periodoPorExtenso(2023, null), "assinados desde 2023");
  assert.equal(periodoPorExtenso(2020, 2020), "assinados em 2020");
  assert.equal(periodoPorExtenso(null, null), "");
  const anos = anosAssinatura("2026-09-12");
  assert.deepEqual([anos[0], anos.at(-1)], [2026, 2008]);
});

test("url: município e período seguem entre visões de convênio e somem nas outras", () => {
  const p = parametrosPainel({ visao: "nunca", municipio: "2507507", assinado_de: "2019" });
  assert.equal(urlPainel(p, { visao: "contas" }), "/mapa/painel?visao=contas&uf=PB&municipio=2507507&assinado_de=2019");
  assert.equal(urlPainel(p, { visao: "tempos" }), "/mapa/painel?visao=tempos&uf=PB");
  assert.equal(urlPainel(p, { uf: "RN" }), "/mapa/painel?visao=nunca&uf=RN&assinado_de=2019");
  assert.equal(urlPainel(p, { uf: null }), "/mapa/painel?visao=nunca&assinado_de=2019");
});

test("ficha: código inválido não abre, prefeitura é o padrão e a URL omite o padrão", () => {
  assert.equal(parametrosFicha("123", {}), null);
  const f = parametrosFicha("2507507", { quem: "todos", assinado_de: "2025", assinado_ate: "2020" });
  assert.deepEqual(f, { ibge: "2507507", uf: "PB", quem: "todos", assinadoDe: 2020, assinadoAte: 2025, movimento: null });
  assert.equal(parametrosFicha("2507507", { quem: "x" })?.quem, "prefeitura");
  assert.equal(urlFicha({ ibge: "2507507" }), "/mapa/painel/municipio/2507507");
  assert.equal(urlFicha(f!, { quem: "prefeitura" }), "/mapa/painel/municipio/2507507?assinado_de=2020&assinado_ate=2025");
  assert.deepEqual(
    ["aberta_proponente", "aguardando_assinatura", "assinada"].map(vezDaProposta),
    ["proponente", "concedente", null],
  );
});

test("parâmetros: valores fora da lista caem no padrão, sem chegar ao banco", () => {
  assert.deepEqual(parametrosPainel({}), PADRAO);
  assert.deepEqual(
    parametrosPainel({ visao: "x; drop", uf: "ZZ", lado: "qualquer", dimensao: "x", ano: "1990" }),
    PADRAO,
  );
  const p = parametrosPainel({ visao: "contas", uf: "pb", orgao: " MINISTERIO DAS CIDADES ", lado: "tce" });
  assert.deepEqual(p, { ...PADRAO, visao: "contas", uf: "PB", orgao: "MINISTERIO DAS CIDADES", lado: "tce" });
  assert.equal(parametrosPainel({ ano: "2025.5" }).ano, null);
  assert.equal(parametrosPainel({ visao: "aprovacao", ano: "2024" }).ano, 2024);
});

test("url: dimensão e ano só nas visões que os usam, e somem ao trocar de visão", () => {
  const t = parametrosPainel({ visao: "tempos", dimensao: "programa", orgao: "MINISTERIO DA SAUDE" });
  assert.equal(urlPainel(t, {}), "/mapa/painel?visao=tempos&orgao=MINISTERIO+DA+SAUDE&dimensao=programa");
  assert.equal(urlPainel(t, { visao: "aprovacao" }), "/mapa/painel?visao=aprovacao");
  const a = parametrosPainel({ visao: "aprovacao", ano: "2024", uf: "PB" });
  assert.equal(urlPainel(a, { ano: 2023 }), "/mapa/painel?visao=aprovacao&uf=PB&ano=2023");
  assert.equal(urlPainel(a, { visao: "tempos" }), "/mapa/painel?visao=tempos&uf=PB");
});

const etapa = (chave: string, e: string, n: number, mediana: number | null, dimensao: "orgao" | "programa" = "orgao"): LinhaEtapa => ({
  recorte: "BR",
  dimensao,
  chave,
  rotulo: chave === "__todos__" ? "Todos os órgãos" : chave,
  orgao_sup: chave === "__todos__" ? null : "MINISTERIO",
  etapa: e,
  n,
  mediana,
  p90: null,
  em_aberto: 0,
  idade_mediana_aberto: null,
});

test("matriz: agrupa por chave, ignora o total e a outra dimensão, e ordena pelo volume de assinaturas", () => {
  const linhas = [
    etapa("__todos__", "envio_assinatura", 9000, 94),
    etapa("B", "envio_aprovacao", 50, 40),
    etapa("B", "envio_assinatura", 20, 100),
    etapa("A", "envio_assinatura", 300, 80),
    etapa("A", "vez_concedente", 300, 44),
    etapa("C", "envio_aprovacao", 5, 10),
    etapa("123", "envio_assinatura", 999, 70, "programa"),
  ];
  const m = matrizEtapas(linhas, "orgao");
  assert.deepEqual(m.map((x) => [x.chave, x.volume]), [["A", 300], ["B", 20], ["C", 0]]);
  assert.equal(m[0].etapas.vez_concedente?.mediana, 44);
  assert.deepEqual(matrizEtapas(linhas, "programa").map((x) => x.chave), ["123"]);
  assert.deepEqual(Object.keys(etapasDe(linhas, "__todos__")), ["envio_assinatura"]);
});

test("mediana só com medições suficientes; lenta a partir de 1,5 vez o recorte", () => {
  assert.equal(medianaComparavel(etapa("A", "x", 9, 50)), null);
  assert.equal(medianaComparavel(etapa("A", "x", 10, 50)), 50);
  assert.equal(medianaComparavel(undefined), null);
  assert.equal(maisLento(150, 100), true);
  assert.equal(maisLento(149.9, 100), false);
  assert.equal(maisLento(150, null), false);
  assert.equal(maisLento(null, 100), false);
});

test("anos de envio: do ano do dado até 2019, e o padrão é o anterior", () => {
  assert.equal(anoPadrao("2026-09-12"), 2025);
  const anos = anosEnvio("2026-09-12");
  assert.deepEqual([anos[0], anos.at(-1), anos.length], [2026, 2019, 8]);
  // Mesma conta do job: REF - 1095 dias, com o 29 de fevereiro de 2024 no meio.
  assert.equal(inicioJanela("2026-09-12"), "2023-09-13");
});

test("desfechos: sem desfecho soma as três filas e canceladas é o resto, nunca negativo", () => {
  const d = {
    enviadas: 100, assinadas: 30, reprovadas: 20, impedimento: 10, eliminadas: 5,
    abertas_concedente: 15, abertas_proponente: 8, aguardando_assinatura: 2,
  } as LinhaDesfecho;
  assert.equal(semDesfecho(d), 25);
  assert.equal(canceladas(d), 10);
  assert.equal(canceladas({ ...d, enviadas: 50 }), 0);
});

test("dias por extenso e fração", () => {
  assert.equal(diasPorExtenso(56.1), "56 dias");
  assert.equal(diasPorExtenso(1.2), "1 dia");
  assert.equal(diasPorExtenso(1234.4), "1.234 dias");
  assert.equal(diasPorExtenso(null), "—");
  assert.equal(fracao(1, 4), 0.25);
  assert.equal(fracao(1, 0), null);
});

test("parâmetros: órgão não se aplica a municípios e tem tamanho limitado", () => {
  assert.equal(parametrosPainel({ visao: "municipios", orgao: "MINISTERIO" }).orgao, null);
  assert.equal(parametrosPainel({ orgao: "x".repeat(500) }).orgao?.length, 200);
});

test("url: omite padrões, mantém filtros e limpa órgão e lado ao trocar de visão", () => {
  const p = parametrosPainel({ visao: "contas", uf: "PB", orgao: "MINISTERIO DA SAUDE", lado: "negativo" });
  assert.equal(urlPainel(p, {}), "/mapa/painel?visao=contas&uf=PB&orgao=MINISTERIO+DA+SAUDE&lado=negativo");
  assert.equal(urlPainel(p, { visao: "saldo" }), "/mapa/painel?visao=saldo&uf=PB");
  assert.equal(urlPainel(p, { uf: null, orgao: null, lado: "atrasada" }), "/mapa/painel?visao=contas");
  assert.equal(urlPainel(parametrosPainel({}), {}), "/mapa/painel");
});

test("prazo por extenso, com singular e passado", () => {
  assert.equal(prazoPorExtenso(0), "vence hoje");
  assert.equal(prazoPorExtenso(1), "vence em 1 dia");
  assert.equal(prazoPorExtenso(30), "vence em 30 dias");
  assert.equal(prazoPorExtenso(-3), "venceu há 3 dias");
  assert.equal(prazoPorExtenso(null), "—");
  assert.equal(prazoPorExtenso(10, { futuro: "termina", passado: "terminou" }), "termina em 10 dias");
});

test("idade por extenso para leitura de relance", () => {
  assert.equal(idadePorExtenso(12), "12 dias");
  assert.equal(idadePorExtenso(100), "3 meses");
  assert.equal(idadePorExtenso(365), "1 ano");
  assert.equal(idadePorExtenso(1000), "2 anos e 8 meses");
  assert.equal(idadePorExtenso(null), "—");
});

test("percentual arredonda e trata ausência", () => {
  assert.equal(percentual(0.374), "37%");
  assert.equal(percentual(null), "—");
});

test("resumo devolve zero para faixa que não veio", () => {
  const r = resumoDe(
    [
      { visao: "suspensiva", chave: "total", n: 6254, valor: 19337817119.77 },
      { visao: "nunca", chave: "total", n: 20453, valor: 1 },
    ],
    "suspensiva",
  );
  assert.deepEqual(r("total"), { n: 6254, valor: 19337817119.77 });
  assert.deepEqual(r("vencido"), { n: 0, valor: 0 });
});

test("exigências e sinais só contam o que é verdadeiro", () => {
  assert.deepEqual(exigenciasDe({ exige_projeto: true, exige_licenca: null, exige_titularidade: false }), ["projeto"]);
  assert.deepEqual(sinaisDe({ sinal_saldo: true, sinal_contas_negativas: true, sinal_suspensiva: false }), [
    "saldo",
    "contas_negativas",
  ]);
});
