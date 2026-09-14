import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exigenciasDe,
  idadePorExtenso,
  parametrosPainel,
  percentual,
  prazoPorExtenso,
  resumoDe,
  sinaisDe,
  urlPainel,
} from "./painel.ts";

test("parâmetros: valores fora da lista caem no padrão, sem chegar ao banco", () => {
  assert.deepEqual(parametrosPainel({}), { visao: "suspensiva", uf: null, orgao: null, lado: "atrasada" });
  assert.deepEqual(parametrosPainel({ visao: "x; drop", uf: "ZZ", lado: "qualquer" }), {
    visao: "suspensiva",
    uf: null,
    orgao: null,
    lado: "atrasada",
  });
  const p = parametrosPainel({ visao: "contas", uf: "pb", orgao: " MINISTERIO DAS CIDADES ", lado: "tce" });
  assert.deepEqual(p, { visao: "contas", uf: "PB", orgao: "MINISTERIO DAS CIDADES", lado: "tce" });
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
