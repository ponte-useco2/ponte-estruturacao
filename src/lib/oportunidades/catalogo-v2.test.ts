import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SEM_FILTRO,
  alcancaAssunto,
  assuntosEfetivos,
  avisoDaFonte,
  contarPorAssunto,
  contarPorCanal,
  documentosSecundarios,
  filtrarJanelas,
  filtrarVista,
  frasesDaReconciliacao,
  montarCatalogo,
  paginaDoItem,
  reconciliar,
} from "./catalogo-v2.ts";
import type { OportunidadeV2, PayloadV2 } from "./contrato-v2.ts";
import { AGENTES } from "./organizacao.ts";

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

test("a janela leva o endereço da fonte, para o botão das fontes sem edital", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  for (const j of c.janelas) {
    const o = FIXTURE.opportunities.find((x) => x.id === j.id);
    assert.equal(j.fonteUrl, o?.source.url);
  }
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

// =============================================================================
// Diagnóstico externo de 17/11/2026
// =============================================================================

const porIdDoFixture = (id: string) => FIXTURE.opportunities.find((o) => o.id === id)!;

/** O fixture com a fonte em falha, como a FAPESQ no catálogo de 16/11/2026 (sem leitura boa desde 23/10). */
function comFonteEmFalha(fonte: string, ultimoSucesso: string | null): PayloadV2 {
  return {
    ...FIXTURE,
    sources: FIXTURE.sources.map((s) =>
      s.id === fonte ? { ...s, status: "error" as const, last_success_at: ultimoSucesso, error: "URLError: <urlopen error timed out>" } : s,
    ),
    opportunities: FIXTURE.opportunities.map((o) => (o.source.id === fonte ? { ...o, source: { ...o.source, stale: true } } : o)),
  };
}

test("A03: a janela leva a saúde da fonte e o cartão diz desde quando ela está sem leitura", () => {
  const c = montarCatalogo(comFonteEmFalha("cnpq", "2026-10-23T17:19:12+00:00"), null, ANTES);
  const cnpq = c.janelas.find((j) => j.id === "cnpq-24-2026")!;
  assert.equal(cnpq.fonteStatus, "error");
  assert.equal(cnpq.fonteUltimoSucesso, "2026-10-23T17:19:12+00:00");
  assert.deepEqual(cnpq.avisoFonte, {
    selo: "sem leitura desde 23/10",
    frase: "CNPq sem leitura desde 23/10; prazo e regras podem ter mudado.",
  });
  // As fontes em dia não ganham aviso.
  assert.ok(c.janelas.filter((j) => j.fonteId !== "cnpq").every((j) => j.fonteStatus === "healthy" && j.avisoFonte === null));
});

test("A03: o aviso da fonte sem data inventada, com o ano quando não é o de hoje, e o dado antigo de fonte em dia", () => {
  const base = { fonteNome: "FAPESQ-PB", fonteStatus: "error" as const, fonteDefasada: true };
  assert.equal(avisoDaFonte({ ...base, fonteUltimoSucesso: null }, "2026-11-17")?.selo, "sem leitura boa registrada");
  assert.equal(avisoDaFonte({ ...base, fonteUltimoSucesso: "2025-12-30T12:00:00+00:00" }, "2026-01-05")?.selo, "sem leitura desde 30/12/2025");
  // No horário da Paraíba: 02h UTC do dia 24 ainda é dia 23 aqui.
  assert.equal(avisoDaFonte({ ...base, fonteUltimoSucesso: "2026-10-24T02:00:00+00:00" }, "2026-11-17")?.selo, "sem leitura desde 23/10");
  assert.equal(
    avisoDaFonte({ fonteNome: "BNDES", fonteStatus: "healthy", fonteUltimoSucesso: "2026-11-16T22:23:19+00:00", fonteDefasada: true }, "2026-11-17")?.frase,
    "Dado da última leitura boa da fonte; prazo e regras podem ter mudado.",
  );
  assert.equal(
    avisoDaFonte({ fonteNome: "CNPq", fonteStatus: "healthy", fonteUltimoSucesso: "2026-11-16T22:23:31+00:00", fonteDefasada: false }, "2026-11-17"),
    null,
  );
});

/** Uma oportunidade nova a partir de uma do fixture, para os casos que o fixture de 10/09 não tem. */
function derivada(base: string, over: Partial<OportunidadeV2> & { id: string }): OportunidadeV2 {
  return { ...porIdDoFixture(base), ...over };
}

test("A01: no arquivo 2.2, a bolsa com pesquisador vai para a seção do vínculo, e as contas fecham", () => {
  const bolsa = derivada("cnpq-24-2026", {
    id: "cnpq-33-2026",
    title: "Chamada CNPq nº 33/2026 - Bolsas de Produtividade do CNPq",
    eligibility: { organization_types: ["pesquisador", "ict", "universidade", "ict_privada", "empresa", "osc", "outros"], geography: ["BR"] },
  });
  const payload: PayloadV2 = { ...FIXTURE, version: "2.2", opportunities: [...FIXTURE.opportunities, bolsa] };
  const empresa = montarCatalogo(payload, { tipo: "empresa", uf: "PB", temas: [] }, ANTES);
  assert.deepEqual(empresa.comoVinculo.map((j) => j.id), ["cnpq-33-2026"]);
  assert.equal(empresa.comoVinculo[0].papel, "vinculo");
  assert.ok(!empresa.janelas.some((j) => j.id === "cnpq-33-2026"), "fora da lista principal");
  assert.equal(empresa.paraEntidade?.comoVinculo, 1);
  assert.equal(reconciliar(empresa)?.fecha, true);
  // A cnpq-24-2026 do fixture também é bolsa com pesquisador: lida como 2.2, a universidade é o vínculo dela.
  const universidade = montarCatalogo(payload, { tipo: "universidade", uf: "PB", temas: [] }, ANTES);
  assert.deepEqual(universidade.comoVinculo.map((j) => j.id).sort(), ["cnpq-24-2026", "cnpq-33-2026"]);

  const pesquisador = montarCatalogo(payload, { tipo: "pesquisador", uf: "PB", temas: [] }, ANTES);
  assert.ok(pesquisador.janelas.some((j) => j.id === "cnpq-33-2026"));
  assert.deepEqual(pesquisador.comoVinculo, []);

  // O mesmo arquivo como 2.0 (o fixture de 10/09): "bolsa" ainda juntava o auxílio, e nada muda.
  const antigo = montarCatalogo({ ...payload, version: "2.0" }, { tipo: "empresa", uf: "PB", temas: [] }, ANTES);
  assert.ok(antigo.janelas.some((j) => j.id === "cnpq-33-2026"));
  assert.deepEqual(antigo.comoVinculo, []);
});

const CAEM = "Atendimento de demanda judicial - Processo nº 0001844-33.2008.4.01.3300 - Município de Caem/BA";

test("A02: programa restrito a outro território sai da lista e vai para a conta 'fora do território'", () => {
  const caem = derivada("transferegov-7bb9c38d13a7-emenda", { id: "transferegov-caem-beneficiario-especifico", title: CAEM });
  const payload: PayloadV2 = { ...FIXTURE, opportunities: [...FIXTURE.opportunities, caem] };
  const pb = montarCatalogo(payload, { tipo: "municipio", uf: "PB", temas: [] }, ANTES);
  assert.ok(!pb.janelas.some((j) => j.id === caem.id));
  assert.equal(pb.paraEntidade?.foraDoTerritorio, 1);
  assert.equal(pb.paraEntidade?.foraDoTipo, 4, "a conta do tipo não muda");
  // O município baiano continua vendo (a geografia do radar diz PB, então sem pontos de território).
  const ba = montarCatalogo(payload, { tipo: "municipio", uf: "BA", temas: [] }, ANTES);
  assert.ok(ba.janelas.some((j) => j.id === caem.id));
  // E os motivos do Transferegov não afirmam território.
  const emenda = pb.janelas.find((j) => j.id === "transferegov-7bb9c38d13a7-emenda")!;
  assert.ok(emenda.aderencia?.motivos.includes("liberado para a PB no Transferegov; o território do objeto não foi verificado"));
});

test("A05: a reconciliação parte das abertas de hoje e as partes somam o todo", () => {
  const caem = derivada("transferegov-7bb9c38d13a7-emenda", { id: "transferegov-caem-beneficiario-especifico", title: CAEM });
  const beneficiario = derivada("transferegov-7bb9c38d13a7-emenda", { id: "transferegov-xyz-beneficiario-especifico", title: "Ação 00SX - RP8 - CINDRE" });
  const payload: PayloadV2 = { ...FIXTURE, opportunities: [...FIXTURE.opportunities, caem, beneficiario] };
  const c = montarCatalogo(payload, { tipo: "municipio", uf: "PB", temas: [] }, ANTES, new Map([
    ["transferegov-7bb9c38d13a7-emenda", ["2040820260007"]],
    ["transferegov-xyz-beneficiario-especifico", ["5600020260099"]],
  ]));
  const r = reconciliar(c)!;
  assert.equal(r.abertasHoje, 7, "5 do fixture + as 2 novas");
  assert.equal(r.aceitam, 2);
  assert.deepEqual(r.porCanal, [
    { canal: "emenda_parlamentar", n: 1 },
    { canal: "beneficiario_especifico", n: 1 },
  ]);
  assert.equal(r.programas, 2);
  assert.equal(r.foraDoTipo, 4);
  assert.equal(r.foraDoTerritorio, 1);
  assert.equal(r.fecha, true);

  const f = frasesDaReconciliacao(r, "município", "PB");
  assert.equal(
    f.universo,
    "2 abertas aceitam município da PB, em todas as fontes (1 de beneficiário específico só vale para o ente que o concedente indicar)",
  );
  assert.equal(
    f.conta,
    "7 abertas hoje no catálogo, sem as portas permanentes → 2 aceitam município da PB (1 de emenda, 1 de beneficiário específico; 2 programas) → fora do tipo 4, fora do território 1.",
  );
  assert.equal(reconciliar(montarCatalogo(payload, null, ANTES)), null, "sem entidade, não há o que reconciliar");
});

test("A05: emenda e voluntária do mesmo código são um programa só", () => {
  const janelas = montarCatalogo(FIXTURE, null, ANTES).janelas.slice(0, 2).map((j, i) => ({
    ...j,
    canal: i === 0 ? ("emenda_parlamentar" as const) : ("voluntaria" as const),
    codigos: ["2220320260025"],
  }));
  const r = reconciliar({ janelas, universo: { monitoradas: 2, abertasHoje: 2 }, paraEntidade: { elegiveis: 2, urgentes: 0, foraDoTipo: 0, comoParceira: 0, comoVinculo: 0, foraDoTerritorio: 0 } })!;
  assert.equal(r.programas, 1);
  assert.equal(frasesDaReconciliacao(r, "estado", null).universo, "2 abertas aceitam estado, em todas as fontes");
});

test("A05: no catálogo de verdade, a conta fecha para todo tipo de agente", () => {
  const dados = path.join(import.meta.dirname, "..", "..", "dados", "oportunidades-v2.json");
  const v2 = JSON.parse(fs.readFileSync(dados, "utf-8")) as PayloadV2;
  const hoje = v2.generated_at.slice(0, 10);
  for (const { id } of AGENTES) {
    const r = reconciliar(montarCatalogo(v2, { tipo: id, uf: "PB", temas: [] }, hoje));
    assert.equal(r?.fecha, true, id);
  }
});

test("A11: a busca, a fonte e o assunto valem para todas as seções; nas portas o canal não vale", () => {
  const janela = montarCatalogo(FIXTURE, null, ANTES).janelas.find((j) => j.id === "finep-749717")!;
  const porta = { ...janela, id: "porta", titulo: "BNDES Fundo Socioambiental", financiador: "BNDES", fonteId: "bndes", canal: "fluxo_continuo" as const };
  const parceira = { ...janela, id: "parceira", titulo: "Chamada MAI/DAI", financiador: "CNPq", fonteId: "cnpq" };
  const vista = { janelas: [janela], comoParceira: [parceira], comoVinculo: [], portas: [porta] };

  const busca = filtrarVista(vista, { ...SEM_FILTRO, busca: "mai/dai" });
  assert.deepEqual(busca.comoParceira.map((j) => j.id), ["parceira"]);
  assert.deepEqual(busca.janelas, []);
  assert.deepEqual(busca.portas, []);

  const canal = filtrarVista(vista, { ...SEM_FILTRO, canais: ["chamada_publica"] });
  assert.deepEqual(canal.portas.map((j) => j.id), ["porta"], "o canal esconderia toda porta");
  const fonte = filtrarVista(vista, { ...SEM_FILTRO, fontes: ["cnpq"] });
  assert.deepEqual([fonte.janelas.length, fonte.comoParceira.length, fonte.portas.length], [0, 1, 0]);
});

test("A11: a busca acha a janela pelo código do programa", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES, new Map([["transferegov-7bb9c38d13a7-emenda", ["2040820260007"]]]));
  assert.deepEqual(filtrarJanelas(c.janelas, { ...SEM_FILTRO, busca: "2040820260007" }).map((j) => j.id), ["transferegov-7bb9c38d13a7-emenda"]);
});

