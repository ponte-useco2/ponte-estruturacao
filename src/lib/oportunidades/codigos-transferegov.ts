/**
 * O código do programa do Transferegov, que o catálogo v2 não traz.
 *
 * O Transferegov não tem endereço por programa (ver `transferegov.ts`): quem quer
 * ver a janela abre a consulta pública e digita o código. O cartão das Janelas
 * mostrava só o nome, e a pessoa ficava sem o que digitar (relato do titular em
 * 14/09/2026). O v2 descarta os códigos; o v1.1, gerado pelo MESMO radar na
 * MESMA execução e baixado pelo MESMO commit da Action, tem. Então o código vem
 * do v1, casado pela identidade da janela.
 *
 * O casamento aceita as duas identidades que o `external_id` do v2 já teve:
 *
 * - até o PR `feat/canal-da-janela` do radar: `{id do v1}-{canal}`, em que o id
 *   do v1 é sha1(programa | órgão | natureza | canal | fecha);
 * - depois dele: `{sha1(canal | natureza | códigos)}-{canal}` — a `chaveJanela`
 *   do `diff.ts` passada por sha1 e cortada em 12, exatamente como
 *   `identidade_janela` em `funding_intelligence/adapters/transferegov.py`.
 *
 * Indexar pelas duas evita que o código suma do cartão no dia em que o PR do
 * radar entrar. As duas são hexadecimais de 12 dígitos sem hífen, por isso o
 * prefixo do `external_id` até o primeiro hífen é a chave.
 *
 * Só servidor: `node:crypto`.
 */
import { createHash } from "node:crypto";
import type { Oportunidade, Payload } from "./contrato.ts";
import type { PayloadV2 } from "./contrato-v2.ts";
import { chaveJanela } from "./diff.ts";

/** A identidade que o radar dá à janela no v2 a partir do contrato 2.1. */
export function identidadeJanela(o: Pick<Oportunidade, "canal" | "natureza" | "codigos">): string {
  return createHash("sha1").update(chaveJanela(o), "utf8").digest("hex").slice(0, 12);
}

/** Id da oportunidade v2 → códigos do programa. Só entra quem tem código. */
export function codigosPorJanela(
  v2: Pick<PayloadV2, "opportunities">,
  v1: Pick<Payload, "oportunidades">,
): Map<string, string[]> {
  const porIdentidade = new Map<string, string[]>();
  for (const o of v1.oportunidades) {
    if (o.codigos.length === 0) continue;
    porIdentidade.set(o.id, o.codigos);
    porIdentidade.set(identidadeJanela(o), o.codigos);
  }

  const resultado = new Map<string, string[]>();
  for (const o of v2.opportunities) {
    if (o.source.id !== "transferegov" || !o.external_id) continue;
    const codigos = porIdentidade.get(o.external_id.split("-")[0]);
    if (codigos) resultado.set(o.id, codigos);
  }
  return resultado;
}
