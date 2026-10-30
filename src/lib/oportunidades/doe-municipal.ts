/**
 * O Diário Oficial do Estado e a Transparência PB no relatório do município (oport_61, 30/10/2026). Parte pura: os
 * tipos das linhas, as somas que a seção mostra e as frases de cobertura. O pacote vem da sessão DOE-PB (modelo v0.2,
 * `D:/doe_PB/docs/municipios/modelo_relatorio_municipal.md`), carregado por `doe_municipal/carregar.py`.
 *
 * Regras que esta parte guarda:
 *   - município fora do escopo do pacote é "não lido", nunca zero (a amostra tem 2 municípios);
 *   - só a TRANSFERÊNCIA ao CNPJ da prefeitura ou a fundo municipal é repasse; o pagamento direto à prefeitura (tributo,
 *     tarifa, ressarcimento) aparece à parte e nunca soma no repasse;
 *   - a despesa "com o município informado na nota" é sempre "a conferir" e não existe para João Pessoa;
 *   - convênio com o ente municipal e convênio de quem só tem sede no município são duas listas que nunca se somam;
 *   - nenhum achado nasce da falta de ato, e não há comparação entre municípios.
 */

export interface MesDoe {
  mes: string;
  esfera: string;
  classe: string;
  subclasse: string;
  n_atos: number;
  valor_max_soma: number | null;
  confianca_classe: string | null;
}

export interface AtoDoe {
  ato_id: number;
  data_edicao: string;
  pagina: number | null;
  link: string;
  orgao: string | null;
  tipo: string | null;
  classe: string;
  subclasse: string | null;
  numero: string | null;
  cnpjs: string[];
  valor_max: number | null;
  origem_texto: string | null;
  confianca: string;
}

export interface RepasseTpb {
  mes: string;
  orgao: string | null;
  funcao: string | null;
  grupo_natureza: string | null;
  modalidade: string | null;
  tipo_pagamento: string;
  credor: string;
  confianca: string;
  pago: number | null;
  empenhado: number | null;
}

export interface DespesaLocalTpb {
  mes: string;
  orgao: string | null;
  funcao: string | null;
  pago: number | null;
  empenhado: number | null;
}

export interface ConvenioTpb {
  ano: number | null;
  numero: string | null;
  instrumento: string | null;
  concedente: string | null;
  convenente: string | null;
  convenente_tipo: "ente municipal" | "sediado no município";
  objeto: string | null;
  inicio: string | null;
  fim: string | null;
  valor_concedente: number | null;
  valor_total: number | null;
  link: string | null;
}

export type LeituraDoeMunicipio =
  | { estado: "sem_dado" }
  | { estado: "fora_do_escopo"; dadoAte: string | null }
  | { estado: "falha" }
  | {
      estado: "ok";
      dadoAte: string | null;
      meses: MesDoe[];
      atos: AtoDoe[];
      repasses: RepasseTpb[];
      despesaLocal: DespesaLocalTpb[];
      convenios: ConvenioTpb[];
    };

export const IBGE_CAPITAL = "2507507";
export const ATOS_NA_LISTA = 40;

export const TRANSFERENCIA = "transferência";

const soma = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, x) => a + (Number(x) || 0), 0);
const ano = (mes: string) => mes.slice(0, 4);

/** Atos por classe, do mais frequente ao menos, com a confiança da classe. */
export function atosPorClasse(meses: MesDoe[]): { classe: string; n: number; confianca: string | null }[] {
  const m = new Map<string, { classe: string; n: number; confianca: string | null }>();
  for (const x of meses) {
    const c = m.get(x.classe) ?? { classe: x.classe, n: 0, confianca: x.confianca_classe };
    c.n += x.n_atos;
    m.set(x.classe, c);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.classe.localeCompare(b.classe));
}

/** Atos por ano (todas as classes). */
export function atosPorAno(meses: MesDoe[]): { ano: string; n: number }[] {
  const m = new Map<string, number>();
  for (const x of meses) if (/^\d{4}-\d{2}$/.test(x.mes)) m.set(ano(x.mes), (m.get(ano(x.mes)) ?? 0) + x.n_atos);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([a, n]) => ({ ano: a, n }));
}

/** Transferências do Estado à prefeitura e aos fundos, por ano; o pagamento direto à prefeitura vai em `direto`. */
export function repassesPorAno(repasses: RepasseTpb[]): { ano: string; transferencia: number; direto: number; mediaConfianca: boolean }[] {
  const m = new Map<string, { ano: string; transferencia: number; direto: number; mediaConfianca: boolean }>();
  for (const r of repasses) {
    const a = ano(r.mes);
    const x = m.get(a) ?? { ano: a, transferencia: 0, direto: 0, mediaConfianca: false };
    if (r.tipo_pagamento === TRANSFERENCIA) {
      x.transferencia += Number(r.pago) || 0;
      if (r.confianca !== "alta") x.mediaConfianca = true;
    } else x.direto += Number(r.pago) || 0;
    m.set(a, x);
  }
  return [...m.values()].sort((a, b) => a.ano.localeCompare(b.ano));
}

/** As transferências somadas por órgão do Estado (do maior ao menor). */
export function transferenciasPorOrgao(repasses: RepasseTpb[]): { orgao: string; pago: number }[] {
  const m = new Map<string, number>();
  for (const r of repasses) if (r.tipo_pagamento === TRANSFERENCIA) m.set(r.orgao ?? "órgão não informado", (m.get(r.orgao ?? "órgão não informado") ?? 0) + (Number(r.pago) || 0));
  return [...m.entries()].map(([orgao, pago]) => ({ orgao, pago })).sort((a, b) => b.pago - a.pago);
}

export function despesaLocalPorAno(linhas: DespesaLocalTpb[]): { ano: string; pago: number }[] {
  const m = new Map<string, number>();
  for (const l of linhas) m.set(ano(l.mes), (m.get(ano(l.mes)) ?? 0) + (Number(l.pago) || 0));
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([a, pago]) => ({ ano: a, pago }));
}

/** Os convênios em duas listas que não se somam. */
export function separarConvenios(c: ConvenioTpb[]): { ente: ConvenioTpb[]; sediado: ConvenioTpb[] } {
  const ord = (a: ConvenioTpb, b: ConvenioTpb) => (b.ano ?? 0) - (a.ano ?? 0) || (Number(b.valor_concedente) || 0) - (Number(a.valor_concedente) || 0);
  return {
    ente: c.filter((x) => x.convenente_tipo === "ente municipal").sort(ord),
    sediado: c.filter((x) => x.convenente_tipo !== "ente municipal").sort(ord),
  };
}

export function totalConcedente(c: ConvenioTpb[]): number {
  return soma(c.map((x) => x.valor_concedente));
}

/** O que a despesa "local declarado" é, e por que não vale para a capital. */
export function avisoDespesaLocal(ibge: string): string {
  return ibge === IBGE_CAPITAL
    ? "A despesa com o município informado na nota não é mostrada para João Pessoa: a nota sem local cai na capital."
    : "A conferir: o município informado na nota de empenho não é o do credor (24,6% dos CNPJs aparecem em mais de um) e, sem local, a nota cai na capital.";
}
