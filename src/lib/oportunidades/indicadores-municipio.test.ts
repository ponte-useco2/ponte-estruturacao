import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  formatarValor,
  frasesReferencia,
  indicadoresComNivel,
  lerIndicadores,
  nivelIndicador,
  rotuloRegic,
  type EntradaIndicadores,
  type ItemCatalogo,
  type LinhaIndicador,
  type ReferenciaIndicador,
} from "./indicadores-municipio.ts";

const CATALOGO = (JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "indicadores-municipio.json"), "utf-8")) as { indicadores: ItemCatalogo[] }).indicadores;

const linha = (indicador: string, ano: string, valor: number | null, x: Partial<LinhaIndicador> = {}): LinhaIndicador => ({
  indicador, ano, valor, fonte: "Fonte", url: "https://exemplo", nota: null, posicao_pb: null, total_pb: null, mediana_porte: null, mediana_regiao: null, ...x,
});
const refs = (indicador: string, ano: string, q: [number, number, number], pb?: number, br?: number): ReferenciaIndicador[] => [
  { indicador, ano, recorte: "q1_pb", valor: q[0] },
  { indicador, ano, recorte: "mediana_pb", valor: q[1] },
  { indicador, ano, recorte: "q3_pb", valor: q[2] },
  ...(pb !== undefined ? [{ indicador, ano, recorte: "PB" as const, valor: pb }] : []),
  ...(br !== undefined ? [{ indicador, ano, recorte: "BR" as const, valor: br }] : []),
];

test("catálogo: ids únicos, dimensões conhecidas e indicador-chave sempre com direção", () => {
  const ids = CATALOGO.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  const dims = new Set(["municipio", "economia", "educacao", "saude", "seguranca", "assistencia", "territorio", "governanca"]);
  for (const i of CATALOGO) {
    assert.ok(dims.has(i.dimensao), i.id);
    if (i.chave) assert.ok(i.direcao, `${i.id} é chave e não tem direção`);
  }
});

test("nível: alto só no pior quartil e pior que o Brasil; moderado pior que a mediana ou que o Brasil", () => {
  const ref = { q1: 20, mediana: 30, q3: 40, br: 25 };
  // quanto menor melhor (mortalidade): pior quartil é >= q3
  assert.equal(nivelIndicador(45, "menor", ref)?.nivel, "alto");
  assert.equal(nivelIndicador(45, "menor", { ...ref, br: 50 })?.nivel, "moderado");   // pior quartil, mas melhor que o Brasil
  assert.equal(nivelIndicador(35, "menor", ref)?.nivel, "moderado");
  assert.equal(nivelIndicador(28, "menor", ref)?.nivel, "moderado");                  // melhor que a mediana, pior que o Brasil
  assert.equal(nivelIndicador(28, "menor", ref)?.porque, "pior que o Brasil");
  assert.equal(nivelIndicador(22, "menor", ref)?.nivel, "em_dia");
  // quanto maior melhor (IDEB): pior quartil é <= q1
  assert.equal(nivelIndicador(18, "maior", { ...ref, br: 26 })?.nivel, "alto");
  assert.equal(nivelIndicador(18, "maior", { q1: 20, mediana: 30, q3: 40 })?.nivel, "moderado");   // sem Brasil não chega a alto
  assert.equal(nivelIndicador(35, "maior", ref)?.nivel, "em_dia");
  // diferença de até 5% é empate: 17,5 contra 17,4 do Brasil não é "pior"
  assert.equal(nivelIndicador(17.5, "menor", { q1: 20, mediana: 27.4, q3: 32, br: 17.4 })?.nivel, "em_dia");
  assert.equal(nivelIndicador(18.5, "menor", { q1: 20, mediana: 27.4, q3: 32, br: 17.4 })?.nivel, "moderado");
  assert.equal(nivelIndicador(1.75, "maior", { q1: 1.5, mediana: 1.8, q3: 2.1 })?.nivel, "em_dia");
  // sem como julgar
  assert.equal(nivelIndicador(null, "maior", ref), null);
  assert.equal(nivelIndicador(10, null, ref), null);
  assert.equal(nivelIndicador(10, "maior", { q1: 1, q3: 2 }), null);
});

