/** O Observatório do Diário Oficial da PB (26/10/2026). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BASE_DOE, PECAS_DOE, pecaDoe, urlObservatorioDoe, urlPecaDoe } from "./observatorio-doe.ts";

const WEB = path.resolve(import.meta.dirname, "..", "..", "..");
const CONTEUDO = path.join(WEB, "src", "conteudo", "doe");
const ler = (...p: string[]) => fs.readFileSync(path.join(WEB, ...p), "utf-8");

test("cada peça da lista tem o arquivo, e nenhum arquivo fica fora da lista", () => {
  const arquivos = fs.readdirSync(CONTEUDO).filter((f) => f.endsWith(".html")).sort();
  assert.deepEqual(arquivos, PECAS_DOE.map((p) => `${p.id}.html`).sort());
  for (const p of PECAS_DOE) assert.match(p.id, /^[a-z]+$/, "o id vira nome de arquivo: só letras");
  assert.match(BASE_DOE, /^\d{4}-\d{2}-\d{2}$/);
});

test("id fora da lista não vira peça (nem caminho de arquivo)", () => {
  for (const id of ["../privado/x", "privado", "", "CEHAP", null, undefined]) assert.equal(pecaDoe(id), null, String(id));
  assert.equal(pecaDoe("fapesq")?.nome, "FAPESQ");
  assert.equal(urlPecaDoe("cehap"), "/mapa/diario-oficial/peca/cehap");
  assert.equal(urlObservatorioDoe("cehap"), "/mapa/diario-oficial");
  assert.equal(urlObservatorioDoe("fundiario"), "/mapa/diario-oficial?peca=fundiario");
});

test("as peças não trazem CPF (nem mascarado), caminho de disco ou a pasta privado", () => {
  for (const p of PECAS_DOE) {
    const html = fs.readFileSync(path.join(CONTEUDO, `${p.id}.html`), "utf-8");
    assert.doesNotMatch(html, /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/, `${p.id}: CPF formatado`);
    assert.doesNotMatch(html, /\*{3}\.\d{3}\.\d{3}-\*{2}/, `${p.id}: CPF com os dígitos do meio`);
    assert.doesNotMatch(html, /[A-Za-z]:\\?(?:doe_PB|Users)|file:\/\/\//i, `${p.id}: caminho de disco`);
    assert.doesNotMatch(html, /docs[\/]privado/i, `${p.id}: a pasta privado`);
  }
});

test("a rota da peça confere o administrador antes de ler o arquivo, e a página também", () => {
  const rota = ler("src", "app", "mapa", "diario-oficial", "peca", "[peca]", "route.ts");
  assert.ok(rota.indexOf("ehAdministrador(visitante.email)") > 0);
  assert.ok(rota.indexOf("ehAdministrador(visitante.email)") < rota.indexOf("readFile("), "confere antes de ler");
  assert.match(rota, /status: 404/);
  assert.match(rota, /no-store/);
  const pagina = ler("src", "app", "mapa", "diario-oficial", "page.tsx");
  assert.ok(pagina.indexOf('redirect("/mapa")') < pagina.indexOf("<iframe"));
  assert.match(pagina, /sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"/);
  assert.doesNotMatch(pagina, /sandbox="[^"]*allow-same-origin/, "o script da peça não ganha a origem do portal");
  assert.match(pagina, /PONTE Estruturação de Projetos de Impacto|ASSINATURA_DOE/);
});

test("só a rota das peças pode ir para um iframe, e só do próprio site", () => {
  const config = ler("next.config.ts");
  assert.match(config, /source: "\/mapa\/diario-oficial\/peca\/:peca"/);
  assert.match(config, /frame-ancestors 'self'/);
  assert.match(config, /"\/mapa\/diario-oficial\/peca\/\[peca\]": \["\.\/src\/conteudo\/doe\/\*\.html"\]/);
  assert.equal(config.match(/X-Frame-Options", value: "SAMEORIGIN"/g)?.length, 1);
});
