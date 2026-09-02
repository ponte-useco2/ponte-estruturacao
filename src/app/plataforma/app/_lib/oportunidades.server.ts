/**
 * Leitura do único dado real do app. Só pode ser importado por Server
 * Component — o `node:fs` abaixo quebra o bundle do cliente se vazar.
 *
 * Fronteira do Contrato de Dados v1.0: o site lê `public/dados/oportunidades.json`
 * já publicado pelo pipeline. Nada aqui fala com o Transferegov, nem recalcula
 * `urgente`, `nova`, `aderente` ou `dias_restantes`.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { CONTRATO_MAJOR, type PayloadOportunidades } from "./tipos";

export async function lerOportunidades(): Promise<PayloadOportunidades | null> {
  try {
    const arquivo = path.join(process.cwd(), "public", "dados", "oportunidades.json");
    const bruto = await fs.readFile(arquivo, "utf-8");
    const d = JSON.parse(bruto) as PayloadOportunidades;
    const [major] = String(d.versao ?? "").split(".");
    if (parseInt(major, 10) !== CONTRATO_MAJOR) return null;
    return d;
  } catch {
    return null;
  }
}