test("formato: unidade por extenso, % colado, mil R$ em moeda e pontos sem unidade", () => {
  assert.equal(formatarValor(82.25, { unidade: "%", casas: 2 }), "82,25%");
  assert.equal(formatarValor(14.14, { unidade: "por mil nascidos vivos", casas: 2 }), "14,14 por mil nascidos vivos");
  assert.equal(formatarValor(93.61, { unidade: "pontos de 0 a 100", casas: 2 }), "93,61");
  assert.equal(formatarValor(64.59, { unidade: "% dos processos", casas: 1 }), "64,6% dos processos");
  assert.match(formatarValor(2_555_214, { unidade: "mil R$", casas: 0 }), /2,56 bi|2,6 bi|R\$/);
});

function patos(): EntradaIndicadores {
  return {
    catalogo: CATALOGO,
    linhas: [
      linha("populacao_estimada", "2026", 108416),
      linha("mortalidade_infantil", "2022-2024", 14.14, { posicao_pb: 150, total_pb: 223, mediana_porte: 13.1, mediana_regiao: 12.9 }),
      linha("ideb_ai_municipal", "2025", 6.8, { posicao_pb: 20, total_pb: 220 }),
      linha("homicidios_taxa", "2022-2024", 36.19, { posicao_pb: 210, total_pb: 223 }),
      linha("esgoto_atendimento_pct", "2024", null, { nota: "sem serviço de esgoto declarado ao SINISA (não quer dizer zero)" }),
      linha("ish_urbano", "2021", 3, { nota: "classe Média" }),
      linha("contratacao_direta_pct", "2025", 64.59, { posicao_pb: 100, total_pb: 223 }),
      linha("frota_por_mil", "2026-08", 640.1),
      linha("inventado", "2025", 1),
    ],
    referencias: [
      ...refs("mortalidade_infantil", "2022-2024", [10, 12.5, 15], 13.2, 12.9),
      ...refs("ideb_ai_municipal", "2025", [5.2, 5.8, 6.3]),
      ...refs("homicidios_taxa", "2022-2024", [8, 15, 25], 27.8, 21.5),
      ...refs("contratacao_direta_pct", "2024", [50, 60, 70]),   // outro ano: não compara
    ],
    grupo: { porte: "grande", regiao_imediata: "Patos", regiao_intermediaria: "Patos", regic: "Centro Sub-Regional A", arranjo: "Patos/PB", polo: true },
    coletadoEm: "2026-10-05T12:00:00Z",
  };
}

test("Patos: nível, posição e referências de cada indicador", () => {
  const l = lerIndicadores(patos());
  const todos = [...l.municipio, ...l.social.flatMap((b) => b.itens), ...(l.economia?.itens ?? []), ...(l.territorio?.itens ?? []), ...(l.governanca?.itens ?? [])];
  const x = (id: string) => todos.find((i) => i.id === id);
  assert.equal(x("inventado"), undefined);   // fora do catálogo não aparece
  assert.equal(x("mortalidade_infantil")?.nivel, "moderado");
  assert.equal(x("mortalidade_infantil")?.porque, "pior que a mediana da PB e que o Brasil");
  assert.equal(x("mortalidade_infantil")?.posicao, "150º de 223");
  assert.equal(x("mortalidade_infantil")?.porte, "13,1");
  assert.equal(x("homicidios_taxa")?.nivel, "alto");
  assert.equal(x("ideb_ai_municipal")?.nivel, "em_dia");
  assert.equal(x("contratacao_direta_pct")?.nivel, null);   // referência de outro ano
  assert.equal(x("esgoto_atendimento_pct")?.texto, "sem informação");
  assert.match(x("esgoto_atendimento_pct")?.nota ?? "", /não quer dizer zero/);
  assert.equal(x("ish_urbano")?.texto, "Média");
  assert.equal(x("ish_urbano")?.nivel, null);   // não é chave
  assert.equal(x("frota_por_mil")?.nivel, null);
  assert.deepEqual(l.social.map((b) => b.dimensao), ["saude", "educacao", "seguranca"]);
  assert.deepEqual(l.contagem, { alto: 1, moderado: 1, em_dia: 1 });
  assert.deepEqual(indicadoresComNivel(l).map((i) => i.id), ["homicidios_taxa", "mortalidade_infantil", "ideb_ai_municipal"]);
  assert.equal(frasesReferencia(x("homicidios_taxa")!), "PB 27,8; mediana dos municípios da PB 15,0; Brasil 21,5; 210º de 223 na PB (1º = melhor)");
});

