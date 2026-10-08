import test from "node:test";
import assert from "node:assert/strict";
import { COLUNAS_CSV_INSTRUMENTOS, abaDaEntidade, areaExcetuadaDe, carteiraPorSituacao, cnpjDaUrl, dinheiroPorOrgao, especieDe, lenteDe, nivelNaEntidade, quemRecebe, urlEntidade } from "./pagina-entidade.ts";
import { paraCsv } from "./painel.ts";
import type { InstrumentoRelatorio } from "./relatorio-municipio.ts";

test("CNPJ da URL: com ou sem máscara, alfanumérico aceito; fora do formato, null", () => {
  assert.equal(cnpjDaUrl("09.084.815/0001-70"), "09084815000170");
  assert.equal(cnpjDaUrl("09084815000170"), "09084815000170");
  assert.equal(cnpjDaUrl("12.ABC.345/01DE-35"), "12ABC34501DE35");
  assert.equal(cnpjDaUrl("0908481500017"), null);
  assert.equal(cnpjDaUrl("09084815000170X"), null);
  assert.equal(cnpjDaUrl("12ABC34501DEXY"), null, "os dois últimos são dígitos");
  assert.equal(cnpjDaUrl(undefined), null);
});

test("espécie: pelo tipo do painel e pelo nome, que corrige o fundo municipal marcado como OSC", () => {
  assert.equal(especieDe("MUNICIPIO DE PATOS", "municipio"), "prefeitura");
  assert.equal(especieDe("PREFEITURA MUNICIPAL DE SOUSA", "municipio"), "prefeitura");
  assert.equal(especieDe("FUNDO MUNICIPAL DE SAUDE DE CAMPINA GRANDE", "municipio"), "fundo_municipal");
  assert.equal(especieDe("FUNDO MUNICIPAL DE SAUDE DE PITIMBU", "osc"), "fundo_municipal");
  // E3: o Sistema S pelo nome, venha como `osc` (painel antigo) ou como `outros` (depois da correção do job)
  assert.equal(especieDe("SERV DE APOIO AS MICRO E PEQ EMP DA PARAIBA SEBRAE PB", "osc"), "sistema_s");
  assert.equal(especieDe("SERVICO NACIONAL DE APRENDIZAGEM INDUSTRIAL - SENAI", "outros"), "sistema_s");
  assert.equal(especieDe("ASSOCIACAO DOS MORADORES DO SESCAO", "osc"), "osc");
  assert.equal(lenteDe("sistema_s"), "outros");
  assert.equal(especieDe("FUNDACAO CULTURAL DE JOAO PESSOA", "municipio"), "municipal_outro");
  assert.equal(especieDe("ESTADO DA PARAIBA", "estado"), "governo_estadual");
  assert.equal(especieDe("SECRETARIA DE ESTADO DA SAUDE", "estado"), "secretaria_estadual");
  assert.equal(especieDe("UNIVERSIDADE ESTADUAL DA PARAIBA", "estado"), "universidade_estadual");
  assert.equal(especieDe("FUNDO ESTADUAL DE SAUDE DO ESTADO DA PARAIBA - FESEP", "estado"), "fundo_estadual");
  assert.equal(especieDe("SUPERINTENDENCIA DE OBRAS DO PLANO DE DESENVOLVIMENTO DO ESTADO - SUPLAN", "estado"), "estadual_outro");
  assert.equal(especieDe("CONSORCIO INTERMUNICIPAL DE SAUDE DO CARIRI OCIDENTAL", "consorcio_publico"), "consorcio");
  assert.equal(especieDe("FUNDACAO NAPOLEAO LAUREANO", "osc"), "osc");
  assert.equal(especieDe("EMPRESA PARAIBANA DE TURISMO S/A-PB-TUR", "empresa"), "empresa");
  assert.equal(especieDe(null, null), "outro");
  assert.equal(lenteDe("consorcio"), "municipal");
  assert.equal(lenteDe("universidade_estadual"), "estado");
});

