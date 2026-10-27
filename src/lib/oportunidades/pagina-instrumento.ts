/**
 * A página do instrumento em abas (onda 16, M2, 27/10/2026): visão geral, fase e execução, e da execução a descida aos
 * fornecedores e aos pagamentos. Aqui só o que é puro e testável (`pagina-instrumento.test.ts`): a aba aberta, o
 * endereço, as barras da execução, os pagamentos por mês, a sequência de fases e o resumo dos fornecedores.
 *
 * Regra de acesso (D1, decisão do titular de 07/10/2026), aplicada pela página e respeitada aqui:
 * - público (0): visão geral, fase e execução, sem fornecedores;
 * - cadastrado e cliente (1 e 2): os fornecedores só somados, sem nome (pessoa jurídica, pessoa física e convenente);
 * - administrador (3): a lista das empresas com nome. Pessoa física sempre somada, para todos.
 */
import type { EventoInstrumento } from "./busca.ts";

export type AbaInstrumento = "geral" | "fase" | "execucao";

export const ABAS_INSTRUMENTO: readonly { id: AbaInstrumento; nome: string }[] = [
  { id: "geral", nome: "Visão geral" },
  { id: "fase", nome: "Fase" },
  { id: "execucao", nome: "Execução" },
];

/** A aba que abre: a pedida, se existe; senão a visão geral. */
export function abaDoInstrumento(pedida: string | string[] | undefined): AbaInstrumento {
  const p = Array.isArray(pedida) ? pedida[0] : pedida;
  return ABAS_INSTRUMENTO.find((a) => a.id === p)?.id ?? "geral";
}

/** O endereço do instrumento numa aba; a visão geral é o endereço sem `?aba=` (os links antigos continuam valendo). */
export function urlInstrumentoNaAba(numero: string, aba: AbaInstrumento = "geral"): string {
  return `/mapa/instrumento/${encodeURIComponent(numero)}${aba === "geral" ? "" : `?aba=${aba}`}`;
}

// ================================================================ execução

/** O que a execução precisa do instrumento (as colunas de `painel_instrumento`; as da oport_21 só na PB). */
export interface ValoresExecucao {
  vl_repasse: number | null;
  vl_desembolsado: number | null;
  vl_pago: number | null;
  pct_fisico: number | null;
  pago_pj?: number | null;
  pago_pf?: number | null;
  n_pagamentos_pf?: number | null;
  pago_convenente?: number | null;
  n_fornecedores_pj?: number | null;
}

export interface BarraExecucao {
  id: "financeira" | "fisica" | "pago";
  rotulo: string;
  /** De 0 a 1, ou `null` quando não dá para calcular (a barra aparece vazia, com "sem dado"). */
  fracao: number | null;
  explicacao: string;
}

const fracao = (parte: number | null | undefined, todo: number | null | undefined): number | null => {
  if (parte === null || parte === undefined || !todo || !Number.isFinite(parte) || !Number.isFinite(todo) || todo <= 0) return null;
  return Math.max(0, Math.min(1, parte / todo));
};

const limita = (x: number | null | undefined): number | null =>
  x === null || x === undefined || !Number.isFinite(x) ? null : Math.max(0, Math.min(1, x));

/**
 * As três barras da execução. A financeira é o desembolsado sobre o repasse (calculada aqui: até a onda 12 o job
 * gravava 999% em `pct_desembolsado` sem desembolso). A física é a aferida no Transferegov. A terceira diz quanto do
 * que chegou à conta o convenente já pagou.
 */
