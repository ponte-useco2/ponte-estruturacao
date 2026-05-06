/**
 * Constantes do funil PARCERIA ROREE (Centelha 3 PB).
 *
 * Separadas da server action porque arquivos "use server" só podem
 * exportar async functions — constantes/tipos viram undefined no client.
 */

export type FaseRoree = 1 | 2;

export const VALOR_FASE_ROREE: Record<FaseRoree, number> = {
  1: 50000, // R$ 500,00 em centavos
  2: 100000, // R$ 1.000,00 em centavos
};

export const LABEL_FASE_ROREE: Record<FaseRoree, string> = {
  1: "Fase 1 — Diagnóstico Estratégico",
  2: "Fase 2 — Estruturação Técnica",
};

export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
