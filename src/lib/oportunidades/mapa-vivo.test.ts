import test from "node:test";
import assert from "node:assert/strict";
import { ESCALA_MAXIMA, TIPO_MORFAR, acaoDoClique, atrasoDaRegiao, caixaNaTela, limitesDoArraste, posicaoNoMapa, proximaEscala, tiposComMorph, type Clique } from "./mapa-vivo.ts";

const clique = (x: Partial<Clique> = {}): Clique => ({ detail: 1, button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...x });

test("M1 (D16-1): o primeiro clique abre a prévia; o segundo na mesma área entra", () => {
  assert.equal(acaoDoClique(clique(), null, "2510808"), "previa");
  assert.equal(acaoDoClique(clique(), "2510808", "2510808"), "entrar");
  assert.equal(acaoDoClique(clique(), "2504009", "2510808"), "previa");
});

test("M1 (D16-1): teclado, outra aba e botão do meio navegam direto, como link", () => {
  assert.equal(acaoDoClique(clique({ detail: 0 }), null, "PB"), "navegar");
  assert.equal(acaoDoClique(clique({ ctrlKey: true }), null, "PB"), "navegar");
  assert.equal(acaoDoClique(clique({ metaKey: true }), null, "PB"), "navegar");
  assert.equal(acaoDoClique(clique({ shiftKey: true }), null, "PB"), "navegar");
  assert.equal(acaoDoClique(clique({ altKey: true }), null, "PB"), "navegar");
  assert.equal(acaoDoClique(clique({ button: 1 }), null, "PB"), "navegar");
});

test("M1 (D16-2): o zoom fica entre 1 e 4", () => {
  assert.equal(proximaEscala(1, -1), 1);
  assert.equal(proximaEscala(1, 1), 1.6);
  assert.equal(proximaEscala(1.6, 1), 2.56);
  assert.equal(proximaEscala(3, 1), ESCALA_MAXIMA);
  assert.equal(proximaEscala(ESCALA_MAXIMA, 1), ESCALA_MAXIMA);
  assert.equal(proximaEscala(1.6, -1), 1);
});

test("M1 (D16-2): o arraste só existe com o mapa ampliado, até a borda", () => {
  assert.deepEqual(limitesDoArraste(1, 400, 300), { left: -0, right: 0, top: -0, bottom: 0 });
  assert.deepEqual(limitesDoArraste(2, 400, 300), { left: -200, right: 200, top: -150, bottom: 150 });
  assert.deepEqual(limitesDoArraste(2, -5, Number.NaN > 0 ? 1 : 0), { left: -0, right: 0, top: -0, bottom: 0 });
});

test("M1: as regiões entram uma depois da outra", () => {
  assert.equal(atrasoDaRegiao(0), 0);
  assert.equal(atrasoDaRegiao(3), 330);
  assert.equal(atrasoDaRegiao(-2), 0);
});

test("M1: o centro da área vira porcentagem da caixa do mapa", () => {
  assert.deepEqual(posicaoNoMapa("0 0 1000 578", 500, 289), { left: "50%", top: "50%" });
  assert.deepEqual(posicaoNoMapa("0 0 1000 578", 1200, -10), { left: "100%", top: "0%" });
  assert.deepEqual(posicaoNoMapa("100,50 200 100", 150, 100), { left: "25%", top: "50%" });
  assert.equal(posicaoNoMapa("0 0 0 10", 1, 1), null);
  assert.equal(posicaoNoMapa("lixo", 1, 1), null);
});

test("M1: a caixa do contorno é quadrada, centrada e com folga", async () => {
  const { caixaDoCaminho } = await import("./mapa-vivo.ts");
  assert.equal(caixaDoCaminho("M0 0L100 0L100 50Z", 0), "0 -25 100 100");
  assert.equal(caixaDoCaminho("M10 10L30 10L30 30L10 30Z", 0.1), "8 8 24 24");
  assert.equal(caixaDoCaminho("M5 5Z", 0), "4.5 4.5 1 1");
  assert.equal(caixaDoCaminho(""), null);
});

test("onda 18: a caixa do contorno vai para a tela pela matriz do SVG", () => {
  assert.deepEqual(caixaNaTela("10 20 100 100", { a: 0.5, d: 0.5, e: 30, f: 200 }), { left: 35, top: 210, width: 50, height: 50 });
  assert.equal(caixaNaTela("10 20 100", { a: 1, d: 1, e: 0, f: 0 }), null);
  assert.equal(caixaNaTela("10 20 100 100", { a: 0, d: 1, e: 0, f: 0 }), null);
});

test("onda 18: o morph só entra na descida e só com destino", () => {
  assert.deepEqual(tiposComMorph(["mp-descer"], "municipio", "mp-descer"), ["mp-descer", TIPO_MORFAR.municipio]);
  assert.deepEqual(tiposComMorph(["mp-descer"], "uf", "mp-descer"), ["mp-descer", "mp-morfar-uf"]);
  assert.deepEqual(tiposComMorph(["mp-subir"], "uf", "mp-descer"), ["mp-subir"]);
  assert.deepEqual(tiposComMorph(["mp-descer"], undefined, "mp-descer"), ["mp-descer"]);
  assert.equal(tiposComMorph(undefined, "uf", "mp-descer"), undefined);
});
