import fs from "node:fs/promises";
import path from "node:path";
import type { Payload } from "./OportunidadesClient";

/**
 * Leitura do payload do painel.
 *
 * O arquivo saiu de `public/dados/` para `src/dados/`.
 *
 * Em `public/`, o Next serve o arquivo como estático em
 * `/dados/oportunidades.json` — qualquer pessoa, sem login, baixaria o
 * conteúdo inteiro do painel por esse endereço. Fechar a página e deixar o
 * dado aberto ao lado dela seria encenação de controle de acesso.
 *
 * RESSALVA HONESTA: isto fecha o NOSSO painel, não o dado. O JSON continua
 * público no repositório de origem (jn-portal-oportunidades) e a fonte
 * primária é o Transferegov, que é dado aberto por lei. O que se protege aqui
 * é o trabalho de curadoria — o recorte, a classificação de aderência, a
 * leitura de concorrência —, não a informação bruta.
 *
 * A fronteira do contrato de dados continua respeitada: nenhum contato com o
 * Transferegov, apenas leitura de um JSON já publicado pelo pipeline.
 */
export async function lerPayload(): Promise<Payload | null> {
  try {
    const arquivo = path.join(process.cwd(), "src", "dados", "oportunidades.json");
    const bruto = await fs.readFile(arquivo, "utf-8");
    const d = JSON.parse(bruto) as Payload;
    // Contrato: major diferente = incompatível. Devolve null e o client avisa.
    const [major] = String(d.versao ?? "").split(".");
    if (parseInt(major, 10) !== 1) return null;
    return d;
  } catch {
    return null;
  }
}
