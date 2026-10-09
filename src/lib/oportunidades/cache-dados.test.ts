import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ETIQUETA_DADOS,
  FOLGA_ITEM,
  LIMITE_ITEM,
  VALIDADE_DADOS_MS,
  VALIDADE_DADOS_S,
  abrirEnvelope,
  chaveDoCache,
  criarCamadaCompartilhada,
  decidirGuarda,
  etiquetasDoLeitor,
  implantacaoDe,
  perdaNoJson,
  tamanhoNoCache,
  type Cachear,
} from "./cache-dados.ts";
import { criarMemoria } from "./memoria.ts";
import { relatorioDoNivel } from "./pagina-municipio.ts";
import type { MunicipioFiscal, VerificacaoFiscal } from "./fiscal.ts";
import type { EntradaIndicadores, ItemCatalogo, LinhaIndicador, ReferenciaIndicador } from "./indicadores-municipio.ts";
import type { PlanoLaudoPix } from "./pix-laudo.ts";
import type { TceTcu } from "./tce-tcu.ts";
import {
  FALTAS_DA_FONTE,
  FONTES_DO_PUBLICO,
  FONTES_RELATORIO,
  entradaDasFontes,
  fontesDoNivel,
  leituraGuardavel,
  montarRelatorio,
  relatorioSemNomes,
  type EntradaRelatorio,
  type InstrumentoRelatorio,
  type Relatorio,
} from "./relatorio-municipio.ts";

function relogio(inicio = 1_000_000) {
  let t = inicio;
  return { agora: () => t, andar: (ms: number) => (t += ms) };
}

// ================================================================ chaves, etiquetas e validade

test("chave: versão, publicação, leitor e a chave do leitor; leitura pública e completa nunca se cruzam", () => {
  const c = chaveDoCache("municipio", "2510808|2026-10-09|2026-10-01.2", "dpl_abc");
  assert.equal(c, "mapa-dados|v1|dpl_abc|municipio|2510808|2026-10-09|2026-10-01.2");
  assert.notEqual(chaveDoCache("municipio-publico", "2510808|2026-10-09", "dpl_abc"), chaveDoCache("municipio", "2510808|2026-10-09", "dpl_abc"));
  assert.notEqual(chaveDoCache("municipio", "2510808|2026-10-09", "dpl_novo"), chaveDoCache("municipio", "2510808|2026-10-09", "dpl_abc"), "publicação nova, chave nova");
  assert.notEqual(chaveDoCache("municipio", "2510808|2026-10-10", "x"), chaveDoCache("municipio", "2510808|2026-10-09", "x"), "dia novo, chave nova");
});

test("publicação: o id da implantação da Vercel, senão o commit, senão 'local'", () => {
  assert.equal(implantacaoDe({ VERCEL_DEPLOYMENT_ID: "dpl_1", VERCEL_GIT_COMMIT_SHA: "abc" }), "dpl_1");
  assert.equal(implantacaoDe({ VERCEL_GIT_COMMIT_SHA: "abc" }), "abc");
  assert.equal(implantacaoDe({}), "local");
  assert.equal(implantacaoDe({ VERCEL_DEPLOYMENT_ID: "" }), "local", "vazio não conta");
});

test("etiquetas: a geral e a do leitor, sem vírgula; validade de 10 minutos, a da memória de hoje", () => {
  assert.deepEqual(etiquetasDoLeitor("municipio-publico"), [ETIQUETA_DADOS, "mapa-dados-municipio-publico"]);
  assert.ok(!etiquetasDoLeitor("a,b").some((e) => e.includes(",")));
  assert.equal(VALIDADE_DADOS_S, 600);
  assert.equal(VALIDADE_DADOS_MS, 600_000);
});

// ================================================================ o que se guarda

test("JSON: Map, Set, Date, NaN, Infinity, função e undefined em lista não voltam iguais; o resto volta", () => {
  assert.equal(perdaNoJson({ a: 1, b: "x", c: null, d: [1, { e: true }], f: undefined }), null, "campo undefined some e volta undefined");
  assert.equal(perdaNoJson({ estado: "ok", janelas: new Map([["PB", 3]]) }), "$.janelas");
  assert.equal(perdaNoJson({ a: [{ b: new Set([1]) }] }), "$.a[0].b");
  assert.equal(perdaNoJson({ quando: new Date(0) }), "$.quando");
  assert.equal(perdaNoJson({ r: { taxa: Number.NaN } }), "$.r.taxa");
  assert.equal(perdaNoJson({ r: { teto: Infinity } }), "$.r.teto");
  assert.equal(perdaNoJson({ f: () => 1 }), "$.f");
  assert.equal(perdaNoJson([1, undefined]), "$[1]");
  assert.equal(perdaNoJson(Object.create(null)), null, "objeto sem protótipo é JSON");
});