test("REGIC: código vira o nome da hierarquia, e código desconhecido passa como veio", () => {
  assert.equal(rotuloRegic("3A"), "Centro Sub-Regional A (3A)");
  assert.equal(rotuloRegic("9Z"), "9Z");
});

// Onda 8, A (09/10/2026): creche com nível; pré-escola e MapBiomas informativos. Os números são os da rodada local
// de 09/10/2026, que bateram com os estudos D3b e D3c da onda 5.

test("catálogo da onda 8: creche é chave (maior é melhor); pré-escola e MapBiomas são contexto, sem nível", () => {
  const item = (id: string) => CATALOGO.find((i) => i.id === id);
  assert.deepEqual([item("creche_0a3")?.dimensao, item("creche_0a3")?.chave, item("creche_0a3")?.direcao], ["educacao", true, "maior"]);
  assert.deepEqual([item("pre_escola_4a5")?.chave, item("pre_escola_4a5")?.direcao], [false, null]);
  for (const id of ["vegetacao_nativa_pct", "vegetacao_nativa_var10_pp", "agropecuaria_pct", "area_urbanizada_pct"]) {
    assert.equal(item(id)?.dimensao, "territorio", id);
    assert.equal(item(id)?.chave, false, id);
    assert.ok(item(id)?.nota, `${id} sem nota de método`);
  }
  // só a variação tem direção (perder vegetação é o pior): é ela que ganha posição na PB
  assert.equal(item("vegetacao_nativa_var10_pp")?.direcao, "maior");
  assert.equal(item("vegetacao_nativa_pct")?.direcao, null);
  assert.match(item("creche_0a3")?.nota ?? "", /abaixo da cobertura real/);
  assert.match(item("creche_0a3")?.nota ?? "", /Lei 15\.388\/2026/);
  assert.match(item("vegetacao_nativa_var10_pp")?.nota ?? "", /Não é a taxa de desmatamento/);
});

test("formato: variação em pontos percentuais leva o sinal; fatia da área e taxa por 100 com a unidade", () => {
  const pp = { unidade: "p.p. da área do município", casas: 1 };
  assert.equal(formatarValor(0.91, pp), "+0,9 p.p. da área do município");
  assert.equal(formatarValor(-11.41, pp), "-11,4 p.p. da área do município");
  assert.equal(formatarValor(-0.04, pp), "0,0 p.p. da área do município");   // arredonda a zero: sem sinal
  assert.equal(formatarValor(58.13, { unidade: "% da área do município", casas: 1 }), "58,1% da área do município");
  assert.equal(formatarValor(35.98, { unidade: "por 100 crianças de 0 a 3 anos", casas: 1 }), "36,0 por 100 crianças de 0 a 3 anos");
  assert.equal(formatarValor(-5.94, { unidade: "%", casas: 1 }), "-5,9%");   // fora do p.p., nada muda
  assert.equal(formatarValor(5.94, { unidade: "%", casas: 1 }), "5,9%");
});

