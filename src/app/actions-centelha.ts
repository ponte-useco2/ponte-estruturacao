"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderAdminNotificationEmail } from "@/lib/email-templates/admin-notification";
import { extractRefFromForm } from "@/lib/tracking";
import {
  centelhaEdital,
  getPrazoEditalLabel,
} from "@/config/centelha-edital";

const ADMIN_EMAIL =
  process.env.EMAIL_USER || "diretoria.ponte.projetos@gmail.com";

/**
 * Server action para registrar leads da landing /centelha-3-pb.
 *
 * Reusa a tabela `leads` existente. O `tipo_org` e os textos derivados saem
 * do config em `src/config/centelha-edital.ts` — quando vier o Centelha 4
 * PB ou houver postergação de prazo, basta editar lá.
 *
 * Após salvar o lead, agenda envio automático de email para 1 hora depois
 * (campo email_pos_form_send_at). O endpoint /api/cron/send-pending-emails
 * processa esses agendamentos via cron-job.org.
 */
export async function submitCentelhaLead(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const nome = (formData.get("nome") as string) || "";
  const email = (formData.get("email") as string) || "";
  const whatsapp = (formData.get("whatsapp") as string) || "";
  const municipio = (formData.get("municipio") as string) || "";
  const cnpj_status = (formData.get("cnpj_status") as string) || "";
  const nome_projeto = (formData.get("nome_projeto") as string) || "";
  const area_solucao = (formData.get("area_solucao") as string) || "";
  const estagio = (formData.get("estagio") as string) || "";
  const problema = (formData.get("problema") as string) || "";
  const link_pitch = (formData.get("link_pitch") as string) || "";
  const participou_antes = (formData.get("participou_antes") as string) || "";
  const deseja_analise = (formData.get("deseja_analise") as string) || "Sim";

  // Tracking de afiliado via ?ref= (ex: marcio, gayoso) — opcional
  const ref = extractRefFromForm(formData);

  // Tag identificadora derivada da config
  const editionTag = `[${centelhaEdital.edition.label
    .toUpperCase()
    .replace(/\s+/g, "-")}]`;

  // Consolida campos específicos em demanda_resumo (campo livre da tabela)
  const demandaConsolidada = [
    editionTag,
    nome_projeto && `Projeto: ${nome_projeto}`,
    area_solucao && `Área: ${area_solucao}`,
    estagio && `Estágio: ${estagio}`,
    cnpj_status && `CNPJ: ${cnpj_status}`,
    problema && `Problema: ${problema}`,
    link_pitch && `Link: ${link_pitch}`,
    participou_antes && `Centelha 1/2: ${participou_antes}`,
    deseja_analise && `Análise: ${deseja_analise}`,
    ref && `Ref: ${ref}`,
  ]
    .filter(Boolean)
    .join(" | ");

  // Agenda envio do email automático para 1 hora depois (parecer "humano")
  const sendAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const leadData = {
    nome,
    email,
    whatsapp,
    organizacao:
      nome_projeto || `${centelhaEdital.edition.label} - Pessoa Física`,
    cidade: municipio ? `${municipio}/PB` : "",
    tipo_org: centelhaEdital.edition.label,
    estagio_proj: estagio || "Não informado",
    objetivo: `Estruturação de proposta para ${centelhaEdital.edition.label}`,
    prazo_edital: getPrazoEditalLabel(),
    demanda_resumo: demandaConsolidada,
    email_pos_form_send_at: sendAt,
  };

  try {
    const { error } = await supabase.from("leads").insert([leadData]);

    if (error) {
      console.error("Erro ao salvar lead Centelha no Supabase:", error);
      return { success: false, error: error.message };
    }

    // Notifica admin imediatamente (não bloqueia em caso de falha)
    try {
      const { subject, html, text } = renderAdminNotificationEmail({
        formLabel: `${centelhaEdital.edition.label} — Pré-diagnóstico`,
        nome,
        email,
        whatsapp,
        campos: [
          { label: "Nome", value: nome },
          { label: "Email", value: email },
          { label: "WhatsApp", value: whatsapp },
          { label: "Município", value: municipio ? `${municipio}/PB` : "" },
          { label: "CNPJ status", value: cnpj_status },
          { label: "Nome do projeto", value: nome_projeto },
          { label: "Área da solução", value: area_solucao },
          { label: "Estágio", value: estagio },
          { label: "Problema", value: problema },
          { label: "Link/Pitch", value: link_pitch },
          { label: "Participou Centelha 1/2", value: participou_antes },
          { label: "Deseja análise", value: deseja_analise },
          { label: "Indicado por (Ref)", value: ref },
        ],
      });
      await sendEmail({
        to: ADMIN_EMAIL,
        subject,
        html,
        text,
        fromName: "Ponte — Notificação de Lead",
      });
    } catch (notifyErr) {
      console.error(
        "[submitCentelhaLead] Falha ao notificar admin:",
        notifyErr
      );
      // não retorna erro pro usuário — lead já foi salvo
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro inesperado ao salvar lead Centelha:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