export function barrasDaExecucao(i: ValoresExecucao): BarraExecucao[] {
  return [
    { id: "financeira", rotulo: "Execução financeira", fracao: fracao(i.vl_desembolsado, i.vl_repasse), explicacao: "desembolsado ÷ repasse federal" },
    { id: "fisica", rotulo: "Execução física", fracao: limita(i.pct_fisico), explicacao: "aferida no Transferegov" },
    { id: "pago", rotulo: "Pago pelo convenente", fracao: fracao(i.vl_pago, i.vl_desembolsado), explicacao: "pago ÷ desembolsado" },
  ];
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface PagamentoDoMes {
  /** "2024-03" */
  mes: string;
  /** "mar/24" */
  rotulo: string;
  valor: number;
  /** Lançamentos no mês (a linha do tempo soma por dia; `quantidade` é o número de lançamentos do dia). */
  lancamentos: number;
}

/**
 * Os pagamentos da linha do tempo somados por mês, do mais antigo ao mais recente, para o gráfico da execução. Os meses
 * sem pagamento entre o primeiro e o último entram com zero: o vazio no gráfico também é informação.
 */
export function pagamentosPorMes(eventos: readonly EventoInstrumento[]): PagamentoDoMes[] {
  const soma = new Map<string, { valor: number; lancamentos: number }>();
  for (const e of eventos) {
    if (e.tipo !== "pagamento" || e.valor === null || !Number.isFinite(e.valor) || !/^\d{4}-\d{2}/.test(e.data)) continue;
    const mes = e.data.slice(0, 7);
    const s = soma.get(mes) ?? { valor: 0, lancamentos: 0 };
    s.valor += e.valor;
    s.lancamentos += e.quantidade && e.quantidade > 0 ? e.quantidade : 1;
    soma.set(mes, s);
  }
  if (soma.size === 0) return [];
  const meses = [...soma.keys()].sort();
  const [a0, m0] = meses[0].split("-").map(Number);
  const [a1, m1] = meses[meses.length - 1].split("-").map(Number);
  const saida: PagamentoDoMes[] = [];
  for (let a = a0, m = m0; a < a1 || (a === a1 && m <= m1); m === 12 ? ((a += 1), (m = 1)) : (m += 1)) {
    const mes = `${a}-${String(m).padStart(2, "0")}`;
    const s = soma.get(mes);
    saida.push({ mes, rotulo: `${MESES[m - 1]}/${String(a).slice(2)}`, valor: s ? Math.round(s.valor * 100) / 100 : 0, lancamentos: s?.lancamentos ?? 0 });
  }
  return saida;
}

export interface FaseDoInstrumento {
  /** O código do histórico do SICONV, como veio. */
  codigo: string;
  /** Primeiro dia em que o instrumento entrou nesta situação. */
  desde: string;
}

/**
 * A sequência de situações por que o instrumento passou, na ordem, sem repetir a mesma situação seguida (o histórico
 * do SICONV registra a mesma situação mais de uma vez quando outro campo muda). A última é a fase atual.
 */
export function fasesDoInstrumento(eventos: readonly EventoInstrumento[]): FaseDoInstrumento[] {
  const situacoes = eventos
    .filter((e) => e.tipo === "situacao" && e.descricao)
    .slice()
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const fases: FaseDoInstrumento[] = [];
  for (const e of situacoes) {
    if (fases.length && fases[fases.length - 1].codigo === e.descricao) continue;
    fases.push({ codigo: e.descricao as string, desde: e.data });
  }
  return fases;
}

export interface ResumoFornecedores {
  /** Pago a pessoa jurídica (empresas), somado. */
  pj: number | null;
  nPj: number | null;
  /** Pago a pessoa física, somado (nunca com nome). */
  pf: number | null;
  nPagamentosPf: number | null;
  /** Pago ao próprio convenente (OBTV do convenente: não é fornecedor). */
  convenente: number | null;
  /** A soma dos três, quando há ao menos um. */
  total: number | null;
}

const valor = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? null : x);

/** Os fornecedores somados, das colunas do instrumento (o que o cadastrado e o cliente veem). */
export function resumoFornecedores(i: ValoresExecucao): ResumoFornecedores {
  const pj = valor(i.pago_pj);
  const pf = valor(i.pago_pf);
  const convenente = valor(i.pago_convenente);
  const partes = [pj, pf, convenente].filter((x): x is number => x !== null);
  return {
    pj,
    nPj: valor(i.n_fornecedores_pj),
    pf,
    nPagamentosPf: valor(i.n_pagamentos_pf),
    convenente,
    total: partes.length ? partes.reduce((s, x) => s + x, 0) : null,
  };
}

/** As abas vizinhas da aberta, para deslizar no celular (`null` nas pontas). */
export function abasVizinhas(aba: AbaInstrumento): { anterior: AbaInstrumento | null; proxima: AbaInstrumento | null } {
  const i = ABAS_INSTRUMENTO.findIndex((a) => a.id === aba);
  return { anterior: ABAS_INSTRUMENTO[i - 1]?.id ?? null, proxima: ABAS_INSTRUMENTO[i + 1]?.id ?? null };
}

const dia = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? Date.parse(iso.slice(0, 10)) : Number.NaN);

/**
 * Onde cai o período de pagamentos de uma empresa dentro da janela de pagamentos do convênio inteiro, de 0 a 1, para a
 * faixa do detalhe. `null` sem as quatro datas; janela de um dia só vira a faixa inteira.
 */
export function janelaDoPagamento(
  primeiro: string | null,
  ultimo: string | null,
  inicioDoConvenio: string | null,
  fimDoConvenio: string | null,
): [number, number] | null {
  const [a, b, i, f] = [dia(primeiro), dia(ultimo), dia(inicioDoConvenio), dia(fimDoConvenio)];
  if ([a, b, i, f].some((x) => Number.isNaN(x))) return null;
  if (f <= i) return [0, 1];
  const pos = (x: number) => Math.max(0, Math.min(1, (x - i) / (f - i)));
  const [p, q] = [pos(Math.min(a, b)), pos(Math.max(a, b))];
  return [Math.round(p * 1000) / 1000, Math.round(q * 1000) / 1000];
}
