/**
 * Leitura do cadastro das OSC da PB (oport_32, job `osc_mapa`) — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página (o portão de aprovados do `/mapa`). O cadastro muda uma vez por mês;
 * a lista de um município (até ~2.400 linhas em João Pessoa) fica 10 minutos na memória da instância. Sem a
 * migração, ou sem carga, tudo volta null e as páginas seguem sem o bloco.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import type { CadastroOsc, FonteOsc, OscNaLista, ResumoOscMunicipio } from "./osc";
import { todas } from "./padroes.server";

type Banco = ReturnType<typeof clienteServidor>;

const COLUNAS_CADASTRO =
  "cnpj,cnpj_raiz,razao_social,nome_fantasia,natureza_juridica,matriz,situacao_cadastral,removida,ativa,dt_fundacao,dt_fechamento,cod_ibge,municipio,cnae_principal,areas,subareas,cebas";
const COLUNAS_LISTA = "cnpj,cnpj_raiz,razao_social,nome_fantasia,natureza_juridica,matriz,areas,dt_fundacao,municipio";

export interface CargaOsc {
  id: number;
  fonte: FonteOsc;
}

async function lerCarga(db: Banco): Promise<CargaOsc | null> {
  const r = await db.rpc("osc_ultima_execucao");
  if (r.error) {
    if (!ehEsquemaAusente(r.error.code)) console.error("cadastro das OSC (execução):", r.error.message);
    return null;
  }
  const ex = ((r.data as { id: number; versao_fonte: string | null; contagens: Record<string, unknown> | null }[] | null) ?? [])[0];
  if (!ex) return null;
  const cebas = (ex.contagens?.cebas ?? {}) as Record<string, { modificado?: string | null } | undefined>;
  return {
    id: ex.id,
    fonte: {
      versao: ex.versao_fonte,
      cebasLido: ex.contagens?.cebas_ok === true,
      cebasModificado: cebas.suas?.modificado ?? cebas.saude?.modificado ?? null,
    },
  };
}

export type LeituraCadastroOsc =
  | { estado: "ok"; cadastro: CadastroOsc; fonte: FonteOsc; matriz: { cnpj: string; nome: string | null } | null }
  | { estado: "nao_encontrado"; fonte: FonteOsc }
  | { estado: "indisponivel" };

/**
 * O cadastro de um CNPJ, e o da matriz quando é filial (para o link). `nao_encontrado` diz que a carga existe e o
 * CNPJ não está nela — a página explica que o Mapa não inclui cooperativas, sindicatos e o Sistema S.
 */
export async function lerCadastroOsc(cnpj: string, matriz: string | null): Promise<LeituraCadastroOsc> {
  if (!authConfigurada()) return { estado: "indisponivel" };
  const db = clienteServidor();
  const carga = await lerCarga(db);
  if (!carga) return { estado: "indisponivel" };
  const chaves = matriz && matriz !== cnpj ? [cnpj, matriz] : [cnpj];
  const r = await db.from("osc_entidade").select(COLUNAS_CADASTRO).eq("execucao_id", carga.id).in("cnpj", chaves).limit(2);
  if (r.error) {
    console.error("cadastro das OSC:", r.error.message);
    return { estado: "indisponivel" };
  }
  const linhas = (r.data ?? []) as unknown as CadastroOsc[];
  const cadastro = linhas.find((l) => l.cnpj === cnpj);
  if (!cadastro) return { estado: "nao_encontrado", fonte: carga.fonte };
  const m = linhas.find((l) => l.cnpj !== cnpj);
  return { estado: "ok", cadastro: { ...cadastro, cebas: cadastro.cebas ?? [] }, fonte: carga.fonte, matriz: m ? { cnpj: m.cnpj, nome: m.razao_social } : null };
}

export interface OscDoMunicipio {
  resumo: ResumoOscMunicipio;
  /** Só as ativas, para a lista. */
  ativas: OscNaLista[];
  fonte: FonteOsc;
}

