/**
 * O plano de trabalho de uma proposta (oport_58, 30/10/2026): metas com etapas, itens do plano de aplicação e parcelas
 * previstas, como o job do painel grava em `painel_proposta_plano` (uma linha por proposta). Parte pura: os tipos e as
 * somas da página. Endereço e CEP não vêm; os textos já chegam com a máscara de CPF.
 */

export interface EtapaPlano {
  nr: number | null;
  descricao: string | null;
  inicio: string | null;
  fim: string | null;
  municipio: string | null;
  quantidade: number | null;
  unidade: string | null;
  valor: number | null;
}

export interface MetaPlano extends EtapaPlano {
  tipo: string | null;
  uf: string | null;
  etapas: EtapaPlano[];
}

export interface ItemPlano {
  descricao: string | null;
  aquisicao: string | null;
  tipo: string | null;
  natureza: string | null;
  cod_natureza: string | null;
  situacao: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
}

export interface ParcelaPlano {
  nr: number | null;
  mes: number | null;
  ano: number | null;
  responsavel: string | null;
  valor: number | null;
}

export interface PlanoTrabalho {
  id_proposta: string;
  metas: MetaPlano[];
  itens: ItemPlano[];
  parcelas: ParcelaPlano[];
  n_metas: number | null;
  n_etapas: number | null;
  n_itens: number | null;
  itens_cortados: boolean;
  vl_metas: number | string | null;
  vl_itens: number | string | null;
}

export const COLUNAS_PLANO = "id_proposta,metas,itens,parcelas,n_metas,n_etapas,n_itens,itens_cortados,vl_metas,vl_itens";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "mar/2025"; sem mês ou ano, o que houver; sem nada, "—". */
export function mesAno(p: Pick<ParcelaPlano, "mes" | "ano">): string {
  if (p.mes && p.mes >= 1 && p.mes <= 12 && p.ano) return `${MESES[p.mes - 1]}/${p.ano}`;
  return p.ano ? String(p.ano) : "—";
}

export interface SomaPlano {
  chave: string;
  itens: number;
  valor: number;
}

/** Os itens somados por uma chave (tipo de despesa, natureza da aquisição), do maior valor ao menor. */
export function somarItens(itens: ItemPlano[], chave: (i: ItemPlano) => string | null): SomaPlano[] {
  const m = new Map<string, SomaPlano>();
  for (const i of itens) {
    const k = chave(i) ?? "não informado";
    const s = m.get(k) ?? { chave: k, itens: 0, valor: 0 };
    s.itens += 1;
    s.valor += i.valor_total ?? 0;
    m.set(k, s);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor || a.chave.localeCompare(b.chave));
}

/** As parcelas somadas por quem paga (concedente, convenente). */
export function parcelasPorResponsavel(parcelas: ParcelaPlano[]): SomaPlano[] {
  const m = new Map<string, SomaPlano>();
  for (const p of parcelas) {
    const k = p.responsavel ?? "não informado";
    const s = m.get(k) ?? { chave: k, itens: 0, valor: 0 };
    s.itens += 1;
    s.valor += p.valor ?? 0;
    m.set(k, s);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor);
}

/** Período de "2025-01-01" a "2025-03-31" em "01/01/2025 a 31/03/2025"; sem datas, "—". */
export function periodo(inicio: string | null, fim: string | null): string {
  const br = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : null);
  const a = br(inicio);
  const b = br(fim);
  return a && b ? `${a} a ${b}` : (a ?? b ?? "—");
}
