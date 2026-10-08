/**
 * Leitura em páginas pela chave e ordenação como a do Postgres (D35, 08/10/2026).
 *
 * A API devolve no máximo mil linhas por pedido. Paginar por faixa (`range`, que vira OFFSET) faz o banco refazer a
 * consulta inteira a cada página e descartar as anteriores: o histórico das suspensivas levava 3,8 s só na 1ª página,
 * e a exportação de "nunca desembolsado" do Brasil, ~2,8 s × 22 páginas (auditoria B3). Pela chave, cada página
 * continua depois da última linha lida (`chave > última`), sem reler o que já veio.
 *
 * Exige uma chave ÚNICA e sem nulos, e a consulta ordenada só por ela (é o que garante não pular nem repetir linha).
 * Quando a tela precisa de outra ordem, a ordem é refeita aqui depois de ler tudo (`compararPor`).
 */

export const PAGINA_API = 1000;

export interface ErroLeitura {
  message: string;
  code?: string;
}

export type RespostaPagina = { data: unknown; error: ErroLeitura | null };

export type LeituraPorChave<T> = { linhas: T[]; truncado: boolean } | { erro: ErroLeitura };

/**
 * Todas as linhas, página a página. `consulta(depois, tamanho)` deve filtrar `chave > depois` quando `depois` não é
 * nulo, ordenar pela chave em ordem crescente e limitar a `tamanho`. Para no `teto` de linhas (como a paginação por
 * faixa: com o teto cheio, `truncado` é verdadeiro mesmo que não haja mais nada).
 */
export async function lerPorChave<T>(
  chave: (linha: T) => string,
  consulta: (depois: string | null, tamanho: number) => PromiseLike<RespostaPagina>,
  opcoes: { teto?: number; pagina?: number } = {},
): Promise<LeituraPorChave<T>> {
  const pagina = opcoes.pagina ?? PAGINA_API;
  const teto = opcoes.teto ?? Number.POSITIVE_INFINITY;
  const linhas: T[] = [];
  let depois: string | null = null;
  while (linhas.length < teto) {
    const r = await consulta(depois, pagina);
    if (r.error) return { erro: r.error };
    const lote = (r.data ?? []) as T[];
    linhas.push(...lote);
    if (lote.length < pagina) return { linhas, truncado: false };
    const ultima = chave(lote[lote.length - 1]);
    // Uma consulta que esquece o filtro devolveria a mesma página para sempre.
    if (ultima === depois) return { erro: { message: `a leitura por chave não avançou depois de "${ultima}"` } };
    depois = ultima;
  }
  return { linhas, truncado: true };
}

/** Um critério do ORDER BY: a coluna, o sentido e, se diferente do padrão, onde ficam os nulos. */
export interface CriterioOrdem {
  coluna: string;
  ascendente: boolean;
  /** Padrão do Postgres (e do PostgREST): nulos no fim na ordem crescente e no começo na decrescente. */
  nulosPrimeiro?: boolean;
}

type Valor = string | number | boolean | null | undefined;

function compararValores(a: Valor, b: Valor): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  // Datas ISO e números de convênio (6 posições, dígitos e maiúsculas): a ordem por unidade de código é a do banco.
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Comparador com a semântica do ORDER BY do Postgres para os tipos que a API devolve (número, texto, data em texto,
 * booleano com `false` antes de `true`), incluindo onde ficam os nulos.
 */
export function compararPor<T>(criterios: CriterioOrdem[]): (a: T, b: T) => number {
  return (a, b) => {
    for (const c of criterios) {
      const va = (a as Record<string, Valor>)[c.coluna];
      const vb = (b as Record<string, Valor>)[c.coluna];
      const nuloA = va === null || va === undefined;
      const nuloB = vb === null || vb === undefined;
      if (nuloA || nuloB) {
        if (nuloA && nuloB) continue;
        const primeiro = c.nulosPrimeiro ?? !c.ascendente;
        return nuloA === primeiro ? -1 : 1;
      }
      const d = compararValores(va, vb);
      if (d !== 0) return c.ascendente ? d : -d;
    }
    return 0;
  };
}
