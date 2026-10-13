/**
 * Radar de propostas da PONTE — a parte pura da página `/mapa/radar`.
 *
 * Os números vêm prontos das funções SQL da `oport_7`. Aqui só se decide como
 * dizer: a variação sobre o período anterior, os rótulos, os parâmetros da URL e
 * o aviso de fim de semana.
 */
import { ROTULO_AGENTE, UFS } from "./organizacao.ts";
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";

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
  /**
   * O `?ordem=tabela.coluna.sentido` de antes da onda 15 (link guardado), só para redirecionar à forma nova
   * (`enderecoDaOrdemAntiga`). Onda 15, fase 2, lote D (13/10/2026): a ordem e o filtro de cada coluna são os da
   * `TabelaFiltravel` (`?t.<tabela>.…`), e nenhum link do radar escreve mais o `?ordem=`.
   */
  ordemAntiga: OrdemAntiga | null;
}

export type Sentido = "asc" | "desc";

export interface OrdemAntiga {
  tabela: string;
  coluna: string;
  sentido: Sentido;
}

/**
 * As tabelas e colunas que o `?ordem=` antigo aceitava, com a coluna da tabela nova que cada uma virou (onda 15,
 * fase 2, lote D, 13/10/2026). "Por canal" e "por tipo de proponente" viraram tabelas de resumo (até 6 linhas fixas,
 * sem filtro nem ordem): a ordem antiga delas é aceita e descartada (null).
 */
const ORDEM_ANTIGA: Record<string, Record<string, string | null>> = {
  canal: { rotulo: null, atual: null, anterior: null, variacao: null, valor: null, inferidos: null },
  tipo: { rotulo: null, atual: null, anterior: null, variacao: null, valor: null },
  programa: { rotulo: "programa", atual: "propostas", anterior: "anterior", variacao: "variacao", valor: "valor" },
  disputa: {
    programa: "programa",
    canal: "canal",
    desde_abertura: "desde-abertura",
    trinta_dias: "trinta-dias",
    valor: "valor",
    faltam: "faltam",
    ufs: "ufs",
  },
  pb: { quando: "quando", proponente: "proponente", categoria: "categoria", programa: "programa", canal: "canal", valor: "valor" },
  parados: { municipio: "municipio", em_revisao: "em-revisao", revisadas: "revisadas", ultimo_envio: "ultimo-envio" },
};

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
    ordemAntiga:
      Object.hasOwn(ORDEM_ANTIGA, tabela ?? "") && Object.hasOwn(ORDEM_ANTIGA[tabela], coluna ?? "")
        ? { tabela, coluna, sentido: sentido === "asc" ? "asc" : "desc" }
        : null,
  };
}

/** Monta a URL mantendo os outros parâmetros. `null` remove. O `?ordem=` antigo nunca sai daqui. */
export function urlRadar(atual: ParametrosRadar, muda: Partial<ParametrosRadar>): string {
  const p = { ...atual, ...muda };
  const q = new URLSearchParams();
  if (p.uf) q.set("uf", p.uf);
  if (p.dias !== 30) q.set("dias", String(p.dias));
  if (p.categoria !== "nova") q.set("categoria", p.categoria);
  if (p.canal) q.set("canal", p.canal);
  if (p.tipo) q.set("tipo", p.tipo);
  const s = q.toString();
  return s ? `/mapa/radar?${s}` : "/mapa/radar";
}

/**
 * O link guardado com o `?ordem=` antigo vira a forma nova (onda 15, fase 2, lote D, 13/10/2026): o mesmo recorte e a
 * ordem na tabela nova, `?t.<tabela>.o=<coluna>.<sentido>` (o formato de `tabela-filtro.ts`; as tabelas do radar
 * usam como prefixo o mesmo nome de antes). Coluna que virou resumo sai sem ordem.
 */