test("guarda: falha não vai; o que perde no JSON não vai; o grande não vai; o resto vai com o `desde`", () => {
  const ok = { estado: "ok", faltas: [] as string[] };
  assert.deepEqual(decidirGuarda({ estado: "erro" }, { guardavel: (v) => v.estado === "ok", desde: 1 }), { guardar: false, motivo: "falha" });
  assert.deepEqual(decidirGuarda({ estado: "ok", m: new Map() }, { guardavel: () => true, desde: 1 }), { guardar: false, motivo: "perda", onde: "$.m" });
  const g = decidirGuarda(ok, { guardavel: () => true, desde: 123 });
  assert.equal(g.guardar, true);
  if (g.guardar) {
    assert.deepEqual(g.envelope, { v: "1", desde: 123, valor: ok });
    assert.equal(g.tamanho, tamanhoNoCache(JSON.stringify(g.envelope)));
  }
  const grande = decidirGuarda({ texto: "x".repeat(200) }, { guardavel: () => true, desde: 1, limite: 100 });
  assert.equal(grande.guardar, false);
  assert.equal(!grande.guardar && grande.motivo, "grande");
  // o codec troca o que o JSON não guarda (o Map das janelas do Brasil) antes da conta
  const comMapa = decidirGuarda({ janelas: new Map([["PB", 3]]) }, { guardavel: () => true, desde: 1, paraGuardar: (v) => ({ janelas: [...v.janelas] }) });
  assert.equal(comMapa.guardar, true);
});

test("tamanho: contado como o Next conta o item (o registro inteiro, com o corpo em texto, aspas escapadas)", () => {
  const corpo = JSON.stringify({ nome: "João Pessoa", aspas: '"' });
  const comoONext = JSON.stringify({ kind: "FETCH", data: { headers: {}, body: corpo, status: 200, url: "" }, revalidate: 600 }).length;
  assert.equal(tamanhoNoCache(corpo), comoONext);
  assert.ok(tamanhoNoCache(corpo) > corpo.length, "o escape das aspas conta");
  assert.equal(LIMITE_ITEM, 2 * 1024 * 1024);
  assert.ok(FOLGA_ITEM > 0 && FOLGA_ITEM < LIMITE_ITEM / 100);
});

test("envelope: só o do formato atual abre; o resto vira leitura do banco", () => {
  assert.deepEqual(abrirEnvelope({ v: "1", desde: 5, valor: null }), { v: "1", desde: 5, valor: null });
  for (const x of [null, "texto", { v: "0", desde: 5, valor: 1 }, { v: "1", desde: "5", valor: 1 }, { v: "1", desde: 5 }]) assert.equal(abrirEnvelope(x), null);
});

// ================================================================ o caminho de uma leitura (com um cache de mentira)

/**
 * O `unstable_cache` de mentira, com o comportamento do Next numa página: falta lê e guarda o que a função devolve;
 * o que ela lança não fica; item dentro da validade volta do JSON; item vencido volta velho e é relido ao fundo.
 */
function cacheFalso(r: { agora: () => number }) {
  const itens = new Map<string, { corpo: string; em: number }>();
  const conta = { gravacoes: 0 };
  const fundo: Promise<unknown>[] = [];
  const estado = { quebrado: false };
  const cachear: Cachear = (ler, partes, opcoes) => async () => {
    if (estado.quebrado) throw new Error("Invariant: incrementalCache missing");
    const chave = partes.join(",");
    const gravar = (v: unknown) => {
      itens.set(chave, { corpo: JSON.stringify(v), em: r.agora() });
      conta.gravacoes++;
    };
    const item = itens.get(chave);
    if (item) {
      if ((r.agora() - item.em) / 1000 > opcoes.revalidate) fundo.push(ler().then(gravar, () => undefined));
      return JSON.parse(item.corpo);
    }
    const novo = await ler();
    gravar(novo);
    return novo;
  };
  return { cachear, itens, conta, fundo, estado };
}

function banco<T>(valores: T[]) {
  const conta = { leituras: 0 };
  return { conta, carregar: async () => valores[Math.min(conta.leituras++, valores.length - 1)] };
}

