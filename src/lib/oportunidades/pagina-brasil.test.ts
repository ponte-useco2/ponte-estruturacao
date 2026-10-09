import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  ABAS_BRASIL,
  MACRORREGIAO,
  URL_CSV_BRASIL,
  URL_RELATORIO_BRASIL,
  abaDoBrasil,
  anoDeReferencia,
  fontesDoBrasil,
  gruposDeCor,
  janelasPorUf,
  metodoDoBrasil,
  nivelNoBrasil,
  partesDoRelatorioBrasil,
  podeAbaBrasil,
  ufsLadoALado,
  urlBrasil,
  type Malha,
} from "./pagina-brasil.ts";
import type { LinhaTerritorio } from "./pagina-uf.ts";
import type { LinhaDesfecho } from "./painel.ts";
import type { LinhaEspecialAno } from "./pix.ts";

const t = (recorte: string, dimensao: LinhaTerritorio["dimensao"], chave: string, n: number, valor: number, vivo: boolean | null = null, extra: Partial<LinhaTerritorio> = {}): LinhaTerritorio => ({
  recorte, dimensao, chave, vivo, n, em_execucao: 0, valor, desembolsado: 0, municipios: null, proponentes: null, ...extra,
});

test("U2: abas e endereço do Brasil", () => {
  assert.equal(abaDoBrasil("tempos", 0), "resumo");
  assert.equal(abaDoBrasil("estados", 0), "estados");
  assert.equal(urlBrasil(), "/mapa/brasil");
  assert.equal(urlBrasil("estados"), "/mapa/brasil?aba=estados");
  assert.equal(Object.keys(MACRORREGIAO).length, 27);
});

test("B11: o Brasil tem «Dinheiro federal» e «Relatório e dados», como os outros níveis", () => {
  assert.deepEqual(ABAS_BRASIL.map((a) => a.nome), ["Resumo", "As 27 UFs", "Dinheiro federal", "Tempos e funil", "Relatório e dados"]);
  assert.equal(abaDoBrasil("relatorio", 0), "resumo", "o relatório é do aprovado, como na UF");
  assert.equal(abaDoBrasil("relatorio", 1), "relatorio");
  assert.equal(urlBrasil("relatorio"), "/mapa/brasil?aba=relatorio");
});

test("U2: as 27 UFs em ordem alfabética, só com o comparável (os vivos)", () => {
  const territorio = [
    t("PB", "total", "vivos", 2699, 5.6e9, null, { municipios: 222 }),
    t("PB", "situacao", "Em execução", 1790, 4.7e9, true),
    t("PB", "situacao", "Prestação de Contas Aprovada", 5000, 2e9, false),   // morto: fora da comparação
    t("PB", "situacao", "Aguardando Prestação de Contas", 300, 1e8, true),
    t("SP", "total", "vivos", 9000, 2e10, null, { municipios: 600 }),
    t("SP", "situacao", "Em execução", 6000, 1e10, true),
  ];
  const d = (uf: string, ano: number, enviadas: number, assinadas: number): LinhaDesfecho => ({
    cod_programa: null, programa: null, orgao_sup: null, ano_envio: ano, uf, enviadas, assinadas, reprovadas: 0, reprovadas_lote: 0, impedimento: 0,
    impedimento_lote: 0, eliminadas: 0, abertas_concedente: 0, limbo: 0, abertas_proponente: 0, aguardando_assinatura: 0, com_emenda: 0, assinadas_com_emenda: 0, valor_pedido: 0,
  });
  const pix = [{ recorte: "PB", ano: 2026, pago: 140e6 }, { recorte: "PB", ano: 2025, pago: 217e6 }] as LinhaEspecialAno[];
  const l = ufsLadoALado(territorio, [d("PB", 2026, 1223, 241), d("PB", 2025, 2370, 439)], pix, janelasPorUf([{ uf: "PB" }, { uf: "PB" }, { uf: "SP" }, { uf: null }]), 2026);
  assert.equal(l.length, 27);
  assert.deepEqual(l.slice(0, 3).map((u) => u.nome), ["Acre", "Alagoas", "Amapá"]);
  const pb = l.find((u) => u.sigla === "PB");
  assert.deepEqual(pb && [pb.vivos, pb.emExecucao, pb.prestandoContas, pb.municipiosVivos, pb.propostasAno, pb.pixPagoAno, pb.janelas, pb.regiao], [2699, 1790, 300, 222, 1223, 140e6, 2, "NE"]);
  const ac = l.find((u) => u.sigla === "AC");
  assert.deepEqual(ac && [ac.vivos, ac.propostasAno, ac.pixPagoAno, ac.janelas], [0, null, null, 0]);
});

test("U2: cor só por região, nunca mais de 5 grupos", () => {
  const g = gruposDeCor(["João Pessoa", "Campina Grande", "Patos", "Sousa - Cajazeiras"]);
  assert.deepEqual([...g.values()], [0, 1, 2, 3]);
  assert.equal(gruposDeCor(["a", "b", "c", "d", "e", "f"]).get("f"), 0);
});

test("U2: as malhas geradas do IBGE têm as 27 UFs e os 223 municípios da PB", () => {
  const br = JSON.parse(readFileSync(new URL("./malhas/brasil-uf.json", import.meta.url), "utf-8")) as Malha;
  const pb = JSON.parse(readFileSync(new URL("./malhas/pb-municipios.json", import.meta.url), "utf-8")) as Malha;
  assert.deepEqual(br.areas.map((a) => a.id).sort(), Object.keys(MACRORREGIAO).sort());
  assert.equal(pb.areas.length, 223);
  assert.ok(pb.areas.every((a) => /^25\d{5}$/.test(a.id) && a.d.startsWith("M")));
  assert.match(br.viewBox, /^0 0 \d+ \d+$/);
});

