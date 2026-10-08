import assert from "node:assert/strict";
import { test } from "node:test";
import {
  abaDaUf,
  ancoraRegiao,
  etapasComparadas,
  funil,
  indicadoresDaUf,
  intermediariasDaUf,
  lentesDaUf,
  municipiosPorRegiao,
  naUf,
  orgaosComparados,
  porChave,
  porSinais,
  porSituacao,
  siglaDaUrl,
  urlRegiao,
  totalTerritorio,
  urlUf,
  type LinhaTerritorio,
  type MunicipioUf,
} from "./pagina-uf.ts";
import type { ItemCatalogo } from "./indicadores-municipio.ts";
import type { LinhaDesfecho, LinhaEtapa } from "./painel.ts";

const t = (recorte: string, dimensao: LinhaTerritorio["dimensao"], chave: string, n: number, valor: number, vivo: boolean | null = null, extra: Partial<LinhaTerritorio> = {}): LinhaTerritorio => ({
  recorte, dimensao, chave, vivo, n, em_execucao: 0, valor, desembolsado: 0, municipios: null, proponentes: null, ...extra,
});

test("U1: sigla da URL, abas por nível e endereço", () => {
  assert.equal(siglaDaUrl("pb"), "PB");
  assert.equal(siglaDaUrl("XX"), null);
  assert.equal(siglaDaUrl("constructor"), null);
  assert.equal(abaDaUf("tempos", 0), "resumo", "o público não vê os tempos");
  assert.equal(abaDaUf("tempos", 1), "tempos");
  assert.equal(abaDaUf(undefined, 3), "resumo");
  assert.equal(urlUf("PB"), "/mapa/uf/pb");
  assert.equal(urlUf("PB", "municipios"), "/mapa/uf/pb?aba=municipios");
  assert.equal(naUf("PB"), "na Paraíba");
  assert.equal(naUf("AL"), "em Alagoas");
  assert.equal(naUf("AC"), "no Acre");
  assert.equal(ancoraRegiao("Sousa - Cajazeiras"), "regiao-sousa-cajazeiras");
  assert.equal(ancoraRegiao("João Pessoa"), "regiao-joao-pessoa");
  assert.equal(urlRegiao("PB", "Patos"), "/mapa/uf/pb?aba=municipios#regiao-patos");
});

test("U1: as somas do job agrupadas como na busca, com os vivos à parte", () => {
  const linhas = [
    t("PB", "situacao", "Em execução", 1790, 4.7e9, true),
    t("PB", "situacao", "Aguardando Prestação de Contas", 300, 1e8, true),
    t("PB", "situacao", "Prestação de Contas Aprovada", 5000, 2e9, false),
    t("PB", "situacao", "Situação nova do SICONV", 2, 10, true),
    t("BR", "situacao", "Em execução", 46200, 1e11, true),
    t("PB", "total", "vivos", 2699, 5e9, null, { municipios: 222, proponentes: 480 }),
    t("PB", "orgao", "MINISTERIO DA SAUDE", 10, 5),
    t("PB", "orgao", "MINISTERIO DAS CIDADES", 20, 9),
  ];
  assert.deepEqual(porSituacao(linhas, "PB").map((g) => [g.id, g.n]), [["execucao", 1790], ["contas", 300], ["concluido", 5000], ["outro", 2]]);
  assert.deepEqual(porSituacao(linhas, "PB", true).map((g) => g.id), ["execucao", "contas", "outro"]);
  assert.equal(totalTerritorio(linhas, "PB", "vivos")?.municipios, 222);
  assert.equal(totalTerritorio(linhas, "PB", "todos"), null);
  assert.deepEqual(porChave(linhas, "PB", "orgao").map((l) => l.chave), ["MINISTERIO DAS CIDADES", "MINISTERIO DA SAUDE"]);
});

