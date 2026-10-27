/**
 * O relatório completo ou parcial (onda 16, M4, 27/10/2026): em todo relatório do Mapa (Brasil, UF, município,
 * entidade e o laudo do instrumento), quem lê escolhe as seções que entram, e o papel sai só com elas. A escolha fica no
 * endereço (`?secoes=rel-convenios,rel-fornecedores`): o link do relatório parcial pode ser enviado a alguém. Sem o
 * parâmetro, ou com nada que valha, o relatório é o completo. Puro, com teste (`relatorio-parcial.test.ts`).
 */

export const PARAMETRO_SECOES = "secoes";

/** As seções escolhidas, a partir do valor do parâmetro: só as que existem nesta página; nenhuma válida = todas. */
export function lerSecoes(valor: string | null | undefined, todas: readonly string[]): Set<string> {
  const pedidas = new Set(
    (valor ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
  const validas = todas.filter((id) => pedidas.has(id));
  return new Set(validas.length ? validas : todas);
}

/** O valor do parâmetro para gravar no endereço: `null` quando é o completo (todas), para o link ficar limpo. */
export function gravarSecoes(escolhidas: ReadonlySet<string>, todas: readonly string[]): string | null {
  const naOrdem = todas.filter((id) => escolhidas.has(id));
  if (naOrdem.length === 0 || naOrdem.length === todas.length) return null;
  return naOrdem.join(",");
}

/** O nome do relatório como ele vai sair: "Relatório completo" ou "Relatório parcial · 4 de 9 seções". */
export function nomeDoRelatorio(escolhidas: number, total: number): string {
  if (total <= 0 || escolhidas >= total || escolhidas <= 0) return "Relatório completo";
  return `Relatório parcial · ${escolhidas} de ${total} ${total === 1 ? "seção" : "seções"}`;
}

/** O endereço de agora com as seções escolhidas (ou sem o parâmetro, no completo), preservando o resto. */
export function enderecoComSecoes(atual: string, valor: string | null): string {
  const [semAncora, ancora = ""] = atual.split("#", 2);
  const [caminho, busca = ""] = semAncora.split("?", 2);
  const p = new URLSearchParams(busca);
  if (valor) p.set(PARAMETRO_SECOES, valor);
  else p.delete(PARAMETRO_SECOES);
  const q = p.toString();
  return `${caminho}${q ? `?${q}` : ""}${ancora ? `#${ancora}` : ""}`;
}
