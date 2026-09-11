"use server";

import { revalidatePath } from "next/cache";
import { clienteSessao, visitanteAtual } from "@/lib/supabase-auth";

/**
 * Ações da central: marcar como lida, arquivar, e o inverso de cada uma — que é
 * o que o botão "Desfazer" chama.
 *
 * Server action é endpoint HTTP. A verificação vale AQUI dentro, não na tela:
 * esconder um botão não esconde a ação. E a escrita usa o cliente da sessão,
 * então a RLS garante que um id alheio misturado na lista simplesmente não é
 * alcançado. O filtro por `user_id` abaixo é redundância deliberada.
 */

export interface ResultadoAcao {
  ok: boolean;
  erro?: string;
}

type Campo = "lida_em" | "arquivada_em";

const ROTA = "/plataforma/app/mapa-de-oportunidades";
const LIMITE_POR_ACAO = 500;

function idsValidos(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= LIMITE_POR_ACAO &&
    ids.every((id) => typeof id === "string" && /^\d{1,18}$/.test(id))
  );
}

async function marcar(ids: unknown, campo: Campo, ligar: boolean): Promise<ResultadoAcao> {
  if (!idsValidos(ids)) return { ok: false, erro: "Seleção inválida." };

  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return { ok: false, erro: "Sem permissão." };

  const db = await clienteSessao();
  const { error } = await db
    .from("oport_notificacao")
    .update({ [campo]: ligar ? new Date().toISOString() : null })
    .in("id", ids)
    .eq("user_id", visitante.id);

  if (error) {
    console.error(`central ${campo}:`, error.message);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }

  revalidatePath(ROTA);
  return { ok: true };
}

export async function marcarLidas(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "lida_em", true);
}

export async function marcarNaoLidas(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "lida_em", false);
}

export async function arquivar(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "arquivada_em", true);
}

export async function desarquivar(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "arquivada_em", false);
}
