/**
 * O mapa vivo (onda 16, M1, 27/10/2026; decisões D16-1 e D16-2 do titular): o que é puro e testável
 * (`mapa-vivo.test.ts`). O desenho e o movimento ficam em `app/mapa/_movimento/MapaVivo.tsx`.
 *
 * - **D16-1, o clique:** o primeiro clique numa área abre a prévia (nome, números, "Entrar"); o segundo clique na mesma
 *   área, ou o "Entrar", desce. Teclado (Enter num link, `detail` 0), clique do meio e clique com Ctrl/Cmd/Shift/Alt
 *   navegam direto, como qualquer link: abrir em outra aba continua funcionando.
 * - **D16-2, o zoom:** só no celular, com botões +/− e arrastar quando ampliado; a escala vai de 1 a 4.
 */

export type AcaoDoClique = "navegar" | "previa" | "entrar";

export interface Clique {
  /** `MouseEvent.detail`: 0 quando o "clique" veio do teclado. */
  detail: number;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** O que fazer com o clique numa área que tem página. */
export function acaoDoClique(e: Clique, selecionada: string | null, area: string): AcaoDoClique {
  if (e.detail === 0 || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return "navegar";
  return selecionada === area ? "entrar" : "previa";
}

export const ESCALA_MINIMA = 1;
export const ESCALA_MAXIMA = 4;
const PASSO = 1.6;

/** A escala depois de um toque no + (`sentido` 1) ou no − (`sentido` -1), sempre entre 1 e 4. */
export function proximaEscala(escala: number, sentido: 1 | -1): number {
  const alvo = sentido > 0 ? escala * PASSO : escala / PASSO;
  const limitada = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, alvo));
  return Math.round(limitada * 100) / 100;
}

/**
 * Até onde se pode arrastar o mapa ampliado (em px, a partir do centro): metade do que sobra de cada lado. Na escala 1
 * não há o que arrastar.
 */
export function limitesDoArraste(escala: number, largura: number, altura: number): { left: number; right: number; top: number; bottom: number } {
  const sobraX = Math.max(0, ((escala - 1) * Math.max(0, largura)) / 2);
  const sobraY = Math.max(0, ((escala - 1) * Math.max(0, altura)) / 2);
  return { left: -sobraX, right: sobraX, top: -sobraY, bottom: sobraY };
}

/**
 * A entrada orquestrada do mapa: as áreas surgem por região (a cor), uma região depois da outra, e a legenda por
 * último. O atraso de cada região em milissegundos; a ordem é a da legenda.
 */
export const PASSO_DA_REGIAO_MS = 110;
export function atrasoDaRegiao(ordem: number): number {
  return Math.max(0, Math.floor(ordem)) * PASSO_DA_REGIAO_MS;
}

/** A posição de um ponto do SVG (o centro da área) em porcentagem da caixa, para o marcador sobre o mapa. */
export function posicaoNoMapa(viewBox: string, x: number, y: number): { left: string; top: string } | null {
  const v = viewBox.trim().split(/[\s,]+/).map(Number);
  if (v.length !== 4 || v.some((n) => !Number.isFinite(n)) || v[2] <= 0 || v[3] <= 0) return null;
  const pct = (n: number) => `${Math.round(Math.max(0, Math.min(1, n)) * 10000) / 100}%`;
  return { left: pct((x - v[0]) / v[2]), top: pct((y - v[1]) / v[3]) };
}

/**
 * A caixa de um caminho da malha (só M, L e Z absolutos, o formato de `malhas/*.json`), com uma folga em volta: o
 * `viewBox` do contorno do município no alto da página dele. `null` se o caminho não tiver ponto.
 */
export function caixaDoCaminho(d: string, folga = 0.08): string | null {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 2) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    x0 = Math.min(x0, nums[i]);
    x1 = Math.max(x1, nums[i]);
    y0 = Math.min(y0, nums[i + 1]);
    y1 = Math.max(y1, nums[i + 1]);
  }
  const lado = Math.max(x1 - x0, y1 - y0, 1);
  const f = lado * folga;
  const r = (n: number) => Math.round(n * 10) / 10;
  // quadrada e centrada: o contorno cabe num selo do mesmo tamanho, seja o município comprido ou largo
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return `${r(cx - lado / 2 - f)} ${r(cy - lado / 2 - f)} ${r(lado + 2 * f)} ${r(lado + 2 * f)}`;
}

// ================================================================ o morph da área para o contorno (onda 18)

/**
 * Onda 18 (28/10/2026): ao descer pelo mapa, a área clicada se solta e voa até o contorno no alto da página seguinte
 * (o da UF ou o do município), com a transição nativa do navegador e sem pré-carga. Na hora do clique, uma peça com o
 * mesmo desenho da área cobre a área no mapa e leva o nome `NOME_DO_MORPH`; na página nova, o contorno do nível certo
 * ganha o mesmo nome só durante a transição (pelo tipo, em `transicoes.css`). Como a peça e o contorno têm a mesma
 * caixa (`caixaDoCaminho`), o navegador só move e escala: a forma é a mesma.
 */
export type NivelDoMorph = "uf" | "municipio";

export const NOME_DO_MORPH = "mp-morfa";

/** O tipo da transição que acende o nome no contorno de destino (um por nível: a UF de origem também tem contorno). */
export const TIPO_MORFAR: Record<NivelDoMorph, string> = { uf: "mp-morfar-uf", municipio: "mp-morfar-municipio" };

/** A matriz do SVG para a tela (`getScreenCTM`): só escala e translação, que é o que a malha usa. */
export interface MatrizDaTela {
  a: number;
  d: number;
  e: number;
  f: number;
}

/** A caixa do contorno (`caixaDoCaminho`, em unidades da malha) em pixels da tela, para pôr a peça por cima da área. */
export function caixaNaTela(caixa: string, m: MatrizDaTela): { left: number; top: number; width: number; height: number } | null {
  const v = caixa.trim().split(/[\s,]+/).map(Number);
  if (v.length !== 4 || v.some((n) => !Number.isFinite(n)) || !(m.a > 0) || !(m.d > 0)) return null;
  const r = (n: number) => Math.round(n * 10) / 10;
  return { left: r(m.a * v[0] + m.e), top: r(m.d * v[1] + m.f), width: r(m.a * v[2]), height: r(m.d * v[3]) };
}

/** Os tipos da descida com o do morph, quando o mapa tem destino com contorno e a navegação é de descer. */
export function tiposComMorph(tipos: readonly string[] | undefined, nivel: NivelDoMorph | undefined, tipoDescer: string): string[] | undefined {
  if (!tipos?.length) return tipos ? [...tipos] : undefined;
  return nivel && tipos.includes(tipoDescer) ? [...tipos, TIPO_MORFAR[nivel]] : [...tipos];
}