const camadaDeTeste = <T,>(c: ReturnType<typeof cacheFalso>, r: { agora: () => number }, avisos: string[] = [], extra: Partial<Parameters<typeof criarCamadaCompartilhada<T>>[0]> = {}) =>
  criarCamadaCompartilhada<T>({
    leitor: "municipio",
    cachear: c.cachear,
    implantacao: "dpl_teste",
    guardavel: () => true,
    agora: r.agora,
    avisar: (m) => avisos.push(m),
    ...extra,
  });

test("camada: a falta lê do banco e guarda; a outra instância lê do cache, com o `desde` da leitura", async () => {
  const r = relogio();
  const c = cacheFalso(r);
  const b = banco([{ estado: "ok", nome: "Patos" }]);
  const lido = await camadaDeTeste<{ estado: string; nome: string }>(c, r).obter("2510808", b.carregar);
  assert.deepEqual(lido, { valor: { estado: "ok", nome: "Patos" }, desde: r.agora() });
  assert.equal(c.conta.gravacoes, 1);
  r.andar(60_000);
  const outra = await camadaDeTeste<{ estado: string; nome: string }>(c, r).obter("2510808", b.carregar);
  assert.deepEqual(outra, { valor: { estado: "ok", nome: "Patos" }, desde: r.agora() - 60_000 });
  assert.equal(b.conta.leituras, 1, "a segunda instância não foi ao banco");
});

test("camada: o que não se guarda volta ao chamador por fora e não fica (falha não se guarda)", async () => {
  const r = relogio();
  const c = cacheFalso(r);
  const b = banco([{ estado: "ok", relatorio: { faltas: ["TCE-PB"] } }, { estado: "ok", relatorio: { faltas: [] } }]);
  const camada = camadaDeTeste<{ estado: string; relatorio?: { faltas: string[] } }>(c, r, [], { guardavel: leituraGuardavel });
  assert.deepEqual((await camada.obter("2510808", b.carregar)).valor.relatorio?.faltas, ["TCE-PB"]);
  assert.equal(c.itens.size, 0, "a leitura com falta não ficou");
  assert.deepEqual((await camada.obter("2510808", b.carregar)).valor.relatorio?.faltas, [], "a seguinte relê");
  assert.equal(c.itens.size, 1);
});

test("camada: item vencido nunca chega a quem visita — vale a releitura, uma só ida ao banco, e o cache fica com ela", async () => {
  const r = relogio();
  const c = cacheFalso(r);
  const b = banco([{ versao: "velha" }, { versao: "nova" }]);
  await camadaDeTeste<{ versao: string }>(c, r).obter("pb", b.carregar);
  r.andar(VALIDADE_DADOS_MS + 1);
  const lido = await camadaDeTeste<{ versao: string }>(c, r).obter("pb", b.carregar);
  assert.equal(lido.valor.versao, "nova");
  assert.equal(lido.desde, r.agora());
  await Promise.all(c.fundo);
  assert.equal(b.conta.leituras, 2, "a releitura do fundo e a de quem pediu são a mesma");
  assert.equal(JSON.parse([...c.itens.values()][0].corpo).valor.versao, "nova");
});

test("camada: sem cache (fora do Next, ou fora do ar), lê do banco e avisa; erro do banco sobe e nada fica", async () => {
  const r = relogio();
  const c = cacheFalso(r);
  c.estado.quebrado = true;
  const avisos: string[] = [];
  const b = banco([{ ok: true }]);
  assert.deepEqual((await camadaDeTeste<{ ok: boolean }>(c, r, avisos).obter("pb", b.carregar)).valor, { ok: true });
  assert.match(avisos.join("\n"), /lido sem o cache/);

  const c2 = cacheFalso(r);
  const camada = camadaDeTeste<{ ok: boolean }>(c2, r);
  await assert.rejects(camada.obter("pb", async () => Promise.reject(new Error("banco fora do ar"))), /banco fora do ar/);
  assert.equal(c2.itens.size, 0);
  assert.deepEqual((await camada.obter("pb", async () => ({ ok: true }))).valor, { ok: true }, "a chave não travou");
});

