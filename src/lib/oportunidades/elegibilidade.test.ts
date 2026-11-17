import test from "node:test";
import assert from "node:assert/strict";
import {
  CORTE_RELEVANTE,
  avaliar,
  bolsaSeparaPessoa,
  elegivel,
  foraDoTerritorio,
  janelaDoV2,
  relevante,
  ehTituloDisfarcadoDeTema,
  temasNormalizados,
  ufNaFrase,
  type JanelaElegivel,
  type Perguntante,
} from "./elegibilidade.ts";
import type { OportunidadeV2 } from "./contrato-v2.ts";

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

// =============================================================================
// Diagnóstico externo de 17/11/2026 (A01): na bolsa, a instituição é vínculo
// =============================================================================

/** Do v2 só o que `janelaDoV2` lê, com os dados da `cnpq-33-2026` no catálogo de 16/11/2026. */
type ItemV2 = Parameters<typeof janelaDoV2>[0];
const fonteDe = (id: string): OportunidadeV2["source"] => ({
  id,
  name: id,
  official: true,
  url: `https://exemplo.gov.br/${id}`,
  checked_at: "2026-11-16T22:23:31+00:00",
  stale: false,
});
const BOLSA_PRODUTIVIDADE: ItemV2 = {
  id: "cnpq-33-2026",
  title: "Chamada CNPq nº 33/2026 - Bolsas de Produtividade do CNPq",
  source: fonteDe("cnpq"),
  channel: "chamada_publica",
  instrument: { type: "bolsa", repayable: false },
  eligibility: {
    organization_types: ["pesquisador", "ict", "universidade", "ict_privada", "empresa", "osc", "outros"],
    geography: ["BR"],
  },
  themes: ["inovacao"],
};

test("A01: bolsa com pesquisador — empresa e OSC entram como instituição de vínculo, fora da lista", () => {
  const j = janelaDoV2(BOLSA_PRODUTIVIDADE, "2.2");
  assert.deepEqual(j.tiposElegiveis, ["pesquisador"]);
  assert.deepEqual(j.tiposVinculo, ["ict", "universidade", "ict_privada", "empresa", "osc", "outros"]);
  for (const tipo of ["empresa", "osc", "universidade"] as const) {
    const a = avaliar(j, quem({ tipo }));
    assert.equal(a.elegivel, false, tipo);
    assert.equal(a.papel, "vinculo", tipo);
    assert.equal(a.pontuacao, 0);
    assert.deepEqual(a.motivos, ["a bolsa é do pesquisador; a sua entidade entra como instituição de vínculo"]);
    assert.ok(!relevante(a));
  }
});

test("A01: o pesquisador continua elegível na bolsa, como antes", () => {
  const a = avaliar(janelaDoV2(BOLSA_PRODUTIVIDADE, "2.2"), quem({ tipo: "pesquisador" }));
  assert.equal(a.elegivel, true);
  assert.equal(a.papel, "proponente");
  assert.ok(a.motivos.includes("aceita o seu tipo de proponente"));
  // Pessoa física sozinha também separa: as bolsas de mestrado e doutorado da FAPESQ (40/2026).
  const fapesq = janelaDoV2(
    { ...BOLSA_PRODUTIVIDADE, eligibility: { organization_types: ["pesquisador", "pessoa_fisica"], geography: ["PB", "BR"] } },
    "2.2",
  );
  assert.ok(avaliar(fapesq, quem({ tipo: "pessoa_fisica" })).elegivel);
  assert.deepEqual(fapesq.tiposVinculo, []);
});

test("A01: só a bolsa separa — bolsa institucional e auxílio à pesquisa ficam como estão", () => {
  // MAI/DAI (cnpq-30-2026): bolsa sem pesquisador entre os tipos; quem propõe é a ICT.
  const maiDai = janelaDoV2(
    { ...BOLSA_PRODUTIVIDADE, eligibility: { organization_types: ["ict", "universidade", "ict_privada"], geography: ["BR"] } },
    "2.2",
  );
  assert.equal(avaliar(maiDai, quem({ tipo: "ict" })).papel, "proponente");
  // Auxílio à pesquisa (cnpq-32-2026) com os mesmos tipos: a regra é da bolsa.
  const auxilio = janelaDoV2({ ...BOLSA_PRODUTIVIDADE, instrument: { type: "auxilio_pesquisa", repayable: false } }, "2.2");
  assert.equal(avaliar(auxilio, quem({ tipo: "empresa" })).papel, "proponente");
});

