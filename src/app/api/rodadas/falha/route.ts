import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { lerFalhaRodada, montarAlertaFalha } from "@/lib/oportunidades/alerta-rodadas";
import { dataHoraBrasilia } from "@/lib/oportunidades/rodadas";
import { administradores } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Comparação em tempo constante, como em /api/painel/resumo-diario. */
function autorizado(cabecalho: string | null, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho ?? "");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

const resposta = (corpo: Record<string, unknown>, status = 200) => NextResponse.json(corpo, { status });

/**
 * O aviso de rodada com falha (A4-01 da investigação do portal, 29/10/2026). Chamada pelo último passo dos workflows
 * agendados, só quando um passo anterior falhou (`.github/actions/avisar-falha`), com
 * `Authorization: Bearer <PAINEL_RESUMO_SECRET>` — o mesmo segredo do resumo diário, que já está no GitHub e na Vercel.
 * O corpo é conferido (`lerFalhaRodada`): nome curto e link de execução do monorepo, e nada mais entra no e-mail.
 */
export async function POST(request: Request) {
  const segredo = process.env.PAINEL_RESUMO_SECRET;
  if (!segredo || !autorizado(request.headers.get("authorization"), segredo)) {
    return resposta({ erro: "Não autorizado." }, 401);
  }
  const falha = lerFalhaRodada(await request.json().catch(() => null));
  if (!falha) return resposta({ erro: "Corpo inválido." }, 400);
  const admins = administradores();
  if (admins.length === 0) return resposta({ erro: "OPORTUNIDADES_ADMINS vazio." }, 500);

  const urlBase = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br").replace(/\/+$/, "");
  const email = montarAlertaFalha(falha, dataHoraBrasilia(new Date().toISOString()), urlBase);
  const envio = await sendEmail({ to: admins.join(", "), subject: email.assunto, html: email.html, text: email.texto, fromName: "Painel da PONTE" });
  if (!envio.success) return resposta({ erro: envio.error ?? "Falha no envio." }, 502);
  return resposta({ status: "enviado", destinatarios: admins.length });
}
