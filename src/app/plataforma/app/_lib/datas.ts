/**
 * Helpers de data compartilhados por telas de servidor e de cliente.
 *
 * Parse manual de YYYY-MM-DD de propósito: `new Date("2026-09-03")` é
 * interpretado como UTC e, em fuso negativo, volta um dia. Mesma decisão do
 * painel público de oportunidades.
 */

export function parseISODate(iso: string): { d: number; m: number; y: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
}

export function formatBR(iso: string): string {
  const p = parseISODate(iso);
  if (!p) return iso;
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

export function formatISOTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}h${m[5]}`;
}

/** "11 dias" / "1 dia" / "encerra hoje". Só formata — não recalcula o valor. */
export function rotuloDias(dias: number): string {
  if (dias <= 0) return "encerra hoje";
  if (dias === 1) return "1 dia";
  return `${dias} dias`;
}

/** Segundos → m:ss, para o gravador e para a duração dos áudios. */
export function duracaoMMSS(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