test("A01: antes do contrato 2.2, bolsa também era auxílio — sem a versão, a regra não se aplica", () => {
  assert.ok(bolsaSeparaPessoa("2.2"));
  assert.ok(bolsaSeparaPessoa("2.10"));
  assert.ok(bolsaSeparaPessoa("3.0"));
  assert.ok(!bolsaSeparaPessoa("2.0"));
  assert.ok(!bolsaSeparaPessoa("2.1"));
  assert.ok(!bolsaSeparaPessoa(undefined));
  assert.equal(avaliar(janelaDoV2(BOLSA_PRODUTIVIDADE, "2.0"), quem({ tipo: "empresa" })).papel, "proponente");
  assert.equal(avaliar(janelaDoV2(BOLSA_PRODUTIVIDADE), quem({ tipo: "empresa" })).papel, "proponente");
});

// =============================================================================
// Diagnóstico externo de 17/11/2026 (A02): o território em três estados
// =============================================================================

/** Programa do Transferegov liberado à PB, como o radar grava. Títulos reais do catálogo de 16/11/2026. */
const doTransferegov = (titulo: string, canal: "emenda" | "proposta" | "beneficiario-especifico" = "emenda"): ItemV2 => ({
  id: `transferegov-abc123-${canal}`,
  title: titulo,
  source: fonteDe("transferegov"),
  eligibility: { organization_types: ["municipio", "estado", "empresa"], geography: ["PB"] },
  themes: [],
});
const CAEM = "Atendimento de demanda judicial - Processo nº 0001844-33.2008.4.01.3300 - Município de Caem/BA";
const RIDE =
  "2317 - Desenvolvimento Regional e Ordenamento Territorial: PT - 15.244.2317.00SX.7097 – Ação: Apoio a Projetos de Desenvolvimento Sustentável Local Integrado - Na Região Integrada de Desenvolvimento do Distrito Federal e Entorno (RIDE) - Nacional – RP (7)";
const EXTERIOR =
  "2317 - Desenvolvimento Regional e Ordenamento Territorial: PT – 20.608.2317. 214S.0002 – Ação: Estruturação e Dinamização de Atividades Produtivas (Rotas de Integração Nacional e Bioeconomia) - Exterior – RP (6)";
const PARAIBA =
  "2317 - Desenvolvimento Regional e Ordenamento Territorial: PT - 15.244.2317. 00SX.0025 – Ação: Apoio a Projetos de Desenvolvimento Sustentável Local Integrado - No Estado da Paraíba – RP (6)";
const CINDRE = "Ação 00SX - Apoio a Projetos de Desenvolvimento Sustentável Local Integrado - RP8 - CINDRE";
const municipioPB = quem({ tipo: "municipio", uf: "PB" });

test("A02 incompatível: outro município, a RIDE e o exterior saem da lista do município da PB", () => {
  for (const titulo of [CAEM, RIDE, EXTERIOR]) {
    const a = avaliar(janelaDoV2(doTransferegov(titulo, "beneficiario-especifico")), municipioPB);
    assert.equal(a.elegivel, false, titulo);
    assert.equal(a.papel, null);
    assert.equal(a.territorio, "incompativel");
    assert.equal(a.pontuacao, 0);
    assert.match(a.motivos[0], /^fora do território/);
  }
  assert.match(foraDoTerritorio(janelaDoV2(doTransferegov(CAEM)), municipioPB) ?? "", /Município de Caem\/BA/);
});

