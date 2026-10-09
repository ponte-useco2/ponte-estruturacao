import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_DESTAQUES,
  escapar,
  escolherRodadas,
  fraseRodadasNoPe,
  linhaRodada,
  montarResumoDiario,
  quandoConcluiu,
  tituloRodadas,
  urlDoItem,
  urlMudancas,
  urlRodadas,
  type EntradaResumo,
} from "./resumo-diario.ts";
import type { MudancaPainel } from "./painel.ts";
import { JOBS_RODADAS, avaliarRodada, type ExecucaoAberta, type LeituraRodada, type LinhaRodada } from "./rodadas.ts";

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
  // O rótulo do tipo zerado (B14b, 08/10/2026: a tomada de contas especial por extenso) não entra na tabela.
  assert.ok(!r.texto.includes("Tomada de contas especial instaurada"));
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

// ================================================================ a saúde das rodadas (09/10/2026, onda 10, B)
// As linhas saem de `avaliarRodada` com os 14 jobs reais: o e-mail usa a regra da tela, sem cópia.

/** 09/10/2026, 12h00 UTC (09h00 em Brasília): a hora em que o resumo costuma sair. */
const AGORA = Date.parse("2026-10-09T12:00:00Z");
const horasAntes = (h: number) => new Date(AGORA - h * 3600 * 1000).toISOString();

/** A última concluída `h` horas antes de AGORA, com o `contagens` dado. */
function concluida(h: number, contagens: Record<string, unknown> = {}, abertas: ExecucaoAberta[] = []): LeituraRodada {
  return { estado: "ok", ultima: { id: 1, iniciada_em: horasAntes(h + 0.2), concluida_em: horasAntes(h), contagens }, abertas };
}

/** As 14 linhas: todas concluídas há 1 h, menos as trocadas. */
function rodadas(trocas: Record<string, LeituraRodada> = {}): LinhaRodada[] {
  return JOBS_RODADAS.map((j) => avaliarRodada(j, trocas[j.id] ?? concluida(1), AGORA));
}

const URL_RODADAS = "https://ponteprojetos.com.br/mapa/painel/rodadas";

test("rodadas: sem o campo, o e-mail é o de antes", () => {
  const r = montarResumoDiario(BASE);
  assert.equal(r.texto.includes("rodadas"), false);
  assert.equal(r.html.includes("/mapa/painel/rodadas"), false);
  assert.equal(urlRodadas("https://x"), "https://x/mapa/painel/rodadas");
});

test("rodadas: as 14 em dia viram uma linha só, no pé, depois dos botões", () => {
  const bloco = escolherRodadas(rodadas());
  assert.deepEqual(bloco, { tipo: "em_dia", total: 14, naoLidas: [] });
  const r = montarResumoDiario({ ...BASE, rodadas: bloco });
  assert.ok(r.texto.includes(`\n✓ As 14 rodadas em dia.\n  ${URL_RODADAS}\n\n—\n`), r.texto);
  assert.match(r.html, /✓<\/span> As 14 rodadas em dia\. <a href="https:\/\/ponteprojetos\.com\.br\/mapa\/painel\/rodadas"[^>]*>Ver as rodadas<\/a>/);
  const i = r.html.indexOf("As 14 rodadas em dia");
  assert.ok(i > r.html.indexOf("Abrir no painel (PB)") && i < r.html.indexOf("Resumo automático do Painel"));
  assert.equal(r.html.includes("atenção"), false);
  // O assunto não muda: no celular, o fim dele já fica cortado.
  assert.equal(r.assunto, montarResumoDiario(BASE).assunto);
});

