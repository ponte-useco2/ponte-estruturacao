import test from "node:test";
import assert from "node:assert/strict";
import { normaValida } from "./normas.ts";

const BASE = {
  titulo: "  Portaria Conjunta MGI/MF/CGU nº 33  ",
  orgao: "",
  publicada_em: "2026-09-10",
  link: "https://www.in.gov.br/web/dou/-/portaria-33",
  resumo: "",
  temas: ["urbanizacao", "urbanizacao"],
};

test("norma válida: espaços aparados, vazio vira null, tema sem repetição", () => {
  assert.deepEqual(normaValida(BASE), {
    titulo: "Portaria Conjunta MGI/MF/CGU nº 33",
    orgao: null,
    publicada_em: "2026-09-10",
    link: "https://www.in.gov.br/web/dou/-/portaria-33",
    resumo: null,
    temas: ["urbanizacao"],
  });
});

test("norma inválida diz o que está errado", () => {
  assert.equal(normaValida({ ...BASE, titulo: "ab" }), "O título precisa ter de 3 a 300 caracteres.");
  assert.equal(normaValida({ ...BASE, publicada_em: "2026-02-30" }), "Informe a data de publicação.");
  assert.equal(normaValida({ ...BASE, link: "http://www.in.gov.br" }), "O link precisa começar com https:// e levar ao texto oficial.");
  assert.equal(normaValida({ ...BASE, link: "https://exemplo.gov.br/com espaço" }), "O link precisa começar com https:// e levar ao texto oficial.");
  assert.equal(normaValida({ ...BASE, temas: ["tema-inventado"] }), "Tema desconhecido.");
  assert.equal(normaValida(null), "Formulário inválido.");
});
