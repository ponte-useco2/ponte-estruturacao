import test from "node:test";
import assert from "node:assert/strict";
import {
  GLOSSARIO,
  TAMANHO_CURTA,
  TAMANHO_EXPLICA,
  ancoraTermo,
  chaveDeOrdem,
  letraDe,
  ordenarTermos,
  termoPorSlug,
  termosEmOrdem,
  termosPorLetra,
  urlTermo,
} from "./glossario.ts";

/** Os termos que os testes com usuários e o teste de 08/10/2026 pediram explicados. */
const MINIMOS = [
  "instrumento-vivo",
  "convenio",
  "proposta",
  "janela",
  "em-execucao",
  "prestacao-de-contas",
  "condicao-suspensiva",
  "limbo",
  "desembolso",
  "valor-global",
  "contrapartida",
  "emenda-parlamentar",
  "pix",
  "fundo-a-fundo",
  "transferegov",
  "tomada-de-contas-especial",
  "tce-pb",
  "pc-33",
  "cauc",
  "lrf",
  "decisoes-fiscais",
  "mediana",
  "p90",
  "tercil",
  "regiao-imediata",
  "regiao-intermediaria",
  "macrorregiao",
  "osc",
  "osc-ativa",
  "natureza-juridica",
  "cebas",
  "mapa-das-osc",
  // achados H05/H06 da auditoria B1+B2 (08/10/2026)
  "rcl",
  "regic",
  "cepim",
  "convenente",
];

test("slugs únicos, no formato [a-z0-9-] e sem hífen nas pontas", () => {
  const slugs = GLOSSARIO.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slug repetido");
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `slug fora do formato: ${s}`);
});

test("os termos mínimos estão todos no glossário", () => {
  for (const s of MINIMOS) assert.ok(termoPorSlug(s), `falta o termo ${s}`);
  assert.ok(GLOSSARIO.length >= 30);
});

test("limites de tamanho: curta até 160 e frase completa; explica até 600", () => {
  for (const t of GLOSSARIO) {
    assert.ok(t.termo.trim().length > 0, `${t.slug}: sem termo`);
    assert.ok(t.curta.length > 0 && t.curta.length <= TAMANHO_CURTA, `${t.slug}: curta com ${t.curta.length} caracteres`);
    assert.match(t.curta, /^[A-ZÀ-Ú(]/, `${t.slug}: curta não começa com maiúscula`);
    assert.match(t.curta, /[.?!]$/, `${t.slug}: curta não termina como frase`);
    assert.ok(t.explica.length > 0 && t.explica.length <= TAMANHO_EXPLICA, `${t.slug}: explica com ${t.explica.length} caracteres`);
    assert.match(t.explica, /[.?!]$/, `${t.slug}: explica não termina como frase`);
    if (t.exemplo !== undefined) assert.ok(t.exemplo.trim().length > 0, `${t.slug}: exemplo vazio`);
    assert.equal(t.curta, t.curta.trim());
    assert.equal(t.explica, t.explica.trim());
  }
});

test("toda entrada diz a fonte", () => {
  for (const t of GLOSSARIO) assert.ok(t.fonte.trim().length >= 3, `${t.slug}: sem fonte`);
});

test("todo 'veja' aponta para um slug existente, sem repetir e sem apontar para si", () => {
  for (const t of GLOSSARIO) {
    assert.equal(new Set(t.veja).size, t.veja.length, `${t.slug}: veja repetido`);
    for (const v of t.veja) {
      assert.notEqual(v, t.slug, `${t.slug}: veja aponta para si`);
      assert.ok(termoPorSlug(v), `${t.slug}: veja aponta para ${v}, que não existe`);
    }
  }
});

test("redação neutra: nenhuma entrada chama de irregular", () => {
  for (const t of GLOSSARIO) {
    const texto = `${t.curta} ${t.explica} ${t.exemplo ?? ""}`.toLowerCase();
    assert.ok(!/\birregular/.test(texto), `${t.slug}: usa "irregular"`);
  }
});

test("ordem alfabética do português, sem considerar acento nem caixa", () => {
  const lista = ["Zebra", "Ética", "escola", "Árvore", "Abacate", "Órgão", "Ovo"].map((termo) => ({ termo }));
  assert.deepEqual(
    ordenarTermos(lista).map((x) => x.termo),
    ["Abacate", "Árvore", "escola", "Ética", "Órgão", "Ovo", "Zebra"],
  );
  assert.equal(chaveDeOrdem("Região Intermediária"), "regiao intermediaria");
});

test("termosEmOrdem: todos os termos, cada um depois do anterior", () => {
  const ordem = termosEmOrdem();
  assert.equal(ordem.length, GLOSSARIO.length);
  const colador = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
  for (let i = 1; i < ordem.length; i++) {
    const [a, b] = [chaveDeOrdem(ordem[i - 1].termo), chaveDeOrdem(ordem[i].termo)];
    assert.ok(colador.compare(a, b) <= 0, `${ordem[i - 1].termo} veio antes de ${ordem[i].termo}`);
  }
  const pos = (slug: string) => ordem.findIndex((t) => t.slug === slug);
  assert.equal(ordem[0].slug, "cauc");
  assert.ok(pos("regiao-imediata") < pos("regiao-intermediaria"));
  assert.ok(pos("macrorregiao") < pos("mapa-das-osc"));
  assert.ok(pos("transferegov") < pos("transferencia-voluntaria"));
});

test("os grupos por letra cobrem todos os termos, uma vez cada letra, em ordem", () => {
  const grupos = termosPorLetra();
  const letras = grupos.map((g) => g.letra);
  assert.equal(new Set(letras).size, letras.length);
  assert.deepEqual([...letras].sort(), letras);
  assert.equal(grupos.reduce((s, g) => s + g.termos.length, 0), GLOSSARIO.length);
  for (const g of grupos) for (const t of g.termos) assert.equal(letraDe(t.termo), g.letra);
  assert.equal(letraDe("Água"), "A");
  assert.equal(letraDe("  órgão"), "O");
});

test("endereço e busca por slug", () => {
  assert.equal(ancoraTermo("p90"), "termo-p90");
  assert.equal(urlTermo("p90"), "/mapa/glossario#termo-p90");
  assert.equal(termoPorSlug("cebas")?.termo, "CEBAS");
  assert.equal(termoPorSlug("nao-existe"), undefined);
});
