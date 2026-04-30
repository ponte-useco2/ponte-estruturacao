/**
 * Webhook do Asaas — recebe eventos de pagamento.
 *
 * Configuração no painel Asaas:
 *   Integrações → Webhooks → Adicionar
 *     URL: https://ponteprojetos.com.br/api/webhooks/asaas
 *     Token: (definir um valor aleatório e colocar em ASAAS_WEBHOOK_TOKEN)
 *     Eventos: marcar PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE,
 *              PAYMENT_REFUNDED
 *
 * Importante: o Asaas envia o token no header `asaas-access-token`. Esse
 * header é a única forma de validar que a requisição vem do Asaas — se
 * não bater, retornamos 401 sem processar.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

interface AsaasWebhookPayload {
  event: string;
  payment: {
    id: string;
    customer: string;
    value: number;
    netValue: number;
    status: string;
    billingType: string;
    dueDate: string;
    paymentDate?: string;
    invoiceNumber: string;
    externalReference: string | null;
    description: string | null;
  };
}

export async function POST(req: NextRequest) {
  // 1. Valida origem (token no header)
  const receivedToken = req.headers.get("asaas-access-token");

  if (WEBHOOK_TOKEN && receivedToken !== WEBHOOK_TOKEN) {
    console.warn("[webhook/asaas] token inválido:", receivedToken);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse do body
  let payload: AsaasWebhookPayload;
  try {
    payload = await req.json();
  } catch (err) {
    console.error("[webhook/asaas] body inválido:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.event || !payload?.payment) {
    return NextResponse.json(
      { error: "Missing event or payment" },
      { status: 400 }
    );
  }

  console.log("[webhook/asaas]", payload.event, payload.payment.id);

  // 3. Mapeia evento → status humano
  const novoStatus = mapEventToStatus(payload.event);
  if (!novoStatus) {
    // Evento que não nos interessa — ignora silenciosamente
    return NextResponse.json({ received: true });
  }

  // 4. Atualiza o lead correspondente no Supabase
  // O Payment ID está em `demanda_resumo` quando criamos a cobrança
  // (formato: "Asaas Payment ID: pay_xxxxxxxx")
  const supabase = createServerSupabaseClient();

  const { data: leads, error: searchError } = await supabase
    .from("leads")
    .select("id, demanda_resumo, estagio_proj")
    .like("demanda_resumo", `%${payload.payment.id}%`)
    .limit(1);

  if (searchError) {
    console.error("[webhook/asaas] erro ao buscar lead:", searchError);
    // Retornamos 200 mesmo assim pra não causar retry infinito do Asaas
    return NextResponse.json({ received: true, error: "lookup_failed" });
  }

  if (!leads || leads.length === 0) {
    console.warn(
      "[webhook/asaas] lead não encontrado para payment:",
      payload.payment.id
    );
    return NextResponse.json({ received: true, error: "lead_not_found" });
  }

  const lead = leads[0];

  // Anexa info de status à demanda_resumo (mantém histórico)
  const novaDemanda = `${lead.demanda_resumo} | [${new Date().toISOString().slice(0, 16)}] ${
    payload.event
  } → ${novoStatus}`;

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      estagio_proj: novoStatus,
      demanda_resumo: novaDemanda,
    })
    .eq("id", lead.id);

  if (updateError) {
    console.error("[webhook/asaas] erro ao atualizar lead:", updateError);
    return NextResponse.json({ received: true, error: "update_failed" });
  }

  return NextResponse.json({
    received: true,
    leadId: lead.id,
    novoStatus,
  });
}

/** Mapeia o evento Asaas para um status legível. */
function mapEventToStatus(event: string): string | null {
  switch (event) {
    case "PAYMENT_CONFIRMED":
      return "Pagamento confirmado";
    case "PAYMENT_RECEIVED":
      return "Pagamento recebido";
    case "PAYMENT_OVERDUE":
      return "Pagamento vencido";
    case "PAYMENT_REFUNDED":
      return "Pagamento estornado";
    case "PAYMENT_REFUND_REQUESTED":
      return "Estorno solicitado";
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_CHARGEBACK_DISPUTE":
      return "Chargeback em disputa";
    case "PAYMENT_AWAITING_CHARGEBACK_REVERSAL":
      return "Aguardando reversão chargeback";
    case "PAYMENT_DUNNING_RECEIVED":
      return "Recuperação recebida";
    default:
      return null;
  }
}

// O Asaas pode disparar GET pra verificar saúde do endpoint
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "asaas-webhook",
    timestamp: new Date().toISOString(),
  });
}
