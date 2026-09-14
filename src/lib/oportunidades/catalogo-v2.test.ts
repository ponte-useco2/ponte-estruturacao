import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SEM_FILTRO,
  alcancaAssunto,
  assuntosEfetivos,
  contarPorAssunto,
  contarPorCanal,
  filtrarJanelas,
  montarCatalogo,
} from "./catalogo-v2.ts";
import type { PayloadV2 } from "./contrato-v2.ts";

/** As mesmas sete oportunidades reais de 10/09/2026 do teste do contrato. */
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "v2-amostra.json"), "utf-8"),
) as PayloadV2;

// Antes de qualquer prazo do fixture vencer: todas as `open` ainda estão abertas.
const ANTES = "2026-09-09";

test("sem entidade declarada, mostra todas as abertas e nenhuma aderência", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  // 7 no fixture: 1 unknown e 1 closed ficam de fora.
  assert.equal(c.janelas.length, 5);
  assert.ok(c.janelas.every((j) => j.aderencia === null));
  assert.equal(c.paraEntidade, null);
});

test("com entidade, só entra o que o tipo dela pode pleitear — e o resto é contado", () => {
  const c = montarCatalogo(FIXTURE, { tipo: "municipio", uf: "PB", temas: [] }, ANTES);
  assert.deepEqual(c.janelas.map((j) => j.id), ["transferegov-7bb9c38d13a7-emenda"]);
  assert.equal(c.paraEntidade?.elegiveis, 1);
  assert.equal(c.paraEntidade?.foraDoTipo, 4, "das 5 abertas, 4 não aceitam município");
});

test("o universo é o catálogo inteiro, e as abertas são contadas HOJE, não lidas do summary", () => {
  const c = montarCatalogo(FIXTURE, { tipo: "osc", uf: "PB", temas: [] }, "2026-09-12");
  assert.equal(c.universo.monitoradas, FIXTURE.summary.monitored, "monitoradas vem do summary");
  // Em 12/09, as quatro com prazo 10 e 11/09 já venceram; só a do CNPq (18/09) segue aberta.
  assert.equal(c.universo.abertasHoje, 1);
  assert.notEqual(c.universo.abertasHoje, FIXTURE.summary.open, "summary.open conta vencidas");
});

test("vencida some da lista mesmo marcada open no arquivo", () => {
  const c = montarCatalogo(FIXTURE, null, "2026-09-12");
  assert.deepEqual(c.janelas.map((j) => j.id), ["cnpq-24-2026"]);
});

test("ordem: prazo mais perto primeiro, e não a do arquivo", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const prazos = c.janelas.map((j) => j.prazo);
  assert.deepEqual(prazos, [...prazos].sort(), "prazos em ordem crescente");
});

test("no mesmo prazo, a aderência de quem olha desempata", () => {
  const payload: PayloadV2 = {
    ...FIXTURE,
    opportunities: [
      { ...FIXTURE.opportunities[3], id: "a", title: "A sem tema", themes: [] },
      { ...FIXTURE.opportunities[3], id: "b", title: "B com tema", themes: ["inovacao"] },
    ],
  };
  const c = montarCatalogo(payload, { tipo: "empresa", uf: "PB", temas: ["inovacao"] }, ANTES);
  assert.deepEqual(c.janelas.map((j) => j.id), ["b", "a"], "a de maior aderência vem antes");
});

test("urgência segue os 15 dias do radar", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const cnpq = c.janelas.find((j) => j.id === "cnpq-24-2026");
  assert.equal(cnpq?.diasRestantes, 9);
  assert.equal(cnpq?.urgente, true);
});

test("cada fonte traz a sua saúde e as abertas que alcançam a entidade", () => {
  const c = montarCatalogo(FIXTURE, { tipo: "empresa", uf: "PB", temas: [] }, ANTES);
  const porId = Object.fromEntries(c.fontes.map((f) => [f.id, f]));
  assert.equal(porId.finep.abertas, 1, "a finep-749717 aceita empresa");
  assert.equal(porId.transferegov.abertas, 0, "nenhuma do transferegov aceita empresa");
  assert.equal(porId.fapesq.abertas, 0, "a da fapesq é unknown");
  assert.equal(c.fontesComProblema.length, 0, "as quatro estavam healthy em 10/09");
});

test("fonte com falha entra na lista que a tela é obrigada a nomear", () => {
  const quebrado: PayloadV2 = {
    ...FIXTURE,
    sources: FIXTURE.sources.map((s) =>
      s.id === "fapesq"
        ? { ...s, status: "error" as const, error: "URLError: timed out", consecutive_errors: 2 }
        : s,
    ),
  };
  const c = montarCatalogo(quebrado, null, ANTES);
  assert.deepEqual(c.fontesComProblema.map((f) => f.id), ["fapesq"]);
  assert.equal(c.fontesComProblema[0].rotuloStatus, "com falha na última leitura");
  assert.equal(c.fontesComProblema[0].erro, "URLError: timed out");
});

test("a métrica da Ponte não chega à tela", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const serializado = JSON.stringify(c);
  assert.ok(!serializado.includes("ponte_score"), "regra 3 do contrato");
  assert.ok(!serializado.includes("portfolio"), "regra 3 do contrato");
});

// =============================================================================
// Filtros
// =============================================================================


test("sem filtro, nada some", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  assert.equal(filtrarJanelas(c.janelas, SEM_FILTRO).length, c.janelas.length);
});

test("filtro por fonte", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const so = filtrarJanelas(c.janelas, { ...SEM_FILTRO, fontes: ["finep", "cnpq"] });
  assert.deepEqual(so.map((j) => j.fonteId).sort(), ["cnpq", "finep"]);
});

