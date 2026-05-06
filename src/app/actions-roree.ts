"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderAdminNotificationEmail } from "@/lib/email-templates/admin-notification";

const ADMIN_EMAIL =
  process.env.EMAIL_USER || "diretoria.ponte.projetos@gmail.com";

/**
 * Server action para registrar leads da landing /centelha-3-pb/parceria-roree.
 *
 * Diferenças em relação ao submitCentelhaLead padrão:
 *   - tipo_org = "Centelha 3 PB - ROREE" (separa do funil principal)
 *   - Ref fixo "roree" no demanda_resumo (sempre, mesmo sem ?ref=)
 *   - NÃO agenda email automático de 1h (fluxo ROREE é manual via Pedro)
 *   - Notifica admin imediatamente (mesmo padrão)
 *
 * Modelo financeiro deste funil:
 *   Fase 1 = R$ 500 · Fase 2 = R$ 1.000 · Pós-aprovação = R$ 10k+R$ 10k
 *   (separado da landing /centelha-3-pb que cobra R$ 2.700)
 */
export async function submitRoreeLead(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const nome = (formData.get("nome") as string) || "";
  const email = (formData.get("email") as string) || "";
  const whatsapp = (formData.get("whatsapp") as string) || "";
  const municipio = (formData.get("municipio") as string) || "";
  const nome_projeto = (formData.get("nome_projeto") as string) || "";
  const area_solucao = (formData.get("area_solucao") as string) || "";
  const estagio = (formData.get("estagio") as string) || "";
  const equipe_qtd = (formData.get("equipe_qtd") as string) || "";
  const problema = (formData.get("problema") as string) || "";
  const link_pitch = (formData.get("link_pitch") as string) || "";

  const demandaConsolidada = [
    "[CENTELHA-3-PB · ROREE]",
    nome_projeto && `Projeto: ${nome_projeto}`,
    area_solucao && `Área: ${area_solucao}`,
    estagio && `Estágio: ${estagio}`,
    equipe_qtd && `Equipe: ${equipe_qtd} pessoas`,
    problema && `Problema: ${problema}`,
    link_pitch && `Link: ${link_pitch}`,
    "Ref: roree",
  ]
    .filter(Boolean)
    .join(" | ");

  const leadData = {
    nome,
    email,
    whatsapp,
    organizacao: nome_projeto || "Centelha 3 PB - ROREE",
    cidade: municipio ? `${municipio}/PB` : "",
    tipo_org: "Centelha 3 PB - ROREE",
    estagio_proj: estagio || "Pré-diagnóstico ROREE",
    objetivo: "Centelha 3 PB - Parceria ROREE (Fase 1 R$ 500)",
    prazo_edital: "Centelha 3 PB - Fase 1: 24/04 a 25/05/2026",
    demanda_resumo: demandaConsolidada,
  };

  try {
    const { error } = await supabase.from("leads").insert([leadData]);

    if (error) {
      console.error("Erro ao salvar lead ROREE no Supabase:", error);
      return { success: false, error: error.message };
    }

    // Notifica admin imediatamente — fluxo ROREE depende de filtro humano + IA
    try {
      const { subject, html, text } = renderAdminNotificationEmail({
        formLabel: "Centelha 3 PB · ROREE — Pré-diagnóstico",
        nome,
        email,
        whatsapp,
        campos: [
          { label: "Nome", value: nome },
          { label: "Email", value: email },
          { label: "WhatsApp", value: whatsapp },
          { label: "Município", value: municipio ? `${municipio}/PB` : "" },
          { label: "Nome do projeto", value: nome_projeto },
          { label: "Área da solução", value: area_solucao },
          { label: "Estágio", value: estagio },
          { label: "Equipe (qtd pessoas)", value: equipe_qtd },
          { label: "Problema", value: problema },
          { label: "Link/Pitch", value: link_pitch },
          { label: "Origem", value: "Parceria ROREE (R$ 500/Fase 1)" },
        ],
      });
      await sendEmail({
        to: ADMIN_EMAIL,
        subject,
        html,
        text,
        fromName: "Ponte — Lead ROREE",
      });
    } catch (notifyErr) {
      console.error("[submitRoreeLead] Falha ao notificar admin:", notifyErr);
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro inesperado ao salvar lead ROREE:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
