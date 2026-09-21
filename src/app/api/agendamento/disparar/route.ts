import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispararWorkflows } from "@/lib/oportunidades/agendamento";

export const dynamic = "force-dynamic";

/** Comparação em tempo constante: o tempo de resposta não pode vazar o segredo. */
function autorizado(cabecalho: string | null, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho ?? "");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/**
 * Dispara o painel fiscal e o radar de propostas (com o painel de execução e o resumo diário).
 *
 * Chamada uma vez por dia pelo Vercel Cron (`vercel.json`), que envia
 * `Authorization: Bearer <CRON_SECRET>`. O porquê está em `lib/oportunidades/agendamento.ts`.
 *
 * Sem `CRON_SECRET` a rota fecha; sem `GITHUB_DISPARO_TOKEN` responde 503 e não dispara nada —
 * o `schedule` do GitHub segue como reserva.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !autorizado(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const token = process.env.GITHUB_DISPARO_TOKEN;
  if (!token) {
    console.error("agendamento: GITHUB_DISPARO_TOKEN não configurado; nada disparado.");
    return NextResponse.json({ erro: "GITHUB_DISPARO_TOKEN não configurado." }, { status: 503 });
  }

  const resultados = await dispararWorkflows(token);
  const falhou = resultados.some((r) => !r.ok);
  if (falhou) console.error("agendamento:", JSON.stringify(resultados));
  return NextResponse.json({ resultados }, { status: falhou ? 502 : 200 });
}
