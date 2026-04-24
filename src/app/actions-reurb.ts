"use server";

import { createServerSupabaseClient } from "@/lib/supabase";

/**
 * Server action para registrar leads da landing /reurb.
 *
 * Reusa a tabela `leads` existente mapeando campos de prefeitura para o shape da tabela,
 * com marcadores reconhecíveis para triagem:
 *   - tipo_org = "Prefeitura (REURB)"
 *   - demanda_resumo prefixado com [REURB-MUNICIPIOS]
 *
 * Os campos específicos de prefeitura (cargo, população, nº estimado de imóveis, situação
 * cadastral) são consolidados em demanda_resumo para não exigir migração no Supabase.
 */
export async function submitReurbLead(formData: FormData) {
  const supabase = createServerSupabaseClient();

  // Campos crus vindos do formulário
  const nome = (formData.get("nome") as string) || "";
  const email = (formData.get("email") as string) || "";
  const whatsapp = (formData.get("whatsapp") as string) || "";
  const municipio = (formData.get("municipio") as string) || "";
  const uf = (formData.get("uf") as string) || "";
  const cargo = (formData.get("cargo") as string) || "";
  const populacao = (formData.get("populacao") as string) || "";
  const imoveis_estimados = (formData.get("imoveis_estimados") as string) || "";
  const situacao_cadastral = (formData.get("situacao_cadastral") as string) || "";
  const objetivo = (formData.get("objetivo") as string) || "";
  const prazo = (formData.get("prazo") as string) || "";
  const observacoes = (formData.get("observacoes") as string) || "";

  // Consolida os campos específicos de prefeitura na demanda_resumo
  const demandaConsolidada = [
    "[REURB-MUNICIPIOS]",
    cargo ? `Cargo: ${cargo}` : null,
    populacao ? `População estimada: ${populacao}` : null,
    imoveis_estimados ? `Imóveis estimados: ${imoveis_estimados}` : null,
    situacao_cadastral ? `Situação cadastral: ${situacao_cadastral}` : null,
    observacoes ? `Observações: ${observacoes}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const leadData = {
    nome,
    email,
    whatsapp,
    organizacao: municipio ? `Prefeitura de ${municipio}` : "Prefeitura",
    cidade: [municipio, uf].filter(Boolean).join("/"),
    tipo_org: "Prefeitura (REURB)",
    estagio_proj: situacao_cadastral || "Não informado",
    objetivo: objetivo || "Regularização fundiária (REURB)",
    prazo_edital: prazo || "Não informado",
    demanda_resumo: demandaConsolidada,
  };

  try {
    const { error } = await supabase.from("leads").insert([leadData]);

    if (error) {
      console.error("Erro ao salvar lead REURB no Supabase:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro inesperado ao salvar lead REURB:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
