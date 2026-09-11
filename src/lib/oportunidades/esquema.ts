/**
 * Distingue "a central ainda não foi ativada no banco" de "algo quebrou".
 *
 * Enquanto as migrations não forem aplicadas, tabela e função simplesmente não
 * existem. Isso é estado esperado e merece tela própria, com o que falta fazer —
 * não um erro genérico, que ensinaria a ignorar erro.
 *
 *   PGRST205  o PostgREST não conhece a tabela
 *   PGRST202  o PostgREST não conhece a função
 *   42P01     o Postgres não encontra a tabela
 *   42883     o Postgres não encontra a função
 */
const AUSENTE = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);

export function ehEsquemaAusente(codigo: string | undefined | null): boolean {
  return Boolean(codigo && AUSENTE.has(codigo));
}
