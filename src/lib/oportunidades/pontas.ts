/**
 * Aparar as pontas de um texto sem expressão regular (Sonar S8786, 12/11/2026). As vinte regex do produto apontadas
 * pela análise de 10/11 eram quase todas a mesma coisa: `+$`, `^-+|-+$`, `[...]+$` para tirar barra, hífen, pontuação ou
 * espaço das pontas. Em texto longo com muitas repetições do separador, essas formas voltam atrás a cada posição e
 * custam tempo quadrático. Aqui é um laço por ponto de código, que custa o tamanho do texto.
 */

/** Tira das pontas escolhidas os pontos de código que `ehSeparador` aceita. */
export function apararPontas(s: string, ehSeparador: (c: string) => boolean, lados: "ambos" | "inicio" | "fim" = "ambos"): string {
  const cs = [...s];
  let i = 0;
  let j = cs.length;
  if (lados !== "fim") while (i < j && ehSeparador(cs[i] as string)) i++;
  if (lados !== "inicio") while (j > i && ehSeparador(cs[j - 1] as string)) j--;
  return i === 0 && j === cs.length ? s : cs.slice(i, j).join("");
}

const ESPACO = /\s/u;
const LETRA_OU_NUMERO = /[\p{L}\p{N}]/u;

/** "https://x/" → "https://x"; "a//" → "a". O que era `.replace(/\/+$/, "")`. */
export const semBarraNoFim = (s: string): string => apararPontas(s, (c) => c === "/", "fim");

/** "-a-b-" → "a-b". O que era `.replace(/^-+|-+$/g, "")`. */
export const semHifenNasPontas = (s: string): string => apararPontas(s, (c) => c === "-");

/** "«abc»." → "abc". O que era `.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")`. */
export const soLetrasENumerosNasPontas = (s: string): string => apararPontas(s, (c) => !LETRA_OU_NUMERO.test(c));

/** Tira do fim o espaço e os caracteres de `pontuacao`. O que era `.replace(/[\s,;.:]+$/, "")`. */
export const semPontuacaoNoFim = (s: string, pontuacao: string): string => apararPontas(s, (c) => ESPACO.test(c) || pontuacao.includes(c), "fim");

/** Tira das duas pontas o espaço e os caracteres de `pontuacao`. */
export const semPontuacaoNasPontas = (s: string, pontuacao: string): string => apararPontas(s, (c) => ESPACO.test(c) || pontuacao.includes(c));
