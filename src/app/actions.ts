"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderAdminNotificationEmail } from "@/lib/email-templates/admin-notification";

const ADMIN_EMAIL = process.env.EMAIL_USER || "diretoria.ponte.projetos@gmail.com";

export async function submitLead(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const nome = (formData.get("nome") as string) || "";
  const email = (formData.get("email") as string) || "";
  const whatsapp = (formData.get("whatsapp") as string) || "";
  const organizacao = (formData.get("organizacao") as string) || "";
  const cidade = (formData.get("cidade") as string) || "";
  const tipo_org = (formData.get("tipo_org") as string) || "";
  const estagio_proj = (formData.get("estagio_proj") as string) || "";
  const objetivo = (formData.get("objetivo") as string) || "";
  const prazo_edital = (formData.get("prazo_edital") as string) || "";
  const demanda_resumo = (formData.get("demanda_resumo") as string) || "";

  const leadData = {
    nome,
    email,
    whatsapp,
    organizacao,
    cidade,
    tipo_org,
    estagio_proj,
    objetivo,
    prazo_edital,
    demanda_resumo,
  };

  try {
    const { error } = await supabase.from("leads").insert([leadData]);

    if (error) {
      console.error("Erro ao salvar lead no Supabase:", error);
      return { success: false, error: error.message };
    }

    // Notifica admin (não bloqueia em caso de falha)
    try {
      const { subject, html, text } = renderAdminNotificationEmail({
        formLabel: "Diagnóstico Geral",
        nome,
        email,
        whatsapp,
        campos: [
          { label: "Nome", value: nome },
          { label: "Email", value: email },
          { label: "WhatsApp", value: whatsapp },
          { label: "Organização", value: organizacao },
          { label: "Cidade", value: cidade },
          { label: "Tipo de organização", value: tipo_org },
          { label: "Estágio do projeto", value: estagio_proj },
          { label: "Objetivo", value: objetivo },
          { label: "Prazo do edital", value: prazo_edital },
          { label: "Demanda / Resumo", value: demanda_resumo },
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
      console.error("[submitLead] Falha ao notificar admin:", notifyErr);
      // não retorna erro pro usuário — lead já foi salvo
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro inesperado ao salvar lead:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
