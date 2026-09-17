import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITE_DESTAQUES, escapar, montarResumoDiario, urlDoItem, urlMudancas, type EntradaResumo } from "./resumo-diario.ts";
import type { MudancaPainel } from "./painel.ts";

function mudanca(muda: Partial<MudancaPainel>): MudancaPainel {
  return {
    dado_ate_anterior: "2026-09-13T21:51:02+00:00",
    dado_ate: "2026-09-14T22:02:11+00:00",
    alvo: "convenio",
    tipo: "suspensiva_retirada",
    chave: "900123",
    numero: "900123",
    uf: "PB",
    cod_ibge: "2516201",
    municipio: "SOUSA",
    proponente: "MUNICIPIO DE SOUSA",
    tipo_agente: "municipio",
    orgao_sup: "MINISTERIO DAS CIDADES",
    programa: "Pavimentação",
    objeto: "Pavimentação de ruas",
    antes: "2026-10-01",
    depois: null,
    valor: 1_250_000,
    ...muda,
  };
}

const BASE: EntradaResumo = {
  dadoAte: "2026-09-14T22:02:11+00:00",
  desde: "2026-09-13T21:51:02+00:00",
  brasil: [
    { tipo: "proposta_enviada", n: 820, valor: 90_000_000 },
    { tipo: "suspensiva_retirada", n: 12, valor: 30_000_000 },
    { tipo: "tce_instaurada", n: 0, valor: null },
  ],
  uf: [{ tipo: "suspensiva_retirada", n: 1, valor: 1_250_000 }],
  destaques: [mudanca({})],
  urlBase: "https://ponteprojetos.com.br",
};

test("assunto diz o dia do dado e as contagens, sem quebra de linha", () => {
  const r = montarResumoDiario(BASE);
  assert.equal(r.assunto, "[PONTE] O que mudou no Transferegov · dado de 14/09/2026 · 1 na PB, 832 no Brasil");
});

test("tabela na ordem dos tipos, sem os zerados, com a coluna da UF", () => {
  const r = montarResumoDiario(BASE);
  const i = r.texto.indexOf("Suspensiva retirada: 12 no Brasil, 1 na PB");
  const j = r.texto.indexOf("Proposta enviada: 820 no Brasil, 0 na PB");
  assert.ok(i > 0 && j > i, r.texto);
  assert.ok(!r.texto.includes("TCE instaurada"));
  assert.ok(r.texto.includes("comparado com o de 13/09/2026"));
  assert.ok(r.html.includes("https://ponteprojetos.com.br/mapa/painel?visao=mudancas&amp;uf=PB"));
});

test("destaque traz quem, onde, número, frase e valor", () => {
  const r = montarResumoDiario(BASE);
  assert.ok(r.texto.includes("- Suspensiva retirada · MUNICIPIO DE SOUSA (SOUSA) · convênio nº 900123 · o prazo era 01/10/2026 · R$ 1,3 mi"), r.texto);
  const p = montarResumoDiario({ ...BASE, destaques: [mudanca({ alvo: "proposta", tipo: "proposta_assinada", numero: null, chave: "77", antes: "aberta_concedente", depois: "assinada", valor: null })] });
  assert.ok(p.texto.includes("- Proposta assinada · MUNICIPIO DE SOUSA (SOUSA) · proposta nº 77 · Em análise no concedente → Assinada\n"), p.texto);
});

