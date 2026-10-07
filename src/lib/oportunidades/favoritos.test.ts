import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { PayloadV2 } from "./contrato-v2.ts";
import {
  abertasParaAvisos,
  chaveValida,
  filtrarAvisos,
  fraseDoAviso,
  retratoDaJanela,
  somaNaoLidos,
  urlDoItem,
} from "./favoritos.ts";

/** As sete oportunidades reais de 10/09/2026 dos testes do contrato e do catálogo. */
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "v2-amostra.json"), "utf-8"),
) as PayloadV2;

test("chave: as mesmas regras da tabela", () => {
  assert.ok(chaveValida("instrumento", "956541"));
  assert.ok(chaveValida("instrumento", "7AAAAA"), "há número de convênio com letra");
  assert.ok(!chaveValida("instrumento", "95 6541"));
  assert.ok(chaveValida("proposta", "2241841"));
  assert.ok(!chaveValida("proposta", "34797/2026"), "proposta é pelo id, não pelo número com barra");
  assert.ok(chaveValida("janela", "transferegov-0429be615502-beneficiario-especifico"));
  assert.ok(!chaveValida("janela", "x/../y"));
  assert.ok(!chaveValida("programa", "123"));
  assert.ok(!chaveValida("janela", 123));
  assert.ok(chaveValida("municipio", "2510808"), "município é o IBGE de 7 dígitos");
  assert.ok(!chaveValida("municipio", "251080"));
  assert.ok(!chaveValida("municipio", "25108O8"));
});

test("url do item: convênio e proposta têm página; janela é âncora no catálogo", () => {
  assert.equal(urlDoItem("instrumento", "7AAAAA"), "/mapa/instrumento/7AAAAA");
  assert.equal(urlDoItem("proposta", "2241841"), "/mapa/proposta/2241841");
  assert.equal(urlDoItem("janela", "cnpq-24-2026"), "/mapa#janela-cnpq-24-2026");
  assert.equal(urlDoItem("municipio", "2510808"), "/mapa/municipio/2510808", "a página com abas, para todo aprovado");
});

test("frases do município: contagens, decisão fiscal, CAUC e pessoal em português", () => {
  const f = (evento: string, antes: string | null, depois: string | null) => fraseDoAviso({ tipo: "municipio", evento, antes, depois });
  assert.deepEqual(f("contas_atrasadas", "1", "2"), { rotulo: "Prestações de contas atrasadas", detalhe: "1 → 2" });
  assert.deepEqual(f("tce_tcu", null, "2"), { rotulo: "Tomadas de Contas Especiais no TCU", detalhe: "0 → 2" });
  assert.deepEqual(f("fiscal_b", "nao_atendido", "atencao"), { rotulo: "Painel fiscal: receber transferência voluntária", detalhe: "não atendido → atenção" });
  assert.deepEqual(f("fiscal_a", "atendido", null), { rotulo: "Painel fiscal: declarações fiscais em dia", detalhe: "atendido → sem dado" });
  assert.deepEqual(f("cauc", "", "1.5, 3.2.3"), { rotulo: "Pendências no CAUC", detalhe: "nenhuma → 1.5, 3.2.3" });
  assert.deepEqual(f("pessoal_pct", "53.9", "54.54"), { rotulo: "Despesa com pessoal (% da RCL ajustada)", detalhe: "53,90% → 54,54%" });
  assert.deepEqual(f("pix_vez_ente", "0", "1"), { rotulo: "Pix: planos à espera do município no ciclo", detalhe: "0 → 1" });
  assert.deepEqual(f("pix_prazo_ente", null, "2027-05-10"), { rotulo: "Pix: prazo da etapa do município", detalhe: "sem prazo → 10/05/2027" });
});

test("janelas abertas para a geração: só as abertas no dia, com prazo sem hora", () => {
  const antes = abertasParaAvisos(FIXTURE, "2026-09-09");
  assert.equal(Object.keys(antes).length, 5, "as mesmas 5 abertas do catálogo");
  const depois = abertasParaAvisos(FIXTURE, "2026-09-12");
  assert.deepEqual(Object.keys(depois), ["cnpq-24-2026"]);
  assert.match(depois["cnpq-24-2026"].prazo ?? "", /^\d{4}-\d{2}-\d{2}$/);
});

