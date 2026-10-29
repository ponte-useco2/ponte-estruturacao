import test from "node:test";
import assert from "node:assert/strict";
import { lerFalhaRodada, montarAlertaFalha, montarSaudeDiaria } from "./alerta-rodadas.ts";
import type { RodadaNoResumo } from "./resumo-diario.ts";

const BASE = "https://ponteprojetos.com.br";
const RUN = "https://github.com/siteponte/ponte-oportunidades/actions/runs/40852519112";

test("lerFalhaRodada aceita o corpo do passo do workflow", () => {
  const f = lerFalhaRodada({ workflow: "Radar de propostas", job: "radar", execucao: RUN, evento: "schedule" });
  assert.deepEqual(f, { workflow: "Radar de propostas", job: "radar", execucao: RUN, evento: "schedule" });
  assert.equal(lerFalhaRodada({ workflow: "Fiscal", job: "fiscal", execucao: `${RUN}/attempts/2` })?.evento, "não informado");
});

test("lerFalhaRodada recusa link de fora do repositório e nome com marcação", () => {
  assert.equal(lerFalhaRodada({ workflow: "X", job: "x", execucao: "https://github.com/outro/repo/actions/runs/1" }), null);
  assert.equal(lerFalhaRodada({ workflow: "X", job: "x", execucao: `${RUN}?x=<script>` }), null);
  assert.equal(lerFalhaRodada({ workflow: "<b>X</b>", job: "x", execucao: RUN }), null);
  assert.equal(lerFalhaRodada({ workflow: "x".repeat(81), job: "x", execucao: RUN }), null);
  assert.equal(lerFalhaRodada({ job: "x", execucao: RUN }), null);
  assert.equal(lerFalhaRodada(null), null);
  assert.equal(lerFalhaRodada("texto"), null);
});

test("o e-mail da falha leva o workflow, o link da execução e o da tela", () => {
  const f = lerFalhaRodada({ workflow: "Pix e fundo a fundo", job: "pix", execucao: RUN, evento: "schedule" });
  assert.ok(f);
  const e = montarAlertaFalha(f, "29/10/2026 às 08:12", BASE);
  assert.equal(e.assunto, "[PONTE] Rodada com falha · Pix e fundo a fundo");
  assert.match(e.texto, /29\/10\/2026 às 08:12/);
  assert.match(e.texto, new RegExp(RUN));
  assert.match(e.html, /\/mapa\/painel\/rodadas/);
});

const linha = (nome: string, estado: RodadaNoResumo["estado"]): RodadaNoResumo => ({
  job: { id: nome.toLowerCase(), nome },
  estado,
  concluidaEm: "2026-10-27T12:00:00Z",
  idadeH: 50,
});

test("a saúde diária sai também em dia, e diz quando a leitura falhou", () => {
  const emDia = montarSaudeDiaria({ tipo: "em_dia", total: 15, naoLidas: [] }, "29/10/2026", BASE);
  assert.equal(emDia.assunto, "[PONTE] Rodadas em 29/10/2026: em dia");
  assert.match(emDia.texto, /As 15 rodadas em dia\./);
  const falhou = montarSaudeDiaria({ tipo: "falhou" }, "29/10/2026", BASE);
  assert.match(falhou.assunto, /leitura falhou/);
  const naoLida = montarSaudeDiaria({ tipo: "em_dia", total: 15, naoLidas: ["Exigências"] }, "29/10/2026", BASE);
  assert.match(naoLida.assunto, /não lida/);
});

test("a saúde diária com problema lista cada rodada no assunto e no corpo", () => {
  const e = montarSaudeDiaria(
    { tipo: "com_problema", total: 15, problemas: [linha("Pix e fundo a fundo", "atrasada"), linha("OSC", "com_aviso")], naoLidas: [] },
    "29/10/2026",
    BASE,
  );
  assert.equal(e.assunto, "[PONTE] Rodadas em 29/10/2026: 2 de 15 rodadas pedem atenção");
  assert.match(e.texto, /Pix e fundo a fundo: /);
  assert.match(e.html, /<li>.*OSC/);
});