test("texto do arquivo é escapado no HTML", () => {
  const r = montarResumoDiario({ ...BASE, destaques: [mudanca({ proponente: '<script>alert("x")</script>', programa: "A & B" })] });
  assert.ok(!r.html.includes("<script>"));
  assert.ok(r.html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;") && r.html.includes("A &amp; B"));
  assert.equal(escapar(`'"<>&`), "&#039;&quot;&lt;&gt;&amp;");
});

test("sem mudança na UF, diz isso; destaques têm teto e avisam o resto", () => {
  const vazio = montarResumoDiario({ ...BASE, uf: [], destaques: [] });
  assert.ok(vazio.texto.includes("Nenhuma mudança na PB neste dado.") && vazio.html.includes("Nenhuma mudança na PB neste dado"));
  const muitos = Array.from({ length: 30 }, (_, i) => mudanca({ chave: String(i), numero: String(i) }));
  const cheio = montarResumoDiario({ ...BASE, uf: [{ tipo: "suspensiva_retirada", n: 45, valor: null }], destaques: muitos });
  assert.equal((cheio.texto.match(/^- Suspensiva retirada · /gm) ?? []).length, LIMITE_DESTAQUES);
  assert.ok(cheio.html.includes("Mais 25 no painel."));
});

test("destaques: avanços e alertas antes do registro, pelo valor dentro do grupo", () => {
  const r = montarResumoDiario({
    ...BASE,
    destaques: [
      mudanca({ tipo: "proposta_enviada", alvo: "proposta", chave: "p1", numero: "p1", valor: 9e6, antes: null, depois: "aberta_concedente" }),
      mudanca({ tipo: "tce_instaurada", chave: "c1", numero: "c1", valor: 5e6, antes: null, depois: null }),
      mudanca({ tipo: "primeiro_desembolso", chave: "c2", numero: "c2", valor: 1e6, antes: null }),
      mudanca({ tipo: "suspensiva_retirada", chave: "c3", numero: "c3", valor: 5e5 }),
    ],
  });
  const ordem = [...r.texto.matchAll(/nº (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(ordem, ["c2", "c3", "c1", "p1"]);
});

test("sem data anterior, a frase não inventa uma", () => {
  assert.ok(montarResumoDiario({ ...BASE, desde: null }).texto.includes("(comparado com o dado anterior)"));
});

test("cada linha do quadro leva ao painel filtrado naquele tipo; zero não vira link", () => {
  const r = montarResumoDiario(BASE);
  assert.match(r.html, /<a href="https:\/\/ponteprojetos\.com\.br\/mapa\/painel\?visao=mudancas&amp;tipo=proposta_enviada"[^>]*>820<\/a>/);
  assert.match(
    r.html,
    /<a href="https:\/\/ponteprojetos\.com\.br\/mapa\/painel\?visao=mudancas&amp;uf=PB&amp;tipo=suspensiva_retirada"[^>]*>1<\/a>/,
  );
  // "Contas enviadas" (tce_instaurada) tem 0 no Brasil e na PB: nenhum link levaria a lista vazia.
  assert.equal(r.html.includes("tipo=tce_instaurada"), false);
});

test("o destaque abre o item e o município abre a ficha", () => {
  const r = montarResumoDiario({
    ...BASE,
    destaques: [mudanca({}), mudanca({ alvo: "proposta", chave: "2244524", numero: "10192/2026", tipo: "proposta_enviada", cod_ibge: null, municipio: null })],
  });
  assert.match(r.html, /href="https:\/\/ponteprojetos\.com\.br\/mapa\/instrumento\/900123"[^>]*>Convênio nº 900123</);
  assert.match(r.html, /href="https:\/\/ponteprojetos\.com\.br\/mapa\/proposta\/2244524"[^>]*>Proposta nº 10192\/2026</);
  assert.match(r.html, /href="https:\/\/ponteprojetos\.com\.br\/mapa\/painel\/municipio\/2516201"[^>]*>SOUSA</);
  assert.equal(r.html.includes("/mapa/painel/municipio/null"), false);
  // No texto puro, o endereço do item vai embaixo de cada destaque.
  assert.match(r.texto, /\n {2}https:\/\/ponteprojetos\.com\.br\/mapa\/proposta\/2244524/);
});

test("urlMudancas e urlDoItem escrevem o que o painel e a busca leem", () => {
  assert.equal(urlMudancas("https://x", { tipo: "saldo_parado", uf: "PB" }), "https://x/mapa/painel?visao=mudancas&uf=PB&tipo=saldo_parado");
  assert.equal(urlMudancas("https://x"), "https://x/mapa/painel?visao=mudancas");
  assert.equal(urlDoItem("https://x", { alvo: "convenio", chave: "900123" }), "https://x/mapa/instrumento/900123");
  assert.equal(urlDoItem("https://x", { alvo: "proposta", chave: "2244524" }), "https://x/mapa/proposta/2244524");
});
