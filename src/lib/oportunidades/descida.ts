/**
 * A direção da descida (onda 16, M0, 27/10/2026; opção (c) da folha C3b): o 3D do Mapa é a transição entre as páginas
 * de nível que já existem. Cada link sabe se desce (Brasil › UF › município › entidade › instrumento › fornecedor) ou
 * sobe, comparando o nível da página aberta com o da página de destino. A transição do React lê o tipo (`mp-descer` ou
 * `mp-subir`) e o CSS de `_movimento/transicoes.css` faz a página afundar ou voltar do fundo.
 *
 * Fora da descida (janelas, busca, relatório para imprimir, CSV, laudo, troca de aba na mesma página), não há tipo e a
 * troca é a de sempre, sem animação. Puro, com teste (`descida.test.ts`).
 */

export type DirecaoDescida = "descer" | "subir";

/** Os tipos da transição do React; o CSS usa os mesmos nomes como classe. */
export const TIPO_DESCER = "mp-descer";
export const TIPO_SUBIR = "mp-subir";

/**
 * O nível de cada página da descida. O padrão casa o caminho inteiro (sem a busca nem a âncora): o relatório, o CSV e o
 * laudo, que moram debaixo das páginas de nível, ficam de fora de propósito (abrem para imprimir, não para descer).
 */
const NIVEIS: readonly { nivel: number; padrao: RegExp }[] = [
  { nivel: 1, padrao: /^\/mapa\/brasil$/ },
  { nivel: 2, padrao: /^\/mapa\/uf\/[a-z]{2}$/i },
  { nivel: 3, padrao: /^\/mapa\/municipio\/\d{7}(?:\/(?:investimentos|organizacoes))?$/ },
  { nivel: 4, padrao: /^\/mapa\/entidade\/[^/]+$/ },
  { nivel: 5, padrao: /^\/mapa\/(?:instrumento|proposta)\/[^/]+$/ },
  { nivel: 6, padrao: /^\/mapa\/fornecedor\/[^/]+$/ },
];

/** Só o caminho: tira origem, busca e âncora, e a barra final. */
export function caminhoDe(href: string): string {
  let c = href.trim();
  const origem = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(c);
  if (origem) c = c.slice(origem[0].length);
  c = c.split(/[?#]/, 1)[0] ?? "";
  if (c.length > 1) c = c.replace(/\/+$/, "");
  return c || "/";
}

/** O nível da página (1 = Brasil … 6 = fornecedor), ou `null` fora da descida. */
export function nivelDoCaminho(href: string): number | null {
  const c = caminhoDe(href);
  return NIVEIS.find((n) => n.padrao.test(c))?.nivel ?? null;
}

/** Desce, sobe ou nada: só entre duas páginas de nível diferente, ambas na descida. */
export function direcaoDoLink(atual: string | null | undefined, destino: string): DirecaoDescida | null {
  if (!atual) return null;
  const de = nivelDoCaminho(atual);
  const para = nivelDoCaminho(destino);
  if (de === null || para === null || de === para) return null;
  return para > de ? "descer" : "subir";
}

/** O que vai no `transitionTypes` do `<Link>`; `undefined` deixa a troca como sempre foi. */
export function tiposDaTransicao(atual: string | null | undefined, destino: string): string[] | undefined {
  const d = direcaoDoLink(atual, destino);
  return d === "descer" ? [TIPO_DESCER] : d === "subir" ? [TIPO_SUBIR] : undefined;
}