function onda8(ibge: "patos" | "sousa"): EntradaIndicadores {
  const v = ibge === "patos" ? { creche: 35.9789, pos: 126, pre: 90.8804, var10: 0.9057 } : { creche: 15.4481, pos: 220, pre: 89.6313, var10: -11.4098 };
  return {
    catalogo: CATALOGO,
    linhas: [
      linha("creche_0a3", "2025", v.creche, { posicao_pb: v.pos, total_pb: 223, nota: "1.913 matrículas de 0 a 3 anos em 2025 para 5.317 crianças de 0 a 3 anos no Censo 2022" }),
      linha("pre_escola_4a5", "2025", v.pre),
      linha("vegetacao_nativa_pct", "2025", 58.1254),
      linha("vegetacao_nativa_var10_pp", "2015-2025", v.var10, { posicao_pb: ibge === "patos" ? 26 : 191, total_pb: 223 }),
      linha("agropecuaria_pct", "2025", 35.3034),
      linha("area_urbanizada_pct", "2025", 4.6582, { nota: "2.203 ha em 2025" }),
    ],
    referencias: [
      ...refs("creche_0a3", "2025", [29.9549, 38.149, 48.3028], 34.4467, 38.8399),
      ...refs("pre_escola_4a5", "2025", [89.99, 99.2669, 112.965], 90.0937, 92.2272),
      ...refs("vegetacao_nativa_pct", "2025", [31.8163, 55.7531, 68.2181], 55.0942, 64.8543),
      ...refs("vegetacao_nativa_var10_pp", "2015-2025", [-9.3133, -5.2711, -1.447], -5.9369, -3.2394),
      ...refs("agropecuaria_pct", "2025", [29.6811, 41.6259, 64.8109], 42.5269, 32.128),
      ...refs("area_urbanizada_pct", "2025", [0.3264, 0.574, 1.1036], 1.1146, 0.5218),
    ],
    grupo: null,
    coletadoEm: "2026-10-09T15:00:00Z",
  };
}

test("onda 8: a creche ganha nível pela regra de sempre; pré-escola e MapBiomas aparecem sem nível", () => {
  const l = lerIndicadores(onda8("patos"));
  const educacao = l.social.find((b) => b.dimensao === "educacao")?.itens ?? [];
  const x = (id: string) => [...educacao, ...(l.territorio?.itens ?? [])].find((i) => i.id === id);
  assert.equal(x("creche_0a3")?.nivel, "moderado");
  assert.equal(x("creche_0a3")?.porque, "pior que a mediana da PB e que o Brasil");
  assert.equal(x("creche_0a3")?.texto, "36,0 por 100 crianças de 0 a 3 anos");
  assert.equal(frasesReferencia(x("creche_0a3")!), "PB 34,4; mediana dos municípios da PB 38,1; Brasil 38,8; 126º de 223 na PB (1º = melhor)");
  assert.match(x("creche_0a3")?.nota ?? "", /^1\.913 matrículas .*Censo 2022\. Matrículas de crianças de 0 a 3 anos/);
  assert.equal(x("pre_escola_4a5")?.nivel, null);
  assert.deepEqual(educacao.map((i) => i.id), ["creche_0a3", "pre_escola_4a5"]);
  // território: os quatro do MapBiomas, informativos, na ordem do catálogo
  assert.deepEqual(l.territorio?.itens.map((i) => [i.id, i.nivel]), [
    ["vegetacao_nativa_pct", null],
    ["vegetacao_nativa_var10_pp", null],
    ["agropecuaria_pct", null],
    ["area_urbanizada_pct", null],
  ]);
  assert.equal(x("vegetacao_nativa_var10_pp")?.texto, "+0,9 p.p. da área do município");
  assert.equal(x("vegetacao_nativa_var10_pp")?.pb, "-5,9");
  assert.equal(x("vegetacao_nativa_var10_pp")?.posicao, "26º de 223");
  assert.equal(x("area_urbanizada_pct")?.texto, "4,66% da área do município");
  assert.equal(x("area_urbanizada_pct")?.br, "0,52");
  assert.deepEqual(l.contagem, { alto: 0, moderado: 1, em_dia: 0 });
  assert.deepEqual(indicadoresComNivel(l).map((i) => i.id), ["creche_0a3"]);
  // Sousa: 15,4 por 100, no pior quartil da PB e pior que o Brasil
  const sousa = lerIndicadores(onda8("sousa")).social.flatMap((b) => b.itens).find((i) => i.id === "creche_0a3");
  assert.equal(sousa?.nivel, "alto");
  assert.equal(sousa?.porque, "entre os 25% piores da PB e pior que o Brasil");
});
