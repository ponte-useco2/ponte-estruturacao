import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agruparPorRaiz,
  areaDaUrl,
  areasDaLista,
  cnpjDaMatriz,
  fantasiaUtil,
  filtrarPorArea,
  filtrarPorNome,
  idade,
  listaDoMunicipio,
  nomeOsc,
  rotuloNatureza,
  situacaoNaReceita,
  versaoLegivel,
  type OscNaLista,
} from "./osc.ts";

const osc = (cnpj: string, nome: string, matriz: boolean | null, areas: string[] = []): OscNaLista => ({
  cnpj,
  cnpj_raiz: cnpj.slice(0, 8),
  razao_social: nome,
  nome_fantasia: null,
  natureza_juridica: "3220",
  matriz,
  areas,
  dt_fundacao: null,
});

test("E3: versão do arquivo do Ipea, natureza e nome", () => {
  assert.equal(versaoLegivel("20260522"), "maio de 2026");
  assert.equal(versaoLegivel("local"), "versão não informada");
  assert.equal(rotuloNatureza("3999"), "Associação privada");
  assert.equal(rotuloNatureza("2143"), "Natureza 214-3");
  assert.equal(nomeOsc({ cnpj: "1", razao_social: null, nome_fantasia: "ASCOP" }), "ASCOP");
  assert.equal(fantasiaUtil({ razao_social: "SOS SERTAO - ORGANIZACAO SERTANEJA", nome_fantasia: "SOS SERTÃO" }), null);
  assert.equal(fantasiaUtil({ razao_social: "ASSOCIACAO X", nome_fantasia: "ASSOCIACAO X" }), null);
  assert.equal(fantasiaUtil({ razao_social: "FUNDACAO NAPOLEAO LAUREANO", nome_fantasia: "HOSPITAL NAPOLEAO LAUREANO" }), "HOSPITAL NAPOLEAO LAUREANO");
});

test("E3: idade pela fundação e situação na Receita", () => {
  assert.equal(idade("1994-10-20", "2026-10-07"), 31);
  assert.equal(idade("1994-10-07", "2026-10-07"), 32);
  assert.equal(idade(null, "2026-10-07"), null);
  assert.deepEqual(situacaoNaReceita({ situacao_cadastral: "Ativa", removida: false, ativa: true }), { texto: "Ativa na Receita", atencao: false });
  assert.deepEqual(situacaoNaReceita({ situacao_cadastral: "Inapta", removida: false, ativa: false }), { texto: "Inapta na Receita", atencao: true });
  assert.match(situacaoNaReceita({ situacao_cadastral: "Ativa", removida: true, ativa: false }).texto, /retirada do Mapa/);
});

test("E3: a matriz de uma filial pelos dígitos verificadores (também no CNPJ alfanumérico)", () => {
  assert.equal(cnpjDaMatriz("11111111000272"), "11111111000191");
  assert.equal(cnpjDaMatriz("09112236000194"), "09112236000194");
  assert.match(cnpjDaMatriz("12ABC34501DE35") ?? "", /^12ABC3450001\d{2}$/);
  assert.equal(cnpjDaMatriz("123"), null);
});

test("E3: filiais agrupadas pela raiz, com a matriz como linha principal", () => {
  const lista = [
    osc("22222222000391", "IGREJA X - TEMPLO 3", false),
    osc("22222222000191", "IGREJA X", true),
    osc("22222222000272", "IGREJA X - TEMPLO 2", false),
    osc("33333333000291", "IGREJA Y - FILIAL", false),
    osc("11111111000191", "ASSOCIAÇÃO A", true),
  ];
  const g = agruparPorRaiz(lista);
  assert.deepEqual(
    g.map((x) => [nomeOsc(x.principal), x.filiais, x.matrizFora]),
    [
      ["ASSOCIAÇÃO A", 0, false],
      ["IGREJA X", 2, false],
      ["IGREJA Y - FILIAL", 0, true],
    ],
  );
});

test("E3: áreas da lista e filtro por área", () => {
  const lista = [osc("1", "A", true, ["saude", "assistencia_social"]), osc("2", "B", true, ["saude"]), osc("3", "C", true, [])];
  assert.deepEqual(areasDaLista(lista), [
    { area: "saude", n: 2 },
    { area: "assistencia_social", n: 1 },
    { area: "sem_area", n: 1 },
  ]);
  assert.deepEqual(filtrarPorArea(lista, "saude").map((o) => o.cnpj), ["1", "2"]);
  assert.deepEqual(filtrarPorArea(lista, "sem_area").map((o) => o.cnpj), ["3"]);
  assert.equal(filtrarPorArea(lista, null).length, 3);
  assert.equal(areaDaUrl("religiao"), "religiao");
  assert.equal(areaDaUrl("toString"), null);
  assert.equal(areaDaUrl(undefined), null);
});

test("E3: lista do município — nome sem acento, quem tem instrumento primeiro, página", () => {
  const lista = [
    osc("22222222000191", "IGREJA X", true, ["religiao"]),
    osc("22222222000272", "IGREJA X - TEMPLO 2", false, ["religiao"]),
    osc("11111111000191", "ASSOCIAÇÃO DOS AGRICULTORES", true, ["desenvolvimento_e_defesa_de_direitos_e_interesses"]),
    osc("33333333000191", "FUNDAÇÃO SAÚDE", true, ["saude"]),
  ];
  assert.deepEqual(filtrarPorNome(lista, "associacao agricul").map((o) => o.cnpj), ["11111111000191"]);
  assert.deepEqual(filtrarPorNome(lista, "33.333.333/0001-91").map((o) => o.cnpj), ["33333333000191"]);
  const instrumentos = new Map([["22222222000272", 2], ["33333333000191", 1]]);
  const r = listaDoMunicipio(lista, instrumentos, { area: null, q: "", pagina: 1 });
  assert.deepEqual(r.grupos.map((g) => [nomeOsc(g.principal), g.instrumentos, g.filiais]), [
    ["IGREJA X", 2, 1],
    ["FUNDAÇÃO SAÚDE", 1, 0],
    ["ASSOCIAÇÃO DOS AGRICULTORES", 0, 0],
  ]);
  assert.equal(r.organizacoes, 4);
  assert.equal(r.paginas, 1);
  assert.equal(listaDoMunicipio(lista, instrumentos, { area: "saude", q: "", pagina: 9 }).grupos.length, 1, "página fora do fim volta para a última");
});
