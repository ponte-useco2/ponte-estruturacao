import { test } from "node:test";
import assert from "node:assert/strict";
import { DESTINO_PADRAO, destinoSeguro } from "./destino.ts";

test("caminho interno passa, com consulta", () => {
  assert.equal(destinoSeguro("/mapa"), "/mapa");
  assert.equal(destinoSeguro("/mapa/painel/municipio/2507507?quem=todos"), "/mapa/painel/municipio/2507507?quem=todos");
  assert.equal(destinoSeguro("/mapa/meu-municipio"), "/mapa/meu-municipio");
});

test("o que o navegador leria como outro endereço cai no padrão", () => {
  for (const ruim of [
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example",
    "/x?volta=https://evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "mapa",
    "",
    "/" + "a".repeat(600),
  ]) {
    assert.equal(destinoSeguro(ruim), DESTINO_PADRAO, JSON.stringify(ruim));
  }
  assert.equal(destinoSeguro(null), DESTINO_PADRAO);
  assert.equal(destinoSeguro(undefined), DESTINO_PADRAO);
});

test("o padrão pode ser outro", () => {
  assert.equal(destinoSeguro("//x", "/mapa"), "/mapa");
  assert.equal(destinoSeguro(undefined, "/mapa"), "/mapa");
});

test("barra codificada continua sendo caminho", () => {
  // O parser não decodifica %2F no caminho: /%2F%2Fx fica em nosso domínio.
  assert.equal(destinoSeguro("/%2F%2Fevil.example"), "/%2F%2Fevil.example");
  assert.equal(new URL(destinoSeguro("/%2F%2Fevil.example"), "https://ponteprojetos.com.br").host, "ponteprojetos.com.br");
});