export function enderecoDaOrdemAntiga(p: ParametrosRadar): string {
  const base = urlRadar(p, { ordemAntiga: null });
  const o = p.ordemAntiga;
  const coluna = o ? ORDEM_ANTIGA[o.tabela]?.[o.coluna] : null;
  if (!o || !coluna) return base;
  const q = new URLSearchParams(base.includes("?") ? base.slice(base.indexOf("?") + 1) : "");
  q.set(`t.${o.tabela}.o`, `${coluna}.${o.sentido}`);
  return `/mapa/radar?${q.toString()}`;
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
  if (Math.abs(v) >= 1e12) return `R$ ${fmt(v / 1e12, 1)} tri`;
  if (Math.abs(v) >= 1e9) return `R$ ${fmt(v / 1e9, 1)} bi`;
  if (Math.abs(v) >= 1e6) return `R$ ${fmt(v / 1e6, 1)} mi`;
  if (Math.abs(v) >= 1e3) return `R$ ${fmt(v / 1e3, 0)} mil`;
  return `R$ ${fmt(v, 0)}`;
}

// ============================ TABELAS (onda 15, fase 2, lote D, 13/10/2026) ============================
//
// A regra do titular (13/10/2026): toda tabela que lista coisas filtra e ordena por qualquer coluna. O radar é tela de
// administrador: toda coluna ordena. As colunas, os valores crus e a ordem padrão moram aqui, com teste; a tela
// (`RadarConteudo`) só desenha as células. O `Ordenavel` e o `?ordem=` de antes saíram: a ordem é a da
// `TabelaFiltravel`. Os filtros de canal e de tipo de proponente continuam indo ao banco (chips); os das colunas filtram
// por cima do que foi lido. "Por canal" e "por tipo de proponente" (até 6 linhas fixas) são resumo e ficam sem filtro.

/** O prefixo de cada tabela no endereço (`?t.<id>.…`); o mesmo nome do `?ordem=` antigo. */
export const TABELAS_RADAR = { programa: "programa", disputa: "disputa", pb: "pb", parados: "parados" } as const;

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * "2026-10-12T17:30:00+00:00" → "2026-10-12T14:30": o instante em hora de Brasília (UTC−3, sem verão, a regra de
 * `diaBrasilia`), sem segundos. A coluna de data filtra e ordena pelo dia (os 10 primeiros caracteres), que fica o de
 * Brasília, e o CSV leva a hora. Data pura passa direto; o que não é data vira null.
 */
export function instanteBrasilia(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t - 3 * 3600 * 1000).toISOString().slice(0, 16);
}

/** Por programa (#92): todos os programas com proposta no período, e não mais os 25 primeiros. */
export const COLUNAS_RECORTE_PROGRAMA: ColunaTabela[] = [
  { id: "programa", titulo: "Programa", tipo: "texto" },
  { id: "codigo", titulo: "Código do programa", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "propostas", titulo: "Propostas", tipo: "numero", alinhar: "direita" },
  { id: "anterior", titulo: "Período anterior", tipo: "numero", alinhar: "direita" },
  { id: "variacao", titulo: "Variação", tipo: "numero", alinhar: "direita" },
  { id: "variacao-pct", titulo: "Variação (%)", tipo: "numero", alinhar: "direita", oculta: true },
  { id: "valor", titulo: "Valor pedido", tipo: "numero", alinhar: "direita" },
];

export function valoresDoRecorte(l: {
  chave: string | null;
  rotulo: string | null;
  atual: number;
  anterior: number;
  valor_atual: number | string;
}): Record<string, ValorCelula> {
  const v = variacao(l.atual, l.anterior);
  return {
    programa: l.rotulo ?? l.chave,
    codigo: l.chave,
    propostas: l.atual,
    anterior: l.anterior,
    variacao: v.delta,
    "variacao-pct": v.percentual,
    valor: numero(l.valor_atual),
  };
}

/** A disputa por programa aberto (#90). "UFs" só no Brasil; o órgão e as datas da janela, ocultos, filtram. */
export function colunasDisputa(comUfs: boolean): ColunaTabela[] {
  const colunas: ColunaTabela[] = [
    { id: "programa", titulo: "Programa", tipo: "texto" },
    { id: "codigo", titulo: "Código do programa", tipo: "texto", textoNoCsv: true, oculta: true },
    { id: "orgao", titulo: "Órgão", tipo: "categoria", oculta: true },
    { id: "canal", titulo: "Canal", tipo: "categoria" },
    { id: "desde-abertura", titulo: "Propostas desde a abertura", tipo: "numero", alinhar: "direita" },
    { id: "trinta-dias", titulo: "Últimos 30 dias", tipo: "numero", alinhar: "direita" },
    { id: "valor", titulo: "Valor pedido", tipo: "numero", alinhar: "direita" },
    { id: "faltam", titulo: "Faltam (dias)", tipo: "numero", alinhar: "direita" },
    { id: "abre", titulo: "Abriu em", tipo: "data", oculta: true },
    { id: "fecha", titulo: "Fecha em", tipo: "data", oculta: true },
  ];
  if (comUfs) colunas.push({ id: "ufs", titulo: "UFs", tipo: "numero", alinhar: "direita" });
  return colunas;
}

