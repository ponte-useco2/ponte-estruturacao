import test from "node:test";
import assert from "node:assert/strict";
import {
  CORTE_RELEVANTE,
  avaliar,
  elegivel,
  relevante,
  ehTituloDisfarcadoDeTema,
  temasNormalizados,
  type JanelaElegivel,
  type Perguntante,
} from "./elegibilidade.ts";

const janela = (over: Partial<JanelaElegivel> = {}): JanelaElegivel => ({
  tiposElegiveis: ["empresa"],
  geografia: ["BR"],
  temas: [],
  ...over,
});

const quem = (over: Partial<Perguntante> = {}): Perguntante => ({
  tipo: "empresa",
  uf: "PB",
  temas: [],
  ...over,
});

// =============================================================================
// O portão duro — o caso que o radar testa em
// tests/test_pipeline.py::test_ineligible_organization_type_blocks_match
// =============================================================================

test("tipo incompatível barra, e nenhuma afinidade compensa", () => {
  const j = janela({ tiposElegiveis: ["municipio"], temas: ["inovacao", "saneamento"] });
  const p = quem({ tipo: "empresa", temas: ["inovacao", "saneamento"] });

  assert.equal(elegivel(j, p), false);
  const a = avaliar(j, p);
  assert.equal(a.elegivel, false);
  assert.equal(a.pontuacao, 0, "o radar devolve ponte_score 0 no mesmo caso");
  assert.deepEqual(a.motivos, []);
});

test("tipo compatível passa o portão", () => {
  assert.ok(elegivel(janela({ tiposElegiveis: ["municipio", "estado"] }), quem({ tipo: "estado" })));
});

test("janela sem tipos declarados NÃO barra: dado incompleto não vira exclusão", () => {
  const j = janela({ tiposElegiveis: [] });
  assert.ok(elegivel(j, quem({ tipo: "pessoa_fisica" })));
  // Mas também não afirma compatibilidade de proponente que o dado não sustenta.
  assert.ok(!avaliar(j, quem()).motivos.includes("aceita o seu tipo de proponente"));
});

// =============================================================================
// A pontuação — mesmos pesos do radar: 40 elegibilidade + 20 geografia +
// 15 por tema, teto de 40.
// =============================================================================

test("só elegibilidade, sem geografia nem tema: 40", () => {
  const a = avaliar(janela({ geografia: ["SP"] }), quem({ uf: "PB" }));
  assert.equal(a.pontuacao, 40);
});

test("elegibilidade mais território: 60", () => {
  const a = avaliar(janela({ geografia: ["PB"] }), quem({ uf: "PB" }));
  assert.equal(a.pontuacao, 60);
  assert.ok(a.motivos.includes("território compatível"));
});

test("BR alcança qualquer UF, e também quem não declarou a sua", () => {
  assert.equal(avaliar(janela({ geografia: ["BR"] }), quem({ uf: "SP" })).pontuacao, 60);
  assert.equal(avaliar(janela({ geografia: ["BR"] }), quem({ uf: null })).pontuacao, 60);
  assert.ok(avaliar(janela({ geografia: ["BR"] }), quem()).motivos.includes("abrangência nacional"));
});

test("UF não declarada não alcança janela de UF específica", () => {
  assert.equal(avaliar(janela({ geografia: ["PB"] }), quem({ uf: null })).pontuacao, 40);
});

test("dois temas: o caso de ponte_score >= 80 do radar", () => {
  const j = janela({ geografia: ["BR"], temas: ["economia_circular", "sustentabilidade"] });
  const p = quem({ temas: ["economia_circular", "sustentabilidade"] });
  const a = avaliar(j, p);
  // 40 + 20 + min(40, 15*2) = 90
  assert.equal(a.pontuacao, 90);
  assert.ok(a.pontuacao >= 80, "o radar assertGreaterEqual(80) no mesmo cenário");
  assert.ok(a.motivos.includes("combina em 2 assuntos"));
});