test("escolher Inovação alcança a janela marcada só com uma vertical filha", () => {
  assert.ok(alcancaAssunto(["bioeconomia"], ["inovacao"]));
});

test("escolher a vertical NÃO alcança a irmã nem a Inovação genérica", () => {
  assert.ok(!alcancaAssunto(["descarbonizacao"], ["bioeconomia"]), "irmã");
  assert.ok(!alcancaAssunto(["inovacao"], ["bioeconomia"]), "genérica não é específica");
});

test("vários assuntos escolhidos somam, não restringem", () => {
  assert.ok(alcancaAssunto(["saude"], ["inovacao", "saude"]));
  assert.ok(alcancaAssunto(["bioeconomia"], ["inovacao", "saude"]));
});

test("a busca ignora acento e maiúscula, e olha título e financiador", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const cnpq = filtrarJanelas(c.janelas, { ...SEM_FILTRO, busca: "CNPQ" });
  assert.ok(cnpq.length >= 1);
  assert.equal(filtrarJanelas(c.janelas, { ...SEM_FILTRO, busca: "nenhum-resultado-possivel" }).length, 0);
});

test("a contagem de assuntos sobe para o pai", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const cnpq = c.janelas.find((j) => j.id === "cnpq-24-2026");
  assert.ok(cnpq?.temas.includes("biotecnologia"));
  const n = contarPorAssunto([cnpq!]);
  assert.equal(n.get("biotecnologia"), 1);
  assert.equal(n.get("inovacao"), 1, "a janela conta uma vez para Inovação, mesmo com pai e filho");
});

test("o subfiltro refina: escolher o filho tira o pai do filtro", () => {
  assert.deepEqual(assuntosEfetivos(["inovacao"]), ["inovacao"]);
  assert.deepEqual(assuntosEfetivos(["inovacao", "bioeconomia"]), ["bioeconomia"]);
  assert.deepEqual(assuntosEfetivos(["inovacao", "bioeconomia", "saude"]), ["bioeconomia", "saude"]);
  // Filho sem o pai escolhido continua valendo por conta própria.
  assert.deepEqual(assuntosEfetivos(["bioeconomia"]), ["bioeconomia"]);
});

test("com o subfiltro, a lista de fato estreita", () => {
  const janelas = [
    { temas: ["bioeconomia"], id: "bio" },
    { temas: ["descarbonizacao"], id: "desc" },
    { temas: ["inovacao"], id: "generica" },
  ].map((x) => ({ ...montarCatalogo(FIXTURE, null, ANTES).janelas[0], ...x }));

  const soInovacao = filtrarJanelas(janelas, { ...SEM_FILTRO, assuntos: ["inovacao"] });
  assert.equal(soInovacao.length, 3, "Inovação alcança as três");

  const refinado = filtrarJanelas(janelas, { ...SEM_FILTRO, assuntos: ["inovacao", "bioeconomia"] });
  assert.deepEqual(refinado.map((j) => j.id), ["bio"], "o subfiltro estreita para a vertical");
});

// =============================================================================
// Canal
// =============================================================================

test("cada janela sai com o seu canal", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const porId = Object.fromEntries(c.janelas.map((j) => [j.id, j.canal]));
  assert.equal(porId["transferegov-903a9f369f75-proposta"], "voluntaria");
  assert.equal(porId["transferegov-7bb9c38d13a7-emenda"], "emenda_parlamentar");
  assert.equal(porId["finep-749717"], "chamada_publica");
});

test("filtro por canal", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const emenda = filtrarJanelas(c.janelas, { ...SEM_FILTRO, canais: ["emenda_parlamentar"] });
  assert.ok(emenda.length > 0);
  assert.ok(emenda.every((j) => j.canal === "emenda_parlamentar"));
  const varios = filtrarJanelas(c.janelas, { ...SEM_FILTRO, canais: ["voluntaria", "chamada_publica"] });
  assert.ok(varios.every((j) => j.canal === "voluntaria" || j.canal === "chamada_publica"));
});

test("janela sem canal conhecido só aparece sem filtro de canal", () => {
  const janelas = montarCatalogo(FIXTURE, null, ANTES).janelas.map((j, i) => (i === 0 ? { ...j, canal: null } : j));
  assert.equal(filtrarJanelas(janelas, SEM_FILTRO).length, janelas.length, "sem filtro, fica");
  for (const canal of ["voluntaria", "emenda_parlamentar", "beneficiario_especifico", "chamada_publica"] as const) {
    assert.ok(!filtrarJanelas(janelas, { ...SEM_FILTRO, canais: [canal] }).some((j) => j.canal === null));
  }
});

test("a contagem por canal soma o total de janelas com canal", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const n = contarPorCanal(c.janelas);
  const soma = [...n.values()].reduce((a, b) => a + b, 0);
  assert.equal(soma, c.janelas.filter((j) => j.canal !== null).length);
});

test("códigos do programa: chegam ao cartão pelo id, e sem índice ficam vazios", () => {
  const codigos = new Map([["transferegov-7bb9c38d13a7-emenda", ["2040820260007"]]]);
  const com = montarCatalogo(FIXTURE, null, ANTES, codigos);
  assert.deepEqual(com.janelas.find((j) => j.id === "transferegov-7bb9c38d13a7-emenda")?.codigos, ["2040820260007"]);
  assert.ok(
    com.janelas.filter((j) => j.id !== "transferegov-7bb9c38d13a7-emenda").every((j) => j.codigos.length === 0),
    "janela fora do índice não herda código de ninguém",
  );

  const sem = montarCatalogo(FIXTURE, null, ANTES);
  assert.ok(sem.janelas.every((j) => j.codigos.length === 0));
});
