/**
 * Endpoint cron para enviar emails pendentes do Centelha 3 PB.
 *
 * Roda periodicamente (sugestão: a cada 10 min via cron-job.org). Busca
 * leads do Centelha que tenham `email_pos_form_send_at <= now()` e
 * `email_pos_form_sent_at IS NULL`, envia o email e marca como enviado.
 *
 * Configuração no cron-job.org:
 *   URL: https://ponteprojetos.com.br/api/cron/send-pending-emails
 *   Header: Authorization: Bearer <CRON_SECRET>
 *   Schedule: a cada 10 minutos (ex: a cada 10 minutos)
 *
 * Variável de ambiente:
 *   CRON_SECRET — qualquer string aleatória longa (NÃO confundir com
 *                 ASAAS_WEBHOOK_TOKEN). Cole aqui e no cron-job.org.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderCentelhaPosFormularioEmail } from "@/lib/email-templates/centelha-pos-formulario";
import { centelhaEdital } from "@/config/centelha-edital";

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_BATCH_SIZE = 20; // Processar no máximo 20 emails por execução

interface PendingLead {
  id: string;
  nome: string;
  email: string;
  organizacao: string | null;
  estagio_proj: string | null;
  demanda_resumo: string | null;
}

export async function POST(req: NextRequest) {
  return handleCronRequest(req);
}

// Permitir GET também — alguns cron services preferem GET
export async function GET(req: NextRequest) {
  return handleCronRequest(req);
}

async function handleCronRequest(req: NextRequest) {
  // 1. Validar autenticação
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${CRON_SECRET}`;
    if (authHeader !== expected) {
      console.warn("[cron/send-emails] auth inválida:", authHeader);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServerSupabaseClient();
  const startedAt = new Date().toISOString();

  // 2. Busca leads prontos pra envio
  const { data: pendingRows, error: fetchError } = await supabase
    .from("leads")
    .select("id, nome, email, organizacao, estagio_proj, demanda_resumo")
    .eq("tipo_org", centelhaEdital.edition.label)
    .lte("email_pos_form_send_at", startedAt)
    .is("email_pos_form_sent_at", null)
    .limit(MAX_BATCH_SIZE);

  if (fetchError) {
    console.error("[cron/send-emails] erro ao buscar pendentes:", fetchError);
    return NextResponse.json(
      { error: "fetch_failed", details: fetchError.message },
      { status: 500 }
    );
  }

  const pending: PendingLead[] = pendingRows ?? [];

  if (pending.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "Nenhum email pendente.",
      sent: 0,
      failed: 0,
    });
  }

  // 3. Envia emails em paralelo
  const results = await Promise.allSettled(
    pending.map(async (lead) => {
      if (!lead.email) {
        throw new Error(`Lead ${lead.id} sem email`);
      }

      // Extrai infos do demanda_resumo pra personalizar
      const projeto =
        extractField(lead.demanda_resumo, "Projeto") ||
        lead.organizacao ||
        null;
      const area = extractField(lead.demanda_resumo, "Área");
      // Tracking de afiliado — propaga ref pro link do checkout no email
      const ref = extractField(lead.demanda_resumo, "Ref");

      const { subject, html, text } = renderCentelhaPosFormularioEmail({
        nome: lead.nome,
        nomeProjeto: projeto,
        area,
        estagio: lead.estagio_proj,
        cupom: "WS",
        ref,
      });

      const sendResult = await sendEmail({
        to: lead.email,
        subject,
        html,
        text,
        fromName: "Equipe Ponte Projetos",
      });

      if (!sendResult.success) {
        throw new Error(sendResult.error || "Falha desconhecida ao enviar");
      }

      // 4. Marca lead como enviado
      const { error: updateError } = await supabase
        .from("leads")
        .update({ email_pos_form_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      if (updateError) {
        console.error(
          `[cron/send-emails] enviado mas falhou ao marcar ${lead.id}:`,
          updateError
        );
        // Não joga erro — email já foi enviado, é só falha de bookkeeping
      }

      return { id: lead.id, email: lead.email, messageId: sendResult.messageId };
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  // Log das falhas pra inspeção
  results.forEach((r, idx) => {
    if (r.status === "rejected") {
      console.error(
        `[cron/send-emails] falhou lead ${pending[idx].id}:`,
        r.reason
      );
    }
  });

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    total: pending.length,
  });
}

/** Extrai um campo do demanda_resumo no formato "Campo: valor | Outro: ..." */
function extractField(
  resumo: string | null,
  field: string
): string | null {
  if (!resumo) return null;
  // Match: "Field: value" until next " | " ou fim da string
  const re = new RegExp(`${field}:\\s*([^|]+?)(?:\\s*\\||$)`, "i");
  const m = resumo.match(re);
  return m ? m[1].trim() : null;
}
