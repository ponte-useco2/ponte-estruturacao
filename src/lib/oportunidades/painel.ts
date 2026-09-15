/**
 * Painel de execução da PONTE — a parte pura da página `/mapa/painel`.
 *
 * Os números vêm prontos do job `painel_execucao/` e das funções SQL da `oport_8`.
 * Aqui só se decide como dizer: a visão escolhida, os rótulos, os parâmetros da
 * URL e a frase de prazo. As regras de cada visão estão no job, com teste.
 */
import { UFS } from "./organizacao.ts";

export type Visao =
  | "mudancas"
  | "suspensiva"
  | "nunca"
  | "vigencia"
  | "contas"
  | "saldo"
  | "fisico"
  | "municipios"
  | "tempos"
  | "aprovacao";
/** Filtro de última movimentação: qualquer registro do convênio, não só dinheiro. */
export type Movimento = "parado_1ano" | "recente_30d";
export type LadoContas = "atrasada" | "negativo" | "tce" | "concedente";
export type DimensaoTempo = "orgao" | "programa";

export interface DefinicaoVisao {
  id: Visao;
  rotulo: string;
  titulo: string;
  /** O que a visão responde, em uma frase, para quem não conhece o SICONV por dentro. */
  pergunta: string;
}

export const VISOES: DefinicaoVisao[] = [
  {
    id: "mudancas",
    rotulo: "O que mudou",
    titulo: "O que mudou desde o dado anterior",
    pergunta:
      "Suspensivas retiradas, primeiros desembolsos, contas enviadas ou rejeitadas e propostas com desfecho, comparando cada retrato do Transferegov com o anterior.",
  },
  {
    id: "suspensiva",
    rotulo: "Suspensiva",
    titulo: "Cláusula suspensiva pendente",
    pergunta: "Convênios assinados que ainda não podem executar até entregar projeto, licença ou documento da área.",
  },
  {
    id: "nunca",
    rotulo: "Nunca desembolsado",
    titulo: "Assinado e nunca desembolsado",
    pergunta: "Convênios em execução que não receberam nenhum centavo, e em que etapa cada um parou.",
  },
  {
    id: "vigencia",
    rotulo: "Vigência",
    titulo: "Vigência acabando com execução baixa",
    pergunta: "Em execução, com a vigência terminando em até 180 dias e menos da metade do repasse desembolsada.",
  },
  {
    id: "contas",
    rotulo: "Contas",
    titulo: "Prestação de contas atrasada, rejeitada ou em TCE",
    pergunta: "O caminho que leva à inadimplência, e de quem é a vez em cada etapa.",
  },
  {
    id: "saldo",
    rotulo: "Saldo parado",
    titulo: "Saldo parado na conta do convênio",
    pergunta: "Dinheiro que chegou à conta e não saiu há mais de um ano, com o rendimento que ele gerou.",
  },
  {
    id: "fisico",
    rotulo: "Físico × financeiro",
    titulo: "O dinheiro saiu e a obra não andou",
    pergunta: "Em execução, com 80% ou mais do repasse desembolsado e menos de 30% de execução física aferida.",
  },
  {
    id: "municipios",
    rotulo: "Municípios",
    titulo: "Municípios que mais precisam de ajuda",
    pergunta: "Prefeituras com convênio travado em mais de uma frente. Lista de prospecção, não ranking.",
  },
  {
    id: "tempos",
    rotulo: "Tempos",
    titulo: "Tempo de cada etapa",
    pergunta: "Quanto leva do envio da proposta ao dinheiro na conta e à conclusão, e de quem é a vez, por ministério e programa.",
  },
  {
    id: "aprovacao",
    rotulo: "Aprovação",
    titulo: "Aprovação e rejeição por programa",
    pergunta: "O que aconteceu com as propostas enviadas no ano, programa a programa, com as reprovações em lote e o impedimento técnico.",
  },
];

/** Primeiro ano com dado de proposta no painel (o job grava a partir dele). */
export const ANO_MINIMO_ENVIO = 2019;
/** Primeiro ano do filtro de assinatura: o SICONV começa em 2008. */
export const ANO_MINIMO_ASSINATURA = 2008;

/** As visões que leem convênio a convênio — as únicas com filtro de município e de período. */
export const VISOES_CONVENIO: Visao[] = ["suspensiva", "nunca", "vigencia", "contas", "saldo", "fisico"];

export const MOVIMENTOS: Movimento[] = ["parado_1ano", "recente_30d"];
export const ROTULO_MOVIMENTO: Record<Movimento, string> = {
  parado_1ano: "sem nenhuma movimentação há mais de 1 ano",
  recente_30d: "com movimentação nos últimos 30 dias",
};
/** A fonte do registro mais recente do convênio, como o job grava. */
export const ROTULO_FONTE_MOVIMENTACAO: Record<string, string> = {
  pagamento: "pagamento",
  desembolso: "desembolso",
  aditivo: "termo aditivo",
  prorrogacao: "prorrogação de ofício",
  licitacao: "licitação",
  historico: "mudança de situação",
};

