/**
 * Leitura da cadeia quebrada do gasto (PUB-11, 29/10/2026) — só servidor, chave de serviço. A última execução
 * concluída de `cq_execucao` e as linhas dela (oport_56); os conjuntos por órgão ficam fora da consulta.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { VALIDADE_DADOS_MS } from "./cache-dados";
import { montarCadeia, type CadeiaQuebrada, type ExecucaoCq, type LinhaCq } from "./cadeia-quebrada";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";

export type LeituraCadeia =
  | { estado: "nao_ativado" | "sem_execucao" | "erro" }
  | { estado: "ok"; execucao: ExecucaoCq; cadeia: CadeiaQuebrada };

const COLUNAS_EXECUCAO =
  "id,concluida_em,dado_ate,sha256_pacote,versao_pacote,gerado_em,regra_versao,regra_fecha,limiar_precisao,contagens,cobertura,regra_alcance";

async function lerDoBanco(): Promise<LeituraCadeia> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ultima = await db.rpc("cq_ultima_execucao").select(COLUNAS_EXECUCAO);
  if (ultima.error) {
    if (ehEsquemaAusente(ultima.error.code)) return { estado: "nao_ativado" };
    console.error("cadeia quebrada:", ultima.error.message);
    return { estado: "erro" };
  }
  const ex = (ultima.data as ExecucaoCq[] | null)?.[0];
  if (!ex) return { estado: "sem_execucao" };
  const r = await db
    .from("cq_resultado")
    .select("conjunto,ordem,orgao,situacao,confianca,soma_como_fecha,pares,pago")
    .eq("execucao_id", ex.id)
    .in("conjunto", ["notas", "emendas", "sancoes_classe"])
    .order("conjunto")
    .order("ordem")
    .limit(500);
  if (r.error) {
    console.error("cadeia quebrada (resultado):", r.error.message);
    return { estado: "erro" };
  }
  return { estado: "ok", execucao: ex, cadeia: montarCadeia(ex, (r.data ?? []) as LinhaCq[]) };
}

const memoria = criarMemoria<LeituraCadeia>({ validadeMs: VALIDADE_DADOS_MS, maximo: 2, guardar: (l) => l.estado === "ok" });

/** A última geração carregada, da memória quando há (10 minutos). Não altere o objeto devolvido. */
export function lerCadeiaQuebrada(): Promise<LeituraCadeia> {
  return memoria.obter("cq", lerDoBanco);
}