test("retrato da janela ao seguir: aberta e prazo; id desconhecido não segue", () => {
  const r = retratoDaJanela(FIXTURE, "cnpq-24-2026", "2026-09-12");
  assert.equal(r?.estado.aberta, true);
  assert.equal(retratoDaJanela(FIXTURE, "cnpq-24-2026", "2026-12-31")?.estado.aberta, false);
  assert.equal(retratoDaJanela(FIXTURE, "nao-existe", "2026-09-12"), null);
});

test("frases: desembolso diz quanto entrou, e não só o total", () => {
  const f = fraseDoAviso({ tipo: "instrumento", evento: "vl_desembolsado", antes: "0", depois: "400000.00" });
  assert.equal(f.rotulo, "Novo desembolso");
  assert.equal(f.detalhe, "R$ 400 mil a mais · total de R$ 0 para R$ 400 mil");
  assert.equal(fraseDoAviso({ tipo: "instrumento", evento: "vl_desembolsado", antes: "500", depois: "100" }).rotulo,
    "O total desembolsado mudou");
});

test("frases: datas, percentuais e desfecho em português", () => {
  assert.equal(fraseDoAviso({ tipo: "instrumento", evento: "dt_fim_vigencia", antes: "2025-08-17", depois: "2026-02-17" }).detalhe,
    "até 17/08/2025 → até 17/02/2026");
  assert.equal(fraseDoAviso({ tipo: "instrumento", evento: "pct_fisico", antes: "0.375", depois: "0.5" }).detalhe, "38% → 50%");
  assert.equal(fraseDoAviso({ tipo: "proposta", evento: "desfecho", antes: "aberta_concedente", depois: "assinada" }).detalhe,
    "Em análise no concedente → Assinada");
  assert.equal(fraseDoAviso({ tipo: "proposta", evento: "situacao", antes: "A", depois: "B" }).rotulo, "A proposta mudou de situação");
  assert.equal(fraseDoAviso({ tipo: "proposta", evento: "nr_convenio", antes: null, depois: "999999" }).detalhe, "convênio nº 999999");
});

test("frases das janelas: fechando conta os dias; campo desconhecido não some", () => {
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "fechando", antes: "2026-09-18", depois: "1" }).rotulo, "Falta 1 dia");
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "fechando", antes: "2026-09-18", depois: "0" }).rotulo, "Fecha hoje");
  assert.equal(fraseDoAviso({ tipo: "janela", evento: "encerrada", antes: "2026-09-18", depois: null }).detalhe, "O prazo era 18/09/2026.");
  assert.equal(fraseDoAviso({ tipo: "instrumento", evento: "campo_novo", antes: "x", depois: "y" }).detalhe, "campo_novo: x → y");
});

test("filtro das abas e soma dos não lidos", () => {
  const avisos = [
    { id: "1", lida_em: null, arquivada_em: null },
    { id: "2", lida_em: "2026-09-15", arquivada_em: null },
    { id: "3", lida_em: null, arquivada_em: "2026-09-15" },
  ];
  assert.deepEqual(filtrarAvisos(avisos, "nao_lidas").map((a) => a.id), ["1"]);
  assert.deepEqual(filtrarAvisos(avisos, "todas").map((a) => a.id), ["1", "2"]);
  assert.deepEqual(filtrarAvisos(avisos, "arquivadas").map((a) => a.id), ["3"]);
  assert.equal(somaNaoLidos(3, 2), 5);
  assert.equal(somaNaoLidos(null, 2), 2);
  assert.equal(somaNaoLidos(null, null), null);
});

test("aviso de prazo de janela que já fechou não repete a contagem velha", () => {
  const a = { tipo: "janela" as const, evento: "fechando", antes: "2026-09-18", depois: "1" };
  assert.deepEqual(fraseDoAviso(a, "2026-10-02"), { rotulo: "A janela fechou", detalhe: "O prazo era 18/09/2026; o aviso foi do dia em que faltava 1 dia." });
  assert.equal(fraseDoAviso(a, "2026-09-17").rotulo, "Falta 1 dia");
});