test("camada: item de outro formato vai ao banco; o Map volta Map pelo codec; o que perde no JSON e o grande não ficam", async () => {
  const r = relogio();
  const c = cacheFalso(r);
  c.itens.set(chaveDoCache("municipio", "pb", "dpl_teste"), { corpo: JSON.stringify({ formato: "antigo" }), em: r.agora() });
  const avisos: string[] = [];
  assert.deepEqual((await camadaDeTeste<{ novo: boolean }>(c, r, avisos).obter("pb", async () => ({ novo: true }))).valor, { novo: true });
  assert.match(avisos.join("\n"), /outro formato/);

  type ComMapa = { estado: string; janelas: Map<string, number> };
  const codec = {
    paraGuardar: (v: ComMapa) => ({ ...v, janelas: [...v.janelas] }),
    doGuardado: (x: unknown) => {
      const g = x as { estado: string; janelas: [string, number][] };
      return { ...g, janelas: new Map(g.janelas) };
    },
  };
  const c2 = cacheFalso(r);
  await camadaDeTeste<ComMapa>(c2, r, [], codec).obter("BR", async () => ({ estado: "ok", janelas: new Map([["PB", 7]]) }));
  const doCache = await camadaDeTeste<ComMapa>(c2, r, [], codec).obter("BR", async () => assert.fail("não devia ir ao banco"));
  assert.ok(doCache.valor.janelas instanceof Map);
  assert.equal(doCache.valor.janelas.get("PB"), 7);

  const c3 = cacheFalso(r);
  const avisos3: string[] = [];
  const semCodec = await camadaDeTeste<ComMapa>(c3, r, avisos3).obter("BR", async () => ({ estado: "ok", janelas: new Map([["PB", 7]]) }));
  assert.ok(semCodec.valor.janelas instanceof Map, "quem pediu recebe o valor lido, inteiro");
  assert.equal(c3.itens.size, 0);
  assert.match(avisos3.join("\n"), /\$\.valor\.janelas|\$\.janelas/);

  const c4 = cacheFalso(r);
  const avisos4: string[] = [];
  const grande = { texto: "x".repeat(LIMITE_ITEM) };
  assert.equal((await camadaDeTeste<typeof grande>(c4, r, avisos4).obter("SP", async () => grande)).valor, grande, "a página segue com o valor lido");
  assert.equal(c4.itens.size, 0, "item maior que o limite não vai ao cache");
  assert.match(avisos4.join("\n"), /passam do limite/);
});

test("memória + camada: duas instâncias, um cache comum — o banco é lido uma vez", async () => {
  const r = relogio();
  const c = cacheFalso(r);
  type Leitura = { estado: string; relatorio: { faltas: string[] } };
  const b = banco<Leitura>([{ estado: "ok", relatorio: { faltas: [] } }]);
  const instancia = () =>
    criarMemoria<Leitura>({
      validadeMs: VALIDADE_DADOS_MS,
      maximo: 30,
      guardar: leituraGuardavel,
      agora: r.agora,
      compartilhada: camadaDeTeste<Leitura>(c, r, [], { guardavel: leituraGuardavel }),
    });
  const a = instancia();
  const z = instancia();
  await a.obter("2510808|2026-10-09", b.carregar);
  await z.obter("2510808|2026-10-09", b.carregar);
  await z.obter("2510808|2026-10-09", b.carregar);
  assert.equal(b.conta.leituras, 1);
});

// ================================================================ as fontes por nível

test("fontes: o nível 0 lê a lista branca; do 1 em diante, todas, como sempre", () => {
  assert.deepEqual([...fontesDoNivel(0)], ["convenios", "propostas", "emendas", "indicadores", "janelas"]);
  for (const n of [1, 2, 3] as const) assert.equal(fontesDoNivel(n), FONTES_RELATORIO);
  assert.equal(new Set(FONTES_RELATORIO).size, FONTES_RELATORIO.length);
  for (const f of FONTES_DO_PUBLICO) assert.ok(FONTES_RELATORIO.includes(f), f);
  // nenhuma fonte de análise ou de controle no público
  for (const f of ["fiscal", "tcu", "contas_obras", "pix", "pix_ciclo", "fundo", "tce_pb", "fornecedores"] as const) assert.ok(!fontesDoNivel(0).includes(f), f);
  // toda fonte tem o nome das suas faltas, e nenhum nome é de duas
  const nomes = FONTES_RELATORIO.flatMap((f) => FALTAS_DA_FONTE[f]);
  assert.ok(FONTES_RELATORIO.every((f) => FALTAS_DA_FONTE[f].length > 0));
  assert.equal(new Set(nomes).size, nomes.length);
});

// ================================================================ a equivalência do recorte