/** As categorias de motivo dos aditivos, na ordem de prioridade do job (painel_execucao/aditivos.py). */
export const MOTIVOS_ADITIVO = [
  "pandemia",
  "licitacao_fracassada",
  "chuvas",
  "atraso_repasse",
  "mudanca_gestao",
  "readequacao_projeto",
  "empresa",
  "licitacao",
  "analise_concedente",
  "licenca_area",
  "saldo_rendimento",
  "ampliacao_meta",
  "reajuste_contrato",
  "contrapartida",
  "atraso_execucao",
  "orcamento_empenho",
  "sem_justificativa",
  "nao_classificado",
] as const;
export const ROTULO_MOTIVO_ADITIVO: Record<string, string> = {
  pandemia: "Pandemia",
  licitacao_fracassada: "Licitação deserta ou fracassada",
  chuvas: "Chuvas e clima",
  atraso_repasse: "Atraso no repasse",
  mudanca_gestao: "Mudança de gestão",
  readequacao_projeto: "Readequação do projeto",
  empresa: "Problema com a empresa contratada",
  licitacao: "Licitação em andamento",
  analise_concedente: "Análise da mandatária ou do concedente",
  licenca_area: "Licença, área ou suspensiva",
  saldo_rendimento: "Uso de saldo ou rendimento",
  ampliacao_meta: "Ampliação de meta",
  reajuste_contrato: "Reajuste do contrato",
  contrapartida: "Ajuste de contrapartida",
  atraso_execucao: "Atraso na execução (genérico)",
  orcamento_empenho: "Orçamento ou empenho",
  sem_justificativa: "Sem justificativa",
  nao_classificado: "Não classificado",
};

export function ehVisaoConvenio(v: Visao): boolean {
  return VISOES_CONVENIO.includes(v);
}

/** As visões com filtro de município: as de convênio e a de mudanças. */
export function aceitaMunicipio(v: Visao): boolean {
  return ehVisaoConvenio(v) || v === "mudancas";
}

// ============================ MUDANÇAS ============================

/** Avanço destrava; alerta pede ação; registro é contexto. */
export type GrupoMudanca = "avanco" | "alerta" | "registro";

export interface DefinicaoMudanca {
  tipo: string;
  rotulo: string;
  grupo: GrupoMudanca;
  alvo: "convenio" | "proposta";
}

/** Os tipos que o job grava (painel_execucao/mudancas.py), na ordem de leitura da tela e do e-mail. */
export const TIPOS_MUDANCA: DefinicaoMudanca[] = [
  { tipo: "suspensiva_retirada", rotulo: "Suspensiva retirada", grupo: "avanco", alvo: "convenio" },
  { tipo: "primeiro_desembolso", rotulo: "Primeiro desembolso", grupo: "avanco", alvo: "convenio" },
  { tipo: "proposta_assinada", rotulo: "Proposta assinada", grupo: "avanco", alvo: "proposta" },
  { tipo: "proposta_aprovada", rotulo: "Proposta aprovada, esperando assinatura", grupo: "avanco", alvo: "proposta" },
  { tipo: "vigencia_prorrogada", rotulo: "Vigência em risco prorrogada", grupo: "avanco", alvo: "convenio" },
  { tipo: "saldo_voltou", rotulo: "Saldo parado voltou a mexer", grupo: "avanco", alvo: "convenio" },
  { tipo: "contas_enviadas", rotulo: "Contas enviadas para análise", grupo: "avanco", alvo: "convenio" },
  { tipo: "contas_aprovadas", rotulo: "Contas aprovadas ou concluídas", grupo: "avanco", alvo: "convenio" },
  { tipo: "suspensiva_vencida", rotulo: "Prazo da suspensiva venceu", grupo: "alerta", alvo: "convenio" },
  { tipo: "vigencia_vencida", rotulo: "Vigência venceu com execução baixa", grupo: "alerta", alvo: "convenio" },
  { tipo: "vigencia_em_risco", rotulo: "Vigência entrou em risco", grupo: "alerta", alvo: "convenio" },
  { tipo: "contas_abertas", rotulo: "Prazo de prestar contas começou", grupo: "alerta", alvo: "convenio" },
  { tipo: "contas_devolvidas", rotulo: "Contas devolvidas para complementação", grupo: "alerta", alvo: "convenio" },
  { tipo: "contas_rejeitadas", rotulo: "Contas rejeitadas ou inadimplência", grupo: "alerta", alvo: "convenio" },
  { tipo: "tce_instaurada", rotulo: "TCE instaurada", grupo: "alerta", alvo: "convenio" },
  { tipo: "saldo_parado", rotulo: "Saldo completou 1 ano parado", grupo: "alerta", alvo: "convenio" },
  { tipo: "financeiro_sem_fisico", rotulo: "Dinheiro saiu e a obra não andou", grupo: "alerta", alvo: "convenio" },
  { tipo: "proposta_negada", rotulo: "Proposta reprovada, com impedimento ou eliminada", grupo: "alerta", alvo: "proposta" },
  { tipo: "proposta_complementacao", rotulo: "Proposta voltou para complementação", grupo: "alerta", alvo: "proposta" },
  { tipo: "proposta_enviada", rotulo: "Proposta enviada", grupo: "registro", alvo: "proposta" },
  { tipo: "convenio_novo", rotulo: "Convênio entrou no painel", grupo: "registro", alvo: "convenio" },
  { tipo: "convenio_encerrado", rotulo: "Convênio anulado, rescindido ou cancelado", grupo: "registro", alvo: "convenio" },
  { tipo: "saiu_acompanhamento", rotulo: "Saiu do acompanhamento", grupo: "registro", alvo: "convenio" },
];

export const ROTULO_GRUPO_MUDANCA: Record<GrupoMudanca, string> = {
  avanco: "Avanços",
  alerta: "Alertas",
  registro: "Registro",
};

