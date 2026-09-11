import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sincronizarCentral } from "@/lib/oportunidades/sincronizar.server";

export const dynamic = "force-dynamic";

/** Comparação em tempo constante: o tempo de resposta não pode vazar o segredo. */
function autorizado(cabecalho: string | null, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho ?? "");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/**
 * Sincroniza a central de notificações com a publicação atual do catálogo.
 *
 * Chamada uma vez por dia pelo Vercel Cron, que envia
 * `Authorization: Bearer <CRON_SECRET>`. É a rede de segurança: a própria aba
 * também sincroniza quando alguém a abre com publicação nova pendente.
 *
 * Sem `CRON_SECRET` configurado a rota fecha. Nunca abre por omissão.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !autorizado(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const resultado = await sincronizarCentral();
  return NextResponse.json(resultado, { status: resultado.status === "erro" ? 500 : 200 });
}