const CATALOGO = (JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "indicadores-municipio.json"), "utf-8")) as { indicadores: ItemCatalogo[] }).indicadores;
const linhaInd = (indicador: string, ano: string, valor: number | null, x: Partial<LinhaIndicador> = {}): LinhaIndicador => ({
  indicador, ano, valor, fonte: "Fonte", url: "https://exemplo", nota: null, posicao_pb: null, total_pb: null, mediana_porte: null, mediana_regiao: null, ...x,
});
const refs = (indicador: string, ano: string, q: [number, number, number], pb?: number, br?: number): ReferenciaIndicador[] => [
  { indicador, ano, recorte: "q1_pb", valor: q[0] },
  { indicador, ano, recorte: "mediana_pb", valor: q[1] },
  { indicador, ano, recorte: "q3_pb", valor: q[2] },
  ...(pb !== undefined ? [{ indicador, ano, recorte: "PB" as const, valor: pb }] : []),
  ...(br !== undefined ? [{ indicador, ano, recorte: "BR" as const, valor: br }] : []),
];
const indicadores = (): EntradaIndicadores => ({
  catalogo: CATALOGO,
  linhas: [
    linhaInd("populacao_estimada", "2026", 108416),
    linhaInd("mortalidade_infantil", "2022-2024", 14.14, { posicao_pb: 150, total_pb: 223, mediana_porte: 13.1, mediana_regiao: 12.9 }),
    linhaInd("ideb_ai_municipal", "2025", 6.8, { posicao_pb: 20, total_pb: 220 }),
    linhaInd("homicidios_taxa", "2022-2024", 36.19, { posicao_pb: 210, total_pb: 223 }),
  ],
  referencias: [
    ...refs("mortalidade_infantil", "2022-2024", [10, 12.5, 15], 13.2, 12.9),
    ...refs("ideb_ai_municipal", "2025", [5.2, 5.8, 6.3]),
    ...refs("homicidios_taxa", "2022-2024", [8, 15, 25], 27.8, 21.5),
  ],
  grupo: { porte: "grande", regiao_imediata: "Patos", regiao_intermediaria: "Patos", regic: "Centro Sub-Regional A", arranjo: "Patos/PB", polo: true },
  coletadoEm: "2026-10-05T12:00:00Z",
});

const verificacao = (codigo: string, estado: string, resumo: string) =>
  ({ codigo, nome: codigo, estado, resumo, decisoes: [], evidencia: {}, base_legal: "", documental: false, versao: "x" }) as unknown as VerificacaoFiscal;
const municipioFiscal: MunicipioFiscal = {
  ibge: "2510808", nome: "Patos", populacao: 103165, tce: "135",
  estados: { G2: "nao_atendido", G7: "nao_atendido", G1: "atendido" },
  conclusoes: [
    { decisao: "B", nome: "Transferência voluntária", estado: "nao_atendido", bloqueantes: ["G2", "G7"], alertas: [], sem_dado: [], documentais: [], versao: "x" },
  ] as MunicipioFiscal["conclusoes"],
  indicadores: { pessoal_pct: 54.54, cauc_pendencias: ["1.5", "4.2"] },
};
const instrumento = (x: Partial<InstrumentoRelatorio>): InstrumentoRelatorio => ({
  nr_convenio: "900000", modalidade: "Convênio", situacao: "Em execução", subsituacao: null, orgao_sup: "MINISTERIO DA AGRICULTURA", programa: null,
  objeto: null, vl_global: 1_000_000, vl_repasse: 950_000, vl_desembolsado: 500_000, vl_pago: 400_000, vl_saldo_conta: 100_000, pct_fisico: 0.5,
  dt_assinatura: "2024-06-01", dt_fim_vigencia: "2027-12-31", dt_limite_contas: null, dt_primeiro_desembolso: "2025-01-10",
  dt_ultimo_desembolso: "2026-08-01", dt_ultimo_pagamento: "2026-08-20", situacao_contratacao: null, ...x,
});
const tceTcu = (nr: string): TceTcu => ({
  nr_convenio: nr, codigo: 1, numero: "1", ano: 2024, situacao: "Processo autuado", origem_recursos: null, motivo: null, submotivo: null, iniciativa: null,
  dt_instauracao: "2024-01-01", dt_inicio_prazo: null, dt_prestacao_contas: null, dt_atualizacao_debito: null, debito_original: 300_000,
  debito_sem_juros: null, debito_com_juros: 900_000, numero_processo: `0${nr}/2024-0`, url_processo: null, numero_acordao: null, origem_acordao: null,
  parecer_controle_interno: null, analise_boa_fe: null,
});
const planoPix = (id: number): PlanoLaudoPix => ({
  id_plano_acao: id, codigo_plano_acao: null, ano: 2024, beneficiario: "Patos", cnpj: "09084815000170", cod_ibge: "2510808", autor: null, codigo_emenda: null,
  situacao: null, valor: 1_400_000, custeio: 0, investimento: 1_400_000, pago: 1_337_500, dt_primeira_ob: null, fim_execucao: null, limite_execucao: null,
  area: null, objeto: null, saldo: null, dt_saldo: null, pior: "alto", n_critico: 0, n_alto: 1, n_moderado: 0, n_pendente: 0, versao: null,
  itens: [{ item: "C1", titulo: "Relatório de gestão não entregue", dispositivo: "IN 93, art. 3º", estado: "nao_atendido", nivel: "alto", fato: "x" }],
});

