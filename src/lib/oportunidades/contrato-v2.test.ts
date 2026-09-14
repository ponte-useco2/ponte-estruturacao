import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DIAS_URGENTE,
  canalDaOportunidade,
  comoPayloadV2,
  diasAte,
  ehAberta,
  fontesComProblema,
  hojeLocal,
  urgente,
  versaoSuportadaV2,
  type OportunidadeV2,
  type PayloadV2,
} from "./contrato-v2.ts";
import { avaliar, janelaDoV2 } from "./elegibilidade.ts";

/**
 * Sete oportunidades REAIS do catálogo v2 de 10/09/2026, escolhidas para cobrir
 * as bordas: uma por tipo de proponente relevante, uma `unknown` sem prazo, uma
 * `closed`. Recortadas do arquivo de 434 KB para caberem no repositório.
 */
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "v2-amostra.json"), "utf-8"),
) as PayloadV2;

const porId = (id: string): OportunidadeV2 => {
  const o = FIXTURE.opportunities.find((x) => x.id === id);
  assert.ok(o, `fixture sem ${id}`);
  return o;
};

// =============================================================================
// Versão e guarda estrutural
// =============================================================================

test("aceita 2.x e recusa qualquer outra major", () => {
  assert.ok(versaoSuportadaV2("2.0"));
  assert.ok(versaoSuportadaV2("2.7"));
  assert.ok(!versaoSuportadaV2("1.1"), "o v1.1 tem outro contrato");
  assert.ok(!versaoSuportadaV2("3.0"));
  assert.ok(!versaoSuportadaV2(undefined));
  assert.ok(!versaoSuportadaV2(""));
});

test("o fixture real passa pela guarda estrutural", () => {
  assert.ok(comoPayloadV2(FIXTURE));
});

test("arquivo truncado ou de outra versão vira null, não exceção", () => {
  assert.equal(comoPayloadV2(null), null);
  assert.equal(comoPayloadV2("texto"), null);
  assert.equal(comoPayloadV2({ ...FIXTURE, version: "1.1" }), null);
  assert.equal(comoPayloadV2({ ...FIXTURE, opportunities: undefined }), null);
  assert.equal(comoPayloadV2({ ...FIXTURE, sources: "x" }), null);
  assert.equal(comoPayloadV2({ ...FIXTURE, summary: null }), null);
});

// =============================================================================
// Data local — o defeito que a /carteira já tinha documentado
// =============================================================================

test("de madrugada em UTC ainda é o dia anterior na Paraíba", () => {
  // 02:30 UTC de 12/09 são 23:30 de 11/09 em Recife. Contar em UTC daria 12.
  assert.equal(hojeLocal(new Date("2026-09-12T02:30:00Z")), "2026-09-11");
  assert.equal(hojeLocal(new Date("2026-09-12T03:00:00Z")), "2026-09-12");
  assert.equal(hojeLocal(new Date("2026-09-12T15:00:00Z")), "2026-09-12");
});

test("diasAte conta dias inteiros de calendário", () => {
  assert.equal(diasAte("2026-09-12", "2026-09-12"), 0);
  assert.equal(diasAte("2026-09-13", "2026-09-12"), 1);
  assert.equal(diasAte("2026-09-11", "2026-09-12"), -1);
  assert.equal(diasAte("2026-10-01", "2026-09-30"), 1, "vira o mês");
  assert.equal(diasAte("2027-01-01", "2026-12-31"), 1, "vira o ano");
  assert.equal(diasAte(null, "2026-09-12"), null, "o schema permite prazo nulo");
  assert.equal(diasAte("não é data", "2026-09-12"), null);
});

// =============================================================================
// Regra 5 — o que conta como aberta
// =============================================================================

test("status open com prazo JÁ VENCIDO não é aberta", () => {
  // O caso real: gerado em 10/09, prazo em 10/09, lido em 12/09.
  const o = porId("transferegov-903a9f369f75-proposta");
  assert.equal(o.status, "open", "no arquivo, está open");
  assert.equal(o.dates.deadline, "2026-09-10");
  assert.equal(ehAberta(o, "2026-09-12"), false, "mas o prazo passou");
  assert.equal(ehAberta(o, "2026-09-10"), true, "no dia do prazo ainda está aberta");
});

test("unknown e closed nunca são abertas", () => {
  assert.equal(ehAberta(porId("fapesq-58-2026"), "2026-09-01"), false, "unknown");
  assert.equal(ehAberta(porId("finep-1019381"), "2026-09-01"), false, "closed");
});

test("open sem prazo vale o status: sem data não há como afirmar que venceu", () => {
  const o: Pick<OportunidadeV2, "status" | "dates"> = {
    status: "open",
    dates: { published: null, deadline: null },
  };
  assert.equal(ehAberta(o, "2026-09-12"), true);
});

// =============================================================================
// Urgência — o mesmo corte do radar
// =============================================================================

