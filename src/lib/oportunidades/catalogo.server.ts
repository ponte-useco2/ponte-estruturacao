/**
 * Leitura do catálogo de oportunidades — o caminho do arquivo existe AQUI, e só aqui.
 *
 * Havia cópias deste caminho espalhadas pelas superfícies. Em 02/09/2026 o
 * arquivo saiu de `public/dados` para `src/dados`, para não ficar baixável sem
 * login; uma cópia foi atualizada e a do app logado não. O Descobrir passou a
 * mostrar "dados indisponíveis" em silêncio, porque arquivo ausente virava
 * `null` sem deixar rastro.
 *
 * Só pode ser importado por código de servidor: `node:fs` quebra o bundle do
 * cliente se vazar.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { versaoSuportada, type Payload } from "./contrato";

export const CAMINHO_CATALOGO = path.join("src", "dados", "oportunidades.json");

export async function lerCatalogo(): Promise<Payload | null> {
  try {
    const bruto = await fs.readFile(path.join(process.cwd(), CAMINHO_CATALOGO), "utf-8");
    const payload = JSON.parse(bruto) as Payload;
    if (!versaoSuportada(payload.versao)) {
      console.error("lerCatalogo: versão de contrato não suportada:", payload.versao);
      return null;
    }
    return payload;
  } catch (e) {
    // Continua devolvendo null — cada tela tem estado próprio para isso —, mas
    // agora deixa rastro. Foi a falta dele que escondeu o caminho quebrado.
    console.error("lerCatalogo:", e instanceof Error ? e.message : e);
    return null;
  }
}
