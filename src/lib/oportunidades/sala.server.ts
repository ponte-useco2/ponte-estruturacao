/**
 * Leitura da sala do cliente (14/10/2026) — só servidor, só chave de serviço: os programas do Transferegov abertos
 * agora a uma OSC da UF, da última rodada concluída do radar de janelas. Falha sozinha (a sala mostra o resto) e fica
 * 10 minutos na memória da instância: o radar roda uma vez por dia.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { NATUREZA_OSC, programasParaOsc, type LinhaRadarPrograma, type ProgramaAberto } from "./sala-programas";

export type LeituraProgramas =
  | { estado: "ok"; referencia: string | null; concluidaEm: string | null; programas: ProgramaAberto[] }
  | { estado: "indisponivel" };

const VALIDADE_MS = 10 * 60 * 1000;
const memoria = new Map<string, { em: number; leitura: LeituraProgramas }>();

export async function lerProgramasParaOsc(uf: string, hoje: string): Promise<LeituraProgramas> {
  const chave = `${uf}|${hoje}`;
  const guardada = memoria.get(chave);
  if (guardada && Date.now() - guardada.em < VALIDADE_MS) return guardada.leitura;
  if (!authConfigurada()) return { estado: "indisponivel" };
  try {
    const db = clienteServidor();
    const exec = await db.from("radar_execucao").select("id,referencia,concluida_em").eq("status", "concluida")
      .order("id", { ascending: false }).limit(1);
    const ultima = exec.data?.[0] as { id: number; referencia: string | null; concluida_em: string | null } | undefined;
    if (exec.error || !ultima) throw new Error(exec.error?.message ?? "sem rodada concluída do radar");
    const r = await db.from("radar_programa_aberto")
      .select("cod_programa,programa,orgao,canal,abre,fecha,naturezas")
      .eq("execucao_id", ultima.id).eq("uf", uf).contains("naturezas", [NATUREZA_OSC]).limit(2000);
    if (r.error) throw new Error(r.error.message);
    const leitura: LeituraProgramas = {
      estado: "ok",
      referencia: ultima.referencia,
      concluidaEm: ultima.concluida_em,
      programas: programasParaOsc((r.data ?? []) as LinhaRadarPrograma[], hoje),
    };
    memoria.set(chave, { em: Date.now(), leitura });
    return leitura;
  } catch (e) {
    console.error("[sala] programas abertos indisponíveis:", e instanceof Error ? e.message : e);
    return { estado: "indisponivel" };
  }
}
