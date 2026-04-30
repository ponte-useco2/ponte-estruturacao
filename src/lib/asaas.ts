/**
 * Cliente HTTP para a API do Asaas.
 *
 * Usado SOMENTE em código server-side (server actions, route handlers).
 * Lê credenciais de:
 *   - ASAAS_API_KEY  (chave $aact_... do Sandbox ou Produção)
 *   - ASAAS_API_URL  (https://sandbox.asaas.com/api/v3 ou https://www.asaas.com/api/v3)
 *
 * Documentação oficial: https://docs.asaas.com
 */

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL ?? "https://sandbox.asaas.com/api/v3";

if (!ASAAS_API_KEY) {
  console.warn(
    "[Asaas] ASAAS_API_KEY não definida. As chamadas vão falhar até que a chave seja configurada."
  );
}

/* ----------------------------------------------------------------------- *
 * Tipos
 * ----------------------------------------------------------------------- */

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string | null;
  dateCreated: string;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  status:
    | "PENDING"
    | "RECEIVED"
    | "CONFIRMED"
    | "OVERDUE"
    | "REFUNDED"
    | "RECEIVED_IN_CASH"
    | "REFUND_REQUESTED"
    | "REFUND_IN_PROGRESS"
    | "CHARGEBACK_REQUESTED"
    | "CHARGEBACK_DISPUTE"
    | "AWAITING_CHARGEBACK_REVERSAL"
    | "DUNNING_REQUESTED"
    | "DUNNING_RECEIVED"
    | "AWAITING_RISK_ANALYSIS";
  value: number;
  netValue: number;
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED";
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl: string | null;
  invoiceNumber: string;
  externalReference: string | null;
  description: string | null;
  dateCreated: string;
}

export interface AsaasErrorResponse {
  errors: Array<{ code: string; description: string }>;
}

/* ----------------------------------------------------------------------- *
 * Wrapper de requisição
 * ----------------------------------------------------------------------- */

async function asaasFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!ASAAS_API_KEY) {
    throw new Error("ASAAS_API_KEY não configurada — verifique .env.local");
  }

  const url = `${ASAAS_API_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      ...init.headers,
    },
  });

  if (!res.ok) {
    let body: AsaasErrorResponse | string;
    try {
      body = (await res.json()) as AsaasErrorResponse;
    } catch {
      body = await res.text();
    }

    const detail =
      typeof body === "string"
        ? body
        : body.errors?.[0]?.description ?? JSON.stringify(body);

    throw new Error(`[Asaas ${res.status}] ${detail}`);
  }

  return res.json() as Promise<T>;
}

/* ----------------------------------------------------------------------- *
 * Customers
 * ----------------------------------------------------------------------- */

export interface CreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  externalReference?: string;
}

export async function createCustomer(
  input: CreateCustomerInput
): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Busca um cliente existente pelo CPF/CNPJ. Retorna o primeiro encontrado
 * ou null se não houver. Útil para evitar criar duplicados.
 */
export async function findCustomerByCpfCnpj(
  cpfCnpj: string
): Promise<AsaasCustomer | null> {
  const cleaned = cpfCnpj.replace(/\D/g, "");
  const data = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${cleaned}`
  );
  return data.data?.[0] ?? null;
}

/* ----------------------------------------------------------------------- *
 * Payments
 * ----------------------------------------------------------------------- */

export interface CreatePaymentInput {
  customer: string; // ID Asaas do customer
  /** "UNDEFINED" deixa o cliente escolher (Pix ou Cartão) na fatura */
  billingType: "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
  value: number; // em REAIS, com decimais (ex: 270.00)
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  /** URL pra redirecionar o cliente após pagamento bem-sucedido. */
  callback?: {
    successUrl: string;
    autoRedirect?: boolean;
  };
}

export async function createPayment(
  input: CreatePaymentInput
): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getPayment(id: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${id}`);
}

/* ----------------------------------------------------------------------- *
 * Helpers
 * ----------------------------------------------------------------------- */

/** Calcula a data de vencimento N dias no futuro no formato YYYY-MM-DD. */
export function dueDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Converte centavos (int) para reais (decimal) — formato esperado pela API. */
export function centavosToReais(centavos: number): number {
  return Math.round(centavos) / 100;
}
