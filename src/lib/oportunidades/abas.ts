/**
 * Qual aba do Mapa fica acesa para um caminho. Função pura, fora do componente, para ter teste.
 *
 * As páginas abertas a partir da busca (instrumento, proposta, município) acendem a Busca; o laudo
 * da suspensiva mora debaixo de /mapa/instrumento mas se chega a ele pela lista das suspensivas,
 * então acende a aba Suspensivas e não a Busca.
 */

export interface RegraAba {
  href: string;
  /** Só o caminho exato: "/mapa" não pode casar como prefixo de "/mapa/avisos". */
  exata: boolean;
  /** Outras rotas que acendem esta aba. */
  tambem?: readonly (string | RegExp)[];
  /** Rotas que, mesmo casando, não acendem esta aba. */
  exceto?: readonly RegExp[];
}

export const ROTA_LAUDO = /^\/mapa\/instrumento\/[^/]+\/laudo(?:\/|$)/;

export function abaAtiva(aba: RegraAba, caminho: string): boolean {
  if (aba.exata) return caminho === aba.href;
  if ((aba.exceto ?? []).some((r) => r.test(caminho))) return false;
  return caminho.startsWith(aba.href) || (aba.tambem ?? []).some((p) => (typeof p === "string" ? caminho.startsWith(p) : p.test(caminho)));
}
