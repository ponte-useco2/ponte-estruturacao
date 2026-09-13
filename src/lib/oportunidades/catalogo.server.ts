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
import { comoPayloadV2, type PayloadV2 } from "./contrato-v2";

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

// ============================ CATÁLOGO V2 ============================

export const CAMINHO_CATALOGO_V2 = path.join("src", "dados", "oportunidades-v2.json");

/**
 * Por que o resultado distingue AUSENTE de INVÁLIDO, em vez de só devolver null:
 *
 * O v2 começa a existir no repositório publicado quando a Action roda pela
 * primeira vez depois do espelho. Até lá, o arquivo simplesmente não está lá, e
 * isso é estado esperado — a tela diz "ainda não publicado". Arquivo presente
 * mas quebrado é outra coisa: a Action valida antes de aceitar, então chegar
 * aqui quebrado é defeito, e a tela diz "indisponível".
 *
 * O v1.1 aprendeu em 02/09/2026 que `null` sem rastro esconde caminho errado por
 * semanas. Por isso os dois casos deixam log — com peso diferente.
 *
 * O caminho repete o padrão de `lerCatalogo` DE PROPÓSITO: é o que o rastreador
 * de arquivos do Next reconhece para incluir o JSON no bundle da função
 * (conferido em `.next/server/app/mapa/page.js.nft.json` em 12/09/2026).
 */
export type LeituraCatalogoV2 =
  | { estado: "ok"; payload: PayloadV2 }
  | { estado: "ausente" }
  | { estado: "invalido" };

export async function lerCatalogoV2(): Promise<LeituraCatalogoV2> {
  let bruto: string;
  try {
    bruto = await fs.readFile(path.join(process.cwd(), CAMINHO_CATALOGO_V2), "utf-8");
  } catch (e) {
    const codigo = (e as NodeJS.ErrnoException)?.code;
    if (codigo === "ENOENT") {
      console.warn("lerCatalogoV2: arquivo ainda não publicado em", CAMINHO_CATALOGO_V2);
      return { estado: "ausente" };
    }
    console.error("lerCatalogoV2:", e instanceof Error ? e.message : e);
    return { estado: "invalido" };
  }

  try {
    const payload = comoPayloadV2(JSON.parse(bruto));
    if (!payload) {
      console.error("lerCatalogoV2: arquivo presente, mas fora do contrato v2");
      return { estado: "invalido" };
    }
    return { estado: "ok", payload };
  } catch (e) {
    console.error("lerCatalogoV2: JSON ilegível:", e instanceof Error ? e.message : e);
    return { estado: "invalido" };
  }
}
