import test from "node:test";
import assert from "node:assert/strict";
import { LAUDO_PELAS_SUSPENSIVAS, ORIGEM_SUSPENSIVAS, abaAtiva, noMeuMunicipio, type RegraAba } from "./abas.ts";

const JANELAS: RegraAba = { href: "/mapa", exata: true };
const BUSCA: RegraAba = { href: "/mapa/busca", exata: false, tambem: ["/mapa/instrumento/", "/mapa/proposta/"], exceto: [LAUDO_PELAS_SUSPENSIVAS] };
const SUSPENSIVAS: RegraAba = { href: "/mapa/suspensivas", exata: false, tambem: [LAUDO_PELAS_SUSPENSIVAS] };

test("o laudo acende a Busca, a não ser que se chegue pela lista das suspensivas", () => {
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/962210/laudo"), true);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/962210/laudo"), false);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/980439/laudo", ORIGEM_SUSPENSIVAS), true);
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439/laudo", ORIGEM_SUSPENSIVAS), false);
  // Origem desconhecida não muda nada.
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439/laudo", "outra"), true);
});

test("a página do convênio segue acendendo Busca, venha de onde vier; as páginas das suspensivas, Suspensivas", () => {
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439"), true);
  assert.equal(abaAtiva(BUSCA, "/mapa/instrumento/980439", ORIGEM_SUSPENSIVAS), true);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/980439", ORIGEM_SUSPENSIVAS), false);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/suspensivas/checklist"), true);
});

test("aba exata só no caminho exato; convênio com 'laudo' no número não confunde", () => {
  assert.equal(abaAtiva(JANELAS, "/mapa"), true);
  assert.equal(abaAtiva(JANELAS, "/mapa/avisos"), false);
  assert.equal(abaAtiva(SUSPENSIVAS, "/mapa/instrumento/laudo", ORIGEM_SUSPENSIVAS), false);
  assert.equal(abaAtiva(BUSCA, "/mapa/proposta/123"), true);
});

test("o dossiê do fornecedor acende a aba Fornecedores, e só ela", () => {
  const FORNECEDORES: RegraAba = { href: "/mapa/fornecedores", exata: false, tambem: ["/mapa/fornecedor/"] };
  assert.equal(abaAtiva(FORNECEDORES, "/mapa/fornecedores"), true);
  assert.equal(abaAtiva(FORNECEDORES, "/mapa/fornecedor/05476456000146"), true);
  assert.equal(abaAtiva(BUSCA, "/mapa/fornecedor/05476456000146"), false);
  // O laudo aberto pelo dossiê é da Busca.
  assert.equal(abaAtiva(FORNECEDORES, "/mapa/instrumento/962210/laudo"), false);
});

test("F1c: a página do próprio município (e o que fica debaixo dela) é do «Meu município»; a de outro, não", () => {
  assert.equal(noMeuMunicipio("/mapa/municipio/2513802", "2513802"), true);
  assert.equal(noMeuMunicipio("/mapa/municipio/2513802/relatorio", "2513802"), true);
  assert.equal(noMeuMunicipio("/mapa/municipio/2510808", "2513802"), false);
  // prefixo do número não confunde
  assert.equal(noMeuMunicipio("/mapa/municipio/25138021", "2513802"), false);
  assert.equal(noMeuMunicipio("/mapa/municipio/2513802", null), false);
  assert.equal(noMeuMunicipio("/mapa/busca", "2513802"), false);
});
