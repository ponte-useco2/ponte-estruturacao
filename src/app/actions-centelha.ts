"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import {
  centelhaEdital,
  getPrazoEditalLabel,
} from "@/config/centelha-edital";

/**
 * Server action para registrar leads da landing /centelha-3-pb.
 *
 * Reusa a tabela `leads` existente. O `tipo_org` e os textos derivados saem
 * do config em `src/config/centelha-edital.ts` — quando vier o Centelha 4
 * PB ou houver postergação de prazo, basta editar lá.
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

  // Tag identificadora derivada da config (mantém compat com [CENTELHA-3PB])
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
  ]
    .filter(Boolean)
    .join(" | ");

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
  };

  try {
    const { error } = await supabase.from("leads").insert([leadData]);

    if (error) {
      console.error("Erro ao salvar lead Centelha no Supabase:", error);
      return { success: false, error: error.message };
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
