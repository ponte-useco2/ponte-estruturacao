/** Áreas em que a consulta da URL pode trazer o que a pessoa digitou (termo, nome, CPF). */
const AREAS_DE_DADO = ["/mapa", "/oportunidades"];

/** A URL sem `?…` e sem `#…` quando o caminho é do Mapa ou da área de oportunidades; nas demais, intacta. */
export function semConsultaNasAreasDeDado(url: string): string {
  let caminho: string;
  try {
    caminho = new URL(url, "https://exemplo.invalid").pathname;
  } catch {
    return url;
  }
  const naArea = AREAS_DE_DADO.some((a) => caminho === a || caminho.startsWith(`${a}/`));
  if (!naArea) return url;
  return url.replace(/[?#].*$/, "");
}