const memoriaMunicipio = criarMemoria<OscDoMunicipio | null>({ validadeMs: 10 * 60 * 1000, maximo: 40, guardar: (x) => x !== null });
const memoriaResumo = criarMemoria<{ resumo: ResumoOscMunicipio; fonte: FonteOsc } | null>({ validadeMs: 10 * 60 * 1000, maximo: 230, guardar: (x) => x !== null });

/** Só o resumo (a aba do dinheiro do município): uma linha. */
export function lerResumoOscMunicipio(ibge: string): Promise<{ resumo: ResumoOscMunicipio; fonte: FonteOsc } | null> {
  return memoriaResumo.obter(ibge, async () => {
    if (!authConfigurada()) return null;
    const db = clienteServidor();
    const carga = await lerCarga(db);
    if (!carga) return null;
    const r = await db.from("osc_municipio").select("*").eq("execucao_id", carga.id).eq("cod_ibge", ibge).limit(1);
    if (r.error) {
      console.error("OSC do município (resumo):", r.error.message);
      return null;
    }
    const resumo = ((r.data ?? []) as unknown as ResumoOscMunicipio[])[0];
    return resumo ? { resumo, fonte: carga.fonte } : null;
  });
}

/** O resumo e todas as ativas do município (a página das organizações). */
export function lerOscDoMunicipio(ibge: string): Promise<OscDoMunicipio | null> {
  return memoriaMunicipio.obter(ibge, async () => {
    if (!authConfigurada()) return null;
    const db = clienteServidor();
    const carga = await lerCarga(db);
    if (!carga) return null;
    const [resumo, ativas] = await Promise.all([
      db.from("osc_municipio").select("*").eq("execucao_id", carga.id).eq("cod_ibge", ibge).limit(1),
      todas<OscNaLista>("OSC do município", (a, b) =>
        db.from("osc_entidade").select(COLUNAS_LISTA).eq("execucao_id", carga.id).eq("cod_ibge", ibge).eq("ativa", true).order("cnpj").range(a, b),
      ),
    ]);
    if (resumo.error || !Array.isArray(ativas)) {
      if (resumo.error) console.error("OSC do município (resumo):", resumo.error.message);
      return null;
    }
    const linha = ((resumo.data ?? []) as unknown as ResumoOscMunicipio[])[0];
    return linha ? { resumo: linha, ativas, fonte: carga.fonte } : null;
  });
}

export interface OscBusca extends OscNaLista {
  cod_ibge: string;
  ativa: boolean;
  removida: boolean;
  situacao_cadastral: string | null;
}

/**
 * Busca no cadastro pelo nome ou pelo CNPJ (cada termo, sem acento, tem de aparecer em `texto_busca`). As ativas
 * vêm primeiro; `total` é a contagem exata. Null quando não há cadastro.
 */
export async function buscarOsc(
  termos: string[],
  ibge: string | null,
  limite: number,
  deslocamento: number,
): Promise<{ linhas: OscBusca[]; total: number; fonte: FonteOsc } | null> {
  if (!authConfigurada()) return null;
  const db = clienteServidor();
  const carga = await lerCarga(db);
  if (!carga) return null;
  let q = db
    .from("osc_entidade")
    .select(`${COLUNAS_LISTA},cod_ibge,ativa,removida,situacao_cadastral`, { count: "exact" })
    .eq("execucao_id", carga.id);
  for (const t of termos) q = q.like("texto_busca", `%${t.replace(/[%_\\]/g, "")}%`);
  if (ibge) q = q.eq("cod_ibge", ibge);
  const r = await q.order("ativa", { ascending: false }).order("razao_social").order("cnpj").range(deslocamento, deslocamento + limite - 1);
  if (r.error) {
    console.error("busca de OSC:", r.error.message);
    return null;
  }
  return { linhas: (r.data ?? []) as unknown as OscBusca[], total: r.count ?? 0, fonte: carga.fonte };
}
