/**
 * As emendas impositivas da Câmara Municipal de João Pessoa (J2, 16/10/2026) — puro: sem banco, rede nem relógio.
 *
 * O dado vem das tabelas `ejp_*` (oport_44), gravadas pelo job `emendas_jp/` todo dia:
 *   · o PAINEL da Prefeitura dá o exercício corrente (a linha é código + unidade gestora; a linha remanejada fica com
 *     dotação zero), com dotação atual, empenhado, liquidado e pago;
 *   · o PORTAL da Prefeitura dá o histórico (2021 a 2025, arquivos conferidos), com o valor original e o atual;
 *   · o TCE-PB dá o empenho com número e data (código de acompanhamento 3310, desde 2026), ligado à emenda pelo número
 *     citado no histórico do empenho;
 *   · o SAPL da Câmara dá a matéria de cada emenda e o autor pelo código. O vereador vem da semente curada da PONTE.
 *
 * Regras de leitura: painel e portal nunca se somam no mesmo ano (cada ano tem uma fonte); o vereador é agente público;
 * credor pessoa física é só somado; "ponto para olhar", nunca "irregular"; sem posição nem nota.
 */
import { dobrar } from "./emendas-pb.ts";
import type { EstadualAno, FederalAno, MunicipalAno } from "./lado-a-lado.ts";

// ================================================================ o que vem do banco

export interface ExecucaoEjp {
  id: number;
  concluidaEm: string;
  /** A `ultimaAtualizacao` do painel. */
  dadoAte: string | null;
  referencia: string | null;
  /** O exercício do painel (2026 em 16/10/2026). */
  exercicio: number | null;
}

export interface VereadorEjp {
  pessoa: string;
  tipo: "vereador" | "colegiado";
  sapl_autor: number | null;
  grafias_painel: string[];
  grafias_loa: string[];
  anos: number[];
}

export interface LinhaEjp {
  ano: number;
  codigo: number;
  ug: string;
  vereador_publicado: string | null;
  pessoa: string | null;
  sapl_materia: number | null;
  objeto: string | null;
  cnpj_objeto: string | null;
  cnpj_objeto_invalido: boolean;
  dotacao: number;
  empenhado: number;
  liquidado: number;
  pago: number;
  situacao: string | null;
  remanejada: boolean;
  empenhos_n: number;
  pagamentos_n: number;
}

export interface DotacaoEjp {
  ano: number;
  codigo: number;
  seq: number;
  data: string | null;
  valor_original: number;
  valor_atual: number;
}

export interface CredorEjp {
  ano: number;
  codigo: number;
  ug: string;
  seq: number;
  credor_cnpj: string;
  credor_nome: string | null;
  funcao: string | null;
  acao: string | null;
  fonte: string | null;
  modalidade_licitacao: string | null;
  historico: string | null;
}

export interface EmpenhoEjp {
  ano: number;
  ug_codigo: string;
  ug_nome: string | null;
  numero_empenho: string;
  seq: number;
  data_empenho: string | null;
  credor_cnpj: string;
  credor_nome: string | null;
  empenhado: number;
  liquidado: number;
  pago: number;
  elemento: string | null;
  modalidade_licitacao: string | null;
  numero_licitacao: string | null;
  historico: string | null;
  codigo_citado: number | null;
  ano_citado: number | null;
}

export interface PfEjp {
  ano: number;
  codigo: number | null;
  empenhado: number;
  liquidado: number;
  pago: number;
  notas: number;
}

export interface HistEmendaEjp {
  ano: number;
  mes_referencia: string | null;
  ug_codigo: string;
  ug_nome: string | null;
  codigo: number;
  objetivo: string | null;
  cnpj_objeto: string | null;
  cnpj_objeto_invalido: boolean;
  autor_publicado: string | null;
  pessoa: string | null;
  original: number;
  atual: number;
  empenhado: number;
  liquidado: number;
  pago: number;
}

export interface HistLoaEjp {
  ano: number;
  codigo: number;
  seq: number;
  autor_publicado: string | null;
  pessoa: string | null;
  funcional: string | null;
  natureza: string | null;
  fonte: string | null;
  objetivo: string | null;
  valor: number;
}

export interface MateriaEjp {
  sapl_id: number;
  numero: number;
  ano: number;
  loa: number;
  pessoa: string | null;
  ementa: string | null;
  data_apresentacao: string | null;
  em_tramitacao: boolean | null;
  texto_url: string | null;
}