test("rodadas: atrasadas e com aviso, uma por linha, atrasadas primeiro, no topo do e-mail", () => {
  const bloco = escolherRodadas(
    rodadas({
      tce: concluida(50),
      // A fiscal real de 03/10: duas fontes com erro. O nome das fontes fica na tela, não no e-mail.
      fiscal: concluida(2, { municipios: 223, fontes_com_erro: { siconfi_rreo1: 2, siconfi_rreo9: 1 } }),
      pix: concluida(7 * 24 + 9),
      "exigencia:suspensiva": { estado: "ok", ultima: null, abertas: [] },
    }),
  );
  assert.equal(bloco.tipo, "com_problema");
  if (bloco.tipo !== "com_problema") return;
  assert.deepEqual(
    bloco.problemas.map((l) => l.job.id),
    ["tce", "pix", "fiscal", "exigencia:suspensiva"],
  );
  assert.equal(tituloRodadas(bloco), "4 de 14 rodadas pedem atenção");

  const r = montarResumoDiario({ ...BASE, rodadas: bloco });
  assert.ok(
    r.texto.includes(
      [
        "4 de 14 rodadas pedem atenção:",
        "- ▲ Dinheiro federal no TCE-PB: atrasada · última concluída em 07/10/2026 às 07:00, há 2 dias",
        "- ▲ Pix e fundo a fundo: atrasada · última concluída em 02/10/2026 às 00:00, há 7 dias",
        "- ! Capacidade fiscal (PB): com aviso · última concluída em 09/10/2026 às 07:00, há 2 h",
        "- ! Exigências da suspensiva: com aviso · nenhuma execução concluída",
        `Saúde das rodadas: ${URL_RODADAS}`,
      ].join("\n"),
    ),
    r.texto,
  );
  // No topo: antes do quadro das mudanças, no texto e no HTML. Sem a linha do pé.
  assert.ok(r.texto.indexOf("pedem atenção") < r.texto.indexOf("Brasil: 832"));
  assert.ok(r.html.indexOf("pedem atenção") < r.html.indexOf(">Mudança</th>"));
  assert.equal(r.texto.includes("rodadas em dia"), false);
  assert.match(r.html, /<a href="https:\/\/ponteprojetos\.com\.br\/mapa\/painel\/rodadas"[^>]*>Ver a saúde das rodadas<\/a>/);
  assert.match(r.html, /▲<\/span> Dinheiro federal no TCE-PB · <span[^>]*>atrasada<\/span>/);
  assert.ok(r.html.includes("última concluída em 07/10/2026 às 07:00, há 2 dias"));
  // O detalhe dos avisos fica na tela.
  assert.equal(r.texto.includes("siconfi"), false);
  assert.equal(r.html.includes("siconfi"), false);
  // Uma só: o verbo no singular.
  const um = escolherRodadas(rodadas({ tce: concluida(50) }));
  assert.ok(um.tipo === "com_problema" && tituloRodadas(um) === "1 de 14 rodadas pede atenção");
});

test("rodadas: o e-mail segue o prazo da tela, minuto a minuto", () => {
  // Radar diário: 24 h + 8 h de folga. No limite, em dia; um minuto depois, atrasada.
  assert.equal(escolherRodadas(rodadas({ radar: concluida(32) })).tipo, "em_dia");
  const tarde = escolherRodadas(rodadas({ radar: concluida(32 + 1 / 60) }));
  assert.ok(tarde.tipo === "com_problema" && tarde.problemas[0].job.id === "radar" && tarde.problemas[0].estado === "atrasada");
  // A coleta assistida velha não atrasa: a regra é a mesma da tela.
  assert.equal(escolherRodadas(rodadas({ "al:obras": concluida(900) })).tipo, "em_dia");
});

test("rodadas: a 'gravando' parada e o erro mais novo entram, sem o texto do erro", () => {
  const bloco = escolherRodadas(
    rodadas({
      painel: concluida(1, {}, [{ id: 9, status: "gravando", iniciada_em: horasAntes(5) }]),
      radar: concluida(3, {}, [{ id: 8, status: "erro", iniciada_em: horasAntes(0.5) }]),
    }),
  );
  assert.ok(bloco.tipo === "com_problema");
  const r = montarResumoDiario({ ...BASE, rodadas: bloco });
  assert.ok(r.texto.includes("- ! Radar de propostas: com aviso · última concluída em 09/10/2026 às 06:00, há 3 h"), r.texto);
  assert.ok(r.texto.includes("- ! Painel de execução: com aviso · última concluída em 09/10/2026 às 08:00, há 1 h"), r.texto);
  // O aviso da tela ("a tentativa de … terminou em erro") e a coluna `erro` não chegam ao e-mail.
  assert.equal(r.texto.includes("terminou em erro"), false);
  assert.equal(r.html.includes("terminou em erro"), false);
});

