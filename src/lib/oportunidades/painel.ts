/**
 * Painel de execução da PONTE — a parte pura da página `/mapa/painel`.
 *
 * Os números vêm prontos do job `painel_execucao/` e das funções SQL da `oport_8`.
 * Aqui só se decide como dizer: a visão escolhida, os rótulos, os parâmetros da
 * URL e a frase de prazo. As regras de cada visão estão no job, com teste.
 */
import { UFS } from "./organizacao.ts";

export type Visao = "suspensiva" | "nunca" | "vigencia" | "contas" | "saldo" | "municipios" | "tempos" | "aprovacao";
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
export const VISOES_CONVENIO: Visao[] = ["suspensiva", "nunca", "vigencia", "contas", "saldo"];

export function ehVisaoConvenio(v: Visao): boolean {
  return VISOES_CONVENIO.includes(v);
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
  /** Só em aprovação. Null = o ano anterior ao do dado, decidido no servidor. */
  ano: number | null;
  /** Só nas visões de convênio. Código IBGE; quando presente, a UF é a dele. */
  municipio: string | null;
  /** Só nas visões de convênio. Anos inclusivos da assinatura; null = sem limite. */
  assinadoDe: number | null;
  assinadoAte: number | null;
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function anoValido(v: string | undefined, minimo: number): number | null {
  const n = Number(v);
  return v && Number.isInteger(n) && n >= minimo && n <= 2100 ? n : null;
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
  // Município só vale na UF dele. Se a URL traz outra UF, a pessoa trocou a UF no
  // formulário com o município antigo ainda no seletor: vale a UF.
  const ibge = um(sp.municipio)?.trim() ?? null;
  const ufMunicipio = convenio ? ufDoIbge(ibge) : null;
  const municipio = ufMunicipio && (uf === null || uf === ufMunicipio) ? ibge : null;
  const [assinadoDe, assinadoAte] = convenio ? periodo(sp) : [null, null];
  return {
    visao: v,
    uf: municipio ? ufMunicipio : uf,
    // Órgão é texto livre do arquivo: limita o tamanho e ignora em municípios.
    orgao: v !== "municipios" && orgao ? orgao.slice(0, 200) : null,
    lado: (LADOS_CONTAS as string[]).includes(lado ?? "") ? (lado as LadoContas) : "atrasada",
    dimensao: um(sp.dimensao) === "programa" ? "programa" : "orgao",
    ano: anoValido(um(sp.ano), ANO_MINIMO_ENVIO),
    municipio,
    assinadoDe,
    assinadoAte,
  };
}

/**
 * Monta a URL mantendo os outros parâmetros. Trocar de visão limpa o que era só da
 * visão anterior; município e período seguem entre as visões de convênio.
 */
export function urlPainel(atual: ParametrosPainel, muda: Partial<ParametrosPainel>): string {
  const trocouVisao = muda.visao !== undefined && muda.visao !== atual.visao;
  const limpa = trocouVisao ? { orgao: null, lado: "atrasada" as LadoContas, dimensao: "orgao" as DimensaoTempo, ano: null } : {};
  const p = { ...atual, ...limpa, ...muda };
  // Trocar a UF solta o município, que era de outra.
  if (p.municipio && ufDoIbge(p.municipio) !== p.uf) p.municipio = null;
  const q = new URLSearchParams();
  if (p.visao !== "suspensiva") q.set("visao", p.visao);
  if (p.uf) q.set("uf", p.uf);
  if (p.orgao && p.visao !== "municipios") q.set("orgao", p.orgao);
  if (p.visao === "contas" && p.lado !== "atrasada") q.set("lado", p.lado);
  if (p.visao === "tempos" && p.dimensao !== "orgao") q.set("dimensao", p.dimensao);
  if (p.visao === "aprovacao" && p.ano !== null) q.set("ano", String(p.ano));
  if (ehVisaoConvenio(p.visao)) {
    if (p.municipio) q.set("municipio", p.municipio);
    if (p.assinadoDe !== null) q.set("assinado_de", String(p.assinadoDe));
    if (p.assinadoAte !== null) q.set("assinado_ate", String(p.assinadoAte));
  }
  const s = q.toString();
  return s ? `/mapa/painel?${s}` : "/mapa/painel";
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
}

/** Null quando o código não é de município: a página volta ao painel. */
export function parametrosFicha(ibge: string, sp: Record<string, string | string[] | undefined>): ParametrosFicha | null {
  const uf = ufDoIbge(ibge);
  if (!uf) return null;
  const [assinadoDe, assinadoAte] = periodo(sp);
  return { ibge, uf, quem: um(sp.quem) === "todos" ? "todos" : "prefeitura", assinadoDe, assinadoAte };
}

export function urlFicha(atual: Pick<ParametrosFicha, "ibge"> & Partial<ParametrosFicha>, muda: Partial<ParametrosFicha> = {}): string {
  const f = { quem: "prefeitura" as QuemFicha, assinadoDe: null, assinadoAte: null, ...atual, ...muda };
  const q = new URLSearchParams();
  if (f.quem !== "prefeitura") q.set("quem", f.quem);
  if (f.assinadoDe !== null) q.set("assinado_de", String(f.assinadoDe));
  if (f.assinadoAte !== null) q.set("assinado_ate", String(f.assinadoAte));
  const s = q.toString();
  return `/mapa/painel/municipio/${f.ibge}${s ? `?${s}` : ""}`;
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
