/**
 * Radar de propostas da PONTE — a parte pura da página `/mapa/radar`.
 *
 * Os números vêm prontos das funções SQL da `oport_7`. Aqui só se decide como
 * dizer: a variação sobre o período anterior, os rótulos, os parâmetros da URL e
 * o aviso de fim de semana.
 */
import { ROTULO_AGENTE, UFS } from "./organizacao.ts";

export type Categoria = "nova" | "em_revisao" | "revisada";
export type Dimensao = "canal" | "tipo_agente" | "programa";
export type Dias = 1 | 7 | 30;

export const CATEGORIAS: Categoria[] = ["nova", "em_revisao", "revisada"];
export const JANELAS: Dias[] = [1, 7, 30];

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  nova: "Novas",
  em_revisao: "Em revisão",
  revisada: "Revisadas",
};

/** O que cada categoria conta, dito para quem não conhece o SICONV por dentro. */
export const DESCRICAO_CATEGORIA: Record<Categoria, string> = {
  nova: "Entraram em análise pela primeira vez",
  em_revisao: "O órgão devolveu para ajuste",
  revisada: "Voltaram para análise depois do ajuste",
};

export const ROTULO_JANELA: Record<Dias, string> = { 1: "24 horas", 7: "7 dias", 30: "30 dias" };

export const ROTULO_CANAL_RADAR: Record<string, string> = {
  voluntaria: "Proposta voluntária",
  emenda_parlamentar: "Emenda parlamentar",
  beneficiario_especifico: "Beneficiário específico",
  ambiguo: "Ambíguo (duas janelas abertas)",
  nao_determinado: "Sem janela aberta na data",
};

export function rotuloTipo(tipo: string): string {
  return (ROTULO_AGENTE as Record<string, string>)[tipo] ?? "Outro";
}

// ============================ VARIAÇÃO ============================

export interface Variacao {
  delta: number;
  /** Null quando o período anterior foi zero: "+7 sobre nada" não tem percentual. */
  percentual: number | null;
  sentido: "subiu" | "caiu" | "igual";
  texto: string;
}

export function variacao(atual: number, anterior: number): Variacao {
  const delta = atual - anterior;
  const sentido = delta > 0 ? "subiu" : delta < 0 ? "caiu" : "igual";
  if (delta === 0) return { delta, percentual: 0, sentido, texto: "igual ao período anterior" };
  // Sinal de menos tipográfico: o hífen some ao lado de número em fonte proporcional.
  const sinal = delta > 0 ? "+" : "−";
  if (anterior === 0) return { delta, percentual: null, sentido, texto: `${sinal}${Math.abs(delta)} (antes: 0)` };
  const percentual = Math.round((delta / anterior) * 100);
  return { delta, percentual, sentido, texto: `${sinal}${Math.abs(delta)} (${sinal}${Math.abs(percentual)}%)` };
}

// ============================ PARÂMETROS ============================

export interface ParametrosRadar {
  /** Null = Brasil. */
  uf: string | null;
  dias: Dias;
  categoria: Categoria;
}

/**
 * Da URL para o que a página consulta. Valor fora da lista cai no padrão em vez
 * de chegar ao banco — as funções SQL também recusam, mas a página não deve
 * depender de erro de banco para validar entrada.
 */
export function parametrosRadar(sp: Record<string, string | string[] | undefined>): ParametrosRadar {
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const uf = um(sp.uf)?.toUpperCase() ?? null;
  const dias = Number(um(sp.dias));
  const categoria = um(sp.categoria);
  return {
    uf: uf && (UFS as readonly string[]).includes(uf) ? uf : null,
    dias: (JANELAS as number[]).includes(dias) ? (dias as Dias) : 30,
    categoria: (CATEGORIAS as string[]).includes(categoria ?? "") ? (categoria as Categoria) : "nova",
  };
}

/** Monta a URL mantendo os outros parâmetros. `null` remove. */
export function urlRadar(atual: ParametrosRadar, muda: Partial<ParametrosRadar>): string {
  const p = { ...atual, ...muda };
  const q = new URLSearchParams();
  if (p.uf) q.set("uf", p.uf);
  if (p.dias !== 30) q.set("dias", String(p.dias));
  if (p.categoria !== "nova") q.set("categoria", p.categoria);
  const s = q.toString();
  return s ? `/mapa/radar?${s}` : "/mapa/radar";
}

// ============================ PROCEDÊNCIA ============================

const BRASILIA_MS = -3 * 60 * 60 * 1000;

/**
 * A janela de 24h até `dadoAte` toca sábado ou domingo, no horário de Brasília?
 *
 * O Transferegov quase não recebe envio no fim de semana — em 12/09/2026, um
 * sábado, foram 12, contra ~250 num dia útil. Sem aviso, a janela de 24h parece
 * uma queda de 95%.
 */
export function janela24hTocaFimDeSemana(dadoAteIso: string): boolean {
  const fim = Date.parse(dadoAteIso);
  if (Number.isNaN(fim)) return false;
  const diaSemana = (ms: number) => new Date(ms + BRASILIA_MS).getUTCDay();
  const inicio = fim - 24 * 60 * 60 * 1000;
  return [diaSemana(inicio), diaSemana(fim)].some((d) => d === 0 || d === 6);
}

/** "R$ 1,2 mi", "R$ 350 mil", "R$ 900". Valor pedido em disputa, para leitura rápida. */
export function moedaCurta(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const fmt = (n: number, casas: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  if (Math.abs(v) >= 1e9) return `R$ ${fmt(v / 1e9, 1)} bi`;
  if (Math.abs(v) >= 1e6) return `R$ ${fmt(v / 1e6, 1)} mi`;
  if (Math.abs(v) >= 1e3) return `R$ ${fmt(v / 1e3, 0)} mil`;
  return `R$ ${fmt(v, 0)}`;
}
