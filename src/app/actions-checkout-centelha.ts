"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { extractRefFromForm } from "@/lib/tracking";
import {
  centavosToReais,
  createCustomer,
  createPayment,
  dueDateInDays,
  findCustomerByCpfCnpj,
} from "@/lib/asaas";
import {
  VALOR_PADRAO_CENTAVOS,
  formatBRL,
  type TipoCupom,
} from "@/config/centelha-cupons";

/* ===================================================================== *
 * Tipos públicos
 * ===================================================================== */

export interface CupomValido {
  codigo: string;
  tipo: TipoCupom;
  valorFinalCentavos: number;
  afiliadoNome: string | null;
  vagasRestantes: number | null; // null = ilimitado
}

export type CupomLookupResult =
  | { ok: true; cupom: CupomValido }
  | { ok: false; reason: "not_found" | "exhausted" | "inactive" };

/* ===================================================================== *
 * 1. validateCupom — lookup sem consumir
 * ===================================================================== */

export async function validateCupom(
  rawCodigo: string
): Promise<CupomLookupResult> {
  const codigo = (rawCodigo || "").trim().toUpperCase();
  if (!codigo) return { ok: false, reason: "not_found" };

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("consultar_cupom_centelha", {
    p_codigo: codigo,
  });

  if (error) {
    console.error("[validateCupom] erro RPC:", error);
    return { ok: false, reason: "not_found" };
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  const cupom = data as {
    codigo: string;
    tipo: TipoCupom;
    valor_final_centavos: number;
    max_usos: number | null;
    usos_atuais: number;
    afiliado_nome: string | null;
    ativo: boolean;
  };

  if (!cupom.ativo) {
    return { ok: false, reason: "inactive" };
  }

  if (cupom.max_usos !== null && cupom.usos_atuais >= cupom.max_usos) {
    return { ok: false, reason: "exhausted" };
  }

  return {
    ok: true,
    cupom: {
      codigo: cupom.codigo,
      tipo: cupom.tipo,
      valorFinalCentavos: cupom.valor_final_centavos,
      afiliadoNome: cupom.afiliado_nome,
      vagasRestantes:
        cupom.max_usos === null
          ? null
          : Math.max(cupom.max_usos - cupom.usos_atuais, 0),
    },
  };
}

/* ===================================================================== *
 * 2. criarCobrancaCentelha — fluxo principal do checkout
 * ===================================================================== */

export interface CriarCobrancaResult {
  success: boolean;
  invoiceUrl?: string;
  paymentId?: string;
  valorCentavos?: number;
  error?: string;
}

export async function criarCobrancaCentelha(
  formData: FormData
): Promise<CriarCobrancaResult> {
  // 1. Lê e valida campos básicos
  const nome = ((formData.get("nome") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  const whatsapp = ((formData.get("whatsapp") as string) || "").trim();
  const cpf = ((formData.get("cpf") as string) || "").replace(/\D/g, "");
  const municipio = ((formData.get("municipio") as string) || "").trim();
  const nomeProjeto = ((formData.get("nome_projeto") as string) || "").trim();
  const ref = extractRefFromForm(formData);
  const codigoCupomRaw = ((formData.get("codigo_cupom") as string) || "")
    .trim()
    .toUpperCase();

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

  // 2. Determina o valor com base no cupom (se houver)
  let valorCentavos = VALOR_PADRAO_CENTAVOS;
  let tipoCupom: TipoCupom | "padrao" = "padrao";
  let afiliadoNome: string | null = null;
  let cupomConsumido = false;

  if (codigoCupomRaw) {
    // Consome atomicamente — race-safe (UPDATE com WHERE max_usos)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "consumir_cupom_centelha",
      { p_codigo: codigoCupomRaw }
    );

    if (rpcError) {
      console.error("[criarCobranca] erro RPC consumir_cupom:", rpcError);
      return {
        success: false,
        error: "Erro ao validar cupom. Tente novamente.",
      };
    }

    if (!rpcData) {
      return {
        success: false,
        error: "Cupom inválido, esgotado ou inativo.",
      };
    }

    const cupom = rpcData as {
      codigo: string;
      tipo: TipoCupom;
      valor_final_centavos: number;
      afiliado_nome: string | null;
    };

    valorCentavos = cupom.valor_final_centavos;
    tipoCupom = cupom.tipo;
    afiliadoNome = cupom.afiliado_nome;
    cupomConsumido = true;
  }

  // 3. Cria/recupera customer no Asaas
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
        externalReference: `centelha-3-pb-${Date.now()}`,
      });
      asaasCustomerId = created.id;
    }
  } catch (err) {
    // Devolve cupom se falhou após decremento
    if (cupomConsumido) {
      await supabase.rpc("devolver_cupom_centelha", {
        p_codigo: codigoCupomRaw,
      });
    }
    console.error("[criarCobranca] erro ao criar/buscar customer:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? `Erro ao registrar cliente: ${err.message}`
          : "Erro ao registrar cliente.",
    };
  }

  // 4. Cria a cobrança
  let invoiceUrl: string;
  let paymentId: string;
  try {
    const description = nomeProjeto
      ? `Centelha 3 PB · Etapa 1 — ${nomeProjeto}`
      : "Centelha 3 PB · Etapa 1 — Estruturação Técnica";

    const payment = await createPayment({
      customer: asaasCustomerId,
      billingType: "UNDEFINED", // cliente escolhe Pix/Cartão na fatura
      value: centavosToReais(valorCentavos),
      dueDate: dueDateInDays(7),
      description,
      externalReference: `centelha-${cpf}-${Date.now()}`,
      callback: {
        successUrl: "https://ponteprojetos.com.br/centelha-3-pb/obrigado",
        autoRedirect: true,
      },
    });

    invoiceUrl = payment.invoiceUrl;
    paymentId = payment.id;
  } catch (err) {
    if (cupomConsumido) {
      await supabase.rpc("devolver_cupom_centelha", {
        p_codigo: codigoCupomRaw,
      });
    }
    console.error("[criarCobranca] erro ao criar payment:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? `Erro ao gerar cobrança: ${err.message}`
          : "Erro ao gerar cobrança.",
    };
  }

  // 5. Registra o lead no Supabase (tabela `leads` existente)
  // Mantém compatibilidade com queries da diretoria
  const tagAfiliado =
    tipoCupom === "padrao"
      ? "[CENTELHA-3PB · CHECKOUT]"
      : `[CENTELHA-3PB · ${tipoCupom.toUpperCase()} · ${codigoCupomRaw}]`;

  const demandaConsolidada = [
    tagAfiliado,
    `CPF: ${cpf}`,
    nomeProjeto && `Projeto: ${nomeProjeto}`,
    afiliadoNome && `Indicado por: ${afiliadoNome}`,
    ref && `Ref: ${ref}`,
    `Valor: ${formatBRL(valorCentavos)}`,
    `Asaas Payment ID: ${paymentId}`,
    `Asaas Customer ID: ${asaasCustomerId}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const { error: leadError } = await supabase.from("leads").insert([
    {
      nome,
      email,
      whatsapp,
      organizacao: nomeProjeto || "Centelha 3 PB - Pessoa Física",
      cidade: municipio ? `${municipio}/PB` : "",
      tipo_org: "Centelha 3 PB",
      estagio_proj: "Aguardando pagamento",
      objetivo: "Centelha 3 PB - Etapa 1 (checkout)",
      prazo_edital: "Centelha 3 PB - Fase 1: 24/04 a 25/05/2026",
      demanda_resumo: demandaConsolidada,
    },
  ]);

  if (leadError) {
    // Não bloqueia o pagamento — só registra o erro pra investigação manual
    console.error("[criarCobranca] erro ao registrar lead:", leadError);
  }

  return {
    success: true,
    invoiceUrl,
    paymentId,
    valorCentavos,
  };
}
