import assert from "node:assert/strict";
import { test } from "node:test";
import {
  abaDaUf,
  ancoraRegiao,
  etapasComparadas,
  fontesDaUf,
  funil,
  indicadoresDaUf,
  intermediariasDaUf,
  lentesDaUf,
  metodoDaUf,
  municipiosPorRegiao,
  municipiosSomadosPorRegiao,
  naUf,
  orgaosComparados,
  podeRelatorioUf,
  porChave,
  porSinais,
  porSituacao,
  siglaDaUrl,
  textoSemMedicoes,
  textoSemOrgaoEstadual,
  urlRegiao,
  urlRelatorioUf,
  totalTerritorio,
  urlUf,
  type LeituraParaFontesUf,
  type LinhaTerritorio,
  type MunicipioUf,
} from "./pagina-uf.ts";
import type { ItemCatalogo } from "./indicadores-municipio.ts";
import { MINIMO_MEDICOES, type LinhaDesfecho, type LinhaEtapa } from "./painel.ts";

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

test("A4x: entre os vivos, o concluído é o que está em tomada de contas especial, e o rótulo diz isso", () => {
  // O Brasil da execução 42: 17 + 6 + 20 = 43 concluídos vivos, todos com a subsituação "Em processo de TCE".
  const linhas = [
    t("BR", "situacao", "Em execução", 46200, 1e11, true),
    t("BR", "situacao", "Aguardando Prestação de Contas", 900, 1e9, true),
    t("BR", "situacao", "Prestação de Contas Aprovada", 17, 14_260_086, true),
    t("BR", "situacao", "Prestação de Contas Aprovada com Ressalvas", 6, 1_483_287, true),
    t("BR", "situacao", "Prestação de Contas Concluída", 20, 13_567_044, true),
  ];
  const vivos = porSituacao(linhas, "BR", true);
  assert.deepEqual(
    vivos.map((g) => [g.rotulo, g.n]),
    [["Em execução", 46200], ["Prestando contas", 900], ["Concluído, em tomada de contas especial", 43]],
  );
  assert.ok(!vivos.some((g) => /\bTCE\b/.test(g.rotulo)), "a tomada de contas especial vai por extenso");
  // Na PB (todos os instrumentos), o concluído é só "Concluído": lá entram também os encerrados.
  const todos = porSituacao([...linhas.map((l) => ({ ...l, recorte: "PB" })), t("PB", "situacao", "Prestação de Contas Aprovada", 5000, 2e9, false)], "PB");
  assert.deepEqual(todos.map((g) => g.rotulo), ["Em execução", "Prestando contas", "Concluído"]);
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

test("C1a: o relatório da UF tem rota própria e o mesmo nível mínimo da aba Relatório e dados", () => {
  assert.equal(urlRelatorioUf("PB"), "/mapa/uf/pb/relatorio");
  assert.equal(urlRelatorioUf("sp"), "/mapa/uf/sp/relatorio");
  assert.equal(podeRelatorioUf(0), false, "o público não abre o relatório (a aba também não aparece para ele)");
  assert.equal(podeRelatorioUf(1), true);
  assert.equal(podeRelatorioUf(3), true);
  assert.equal(abaDaUf("relatorio", 0), "resumo", "a regra é a mesma da aba");
});

test("C1a: no papel, os municípios somados por região imediata, na ordem da lista e com o total da UF", () => {
  const m = (nome: string, regiao: string | null, intermediaria: string | null, extra: Partial<MunicipioUf> = {}): MunicipioUf => ({
    ibge: nome, nome, populacao: 1000, porte: null, regiao, intermediaria, instrumentos: 10, em_execucao: 2, valor_execucao: 500, osc_ativas: 3, ...extra,
  });
  const { regioes, total } = municipiosSomadosPorRegiao([
    m("Sousa", "Sousa", "Sousa - Cajazeiras", { valor_execucao: 9e9 }),
    m("Patos", "Patos", "Patos", { populacao: 108000 }),
    m("Água Branca", "Patos", "Patos", { em_execucao: 0, valor_execucao: 0 }),
    m("Campina Grande", "Campina Grande", "Campina Grande"),
  ]);
  assert.deepEqual(
    regioes.map((r) => [r.regiao, r.intermediaria, r.municipios]),
    [["Campina Grande", "Campina Grande", 1], ["Patos", "Patos", 2], ["Sousa", "Sousa - Cajazeiras", 1]],
    "a ordem da legenda do mapa, nunca a do valor (Sousa, com o maior valor, continua por último)",
  );
  const patos = regioes.find((r) => r.regiao === "Patos");
  assert.deepEqual(patos && [patos.populacao, patos.instrumentos, patos.emExecucao, patos.valorExecucao, patos.oscAtivas], [109000, 20, 2, 500, 6]);
  assert.deepEqual([total.municipios, total.instrumentos, total.emExecucao, total.valorExecucao], [4, 40, 6, 9e9 + 1000]);
  assert.equal(total.bloqueados, 0, "sem o fiscal na leitura (quem não é administrador), nada a contar");
  assert.equal(total.sinais, null);
});

test("C1a: fora da PB não há população nem OSC a somar; o fiscal e os sinais só contam quando a leitura os traz", () => {
  const m = (nome: string, extra: Partial<MunicipioUf> = {}): MunicipioUf => ({
    ibge: nome, nome, populacao: null, porte: null, regiao: null, instrumentos: 3, em_execucao: 1, valor_execucao: 100, osc_ativas: null, ...extra,
  });
  const fora = municipiosSomadosPorRegiao([m("Natal"), m("Mossoró")]);
  assert.deepEqual(fora.regioes.map((r) => r.regiao), ["Região não informada"]);
  assert.deepEqual([fora.total.populacao, fora.total.oscAtivas, fora.total.municipios], [null, null, 2]);
  const adm = municipiosSomadosPorRegiao([
    m("A", { decisao_b: "nao_atendido", sinais: 4 }),
    m("B", { decisao_b: "atendido", sinais: 0 }),
    m("C", { decisao_b: "nao_atendido", sinais: null }),
  ]);
  assert.deepEqual([adm.total.bloqueados, adm.total.sinais], [2, 4]);
});

test("C1a: estados vazios dizem o recorte da base e o mínimo de medições", () => {
  assert.match(textoSemOrgaoEstadual("PB"), /desde 2008/);
  assert.match(textoSemOrgaoEstadual("RN"), /Fora da Paraíba só entram os vivos/);
  assert.match(textoSemMedicoes("PB"), new RegExp(`${MINIMO_MEDICOES} vezes ou mais na Paraíba`));
  assert.match(textoSemMedicoes("AL"), /em Alagoas/);
});

test("C1a: fontes só do que a página leu, com a data do dado, e o método com o mínimo de medições", () => {
  const base: LeituraParaFontesUf = {
    sigla: "PB", completa: true, execucao: { dado_ate: "2026-10-07" }, municipios: [{}], pix: [], fundo: null, janelas: 12, indicadores: [{}],
    osc: { versao: "20260901" },
  };
  const pb = fontesDaUf(base);
  assert.equal(pb[0].data, "2026-10-07", "o Transferegov leva a data do arquivo");
  // A4x: o carimbo de 07/10, 22h34 em Brasília (01h34 de 08/10 em UTC), fica em 07/10.
  assert.equal(fontesDaUf({ ...base, execucao: { dado_ate: "2026-10-08T01:34:18+00:00" } })[0].data, "2026-10-07");
  assert.equal(fontesDaUf({ ...base, execucao: { dado_ate: null } })[0].data, null);
  assert.deepEqual(pb.map((f) => f.fonte.split(" ")[0]), ["SICONV", "API", "Catálogo", "IBGE:", "Indicadores", "Mapa"]);
  assert.match(pb.at(-1)?.nota ?? "", /setembro de 2026\. Sem endereço nem dirigentes/);
  assert.ok(!pb.some((f) => /uso interno/.test(f.nota)), "quem não é administrador não lê a origem das colunas internas");
  assert.ok(fontesDaUf(base, true).some((f) => /uso interno/.test(f.nota)));
  const rn = fontesDaUf({ ...base, sigla: "RN", completa: false, municipios: [{}], indicadores: null, osc: null, janelas: null, pix: null });
  assert.deepEqual(rn.map((f) => f.fonte.split(" ")[0]), ["SICONV"], "fora da PB: sem regiões, indicadores, OSC; Pix e janelas que falharam não entram");
  assert.match(rn[0].nota, /vivos no Rio Grande do Norte/);
  assert.match(fontesDaUf({ ...base, osc: { versao: null } }).at(-1)?.nota ?? "", /versão do arquivo não informada/);
  const metodo = metodoDaUf(true).join(" ");
  assert.match(metodo, new RegExp(`menos de ${MINIMO_MEDICOES} medições`));
  assert.match(metodo, /1,5 vez/);
  assert.match(metodo, /regiões do IBGE/);
  assert.match(metodoDaUf(false).join(" "), /só os instrumentos vivos/);
  assert.match(metodoDaUf(true, true).join(" "), /Uso interno/);
});