test("o corte de urgência é o do radar: 15 dias", () => {
  assert.equal(DIAS_URGENTE, 15, "pipeline.py usa <= 15");
  const com = (deadline: string): Pick<OportunidadeV2, "status" | "dates"> => ({
    status: "open",
    dates: { published: null, deadline },
  });
  assert.ok(urgente(com("2026-09-12"), "2026-09-12"), "fecha hoje");
  assert.ok(urgente(com("2026-09-27"), "2026-09-12"), "15 dias: ainda urgente");
  assert.ok(!urgente(com("2026-09-28"), "2026-09-12"), "16 dias: não");
  assert.ok(!urgente(com("2026-09-11"), "2026-09-12"), "vencida não é urgente, é vencida");
});

test("fechada nunca é urgente, por mais perto que esteja o prazo", () => {
  assert.ok(!urgente(porId("finep-1019381"), "2026-09-08"));
});

// =============================================================================
// Regra 1 — fontes com problema
// =============================================================================

test("fonte saudável não gera aviso; fonte com falha gera", () => {
  assert.equal(fontesComProblema(FIXTURE).length, 0, "as quatro estavam healthy em 10/09");

  const quebrado = {
    sources: FIXTURE.sources.map((s) => (s.id === "finep" ? { ...s, status: "error" as const } : s)),
  };
  const problema = fontesComProblema(quebrado);
  assert.equal(problema.length, 1);
  assert.equal(problema[0].id, "finep");
});

// =============================================================================
// De ponta a ponta: a mesma janela, entidades diferentes
// =============================================================================

test("cada tipo de agente enxerga a sua fatia do mesmo catálogo", () => {
  const hoje = "2026-09-09"; // antes de qualquer prazo do fixture vencer
  const quantasPara = (tipo: Parameters<typeof avaliar>[1]["tipo"]) =>
    FIXTURE.opportunities.filter(
      (o) => ehAberta(o, hoje) && avaliar(janelaDoV2(o), { tipo, uf: "PB", temas: [] }).elegivel,
    ).map((o) => o.id);

  assert.deepEqual(quantasPara("municipio"), ["transferegov-7bb9c38d13a7-emenda"]);
  assert.deepEqual(quantasPara("osc"), ["transferegov-9772f02b3bb4-emenda"]);
  assert.deepEqual(quantasPara("estado"), ["transferegov-903a9f369f75-proposta"]);
  assert.deepEqual(quantasPara("empresa"), ["finep-749717"], "a fapesq unknown e a finep closed ficam de fora");
  assert.deepEqual(quantasPara("universidade"), ["cnpq-24-2026"]);
  assert.deepEqual(quantasPara("cooperativa"), [], "nenhuma das sete aceita cooperativa");
});

test("a vertical de inovação do CNPq alcança quem segue Inovação", () => {
  const o = porId("cnpq-24-2026");
  const j = janelaDoV2(o);
  assert.ok(j.temas.includes("inovacao"), "os temas crus foram normalizados");
  const a = avaliar(j, { tipo: "ict", uf: "PB", temas: ["inovacao"] });
  // 40 elegibilidade + 20 abrangência nacional (BR) + 15 um tema = 75
  assert.equal(a.pontuacao, 75);
});

// =============================================================================
// Canal — campo do 2.1, com a regra de transição para arquivos 2.0
// =============================================================================

test("arquivo 2.0: o canal do Transferegov sai do sufixo do id", () => {
  // O fixture é do catálogo de 10/09/2026, ainda sem o campo `channel`.
  assert.equal(porId("transferegov-903a9f369f75-proposta").channel, undefined);
  assert.equal(canalDaOportunidade(porId("transferegov-903a9f369f75-proposta")), "voluntaria");
  assert.equal(canalDaOportunidade(porId("transferegov-7bb9c38d13a7-emenda")), "emenda_parlamentar");
});

test("arquivo 2.0: as outras fontes são chamada pública", () => {
  assert.equal(canalDaOportunidade(porId("finep-749717")), "chamada_publica");
  assert.equal(canalDaOportunidade(porId("cnpq-24-2026")), "chamada_publica");
});

test("arquivo 2.1: o campo manda, e o sufixo do id é ignorado", () => {
  const o = { ...porId("transferegov-903a9f369f75-proposta"), channel: "beneficiario_especifico" as const };
  assert.equal(canalDaOportunidade(o), "beneficiario_especifico");
});

test("arquivo 2.1 com canal nulo não é adivinhado pelo id", () => {
  const o = { ...porId("transferegov-7bb9c38d13a7-emenda"), channel: null };
  assert.equal(canalDaOportunidade(o), null);
});

test("sufixo desconhecido devolve null em vez de chutar", () => {
  const o = { ...porId("transferegov-903a9f369f75-proposta"), id: "transferegov-abc-outra-coisa" };
  assert.equal(canalDaOportunidade(o), null);
});

test("arquivo 2.0: sufixo de beneficiário específico em forma de slug", () => {
  // O radar gera `transferegov-<hash>-beneficiario-especifico`, com hífen.
  const o = { ...porId("transferegov-903a9f369f75-proposta"), id: "transferegov-171dee925082-beneficiario-especifico" };
  assert.equal(canalDaOportunidade(o), "beneficiario_especifico");
});