test("abas: o público vê resumo, instrumentos e dinheiro; a fila, o controle e o relatório pedem cadastro", () => {
  assert.equal(abaDaEntidade(undefined, 0), "resumo");
  assert.equal(abaDaEntidade("controle", 0), "resumo");
  assert.equal(abaDaEntidade("instrumentos", 0), "instrumentos");
  assert.equal(abaDaEntidade(undefined, 1), "trava");
  assert.equal(abaDaEntidade(["relatorio"], 1), "relatorio");
  assert.equal(abaDaEntidade("nao-existe", 3), "trava");
  assert.equal(urlEntidade("09084815000170"), "/mapa/entidade/09084815000170");
  assert.equal(urlEntidade("09084815000170", "instrumentos"), "/mapa/entidade/09084815000170?aba=instrumentos");
});

test("nível: cliente é a organização de município confirmada diante de entidade municipal do mesmo IBGE; OSC fica como cadastrada até a E2", () => {
  const patos = { especie: "prefeitura" as const, cod_ibge: "2510808" };
  const fundo = { especie: "fundo_municipal" as const, cod_ibge: "2510808" };
  const osc = { especie: "osc" as const, cod_ibge: "2510808" };
  const cliente = { aprovado: true, administrador: false, ibgeConfirmado: "2510808" };
  assert.equal(nivelNaEntidade({ aprovado: false, administrador: false, ibgeConfirmado: null }, patos), 0);
  assert.equal(nivelNaEntidade({ aprovado: true, administrador: true, ibgeConfirmado: null }, osc), 3);
  assert.equal(nivelNaEntidade(cliente, patos), 2);
  assert.equal(nivelNaEntidade(cliente, fundo), 2);
  assert.equal(nivelNaEntidade(cliente, osc), 1, "a OSC sediada no município não é da prefeitura");
  assert.equal(nivelNaEntidade(cliente, { especie: "prefeitura", cod_ibge: "2513802" }), 1, "outro município");
  assert.equal(nivelNaEntidade({ aprovado: true, administrador: false, ibgeConfirmado: null }, patos), 1);
});

test("quem recebe: por CNPJ e por lente, do maior valor para o menor; o nome mais recente vale", () => {
  const l = (cnpj: string, proponente: string, tipo: string, valor: number, data: string, situacao = "Concluído") => ({
    cnpj, proponente, tipo_agente: tipo, situacao, vl_global: valor, dt_assinatura: data,
  });
  const g = quemRecebe([
    l("1", "PREFEITURA MUNICIPAL DE PATOS", "municipio", 100, "2010-01-01"),
    l("1", "MUNICIPIO DE PATOS", "municipio", 200, "2024-05-01", "Em execução"),
    l("2", "FUNDO MUNICIPAL DE SAUDE DE PATOS", "municipio", 500, "2023-01-01", "Em execução"),
    l("3", "UNIVERSIDADE ESTADUAL DA PARAIBA", "estado", 50, "2022-01-01"),
    l("4", "ASSOCIACAO DOS AMIGOS", "osc", 70, "2021-01-01"),
    { cnpj: null, proponente: "SEM CNPJ", tipo_agente: "osc", situacao: null, vl_global: 1, dt_assinatura: null },
  ]);
  assert.deepEqual(g.map((x) => [x.lente, x.entidades.map((e) => e.cnpj)]), [
    ["municipal", ["2", "1"]],
    ["estado", ["3"]],
    ["sociedade", ["4"]],
  ]);
  const patos = g[0].entidades[1];
  assert.deepEqual([patos.nome, patos.especie, patos.instrumentos, patos.emExecucao, patos.valor, patos.ultimoAno], ["MUNICIPIO DE PATOS", "prefeitura", 2, 1, 300, 2024]);
});

