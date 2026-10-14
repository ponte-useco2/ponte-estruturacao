/**
 * Contrato 2.2 do catálogo (14/10/2026): portas de fluxo contínuo, quem entra só
 * como parceira e as encerradas dos últimos 24 meses.
 *
 * Casos montados à mão, no formato que o radar passa a emitir (ver
 * `tests/test_contrato_22.py` no jn-portal-oportunidades).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { montarCatalogo } from "./catalogo-v2.ts";
import { DIAS_HISTORICO, ehAberta, ehFluxoContinuo, encerradaRecente, type OportunidadeV2, type PayloadV2 } from "./contrato-v2.ts";
import { avaliar, janelaDoV2 } from "./elegibilidade.ts";

const HOJE = "2026-10-14";

function op(over: Partial<OportunidadeV2> & { id: string }): OportunidadeV2 {
  return {
    source: { id: "cnpq", name: "CNPq", official: true, url: "https://www.gov.br/cnpq/", checked_at: `${HOJE}T12:00:00Z`, stale: false },
    external_id: over.id,
    title: `Oportunidade ${over.id}`,
    description: null,
    funder: "CNPq",
    instrument: { type: "outros", repayable: false },
    channel: "chamada_publica",
    status: "open",
    dates: { published: null, deadline: "2026-12-11" },
    eligibility: { organization_types: ["ict", "universidade"], geography: ["BR"] },
    themes: ["saude"],
    funding: { program_budget: null },
    documents: [],
    changes: [],
    change_status: "unchanged",
    matching: null,
    ...over,
  };
}

function payload(opportunities: OportunidadeV2[]): PayloadV2 {
  return {
    version: "2.2",
    change_mode: "incremental",
    generated_at: `${HOJE}T12:00:00Z`,
    sources: [],
    summary: { monitored: opportunities.length, open: 0, urgent: 0, new: 0, changed: 0, closed: 0, unchanged: 0, priority_a: 0, stale_sources: 0 },
    opportunities,
  };
}

const MAI_DAI = op({
  id: "cnpq-30-2026",
  eligibility: { organization_types: ["ict", "ict_privada", "universidade"], geography: ["BR"], partner_types: ["empresa"] },
  partners: ["CAPES"],
});
const PORTA = op({
  id: "embrapii-modelo",
  channel: "fluxo_continuo",
  dates: { published: null, deadline: null },
  description: "A empresa contrata um projeto com uma Unidade EMBRAPII.",
  eligibility: { organization_types: ["empresa", "startup"], geography: ["BR"] },
});
const TERAPIAS = op({
  id: "cnpq-30-2025",
  status: "closed",
  dates: { published: "2025-12-31", deadline: "2026-02-23", closed: "2026-02-23" },
  eligibility: { organization_types: ["ict", "ict_privada", "osc", "pesquisador"], geography: ["BR"], partner_types: ["empresa", "hospital"] },
  partners: ["Decit/MS"],
});
const ANTIGA = op({ id: "cnpq-9-2023", status: "closed", dates: { published: null, deadline: "2023-05-10" } });
// Encerrada que a fonte publica sem prazo (a página de resultados do CNPq traz muitas).
const SEM_DATA = op({ id: "cnpq-eventos-2025", status: "closed", dates: { published: "2025-03-01", deadline: null } });
// Ficou `open` no arquivo, mas o prazo passou: pela regra 5 já está encerrada.
const VENCIDA = op({ id: "finep-x", dates: { published: null, deadline: "2026-09-18" } });

test("a porta de fluxo contínuo é aberta pela regra 5, mas não é janela", () => {
  assert.ok(ehAberta(PORTA, HOJE));
  assert.ok(ehFluxoContinuo(PORTA));
  assert.ok(!ehFluxoContinuo(MAI_DAI));
  assert.equal(encerradaRecente(PORTA, HOJE), null);
});

test("encerrada recente: pela data de encerramento, pelo prazo, e nunca além dos 24 meses", () => {
  assert.deepEqual(encerradaRecente(TERAPIAS, HOJE), { em: "2026-02-23" });
  assert.deepEqual(encerradaRecente(VENCIDA, HOJE), { em: "2026-09-18" });
  assert.equal(encerradaRecente(ANTIGA, HOJE), null);
  // Sem prazo nem data de encerramento: entra, sem inventar data.
  assert.deepEqual(encerradaRecente(SEM_DATA, HOJE), { em: null });
  assert.equal(encerradaRecente(MAI_DAI, HOJE), null, "aberta não é encerrada");
  assert.equal(DIAS_HISTORICO, 730);
});

test("a empresa entra como PARCEIRA onde o edital diz, sem virar elegível nem ganhar pontos", () => {
  const a = avaliar(janelaDoV2(MAI_DAI), { tipo: "empresa", uf: "PB", temas: ["saude"] });
  assert.equal(a.elegivel, false);
  assert.equal(a.papel, "parceira");
  assert.equal(a.pontuacao, 0);
  assert.deepEqual(a.motivos, ["entra como parceira, não como proponente"]);

  const ict = avaliar(janelaDoV2(MAI_DAI), { tipo: "ict_privada", uf: "PB", temas: [] });
  assert.equal(ict.elegivel, true);
  assert.equal(ict.papel, "proponente");

  const municipio = avaliar(janelaDoV2(MAI_DAI), { tipo: "municipio", uf: "PB", temas: [] });
  assert.equal(municipio.papel, null);
});

test("o catálogo separa janelas, parceira, portas e encerradas — e a porta não entra na conta das abertas", () => {
  const p = payload([MAI_DAI, PORTA, TERAPIAS, ANTIGA, VENCIDA, SEM_DATA]);

  const todos = montarCatalogo(p, null, HOJE);
  assert.deepEqual(todos.janelas.map((j) => j.id), ["cnpq-30-2026"]);
  assert.equal(todos.universo.abertasHoje, 1);
  assert.deepEqual(todos.portas.map((j) => j.id), ["embrapii-modelo"]);
  assert.equal(todos.portas[0].descricao, "A empresa contrata um projeto com uma Unidade EMBRAPII.");
  assert.deepEqual(
    todos.encerradas.map((j) => j.id),
    ["finep-x", "cnpq-30-2025", "cnpq-eventos-2025"],
    "a mais recente primeiro, a sem data no fim",
  );
  assert.deepEqual(todos.encerradas.map((j) => j.encerradaEm), ["2026-09-18", "2026-02-23", null]);
  assert.deepEqual(todos.comoParceira, []);

  const empresa = montarCatalogo(p, { tipo: "empresa", uf: "PB", temas: [] }, HOJE);
  assert.deepEqual(empresa.janelas, []);
  assert.deepEqual(empresa.comoParceira.map((j) => j.id), ["cnpq-30-2026"]);
  assert.equal(empresa.comoParceira[0].papel, "parceira");
  assert.deepEqual(empresa.comoParceira[0].parceiros, ["CAPES"]);
  assert.equal(empresa.paraEntidade?.comoParceira, 1);
  assert.equal(empresa.paraEntidade?.foraDoTipo, 0, "parceira não conta como fora do tipo");
  assert.deepEqual(empresa.portas.map((j) => j.id), ["embrapii-modelo"]);
  assert.deepEqual(empresa.encerradas.map((j) => [j.id, j.papel]), [["cnpq-30-2025", "parceira"]]);

  const hospital = montarCatalogo(p, { tipo: "hospital", uf: "PB", temas: [] }, HOJE);
  assert.deepEqual(hospital.portas, [], "a porta da EMBRAPII é para empresa");
  assert.deepEqual(hospital.encerradas.map((j) => j.id), ["cnpq-30-2025"], "a de eventos é para ICT e universidade");
});
