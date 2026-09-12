/**
 * Temas do radar, com rótulo legível.
 *
 * O radar marca cada janela com os RADICAIS que casaram no nome do programa e
 * do órgão (`TEMAS_PADRAO`, em `radar/scripts/radar.py`): fragmentos como
 * `inovaç`, `socioassist`, `fundiári`. São dado interno — ninguém escolhe
 * "inovaç" numa tela. Aqui cada assunto vira um id estável, um rótulo em
 * português e a lista de radicais que o representam.
 *
 * O id é o que fica gravado na preferência de cada pessoa. Ele é estável de
 * propósito: se o radar trocar um radical, muda a lista aqui e nada do que já
 * foi escolhido se perde.
 *
 * Cobertura, no catálogo de 11/09/2026: 40 das 150 janelas tinham algum tema.
 * É por isso que a preferência não é só por tema — órgão e natureza também
 * contam, e esses cobrem o catálogo inteiro.
 */

export interface Tema {
  id: string;
  rotulo: string;
  /** Radicais do radar, em minúsculas, como chegam no contrato. */
  radicais: string[];
}

export const TEMAS: Tema[] = [
  { id: "regularizacao_fundiaria", rotulo: "Regularização fundiária", radicais: ["fundiári", "fundiari", "regulariza"] },
  { id: "habitacao", rotulo: "Habitação e moradia", radicais: ["habitaç", "habitac", "moradia"] },
  { id: "athis", rotulo: "ATHIS", radicais: ["athis"] },
  { id: "urbanizacao", rotulo: "Urbanização", radicais: ["urbaniz"] },
  {
    id: "assistencia_social",
    rotulo: "Assistência social",
    radicais: ["assistência social", "assistencia social", "socioassist", "suas"],
  },
  { id: "cultura", rotulo: "Cultura e patrimônio", radicais: ["cultura", "patrimônio", "patrimonio"] },
  { id: "inovacao", rotulo: "Inovação", radicais: ["inovaç", "inovac"] },
  { id: "tecnologia", rotulo: "Tecnologia", radicais: ["tecnologia"] },
  { id: "saneamento", rotulo: "Saneamento", radicais: ["saneamento"] },
  { id: "turismo", rotulo: "Turismo", radicais: ["turismo"] },
  { id: "desenvolvimento_regional", rotulo: "Desenvolvimento regional", radicais: ["desenvolvimento regional"] },
  { id: "economia_solidaria", rotulo: "Economia solidária", radicais: ["economia solidária", "economia solidaria"] },
];

const POR_RADICAL = new Map<string, string>(
  TEMAS.flatMap((t) => t.radicais.map((r) => [r.toLowerCase(), t.id] as [string, string])),
);

export const ROTULO_TEMA: Record<string, string> = Object.fromEntries(TEMAS.map((t) => [t.id, t.rotulo]));

export function ehTemaConhecido(id: string): boolean {
  return Object.hasOwn(ROTULO_TEMA, id);
}

/**
 * Radicais do contrato → ids de tema, sem repetição e na ordem de `TEMAS`.
 *
 * Radical desconhecido é ignorado, e não vira id novo: a lista que a pessoa vê
 * é fechada, e um radical solto na tela seria vazamento de dado interno. O
 * teste de cobertura falha se o radar ganhar um radical que este arquivo não
 * conhece.
 */
export function temasDaJanela(radicais: string[] | undefined): string[] {
  if (!radicais?.length) return [];
  const ids = new Set<string>();
  for (const r of radicais) {
    const id = POR_RADICAL.get(r.trim().toLowerCase());
    if (id) ids.add(id);
  }
  return TEMAS.filter((t) => ids.has(t.id)).map((t) => t.id);
}

/** Radicais que nenhum tema conhece. Usado pelo teste de cobertura. */
export function radicaisDesconhecidos(radicais: string[]): string[] {
  return radicais.filter((r) => !POR_RADICAL.has(r.trim().toLowerCase()));
}
