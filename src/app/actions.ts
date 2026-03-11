"use server";

import { createServerSupabaseClient } from "@/lib/supabase";

export async function submitLead(formData: FormData) {
  const supabase = createServerSupabaseClient();
  
  const leadData = {
    nome: formData.get("nome"),
    email: formData.get("email"),
    whatsapp: formData.get("whatsapp"),
    organizacao: formData.get("organizacao"),
    cidade: formData.get("cidade"),
    tipo_org: formData.get("tipo_org"),
    estagio_proj: formData.get("estagio_proj"),
    objetivo: formData.get("objetivo"),
    prazo_edital: formData.get("prazo_edital"),
    demanda_resumo: formData.get("demanda_resumo"),
  };

  try {
    const { error } = await supabase
      .from("leads")
      .insert([leadData]);

    if (error) {
      console.error("Erro ao salvar lead no Supabase:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro inesperado ao salvar lead:", err);
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
