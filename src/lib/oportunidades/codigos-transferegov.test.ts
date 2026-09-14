import { test } from "node:test";
import assert from "node:assert/strict";
import { codigosPorJanela, identidadeJanela } from "./codigos-transferegov.ts";
import type { Oportunidade } from "./contrato";
import type { OportunidadeV2, PayloadV2 } from "./contrato-v2";

function janelaV1(extra: Partial<Oportunidade>): Oportunidade {
  return {
    id: "000000000000",
    programa: "Programa",
    orgao: "Ministério",
    natureza: "Administração Pública Municipal",
    canal: "emenda",
    situacao: "DISPONIBILIZADO",
    fecha: "2026-09-30",
    dias_restantes: 20,
    urgente: false,
    nova: false,
    aderente: false,
    temas: [],
    codigos: [],
    propostas_recebidas: 0,
    ...extra,
  };
}

function janelaV2(fonte: string, externalId: string): OportunidadeV2 {
  return {
    id: `${fonte}-${externalId}`,
    source: { id: fonte, name: fonte, official: true, url: null, checked_at: null, stale: false },
    external_id: externalId,
  } as unknown as OportunidadeV2;
}

function v2(...opportunities: OportunidadeV2[]): Pick<PayloadV2, "opportunities"> {
  return { opportunities };
}

test("a identidade é a mesma do radar — valores calculados com `identidade_janela` do Python", () => {
  // funding_intelligence/adapters/transferegov.py, branch feat/canal-da-janela.
  // Se divergir, os cartões perdem o código no dia em que o PR do radar entrar.
  assert.equal(
    identidadeJanela({ canal: "emenda", natureza: "Administração Pública Municipal", codigos: ["2040820260007"] }),
    "388990574130",
  );
  assert.equal(
    identidadeJanela({
      canal: "proposta",
      natureza: "Organização da Sociedade Civil",
      codigos: ["5300020260036", "5300020260001"],
    }),
    "64a2edf14e81",
    "códigos fora de ordem dão a mesma identidade",
  );
});

test("casa pelo id do v1 — o external_id do v2 publicado hoje", () => {
  const v1 = { oportunidades: [janelaV1({ id: "83ffd6d43780", codigos: ["2040820260007"] })] };
  const m = codigosPorJanela(v2(janelaV2("transferegov", "83ffd6d43780-emenda")), v1);
  assert.deepEqual(m.get("transferegov-83ffd6d43780-emenda"), ["2040820260007"]);
});

test("casa pela identidade nova — o external_id depois do PR do radar", () => {
  const item = janelaV1({ id: "83ffd6d43780", codigos: ["2040820260007"] });
  const nova = identidadeJanela(item);
  assert.notEqual(nova, item.id, "as duas identidades são diferentes de verdade");
  const m = codigosPorJanela(v2(janelaV2("transferegov", `${nova}-emenda`)), { oportunidades: [item] });
  assert.deepEqual(m.get(`transferegov-${nova}-emenda`), ["2040820260007"]);
});

test("canal com hífen no sufixo não atrapalha", () => {
  const item = janelaV1({ id: "aaaaaaaaaaaa", canal: "beneficiario_especifico", codigos: ["1"] });
  const m = codigosPorJanela(v2(janelaV2("transferegov", "aaaaaaaaaaaa-beneficiario-especifico")), { oportunidades: [item] });
  assert.deepEqual(m.get("transferegov-aaaaaaaaaaaa-beneficiario-especifico"), ["1"]);
});

test("dois códigos chegam os dois, na ordem do v1", () => {
  const item = janelaV1({ id: "bbbbbbbbbbbb", codigos: ["5300020260001", "5300020260036"] });
  const m = codigosPorJanela(v2(janelaV2("transferegov", "bbbbbbbbbbbb-proposta")), { oportunidades: [item] });
  assert.deepEqual(m.get("transferegov-bbbbbbbbbbbb-proposta"), ["5300020260001", "5300020260036"]);
});

test("não inventa código: outra fonte, janela sem par e janela sem código ficam de fora", () => {
  const v1 = {
    oportunidades: [
      janelaV1({ id: "cccccccccccc", codigos: ["9"] }),
      janelaV1({ id: "dddddddddddd", codigos: [] }),
    ],
  };
  const m = codigosPorJanela(
    v2(
      // Mesmo prefixo, fonte diferente: não é programa do Transferegov.
      janelaV2("finep", "cccccccccccc-chamada"),
      janelaV2("transferegov", "eeeeeeeeeeee-emenda"),
      janelaV2("transferegov", "dddddddddddd-emenda"),
    ),
    v1,
  );
  assert.equal(m.size, 0);
});