/** Um município com tudo: fiscal, TCU, Pix, fornecedores com nome, convênios em análise, propostas, emendas e indicadores. */
const patosCompleto = (): EntradaRelatorio => ({
  ibge: "2510808",
  nome: "Patos",
  fiscal: {
    municipio: municipioFiscal,
    verificacoes: [verificacao("G1", "atendido", "Entregues."), verificacao("G2", "nao_atendido", "54,54% da RCL ajustada.")],
    referencia: "2026-09-30",
  },
  serie: {
    anos: [2025, 2026],
    periodos: [
      { exercicio: 2025, periodicidade: "Q", periodo: 3, dtp_pct: 55.75, limite_maximo_pct: 54, limite_prudencial_pct: 51.3 },
      { exercicio: 2026, periodicidade: "Q", periodo: 1, dtp_pct: 54.13, limite_maximo_pct: 54, limite_prudencial_pct: 51.3 },
    ],
  },
  instrumentos: [
    instrumento({ nr_convenio: "942082", objeto: "Máquinas agrícolas", dt_fim_vigencia: "2026-09-30" }),
    instrumento({ nr_convenio: "990001", vl_global: 66_000_000, vl_desembolsado: 31_000_000 }),
    instrumento({ nr_convenio: "826152", situacao: "Aguardando Prestação de Contas", dt_limite_contas: "2020-02-29" }),
    instrumento({ nr_convenio: "703764", situacao: "Prestação de Contas Rejeitada", orgao_sup: "MINISTERIO DO TURISMO" }),
    instrumento({ nr_convenio: "989358", situacao_contratacao: "Liminar Judicial", dt_fim_vigencia: "2027-06-30" }),
  ],
  referenciaPainel: "2026-09-29",
  emendas: [
    { nr_convenio: "990001", parlamentar: "FULANO DE TAL", tipo_parlamentar: "Deputado Federal", valor: 500_000 },
    { nr_convenio: "942082", parlamentar: "BELTRANA", tipo_parlamentar: "Senadora", valor: 250_000 },
  ],
  propostas: [
    { id_proposta: "1", ano_envio: 2019, desfecho: "aberta_concedente", orgao_sup: null, programa: null, valor_repasse: 200_000, dias_sem_evento: 2000, dt_ultimo_evento: null, limbo: true },
    { id_proposta: "3", ano_envio: 2025, desfecho: "assinada", orgao_sup: null, programa: null, valor_repasse: 500_000, dias_sem_evento: null, dt_ultimo_evento: null },
  ],
  tcu: {
    consultas: [{ nr_convenio: "703764", situacao_convenio: null, cod_ibge: "2510808", n_tce: 1, erro: null }],
    tces: [tceTcu("703764")],
    referencia: "2026-09-30",
  },
  contasObras: {},
  pix: [planoPix(1), planoPix(2)],
  pixTce: [{ ibge: "2510808", ano: 2025, pago: 2_000_000, pago_pessoal: 0, pago_juros: 0, pago_amortizacao: 0, pct_capital: 95 } as never],
  fundo: [],
  conciliacao: null,
  fornecedores: {
    concentracao: {
      cod_ibge: "2510808", municipio: "Patos", convenios: 30, n_fornecedores: 56, pago_pj: 61_600_000, pago_pf: 0,
      maior_cnpj: "05476456000146", maior_nome: "EMPRESA X", maior_pago: 40_000_000, maior_fatia: 0.65, hhi: 0.4,
    },
    inidoneos: [{ cnpj: "11222333000144", nome: "EMPRESA INIDONEA", pago: 90_000 }],
  },
  janelas: { elegiveis: 3, urgentes: [{ titulo: "Programa X", orgao: "MDS", fim: "2026-10-20" }] },
  indicadores: indicadores(),
  faltas: [],
});

