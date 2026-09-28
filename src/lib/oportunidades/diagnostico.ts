/**
 * Laudo de qualquer instrumento (onda 12, parte 1): a leitura do que a base já tem.
 *
 * O laudo da onda 11 só existe para os convênios em cláusula suspensiva da coleta do Acesso Livre.
 * Este cobre qualquer instrumento da busca, com os dados abertos do Transferegov:
 *   · a ETAPA (proposta, assinatura, suspensiva, execução, contas, concluído, extinto) e o tempo nela
 *     contra o típico do programa e do órgão (`painel_etapa_tempo`);
 *   · os PARES do programa: na UF, instrumento a instrumento (`painel_instrumento` tem todos os da PB);
 *     no Brasil, o funil das propostas (`painel_programa_desfecho`), porque fora da PB a busca só tem
 *     os instrumentos vivos e contá-los daria uma comparação torta;
 *   · a CARTEIRA do proponente (pelo CNPJ), o dinheiro, a vigência, a emenda de origem, a situação
 *     fiscal do município (decisão B do painel fiscal) e a próxima porta aberta (catálogo de janelas);
 *   · e, a partir disso, riscos, estratégia e o custo de não fazer nada.
 *
 * O caso que puxou a onda: o 962210 (Estado da PB, Ministério da Cultura, R$ 450 mil), com o plano
 * aprovado em 06/06/2024 e nunca assinado; a mediana do órgão na PB entre aprovar e assinar é de 14 dias.
 *
 * Tudo aqui é função pura, sem banco e sem relógio: `hoje` entra como parâmetro. Cada cruzamento
 * pode faltar (leitura que falhou vem `null`) e o laudo sai com o que houver, dizendo o que faltou.
 *
 * Regra de redação, a mesma do laudo da suspensiva: o laudo afirma o que o registro mostra e diz de
 * onde vem; previsão só com a base ao lado ("metade leva até…", "este proponente já teve…").
 */
import { grupoDaSituacao, rotuloSituacaoHistorico, type Instrumento } from "./busca.ts";
import { formatarData } from "./central.ts";
import type { ConclusaoFiscal, EstadoFiscal } from "./fiscal.ts";
import { DIAS_PARADO_ALTO, DIAS_PARADO_MODERADO, RODADAS_REUNIAO, diasEntre, type AcessoLivre, type Nivel, type Passo, type Risco } from "./laudo.ts";
import { MINIMO_MEDICOES, percentual, type LinhaDesfecho, type LinhaEtapa } from "./painel.ts";
import { tituloOrgao } from "./padroes.ts";
import { moedaCurta } from "./radar.ts";

// ================================================================ entrada

/** A linha de `painel_instrumento` com as colunas da oport_19 — ausentes antes dela, por isso opcionais. */
export interface InstrumentoLaudo extends Instrumento {
  situacao_contratacao?: string | null;
  dt_fim_vigencia_original?: string | null;
  vl_global_original?: number | null;
  vl_ingresso_contrapartida?: number | null;
  dt_envio?: string | null;
  dt_aprovacao?: string | null;
  dt_conclusao?: string | null;
  dt_ultimo_historico?: string | null;
  ultimo_historico?: string | null;
}

/** Um instrumento do mesmo programa ou do mesmo proponente, com o mínimo para saber a etapa. */
export type Vizinho = Pick<
  Instrumento,
  | "nr_convenio"
  | "situacao"
  | "uf"
  | "municipio"
  | "proponente"
  | "orgao_sup"
  | "programa"
  | "dt_assinatura"
  | "dt_suspensiva"
  | "dt_retirada_suspensiva"
  | "dt_fim_vigencia"
  | "vl_repasse"
  | "vl_desembolsado"
>;

/** Colunas de `painel_instrumento` que o servidor lê para os vizinhos (todas anteriores à oport_19). */
export const COLUNAS_VIZINHO =
  "nr_convenio,situacao,uf,municipio,proponente,orgao_sup,programa,dt_assinatura,dt_suspensiva,dt_retirada_suspensiva,dt_fim_vigencia,vl_repasse,vl_desembolsado";

/** Uma linha de `painel_instrumento_emenda`. */
export interface EmendaOrigem {
  nr_emenda: string;
  parlamentar: string | null;
  tipo_parlamentar: string | null;
  impositiva: boolean | null;
  valor: number | null;
}

export interface FiscalProponente {
  ibge: string;
  municipio: string;
  /** Decisão B do painel fiscal: receber transferência voluntária. */
  conclusao: ConclusaoFiscal | null;
  caucPendencias: string[];
  referencia: string | null;
}

/** Uma janela aberta do catálogo em que o proponente pode entrar. */
export interface PortaAberta {
  id: string;
  titulo: string;
  financiador: string;
  prazo: string | null;
  diasRestantes: number | null;
  fonteNome: string;
  fonteUrl: string;
  codigos: string[];
  /** A janela é do mesmo programa do instrumento (pelo código do Transferegov). */
  mesmoPrograma: boolean;
  /** O financiador da janela é o órgão concedente do instrumento. */
  mesmoOrgao: boolean;
  /** Algum tema da janela alcança um tema do instrumento: só desempata, não inclui ninguém sozinho. */
  mesmoTema: boolean;
}

