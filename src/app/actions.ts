"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderAdminNotificationEmail } from "@/lib/email-templates/admin-notification";
import { consumir, origemDoPedido } from "@/lib/freio";

const ADMIN_EMAIL = process.env.EMAIL_USER || "diretoria.ponte.projetos@gmail.com";

/**
 * Corta e normaliza. Campo ausente vira string vazia.
 *
 * Mesma função que a rota /api/leads/ponte-projetos já usava. Esta action
 * ficou sem nenhuma validação por muito tempo: sem campo obrigatório, sem
 * formato de e-mail, sem limite de tamanho — e é pública, então o que chegava
 * ao banco era o que o cliente quisesse mandar, no tamanho que quisesse.
 */
function limpar(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function submitLead(formData: FormData) {
  // Freio antes de qualquer trabalho: esta action grava no banco e dispara
  // e-mail pela cota compartilhada de 500/dia do Gmail.
  const origem = await origemDoPedido("lead");
  if (!consumir(origem, { limite: 5, janelaMs: 10 * 60 * 1000 })) {
    return {
      success: false,
      error: "Muitos envios em sequência. Aguarde alguns minutos e tente de novo.",
    };
  }

  const nome = limpar(formData.get("nome"), 120);
  const email = limpar(formData.get("email"), 160).toLowerCase();
  const whatsapp = limpar(formData.get("whatsapp"), 40);
  const organizacao = limpar(formData.get("organizacao"), 160);
  const cidade = limpar(formData.get("cidade"), 120);
  const tipo_org = limpar(formData.get("tipo_org"), 80);
  const estagio_proj = limpar(formData.get("estagio_proj"), 80);
  const objetivo = limpar(formData.get("objetivo"), 200);
  const prazo_edital = limpar(formData.get("prazo_edital"), 80);
  const demanda_resumo = limpar(formData.get("demanda_resumo"), 2000);

  // Validação mínima — o formulário já valida no cliente, mas o cliente mente.
  if (nome.length < 2) {
    return { success: false, error: "Nome é obrigatório." };
  }
  if (!EMAIL_VALIDO.test(email)) {
    return { success: false, error: "E-mail inválido." };
  }

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
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("leads").insert([leadData]);

    if (error) {
      console.error("Erro ao salvar lead no Supabase:", error);
      // A mensagem do PostgREST carrega nome de tabela, coluna e constraint.
      // Devolvida a um anônimo, é reconhecimento de schema de graça.
      return { success: false, error: "Não foi possível registrar agora." };
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
    return { success: false, error: "Não foi possível registrar agora." };
  }
}