export interface RetratoEjp {
  execucao: ExecucaoEjp;
  vereadores: VereadorEjp[];
  linhas: LinhaEjp[];
  dotacoes: DotacaoEjp[];
  /** Os credores dos empenhos que o painel lista (pessoa jurídica). */
  credores: CredorEjp[];
  empenhos: EmpenhoEjp[];
  pf: PfEjp[];
  hist: HistEmendaEjp[];
  loa: HistLoaEjp[];
}

export interface MovimentoEjp {
  referencia: string | null;
  ug: string;
  campo: string;
  antes: number | null;
  depois: number | null;
}

/**
 * A entidade citada no objeto da emenda (J3, 19/10/2026): o cadastro no Mapa das OSC (Ipea) e o que ela recebeu de
 * emendas federais e estaduais por ano. Cada parte pode faltar sozinha: null é "não lido agora".
 */
export interface EntidadeCitadaJp {
  cnpj: string;
  osc:
    | { estado: "ok"; razaoSocial: string | null; ativa: boolean; natureza: string | null; areas: string[]; municipio: string | null }
    | { estado: "nao_encontrada" }
    | null;
  federal: FederalAno[] | null;
  estadual: EstadualAno[] | null;
}

export type LeituraCamaraJp = { estado: "ok"; retrato: RetratoEjp } | { estado: "sem_dado" } | { estado: "falha" };
export type LeituraEmendaJp =
  | {
      estado: "ok";
      retrato: RetratoEjp;
      ano: number;
      codigo: number;
      materia: MateriaEjp | null;
      movimentos: MovimentoEjp[];
      /** A entidade citada pelo CNPJ no objeto (J3); null quando o objeto não cita CNPJ válido. */
      entidade: EntidadeCitadaJp | null;
    }
  | { estado: "nao_encontrado" }
  | { estado: "sem_dado" }
  | { estado: "falha" };

// ================================================================ endereços

export const URL_CAMARA_JP = "/mapa/parlamentares/camara-jp";
export const URL_FILA_EJP = `${URL_CAMARA_JP}/fila`;
export const IBGE_JOAO_PESSOA = "2507507";
export const URL_SAPL_MATERIA = "https://sapl.joaopessoa.pb.leg.br/materia/";
export const URL_PAINEL_PREFEITURA = "https://transparenciaemendas.joaopessoa.pb.gov.br/";

/** "2026-0171": o ano do exercício e o número da emenda com quatro dígitos. */
export const chaveEmendaJp = (ano: number, codigo: number): string => `${ano}-${String(codigo).padStart(4, "0")}`;
export const urlEmendaJp = (ano: number, codigo: number): string => `${URL_CAMARA_JP}/emenda/${chaveEmendaJp(ano, codigo)}`;

export function emendaJpDaUrl(v: string | null | undefined): { ano: number; codigo: number } | null {
  const m = typeof v === "string" ? /^(20\d{2})-(\d{1,4})$/.exec(v) : null;
  return m ? { ano: Number(m[1]), codigo: Number(m[2]) } : null;
}

