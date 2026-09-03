"use server";

import { revalidatePath } from "next/cache";
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

async function exigirAdmin(): Promise<{ email: string } | null> {
  const v = await visitanteAtual();
  if (!v || !ehAdministrador(v.email)) return null;
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
