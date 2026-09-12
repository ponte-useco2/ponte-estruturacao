import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ROTULO_TEMA, TEMAS, ehTemaConhecido, radicaisDesconhecidos, temasDaJanela } from "./temas.ts";

test("radical do radar vira id de tema", () => {
  assert.deepEqual(temasDaJanela(["inovaç"]), ["inovacao"]);
  assert.deepEqual(temasDaJanela(["socioassist"]), ["assistencia_social"]);
  assert.deepEqual(temasDaJanela(["desenvolvimento regional"]), ["desenvolvimento_regional"]);
});

test("radicais diferentes do mesmo assunto não viram dois temas", () => {
  assert.deepEqual(temasDaJanela(["inovaç", "inovac"]), ["inovacao"]);
  assert.deepEqual(temasDaJanela(["suas", "assistencia social"]), ["assistencia_social"]);
});

test("a ordem é a da lista de temas, não a do catálogo", () => {
  assert.deepEqual(temasDaJanela(["turismo", "athis"]), ["athis", "turismo"]);
});

test("radical desconhecido é ignorado, e não vira tema novo", () => {
  assert.deepEqual(temasDaJanela(["pesca artesanal"]), []);
  assert.deepEqual(temasDaJanela(undefined), []);
  assert.deepEqual(temasDaJanela([]), []);
});

test("ids e rótulos são únicos, e todo id é conhecido", () => {
  assert.equal(new Set(TEMAS.map((t) => t.id)).size, TEMAS.length);
  assert.equal(new Set(TEMAS.map((t) => t.rotulo)).size, TEMAS.length);
  for (const t of TEMAS) {
    assert.ok(ehTemaConhecido(t.id), `id desconhecido: ${t.id}`);
    assert.equal(ROTULO_TEMA[t.id], t.rotulo);
  }
});

test("um radical pertence a um assunto só", () => {
  const todos = TEMAS.flatMap((t) => t.radicais);
  assert.equal(new Set(todos).size, todos.length, "radical repetido entre temas");
});

/**
 * A lista de radicais vive no radar; os rótulos, aqui. Se o radar ganhar um
 * assunto novo e ninguém der rótulo a ele, a janela marcada com esse radical
 * ficaria invisível para a preferência, em silêncio. Este teste é o alarme.
 *
 * No repositório publicado não existe `radar/`, e aí o teste se cala em vez de
 * falhar por um arquivo que não deveria estar lá.
 */
test("todo radical do radar tem rótulo", () => {
  const caminho = fileURLToPath(new URL("../../../../radar/scripts/radar.py", import.meta.url));
  if (!existsSync(caminho)) return;

  const bloco = /TEMAS_PADRAO\s*=\s*\[([\s\S]*?)\]/.exec(readFileSync(caminho, "utf8"));
  assert.ok(bloco, "TEMAS_PADRAO não encontrado em radar/scripts/radar.py");

  const radicais = [...bloco[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(radicais.length >= 10, `poucos radicais lidos do radar: ${radicais.length}`);
  assert.deepEqual(radicaisDesconhecidos(radicais), [], "o radar tem radical sem rótulo em temas.ts");
});
