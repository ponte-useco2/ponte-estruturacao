"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import {
  centavosToReais,
  createCustomer,
  createPayment,
  dueDateInDays,
  findCustomerByCpfCnpj,
} from "@/lib/asaas";

/**
 * Cobranças do funil PARCERIA ROREE.
 *
 * Diferente do checkout padrão (R$ 2.700 com cupom), este aceita 2 fases:
 *   - Fase 1: R$ 500   (diagnóstico estratégico)
 *   - Fase 2: R$ 1.000 (estruturação técnica)
 *
 * Pós-aprovação (R$ 10k+R$ 10k) NÃO passa por aqui — sai direto da
 * subvenção via NF de cada empresa.
 *
 * Não usa cupons. Preço fixo por fase.
 */

export type FaseRoree = 1 | 2;

export const VALOR_FASE_ROREE: Record<FaseRoree, number> = {
  1: 50000,   // R$ 500,00 em centavos
  2: 100000,  // R$ 1.000,00 em centavos
};

export const LABEL_FASE_ROREE: Record<FaseRoree, string> = {
  1: "Fase 1 — Diagnóstico Estratégico",
  2: "Fase 2 — Estruturação Técnica",
};

export interface CriarCobrancaRoreeResult {
  success: boolean;
  invoiceUrl?: string;
  paymentId?: string;
  valorCentavos?: number;
  error?: string;
}

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export async function criarCobrancaRoree(
  formData: FormData
): Promise<CriarCobrancaRoreeResult> {
  const nome = ((formData.get("nome") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  const whatsapp = ((formData.get("whatsapp") as string) || "").trim();
  const cpf = ((formData.get("cpf") as string) || "").replace(/\D/g, "");
  const municipio = ((formData.get("municipio") as string) || "").trim();
  const nomeProjeto = ((formData.get("nome_projeto") as string) || "").trim();
  const faseRaw = (formData.get("fase") as string) || "1";

  // Valida fase
  const fase: FaseRoree = faseRaw === "2" ? 2 : 1;
  const valorCentavos = VALOR_FASE_ROREE[fase];
  const labelFase = LABEL_FASE_ROREE[fase];

  // Validações básicas
  if (!nome || !email || !whatsapp || !cpf) {
    return {
      success: false,
      error: "Campos obrigatórios faltando (nome, email, whatsapp, CPF).",
    };
  }
  if (cpf.length !== 11 && cpf.length !== 14) {
    return { success: false, error: "CPF/CNPJ inválido." };
  }

  const supabase = createServerSupabaseClient();

  // 1. Cria/recupera customer no Asaas
  let asaasCustomerId: string;
  try {
    const existing = await findCustomerByCpfCnpj(cpf);
    if (existing) {
      asaasCustomerId = existing.id;
    } else {
      const created = await createCustomer({
        name: nome,
        email,
        cpfCnpj: cpf,
        mobilePhone: whatsapp.replace(/\D/g, ""),
        externalReference: `centelha-3-pb-roree-${Date.now()}`,
      });
      asaasCustomerId = created.id;
    }
  } catch (err) {
    console.error("[criarCobrancaRoree] erro ao criar/buscar customer:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? `Erro ao registrar cliente: ${err.message}`
          : "Erro ao registrar cliente.",
    };
  }

  // 2. Cria a cobrança
  let invoiceUrl: string;
  let paymentId: string;
  try {
    const description = nomeProjeto
      ? `Centelha 3 PB · ROREE · ${labelFase} — ${nomeProjeto}`
      : `Centelha 3 PB · ROREE · ${labelFase}`;

    const payment = await createPayment({
      customer: asaasCustomerId,
      billingType: "UNDEFINED", // cliente escolhe Pix/Cartão
      value: centavosToReais(valorCentavos),
      dueDate: dueDateInDays(7),
      description,
      externalReference: `centelha-roree-fase${fase}-${cpf}-${Date.now()}`,
      callback: {
        successUrl: "https://ponteprojetos.com.br/centelha-3-pb/obrigado",
        autoRedirect: true,
      },
    });

    invoiceUrl = payment.invoiceUrl;
    paymentId = payment.id;
  } catch (err) {
    console.error("[criarCobrancaRoree] erro ao criar payment:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? `Erro ao gerar cobrança: ${err.message}`
          : "Erro ao gerar cobrança.",
    };
  }

  // 3. Registra o lead no Supabase
  const demandaConsolidada = [
    `[CENTELHA-3PB · ROREE · FASE-${fase}]`,
    `CPF: ${cpf}`,
    nomeProjeto && `Projeto: ${nomeProjeto}`,
    `Fase: ${fase} (${labelFase})`,
    `Valor: ${formatBRL(valorCentavos)}`,
    `Asaas Payment ID: ${paymentId}`,
    `Asaas Customer ID: ${asaasCustomerId}`,
    "Ref: roree",
  ]
    .filter(Boolean)
    .join(" | ");

  const { error: leadError } = await supabase.from("leads").insert([
    {
      nome,
      email,
      whatsapp,
      organizacao: nomeProjeto || "Centelha 3 PB - ROREE - Pessoa Física",
      cidade: municipio ? `${municipio}/PB` : "",
      tipo_org: "Centelha 3 PB - ROREE",
      estagio_proj: `Aguardando pagamento (Fase ${fase})`,
      objetivo: `Centelha 3 PB - ROREE - ${labelFase}`,
      prazo_edital: "Centelha 3 PB - Fase 1: 24/04 a 25/05/2026",
      demanda_resumo: demandaConsolidada,
    },
  ]);

  if (leadError) {
    // Não bloqueia o pagamento
    console.error("[criarCobrancaRoree] erro ao registrar lead:", leadError);
  }

  return {
    success: true,
    invoiceUrl,
    paymentId,
    valorCentavos,
  };
}
