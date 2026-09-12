/**
 * Os eixos da janela precisam chegar até a mudança gravada: é contra eles que a
 * aderência é calculada na leitura, quando a janela pode já ter saído do
 * catálogo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDiff, type EstadoProcessado } from "./diff.ts";
import { combina } from "./aderencia.ts";
import type { Oportunidade, Payload } from "./contrato";

function janela(codigo: string, extra: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: `id-${codigo}`,
    programa: `Programa ${codigo}`,
    orgao: "Ministério do Turismo",
    natureza: "Administração Pública Municipal",
    canal: "proposta",
    situacao: "DISPONIBILIZADO",
    fecha: "2026-09-30",
    dias_restantes: 20,
    urgente: false,
    nova: false,
    aderente: false,
    temas: ["turismo"],
    codigos: [codigo],
    propostas_recebidas: 0,
    ...extra,
  };
}

function publicacao(gerado_em: string, oportunidades: Oportunidade[]): Payload {
  return {
    versao: "1.1",
    gerado_em,
    uf: "PB",
    origem: { repositorio: "", modulo: "", atualizada_em: null, defasagem_dias: null, defasada: false },
    resumo: { abertas: oportunidades.length, urgentes: 0, aderentes: 0, novas: 0, propostas_recentes: 0, encerradas: 0 },
    filtros: { naturezas: [], canais: [], orgaos: [] },
    oportunidades,
    propostas_recentes: [],
    encerradas: [],
  };
}

test("os eixos da janela viajam na mudança", () => {
  const antes = calcularDiff(null, publicacao("2026-09-10T00:00:00", [janela("1")])).proximoEstado;
  const r = calcularDiff(antes, publicacao("2026-09-11T00:00:00", [janela("1"), janela("2")]));

  assert.deepEqual(
    r.mudancas.map((m) => m.tipo),
    ["nova"],
  );
  const m = r.mudancas[0];
  assert.deepEqual(m.temas, ["turismo"]);
  assert.equal(m.natureza, "Administração Pública Municipal");
  assert.equal(m.canal, "proposta");
  assert.ok(combina(m, { temas: ["turismo"], orgaos: [], naturezas: [] }), "deveria combinar por tema");
});

test("janela que saiu leva os eixos que estavam no estado", () => {
  const antes = calcularDiff(null, publicacao("2026-09-10T00:00:00", [janela("1"), janela("2")])).proximoEstado;
  const r = calcularDiff(antes, publicacao("2026-09-11T00:00:00", [janela("1")]));

  const saida = r.mudancas.find((m) => m.tipo === "encerrada" || m.tipo === "removida");
  assert.ok(saida, "a janela que saiu deveria virar mudança");
  assert.deepEqual(saida.temas, ["turismo"]);
  assert.equal(saida.canal, "proposta");
});

test("estado gravado antes dos eixos ainda entrega canal e natureza", () => {
  // O estado de produção anterior a 12/09/2026 não tem temas, natureza nem
  // canal. A chave é `canal|natureza|códigos`, e é de lá que eles voltam.
  const chave = "emenda|Consórcio Público|9001";
  const antigo: EstadoProcessado = {
    gerado_em: "2026-09-10T00:00:00",
    abertas: {
      [chave]: {
        programa: "Programa antigo",
        orgao: "Ministério da Integração",
        fecha: "2026-09-30",
        dias_restantes: 20,
        situacao: "DISPONIBILIZADO",
      },
    },
    saidas: [],
  };

  const r = calcularDiff(antigo, publicacao("2026-09-11T00:00:00", []));
  const saida = r.mudancas[0];

  assert.equal(saida.tipo, "removida");
  assert.equal(saida.canal, "emenda");
  assert.equal(saida.natureza, "Consórcio Público");
  assert.deepEqual(saida.temas, []);
});
