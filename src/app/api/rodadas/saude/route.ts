import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { montarSaudeDiaria } from "@/lib/oportunidades/alerta-rodadas";
import { diaBrasilia } from "@/lib/oportunidades/datas";
import { escolherRodadas, type BlocoRodadas } from "@/lib/oportunidades/resumo-diario";
import { lerRodadas } from "@/lib/oportunidades/rodadas.server";
import { administradores, authConfigurada } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Teto da leitura das rodadas, o mesmo do resumo diário. */
const LIMITE_RODADAS_MS = 12_000;

function autorizado(cabecalho: string | null, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho ?? "");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** A leitura das rodadas, que nunca rejeita: erro e demora viram "falhou", e o e-mail sai dizendo isso. */
async function bloco(): Promise<BlocoRodadas> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    const limite = new Promise<null>((resolve) => {
      relogio = setTimeout(() => resolve(null), LIMITE_RODADAS_MS);
    });
    const painel = await Promise.race([lerRodadas({ github: false }), limite]);
    return escolherRodadas(painel?.linhas ?? null);
  } catch (e) {
    console.error("rodadas/saude:", e instanceof Error ? e.message : "falha na leitura");
    return { tipo: "falhou" };
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * O e-mail diário da saúde das rodadas (A4-02 da investigação do portal, 29/10/2026), separado do resumo "o que mudou":
 * sai todo dia, em dia ou não, chamado pelo Vercel Cron (`vercel.json`) com `Authorization: Bearer <CRON_SECRET>`.
 * Sem o segredo a rota fecha.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !autorizado(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  if (!authConfigurada()) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 503 });
  const admins = administradores();
  if (admins.length === 0) return NextResponse.json({ erro: "OPORTUNIDADES_ADMINS vazio." }, { status: 500 });

  const b = await bloco();
  const urlBase = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br").replace(/\/+$/, "");
  const dia = diaBrasilia(new Date().toISOString());
  const email = montarSaudeDiaria(b, `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`, urlBase);
  const envio = await sendEmail({ to: admins.join(", "), subject: email.assunto, html: email.html, text: email.texto, fromName: "Painel da PONTE" });
  if (!envio.success) return NextResponse.json({ erro: envio.error ?? "Falha no envio." }, { status: 502 });
  return NextResponse.json({ status: "enviado", rodadas: b.tipo, destinatarios: admins.length });
}
