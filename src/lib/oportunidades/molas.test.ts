import test from "node:test";
import assert from "node:assert/strict";
import { MOLA, PASSO_DA_CASCATA, TETO_DA_CASCATA, atrasoDaCascata, cascata } from "./molas.ts";

test("onda 16: a cascata começa em zero, anda um passo por item e para no teto", () => {
  assert.equal(atrasoDaCascata(0), 0);
  assert.equal(atrasoDaCascata(1), PASSO_DA_CASCATA);
  assert.equal(atrasoDaCascata(3), Math.round(3 * PASSO_DA_CASCATA * 1000) / 1000);
  assert.equal(atrasoDaCascata(TETO_DA_CASCATA), atrasoDaCascata(500));
  // a lista inteira nunca espera mais que ~0,6 s
  assert.ok(atrasoDaCascata(10_000) < 0.6);
});

test("onda 16: índice estranho não vira atraso estranho", () => {
  assert.equal(atrasoDaCascata(-3), 0);
  assert.equal(atrasoDaCascata(Number.NaN), 0);
  assert.equal(atrasoDaCascata(2.7), atrasoDaCascata(2));
});

test("onda 16: as molas são molas e a cascata tem os nomes do Framer Motion", () => {
  for (const m of Object.values(MOLA)) {
    assert.equal(m.type, "spring");
    assert.ok(m.stiffness > 0 && m.damping > 0 && m.mass > 0);
  }
  assert.deepEqual(cascata(0.1, 0.05), { staggerChildren: 0.05, delayChildren: 0.1 });
});

test("onda 16 (M3): a curva das barras no CSS é a da mola `barra`", async () => {
  const { readFileSync } = await import("node:fs");
  const { curvaDaMola } = await import("./molas.ts");
  const css = readFileSync(new URL("../../app/mapa/_movimento/movimento.css", import.meta.url), "utf8");
  const c = curvaDaMola(MOLA.barra);
  assert.ok(css.includes(`--mp-mola-barra: ${c.linear};`), "regere a curva: node -e \"import('./molas.ts').then(m=>console.log(m.curvaDaMola(m.MOLA.barra)))\"");
  assert.ok(css.includes(`--mp-mola-barra-ms: ${c.duracaoMs}ms;`));
  // começa em 0, termina em 1 e nunca volta para trás de 0
  assert.ok(c.linear.startsWith("linear(0,") && c.linear.endsWith(", 1)"));
  assert.ok(c.duracaoMs > 200 && c.duracaoMs < 1500);
});