/** O que a página faz no nível 0: sem nomes (o público não é administrador), depois o recorte do nível. */
const doNivel0 = (e: EntradaRelatorio, hoje = "2026-10-01") => relatorioDoNivel(relatorioSemNomes(montarRelatorio(e, hoje)), 0);

/** As fontes que não são do público: as datas delas e as faltas delas não podem chegar pela leitura leve. */
const FALTAS_FORA_DO_PUBLICO = new Set(FONTES_RELATORIO.filter((f) => !FONTES_DO_PUBLICO.includes(f)).flatMap((f) => FALTAS_DA_FONTE[f]));

/**
 * A prova de que a leitura leve não esconde a menos nem a mais: o relatório da leitura pública, recortado para o nível
 * 0, é IGUAL ao da leitura completa com o mesmo recorte, campo a campo. Os três campos que por construção diferiam
 * (destaques, fontes e as faltas das fontes de fora do público) o recorte do nível 0 passou a tirar (supervisor, onda
 * 7, 09/10/2026, sugestão do A): o nível 0 não desenha nenhum deles.
 */
function provarEquivalencia(e: EntradaRelatorio): { leve: Relatorio; completo: Relatorio } {
  const completo = doNivel0(e);
  const leve = doNivel0(entradaDasFontes(e, fontesDoNivel(0)));
  assert.deepEqual(leve, completo);
  assert.deepEqual(leve.destaques, [], "o nível 0 não recebe os destaques");
  assert.deepEqual(leve.fontes, [], "o nível 0 não recebe as fontes");
  for (const f of leve.faltas) assert.ok(!FALTAS_FORA_DO_PUBLICO.has(f), `falta de fonte de fora do público: ${f}`);
  return { leve, completo };
}

test("equivalência: Patos com tudo — o público vê o mesmo com a leitura leve e com a completa", () => {
  const e = patosCompleto();
  const { leve, completo } = provarEquivalencia(e);
  // a entrada tem mesmo o que o público não vê, e o que ele vê (senão o teste não prova nada)
  const inteiro = montarRelatorio(e, "2026-10-01");
  assert.ok(inteiro.fiscal && inteiro.controle && inteiro.pix && inteiro.fornecedores);
  assert.ok(completo.achados.length > 0 && completo.emDia.length > 0, "há indicadores para o público");
  assert.ok(completo.cartoes.length === 1 && completo.emendas?.length === 2);
  assert.ok(inteiro.destaques.length > 0 && inteiro.fontes.length > 0, "o inteiro tem destaques e fontes, que o recorte tira");
  assert.ok(leve.achados.length === completo.achados.length);
});

test("equivalência: fontes fora do ar — as faltas do público ficam, as do resto saem", () => {
  const e = { ...patosCompleto(), fiscal: null, serie: null, tcu: null, indicadores: null, emendas: null, faltas: ["painel fiscal", "e-TCE do TCU", "indicadores do município", "emendas"] };
  const { leve } = provarEquivalencia(e);
  assert.deepEqual(leve.faltas, ["indicadores do município", "emendas"]);
  assert.equal(leve.indicadores, null);
});

test("equivalência: a entidade (escopo, área excetuada, sem janelas nem indicadores)", () => {
  const e: EntradaRelatorio = { ...patosCompleto(), nome: "FUNDO MUNICIPAL DE SAUDE DE PATOS", escopo: "entidade", areaExcetuada: "saude", janelas: null, indicadores: null };
  const { leve, completo } = provarEquivalencia(e);
  assert.equal(leve.escopo, "entidade");
  assert.deepEqual(completo.achados, [], "a entidade não tem indicadores: o público não vê achado nenhum");
});

test("equivalência: o município sem nada na base", () => {
  const e: EntradaRelatorio = {
    ...patosCompleto(),
    fiscal: null, serie: null, instrumentos: [], emendas: [], propostas: [], tcu: null, contasObras: null, pix: [], pixTce: null, fundo: null,
    conciliacao: null, fornecedores: null, janelas: null, indicadores: null,
  };
  provarEquivalencia(e);
});

