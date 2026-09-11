/**
 * Leitura do único dado real do app. Só pode ser importado por Server
 * Component — o `node:fs` por trás quebra o bundle do cliente se vazar.
 *
 * Fronteira do Contrato de Dados v1.0: o app lê o catálogo já publicado pelo
 * pipeline. Nada aqui fala com o Transferegov, nem recalcula `urgente`, `nova`,
 * `aderente` ou `dias_restantes`.
 *
 * O caminho do arquivo mora em `lib/oportunidades/catalogo.server.ts`, e só lá.
 * Este leitor tinha a própria cópia, que ficou para trás quando o arquivo saiu
 * de `public/dados` em 02/09/2026 — e o Descobrir passou a mostrar "dados
 * indisponíveis" em silêncio desde então.
 */

import { lerCatalogo } from "@/lib/oportunidades/catalogo.server";
import type { PayloadOportunidades } from "./tipos";

export async function lerOportunidades(): Promise<PayloadOportunidades | null> {
  return lerCatalogo();
}
