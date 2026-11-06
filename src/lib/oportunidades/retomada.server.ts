/**
 * O resumo do Pacto de Retomada por UF e do Brasil (`ret_resumo_uf`, oport_63; R2 de 05/11/2026). Só servidor, chave de
 * serviço; a página decide quem vê (cadastrado e acima). Sem a migração ou sem rodada: `sem_dado`. Memória de 10 minutos.
 * As obras de um município ou de um CNPJ são lidas pelo relatório (`relatorio-municipio.server.ts`).
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import type { ResumoRetomadaUf } from "./retomada";

export type LeituraRetomadaUf =
  | { estado: "sem_dado" }
  | { estado: "falha" }
  | { estado: "ok"; referencia: string | null; uf: ResumoRetomadaUf | null; brasil: ResumoRetomadaUf | null };

const memoria = criarMemoria<LeituraRetomadaUf>({ validadeMs: 10 * 60 * 1000, maximo: 30, guardar: (l) => l.estado === "ok" });

const COLUNAS =
  "uf,obras,municipios,valor_pactuado,valor_repassado,processos_com_saldo,saldo,processos_saldo_recente,saldo_recente,diligencias_abertas,por_situacao";

export function lerRetomadaUf(sigla: string): Promise<LeituraRetomadaUf> {
  const uf = String(sigla ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return Promise.resolve({ estado: "sem_dado" });
  return memoria.obter(uf, () => lerDoBanco(uf));
}

type Resposta<T> = { data: T | null; error: { code?: string; message: string } | null };

const numero = (x: unknown) => Number(x) || 0;

function resumo(r: Record<string, unknown>): ResumoRetomadaUf {
  return {
    uf: String(r.uf),
    obras: numero(r.obras),
    municipios: numero(r.municipios),
    valor_pactuado: numero(r.valor_pactuado),
    valor_repassado: numero(r.valor_repassado),
    processos_com_saldo: numero(r.processos_com_saldo),
    saldo: numero(r.saldo),
    processos_saldo_recente: numero(r.processos_saldo_recente),
    saldo_recente: numero(r.saldo_recente),
    diligencias_abertas: numero(r.diligencias_abertas),
    por_situacao: (r.por_situacao as ResumoRetomadaUf["por_situacao"]) ?? {},
  };
}

async function lerDoBanco(uf: string): Promise<LeituraRetomadaUf> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const ex = (await db.rpc("ret_ultima_execucao").select("id,dado_ate,referencia").limit(1)) as Resposta<{ id: number; dado_ate: string | null; referencia: string | null }[]>;
  if (ex.error) {
    if (ehEsquemaAusente(ex.error.code)) return { estado: "sem_dado" };
    console.error("retomada (execução):", ex.error.code, ex.error.message);
    return { estado: "falha" };
  }
  const e = (ex.data ?? [])[0];
  if (!e) return { estado: "sem_dado" };
  const linhas = (await db.from("ret_resumo_uf").select(COLUNAS).eq("execucao_id", e.id).in("uf", uf === "BR" ? ["BR"] : [uf, "BR"])) as Resposta<Record<string, unknown>[]>;
  if (linhas.error) {
    if (ehEsquemaAusente(linhas.error.code)) return { estado: "sem_dado" };
    console.error("retomada (resumo):", linhas.error.code, linhas.error.message);
    return { estado: "falha" };
  }
  const por = new Map((linhas.data ?? []).map((r) => [String(r.uf), resumo(r)]));
  return { estado: "ok", referencia: (e.dado_ate ?? e.referencia)?.slice(0, 10) ?? null, uf: uf === "BR" ? null : (por.get(uf) ?? null), brasil: por.get("BR") ?? null };
}

/** Uma obra do pacto vista pela empresa contratada (só o dossiê do fornecedor, que é do administrador). */
export interface ObraDoFornecedor {
  obrid: number;
  uf: string;
  ibge: string | null;
  municipio: string;
  nome: string;
  situacao_obra: string | null;
  pct_executado: number | null;
  valor_contrato: number | null;
  dt_assinatura_contrato: string | null;
  dt_fim_contrato: string | null;
}

export type LeituraRetomadaFornecedor = { estado: "sem_dado" } | { estado: "falha" } | { estado: "ok"; referencia: string | null; obras: ObraDoFornecedor[] };

/** As obras do Brasil inteiro em que a empresa é a contratada (`ret_obra.empresa_cnpj`). Sem memória: página de administrador. */
export async function lerRetomadaDoFornecedor(cnpj: string): Promise<LeituraRetomadaFornecedor> {
  if (!/^\d{14}$/.test(cnpj) || !authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const ex = (await db.rpc("ret_ultima_execucao").select("id,dado_ate,referencia").limit(1)) as Resposta<{ id: number; dado_ate: string | null; referencia: string | null }[]>;
  if (ex.error) return ehEsquemaAusente(ex.error.code) ? { estado: "sem_dado" } : { estado: "falha" };
  const e = (ex.data ?? [])[0];
  if (!e) return { estado: "sem_dado" };
  const r = (await db
    .from("ret_obra")
    .select("obrid,uf,ibge,municipio,nome,situacao_obra,pct_executado,valor_contrato,dt_assinatura_contrato,dt_fim_contrato")
    .eq("execucao_id", e.id)
    .eq("empresa_cnpj", cnpj)
    .order("uf")
    .order("municipio")
    .limit(500)) as Resposta<Record<string, unknown>[]>;
  if (r.error) {
    console.error("retomada (fornecedor):", r.error.code, r.error.message);
    return { estado: "falha" };
  }
  const nulo = (x: unknown) => (x === null || x === undefined || x === "" ? null : Number(x));
  return {
    estado: "ok",
    referencia: (e.dado_ate ?? e.referencia)?.slice(0, 10) ?? null,
    obras: (r.data ?? []).map((o) => ({ ...(o as unknown as ObraDoFornecedor), pct_executado: nulo(o.pct_executado), valor_contrato: nulo(o.valor_contrato) })),
  };
}