test("equivalência: sem fiscal, TCU nem análise na frente, as duas leituras dão o mesmo relatório, campo a campo", () => {
  const e: EntradaRelatorio = {
    ...patosCompleto(),
    fiscal: null, serie: null, tcu: null, pix: null, pixTce: null, fundo: null, fornecedores: null,
    instrumentos: [instrumento({ nr_convenio: "990001", vl_global: 66_000_000, vl_desembolsado: 31_000_000 })],
    propostas: [{ id_proposta: "3", ano_envio: 2025, desfecho: "assinada", orgao_sup: null, programa: null, valor_repasse: 500_000, dias_sem_evento: null, dt_ultimo_evento: null }],
  };
  assert.deepEqual(doNivel0(entradaDasFontes(e, fontesDoNivel(0))), doNivel0(e));
});

test("nada vaza: a leitura leve não tem fiscal, controle, TCE-PB, Pix nem fornecedores, nem antes do recorte", () => {
  const e = patosCompleto();
  const leve = montarRelatorio(entradaDasFontes(e, fontesDoNivel(0)), "2026-10-01");
  assert.equal(leve.fiscal, null);
  assert.equal(leve.controle, null);
  assert.equal(leve.pix, null);
  assert.equal(leve.tcePb, null);
  assert.equal(leve.fornecedores, null);
  // Achados só das fontes lidas: indicadores, convênios e propostas (a prestação de contas rejeitada ou atrasada é
  // "controle", mas vem da situação do convênio no SICONV; o recorte do nível 0 a tira, como as outras análises).
  assert.ok(leve.achados.every((a) => !["fiscal", "pix", "tce_pb", "fornecedores"].includes(a.dimensao)));
  assert.ok(!leve.achados.some((a) => /TCU|tomada de contas/i.test(a.titulo)), "nada do e-TCE");
  const texto = JSON.stringify(leve);
  for (const segredo of ["EMPRESA X", "05476456000146", "EMPRESA INIDONEA", "11222333000144", "0703764/2024-0", "Relatório de gestão não entregue", "54,54"]) {
    assert.ok(!texto.includes(segredo), segredo);
  }
});

test("a entrada da leitura: com todas as fontes, a mesma; com as do público, o resto null — e a recebida não muda", () => {
  const e = patosCompleto();
  assert.deepEqual(entradaDasFontes(e, FONTES_RELATORIO), e);
  const p = entradaDasFontes(e, fontesDoNivel(0));
  assert.ok(e.fiscal && e.tcu && e.pix && e.fornecedores, "não mexe na recebida");
  const fixos = new Set(["ibge", "nome", "referenciaPainel", "escopo", "areaExcetuada", "faltas"]);
  const comDado = Object.entries(p)
    .filter(([k, v]) => !fixos.has(k) && v !== null && v !== undefined)
    .map(([k]) => k)
    .sort();
  assert.deepEqual(comDado, ["emendas", "indicadores", "instrumentos", "janelas", "propostas"], "só os campos das fontes do público");
});

test("tamanho: um município grande (400 convênios, 300 propostas, 400 emendas) cabe com folga no item de 2 MB", () => {
  const e = patosCompleto();
  const grande: EntradaRelatorio = {
    ...e,
    instrumentos: Array.from({ length: 400 }, (_, i) =>
      instrumento({ nr_convenio: String(800000 + i), objeto: `Aquisição de equipamentos e obra de pavimentação em vias urbanas, lote ${i}`, programa: "PROGRAMA DE APOIO" }),
    ),
    propostas: Array.from({ length: 300 }, (_, i) => ({
      id_proposta: String(i), ano_envio: 2019 + (i % 7), desfecho: i % 3 ? "aberta_concedente" : "assinada", orgao_sup: "MINISTERIO DAS CIDADES",
      programa: "PROGRAMA", valor_repasse: 100_000 + i, dias_sem_evento: 400 + i, dt_ultimo_evento: "2025-01-01",
    })),
    emendas: Array.from({ length: 400 }, (_, i) => ({ nr_convenio: String(800000 + i), parlamentar: `PARLAMENTAR ${i % 40}`, tipo_parlamentar: "Deputado Federal", valor: 100_000 })),
  };
  for (const leitura of [{ estado: "ok", relatorio: montarRelatorio(grande, "2026-10-01") }]) {
    const g = decidirGuarda(leitura, { guardavel: leituraGuardavel, desde: 1 });
    assert.equal(g.guardar, true);
    if (g.guardar) assert.ok(g.tamanho < LIMITE_ITEM / 4, `${g.tamanho} caracteres`);
  }
});