const MUDANCA_POR_TIPO = new Map(TIPOS_MUDANCA.map((d) => [d.tipo, d]));

export function definicaoMudanca(tipo: string): DefinicaoMudanca {
  return MUDANCA_POR_TIPO.get(tipo) ?? { tipo, rotulo: tipo, grupo: "registro", alvo: "convenio" };
}

export type DiasMudanca = 1 | 7 | 30;
export const DIAS_MUDANCA: DiasMudanca[] = [1, 7, 30];
export const ROTULO_DIAS_MUDANCA: Record<DiasMudanca, string> = {
  1: "Último dado",
  7: "Últimos 7 dias",
  30: "Últimos 30 dias",
};

/** Uma linha de `painel_mudanca`, como as funções da `oport_11` devolvem. */
export interface MudancaPainel {
  dado_ate_anterior: string;
  dado_ate: string;
  alvo: "convenio" | "proposta";
  tipo: string;
  chave: string;
  numero: string | null;
  uf: string | null;
  cod_ibge: string | null;
  municipio: string | null;
  proponente: string | null;
  tipo_agente: string | null;
  orgao_sup: string | null;
  programa: string | null;
  objeto: string | null;
  antes: string | null;
  depois: string | null;
  valor: number | null;
}

/** Uma linha de `painel_mudancas_resumo`. */
export interface ContagemMudanca {
  tipo: string;
  n: number;
  valor: number | null;
  desde: string | null;
  ate: string | null;
}

