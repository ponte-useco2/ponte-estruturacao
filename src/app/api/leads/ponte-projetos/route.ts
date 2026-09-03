import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderAdminNotificationEmail } from "@/lib/email-templates/admin-notification";
import { consumir, origemDoPedido } from "@/lib/freio";

/**
 * Endpoint de captação da apresentação PONTE Projetos (/plataforma).
 *
 * Resolve as duas pendências que o relatório de QA v1.3 apontava como
 * impossíveis dentro de um HTML portátil:
 *
 *   1. "configurar endpoint CRM HTTPS" — grava na tabela `leads` do Supabase,
 *      a mesma que atende Centelha e REURB, e notifica a diretoria por email.
 *
 *   2. "um HTML estático não consegue proteger o link do grupo WhatsApp" —
 *      o link não vive mais no front-end. Ele é devolvido por esta rota
 *      APENAS depois que a gravação foi concluída. Quem inspecionar o
 *      código-fonte não encontra o convite.
 *
 * Contrato de resposta:
 *   200 { ok: true, whatsappUrl: "https://chat.whatsapp.com/..." }
 *   400 { ok: false, error: "..." }   payload inválido
 *   500 { ok: false, error: "..." }   falha ao gravar (não devolve o link)
 */

const ADMIN_EMAIL = process.env.EMAIL_USER || "diretoria.ponte.projetos@gmail.com";

// Convite da comunidade. Mora no servidor de propósito — se mudar, troque a
// env var na Vercel sem tocar no HTML.
//
// O default embutido saiu em 03/09/2026. O comentário original desta rota
// dizia que "quem inspecionar o código-fonte não encontra o convite" — mas o
// repositório é público e o link estava aqui, em texto puro. Sem a env var, a
// rota grava o lead e informa que o convite chega por e-mail: melhor do que
// republicar o link a cada deploy.
const WHATSAPP_COMUNIDADE = process.env.PONTE_WHATSAPP_COMUNIDADE || "";

interface LeadPayload {
  name?: string;
  whatsapp?: string;
  email?: string;
  profile?: string;
  interest?: string;
  source?: string;
  marketingOptIn?: boolean;
  timestamp?: string;
}

/** Corta e normaliza. Campo ausente vira string vazia. */
function limpar(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  // Freio: endpoint público que grava no banco e dispara e-mail pela cota
  // compartilhada de 500/dia do Gmail.
  const origemPedido = await origemDoPedido("leads-api");
  if (!consumir(origemPedido, { limite: 5, janelaMs: 10 * 60 * 1000 })) {
    return NextResponse.json(
      { ok: false, error: "Muitos envios em sequência. Aguarde alguns minutos." },
      { status: 429 }
    );
  }

  let body: LeadPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Payload inválido." },
      { status: 400 }
    );
  }

  const nome = limpar(body.name, 120);
  const email = limpar(body.email, 160).toLowerCase();
  const whatsapp = limpar(body.whatsapp, 40);
  const perfil = limpar(body.profile, 80);
  const interesse = limpar(body.interest, 200);
  const origem = limpar(body.source, 80) || "Geral";
  const optIn = body.marketingOptIn === true;

  // Validação mínima — o formulário já valida no cliente, mas o cliente mente.
  if (!nome || nome.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Nome é obrigatório." },
      { status: 400 }
    );
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "E-mail inválido." },
      { status: 400 }
    );
  }
  const digitosWhats = whatsapp.replace(/\D/g, "");
  if (digitosWhats.length < 10 || digitosWhats.length > 13) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp inválido." },
      { status: 400 }
    );
  }

  const demandaConsolidada = [
    "[PONTE-PROJETOS]",
    perfil && `Perfil: ${perfil}`,
    interesse && `Interesse: ${interesse}`,
    `Origem: ${origem}`,
    `Opt-in marketing: ${optIn ? "sim" : "não"}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("leads").insert([
    {
      nome,
      email,
      whatsapp,
      organizacao: perfil || "PONTE Projetos - não informado",
      cidade: "",
      tipo_org: "PONTE Projetos",
      estagio_proj: perfil || "Não informado",
      objetivo: interesse || "Cadastro de interesse - PONTE Projetos",
      prazo_edital: "",
      demanda_resumo: demandaConsolidada,
    },
  ]);

  if (error) {
    console.error("[api/leads/ponte-projetos] erro ao gravar:", error);
    // Sem gravação confirmada, não entregamos o link. O QA foi explícito:
    // "só abre a comunidade após resposta bem-sucedida".
    return NextResponse.json(
      { ok: false, error: "Não foi possível registrar agora." },
      { status: 500 }
    );
  }

  // Notificação à diretoria — falha aqui não invalida o cadastro do lead.
  try {
    const { subject, html, text } = renderAdminNotificationEmail({
      formLabel: "PONTE Projetos — Cadastro de Interesse",
      nome,
      email,
      whatsapp,
      campos: [
        { label: "Nome", value: nome },
        { label: "E-mail", value: email },
        { label: "WhatsApp", value: whatsapp },
        { label: "Perfil", value: perfil },
        { label: "Interesse", value: interesse },
        { label: "Origem na página", value: origem },
        { label: "Aceita comunicações", value: optIn ? "Sim" : "Não" },
      ],
    });
    await sendEmail({
      to: ADMIN_EMAIL,
      subject,
      html,
      text,
      fromName: "Ponte — Lead PONTE Projetos",
    });
  } catch (notifyErr) {
    console.error("[api/leads/ponte-projetos] falha ao notificar:", notifyErr);
  }

  return NextResponse.json(
    WHATSAPP_COMUNIDADE
      ? { ok: true, whatsappUrl: WHATSAPP_COMUNIDADE }
      : { ok: true, aviso: "Cadastro registrado. O convite da comunidade chega por e-mail." },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