test("A02 incompatível só onde o título restringe de fato", () => {
  // O município da própria UF e as UFs da RIDE não são barrados; quem não declarou UF também não.
  assert.equal(foraDoTerritorio(janelaDoV2(doTransferegov(CAEM)), quem({ tipo: "municipio", uf: "BA" })), null);
  for (const uf of ["DF", "GO", "MG"]) {
    assert.equal(foraDoTerritorio(janelaDoV2(doTransferegov(RIDE)), quem({ tipo: "municipio", uf })), null, uf);
  }
  assert.equal(foraDoTerritorio(janelaDoV2(doTransferegov(CAEM)), quem({ tipo: "municipio", uf: null })), null);
  // "Exterior" só como trecho do localizador: comércio exterior não é o exterior.
  assert.equal(foraDoTerritorio(janelaDoV2(doTransferegov("Apoio ao Comércio Exterior - Nacional")), municipioPB), null);
  // Fora do Transferegov, o título não é localizador do SICONV.
  const finep = janelaDoV2({
    ...doTransferegov(EXTERIOR),
    id: "finep-1",
    source: fonteDe("finep"),
    eligibility: { organization_types: ["municipio"], geography: ["BR"] },
  });
  assert.equal(foraDoTerritorio(finep, municipioPB), null);
});

test("A02 não verificado: no Transferegov, a UF na geografia é liberação do SICONV, não território do objeto", () => {
  const a = avaliar(janelaDoV2(doTransferegov(PARAIBA)), municipioPB);
  assert.equal(a.elegivel, true);
  assert.equal(a.territorio, "nao_verificado");
  assert.ok(a.motivos.includes("liberado para a PB no Transferegov; o território do objeto não foi verificado"));
  assert.ok(!a.motivos.includes("território compatível"));
  assert.equal(a.pontuacao, 60, "o peso é o do radar: a UF está na geografia");

  const beneficiario = avaliar(janelaDoV2(doTransferegov(CINDRE, "beneficiario-especifico")), municipioPB);
  assert.equal(beneficiario.territorio, "nao_verificado");
  assert.deepEqual(beneficiario.motivos, [
    "aceita o seu tipo de proponente",
    "liberado para a PB no Transferegov; o território do objeto não foi verificado",
    "só o proponente indicado pelo concedente",
  ]);

  // Os módulos novos (fundo a fundo, parcerias) gravam BR.
  const fundo = janelaDoV2({
    ...doTransferegov(CINDRE),
    source: fonteDe("transferegov-fundoafundo"),
    eligibility: { organization_types: ["municipio"], geography: ["BR"] },
  });
  assert.ok(
    avaliar(fundo, municipioPB).motivos.includes("liberado para todo o país no Transferegov; o território do objeto não foi verificado"),
  );
});

test("A02 confirmado: fonte de edital com geografia nacional ou da UF mantém o texto de antes", () => {
  const auxilio = janelaDoV2({ ...BOLSA_PRODUTIVIDADE, instrument: { type: "auxilio_pesquisa", repayable: false } }, "2.2");
  const nacional = avaliar(auxilio, quem({ tipo: "ict" }));
  assert.equal(nacional.territorio, "confirmado");
  assert.ok(nacional.motivos.includes("abrangência nacional"));
  const daUf = avaliar(janela({ geografia: ["PB"], fonte: "fapesq" }), quem({ uf: "PB" }));
  assert.equal(daUf.territorio, "confirmado");
  assert.ok(daUf.motivos.includes("território compatível"));
  // Sem geografia que alcance, nada se afirma.
  assert.equal(avaliar(janela({ geografia: ["SP"] }), quem({ uf: "PB" })).territorio, null);
});

test("A02: a janela leva fonte, canal e título; no arquivo 2.0 o canal sai do id", () => {
  const j = janelaDoV2(doTransferegov(CINDRE, "beneficiario-especifico"));
  assert.equal(j.fonte, "transferegov");
  assert.equal(j.canal, "beneficiario_especifico");
  assert.equal(j.titulo, CINDRE);
});

test("a UF no meio da frase leva a preposição certa", () => {
  assert.equal(ufNaFrase("PB", "para"), "para a PB");
  assert.equal(ufNaFrase("PB", "de"), "da PB");
  assert.equal(ufNaFrase("RN", "de"), "do RN");
  assert.equal(ufNaFrase("SP", "de"), "de SP");
  assert.equal(ufNaFrase("SP", "para"), "para SP");
});