test("rodadas: a leitura que falhou vira uma nota no pé, e o e-mail sai inteiro", () => {
  assert.deepEqual(escolherRodadas(null), { tipo: "falhou" });
  assert.deepEqual(escolherRodadas([]), { tipo: "falhou" });
  // Nenhuma linha respondeu (o banco caiu no meio): é falha da leitura, não "14 não lidas".
  const nada = JOBS_RODADAS.map((j) => avaliarRodada(j, { estado: "nao_lido", motivo: "falha" }, AGORA));
  assert.deepEqual(escolherRodadas(nada), { tipo: "falhou" });

  const r = montarResumoDiario({ ...BASE, rodadas: { tipo: "falhou" } });
  assert.ok(r.texto.includes(`\n? A saúde das rodadas não pôde ser lida agora.\n  ${URL_RODADAS}\n\n—\n`), r.texto);
  assert.match(r.html, /\?<\/span> A saúde das rodadas não pôde ser lida agora\. <a href="https:\/\/ponteprojetos\.com\.br\/mapa\/painel\/rodadas"/);
  // O resto do e-mail é o mesmo.
  const sem = montarResumoDiario(BASE);
  assert.equal(r.assunto, sem.assunto);
  assert.ok(r.texto.startsWith(sem.texto.split("\n—\n")[0]));
  assert.ok(r.html.includes("Destaques na PB") && r.html.includes(">Mudança</th>"));
});

test("rodadas: linha não lida é nomeada, sem virar problema nem falha", () => {
  const so = escolherRodadas(rodadas({ "exigencia:assinatura": { estado: "nao_lido", motivo: "falha" } }));
  assert.deepEqual(so, { tipo: "em_dia", total: 14, naoLidas: ["Exigências antes da assinatura"] });
  assert.equal(so.tipo !== "com_problema" && fraseRodadasNoPe(so), "13 de 14 rodadas em dia; 1 não lida agora: Exigências antes da assinatura.");
  const r = montarResumoDiario({ ...BASE, rodadas: so });
  // Com linha não lida, a marca é "?", não "✓".
  assert.ok(r.texto.includes("\n? 13 de 14 rodadas em dia; 1 não lida agora: Exigências antes da assinatura.\n"), r.texto);

  const junto = escolherRodadas(
    rodadas({ tce: concluida(50), "al:obras": { estado: "nao_lido", motivo: "ausente" } }),
  );
  const t = montarResumoDiario({ ...BASE, rodadas: junto }).texto;
  assert.ok(t.includes("1 de 14 rodadas pede atenção:\n- ▲ Dinheiro federal no TCE-PB"), t);
  assert.ok(t.includes("\nNão lida agora: Acesso Livre: obras.\n"), t);
});

test("rodadas: a linha de um job diz nome, estado, quando concluiu e há quanto tempo", () => {
  const [tce] = rodadas({ tce: concluida(50) }).filter((l) => l.job.id === "tce");
  assert.equal(linhaRodada(tce), "▲ Dinheiro federal no TCE-PB: atrasada · última concluída em 07/10/2026 às 07:00, há 2 dias");
  assert.equal(quandoConcluiu({ concluidaEm: null, idadeH: null }), "nenhuma execução concluída");
  assert.equal(quandoConcluiu({ concluidaEm: "2026-10-09T11:49:06+00:00", idadeH: 0.2 }), "última concluída em 09/10/2026 às 08:49, há 12 min");
});
