/**
 * O dia de um carimbo no fuso de Brasília (A4x, onda 4 de UX, 08/10/2026). Função pura, sem banco e sem relógio.
 *
 * O `dado_ate` das execuções (painel, Pix, radar, TCE-PB) e os `coletado_em`/`criado_em` são `timestamptz`: chegam do
 * banco como "2026-10-08T01:34:18+00:00". Cortar com `slice(0, 10)` dá o dia em UTC: o arquivo do Transferegov de
 * 07/10, 22h34 em Brasília, aparecia como 08/10. As colunas `date` (`referencia`, `dt_assinatura`, os prazos) chegam
 * como "AAAA-MM-DD" e passam direto, sem conversão.
 *
 * `diaBrasilia` nasceu no laudo (`laudo.ts`, que continua a exportá-lo) e mudou para cá sem mudar o comportamento,
 * para as páginas usarem a mesma regra sem importar o laudo inteiro.
 */
import { formatarData } from "./central.ts";

const DATA_PURA = /^\d{4}-\d{2}-\d{2}$/;

/** "AAAA-MM-DD" em hora de Brasília. Data pura passa direto; instante é convertido (UTC−3, sem verão). */
export function diaBrasilia(iso: string): string {
  if (DATA_PURA.test(iso)) return iso;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return new Date(t - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * "DD/MM/AAAA" do dia em Brasília, para a data do dado na tela ("Transferegov até", "dado até", "lidas em"). Vazio ou
 * texto que não é data: `vazio` ("—"), em vez de repetir o texto cru.
 */
export function dataBrasilia(iso: string | null | undefined, vazio = "—"): string {
  if (!iso) return vazio;
  const dia = diaBrasilia(iso);
  return DATA_PURA.test(dia) ? formatarData(dia) : vazio;
}