function dataBr(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

const DIA_BRASILIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", year: "numeric" });

/** O dia do dado no horário de Brasília: o carimbo das 21h51 em Brasília já é o dia seguinte em UTC. */
export function diaDoDado(instante: string | null | undefined): string {
  const d = instante ? new Date(instante) : null;
  return d && !Number.isNaN(d.getTime()) ? DIA_BRASILIA.format(d) : "—";
}

/** O detalhe de uma mudança numa linha: de onde para onde, com a data quando é prazo. */
export function descreverMudanca(m: Pick<MudancaPainel, "tipo" | "antes" | "depois">): string {
  const desfecho = (d: string | null) => (d ? (ROTULO_DESFECHO[d] ?? d) : "—");
  switch (m.tipo) {
    case "suspensiva_retirada":
      return m.antes ? `o prazo era ${dataBr(m.antes)}` : "";
    case "suspensiva_vencida":
      return `prazo ${dataBr(m.depois)}`;
    case "vigencia_prorrogada":
      return `de ${dataBr(m.antes)} para ${dataBr(m.depois)}`;
    case "vigencia_vencida":
    case "vigencia_em_risco":
      return `fim em ${dataBr(m.depois)}`;
    case "contas_abertas":
    case "contas_enviadas":
    case "contas_devolvidas":
    case "contas_rejeitadas":
    case "tce_instaurada":
    case "contas_aprovadas":
    case "convenio_encerrado":
    case "saiu_acompanhamento":
      return m.antes || m.depois ? `${m.antes ?? "—"} → ${m.depois ?? "fora do arquivo"}` : "";
    case "convenio_novo":
      return m.depois ?? "";
    case "proposta_enviada":
      return desfecho(m.depois);
    default:
      return m.antes || m.depois ? `${desfecho(m.antes)} → ${desfecho(m.depois)}` : "";
  }
}

/** Soma as contagens por grupo, para os cartões. */
export function somaPorGrupo(linhas: Pick<ContagemMudanca, "tipo" | "n" | "valor">[]): Record<GrupoMudanca, number> {
  const soma: Record<GrupoMudanca, number> = { avanco: 0, alerta: 0, registro: 0 };
  for (const l of linhas) soma[definicaoMudanca(l.tipo).grupo] += l.n;
  return soma;
}

/** As contagens na ordem de TIPOS_MUDANCA; tipos desconhecidos (job mais novo que o site) vão para o fim. */
export function ordenarContagens<T extends Pick<ContagemMudanca, "tipo">>(linhas: T[]): T[] {
  const ordem = new Map(TIPOS_MUDANCA.map((d, i) => [d.tipo, i]));
  return [...linhas].sort((a, b) => (ordem.get(a.tipo) ?? 999) - (ordem.get(b.tipo) ?? 999) || a.tipo.localeCompare(b.tipo));
}

/** Os dois primeiros dígitos do código IBGE do município são a UF. */
const UF_POR_CODIGO: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

/** UF de um código IBGE de 7 dígitos, ou null se o código não é de município. */
export function ufDoIbge(ibge: string | null | undefined): string | null {
  return ibge && /^\d{7}$/.test(ibge) ? (UF_POR_CODIGO[ibge.slice(0, 2)] ?? null) : null;
}

const IDS_VISAO = VISOES.map((v) => v.id) as string[];
export const LADOS_CONTAS: LadoContas[] = ["atrasada", "negativo", "tce", "concedente"];

export const ROTULO_LADO_CONTAS: Record<LadoContas, string> = {
  atrasada: "Atrasadas pelo convenente",
  negativo: "Rejeitadas e inadimplentes",
  tce: "Em TCE",
  concedente: "Esperando análise do concedente",
};

export function definicao(v: Visao): DefinicaoVisao {
  return VISOES.find((x) => x.id === v) ?? VISOES[0];
}

// ============================ PARÂMETROS ============================

export interface ParametrosPainel {
  visao: Visao;
  /** Null = Brasil. */
  uf: string | null;
  /** Null = todos os órgãos. Não se aplica a municípios. */
  orgao: string | null;
  lado: LadoContas;
  /** Só em tempos. */
  dimensao: DimensaoTempo;
  /**
   * Em aprovação, o ano do envio (null = o anterior ao do dado, decidido no servidor).
   * Em tempos, o ano em que a etapa terminou (null = janela dos últimos 36 meses).
   */
  ano: number | null;
  /** Nas visões de convênio e em mudanças. Código IBGE; quando presente, a UF é a dele. */
  municipio: string | null;
  /** Só nas visões de convênio. Anos inclusivos da assinatura; null = sem limite. */
  assinadoDe: number | null;
  assinadoAte: number | null;
  /** Só nas visões de convênio. */
  movimento: Movimento | null;
  /** Só em mudanças: o último dado, ou os últimos 7 ou 30 dias. */
  dias: DiasMudanca;
  /** Só em mudanças: um tipo de TIPOS_MUDANCA, ou todos. */
  tipo: string | null;
}

const um =(v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function anoValido(v: string | undefined, minimo: number): number | null {
  const n = Number(v);
  return v && Number.isInteger(n) && n >= minimo && n <= 2100 ? n : null;
}

function movimentoDe(v: string | undefined): Movimento | null {
  return (MOVIMENTOS as string[]).includes(v ?? "") ? (v as Movimento) : null;
}

/** Período de assinatura em ordem: quem digitou "de 2024 até 2020" quis 2020 a 2024. */
function periodo(sp: Record<string, string | string[] | undefined>): [number | null, number | null] {
  const de = anoValido(um(sp.assinado_de), ANO_MINIMO_ASSINATURA);
  const ate = anoValido(um(sp.assinado_ate), ANO_MINIMO_ASSINATURA);
  return de !== null && ate !== null && de > ate ? [ate, de] : [de, ate];
}

/** Da URL para o que a página consulta. Valor fora da lista cai no padrão em vez de chegar ao banco. */
export function parametrosPainel(sp: Record<string, string | string[] | undefined>): ParametrosPainel {
  const visao = um(sp.visao);
  const ufUrl = um(sp.uf)?.toUpperCase() ?? null;
  const orgao = um(sp.orgao)?.trim();
  const lado = um(sp.lado);
  const v = (IDS_VISAO.includes(visao ?? "") ? visao : "suspensiva") as Visao;
  const uf = ufUrl && (UFS as readonly string[]).includes(ufUrl) ? ufUrl : null;
  const convenio = ehVisaoConvenio(v);
  const mudancas = v === "mudancas";
  // Município só vale na UF dele. Se a URL traz outra UF, a pessoa trocou a UF no
  // formulário com o município antigo ainda no seletor: vale a UF.
  const ibge = um(sp.municipio)?.trim() ?? null;
  const ufMunicipio = aceitaMunicipio(v) ? ufDoIbge(ibge) : null;
  const municipio = ufMunicipio && (uf === null || uf === ufMunicipio) ? ibge : null;
  const [assinadoDe, assinadoAte] = convenio ? periodo(sp) : [null, null];
  const dias = Number(um(sp.dias));
  const tipo = um(sp.tipo) ?? "";
  return {
    visao: v,
    uf: municipio ? ufMunicipio : uf,
    // Órgão é texto livre do arquivo: limita o tamanho e ignora em municípios e mudanças.
    orgao: v !== "municipios" && !mudancas && orgao ? orgao.slice(0, 200) : null,
    lado: (LADOS_CONTAS as string[]).includes(lado ?? "") ? (lado as LadoContas) : "atrasada",
    dimensao: um(sp.dimensao) === "programa" ? "programa" : "orgao",
    ano: v === "aprovacao" || v === "tempos" ? anoValido(um(sp.ano), ANO_MINIMO_ENVIO) : null,
    municipio,
    assinadoDe,
    assinadoAte,
    movimento: convenio ? movimentoDe(um(sp.movimento)) : null,
    dias: mudancas && (DIAS_MUDANCA as number[]).includes(dias) ? (dias as DiasMudanca) : 1,
    tipo: mudancas && MUDANCA_POR_TIPO.has(tipo) ? tipo : null,
  };
}

/**
 * Monta a URL mantendo os outros parâmetros. Trocar de visão limpa o que era só da
 * visão anterior; município e período seguem entre as visões de convênio.
 */
export function urlPainel(atual: ParametrosPainel, muda: Partial<ParametrosPainel>): string {
  const trocouVisao = muda.visao !== undefined && muda.visao !== atual.visao;
  const limpa = trocouVisao
    ? { orgao: null, lado: "atrasada" as LadoContas, dimensao: "orgao" as DimensaoTempo, ano: null, tipo: null }
    : {};
  const p = { ...atual, ...limpa, ...muda };
  // Trocar a UF solta o município, que era de outra.
  if (p.municipio && ufDoIbge(p.municipio) !== p.uf) p.municipio = null;
  const q = new URLSearchParams();
  if (p.visao !== "suspensiva") q.set("visao", p.visao);
  if (p.uf) q.set("uf", p.uf);
  if (p.orgao && p.visao !== "municipios" && p.visao !== "mudancas") q.set("orgao", p.orgao);
  if (p.visao === "contas" && p.lado !== "atrasada") q.set("lado", p.lado);
  if (p.visao === "tempos" && p.dimensao !== "orgao") q.set("dimensao", p.dimensao);
  if ((p.visao === "aprovacao" || p.visao === "tempos") && p.ano !== null) q.set("ano", String(p.ano));
  if (p.visao === "mudancas") {
    if (p.municipio) q.set("municipio", p.municipio);
    if (p.dias !== 1) q.set("dias", String(p.dias));
    if (p.tipo) q.set("tipo", p.tipo);
  }
  if (ehVisaoConvenio(p.visao)) {
    if (p.municipio) q.set("municipio", p.municipio);
    if (p.assinadoDe !== null) q.set("assinado_de", String(p.assinadoDe));
    if (p.assinadoAte !== null) q.set("assinado_ate", String(p.assinadoAte));
    if (p.movimento) q.set("movimento", p.movimento);
  }
  const s = q.toString();
  return s ? `/mapa/painel?${s}` : "/mapa/painel";
}

/** O CSV da visão, com exatamente os filtros da tela. */
export function urlExportar(p: ParametrosPainel): string {
  const url = urlPainel(p, {});
  const consulta = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  // `visao` é omitido quando é a padrão (suspensiva); o CSV precisa dele explícito.
  return `/mapa/painel/exportar${consulta.includes("visao=") ? consulta : `?visao=${p.visao}${consulta ? `&${consulta.slice(1)}` : ""}`}`;
}

/** Datas inclusivas para o banco: 1º de janeiro do ano inicial e 31 de dezembro do final. */
export function datasAssinatura(de: number | null, ate: number | null): { de: string | null; ate: string | null } {
  return { de: de === null ? null : `${de}-01-01`, ate: ate === null ? null : `${ate}-12-31` };
}

/** Os anos do seletor de assinatura, do mais recente ao mais antigo. */
export function anosAssinatura(referencia: string): number[] {
  const anos: number[] = [];
  for (let a = Number(referencia.slice(0, 4)); a >= ANO_MINIMO_ASSINATURA; a--) anos.push(a);
  return anos;
}

/** "assinados de 2019 a 2024", "assinados desde 2023", "assinados até 2018", ou "". */
export function periodoPorExtenso(de: number | null, ate: number | null): string {
  if (de !== null && ate !== null) return de === ate ? `assinados em ${de}` : `assinados de ${de} a ${ate}`;
  if (de !== null) return `assinados desde ${de}`;
  if (ate !== null) return `assinados até ${ate}`;
  return "";
}

// ============================ FICHA DO MUNICÍPIO ============================

export type QuemFicha = "prefeitura" | "todos";

export interface ParametrosFicha {
  ibge: string;
  uf: string;
  quem: QuemFicha;
  assinadoDe: number | null;
  assinadoAte: number | null;
  movimento: Movimento | null;
}

/** Null quando o código não é de município: a página volta ao painel. */
export function parametrosFicha(ibge: string, sp: Record<string, string | string[] | undefined>): ParametrosFicha | null {
  const uf = ufDoIbge(ibge);
  if (!uf) return null;
  const [assinadoDe, assinadoAte] = periodo(sp);
  return {
    ibge,
    uf,
    quem: um(sp.quem) === "todos" ? "todos" : "prefeitura",
    assinadoDe,
    assinadoAte,
    movimento: movimentoDe(um(sp.movimento)),
  };
}

export function urlFicha(atual: Pick<ParametrosFicha, "ibge"> & Partial<ParametrosFicha>, muda: Partial<ParametrosFicha> = {}): string {
  const f = { quem: "prefeitura" as QuemFicha, assinadoDe: null, assinadoAte: null, movimento: null, ...atual, ...muda };
  const q = new URLSearchParams();
  if (f.quem !== "prefeitura") q.set("quem", f.quem);
  if (f.assinadoDe !== null) q.set("assinado_de", String(f.assinadoDe));
  if (f.assinadoAte !== null) q.set("assinado_ate", String(f.assinadoAte));
  if (f.movimento) q.set("movimento", f.movimento);
  const s = q.toString();
  return `/mapa/painel/municipio/${f.ibge}${s ? `?${s}` : ""}`;
}

/** O CSV da ficha: convênios (padrão) ou propostas, com os filtros da ficha. */
export function urlExportarFicha(f: ParametrosFicha, tipo: "convenios" | "propostas" = "convenios"): string {
  const url = urlFicha(f);
  const consulta = new URLSearchParams(url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");
  const q = new URLSearchParams({ ficha: f.ibge });
  if (tipo === "propostas") q.set("tipo", "propostas");
  consulta.forEach((v, k) => q.set(k, v));
  return `/mapa/painel/exportar?${q.toString()}`;
}

/** Uma proposta de `painel_proposta`, como a ficha a lê. */
export interface PropostaPainel {
  id_proposta: string;
  nr_proposta: string | null;
  proponente: string | null;
  tipo_agente: string | null;
  orgao_sup: string | null;
  cod_programa: string | null;
  programa: string | null;
  objeto: string | null;
  valor_repasse: number | null;
  com_emenda: boolean;
  dt_envio: string | null;
  ano_envio: number | null;
  desfecho: string;
  em_lote: boolean;
  limbo: boolean;
  situacao: string | null;
  dt_ultimo_evento: string | null;
  dias_sem_evento: number | null;
  dt_assinatura: string | null;
  nr_convenio: string | null;
}

/** Uma linha de `painel_propostas_por_ano`. */
export interface PropostasDoAno {
  ano_envio: number;
  enviadas: number;
  assinadas: number;
  reprovadas: number;
  reprovadas_lote: number;
  impedimento: number;
  impedimento_lote: number;
  eliminadas: number;
  sem_desfecho: number;
  limbo: number;
  com_emenda: number;
  valor_pedido: number;
}

export const DESFECHOS_ABERTOS = ["aberta_concedente", "aberta_proponente", "aguardando_assinatura"];

export const ROTULO_DESFECHO: Record<string, string> = {
  assinada: "Assinada",
  reprovada: "Reprovada",
  impedimento: "Impedimento técnico",
  eliminada: "Eliminada no chamamento",
  cancelada: "Cancelada",
  anulada: "Convênio anulado",
  aberta_concedente: "Em análise no concedente",
  aberta_proponente: "Em complementação pelo proponente",
  aguardando_assinatura: "Aprovada, esperando assinatura",
};

/** De quem é a vez numa proposta sem desfecho — o que a PONTE pode destravar. */
export function vezDaProposta(desfecho: string): "concedente" | "proponente" | null {
  if (desfecho === "aberta_proponente") return "proponente";
  if (desfecho === "aberta_concedente" || desfecho === "aguardando_assinatura") return "concedente";
  return null;
}

// ============================ ETAPAS E DESFECHOS ============================

export const ETAPAS_CAMINHO = [
  "envio_aprovacao",
  "aprovacao_assinatura",
  "assinatura_desembolso",
  "desembolso_conclusao",
] as const;
export const ETAPAS_VEZ = ["vez_concedente", "vez_proponente", "espera_assinatura"] as const;

export const ROTULO_ETAPA: Record<string, string> = {
  envio_aprovacao: "Envio → aprovação",
  aprovacao_assinatura: "Aprovação → assinatura",
  envio_assinatura: "Envio → assinatura",
  assinatura_desembolso: "Assinatura → 1º desembolso",
  desembolso_conclusao: "1º desembolso → conclusão",
  vez_concedente: "Com o concedente",
  vez_proponente: "Com o proponente",
  espera_assinatura: "Aprovado, esperando assinar",
};

/** Chave da linha que soma todos os órgãos, gravada pelo job. */
export const CHAVE_TODOS = "__todos__";
/** A janela das medianas no job: etapas que terminaram nos últimos 36 meses. */
export const DIAS_JANELA_TEMPO = 1095;

/** Primeiro dia da janela, em ISO, para a nota de método. */
export function inicioJanela(referencia: string): string {
  const d = new Date(`${referencia.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - DIAS_JANELA_TEMPO);
  return d.toISOString().slice(0, 10);
}

/** Abaixo disso a mediana de um órgão oscila demais para comparar; a tela mostra "—". */
export const MINIMO_MEDICOES = 10;
/** Mediana a partir de 1,5 vez a do recorte inteiro é marcada como lenta. */
export const FATOR_LENTO = 1.5;

/** Uma linha de `painel_etapa_tempo`: uma etapa de um órgão ou programa, num recorte. */
export interface LinhaEtapa {
  recorte: string;
  dimensao: DimensaoTempo;
  chave: string;
  rotulo: string | null;
  orgao_sup: string | null;
  etapa: string;
  n: number;
  mediana: number | null;
  p90: number | null;
  em_aberto: number;
  idade_mediana_aberto: number | null;
}

/** Uma linha de `painel_programa_desfecho`. Sem programa = soma do órgão; sem os dois = soma do recorte. */
export interface LinhaDesfecho {
  cod_programa: string | null;
  programa: string | null;
  orgao_sup: string | null;
  ano_envio: number;
  uf: string;
  enviadas: number;
  assinadas: number;
  reprovadas: number;
  reprovadas_lote: number;
  impedimento: number;
  impedimento_lote: number;
  eliminadas: number;
  abertas_concedente: number;
  limbo: number;
  abertas_proponente: number;
  aguardando_assinatura: number;
  com_emenda: number;
  assinadas_com_emenda: number;
  valor_pedido: number;
}

export interface LinhaMatriz {
  chave: string;
  rotulo: string;
  orgao_sup: string | null;
  etapas: Partial<Record<string, LinhaEtapa>>;
  /** Assinaturas medidas na janela: é o volume que ordena a matriz. */
  volume: number;
}

/** Agrupa as linhas de uma dimensão por órgão ou programa, das de mais volume para as de menos. */
export function matrizEtapas(linhas: LinhaEtapa[], dimensao: DimensaoTempo): LinhaMatriz[] {
  const m = new Map<string, LinhaMatriz>();
  for (const l of linhas) {
    if (l.dimensao !== dimensao || l.chave === CHAVE_TODOS) continue;
    let g = m.get(l.chave);
    if (!g) {
      g = { chave: l.chave, rotulo: l.rotulo ?? l.chave, orgao_sup: l.orgao_sup, etapas: {}, volume: 0 };
      m.set(l.chave, g);
    }
    g.etapas[l.etapa] = l;
    if (l.etapa === "envio_assinatura") g.volume = l.n;
  }
  return [...m.values()].sort((a, b) => b.volume - a.volume || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** As etapas do recorte inteiro, ou de um órgão, para os cartões. */
export function etapasDe(linhas: LinhaEtapa[], chave: string): Partial<Record<string, LinhaEtapa>> {
  return Object.fromEntries(
    linhas.filter((l) => l.dimensao === "orgao" && l.chave === chave).map((l) => [l.etapa, l]),
  );
}

/** Mediana confiável o bastante para mostrar, ou null. */
export function medianaComparavel(l: LinhaEtapa | undefined): number | null {
  return l && l.n >= MINIMO_MEDICOES ? l.mediana : null;
}

export function maisLento(mediana: number | null, referencia: number | null): boolean {
  return mediana !== null && referencia !== null && referencia > 0 && mediana >= referencia * FATOR_LENTO;
}

/** Sem ano na URL, o ano anterior ao do dado: o corrente ainda está no começo e quase nada teve desfecho. */
export function anoPadrao(referencia: string): number {
  return Number(referencia.slice(0, 4)) - 1;
}

/** Os anos de envio que o painel tem, do mais recente ao mais antigo. */
export function anosEnvio(referencia: string): number[] {
  const ultimo = Number(referencia.slice(0, 4));
  const anos: number[] = [];
  for (let a = ultimo; a >= ANO_MINIMO_ENVIO; a--) anos.push(a);
  return anos;
}

/** Enviadas que ainda não tiveram desfecho: com o concedente, com o proponente ou esperando assinar. */
export function semDesfecho(d: LinhaDesfecho): number {
  return d.abertas_concedente + d.abertas_proponente + d.aguardando_assinatura;
}

/** Canceladas pelo proponente e convênios anulados: o que sobra das enviadas. */
export function canceladas(d: LinhaDesfecho): number {
  return Math.max(d.enviadas - d.assinadas - d.reprovadas - d.impedimento - d.eliminadas - semDesfecho(d), 0);
}

/** "56 dias", "1 dia", "—". Mediana vem com uma casa; a tela arredonda. */
export function diasPorExtenso(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || !Number.isFinite(dias)) return "—";
  const d = Math.round(dias);
  return `${d.toLocaleString("pt-BR")} ${d === 1 ? "dia" : "dias"}`;
}

/** Fração de `parte` em `total`, pronta para `percentual`; null sem total. */
export function fracao(parte: number, total: number): number | null {
  return total > 0 ? parte / total : null;
}

// ============================ RÓTULOS ============================

export const FAIXAS_SUSPENSIVA = ["vencido", "ate_30", "31_90", "91_180", "mais_180"] as const;
export const ROTULO_FAIXA_SUSPENSIVA: Record<string, string> = {
  vencido: "Prazo vencido",
  ate_30: "Vence em até 30 dias",
  "31_90": "Vence em 31 a 90 dias",
  "91_180": "Vence em 91 a 180 dias",
  mais_180: "Mais de 180 dias",
};

export const EXIGENCIAS = ["projeto", "licenca", "titularidade", "sustentabilidade", "termo_referencia"] as const;
export type Exigencia = (typeof EXIGENCIAS)[number];
export const ROTULO_EXIGENCIA: Record<Exigencia, string> = {
  projeto: "Projeto de engenharia",
  licenca: "Licença ambiental",
  titularidade: "Titularidade da área",
  sustentabilidade: "Plano de sustentabilidade",
  termo_referencia: "Termo de referência",
};

export const GRUPOS_SUSPENSIVA = ["pendente", "retirada", "nunca_teve"] as const;
export const ROTULO_GRUPO_SUSPENSIVA: Record<string, string> = {
  pendente: "Ainda sob suspensiva",
  retirada: "Suspensiva já retirada",
  nunca_teve: "Nunca teve suspensiva",
};

export const ETAPAS_LICITACAO = ["suspensiva", "sem_licitacao", "sem_homologacao", "sem_aceite", "aceita"] as const;
export const ROTULO_ETAPA_LICITACAO: Record<string, string> = {
  suspensiva: "Suspensiva pendente",
  sem_licitacao: "Sem licitação registrada",
  sem_homologacao: "Licitação sem homologação",
  sem_aceite: "Homologada, sem aceite",
  aceita: "Aceita, sem desembolso",
};

export const FAIXAS_VIGENCIA = ["vencida", "ate_90", "91_180"] as const;
export const ROTULO_FAIXA_VIGENCIA: Record<string, string> = {
  vencida: "Vigência vencida",
  ate_90: "Termina em até 90 dias",
  "91_180": "Termina em 91 a 180 dias",
};

export const FAIXAS_SALDO = ["ate_90", "91_180", "181_365", "mais_365"] as const;
export const ROTULO_FAIXA_SALDO: Record<string, string> = {
  ate_90: "Movimento em até 90 dias",
  "91_180": "91 a 180 dias",
  "181_365": "181 a 365 dias",
  mais_365: "Mais de 1 ano parado",
};

export const SINAIS = ["saldo", "suspensiva", "contas_atrasadas", "contas_negativas", "sem_desembolso"] as const;
export type Sinal = (typeof SINAIS)[number];
export const ROTULO_SINAL: Record<Sinal, string> = {
  saldo: "Saldo parado",
  suspensiva: "Suspensiva vencendo",
  contas_atrasadas: "Contas atrasadas",
  contas_negativas: "Contas rejeitadas, inadimplência ou TCE",
  sem_desembolso: "Sem desembolso há +1 ano",
};
/** Para as etiquetas da tabela, onde o rótulo inteiro dobra a altura da linha. */
export const ROTULO_SINAL_CURTO: Record<Sinal, string> = {
  saldo: "Saldo",
  suspensiva: "Suspensiva",
  contas_atrasadas: "Contas atrasadas",
  contas_negativas: "Contas negativas",
  sem_desembolso: "Sem desembolso",
};
export const DESCRICAO_SINAL: Record<Sinal, string> = {
  saldo: "R$ 100 mil ou mais sem saída há mais de um ano",
  suspensiva: "prazo vencido ou vencendo em até 90 dias",
  contas_atrasadas: "prazo das contas vencido, ou contas em complementação",
  contas_negativas: "prestação de contas rejeitada, inadimplência ou TCE",
  sem_desembolso: "assinado há mais de um ano, sem suspensiva e sem nenhum desembolso",
};

// ============================ FRASES ============================

function plural(n: number, um: string, varios: string): string {
  return `${n} ${Math.abs(n) === 1 ? um : varios}`;
}

/** "vence hoje", "vence em 12 dias", "venceu há 3 dias". */
export function prazoPorExtenso(dias: number | null | undefined, verbo: { futuro: string; passado: string } = {
  futuro: "vence",
  passado: "venceu",
}): string {
  if (dias === null || dias === undefined) return "—";
  if (dias === 0) return `${verbo.futuro} hoje`;
  if (dias > 0) return `${verbo.futuro} em ${plural(dias, "dia", "dias")}`;
  return `${verbo.passado} há ${plural(-dias, "dia", "dias")}`;
}

/** "3 anos e 2 meses", "8 meses", "12 dias" — para idades longas lidas de relance. */
export function idadePorExtenso(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || dias < 0) return "—";
  if (dias < 60) return plural(dias, "dia", "dias");
  // 12 meses em 365 dias, e não 30,44 dias por mês: 365 dias tem de dar "1 ano", não "11 meses".
  const meses = Math.floor((dias * 12) / 365 + 1e-9);
  if (meses < 12) return plural(meses, "mês", "meses");
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto ? `${plural(anos, "ano", "anos")} e ${plural(resto, "mês", "meses")}` : plural(anos, "ano", "anos");
}

/** "37%" — a fração vem de 0 a 1. */
export function percentual(fracao: number | null | undefined): string {
  if (fracao === null || fracao === undefined || !Number.isFinite(fracao)) return "—";
  return `${Math.round(fracao * 100)}%`;
}

export interface LinhaResumo {
  visao: string;
  chave: string;
  n: number;
  valor: number | null;
}

/** Acesso ao resumo por chave, com zero quando a chave não veio (faixa sem convênio). */
export function resumoDe(linhas: LinhaResumo[], visao: Visao | string) {
  const m = new Map(linhas.filter((l) => l.visao === visao).map((l) => [l.chave, l]));
  return (chave: string) => ({ n: m.get(chave)?.n ?? 0, valor: m.get(chave)?.valor ?? 0 });
}

export function exigenciasDe(linha: Partial<Record<`exige_${Exigencia}`, boolean | null>>): Exigencia[] {
  return EXIGENCIAS.filter((e) => linha[`exige_${e}`] === true);
}

export function sinaisDe(m: Partial<Record<`sinal_${Sinal}`, boolean>>): Sinal[] {
  return SINAIS.filter((s) => m[`sinal_${s}`] === true);
}

// ============================ ADITIVOS ============================

/** Uma linha de `painel_aditivo_motivo`. */
export interface LinhaAditivoMotivo {
  recorte: string;
  ano: number;
  motivo: string;
  aditivos: number;
  convenios: number;
}

/** Anos de aditivo somados no bloco "Por que se prorroga": o do dado e os dois anteriores. */
export const ANOS_MOTIVOS = 3;

/**
 * Soma os aditivos por motivo nos anos pedidos, do mais frequente ao menos. "Não
 * classificado" e "sem justificativa" vão sempre para o fim: não são motivo, são falta dele.
 */
export function somaMotivos(linhas: LinhaAditivoMotivo[], anoMinimo: number): { motivo: string; aditivos: number }[] {
  const soma = new Map<string, number>();
  for (const l of linhas) if (l.ano >= anoMinimo) soma.set(l.motivo, (soma.get(l.motivo) ?? 0) + l.aditivos);
  const semMotivo = (m: string) => m === "nao_classificado" || m === "sem_justificativa";
  return [...soma]
    .map(([motivo, aditivos]) => ({ motivo, aditivos }))
    .sort((a, b) => Number(semMotivo(a.motivo)) - Number(semMotivo(b.motivo)) || b.aditivos - a.aditivos);
}

// ============================ CSV ============================

export interface ColunaCsv<T> {
  titulo: string;
  valor: (linha: T) => string | number | boolean | null | undefined;
}

/**
 * CSV para abrir no Excel em português: BOM UTF-8, separador ponto e vírgula, fim de
 * linha CRLF, número com vírgula decimal e data AAAA-MM-DD virando DD/MM/AAAA.
 */
export function paraCsv<T>(colunas: ColunaCsv<T>[], linhas: T[]): string {
  const celula = (v: string | number | boolean | null | undefined): string => {
    if (v === null || v === undefined) return "";
    let s: string;
    if (typeof v === "boolean") s = v ? "sim" : "não";
    else if (typeof v === "number") s = Number.isFinite(v) ? String(v).replace(".", ",") : "";
    else s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v;
    // Aspas quando o texto tem separador, aspas, quebra de linha, ou começa com sinal
    // que o Excel leria como fórmula.
    const precisaAspas = /[;"\r\n]/.test(s) || /^[=+\-@]/.test(s);
    if (/^[=+\-@]/.test(s) && typeof v === "string") s = `'${s}`;
    return precisaAspas ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(";"));
  return "﻿" + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}