/** Nome de órgão para comparar: sem acento, maiúsculas, espaços simples. */
export function chaveOrgao(nome: string | null | undefined): string {
  return (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Entra a janela do mesmo programa ou do mesmo órgão concedente. Tema sozinho não basta: o
 * classificador do catálogo marca "cultura" em janela de agricultura familiar, e o laudo do 962210
 * trazia uma emenda do MDA como porta.
 */
export function portaRelevante(p: Pick<PortaAberta, "mesmoPrograma" | "mesmoOrgao">): boolean {
  return p.mesmoPrograma || p.mesmoOrgao;
}

export interface EntradaDiagnostico {
  instrumento: InstrumentoLaudo;
  /** `painel_etapa_tempo` do órgão e do programa, na UF do instrumento e no Brasil. */
  etapas: LinhaEtapa[];
  /** `painel_programa_desfecho` do programa, na UF e no Brasil. */
  desfechos: LinhaDesfecho[];
  /** Mesmo programa, mesma UF (inclui o próprio). `null`: a leitura falhou. */
  pares: Vizinho[] | null;
  /** Mesmo CNPJ (inclui o próprio). `null`: a leitura falhou ou não há CNPJ. */
  carteira: Vizinho[] | null;
  emendas: EmendaOrigem[] | null;
  fiscal: FiscalProponente | null;
  portas: PortaAberta[] | null;
  /**
   * A coleta do Acesso Livre no recorte da assinatura (onda 12, parte 2): requisitos para celebração,
   * quem analisou e de quem é a vez. Ausente para quem não está na coleta.
   */
  acessoLivre?: AcessoLivre | null;
  /** O que não veio e por quê, para a nota de método. */
  faltas: string[];
}

export interface OpcoesDiagnostico {
  /**
   * Há dossiê da suspensiva (laudo da onda 11) na mesma página: ele já trata prazo da suspensiva,
   * vigência, tempo no órgão, estratégia da retirada e o custo de perder o repasse. O diagnóstico
   * sai só com o que o complementa.
   */
  comDossie?: boolean;
}

// ================================================================ etapa

export type Etapa = "proposta" | "assinatura" | "suspensiva" | "execucao" | "contas" | "concluido" | "extinto";

export const ETAPAS: readonly Etapa[] = ["proposta", "assinatura", "suspensiva", "execucao", "contas", "concluido", "extinto"];

export const ROTULO_ETAPA_LAUDO: Record<Etapa, string> = {
  proposta: "Proposta em análise",
  assinatura: "Aprovado, esperando assinatura",
  suspensiva: "Assinado, em cláusula suspensiva",
  execucao: "Em execução",
  contas: "Prestação de contas",
  concluido: "Concluído",
  extinto: "Anulado, rescindido ou cancelado",
};

/**
 * A etapa pela situação do SICONV. "Aprovado, antes da assinatura" inclui o plano complementado em
 * análise: o SICONV devolve o plano já aprovado para ajuste antes de assinar. Sem situação e sem
 * assinatura, é proposta ainda em análise (em 26/09/2026 eram 588 da PB, quase todas com a proposta
 * "em análise" ou "em complementação").
 */
export function etapaDo(i: Pick<Vizinho, "situacao" | "dt_assinatura" | "dt_suspensiva" | "dt_retirada_suspensiva">): Etapa {
  const grupo = grupoDaSituacao(i.situacao);
  if (grupo === "encerrado") return "extinto";
  if (grupo === "concluido") return "concluido";
  if (grupo === "contas") return "contas";
  if (grupo === "assinatura") return "assinatura";
  if (!i.dt_assinatura) return "proposta";
  if (i.dt_suspensiva && !i.dt_retirada_suspensiva) return "suspensiva";
  return "execucao";
}

/** Etapas em que o instrumento ainda está vivo e o relógio corre contra ele. */
const VIVAS: readonly Etapa[] = ["proposta", "assinatura", "suspensiva", "execucao"];

// ------------------------------------------------------------------ de quem é a vez, pelo histórico

// As listas de `painel_execucao/propostas.py` (_PROPONENTE, _CONCEDENTE, _ASSINATURA).
const HIST_PROPONENTE = new Set([
  "RASCUNHO",
  "PROPOSTA_CADASTRADA",
  "PROPOSTA_EM_COMPLEMENTACAO",
  "PLANO_TRABALHO_EM_COMPLEMENTACAO",
  "PROPOSTA_APROVADA_AGUARDANDO_PLANO_TRABALHO",
]);
const HIST_CONCEDENTE = new Set([
  "PROPOSTA_ENVIADA_ANALISE",
  "PROPOSTA_EM_ANALISE",
  "PROPOSTA_COMPLEMENTADA_ENVIADA_ANALISE",
  "PROPOSTA_COMPLEMENTADA_EM_ANALISE",
  "PLANO_TRABALHO_EM_ANALISE",
  "PLANO_TRABALHO_ENVIADO_ANALISE",
  "PLANO_TRABALHO_COMPLEMENTADO_ENVIADO_ANALISE",
  "PLANO_TRABALHO_COMPLEMENTADO_EM_ANALISE",
  "EM_CHAMAMENTO_PUBLICO_ENVIADA_PARA_ANALISE_PRELIMINAR",
  "EM_CHAMAMENTO_PUBLICO_CLASSIFICADA_ANALISE_PRELIMINAR",
  "PLANO_TRABALHO_APROVADO",
  "ASSINATURA_PENDENTE_REGISTRO_TV_SIAFI",
]);
// As situações de `painel_execucao/definicoes.py` (PC_CONVENENTE, PC_CONCEDENTE).
const CONTAS_PROPONENTE = new Set(["Aguardando Prestação de Contas", "Prestação de Contas Iniciada Por Antecipação", "Prestação de Contas em Complementação"]);
const CONTAS_CONCEDENTE = new Set(["Prestação de Contas enviada para Análise", "Prestação de Contas em Análise", "Prestação de Contas Comprovada em Análise"]);
const CONTAS_NEGATIVO = new Set(["Prestação de Contas Rejeitada", "Inadimplente"]);

export type Vez = "concedente" | "proponente";

export function vezDo(i: InstrumentoLaudo, etapa: Etapa): Vez | null {
  if (etapa === "assinatura") return "concedente";
  if (etapa === "proposta") {
    const h = i.ultimo_historico ?? "";
    if (HIST_PROPONENTE.has(h)) return "proponente";
    if (HIST_CONCEDENTE.has(h)) return "concedente";
    return null;
  }
  if (etapa === "contas") {
    if (CONTAS_PROPONENTE.has(i.situacao ?? "")) return "proponente";
    if (CONTAS_CONCEDENTE.has(i.situacao ?? "")) return "concedente";
  }
  return null;
}

// ================================================================ saída

export interface Comparacao {
  /** "Ministério da Cultura na PB", "Programa no Brasil". */
  rotulo: string;
  recorte: string;
  dimensao: "orgao" | "programa";
  n: number;
  mediana: number;
  p90: number;
  /** Quantos estão nesta etapa agora nesse recorte, e há quanto tempo (mediana). */
  emAberto: number;
  idadeAberto: number | null;
}

export type PosicaoEtapa = "dentro" | "passou_da_mediana" | "passou_do_p90";

export interface TempoEtapa {
  /** Id da etapa em `painel_etapa_tempo`. */
  etapa: string;
  rotulo: string;
  /** "a aprovação do plano de trabalho" — de onde o relógio conta. */
  marco: string;
  desde: string | null;
  dias: number | null;
  /** Da mais específica à mais geral; só as com medições suficientes. */
  comparacoes: Comparacao[];
  base: Comparacao | null;
  posicao: PosicaoEtapa | null;
}

export interface ContaEtapa {
  etapa: Etapa;
  n: number;
  valor: number;
}

export interface Vizinhanca {
  total: number;
  valor: number;
  porEtapa: ContaEtapa[];
  /** Na mesma etapa deste instrumento, fora ele. */
  mesmaEtapa: { n: number; valor: number; numeros: string[] };
  /** Dos da mesma etapa, os do mesmo órgão concedente. */
  mesmaEtapaMesmoOrgao: { n: number; valor: number };
  extintos: { n: number; valor: number };
  assinados: number;
}

export interface Funil {
  recorte: string;
  enviadas: number;
  assinadas: number;
  aguardando: number;
  negadas: number;
  abertas: number;
}

export interface Diagnostico {
  etapa: Etapa;
  rotuloEtapa: string;
  frase: string;
  vez: Vez | null;
  tempo: TempoEtapa | null;
  vigencia: { data: string | null; dias: number | null; original: string | null; prorrogadaDias: number | null; nivel: Nivel | null };
  dinheiro: {
    global: number | null;
    repasse: number | null;
    contrapartida: number | null;
    empenhado: number | null;
    desembolsado: number | null;
    pago: number | null;
    saldoConta: number | null;
    /** Calculado aqui, e não lido de `pct_desembolsado` (até a onda 12 o job gravava 999% sem desembolso). */
    pctDesembolsado: number | null;
    pctFisico: number | null;
    contrapartidaIngressada: number | null;
    pctContrapartida: number | null;
    semDesembolso: number | null;
  };
  liminar: string | null;
  programa: { nome: string | null; codigo: string | null; uf: string | null; naUf: Vizinhanca | null; funis: Funil[] } | null;
  proponente: { nome: string | null; cnpj: string | null; carteira: Vizinhanca } | null;
  emendas: EmendaOrigem[];
  fiscal: FiscalProponente | null;
  /** Por que não há leitura fiscal (Estado, outra UF, falha). */
  fiscalMotivo: string | null;
  portas: PortaAberta[];
  acessoLivre: AcessoLivre | null;
  /** Por que a coleta não tem nenhum evento, quando não tem (os termos do SIMEC/PAR correm no SIMEC). */
  acessoLivreVazio: string | null;
  riscos: Risco[];
  estrategia: Passo[];
  inacao: string[];
  faltas: string[];
}

/**
 * Por que a tela de requisitos veio vazia. Na coleta de 28/09/2026, os termos de compromisso do MEC no
 * "Programa SIMEC/PAR" (107 dos 239 aprovados da PB) não tinham nenhum evento: o acompanhamento deles
 * é feito no SIMEC, do FNDE, e o Transferegov só recebe o termo. Nos outros 22 vazios, quase todos
 * aprovados há poucos meses, a tela dizia "Nenhum registro encontrado": nada enviado ainda.
 */
export function motivoAcessoLivreVazio(i: Pick<Instrumento, "programa">, al: AcessoLivre | null): string | null {
  if (!al || al.linha.length) return null;
  return /simec/i.test(i.programa ?? "")
    ? "Nos termos de compromisso do PAR (programa SIMEC/PAR, do FNDE), a tela de requisitos do Transferegov vem vazia: o acompanhamento desses termos é feito no SIMEC."
    : "A tela de requisitos para celebração do Acesso Livre está vazia para este instrumento: nenhum documento enviado nem análise registrada até a coleta.";
}

// ================================================================ utilidades

const data = (iso: string | null | undefined) => (iso ? formatarData(iso) : "—");
const n = (x: number) => x.toLocaleString("pt-BR");
const dias = (x: number) => `${n(x)} ${Math.abs(x) === 1 ? "dia" : "dias"}`;
const plural = (x: number, um: string, varios: string) => `${n(x)} ${x === 1 ? um : varios}`;
const soma = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);
const viva = (e: Etapa) => VIVAS.includes(e);

/** A decisão B do painel fiscal no meio da frase ("aparece como «bloqueada»"). */
const ROTULO_DECISAO_B: Record<EstadoFiscal, string> = {
  atendido: "sem bloqueio",
  nao_atendido: "bloqueada",
  atencao: "com alertas",
  nao_verificavel: "em aberto",
  desatualizado: "com alertas",
};

/** Vigência que sobra abaixo disto aperta licitação e obra (o mesmo limiar do laudo da suspensiva). */
export const DIAS_VIGENCIA_CURTA = 180;
/** A esta distância ou menos, o fim da vigência já é crítico (o mesmo limiar do prazo da suspensiva). */
export const DIAS_VIGENCIA_CRITICA = 30;
/** Tipos de emenda com autor que se pode procurar; a de relator-geral não tem. */
const EMENDA_COM_AUTOR = new Set(["INDIVIDUAL", "BANCADA", "COMISSAO"]);

export const ROTULO_TIPO_EMENDA: Record<string, string> = {
  INDIVIDUAL: "individual",
  BANCADA: "bancada",
  COMISSAO: "comissão",
  "RELATOR GERAL": "relator-geral",
};
/** Sem pagamento nem desembolso há mais que isso, em execução, é processo parado. */
export const DIAS_SEM_MOVIMENTO = 365;
export const PCT_FINANCEIRO_ALTO = 0.8;
export const PCT_FISICO_BAIXO = 0.3;
/** Janelas abertas mostradas, no máximo. */
export const MAXIMO_PORTAS = 5;

const ORDEM_NIVEL: Nivel[] = ["critico", "alto", "moderado", "informativo"];
const porNivel = (a: Risco, b: Risco) => ORDEM_NIVEL.indexOf(a.nivel) - ORDEM_NIVEL.indexOf(b.nivel);

/** "ESTADO DA PARAIBA" → "Estado da Paraíba": o SICONV grava o proponente em caixa alta e sem acento. */
export function nomeProponente(i: Pick<Instrumento, "proponente">, semNome = "Proponente não informado"): string {
  return i.proponente ? tituloOrgao(i.proponente) : semNome;
}

/** "08761124000100" → "08.761.124/0001-00". Outro formato sai como veio. */
export function cnpjLegivel(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const d = cnpj.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
}

/** O nível mais alto entre os riscos, para a cor da frase de abertura. */
export function nivelMaisAlto(riscos: Risco[]): Nivel {
  return ORDEM_NIVEL.find((nv) => riscos.some((r) => r.nivel === nv)) ?? "informativo";
}

// ================================================================ tempo na etapa

const ROTULO_ETAPA_TEMPO: Record<string, string> = {
  envio_aprovacao: "Envio → aprovação",
  aprovacao_assinatura: "Aprovação → assinatura",
  envio_assinatura: "Envio → assinatura",
  assinatura_desembolso: "Assinatura → 1º desembolso",
  desembolso_conclusao: "1º desembolso → conclusão",
};

/** Qual medição do painel vale para a etapa, e de que marco o relógio conta. */
function relogio(i: InstrumentoLaudo, etapa: Etapa): { etapa: string; desde: string | null; marco: string } | null {
  switch (etapa) {
    case "proposta":
    case "assinatura":
      if (i.dt_aprovacao) return { etapa: "aprovacao_assinatura", desde: i.dt_aprovacao, marco: "a aprovação do plano de trabalho" };
      return etapa === "proposta"
        ? { etapa: "envio_aprovacao", desde: i.dt_envio ?? null, marco: "o envio da proposta" }
        : { etapa: "envio_assinatura", desde: i.dt_envio ?? null, marco: "o envio da proposta" };
    case "suspensiva":
      return { etapa: "assinatura_desembolso", desde: i.dt_assinatura, marco: "a assinatura" };
    case "execucao":
      return i.dt_primeiro_desembolso
        ? { etapa: "desembolso_conclusao", desde: i.dt_primeiro_desembolso, marco: "o primeiro desembolso" }
        : { etapa: "assinatura_desembolso", desde: i.dt_assinatura, marco: "a assinatura" };
    case "contas":
      return i.dt_primeiro_desembolso ? { etapa: "desembolso_conclusao", desde: i.dt_primeiro_desembolso, marco: "o primeiro desembolso" } : null;
    default:
      return null;
  }
}

export function tempoNaEtapa(i: InstrumentoLaudo, etapa: Etapa, linhas: LinhaEtapa[], hoje: string): TempoEtapa | null {
  const r = relogio(i, etapa);
  if (!r) return null;
  const uf = i.uf ?? "";
  const orgao = i.orgao_sup ? tituloOrgao(i.orgao_sup) : "Órgão";
  const noRecorte = (recorte: string) => (recorte === "BR" ? "no Brasil" : `na ${recorte}`);
  const procura: { recorte: string; dimensao: "orgao" | "programa"; chave: string | null; rotulo: string }[] = [
    { recorte: uf, dimensao: "programa", chave: i.cod_programa, rotulo: `Programa ${noRecorte(uf)}` },
    { recorte: uf, dimensao: "orgao", chave: i.orgao_sup, rotulo: `${orgao} ${noRecorte(uf)}` },
    { recorte: "BR", dimensao: "programa", chave: i.cod_programa, rotulo: "Programa no Brasil" },
    { recorte: "BR", dimensao: "orgao", chave: i.orgao_sup, rotulo: `${orgao} no Brasil` },
  ];
  const comparacoes: Comparacao[] = [];
  for (const p of procura) {
    if (!p.chave || !p.recorte) continue;
    const l = linhas.find((x) => x.etapa === r.etapa && x.recorte === p.recorte && x.dimensao === p.dimensao && x.chave === p.chave);
    if (!l || l.n < MINIMO_MEDICOES || l.mediana === null || l.p90 === null) continue;
    comparacoes.push({
      rotulo: p.rotulo,
      recorte: p.recorte,
      dimensao: p.dimensao,
      n: l.n,
      mediana: l.mediana,
      p90: l.p90,
      emAberto: l.em_aberto,
      idadeAberto: l.idade_mediana_aberto,
    });
  }
  const d = r.desde ? diasEntre(r.desde, hoje) : null;
  const base = comparacoes[0] ?? null;
  const posicao: PosicaoEtapa | null =
    base === null || d === null ? null : d > base.p90 ? "passou_do_p90" : d > base.mediana ? "passou_da_mediana" : "dentro";
  return {
    etapa: r.etapa,
    rotulo: ROTULO_ETAPA_TEMPO[r.etapa] ?? r.etapa,
    marco: r.marco,
    desde: r.desde,
    dias: d !== null && d >= 0 ? d : null,
    comparacoes,
    base,
    posicao: d !== null && d >= 0 ? posicao : null,
  };
}

// ================================================================ vizinhos

export function vizinhanca(vs: Vizinho[], proprio: Pick<Vizinho, "nr_convenio" | "orgao_sup">, etapa: Etapa): Vizinhanca {
  const conta = new Map<Etapa, ContaEtapa>();
  const mesma: Vizinho[] = [];
  for (const v of vs) {
    const e = etapaDo(v);
    const c = conta.get(e) ?? { etapa: e, n: 0, valor: 0 };
    c.n += 1;
    c.valor += v.vl_repasse ?? 0;
    conta.set(e, c);
    if (e === etapa && v.nr_convenio !== proprio.nr_convenio) mesma.push(v);
  }
  const mesmoOrgao = mesma.filter((v) => v.orgao_sup && v.orgao_sup === proprio.orgao_sup);
  const extintos = conta.get("extinto");
  return {
    total: vs.length,
    valor: soma(vs.map((v) => v.vl_repasse)),
    porEtapa: ETAPAS.map((e) => conta.get(e)).filter((c): c is ContaEtapa => !!c),
    mesmaEtapa: {
      n: mesma.length,
      valor: soma(mesma.map((v) => v.vl_repasse)),
      numeros: [...mesma].sort((a, b) => (b.vl_repasse ?? 0) - (a.vl_repasse ?? 0)).map((v) => v.nr_convenio),
    },
    mesmaEtapaMesmoOrgao: { n: mesmoOrgao.length, valor: soma(mesmoOrgao.map((v) => v.vl_repasse)) },
    extintos: { n: extintos?.n ?? 0, valor: extintos?.valor ?? 0 },
    assinados: vs.filter((v) => !!v.dt_assinatura).length,
  };
}

/** O funil das propostas do programa enviadas desde 2019, somando os anos. */
export function funis(desfechos: LinhaDesfecho[], codPrograma: string | null, uf: string | null): Funil[] {
  if (!codPrograma) return [];
  const recortes = ["BR", ...(uf && uf !== "BR" ? [uf] : [])];
  return recortes
    .map((recorte) => {
      const ls = desfechos.filter((d) => d.cod_programa === codPrograma && d.uf === recorte);
      return {
        recorte,
        enviadas: soma(ls.map((d) => d.enviadas)),
        assinadas: soma(ls.map((d) => d.assinadas)),
        aguardando: soma(ls.map((d) => d.aguardando_assinatura)),
        negadas: soma(ls.map((d) => d.reprovadas + d.impedimento + d.eliminadas)),
        abertas: soma(ls.map((d) => d.abertas_concedente + d.abertas_proponente)),
      };
    })
    .filter((f) => f.enviadas > 0);
}

// ================================================================ a leitura

export function lerDiagnostico(e: EntradaDiagnostico, hoje: string, opcoes: OpcoesDiagnostico = {}): Diagnostico {
  const i = e.instrumento;
  const etapa = etapaDo(i);
  // Antes da assinatura, a coleta do Acesso Livre diz de quem é a vez melhor que a situação: um
  // aprovado "esperando assinatura" pode estar com um pedido de complementação aberto para o proponente.
  const acessoLivre = e.acessoLivre && (etapa === "assinatura" || etapa === "proposta") ? e.acessoLivre : null;
  const vez = acessoLivre?.vez.lado ?? vezDo(i, etapa);
  const tempo = tempoNaEtapa(i, etapa, e.etapas, hoje);

  const vigDias = i.dt_fim_vigencia ? diasEntre(hoje, i.dt_fim_vigencia) : null;
  const original = i.dt_fim_vigencia_original && i.dt_fim_vigencia_original !== i.dt_fim_vigencia ? i.dt_fim_vigencia_original : null;
  const vigencia: Diagnostico["vigencia"] = {
    data: i.dt_fim_vigencia,
    dias: vigDias,
    original,
    prorrogadaDias: original && i.dt_fim_vigencia ? diasEntre(original, i.dt_fim_vigencia) : null,
    nivel: !viva(etapa) || vigDias === null ? null : vigDias <= DIAS_VIGENCIA_CRITICA ? "critico" : vigDias <= DIAS_VIGENCIA_CURTA ? "alto" : null,
  };

  const repasse = i.vl_repasse;
  const desembolsado = i.vl_desembolsado;
  const ingresso = i.vl_ingresso_contrapartida ?? null;
  const dinheiro: Diagnostico["dinheiro"] = {
    global: i.vl_global,
    repasse,
    contrapartida: i.vl_contrapartida,
    empenhado: i.vl_empenhado,
    desembolsado,
    pago: i.vl_pago,
    saldoConta: i.vl_saldo_conta,
    pctDesembolsado: repasse && repasse > 0 ? (desembolsado ?? 0) / repasse : null,
    pctFisico: i.pct_fisico,
    contrapartidaIngressada: ingresso,
    pctContrapartida: i.vl_contrapartida && i.vl_contrapartida > 0 && ingresso !== null ? ingresso / i.vl_contrapartida : null,
    semDesembolso: repasse === null ? null : Math.max(0, repasse - (desembolsado ?? 0)),
  };

  const liminar = i.situacao_contratacao && /liminar/i.test(i.situacao_contratacao) ? i.situacao_contratacao : null;

  const programa =
    i.cod_programa || i.programa
      ? {
          nome: i.programa,
          codigo: i.cod_programa,
          uf: i.uf,
          naUf: e.pares ? vizinhanca(e.pares, i, etapa) : null,
          funis: funis(e.desfechos, i.cod_programa, i.uf),
        }
      : null;
  const proponente = e.carteira ? { nome: i.proponente, cnpj: i.cnpj, carteira: vizinhanca(e.carteira, i, etapa) } : null;
  const emendas = e.emendas ?? [];

  const municipioPb = i.tipo_agente === "municipio" && i.uf === "PB" && !!i.cod_ibge;
  const fiscalMotivo = e.fiscal
    ? null
    : municipioPb
      ? "A situação fiscal do município não pôde ser lida agora."
      : i.tipo_agente === "estado"
        ? "O painel fiscal cobre os 223 municípios da PB; a situação do Estado ainda não entra nele."
        : "O painel fiscal cobre só os municípios da PB.";

  // O mesmo programa primeiro; depois o mesmo tema; depois o prazo mais próximo. O catálogo pode trazer
  // a mesma janela duas vezes (mesmo título, prazo e código, por canais diferentes): fica uma.
  const vistas = new Set<string>();
  const portas = (e.portas ?? [])
    .filter(portaRelevante)
    .filter((p) => {
      const chave = `${p.titulo}|${p.prazo}|${p.codigos.join(",")}`;
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    })
    .sort(
      (a, b) =>
        Number(b.mesmoPrograma) - Number(a.mesmoPrograma) ||
        Number(b.mesmoTema) - Number(a.mesmoTema) ||
        (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity),
    )
    .slice(0, MAXIMO_PORTAS);

  const b: Base = {
    i,
    etapa,
    vez,
    tempo,
    vigencia,
    dinheiro,
    liminar,
    programa,
    proponente,
    emendas,
    fiscal: e.fiscal,
    portas,
    acessoLivre,
    hoje,
    comDossie: !!opcoes.comDossie,
  };
  return {
    etapa,
    rotuloEtapa: ROTULO_ETAPA_LAUDO[etapa],
    frase: lerFrase(b),
    vez,
    tempo,
    vigencia,
    dinheiro,
    liminar,
    programa,
    proponente,
    emendas,
    fiscal: e.fiscal,
    fiscalMotivo,
    portas,
    acessoLivre,
    acessoLivreVazio: motivoAcessoLivreVazio(i, acessoLivre),
    riscos: lerRiscos(b).sort(porNivel),
    estrategia: lerEstrategia(b),
    inacao: b.comDossie ? [] : lerInacao(b),
    faltas: e.faltas,
  };
}

interface Base {
  i: InstrumentoLaudo;
  etapa: Etapa;
  vez: Vez | null;
  tempo: TempoEtapa | null;
  vigencia: Diagnostico["vigencia"];
  dinheiro: Diagnostico["dinheiro"];
  liminar: string | null;
  programa: Diagnostico["programa"];
  proponente: Diagnostico["proponente"];
  emendas: EmendaOrigem[];
  fiscal: FiscalProponente | null;
  portas: PortaAberta[];
  acessoLivre: AcessoLivre | null;
  hoje: string;
  comDossie: boolean;
}

// ------------------------------------------------------------------ onde está

function ultimoRegistro(i: InstrumentoLaudo): string {
  return i.ultimo_historico && i.dt_ultimo_historico
    ? ` O último registro do histórico é «${rotuloSituacaoHistorico(i.ultimo_historico)}», em ${data(i.dt_ultimo_historico)}.`
    : "";
}

function lerFrase(b: Base): string {
  const { i, tempo } = b;
  const ha = tempo?.dias !== null && tempo?.dias !== undefined ? `: ${dias(tempo.dias)} até hoje` : "";
  switch (b.etapa) {
    case "proposta":
      return (
        (i.dt_envio ? `Proposta enviada em ${data(i.dt_envio)} e ainda sem assinatura${ha}.` : "Proposta ainda sem assinatura, e o histórico não registra o envio.") +
        ultimoRegistro(i)
      );
    case "assinatura":
      return (
        (i.dt_aprovacao
          ? `Plano de trabalho aprovado em ${data(i.dt_aprovacao)} e não assinado${ha}.`
          : `Aprovado e não assinado; o histórico não registra a data da aprovação do plano.`) +
        (i.situacao && i.situacao !== "Proposta/Plano de Trabalho Aprovado" ? ` A situação hoje é «${i.situacao}».` : "") +
        ultimoRegistro(i)
      );
    case "suspensiva":
      return (
        `Assinado em ${data(i.dt_assinatura)}, em cláusula suspensiva: o repasse só é liberado depois da retirada.` +
        (i.dt_suspensiva ? ` O prazo registrado para a retirada é ${data(i.dt_suspensiva)}.` : " O Transferegov não informa o prazo da suspensiva.")
      );
    case "execucao":
      return (
        `Em execução desde a assinatura, em ${data(i.dt_assinatura)}. ` +
        (i.dt_primeiro_desembolso
          ? `${percentual(b.dinheiro.pctDesembolsado)} do repasse desembolsado; último pagamento em ${data(i.dt_ultimo_pagamento)}.`
          : "Nenhum desembolso registrado até agora.")
      );
    case "contas":
      return `Em prestação de contas: «${i.situacao}».` + (i.dt_limite_contas ? ` O prazo para prestar contas é ${data(i.dt_limite_contas)}.` : "");
    case "concluido":
      return `Concluído: «${i.situacao}»` + (i.dt_conclusao ? `, registrado em ${data(i.dt_conclusao)}.` : ".");
    case "extinto":
      return (
        `«${i.situacao}».` +
        (i.dt_suspensiva && !i.dt_retirada_suspensiva ? " Terminou com a cláusula suspensiva pendente." : "") +
        (b.dinheiro.desembolsado ? ` Chegaram a ser desembolsados ${moedaCurta(b.dinheiro.desembolsado)}.` : " Nenhum repasse foi desembolsado.")
      );
  }
}

// ------------------------------------------------------------------ riscos

/** "do órgão na PB", "do programa no Brasil": a base de comparação em minúsculas, para o meio da frase. */
function daBase(c: Comparacao): string {
  return c.dimensao === "programa" ? `do programa ${c.recorte === "BR" ? "no Brasil" : `na ${c.recorte}`}` : `do órgão ${c.recorte === "BR" ? "no Brasil" : `na ${c.recorte}`}`;
}

function frasePadrao(t: TempoEtapa): string {
  const c = t.base as Comparacao;
  return (
    `${dias(t.dias ?? 0)} desde ${t.marco} (${data(t.desde)}). ${c.rotulo}, na etapa «${t.rotulo}»: metade leva até ${dias(Math.round(c.mediana))} ` +
    `e 9 em cada 10, até ${dias(Math.round(c.p90))} (${n(c.n)} medições nos últimos três anos).`
  );
}

function lerRiscos(b: Base): Risco[] {
  const r: Risco[] = [];
  const { i, etapa, vigencia: v, tempo: t } = b;

  // Com o dossiê da suspensiva, vigência e tempo já estão no laudo de lá.
  if (!b.comDossie) {
    if (v.nivel === "critico" && v.dias !== null && v.dias < 0) {
      const semAssinatura = etapa === "proposta" || etapa === "assinatura";
      r.push({
        nivel: "critico",
        titulo: semAssinatura ? "Vigência vencida sem assinatura" : "Vigência encerrada",
        fato: `A vigência registrada terminou em ${data(v.data)}, há ${dias(-v.dias)}${semAssinatura ? ", e o instrumento não foi assinado" : ""}.`,
      });
    } else if (v.nivel && v.dias !== null) {
      const pct = b.dinheiro.pctDesembolsado;
      r.push({
        nivel: v.nivel,
        titulo: v.nivel === "critico" ? "Vigência acabando" : "Pouca vigência pela frente",
        fato:
          (v.dias === 0 ? `A vigência termina hoje, ${data(v.data)}.` : `A vigência termina em ${data(v.data)}, daqui a ${dias(v.dias)}.`) +
          (etapa === "execucao" && pct !== null && pct < 0.5 ? ` Só ${percentual(pct)} do repasse foi desembolsado.` : ""),
      });
    }
    if (t?.base && (t.posicao === "passou_do_p90" || t.posicao === "passou_da_mediana")) {
      const p90 = t.posicao === "passou_do_p90";
      r.push({
        nivel: p90 ? "alto" : "moderado",
        titulo: p90 ? `Mais demorado que 9 em cada 10 ${daBase(t.base)}` : `Mais demorado que a metade ${daBase(t.base)}`,
        fato: frasePadrao(t),
      });
    }
  }

  // Os requisitos para celebração, lidos da coleta do Acesso Livre (recorte da assinatura).
  const al = b.acessoLivre;
  if (al) {
    if (al.vez.dias !== null && al.vez.dias > DIAS_PARADO_MODERADO) {
      r.push({
        nivel: al.vez.dias > DIAS_PARADO_ALTO ? "alto" : "moderado",
        titulo: "Requisitos para celebração parados",
        fato:
          `Nenhum evento na tela de requisitos há ${dias(al.vez.dias)}, desde ${data(al.vez.desde)}, contados até a coleta de ${data(al.referencia)}` +
          `${al.vez.lado ? `, com a vez do ${al.vez.lado}` : ""}.`,
      });
    }
    if (al.rodadas >= RODADAS_REUNIAO) {
      r.push({
        nivel: "moderado",
        titulo: "Muitas rodadas de exigência",
        fato: `O concedente pediu complementação ${plural(al.rodadas, "vez", "vezes")}; o proponente enviou documentação ${plural(al.envios, "vez", "vezes")}.`,
      });
    }
    if (al.documentos.vencidos.length) {
      r.push({
        nivel: "moderado",
        titulo: "Documentos com validade vencida",
        fato: `${n(al.documentos.vencidos.length)} de ${n(al.documentos.comValidade)} documentos com validade já venceram. Numa nova análise, não valem mais.`,
      });
    }
  }

  if (b.liminar) {
    r.push({
      nivel: "alto",
      titulo: "Contratação sob liminar judicial",
      fato: `O Transferegov registra a situação da contratação como «${b.liminar}». O andamento depende da decisão judicial.`,
    });
  }

  if (etapa === "execucao" && i.dt_primeiro_desembolso) {
    const ultimo = [i.dt_ultimo_pagamento, i.dt_ultimo_desembolso].filter((x): x is string => !!x).sort().at(-1);
    const parado = ultimo ? diasEntre(ultimo, b.hoje) : null;
    if (parado !== null && parado > DIAS_SEM_MOVIMENTO) {
      r.push({
        nivel: "alto",
        titulo: "Sem movimento financeiro há mais de um ano",
        fato: `O último pagamento ou desembolso registrado é de ${data(ultimo)}, há ${dias(parado)}.` + (i.vl_saldo_conta ? ` Há ${moedaCurta(i.vl_saldo_conta)} em conta.` : ""),
      });
    }
    const pct = b.dinheiro.pctDesembolsado;
    if (pct !== null && pct >= PCT_FINANCEIRO_ALTO && i.pct_fisico !== null && i.pct_fisico < PCT_FISICO_BAIXO) {
      r.push({
        nivel: "moderado",
        titulo: "Dinheiro na frente da obra",
        fato: `${percentual(pct)} do repasse desembolsado e ${percentual(i.pct_fisico)} de execução física registrada no resumo físico-financeiro.`,
      });
    }
  }

  if (etapa === "contas") {
    if (CONTAS_NEGATIVO.has(i.situacao ?? "")) {
      r.push({ nivel: "critico", titulo: i.situacao as string, fato: `A prestação de contas está registrada como «${i.situacao}».` });
    }
    if (i.situacao === "Aguardando Prestação de Contas" && i.dt_limite_contas && i.dt_limite_contas < b.hoje) {
      r.push({
        nivel: "alto",
        titulo: "Prazo de prestar contas vencido",
        fato: `O prazo terminou em ${data(i.dt_limite_contas)}, há ${dias(diasEntre(i.dt_limite_contas, b.hoje))}, e a prestação de contas não foi enviada.`,
      });
    }
  }
  if (/tce/i.test(i.subsituacao ?? "")) {
    r.push({ nivel: "critico", titulo: "Tomada de contas especial", fato: `O Transferegov registra «${i.subsituacao}».` });
  }

  const conclusao = b.fiscal?.conclusao;
  if (conclusao && (conclusao.estado === "nao_atendido" || conclusao.estado === "atencao") && viva(etapa)) {
    const pend = b.fiscal?.caucPendencias.length ? ` O CAUC registra pendência nos itens ${lista(b.fiscal.caucPendencias)}.` : "";
    r.push({
      nivel: conclusao.estado === "nao_atendido" ? "alto" : "moderado",
      titulo: conclusao.estado === "nao_atendido" ? "Município bloqueado para receber transferência voluntária" : "Município com alertas para receber transferência voluntária",
      fato: `No painel fiscal (decisão B), ${b.fiscal?.municipio} aparece como «${ROTULO_DECISAO_B[conclusao.estado]}»${conclusao.bloqueantes.length ? ` por ${lista(conclusao.bloqueantes)}` : ""}.${pend}`,
    });
  }

  // O programa: este instrumento parado onde os outros andaram.
  const pr = b.programa;
  const naUf = pr?.naUf;
  if (naUf && (etapa === "assinatura" || etapa === "proposta") && naUf.mesmaEtapa.n === 0 && naUf.assinados >= 2) {
    const br = pr?.funis.find((f) => f.recorte === "BR");
    r.push({
      nivel: "moderado",
      titulo: "Fora do padrão do programa",
      fato:
        `Dos ${n(naUf.total)} instrumentos do programa na ${pr?.uf}, ${n(naUf.assinados)} já foram assinados; só este segue «${ROTULO_ETAPA_LAUDO[etapa].toLowerCase()}».` +
        (br ? ` No Brasil, das ${n(br.enviadas)} propostas do programa enviadas desde 2019, ${n(br.assinadas)} foram assinadas.` : ""),
    });
  }

  // O proponente: o mesmo nó em outros instrumentos.
  const c = b.proponente?.carteira;
  if (c && c.mesmaEtapa.n >= 2 && (etapa === "assinatura" || etapa === "proposta" || etapa === "suspensiva")) {
    r.push({
      nivel: "moderado",
      titulo: "O proponente tem outros instrumentos parados na mesma etapa",
      fato:
        `${nomeProponente(b.i, "O proponente")} tem mais ${plural(c.mesmaEtapa.n, "instrumento", "instrumentos")} em «${ROTULO_ETAPA_LAUDO[etapa].toLowerCase()}», ` +
        `somando ${moedaCurta(c.mesmaEtapa.valor)}${c.mesmaEtapaMesmoOrgao.n ? ` (${n(c.mesmaEtapaMesmoOrgao.n)} com o mesmo órgão)` : ""}.`,
    });
  }

  if (etapa === "extinto") {
    r.push({
      nivel: "informativo",
      titulo: "Instrumento extinto",
      fato: `${moedaCurta(b.dinheiro.semDesembolso)} de repasse não chegaram${i.dt_suspensiva && !i.dt_retirada_suspensiva ? ", e a cláusula suspensiva nunca foi retirada" : ""}.`,
    });
  }
  return r;
}

// ------------------------------------------------------------------ estratégia

function lerEstrategia(b: Base): Passo[] {
  const p: Passo[] = [];
  const { i, etapa, tempo: t, vigencia: v } = b;
  const base = t?.base ? ` ${t.base.rotulo}: metade em até ${dias(Math.round(t.base.mediana))}, 9 em cada 10 em até ${dias(Math.round(t.base.p90))}.` : "";

  if (!b.comDossie) {
    switch (etapa) {
      case "assinatura": {
        const vencida = v.dias !== null && v.dias < 0;
        if (vencida) {
          p.push({
            titulo: "Confirmar com o concedente se o instrumento ainda pode ser assinado",
            porque:
              `A vigência registrada terminou em ${data(v.data)} sem assinatura. Antes de cobrar a assinatura, é preciso saber se o concedente ` +
              "vai registrar nova vigência ou se o caminho é uma nova proposta.",
          });
        }
        const doAcesso = passoDoAcessoLivre(b, base);
        if (doAcesso) p.push(doAcesso);
        else if (!vencida) {
          p.push({
            titulo: "Cobrar a assinatura do concedente",
            porque: `${i.dt_aprovacao ? `Plano aprovado em ${data(i.dt_aprovacao)}` : "Aprovado"}${t?.dias !== null && t?.dias !== undefined ? `, há ${dias(t.dias)}` : ""}.${base}`,
          });
        }
        break;
      }
      case "proposta": {
        const doAcesso = passoDoAcessoLivre(b, base);
        if (doAcesso) {
          p.push(doAcesso);
          break;
        }
        if (b.vez === "proponente") {
          p.push({ titulo: "Responder ao pedido do concedente", porque: `O último registro do histórico, de ${data(i.dt_ultimo_historico)}, deixa a vez com o proponente.` });
        } else {
          p.push({
            titulo: "Cobrar a análise da proposta",
            porque: `${i.dt_envio ? `Enviada em ${data(i.dt_envio)}` : "Sem data de envio no histórico"}${t?.dias !== null && t?.dias !== undefined ? `, há ${dias(t.dias)}` : ""}.${base}`,
          });
        }
        break;
      }
      case "suspensiva":
        p.push({
          titulo: "Levantar o que falta para a retirada da suspensiva",
          porque: i.motivo_suspensao ? `O termo exige: «${i.motivo_suspensao}».` : "O Transferegov não informa o motivo da suspensiva deste instrumento: pedir ao concedente a lista de condições.",
        });
        if (i.dt_suspensiva && i.dt_suspensiva <= somaDias(b.hoje, 90)) {
          p.push({
            titulo: "Pedir a prorrogação do prazo da suspensiva",
            porque: i.dt_suspensiva < b.hoje ? `O prazo venceu em ${data(i.dt_suspensiva)}.` : `O prazo vence em ${data(i.dt_suspensiva)}; o pedido precisa chegar antes.`,
          });
        }
        break;
      case "execucao":
        if (!i.dt_primeiro_desembolso) {
          p.push({
            titulo: "Destravar o primeiro desembolso",
            porque: `Assinado em ${data(i.dt_assinatura)} e sem nenhum desembolso.${base} Conferir licitação, aceite do processo e liberação pelo concedente.`,
          });
        }
        if (v.dias !== null && v.dias >= 0 && v.dias <= DIAS_VIGENCIA_CURTA) {
          p.push({ titulo: "Pedir a prorrogação da vigência", porque: `Sobram ${dias(v.dias)} até ${data(v.data)}; o pedido precisa de justificativa e antecedência.` });
        }
        break;
      case "contas":
        if (b.vez === "proponente") {
          p.push({
            titulo: i.situacao === "Prestação de Contas em Complementação" ? "Responder à complementação da prestação de contas" : "Enviar a prestação de contas",
            porque: `Situação: «${i.situacao}»${i.dt_limite_contas ? `; prazo ${i.dt_limite_contas < b.hoje ? "vencido em" : "até"} ${data(i.dt_limite_contas)}` : ""}.`,
          });
        } else if (b.vez === "concedente") {
          p.push({ titulo: "Acompanhar a análise da prestação de contas", porque: `Situação: «${i.situacao}». A vez é do concedente.` });
        }
        break;
      case "concluido":
      case "extinto":
        break;
    }
  }

  if (b.liminar) {
    p.push({ titulo: "Levantar o processo judicial", porque: `A contratação está registrada como «${b.liminar}»: o número do processo e a decisão vigente dizem o que pode andar.` });
  }
  const conclusao = b.fiscal?.conclusao;
  if (conclusao && conclusao.estado === "nao_atendido" && viva(etapa)) {
    p.push({
      titulo: "Resolver as pendências fiscais do município",
      porque:
        (b.fiscal?.caucPendencias.length ? `O CAUC registra pendência nos itens ${lista(b.fiscal.caucPendencias)}. ` : "") +
        "A regularidade é conferida na celebração e em cada liberação.",
    });
  }
  const c = b.proponente?.carteira;
  if (c && c.mesmaEtapa.n >= 1 && (etapa === "assinatura" || etapa === "proposta" || etapa === "suspensiva")) {
    p.push({
      titulo: "Tratar a carteira do proponente de uma vez",
      porque:
        `${nomeProponente(i, "O proponente")} tem mais ${plural(c.mesmaEtapa.n, "instrumento", "instrumentos")} na mesma etapa (${moedaCurta(c.mesmaEtapa.valor)})` +
        `${c.mesmaEtapaMesmoOrgao.n ? `, ${n(c.mesmaEtapaMesmoOrgao.n)} com o mesmo órgão` : ""}. Uma agenda única rende mais que pedidos avulsos.`,
    });
  }
  // Só enquanto falta dinheiro chegar, e só emenda com autor a procurar (a de relator-geral não tem).
  const autor = b.emendas.find((x) => x.parlamentar && EMENDA_COM_AUTOR.has(x.tipo_parlamentar ?? ""));
  if (autor && viva(etapa) && (b.dinheiro.pctDesembolsado ?? 0) < 1) {
    const tipo = autor.tipo_parlamentar === "COMISSAO" ? "de comissão" : autor.tipo_parlamentar === "BANCADA" ? "de bancada" : autor.impositiva ? "individual impositiva" : "individual";
    p.push({
      titulo: "Envolver o autor da emenda",
      porque: `O repasse veio da emenda ${tipo} nº ${autor.nr_emenda}, de ${autor.parlamentar}. Quem indicou o recurso tem interesse direto em que ele chegue.`,
    });
  }
  // Quando o instrumento acabou ou não tem mais vigência, a próxima porta é uma proposta nova.
  const porta = b.portas.find((x) => x.mesmoPrograma) ?? b.portas.find((x) => x.mesmoOrgao);
  if (porta && (etapa === "extinto" || etapa === "concluido" || (v.dias !== null && v.dias < 0 && (etapa === "assinatura" || etapa === "proposta")))) {
    p.push({
      titulo: porta.mesmoPrograma ? "Plano B: o programa está com janela aberta" : "Plano B: o mesmo órgão tem janela aberta",
      porque: `«${porta.titulo}»${porta.mesmoPrograma ? "" : ` (${tituloOrgao(porta.financiador)})`} recebe propostas${porta.prazo ? ` até ${data(porta.prazo)}` : ""}.`,
    });
  }
  return p;
}

/**
 * O próximo passo pelo último evento dos requisitos para celebração: com "atendido", pedir a assinatura
 * citando a análise; com envio do proponente, cobrar a análise; com pedido do concedente, responder a ele.
 */
function passoDoAcessoLivre(b: Base, base: string): Passo | null {
  const al = b.acessoLivre;
  const u = al?.ultimo;
  if (!al || !u) return null;
  const por = u.responsavel ? `, por ${u.responsavel}` : "";
  const espera = al.vez.dias !== null ? ` ${dias(al.vez.dias)} sem evento até a coleta de ${data(al.referencia)}.` : "";
  switch (u.resultado) {
    case "atendido":
      return {
        titulo: "Pedir a assinatura, citando a análise dos requisitos",
        porque:
          `Os requisitos para celebração foram registrados como atendidos em ${data(u.dia)}${por}` +
          `${u.texto ? `, com a observação «${u.texto}»` : ""}.${espera}${base}`,
      };
    case "enviado":
      return { titulo: "Cobrar a análise do último envio", porque: `O proponente enviou documentação em ${data(u.dia)}.${espera}` };
    case "complementação solicitada":
    case "não atendido":
      return {
        titulo: "Responder ao último pedido do concedente",
        porque: `Pedido de ${data(u.dia)}${por}${u.texto ? `: «${u.texto}»` : ""}.${espera}`,
      };
    default:
      return null;
  }
}

function somaDias(iso: string, d: number): string {
  const t = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ se nada for feito

function lerInacao(b: Base): string[] {
  const x: string[] = [];
  const { i, etapa, vigencia: v, dinheiro: d } = b;
  if (etapa === "assinatura" || etapa === "proposta") {
    if (d.repasse) x.push(`${moedaCurta(d.repasse)} de repasse ${etapa === "assinatura" ? "aprovados" : "pedidos"} não viram obra nem serviço enquanto o instrumento não é assinado.`);
    if (v.dias !== null && v.dias < 0) x.push(`A vigência já venceu: sem nova vigência registrada, o instrumento não tem prazo para ser executado.`);
  }
  if (etapa === "suspensiva" && i.dt_suspensiva) {
    x.push(`Se ${data(i.dt_suspensiva)} passar sem a retirada, o instrumento pode ser extinto e o repasse de ${moedaCurta(d.repasse)}, perdido.`);
  }
  if (etapa === "execucao") {
    if (d.semDesembolso) x.push(`${moedaCurta(d.semDesembolso)} de repasse seguem sem desembolso.`);
    if (v.dias !== null && v.dias > 0) x.push(`Cada mês parado é um mês a menos de vigência: ela acaba em ${data(v.data)}.`);
  }
  if (etapa === "contas") {
    x.push("Prestação de contas atrasada ou rejeitada pode virar inadimplência registrada no CAUC, que trava novas transferências ao proponente.");
  }
  const c = b.proponente?.carteira;
  if (c && c.extintos.n > 0 && viva(etapa)) {
    x.push(
      `${nomeProponente(i, "Este proponente")} já teve ${plural(c.extintos.n, "instrumento anulado, rescindido ou cancelado", "instrumentos anulados, rescindidos ou cancelados")}, ` +
        `somando ${moedaCurta(c.extintos.valor)} de repasse.`,
    );
  }
  return x;
}