const inst = (nr: string, situacao: string | null, orgao: string | null, valor: number, data: string | null, desembolsado = 0): InstrumentoRelatorio => ({
  nr_convenio: nr, modalidade: "CONVENIO", situacao, subsituacao: null, orgao_sup: orgao, programa: null, objeto: null, vl_global: valor,
  vl_repasse: valor, vl_desembolsado: desembolsado, vl_pago: null, vl_saldo_conta: null, pct_fisico: null, dt_assinatura: data, dt_fim_vigencia: null,
  dt_limite_contas: null, dt_primeiro_desembolso: null, dt_ultimo_desembolso: null, dt_ultimo_pagamento: null, situacao_contratacao: null,
  pc33_regime: null, pc33_nivel: null, pc33_pior: null, pc33_itens: null,
});

test("carteira por situação (grupos da busca, mais recente primeiro) e dinheiro por órgão", () => {
  const xs = [
    inst("1", "Em execução", "MINISTERIO DA SAUDE", 100, "2023-01-01", 50),
    inst("2", "Em execução", "MINISTERIO DA SAUDE", 300, "2025-01-01", 100),
    inst("3", "Situação nova do SICONV", "MINISTERIO DA CULTURA", 50, "2020-01-01"),
    inst("4", "Em execução", null, 10, null),
  ];
  const c = carteiraPorSituacao(xs);
  assert.deepEqual(c.map((g) => [g.id, g.itens.map((i) => i.nr_convenio), g.valor]), [["execucao", ["2", "1", "4"], 410], ["outro", ["3"], 50]]);
  assert.deepEqual(dinheiroPorOrgao(xs), [
    { orgao: "MINISTERIO DA SAUDE", n: 2, valor: 400, desembolsado: 150 },
    { orgao: "MINISTERIO DA CULTURA", n: 1, valor: 50, desembolsado: 0 },
    { orgao: "Órgão não informado", n: 1, valor: 10, desembolsado: 0 },
  ]);
  const csv = paraCsv(COLUNAS_CSV_INSTRUMENTOS, [xs[1]]);
  assert.match(csv, /^﻿Número;Modalidade;Situação;Órgão/);
  assert.ok(csv.includes('"=""2""";CONVENIO;Em execução;MINISTERIO DA SAUDE;;;300;300;100;01/01/2025;;'), "número como texto no Excel, data em DD/MM/AAAA");
});

test("área excetuada (LRF, art. 25, § 3º): fundo ou órgão municipal de saúde, educação ou assistência; a prefeitura não", () => {
  assert.equal(areaExcetuadaDe("FUNDO MUNICIPAL DE SAUDE", "fundo_municipal"), "saude");
  assert.equal(areaExcetuadaDe("FMS DE GURINHEM", "fundo_municipal"), "saude");
  assert.equal(areaExcetuadaDe("FUNDO MUNICIPAL DE ASSISTENCIA SOCIAL DE SOUSA", "fundo_municipal"), "assistencia");
  assert.equal(areaExcetuadaDe("SECRETARIA MUNICIPAL DE EDUCACAO", "municipal_outro"), "educacao");
  assert.equal(areaExcetuadaDe("FUNDACAO CULTURAL DE JOAO PESSOA", "municipal_outro"), null);
  assert.equal(areaExcetuadaDe("MUNICIPIO DE PATOS", "prefeitura"), null);
  assert.equal(areaExcetuadaDe("FUNDO ESTADUAL DE SAUDE", "fundo_estadual"), null, "estadual não herda o fiscal do município");
});

test("nível (oport_31): a organização com o CNPJ confirmado é cliente da própria entidade, e só dela", () => {
  const laureano = { cnpj: "09112236000194", especie: "osc" as const, cod_ibge: "2507507" };
  const v = { aprovado: true, administrador: false, ibgeConfirmado: null, cnpjConfirmado: "09112236000194" };
  assert.equal(nivelNaEntidade(v, laureano), 2);
  assert.equal(nivelNaEntidade(v, { ...laureano, cnpj: "12671814000137" }), 1);
  assert.equal(nivelNaEntidade({ ...v, cnpjConfirmado: null }, laureano), 1);
});