/** "CARLÃO PELO BEM" → "carlao-pelo-bem". */
export function slugVereador(pessoa: string): string {
  return dobrar(pessoa)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const urlVereadorJp = (pessoa: string): string => `${URL_CAMARA_JP}/${slugVereador(pessoa)}`;

/** A razão em %, ou null quando a base é zero. */
export function pct(parte: number, base: number): number | null {
  return base > 0 ? Math.round((parte / base) * 1000) / 10 : null;
}

// ================================================================ a etapa da execução

export type EtapaEjp = "sem_valor" | "sem_empenho" | "empenhada" | "liquidada" | "paga_em_parte" | "paga";

export const ORDEM_ETAPAS: readonly EtapaEjp[] = ["sem_empenho", "empenhada", "liquidada", "paga_em_parte", "paga", "sem_valor"];

export const ROTULO_ETAPA: Record<EtapaEjp, string> = {
  sem_empenho: "Sem empenho",
  empenhada: "Empenhada, falta liquidar",
  liquidada: "Liquidada, falta pagar",
  paga_em_parte: "Paga em parte",
  paga: "Paga",
  sem_valor: "Sem valor (remanejada ou cancelada)",
};

/** Pelo valor atual e pela execução: tolerância de R$ 0,50 para "paga". */
export function etapaDe(v: { atual: number; empenhado: number; liquidado: number; pago: number }): EtapaEjp {
  if (v.atual <= 0) return "sem_valor";
  if (v.pago >= v.atual - 0.5) return "paga";
  if (v.pago > 0) return "paga_em_parte";
  if (v.liquidado > 0) return "liquidada";
  if (v.empenhado > 0) return "empenhada";
  return "sem_empenho";
}

// ================================================================ a emenda (painel e portal no mesmo molde)

export interface EmendaJp {
  chave: string;
  ano: number;
  codigo: number;
  /** "painel": o exercício corrente, ao vivo; "portal": os arquivos do portal (histórico). */
  origem: "painel" | "portal";
  /** A posição do arquivo do portal ("Dezembro"; 2023 só "Agosto"). */
  mesReferencia: string | null;
  pessoa: string | null;
  autorPublicado: string | null;
  objeto: string | null;
  cnpj: string | null;
  /** O objeto cita CNPJ com dígito verificador errado. */
  cnpjInvalido: boolean;
  unidades: string[];
  /** O valor original da emenda (o do painel vem da tabela de dotação; sem ela, null). */
  original: number | null;
  atual: number;
  empenhado: number;
  liquidado: number;
  pago: number;
  etapa: EtapaEjp;
  remanejada: boolean;
  materia: number | null;
  /** O primeiro empenho no TCE-PB (código citado no histórico) e quantos há. */
  primeiroEmpenho: string | null;
  empenhosTce: number;
}

const soma = <T,>(xs: readonly T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const arred = (x: number) => Math.round(x * 100) / 100;

/** Os empenhos do TCE-PB ligados à emenda: número citado no histórico e ano citado = ano da apresentação. */
export function empenhosDaEmenda(empenhos: readonly EmpenhoEjp[], ano: number, codigo: number): EmpenhoEjp[] {
  return empenhos.filter((e) => e.codigo_citado === codigo && e.ano_citado !== null && e.ano_citado + 1 === ano && e.ano === ano);
}

export function emendasDoRetrato(r: RetratoEjp): EmendaJp[] {
  const saida: EmendaJp[] = [];
  const porCodigo = new Map<string, LinhaEjp[]>();
  for (const l of r.linhas) {
    const k = chaveEmendaJp(l.ano, l.codigo);
    porCodigo.set(k, [...(porCodigo.get(k) ?? []), l]);
  }
  const original = new Map<string, number>();
  for (const d of r.dotacoes) {
    const k = chaveEmendaJp(d.ano, d.codigo);
    original.set(k, (original.get(k) ?? 0) + d.valor_original);
  }
  const tce = new Map<string, EmpenhoEjp[]>();
  for (const e of r.empenhos) {
    if (e.codigo_citado === null || e.ano_citado === null || e.ano_citado + 1 !== e.ano) continue;
    const k = chaveEmendaJp(e.ano, e.codigo_citado);
    tce.set(k, [...(tce.get(k) ?? []), e]);
  }
  for (const [chave, ls] of porCodigo) {
    const valores = {
      atual: arred(soma(ls, (l) => l.dotacao)),
      empenhado: arred(soma(ls, (l) => l.empenhado)),
      liquidado: arred(soma(ls, (l) => l.liquidado)),
      pago: arred(soma(ls, (l) => l.pago)),
    };
    const comValor = ls.filter((l) => l.dotacao > 0);
    const base = comValor[0] ?? ls[0];
    const emps = tce.get(chave) ?? [];
    const datas = emps.map((e) => e.data_empenho).filter((d): d is string => !!d).sort();
    saida.push({
      chave,
      ano: base.ano,
      codigo: base.codigo,
      origem: "painel",
      mesReferencia: null,
      pessoa: base.pessoa,
      autorPublicado: base.vereador_publicado,
      objeto: base.objeto,
      cnpj: ls.find((l) => l.cnpj_objeto)?.cnpj_objeto ?? null,
      cnpjInvalido: ls.some((l) => l.cnpj_objeto_invalido),
      unidades: [...new Set((comValor.length ? comValor : ls).map((l) => l.ug))],
      original: original.has(chave) ? arred(original.get(chave) ?? 0) : null,
      ...valores,
      etapa: etapaDe(valores),
      remanejada: ls.some((l) => l.remanejada),
      materia: base.sapl_materia,
      primeiroEmpenho: datas[0] ?? null,
      empenhosTce: emps.length,
    });
  }
  const hist = new Map<string, HistEmendaEjp[]>();
  for (const h of r.hist) {
    const k = chaveEmendaJp(h.ano, h.codigo);
    hist.set(k, [...(hist.get(k) ?? []), h]);
  }
  for (const [chave, hs] of hist) {
    if (porCodigo.has(chave)) continue; // o ano do painel não se repete pelo portal
    const valores = {
      atual: arred(soma(hs, (h) => h.atual)),
      empenhado: arred(soma(hs, (h) => h.empenhado)),
      liquidado: arred(soma(hs, (h) => h.liquidado)),
      pago: arred(soma(hs, (h) => h.pago)),
    };
    const base = hs.find((h) => h.atual > 0) ?? hs[0];
    saida.push({
      chave,
      ano: base.ano,
      codigo: base.codigo,
      origem: "portal",
      mesReferencia: base.mes_referencia,
      pessoa: base.pessoa,
      autorPublicado: base.autor_publicado,
      objeto: base.objetivo,
      cnpj: hs.find((h) => h.cnpj_objeto)?.cnpj_objeto ?? null,
      cnpjInvalido: hs.some((h) => h.cnpj_objeto_invalido),
      unidades: [...new Set(hs.map((h) => h.ug_nome ?? h.ug_codigo))],
      original: arred(soma(hs, (h) => h.original)),
      ...valores,
      etapa: etapaDe(valores),
      remanejada: false,
      materia: null,
      primeiroEmpenho: null,
      empenhosTce: 0,
    });
  }
  return saida.sort((a, b) => b.ano - a.ano || a.codigo - b.codigo);
}

// ================================================================ a Câmara por ano

export interface AnoJp {
  ano: number;
  origem: "painel" | "portal";
  mesReferencia: string | null;
  emendas: number;
  original: number | null;
  atual: number;
  empenhado: number;
  pago: number;
  pctPago: number | null;
  semAutor: number;
  semEmpenho: number;
}

export function anosDaCamara(emendas: readonly EmendaJp[]): AnoJp[] {
  const anos = [...new Set(emendas.map((e) => e.ano))].sort((a, b) => b - a);
  return anos.map((ano) => {
    const es = emendas.filter((e) => e.ano === ano && e.etapa !== "sem_valor");
    const todas = emendas.filter((e) => e.ano === ano);
    const atual = arred(soma(es, (e) => e.atual));
    const pago = arred(soma(es, (e) => e.pago));
    const originais = todas.map((e) => e.original);
    return {
      ano,
      origem: todas[0].origem,
      mesReferencia: todas[0].mesReferencia,
      emendas: es.length,
      original: originais.every((x) => x === null) ? null : arred(soma(originais, (x) => x ?? 0)),
      atual,
      empenhado: arred(soma(es, (e) => e.empenhado)),
      pago,
      pctPago: pct(pago, atual),
      semAutor: es.filter((e) => !e.pessoa).length,
      semEmpenho: es.filter((e) => e.etapa === "sem_empenho").length,
    };
  });
}

// ================================================================ os vereadores

export interface VereadorJp {
  pessoa: string;
  slug: string;
  tipo: "vereador" | "colegiado";
  anoMin: number | null;
  anoMax: number | null;
  emendas: number;
  atual: number;
  empenhado: number;
  pago: number;
  /** No exercício do painel. */
  exercicioEmendas: number;
  exercicioAtual: number;
  exercicioPago: number;
  exercicioSemEmpenho: number;
}

/** Os vereadores e colegiados com emenda, em ordem de nome. A emenda sem valor (remanejada ou cancelada) não conta. */
export function vereadoresDoRetrato(r: RetratoEjp, emendas: readonly EmendaJp[]): VereadorJp[] {
  const exercicio = r.execucao.exercicio;
  const tipo = new Map(r.vereadores.map((v) => [v.pessoa, v.tipo]));
  const porPessoa = new Map<string, EmendaJp[]>();
  for (const e of emendas) {
    if (!e.pessoa || e.etapa === "sem_valor") continue;
    porPessoa.set(e.pessoa, [...(porPessoa.get(e.pessoa) ?? []), e]);
  }
  return [...porPessoa.entries()]
    .map(([pessoa, es]) => {
      const anos = es.map((e) => e.ano);
      const ex = es.filter((e) => e.ano === exercicio);
      return {
        pessoa,
        slug: slugVereador(pessoa),
        tipo: tipo.get(pessoa) ?? "vereador",
        anoMin: Math.min(...anos),
        anoMax: Math.max(...anos),
        emendas: es.length,
        atual: arred(soma(es, (e) => e.atual)),
        empenhado: arred(soma(es, (e) => e.empenhado)),
        pago: arred(soma(es, (e) => e.pago)),
        exercicioEmendas: ex.length,
        exercicioAtual: arred(soma(ex, (e) => e.atual)),
        exercicioPago: arred(soma(ex, (e) => e.pago)),
        exercicioSemEmpenho: ex.filter((e) => e.etapa === "sem_empenho").length,
      };
    })
    .sort((a, b) => a.pessoa.localeCompare(b.pessoa, "pt-BR"));
}

export function vereadorDoSlug(vereadores: readonly VereadorJp[], slug: string): VereadorJp | null {
  return vereadores.find((v) => v.slug === slug) ?? null;
}

// ================================================================ a fila da execução (o exercício)

/** As emendas do exercício que ainda não estão pagas por inteiro, da etapa mais atrás para a mais à frente. */
export function filaDaExecucao(emendas: readonly EmendaJp[], exercicio: number | null): EmendaJp[] {
  const ordem = (e: EtapaEjp) => ORDEM_ETAPAS.indexOf(e);
  return emendas
    .filter((e) => e.ano === exercicio && e.etapa !== "paga" && e.etapa !== "sem_valor")
    .sort((a, b) => ordem(a.etapa) - ordem(b.etapa) || b.atual - a.atual || a.codigo - b.codigo);
}

export function resumoDasEtapas(emendas: readonly EmendaJp[], exercicio: number | null): { etapa: EtapaEjp; emendas: number; atual: number }[] {
  const es = emendas.filter((e) => e.ano === exercicio);
  return ORDEM_ETAPAS.map((etapa) => {
    const xs = es.filter((e) => e.etapa === etapa);
    return { etapa, emendas: xs.length, atual: arred(soma(xs, (e) => e.atual)) };
  }).filter((x) => x.emendas > 0);
}

// ================================================================ a entidade

export interface EmendaDaEntidade {
  emenda: EmendaJp;
  /** "objeto": o objeto da emenda cita o CNPJ; "credor": a entidade é credora de empenho dela (painel ou TCE-PB). */
  como: "objeto" | "credor" | "objeto_e_credor";
  /** O que o TCE-PB registrou de empenho a ela nesta emenda. */
  empenhadoTce: number;
  pagoTce: number;
}

export function emendasJpDaEntidade(r: RetratoEjp, emendas: readonly EmendaJp[], cnpj: string): EmendaDaEntidade[] {
  const doCnpj = r.empenhos.filter((e) => e.credor_cnpj === cnpj);
  const credora = new Set<string>([
    ...doCnpj.filter((e) => e.codigo_citado !== null && e.ano_citado !== null).map((e) => chaveEmendaJp(e.ano, e.codigo_citado as number)),
    ...r.credores.filter((c) => c.credor_cnpj === cnpj).map((c) => chaveEmendaJp(c.ano, c.codigo)),
  ]);
  return emendas
    .filter((e) => e.etapa !== "sem_valor" && (e.cnpj === cnpj || credora.has(e.chave)))
    .map((e) => {
      const emps = empenhosDaEmenda(doCnpj, e.ano, e.codigo);
      const porObjeto = e.cnpj === cnpj;
      const porCredor = credora.has(e.chave);
      return {
        emenda: e,
        como: porObjeto && porCredor ? ("objeto_e_credor" as const) : porObjeto ? ("objeto" as const) : ("credor" as const),
        empenhadoTce: arred(soma(emps, (x) => x.empenhado)),
        pagoTce: arred(soma(emps, (x) => x.pago)),
      };
    });
}

export const ROTULO_COMO: Record<EmendaDaEntidade["como"], string> = {
  objeto: "Citada no objeto",
  credor: "Credora do empenho",
  objeto_e_credor: "Citada no objeto e credora",
};

// ================================================================ textos

/** "painel da Prefeitura (ao vivo)" ou "portal da Prefeitura, posição de Dezembro". */
export function fonteDoAno(a: Pick<AnoJp, "origem" | "mesReferencia">): string {
  return a.origem === "painel" ? "painel da Prefeitura (diário)" : `portal da Prefeitura, posição de ${(a.mesReferencia ?? "—").toLowerCase()}`;
}

// ================================================================ por ano, para o lado a lado (J3, 19/10/2026)

/** A Câmara inteira por ano (o orçamento do município indicado pelos vereadores). A emenda sem valor não conta. */
export function municipalPorAno(emendas: readonly EmendaJp[]): MunicipalAno[] {
  const m = new Map<number, MunicipalAno>();
  for (const e of emendas) {
    if (e.etapa === "sem_valor") continue;
    const a = m.get(e.ano) ?? { ano: e.ano, atual: 0, pago: 0 };
    a.atual = arred(a.atual + e.atual);
    a.pago = arred(a.pago + e.pago);
    m.set(e.ano, a);
  }
  return [...m.values()].sort((a, b) => a.ano - b.ano);
}

/** O valor atual e o pago das emendas que citam a entidade ou a têm como credora (a emenda inteira). */
export function municipalDaEntidadePorAno(daEntidade: readonly EmendaDaEntidade[]): MunicipalAno[] {
  return municipalPorAno(daEntidade.map((x) => x.emenda));
}

// ================================================================ pontos para olhar (J3, 19/10/2026)

export type PontoEjp = "cnpj_invalido" | "credor_diferente" | "sem_empenho_tce";

export const ROTULO_PONTO: Record<PontoEjp, string> = {
  cnpj_invalido: "CNPJ citado com dígito errado",
  credor_diferente: "Empenho a outro CNPJ que não o citado",
  sem_empenho_tce: "Empenhada no painel sem empenho do TCE-PB ligado",
};

export interface PontoParaOlhar {
  emenda: EmendaJp;
  ponto: PontoEjp;
  detalhe: string;
}

const reaisTexto = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * O que pede um segundo olhar, sem juízo: o objeto que cita CNPJ com dígito errado; a emenda que cita uma entidade e
 * cujo empenho no TCE-PB vai a outro CNPJ (pode ser compra feita pela Prefeitura para a entidade); e a emenda com
 * empenho no painel sem nenhum empenho do TCE-PB que a cite (o histórico do empenho pode não citar a emenda, e o
 * arquivo do TCE-PB anda atrás do painel). Nunca "irregular".
 */
export function pontosParaOlhar(r: RetratoEjp, emendas: readonly EmendaJp[]): PontoParaOlhar[] {
  const saida: PontoParaOlhar[] = [];
  for (const e of emendas) {
    if (e.etapa === "sem_valor") continue;
    if (e.cnpjInvalido) saida.push({ emenda: e, ponto: "cnpj_invalido", detalhe: "O objeto cita um CNPJ cujo dígito verificador não confere." });
    if (e.origem !== "painel") continue;
    if (e.cnpj) {
      const outros = empenhosDaEmenda(r.empenhos, e.ano, e.codigo).filter((x) => x.credor_cnpj !== e.cnpj);
      if (outros.length) {
        const v = arred(soma(outros, (x) => x.empenhado));
        saida.push({
          emenda: e,
          ponto: "credor_diferente",
          detalhe: `${outros.length} ${outros.length === 1 ? "empenho" : "empenhos"} no TCE-PB a outro CNPJ (${reaisTexto(v)}).`,
        });
      }
    }
    if (e.empenhado > 0 && e.empenhosTce === 0) {
      saida.push({ emenda: e, ponto: "sem_empenho_tce", detalhe: `${reaisTexto(e.empenhado)} empenhados no painel; nenhum empenho do TCE-PB cita a emenda.` });
    }
  }
  const ordem: PontoEjp[] = ["cnpj_invalido", "credor_diferente", "sem_empenho_tce"];
  return saida.sort((a, b) => ordem.indexOf(a.ponto) - ordem.indexOf(b.ponto) || b.emenda.ano - a.emenda.ano || a.emenda.codigo - b.emenda.codigo);
}

/** O municipal por ano da leitura da Câmara, para o lado a lado da página de João Pessoa; sem a leitura, nada. */
export function municipalDaLeitura(l: LeituraCamaraJp | undefined): MunicipalAno[] | undefined {
  return l?.estado === "ok" ? municipalPorAno(emendasDoRetrato(l.retrato)) : undefined;
}

/** O municipal por ano das emendas que citam a entidade ou a têm como credora; sem nenhuma, nada (a coluna não aparece). */
export function municipalDaEntidadeNaLeitura(l: LeituraCamaraJp | undefined, cnpj: string): MunicipalAno[] | undefined {
  if (l?.estado !== "ok") return undefined;
  const x = municipalDaEntidadePorAno(emendasJpDaEntidade(l.retrato, emendasDoRetrato(l.retrato), cnpj));
  return x.length ? x : undefined;
}