test("C1b: o relatório do Brasil abre com o mesmo nível da aba «Relatório e dados»", () => {
  const minimo = ABAS_BRASIL.find((a) => a.id === "relatorio")?.minimo;
  assert.equal(minimo, 1);
  assert.equal(podeAbaBrasil("relatorio", 0), false, "quem não vê a aba é levado à página do Brasil");
  assert.equal(podeAbaBrasil("relatorio", 1), true);
  assert.equal(podeAbaBrasil("relatorio", 3), true);
  assert.equal(podeAbaBrasil("resumo", 0), true);
  // Coerente com a escolha da aba: o nível que abre a aba é o que abre a rota.
  for (const nivel of [0, 1, 2, 3] as const) assert.equal(podeAbaBrasil("relatorio", nivel), abaDoBrasil("relatorio", nivel) === "relatorio");
  // A página e a rota tiram o nível da mesma regra: todo aprovado abre o relatório; o administrador também.
  assert.equal(nivelNoBrasil({ aprovado: true, administrador: false }), 1);
  assert.equal(nivelNoBrasil({ aprovado: true, administrador: true }), 3);
  assert.ok(podeAbaBrasil("relatorio", nivelNoBrasil({ aprovado: true, administrador: false })));
  assert.equal(URL_RELATORIO_BRASIL, "/mapa/brasil/relatorio");
  assert.equal(URL_CSV_BRASIL, "/mapa/brasil/csv");
});

test("C4a: no Brasil, quem não tem cadastro aprovado é 0 — Tempos e funil, relatório e CSV pedem 1", () => {
  // Achado B1 da R3: antes, todo não administrador era 1, e o público herdaria Tempos e funil e o relatório.
  assert.equal(nivelNoBrasil({ aprovado: false, administrador: false }), 0);
  assert.equal(nivelNoBrasil({ aprovado: false, administrador: true }), 0, "sem aprovação não há nível, nem de administrador");
  const publico = nivelNoBrasil({ aprovado: false, administrador: false });
  assert.equal(podeAbaBrasil("tempos", publico), false);
  assert.equal(podeAbaBrasil("relatorio", publico), false);
  assert.equal(abaDoBrasil("tempos", publico), "resumo");
  assert.deepEqual(partesDoRelatorioBrasil(publico), ["resumo", "estados", "dinheiro"]);
  assert.deepEqual(
    ABAS_BRASIL.filter((a) => a.minimo <= publico).map((a) => a.id),
    ["resumo", "estados", "dinheiro"],
  );
});

test("C1b: as partes do relatório seguem a ordem das abas e nunca mostram o que o nível não vê", () => {
  assert.deepEqual(partesDoRelatorioBrasil(1), ["resumo", "estados", "dinheiro", "tempos"]);
  assert.deepEqual(partesDoRelatorioBrasil(3), ["resumo", "estados", "dinheiro", "tempos"]);
  assert.deepEqual(partesDoRelatorioBrasil(0), ["resumo", "estados", "dinheiro"], "«Tempos e funil» é do aprovado");
  assert.ok(!partesDoRelatorioBrasil(3).includes("relatorio"), "a aba do relatório não entra nele mesmo");
});

test("C1b: o ano das contas «do ano» vem da referência, do dado ou de hoje", () => {
  assert.equal(anoDeReferencia({ referencia: "2026-10-07", dado_ate: "2025-12-31T00:00:00Z" }, "2027-01-02"), 2026);
  assert.equal(anoDeReferencia({ referencia: null, dado_ate: "2025-12-31T00:00:00Z" }, "2027-01-02"), 2025);
  assert.equal(anoDeReferencia({ referencia: null, dado_ate: null }, "2027-01-02"), 2027);
  // A4x: o arquivo das 22h30 de 31/12 em Brasília é do ano que termina, mesmo já sendo 1º de janeiro em UTC.
  assert.equal(anoDeReferencia({ referencia: null, dado_ate: "2026-01-01T01:30:00+00:00" }, "2026-01-02"), 2025);
});

test("C1b: fontes com a data de cada uma e método em texto neutro", () => {
  const f = fontesDoBrasil({ painel: "2026-10-07T03:00:00Z", pix: "2026-10-06", janelas: null });
  assert.deepEqual(f.map((x) => x.data), ["2026-10-07", "2026-10-06", null, null]);
  // A4x: o carimbo vira o dia de Brasília (o arquivo de 07/10, 22h34, não sai como 08/10); a data pura passa direto.
  const noite = fontesDoBrasil({ painel: "2026-10-08T01:34:18+00:00", pix: "2026-10-06T03:00:00+00:00", janelas: "2026-10-08T01:34:18+00:00" });
  assert.deepEqual(noite.map((x) => x.data), ["2026-10-07", "2026-10-06", "2026-10-07", null]);
  assert.match(f[0].fonte, /Transferegov/);
  assert.match(f[1].fonte, /Pix/);
  assert.match(f[3].fonte, /IBGE/);
  const metodo = metodoDoBrasil(2026);
  assert.ok(metodo.some((m) => m.includes("ordem alfabética, sem classificação de melhor ou pior")));
  assert.ok(metodo.some((m) => m.includes("tomada de contas especial")), "a tomada de contas especial vai por extenso");
  assert.ok(metodo.some((m) => m.includes("2026")));
  const textos = [...f.flatMap((x) => [x.fonte, x.nota]), ...metodo];
  assert.ok(textos.every((t) => !/\bTCE\b/.test(t)), "«TCE» solto não entra: é o tribunal (TCE-PB) ou vai por extenso");
  assert.ok(textos.every((t) => !/\b(melhor|pior)es? (UF|estado)/i.test(t)), "nenhuma UF é apontada como melhor ou pior");
});
