/**
 * Qual aba do Mapa fica acesa para um caminho. Função pura, fora do componente, para ter teste.
 *
 * As páginas abertas a partir da busca (instrumento, proposta, município) acendem a Busca. O laudo mora
 * debaixo de /mapa/instrumento e, desde a onda 12, vale para qualquer instrumento: acende a Busca, a não
 * ser que se chegue a ele pela lista das suspensivas — os links de lá levam `?de=suspensivas`, e aí
 * acende a aba Suspensivas.
 */

/** Uma rota que só conta quando se chega a ela vindo de uma origem (`?de=<origem>`). */
export interface PelaOrigem {
  rota: RegExp;
  de: string;
}

type Casamento = string | RegExp | PelaOrigem;

export interface RegraAba {
  href: string;
  /** Só o caminho exato: "/mapa" não pode casar como prefixo de "/mapa/avisos". */
  exata: boolean;
  /** Outras rotas que acendem esta aba. Texto é prefixo. */
  tambem?: readonly Casamento[];
  /** Rotas que, mesmo casando, não acendem esta aba. */
  exceto?: readonly Casamento[];
}

export const ROTA_LAUDO = /^\/mapa\/instrumento\/[^/]+\/laudo(?:\/|$)/;
export const ORIGEM_SUSPENSIVAS = "suspensivas";
export const LAUDO_PELAS_SUSPENSIVAS: PelaOrigem = { rota: ROTA_LAUDO, de: ORIGEM_SUSPENSIVAS };

function casa(c: Casamento, caminho: string, de: string | null): boolean {
  if (typeof c === "string") return caminho.startsWith(c);
  if (c instanceof RegExp) return c.test(caminho);
  return c.de === de && c.rota.test(caminho);
}

/** `de`: o parâmetro `de` da URL, quando houver. */
export function abaAtiva(aba: RegraAba, caminho: string, de: string | null = null): boolean {
  if (aba.exata) return caminho === aba.href;
  if ((aba.exceto ?? []).some((c) => casa(c, caminho, de))) return false;
  return caminho.startsWith(aba.href) || (aba.tambem ?? []).some((c) => casa(c, caminho, de));
}
