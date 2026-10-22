/**
 * O filtro das tabelas que vai à consulta (onda 15, fase 3, F3.2, 20/10/2026). Nas listas que o banco corta (o painel
 * de execução lê 100 de até 26 mil convênios), o componente não pode filtrar só o que recebeu: o estado da tabela, o
 * mesmo do endereço (`lerEstado`), vira filtro e ordem do PostgREST aqui. Puro, com teste; a consulta é qualquer coisa
 * que tenha os métodos de filtro do supabase-js (a interface `ConsultaFiltravel`).
 *
 * As regras de comparação são as da tabela no navegador (`tabela-filtro.ts`), traduzidas:
 *   · texto: contém todas as palavras, sem caixa e sem acento. Cada palavra vira um `like` na versão sem acento e em
 *     minúsculas da coluna (`busca_<coluna>`, as funções da oport_46, que o PostgREST filtra como se fossem colunas):
 *     "saude" acha "SAÚDE". A expressão regular com as vogais acentuadas levava 2 a 4 s nos 21 mil convênios de uma
 *     visão; a coluna sem acento, 70 ms. Coluna sem versão sem acento (o número do convênio) vai por `ilike`;
 *   · número: `de..até`, inclusivos. A coluna pode ter escala (percentual de 0 a 100 na tela, fração no banco, com a
 *     mesma margem do arredondamento da tela) e ajuste (os dias que a tela conta até hoje e o banco até o dia do
 *     arquivo);
 *   · data: `de..até`, inclusivos;
 *   · categoria: um dos rótulos; o rótulo vira o valor do banco pelo mapa da coluna (ou é o próprio valor).
 * A coluna que o banco não sabe filtrar (a calculada na tela) fica sem campo e é ignorada aqui; a tela a marca como sem
 * filtro e sem ordem no modo do banco.
 */
import { normalizarTexto, type EstadoTabela, type FiltroColuna } from "./tabela-filtro.ts";

/** O que a consulta precisa ter (o `PostgrestFilterBuilder` do supabase-js tem tudo isto). */
export interface ConsultaFiltravel<Q> {
  filter(coluna: string, operador: string, valor: unknown): Q;
  gte(coluna: string, valor: unknown): Q;
  lte(coluna: string, valor: unknown): Q;
  in(coluna: string, valores: readonly unknown[]): Q;
  or(filtros: string): Q;
  order(coluna: string, opcoes: { ascending: boolean; nullsFirst?: boolean }): Q;
}

/** Como uma coluna da tela se lê no banco. */
export interface CampoBanco {
  /** A coluna da tabela no banco. */
  coluna: string;
  /** Texto: a versão sem acento e em minúsculas da coluna (a função `busca_*` da oport_46). */
  busca?: string;
  /**
   * Texto curto sem versão sem acento (o nome do município): o `ilike` troca vogal e "c" por `_`, o curinga de um
   * caractere, e "joao pessoa" acha "JOÃO PESSOA". Pode achar a mais em texto longo; num nome, não pesa.
   */
  curinga?: boolean;
  /** Número: a tela mostra `valor * escala` (percentual: 100). */
  escala?: number;
  /** Número: a tela mostra `valor + ajuste` (dias contados até hoje: o deslocamento). */
  ajuste?: number;
  /** Categoria: rótulo da tela → valor do banco. Sem mapa, o rótulo é o valor. */
  valores?: Readonly<Record<string, string>>;
  /** Filtro que não cabe na regra geral (várias colunas): devolve a expressão do `or` do PostgREST, ou null. */
  especial?: (f: FiltroColuna) => string | null;
}

export type CamposBanco = Readonly<Record<string, CampoBanco>>;

/** A palavra dentro de um padrão `like`: os curingas e a barra escapados. */
export function padraoContem(palavra: string): string {
  return `%${palavra.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** O valor da tela em unidades do banco (o inverso de escala e ajuste). */
function noBanco(v: number, campo: CampoBanco, margem: number): number {
  const comAjuste = v - (campo.ajuste ?? 0);
  return campo.escala ? (comAjuste + margem) / campo.escala : comAjuste + margem;
}

/** Com escala, a tela arredonda (37% é de 36,5% a 37,5%): o intervalo do banco abre meia unidade para cada lado. */
const meia = (campo: CampoBanco) => (campo.escala ? 0.5 : 0);

/** Aplica os filtros do estado. Coluna sem campo, filtro de outro tipo ou vazio: ignorados. */
export function filtrarNoBanco<Q extends ConsultaFiltravel<Q>>(q: Q, estado: EstadoTabela, campos: CamposBanco): Q {
  let r = q;
  for (const [id, f] of Object.entries(estado.filtros)) {
    const campo = campos[id];
    if (!campo) continue;
    if (campo.especial) {
      const expr = campo.especial(f);
      if (expr) r = r.or(expr);
      continue;
    }
    switch (f.tipo) {
      case "texto": {
        const palavras = normalizarTexto(f.contem).split(" ").filter(Boolean);
        for (const p of palavras) {
          if (campo.busca) r = r.filter(campo.busca, "like", padraoContem(p));
          else r = r.filter(campo.coluna, "ilike", campo.curinga ? padraoContem(p).replace(/[aeiouc]/g, "_") : padraoContem(p));
        }
        break;
      }
      case "numero":
        if (f.de !== null) r = r.gte(campo.coluna, noBanco(f.de, campo, -meia(campo)));
        if (f.ate !== null) r = r.lte(campo.coluna, noBanco(f.ate, campo, meia(campo)));
        break;
      case "data":
        if (f.de) r = r.gte(campo.coluna, f.de);
        if (f.ate) r = r.lte(campo.coluna, f.ate);
        break;
      case "categoria": {
        if (!f.valores.length) break;
        const mapa = campo.valores;
        const porNormal = mapa ? new Map(Object.entries(mapa).map(([rotulo, v]) => [normalizarTexto(rotulo), v])) : null;
        const valores = f.valores.map((v) => (porNormal ? (porNormal.get(normalizarTexto(v)) ?? v) : v));
        r = r.in(campo.coluna, valores);
        break;
      }
    }
  }
  return r;
}

/**
 * A ordem: a coluna escolhida (se o banco sabe ordenar por ela) e, depois, os critérios da ordem padrão da tela, para
 * que todo empate volte a ela (a regra do componente). Vazio no fim, nos dois sentidos, como no navegador.
 */
export function ordenarNoBanco<Q extends ConsultaFiltravel<Q>>(
  q: Q,
  estado: EstadoTabela,
  campos: CamposBanco,
  padrao: readonly { coluna: string; ascendente: boolean; nulosPrimeiro?: boolean }[],
): Q {
  let r = q;
  const escolhida = estado.ordem ? campos[estado.ordem.coluna] : undefined;
  if (estado.ordem && escolhida && !escolhida.especial) {
    r = r.order(escolhida.coluna, { ascending: estado.ordem.sentido === "asc", nullsFirst: false });
  }
  for (const c of padrao) {
    if (escolhida && c.coluna === escolhida.coluna) continue;
    r = r.order(c.coluna, { ascending: c.ascendente, nullsFirst: c.nulosPrimeiro });
  }
  return r;
}
