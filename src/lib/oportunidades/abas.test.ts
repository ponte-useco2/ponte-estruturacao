import test from "node:test";
import assert from "node:assert/strict";
import { ROTA_LAUDO, abaAtiva, type RegraAba } from "./abas.ts";

const JANELAS: RegraAba = { href: "/mapa", exata: true };
const BUSCA: RegraAba = { href: "/mapa/busca", exata: false, tambem: ["/mapa/instrumento/", "/mapa/proposta/"], exceto: [ROTA_LAUDO] };
const SUSPENSIVAS: RegraAba = { href: "/mapa/suspensivas", exata: false, tambem: [ROTA_LAUDO] };

test("o laudo acende Suspensivas, e a página do convênio segue acendendo Busca", () => {
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/980439/laudo"), true);
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439/laudo"), false);
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439"), true);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/980439"), false);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/suspensivas/checklist"), true);
});

test("aba exata só no caminho exato; convênio com 'laudo' no número não confunde", () => {
  assert.equal(abaAtiva(JANELAS, "/mapa"), true);
  assert.equal(abaAtiva(JANELAS, "/mapa/avisos"), false);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/laudo"), false);
  assert.equal(abaAtiva(BUSCA, "/mapa/proposta/123"), true);
});
