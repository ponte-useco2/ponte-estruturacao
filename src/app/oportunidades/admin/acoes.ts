"use server";

import { revalidatePath } from "next/cache";
import { normaValida } from "@/lib/oportunidades/normas";
import { clienteServidor, visitanteAtual, ehAdministrador } from "@/lib/supabase-auth";

/**
 * Aprovação e bloqueio de acesso ao painel.
 *
 * A verificação de administrador acontece AQUI, não só na página. Server
 * action é um endpoint HTTP: esconder o botão não esconde a ação. Quem
 * descobrir o identificador da action pode chamá-la direto, e a única defesa
 * que vale é a que roda dentro dela.
 */

export interface Resultado {
  ok: boolean;
  erro?: string;
}

/**
 * Aprovado e na lista, como a página (C6, onda 7, 09/10/2026). A identidade do
 * Google com o e-mail confirmado já foi conferida em `visitanteAtual`: sem ela,
 * o e-mail de administrador volta como sem sessão.
 */
async function exigirAdmin(): Promise<{ email: string } | null> {
  const v = await visitanteAtual();
  if (!v || v.status !== "aprovado" || !ehAdministrador(v.email)) return null;
  return { email: v.email };
}

export async function decidirAcesso(
  id: string,
  status: "aprovado" | "bloqueado" | "pendente"
): Promise<Resultado> {
  const admin = await exigirAdmin();
  if (!admin) return { ok: false, erro: "Sem permissão." };

  if (!["aprovado", "bloqueado", "pendente"].includes(status)) {
    return { ok: false, erro: "Status inválido." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, erro: "Identificador inválido." };
  }

  const db = clienteServidor();
  const { error } = await db
    .from("oport_acesso")
    .update({
      status,
      decidido_em: new Date().toISOString(),
      decidido_por: admin.email,
    })
    .eq("id", id);

  if (error) {
    console.error("decidirAcesso:", error.message);
    return { ok: false, erro: "Não foi possível registrar a decisão." };
  }

  revalidatePath("/oportunidades/admin");
  return { ok: true };
}

/**
 * Normas do mural de avisos (onda 7): a equipe publica e apaga. Quem lê é qualquer
 * aprovado, pela RLS da oport_15; quem grava é só esta ação, pela chave de serviço.
 */
export async function cadastrarNorma(dados: unknown): Promise<Resultado> {
  const admin = await exigirAdmin();
  if (!admin) return { ok: false, erro: "Sem permissão." };

  const norma = normaValida(dados);
  if (typeof norma === "string") return { ok: false, erro: norma };

  const { error } = await clienteServidor()
    .from("oport_norma")
    .insert({ ...norma, criada_por: admin.email });
  if (error) {
    console.error("cadastrarNorma:", error.message);
    return { ok: false, erro: "Não foi possível publicar a norma." };
  }
  revalidatePath("/oportunidades/admin");
  revalidatePath("/mapa/avisos");
  return { ok: true };
}

export async function apagarNorma(id: string): Promise<Resultado> {
  const admin = await exigirAdmin();
  if (!admin) return { ok: false, erro: "Sem permissão." };
  if (!/^\d{1,18}$/.test(id)) return { ok: false, erro: "Identificador inválido." };

  const { error } = await clienteServidor().from("oport_norma").delete().eq("id", id);
  if (error) {
    console.error("apagarNorma:", error.message);
    return { ok: false, erro: "Não foi possível apagar a norma." };
  }
  revalidatePath("/oportunidades/admin");
  revalidatePath("/mapa/avisos");
  return { ok: true };
}

/**
 * Confirma (ou desfaz) que a organização representa o CNPJ do cadastro (oport_31). O CNPJ confirmado é o do
 * cadastro NESTE momento, lido aqui pela chave de serviço; se o cadastro mudar, a confirmação deixa de valer.
 */
export async function decidirVinculoCnpj(organizacaoId: string, confirmar: boolean): Promise<Resultado> {
  const admin = await exigirAdmin();
  if (!admin) return { ok: false, erro: "Sem permissão." };
  if (!/^[0-9a-f-]{36}$/i.test(organizacaoId)) return { ok: false, erro: "Identificador inválido." };

  const db = clienteServidor();
  if (!confirmar) {
    const { error } = await db.from("oport_vinculo_cnpj").delete().eq("organizacao_id", organizacaoId);
    if (error) {
      console.error("decidirVinculoCnpj (desfazer):", error.message);
      return { ok: false, erro: "Não foi possível desfazer a confirmação." };
    }
    revalidatePath("/oportunidades/admin");
    return { ok: true };
  }

  const org = await db.from("oport_organizacao").select("tipo, cnpj").eq("id", organizacaoId).maybeSingle();
  if (org.error || !org.data) return { ok: false, erro: "Organização não encontrada." };
  const { tipo, cnpj } = org.data as { tipo: string; cnpj: string | null };
  if (tipo === "municipio") return { ok: false, erro: "Prefeitura se confirma pelo município." };
  if (!cnpj || !/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return { ok: false, erro: "O cadastro está sem um CNPJ válido." };

  const { error } = await db.from("oport_vinculo_cnpj").upsert(
    { organizacao_id: organizacaoId, cnpj, confirmado_em: new Date().toISOString(), confirmado_por: admin.email },
    { onConflict: "organizacao_id" },
  );
  if (error) {
    console.error("decidirVinculoCnpj:", error.message);
    return { ok: false, erro: "Não foi possível confirmar." };
  }
  revalidatePath("/oportunidades/admin");
  return { ok: true };
}

/**
 * Confirma (ou desfaz) que a organização representa o município declarado.
 *
 * O IBGE confirmado é o do cadastro NESTE momento, lido aqui pela chave de serviço —
 * não um valor que venha da tela. Se o cadastro mudar depois, a confirmação deixa de
 * valer sozinha (ver oport_12 e `podeVerMunicipio`).
 */
export async function decidirVinculo(organizacaoId: string, confirmar: boolean): Promise<Resultado> {
  const admin = await exigirAdmin();
  if (!admin) return { ok: false, erro: "Sem permissão." };
  if (!/^[0-9a-f-]{36}$/i.test(organizacaoId)) return { ok: false, erro: "Identificador inválido." };

  const db = clienteServidor();
  if (!confirmar) {
    const { error } = await db.from("oport_vinculo_municipio").delete().eq("organizacao_id", organizacaoId);
    if (error) {
      console.error("decidirVinculo (desfazer):", error.message);
      return { ok: false, erro: "Não foi possível desfazer a confirmação." };
    }
    revalidatePath("/oportunidades/admin");
    return { ok: true };
  }

  const org = await db.from("oport_organizacao").select("tipo, municipio_ibge").eq("id", organizacaoId).maybeSingle();
  if (org.error || !org.data) return { ok: false, erro: "Organização não encontrada." };
  const { tipo, municipio_ibge } = org.data as { tipo: string; municipio_ibge: string | null };
  if (tipo !== "municipio" || !municipio_ibge || !/^\d{7}$/.test(municipio_ibge)) {
    return { ok: false, erro: "Só organização do tipo município, com o município preenchido." };
  }

  const { error } = await db.from("oport_vinculo_municipio").upsert(
    { organizacao_id: organizacaoId, municipio_ibge, confirmado_em: new Date().toISOString(), confirmado_por: admin.email },
    { onConflict: "organizacao_id" },
  );
  if (error) {
    console.error("decidirVinculo:", error.message);
    return { ok: false, erro: "Não foi possível confirmar." };
  }
  revalidatePath("/oportunidades/admin");
  return { ok: true };
}
