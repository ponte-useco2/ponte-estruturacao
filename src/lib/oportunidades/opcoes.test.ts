import { test } from "node:test";
import assert from "node:assert/strict";
import { opcoesDePreferencia } from "./opcoes.ts";
import { TEMAS } from "./temas.ts";

const janelas = [
  { temas: ["turismo"], orgao: "Ministério do Turismo", natureza: "Administração Pública Municipal" },
  { temas: ["turismo", "inovaç"], orgao: "Ministério do Turismo", natureza: "Consórcio Público" },
  { temas: [], orgao: "Ministério da Saúde", natureza: "Administração Pública Municipal" },
];

test("todo tema aparece, inclusive o que não tem janela", () => {
  const o = opcoesDePreferencia(janelas);
  assert.equal(o.temas.length, TEMAS.length);
  assert.equal(o.temas.find((t) => t.valor === "turismo")?.janelas, 2);
  assert.equal(o.temas.find((t) => t.valor === "inovacao")?.janelas, 1);
  assert.equal(o.temas.find((t) => t.valor === "saneamento")?.janelas, 0);
});

test("órgão e natureza vêm do catálogo, com contagem", () => {
  const o = opcoesDePreferencia(janelas);
  assert.deepEqual(
    o.orgaos.map((x) => [x.valor, x.janelas]),
    [
      ["Ministério do Turismo", 2],
      ["Ministério da Saúde", 1],
    ],
  );
  assert.deepEqual(
    o.naturezas.map((x) => [x.valor, x.janelas]),
    [
      ["Administração Pública Municipal", 2],
      ["Consórcio Público", 1],
    ],
  );
});

test("o rótulo do tema é legível, e o valor é o id estável", () => {
  const turismo = opcoesDePreferencia(janelas).temas.find((t) => t.valor === "turismo");
  assert.equal(turismo?.rotulo, "Turismo");
});

test("catálogo vazio não quebra, e os temas continuam ali", () => {
  const o = opcoesDePreferencia([]);
  assert.equal(o.orgaos.length, 0);
  assert.equal(o.naturezas.length, 0);
  assert.equal(o.temas.length, TEMAS.length);
  assert.ok(o.temas.every((t) => t.janelas === 0));
});