test("o peso de tema tem teto de 40: três acertos não passam disso", () => {
  const j = janela({ geografia: ["BR"], temas: ["a", "b", "c"] });
  const p = quem({ temas: ["a", "b", "c"] });
  assert.equal(avaliar(j, p).pontuacao, 40 + 20 + 40);
});

test("um tema só soma 15", () => {
  const j = janela({ geografia: ["SP"], temas: ["inovacao"] });
  const p = quem({ uf: "PB", temas: ["inovacao"] });
  const a = avaliar(j, p);
  assert.equal(a.pontuacao, 55);
  assert.ok(a.motivos.includes("combina em 1 assunto"));
});

test("tema da janela que a pessoa não marcou não soma", () => {
  const j = janela({ geografia: ["SP"], temas: ["inovacao"] });
  assert.equal(avaliar(j, quem({ uf: "PB", temas: ["turismo"] })).pontuacao, 40);
});

// =============================================================================
// O corte de relevância
// =============================================================================

test("elegível já alcança o corte; inelegível nunca alcança", () => {
  assert.equal(CORTE_RELEVANTE, 40);
  assert.ok(relevante(avaliar(janela({ geografia: ["SP"] }), quem({ uf: "PB" }))));
  assert.ok(!relevante(avaliar(janela({ tiposElegiveis: ["osc"] }), quem({ tipo: "empresa" }))));
});

// =============================================================================
// Normalização dos temas do v2
// =============================================================================

test("inovac e inovacao são o MESMO tema, não dois", () => {
  // No catálogo de 10/09/2026 o v2 traz as duas grafias: 12 e 10 ocorrências.
  const a = temasNormalizados(["inovac"]);
  const b = temasNormalizados(["inovacao"]);
  assert.deepEqual(a, b);
  assert.equal(a.length, 1);
  assert.equal(temasNormalizados(["inovac", "inovacao"]).length, 1, "não duplica");
});

test("tema desconhecido é ignorado, e não vira id novo", () => {
  assert.deepEqual(temasNormalizados(["assunto_que_nao_existe"]), []);
  assert.deepEqual(temasNormalizados(undefined), []);
  assert.deepEqual(temasNormalizados([]), []);
});

test("a janela normalizada é o que entra na pontuação", () => {
  const j = janela({ geografia: ["SP"], temas: temasNormalizados(["inovac"]) });
  // A pessoa marcou o id estável; a janela trouxe o radical. Precisam casar.
  const p = quem({ uf: "PB", temas: temasNormalizados(["inovacao"]) });
  assert.equal(avaliar(j, p).pontuacao, 55, "sem normalizar, daria 40");
});

test("título de chamada disfarçado de tema é descartado", () => {
  // Casos reais do catálogo v2 de 10/09/2026.
  assert.deepEqual(temasNormalizados(["finep_mais_inovacao_brasil_rodada_2_semicondutores"]), []);
  assert.deepEqual(
    temasNormalizados(["5a_chamada_publica_conjunta_finep_e_conselho_noruegues_de_pesquisa_rcn"]),
    [],
  );
  // O corte segue o vão da distribuição: ate 5 segmentos e assunto, acima e titulo.
  // Os quatro abaixo sao os maiores assuntos legitimos do catalogo de 10/09/2026.
  assert.ok(!ehTituloDisfarcadoDeTema("saude"));
  assert.ok(!ehTituloDisfarcadoDeTema("economia_circular"));
  assert.ok(!ehTituloDisfarcadoDeTema("cidades_e_desenvolvimento_urbano"));
  assert.ok(!ehTituloDisfarcadoDeTema("meio_ambiente_agua_e_clima"));
  assert.ok(!ehTituloDisfarcadoDeTema("saude_e_ciencias_da_vida"));
  // E os menores titulos de chamada, que precisam cair.
  assert.ok(ehTituloDisfarcadoDeTema("finep_mais_inovacao_brasil_rodada_2_semicondutores"));
  assert.ok(ehTituloDisfarcadoDeTema("selecao_de_parceiros_em_fluxo_continuo_pro_amazonia_empreende"));
});

