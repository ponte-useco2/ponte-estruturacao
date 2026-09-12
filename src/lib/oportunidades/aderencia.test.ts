import { test } from "node:test";
import assert from "node:assert/strict";
import { PREFERENCIAS_VAZIAS, combina, motivoDaCombinacao, temPreferencia, type Preferencias } from "./aderencia.ts";

const JANELA = {
  temas: ["turismo"],
  orgao: "Ministério do Turismo",
  natureza: "Administração Pública Municipal",
};

const prefs = (p: Partial<Preferencias>): Preferencias => ({ ...PREFERENCIAS_VAZIAS, ...p });

test("sem preferência, nada combina", () => {
  assert.equal(temPreferencia(PREFERENCIAS_VAZIAS), false);
  assert.equal(combina(JANELA, PREFERENCIAS_VAZIAS), false);
  assert.equal(motivoDaCombinacao(JANELA, PREFERENCIAS_VAZIAS), null);
});

test("combina por tema, e o motivo é o rótulo legível", () => {
  assert.equal(motivoDaCombinacao({ temas: ["inovaç"] }, prefs({ temas: ["inovacao"] })), "Inovação");
});

test("combina por órgão", () => {
  assert.equal(motivoDaCombinacao(JANELA, prefs({ orgaos: ["Ministério do Turismo"] })), "Ministério do Turismo");
});

test("combina por natureza", () => {
  assert.equal(
    motivoDaCombinacao(JANELA, prefs({ naturezas: ["Administração Pública Municipal"] })),
    "Administração Pública Municipal",
  );
});

test("não combina quando nenhum eixo bate", () => {
  assert.equal(combina(JANELA, prefs({ temas: ["saneamento"], orgaos: ["Ministério da Saúde"] })), false);
});

test("o radical bruto do radar não serve como preferência", () => {
  // A preferência guarda id ("inovacao"), não radical ("inovaç"). Se alguém
  // gravar o radical, ele simplesmente não casa — e não vira destaque errado.
  assert.equal(combina({ temas: ["inovaç"] }, prefs({ temas: ["inovaç"] })), false);
});

test("janela sem eixo nenhum não combina", () => {
  assert.equal(combina({}, prefs({ temas: ["turismo"], orgaos: ["Ministério do Turismo"] })), false);
});

test("o tema vem antes do órgão no motivo", () => {
  const p = prefs({ temas: ["turismo"], orgaos: ["Ministério do Turismo"] });
  assert.equal(motivoDaCombinacao(JANELA, p), "Turismo");
});