export function valoresDaDisputa(d: {
  cod_programa: string;
  programa: string;
  orgao: string | null;
  canal: string;
  abre: string | null;
  fecha: string | null;
  dias_restantes: number | null;
  ufs: number;
  novas_desde_abertura: number;
  novas_30d: number;
  valor_pedido: number | string | null;
}): Record<string, ValorCelula> {
  return {
    programa: d.programa,
    codigo: d.cod_programa,
    orgao: d.orgao?.trim() || null,
    canal: ROTULO_CANAL_RADAR[d.canal] ?? d.canal,
    "desde-abertura": d.novas_desde_abertura,
    "trinta-dias": d.novas_30d,
    valor: numero(d.valor_pedido),
    faltam: d.dias_restantes,
    abre: d.abre,
    fecha: d.fecha,
    ufs: d.ufs,
  };
}

/**
 * Quem movimentou proposta na Paraíba (#91). O proponente vem primeiro (é o cabeçalho da linha); o município e o tipo,
 * que a célula do proponente já mostra, filtram por colunas ocultas. "Quando" é o instante em hora de Brasília.
 */
export const COLUNAS_ENVIOS_PB: ColunaTabela[] = [
  { id: "proponente", titulo: "Proponente", tipo: "texto" },
  { id: "municipio", titulo: "Município", tipo: "texto", oculta: true },
  { id: "tipo", titulo: "Tipo de proponente", tipo: "categoria", oculta: true },
  { id: "quando", titulo: "Quando", tipo: "data" },
  { id: "categoria", titulo: "O quê", tipo: "categoria" },
  { id: "programa", titulo: "Programa", tipo: "texto" },
  { id: "canal", titulo: "Canal", tipo: "categoria" },
  { id: "valor", titulo: "Repasse", tipo: "numero", alinhar: "direita" },
  { id: "proposta", titulo: "Proposta", tipo: "texto", textoNoCsv: true, oculta: true },
];

export function valoresDoEnvio(e: {
  id_proposta: string | null;
  categoria: Categoria;
  ocorrido_em: string;
  proponente: string | null;
  municipio: string | null;
  tipo_agente: string | null;
  programa: string | null;
  canal: string | null;
  valor_repasse: number | string | null;
}): Record<string, ValorCelula> {
  return {
    proponente: e.proponente,
    municipio: e.municipio,
    tipo: e.tipo_agente ? rotuloTipo(e.tipo_agente) : null,
    quando: instanteBrasilia(e.ocorrido_em),
    categoria: ROTULO_CATEGORIA[e.categoria] ?? null,
    programa: e.programa,
    canal: e.canal ? (ROTULO_CANAL_RADAR[e.canal] ?? e.canal) : null,
    valor: numero(e.valor_repasse),
    proposta: e.id_proposta,
  };
}

/** Os municípios da PB sem proposta nova em 30 dias (#93). */
export const COLUNAS_PARADOS: ColunaTabela[] = [
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "ibge", titulo: "IBGE", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "em-revisao", titulo: "Em revisão (30 d)", tipo: "numero", alinhar: "direita" },
  { id: "revisadas", titulo: "Revisadas (30 d)", tipo: "numero", alinhar: "direita" },
  { id: "ultimo-envio", titulo: "Último envio novo", tipo: "data" },
];

export function valoresDoParado(m: {
  cod_ibge: string;
  municipio: string;
  em_revisao_30d: number;
  revisadas_30d: number;
  ultimo_envio: string | null;
}): Record<string, ValorCelula> {
  return {
    municipio: m.municipio,
    ibge: m.cod_ibge,
    "em-revisao": m.em_revisao_30d,
    revisadas: m.revisadas_30d,
    "ultimo-envio": instanteBrasilia(m.ultimo_envio),
  };
}
