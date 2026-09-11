// Gera .design-sync/.cache/gerado/plataforma.css, a folha de estilos que o
// Claude Design recebe. É o `buildCmd` da sincronização: roda antes do conversor.
//
// Por que gerar, e não apontar direto para os arquivos do app:
//  · os tokens --color-pl-* vivem num bloco `@theme static` do Tailwind v4 em
//    src/app/globals.css. O Claude Design não roda o Tailwind, então aqui o
//    bloco vira `:root { ... }` em CSS puro;
//  · as fontes chegam ao app por next/font, que define --font-inter e
//    --font-plus-jakarta em tempo de build. Aqui as mesmas famílias vêm do
//    Google Fonts, e as duas variáveis apontam para elas;
//  · estilos.css e componentes.css entram inteiros, na ordem do layout.
//
// Tudo é relido das fontes a cada execução — nunca editar o gerado, nunca
// copiar valores para outro lugar. A fonte única continua sendo o app.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const web = join(aqui, "..");
const destino = join(aqui, ".cache", "gerado", "plataforma.css");

const ler = (rel) => readFileSync(join(web, rel), "utf8");

// Só o bloco da plataforma (--color-pl-*). O outro `@theme static` de
// globals.css é do CTLC, outra identidade, e não entra neste design system.
function blocosThemeStatic(css) {
  const blocos = [];
  const rx = /@theme\s+static\s*\{/g;
  while (rx.exec(css)) {
    let i = rx.lastIndex;
    let nivel = 1;
    while (i < css.length && nivel > 0) {
      if (css[i] === "{") nivel++;
      else if (css[i] === "}") nivel--;
      i++;
    }
    blocos.push(css.slice(rx.lastIndex, i - 1).trim());
  }
  return blocos;
}

const tokens = blocosThemeStatic(ler("src/app/globals.css")).filter((b) => b.includes("--color-pl-"));
if (tokens.length !== 1) {
  console.error(`gerar-estilos: esperava 1 bloco @theme static com --color-pl-*, achei ${tokens.length} — o formato de globals.css mudou`);
  process.exit(1);
}

const arquivos = ["src/app/plataforma/app/estilos.css", "src/app/plataforma/app/componentes.css"];
const corpos = arquivos.map((rel) => {
  const css = ler(rel);
  // url() relativo quebraria fora do app: o caminho não existe no Claude Design.
  const relativos = [...css.matchAll(/url\(\s*['"]?(?!data:|https?:|#)([^'")]+)/g)].map((m) => m[1]);
  if (relativos.length) {
    console.error(`gerar-estilos: ${rel} usa url() relativo (${relativos.join(", ")}) — precisa de tratamento antes de sincronizar`);
    process.exit(1);
  }
  return `/* ---- ${rel} ---- */\n${css}`;
});

const saida = [
  "/* Gerado por .design-sync/gerar-estilos.mjs a partir do app. Não editar. */",
  '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Plus+Jakarta+Sans:wght@200..800&display=swap");',
  "",
  "/* ---- src/app/globals.css: @theme static da plataforma ---- */",
  ":root {",
  tokens[0],
  "",
  "  /* next/font define estas duas no app; aqui apontam para o Google Fonts. */",
  '  --font-inter: "Inter";',
  '  --font-plus-jakarta: "Plus Jakarta Sans";',
  "}",
  "",
  ...corpos,
].join("\n");

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, saida);
console.log(`gerar-estilos: ${(saida.length / 1024).toFixed(0)} KB -> ${destino}`);
