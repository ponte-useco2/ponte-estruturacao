"use server";

import { createServerSupabaseClient } from "@/lib/supabase";

/**
 * Server action para registrar leads da Trilha PONTE de Decisão Legítima (/diagnostico-sbce).
 *
 * Reusa a tabela `leads` existente, mapeando os campos da empresa para o shape da tabela,
 * com marcadores reconhecíveis para triagem:
 *   - tipo_org = "Empresa (SBCE)"
 *   - demanda_resumo prefixado com [TRILHA-SBCE]
 *
 * Os campos específicos (Índice, classificação, dimensão mais fraca, setor, porte, consentimento)
 * são consolidados em demanda_resumo para não exigir migração no Supabase.
 */
export async function submitSbceLead(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const nome = (formData.get("nome") as string) || "";
  const email = (formData.get("email") as string) || "";
  const empresa = (formData.get("empresa") as string) || "";
  const setor = (formData.get("setor") as string) || "";
  const porte = (formData.get("porte") as string) || "";
  const indice = (formData.get("indice") as string) || "";
  const classificacao = (formData.get("classificacao") as string) || "";
  const dimensaoFraca = (formData.get("dimensao_fraca") as string) || "";
  const consentimento = (formData.get("consentimento") as string) || "Não";

  if (!nome || !email || !empresa) {
    return { success: false, error: "Preencha nome, empresa e e-mail." };
  }

  const demandaConsolidada = [
    "[TRILHA-SBCE]",
    indice ? `Índice: ${indice}/100` : null,
    classificacao ? `Classificação: ${classificacao}` : null,
    dimensaoFraca ? `Dimensão mais fraca: ${dimensaoFraca}` : null,
    setor ? `Setor: ${setor}` : null,
    porte ? `Porte: ${porte}` : null,
    `Consentimento de contato: ${consentimento}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const leadData = {
    nome,
    email,
    whatsapp: "",
    organizacao: empresa,
    cidade: "",
    tipo_org: "Empresa (SBCE)",
    estagio_proj: classificacao || "Não informado",
    objetivo: "Diagnóstico SBCE — Trilha PONTE (Nível 0)",
    prazo_edital: "Relato SBCE a partir de 2027",
    demanda_resumo: demandaConsolidada,
  };

  try {
    const { error } = await supabase.from("leads").insert([leadData]);
    if (error) {
      console.error("Erro ao salvar lead SBCE no Supabase:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    console.error("Erro inesperado ao salvar lead SBCE:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
