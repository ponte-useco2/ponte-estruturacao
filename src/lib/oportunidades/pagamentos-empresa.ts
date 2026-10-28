/**
 * Os pagamentos um a um a cada empresa de um convênio (onda 19, 28/10/2026; oport_52), para o detalhe da empresa na aba
 * Execução do instrumento. **Só o administrador** (D1: empresa com nome é do nível 3); pessoa física nunca tem linha.
 * Aqui fica o que é puro, com teste (`pagamentos-empresa.test.ts`); a leitura mora em `pagamentos-empresa.server.ts`.
 */

/** Uma linha de `painel_pagamento`. */
export interface PagamentoEmpresa {
  cnpj: string;
  nr_mov_fin: string | null;
  data: string | null;
  valor: number;
  documento: string | null;
  nr_documento: string | null;
}

/** Quantos pagamentos o detalhe mostra antes de "Mostrar todos": a lista longa (até 801 numa empresa) fica atrás do botão. */
export const PAGAMENTOS_VISIVEIS = 12;

/** Os pagamentos de cada empresa, em ordem de data (os sem data por último, e entre iguais pelo número da movimentação). */
export function pagamentosPorEmpresa(linhas: readonly PagamentoEmpresa[]): Map<string, PagamentoEmpresa[]> {
  const m = new Map<string, PagamentoEmpresa[]>();
  for (const l of linhas) {
    const lista = m.get(l.cnpj) ?? [];
    lista.push({ ...l, valor: Number(l.valor) || 0 });
    m.set(l.cnpj, lista);
  }
  const chave = (p: PagamentoEmpresa) => p.data ?? "9999-99-99";
  for (const lista of m.values())
    lista.sort((a, b) => chave(a).localeCompare(chave(b)) || (a.nr_mov_fin ?? "").localeCompare(b.nr_mov_fin ?? "", "pt-BR", { numeric: true }));
  return m;
}

const dia = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? Date.parse(iso.slice(0, 10)) : Number.NaN);

/** Onde cai a data na janela de pagamentos do convênio, de 0 a 1 (o ponto na faixa do tempo); `null` sem data. */
export function posicaoNaJanela(data: string | null, inicio: string | null, fim: string | null): number | null {
  const [d, i, f] = [dia(data), dia(inicio), dia(fim)];
  if ([d, i, f].some((x) => Number.isNaN(x))) return null;
  if (f <= i) return 0.5;
  return Math.round(Math.max(0, Math.min(1, (d - i) / (f - i))) * 1000) / 1000;
}

/** O documento como se lê: "Nota fiscal 1234", "OB 2024OB000123", ou só o tipo, ou só o número. */
export function documentoLegivel(documento: string | null, numero: string | null): string | null {
  const tipo = documento ? documento.charAt(0) + documento.slice(1).toLowerCase() : null;
  const partes = [tipo, numero?.trim() || null].filter(Boolean);
  return partes.length ? partes.join(" ") : null;
}

/**
 * Se a lista de uma empresa está completa: o número de linhas bate com o `n_pagamentos` do par empresa × convênio.
 * Quando não bate (o job ainda não gravou as linhas, ou gravou de outra execução), a tela diz e não inventa.
 */
export function listaCompleta(linhas: number, nPagamentos: number): boolean {
  return linhas > 0 && linhas === nPagamentos;
}