test("A11: o link principal é a página do item fora do Transferegov; os documentos ficam como secundários", () => {
  const c = montarCatalogo(FIXTURE, null, ANTES);
  const finep = c.janelas.find((j) => j.id === "finep-749717")!;
  assert.equal(paginaDoItem(finep), "https://www.finep.gov.br/e/chamada-publica/222684/749717");
  assert.deepEqual(documentosSecundarios(finep).map((d) => d.titulo), ["aqui"]);
  // A página não se repete entre os documentos.
  const comPagina = { ...finep, documentos: [{ titulo: "Página da chamada", url: finep.fonteUrl }, ...finep.documentos] };
  assert.equal(documentosSecundarios(comPagina).length, 1);
  // No Transferegov, `source.url` é o módulo inteiro.
  const tg = c.janelas.find((j) => j.fonteId === "transferegov")!;
  assert.equal(paginaDoItem(tg), null);
  assert.deepEqual(documentosSecundarios(tg), []);
  assert.equal(paginaDoItem({ ...finep, fonteId: "transferegov-parcerias" }), null);
  // Endereço que é só a página geral da fonte não vira "Ver edital".
  const geral = montarCatalogo(
    { ...FIXTURE, opportunities: [derivada("finep-749717", { id: "finep-geral", source: { ...porIdDoFixture("finep-749717").source, url: "https://www.finep.gov.br/oportunidades" } })] },
    null,
    ANTES,
  ).janelas[0];
  assert.equal(geral.fontePaginaPropria, false);
  assert.equal(paginaDoItem(geral), null);
});
