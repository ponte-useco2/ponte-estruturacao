/**
 * Leitura da carteira — só servidor, pela sessão da pessoa (a RLS da oport_15 garante que cada um lê só os
 * próprios itens e avisos). Duas consultas, sem leitura por item.
 */
import { authConfigurada, clienteSessao } from "@/lib/supabase-auth";
import type { AvisoItem } from "./favoritos";
import { ehEsquemaAusente } from "./esquema";
import type { SeguidoCarteira } from "./carteira";

export const LIMITE_AVISOS_CARTEIRA = 500;

export type LeituraCarteira =
  | { estado: "nao_ativado" }
  | { estado: "erro" }
  | { estado: "ok"; seguidos: SeguidoCarteira[]; avisos: AvisoItem[]; truncada: boolean };

export async function lerCarteira(): Promise<LeituraCarteira> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = await clienteSessao();
  const [seguidos, avisos] = await Promise.all([
    db.from("oport_favorito").select("tipo, chave, titulo, estado, referencia, criado_em").order("criado_em", { ascending: false }),
    db
      .from("oport_aviso")
      .select("id, tipo, chave, evento, titulo, antes, depois, criado_em, lida_em, arquivada_em")
      .is("arquivada_em", null)
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(LIMITE_AVISOS_CARTEIRA + 1),
  ]);
  const erro = seguidos.error ?? avisos.error;
  if (erro) {
    if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
    console.error("lerCarteira:", erro.message);
    return { estado: "erro" };
  }
  const linhas = (avisos.data ?? []) as (Omit<AvisoItem, "id"> & { id: number })[];
  return {
    estado: "ok",
    seguidos: (seguidos.data ?? []) as SeguidoCarteira[],
    avisos: linhas.slice(0, LIMITE_AVISOS_CARTEIRA).map((l) => ({ ...l, id: String(l.id) })),
    truncada: linhas.length > LIMITE_AVISOS_CARTEIRA,
  };
}