test("U1: quem recebe no estado, pelas lentes da página do município", () => {
  const p = (cnpj: string, proponente: string, tipo: string, n: number, valor: number) => ({ cnpj, proponente, tipo_agente: tipo, cod_ibge: null, municipio: null, instrumentos: n, em_execucao: 1, valor, ultimo_ano: 2025 });
  const l = lentesDaUf([
    p("1", "MUNICIPIO DE PATOS", "municipio", 106, 139e6),
    p("2", "FUNDO MUNICIPAL DE SAUDE DE PITIMBU", "municipio", 2, 1e6),
    p("3", "UNIVERSIDADE ESTADUAL DA PARAIBA", "estado", 83, 158e6),
    p("4", "FUNDACAO NAPOLEAO LAUREANO", "osc", 89, 64e6),
    p("5", "SERV DE APOIO AS MICRO E PEQ EMP DA PARAIBA SEBRAE PB", "outros", 8, 2e6),
  ]);
  assert.deepEqual(l.map((x) => [x.lente, x.entidades, x.instrumentos]), [["municipal", 2, 108], ["estado", 1, 83], ["sociedade", 1, 89], ["outros", 1, 8]]);
});

test("U1: municípios em ordem alfabética dentro da região; os sinais só ordenam para o administrador", () => {
  const m = (nome: string, regiao: string | null, sinais?: number): MunicipioUf => ({ ibge: nome, nome, populacao: null, porte: null, regiao, instrumentos: 1, em_execucao: 0, valor_execucao: 0, osc_ativas: null, sinais });
  const g = municipiosPorRegiao([m("Sousa", "Sousa - Cajazeiras"), m("Patos", "Patos"), m("Água Branca", "Patos"), m("Cajazeiras", "Sousa - Cajazeiras"), m("X", null)]);
  assert.deepEqual(g.map((x) => [x.regiao, x.municipios.map((y) => y.nome)]), [
    ["Patos", ["Água Branca", "Patos"]],
    ["Sousa - Cajazeiras", ["Cajazeiras", "Sousa"]],
    ["Região não informada", ["X"]],
  ]);
  assert.deepEqual(porSinais([m("A", null, 1), m("B", null, 5), m("C", null)]).map((x) => x.nome), ["B", "A", "C"]);
});

test("B11 (H12): cada grupo diz a região intermediária, e os grupos vêm na ordem da legenda do mapa", () => {
  const m = (nome: string, regiao: string | null, intermediaria: string | null): MunicipioUf => ({
    ibge: nome, nome, populacao: null, porte: null, regiao, intermediaria, instrumentos: 1, em_execucao: 0, valor_execucao: 0, osc_ativas: null,
  });
  const ms = [
    m("Sousa", "Sousa", "Sousa - Cajazeiras"),
    m("Cajazeiras", "Cajazeiras", "Sousa - Cajazeiras"),
    m("Patos", "Patos", "Patos"),
    m("Itaporanga", "Itaporanga", "Patos"),
    m("Campina Grande", "Campina Grande", "Campina Grande"),
    m("Cuité", "Cuité - Nova Floresta", "Campina Grande"),
    m("Sem grupo", null, null),
  ];
  assert.deepEqual(intermediariasDaUf(ms), ["Campina Grande", "Patos", "Sousa - Cajazeiras"], "a legenda: sem repetir, em ordem alfabética");
  assert.deepEqual(
    municipiosPorRegiao(ms).map((g) => [g.intermediaria, g.regiao]),
    [
      ["Campina Grande", "Campina Grande"],
      ["Campina Grande", "Cuité - Nova Floresta"],
      ["Patos", "Itaporanga"],
      ["Patos", "Patos"],
      ["Sousa - Cajazeiras", "Cajazeiras"],
      ["Sousa - Cajazeiras", "Sousa"],
      [null, "Região não informada"],
    ],
    "as imediatas da mesma intermediária (a mesma cor no mapa) ficam juntas, em ordem alfabética",
  );
});

