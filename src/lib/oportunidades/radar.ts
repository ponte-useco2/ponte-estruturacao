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

/** Os canais e os tipos que a `oport_17` aceita filtrar — a mesma lista que as funções SQL validam. */
export const CANAIS_RADAR = ["voluntaria", "emenda_parlamentar", "beneficiario_especifico", "nao_determinado"] as const;
export const TIPOS_RADAR = ["municipio", "osc", "estado", "consorcio_publico", "empresa"] as const;

export interface ParametrosRadar {
  /** Null = Brasil. */
  uf: string | null;
  dias: Dias;
  categoria: Categoria;
  /** Null = todos os canais. */
  canal: string | null;
  /** Null = todos os tipos de proponente. Não se aplica à disputa, que é da janela, não do proponente. */
  tipo: string | null;
  /** Uma tabela ordenada por vez, escrita na URL como `tabela.coluna.sentido` (`programa.valor.desc`). */
  ordem: Ordenacao | null;
}

export type Sentido = "asc" | "desc";

export interface Ordenacao {
  tabela: string;
  coluna: string;
  sentido: Sentido;
}

/** As colunas que cada tabela aceita ordenar; o que vier fora disso na URL é ignorado. */
export const COLUNAS_ORDEM: Record<string, readonly string[]> = {
  canal: ["rotulo", "atual", "anterior", "variacao", "valor", "inferidos"],
  tipo: ["rotulo", "atual", "anterior", "variacao", "valor"],
  programa: ["rotulo", "atual", "anterior", "variacao", "valor"],
  disputa: ["programa", "canal", "desde_abertura", "trinta_dias", "valor", "faltam", "ufs"],
  pb: ["quando", "proponente", "categoria", "programa", "canal", "valor"],
  parados: ["municipio", "em_revisao", "revisadas", "ultimo_envio"],
};

/** O padrão de cada tabela, para o cabeçalho mostrar a seta certa antes do primeiro clique. */
export const ORDEM_PADRAO: Record<string, Ordenacao> = {
  canal: { tabela: "canal", coluna: "atual", sentido: "desc" },
  tipo: { tabela: "tipo", coluna: "atual", sentido: "desc" },
  programa: { tabela: "programa", coluna: "atual", sentido: "desc" },
  disputa: { tabela: "disputa", coluna: "desde_abertura", sentido: "desc" },
  pb: { tabela: "pb", coluna: "quando", sentido: "desc" },
  parados: { tabela: "parados", coluna: "municipio", sentido: "asc" },
};

export function ordemDaTabela(p: ParametrosRadar, tabela: string): Ordenacao {
  return p.ordem?.tabela === tabela ? p.ordem : ORDEM_PADRAO[tabela];
}

/** O clique no cabeçalho: coluna nova começa do maior (texto começa de A); a mesma coluna inverte. */
export function proximaOrdem(atual: Ordenacao, tabela: string, coluna: string, texto = false): Ordenacao {
  if (atual.tabela === tabela && atual.coluna === coluna) {
    return { tabela, coluna, sentido: atual.sentido === "asc" ? "desc" : "asc" };
  }
  return { tabela, coluna, sentido: texto ? "asc" : "desc" };
}

/** Ordena em memória: as tabelas têm dezenas de linhas, e a ordem não precisa voltar ao banco. */
export function ordenar<T>(linhas: readonly T[], valor: (l: T) => string | number | null, sentido: Sentido): T[] {
  const sinal = sentido === "asc" ? 1 : -1;
  return [...linhas]
    .map((l, i) => ({ l, i, v: valor(l) }))
    .sort((a, b) => {
      // Sem valor vai para o fim nos dois sentidos: "—" no meio da lista confunde.
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const d = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v), "pt-BR");
      return d ? d * sinal : a.i - b.i;
    })
    .map((x) => x.l);
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
  const canal = um(sp.canal);
  const tipo = um(sp.tipo);
  const [tabela, coluna, sentido] = (um(sp.ordem) ?? "").split(".");
  return {
    uf: uf && (UFS as readonly string[]).includes(uf) ? uf : null,
    dias: (JANELAS as number[]).includes(dias) ? (dias as Dias) : 30,
    categoria: (CATEGORIAS as string[]).includes(categoria ?? "") ? (categoria as Categoria) : "nova",
    canal: (CANAIS_RADAR as readonly string[]).includes(canal ?? "") ? (canal as string) : null,
    tipo: (TIPOS_RADAR as readonly string[]).includes(tipo ?? "") ? (tipo as string) : null,
    ordem: COLUNAS_ORDEM[tabela ?? ""]?.includes(coluna ?? "")
      ? { tabela, coluna, sentido: sentido === "asc" ? "asc" : "desc" }
      : null,
  };
}

/** Monta a URL mantendo os outros parâmetros. `null` remove. */
export function urlRadar(atual: ParametrosRadar, muda: Partial<ParametrosRadar>): string {
  const p = { ...atual, ...muda };
  const q = new URLSearchParams();
  if (p.uf) q.set("uf", p.uf);
  if (p.dias !== 30) q.set("dias", String(p.dias));
  if (p.categoria !== "nova") q.set("categoria", p.categoria);
  if (p.canal) q.set("canal", p.canal);
  if (p.tipo) q.set("tipo", p.tipo);
  if (p.ordem) q.set("ordem", `${p.ordem.tabela}.${p.ordem.coluna}.${p.ordem.sentido}`);
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
