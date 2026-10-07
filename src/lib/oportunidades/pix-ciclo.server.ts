/**
 * Leitura do ciclo em curso do Pix (oport_30) para o painel do Pix — só servidor, só chave de serviço; o portão
 * (administrador) é da página. A coleta é diária e pequena: a UF inteira cabe numa página.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import type { PlanoCicloPix } from "./pix-ciclo";

export type LeituraCicloPix =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro" }
  | { estado: "ok"; dado_ate: string | null; contagens: Record<string, unknown>; planos: PlanoCicloPix[] };

export async function lerCicloPix(uf = "PB"): Promise<LeituraCicloPix> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ex = await db.rpc("pixc_ultima_execucao");
  if (ex.error) {
    if (ehEsquemaAusente(ex.error.code)) return { estado: "nao_ativado" };
    console.error("ciclo do Pix (execução):", ex.error.message);
    return { estado: "erro" };
  }
  const e = ((ex.data as { id: number; dado_ate: string | null; contagens: Record<string, unknown> | null }[] | null) ?? [])[0];
  if (!e) return { estado: "sem_execucao" };
  if ((e.contagens?.ciclo_uf ?? uf) !== uf) return { estado: "sem_execucao" };
  const r = await db.from("pix_ciclo_plano").select("*").eq("execucao_id", e.id).order("prazo", { ascending: true, nullsFirst: false }).limit(2000);
  if (r.error) {
    console.error("ciclo do Pix (planos):", r.error.message);
    return { estado: "erro" };
  }
  return { estado: "ok", dado_ate: e.dado_ate, contagens: e.contagens ?? {}, planos: (r.data ?? []) as PlanoCicloPix[] };
}