test("a ordem dos temas é a de TEMAS, não a do arquivo", () => {
  const a = temasNormalizados(["turismo", "cultura"]);
  const b = temasNormalizados(["cultura", "turismo"]);
  assert.deepEqual(a, b);
});

// =============================================================================
// Hierarquia: subfiltro de Inovação
// =============================================================================

test("seguir Inovação alcança janela marcada só com uma vertical filha", () => {
  const j = janela({ geografia: ["SP"], temas: ["bioeconomia"] });
  const p = quem({ uf: "PB", temas: ["inovacao"] });
  assert.equal(avaliar(j, p).pontuacao, 55, "o pai alcança o que está abaixo dele");
});

test("seguir a vertical filha alcança a janela dela", () => {
  const j = janela({ geografia: ["SP"], temas: ["bioeconomia"] });
  assert.equal(avaliar(j, quem({ uf: "PB", temas: ["bioeconomia"] })).pontuacao, 55);
});

test("seguir pai E filho não dobra ponto da mesma janela", () => {
  const j = janela({ geografia: ["SP"], temas: ["bioeconomia"] });
  const p = quem({ uf: "PB", temas: ["inovacao", "bioeconomia"] });
  assert.equal(avaliar(j, p).pontuacao, 55, "um assunto da janela conta uma vez");
  assert.ok(avaliar(j, p).motivos.includes("combina em 1 assunto"));
});

test("seguir a vertical NÃO alcança janela de outro assunto do mesmo pai", () => {
  const j = janela({ geografia: ["SP"], temas: ["descarbonizacao"] });
  assert.equal(avaliar(j, quem({ uf: "PB", temas: ["bioeconomia"] })).pontuacao, 40);
});

test("o vocabulário de fomento do v2 chega aos assuntos certos", () => {
  // Casos reais do catálogo de 10/09/2026, um por fonte.
  assert.deepEqual(temasNormalizados(["subvencao_economica"]), ["subvencao_economica"]);
  assert.deepEqual(temasNormalizados(["descarbonizacao"]), ["descarbonizacao"]);
  assert.deepEqual(temasNormalizados(["saude_e_ciencias_da_vida"]), ["saude"]);
  assert.deepEqual(temasNormalizados(["energia_e_transicao_sustentavel"]), ["energia"]);
  assert.deepEqual(temasNormalizados(["cidades_e_desenvolvimento_urbano"]), ["urbanizacao"]);
  assert.deepEqual(temasNormalizados(["meio_ambiente_agua_e_clima"]), ["meio_ambiente"]);
  assert.deepEqual(temasNormalizados(["seguranca_hidrica"]), ["saneamento"]);
  assert.deepEqual(temasNormalizados(["espaco_defesa_e_seguranca"]), ["espaco_defesa"]);
  assert.deepEqual(temasNormalizados(["tic"]), ["transformacao_digital"]);
});

test("janela marcada com pai E filho conta uma família, não duas", () => {
  // Regressão de 12/09/2026: cnpq-24-2026 traz `inovacao` e `biotecnologia`, e
  // quem seguia Inovação levava dois acertos pela mesma ideia.
  const j = janela({ geografia: ["SP"], temas: ["inovacao", "biotecnologia"] });
  assert.equal(avaliar(j, quem({ uf: "PB", temas: ["inovacao"] })).pontuacao, 55);
});

test("famílias distintas somam, mesmo quando uma delas vem com subtema", () => {
  const j = janela({ geografia: ["SP"], temas: ["inovacao", "biotecnologia", "saude"] });
  // inovacao+biotecnologia = 1 família; saude = outra.
  assert.equal(avaliar(j, quem({ uf: "PB", temas: ["inovacao", "saude"] })).pontuacao, 40 + 30);
});
