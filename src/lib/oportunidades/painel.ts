/**
 * Painel de execução da PONTE — a parte pura da página `/mapa/painel`.
 *
 * Os números vêm prontos do job `painel_execucao/` e das funções SQL da `oport_8`.
 * Aqui só se decide como dizer: a visão escolhida, os rótulos, os parâmetros da
 * URL e a frase de prazo. As regras de cada visão estão no job, com teste.
 */
import { UFS } from "./organizacao.ts";

export type Visao = "suspensiva" | "nunca" | "vigencia" | "contas" | "saldo" | "municipios";
export type LadoContas = "atrasada" | "negativo" | "tce" | "concedente";

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
];

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
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Da URL para o que a página consulta. Valor fora da lista cai no padrão em vez de chegar ao banco. */
export function parametrosPainel(sp: Record<string, string | string[] | undefined>): ParametrosPainel {
  const visao = um(sp.visao);
  const uf = um(sp.uf)?.toUpperCase() ?? null;
  const orgao = um(sp.orgao)?.trim();
  const lado = um(sp.lado);
  const v = (IDS_VISAO.includes(visao ?? "") ? visao : "suspensiva") as Visao;
  return {
    visao: v,
    uf: uf && (UFS as readonly string[]).includes(uf) ? uf : null,
    // Órgão é texto livre do arquivo: limita o tamanho e ignora em municípios.
    orgao: v !== "municipios" && orgao ? orgao.slice(0, 200) : null,
    lado: (LADOS_CONTAS as string[]).includes(lado ?? "") ? (lado as LadoContas) : "atrasada",
  };
}

/** Monta a URL mantendo os outros parâmetros. Trocar de visão limpa o órgão e o lado. */
export function urlPainel(atual: ParametrosPainel, muda: Partial<ParametrosPainel>): string {
  const trocouVisao = muda.visao !== undefined && muda.visao !== atual.visao;
  const p = { ...atual, ...(trocouVisao ? { orgao: null, lado: "atrasada" as LadoContas } : {}), ...muda };
  const q = new URLSearchParams();
  if (p.visao !== "suspensiva") q.set("visao", p.visao);
  if (p.uf) q.set("uf", p.uf);
  if (p.orgao && p.visao !== "municipios") q.set("orgao", p.orgao);
  if (p.visao === "contas" && p.lado !== "atrasada") q.set("lado", p.lado);
  const s = q.toString();
  return s ? `/mapa/painel?${s}` : "/mapa/painel";
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