test("U1: tempos da UF contra o Brasil e o funil das propostas", () => {
  const e = (recorte: string, chave: string, etapa: string, n: number, mediana: number): LinhaEtapa => ({ recorte, dimensao: "orgao", chave, rotulo: chave === "__todos__" ? "Todos" : chave, orgao_sup: null, etapa, n, mediana, p90: null, em_aberto: 0, idade_mediana_aberto: null });
  const linhas = [
    e("PB", "__todos__", "aprovacao_assinatura", 400, 60), e("BR", "__todos__", "aprovacao_assinatura", 9000, 30),
    e("PB", "MINISTERIO DA SAUDE", "envio_aprovacao", 50, 40), e("BR", "MINISTERIO DA SAUDE", "envio_aprovacao", 900, 35),
    e("PB", "MINISTERIO DAS CIDADES", "envio_aprovacao", 5, 90), e("BR", "MINISTERIO DAS CIDADES", "envio_aprovacao", 900, 20),
    e("PB", "MINISTERIO DO TURISMO", "assinatura_desembolso", 30, 200), e("BR", "MINISTERIO DO TURISMO", "assinatura_desembolso", 700, 100),
  ];
  const todos = etapasComparadas(linhas, "PB", "__todos__").find((x) => x.etapa === "aprovacao_assinatura");
  assert.deepEqual(todos && [todos.uf, todos.br, todos.lento], [60, 30, true]);
  const o = orgaosComparados(linhas, "PB");
  assert.deepEqual(o.map((x) => [x.chave, x.lentas]), [["MINISTERIO DO TURISMO", 1], ["MINISTERIO DA SAUDE", 0]], "com menos de 10 medições não compara");
  const d = (uf: string, ano: number, enviadas: number, assinadas: number, programa: string | null = null): LinhaDesfecho => ({
    cod_programa: programa, programa, orgao_sup: null, ano_envio: ano, uf, enviadas, assinadas, reprovadas: 10, reprovadas_lote: 0, impedimento: 5,
    impedimento_lote: 0, eliminadas: 0, abertas_concedente: 3, limbo: 1, abertas_proponente: 2, aguardando_assinatura: 4, com_emenda: 0, assinadas_com_emenda: 0, valor_pedido: 0,
  });
  const f = funil([d("PB", 2025, 1000, 400), d("PB", 2026, 200, 20), d("PB", 2025, 50, 5, "123"), d("BR", 2025, 30000, 12000)], "PB");
  assert.deepEqual(f.map((x) => [x.ano, x.enviadas, x.negadas, x.emAndamento, x.pctAssinadas]), [[2026, 200, 15, 9, 10], [2025, 1000, 15, 9, 40]]);
});

test("U1: indicadores do estado no ano mais recente, com o Brasil do mesmo ano", () => {
  const cat = [
    { id: "idhm", dimensao: "municipio", nome: "IDHM", unidade: "índice", casas: 3, direcao: "maior", chave: true },
    { id: "pib", dimensao: "economia", nome: "PIB", unidade: "mil R$", casas: 0, direcao: null, chave: false },
    { id: "sem_dado", dimensao: "economia", nome: "X", unidade: "x", casas: 0, direcao: null, chave: false },
  ] as ItemCatalogo[];
  const refs = [
    { indicador: "idhm", ano: "2010", recorte: "PB", valor: 0.658 },
    { indicador: "idhm", ano: "2010", recorte: "BR", valor: 0.727 },
    { indicador: "pib", ano: "2022", recorte: "PB", valor: 90 },
    { indicador: "pib", ano: "2023", recorte: "PB", valor: 96 },
    { indicador: "pib", ano: "2022", recorte: "BR", valor: 10000 },
  ];
  assert.deepEqual(indicadoresDaUf(refs, cat, "PB").map((x) => [x.item.id, x.ano, x.uf, x.br]), [["idhm", "2010", 0.658, 0.727], ["pib", "2023", 96, null]]);
});
