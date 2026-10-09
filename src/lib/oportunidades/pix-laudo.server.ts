/**
 * Leitura do laudo do plano de ação do Pix (onda 13A) — só servidor, só chave de serviço.
 *
 * As tabelas da `oport_23` não aceitam `anon` nem `authenticated`. Quem decide se a pessoa pode ver é a
 * página: administrador vê tudo; o cliente, só os planos do próprio município (`podeVerPlanoPix`). O que
 * o cliente não pode ver, esta leitura não devolve para a página decidir depois — a conferência vem antes.
 *
 * O TCE-PB (pessoal, dívida e capital pagos com a fonte do Pix) vem da execução própria do TCE
 * (`tce_ultima_execucao`, oport_22), por município e ano. Falha no TCE não derruba o laudo: vira `null`.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import type { ExecucaoPix } from "./pix";
import { planoSemContato, type AutorLaudoPix, type PlanoLaudoPix, type ResumoLaudoPix } from "./pix-laudo";
import type { TceExecucao, TcePixMunicipio } from "./tce";

type Banco = ReturnType<typeof clienteServidor>;
type Falha = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" };

function falha(onde: string, erro: { message: string; code?: string }): Falha {
  if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
  console.error(`${onde}:`, erro.message);
  return { estado: "erro" };
}

async function execucaoPix(db: Banco): Promise<ExecucaoPix | Falha> {
  const r = await db.rpc("pix_ultima_execucao");
  if (r.error) return falha("laudo do Pix (execução)", r.error);
  return ((r.data as ExecucaoPix[] | null)?.[0] ?? { estado: "sem_execucao" }) as ExecucaoPix | Falha;
}

const ehFalha = (x: unknown): x is Falha => !!x && typeof x === "object" && "estado" in (x as object);

/** O Pix do município no TCE-PB, ano a ano. `null` quando a leitura falha (complemento). */
async function tceDoMunicipio(db: Banco, ibge: string | null): Promise<TcePixMunicipio[] | null> {
  if (!ibge) return [];
  const ex = await db.rpc("tce_ultima_execucao");
  if (ex.error) {
    if (!ehEsquemaAusente(ex.error.code)) console.error("laudo do Pix (TCE-PB):", ex.error.message);
    return null;
  }
  const execucao = (ex.data as TceExecucao[] | null)?.[0];
  if (!execucao) return [];
  const r = await db.from("tce_pix_municipio").select("*").eq("execucao_id", execucao.id).eq("ibge", ibge).order("ano").limit(20);
  if (r.error) {
    console.error("laudo do Pix (TCE-PB):", r.error.message);
    return null;
  }
  return (r.data ?? []) as TcePixMunicipio[];
}

// ================================================================ um plano

export type LeituraLaudoPlanoPix =
  | Falha
  | { estado: "nao_encontrado" }
  | { estado: "ok"; execucao: ExecucaoPix; plano: PlanoLaudoPix; autor: AutorLaudoPix | null; tce: TcePixMunicipio[] | null };

/**
 * `podeVer`, quando vem (cliente), é conferido ANTES das leituras complementares: plano que não passa é
 * "não encontrado", e a página não diz se ele existe.
 */
export async function lerLaudoPlanoPix(id: number, podeVer?: (p: PlanoLaudoPix) => boolean): Promise<LeituraLaudoPlanoPix> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const execucao = await execucaoPix(db);
  if (ehFalha(execucao)) return execucao;
  const r = await db.from("pix_laudo_plano").select("*").eq("execucao_id", execucao.id).eq("id_plano_acao", id).limit(1);
  if (r.error) return falha("laudo do Pix (plano)", r.error);
  const lido = (r.data as PlanoLaudoPix[] | null)?.[0];
  if (!lido || (podeVer && !podeVer(lido))) return { estado: "nao_encontrado" };
  const plano = planoSemContato(lido);

  const [autores, tce] = await Promise.all([
    plano.autor
      ? db.from("pix_laudo_autor").select("*").eq("execucao_id", execucao.id).eq("ano", plano.ano).eq("autor", plano.autor).limit(1)
      : Promise.resolve({ data: [], error: null }),
    tceDoMunicipio(db, plano.cod_ibge),
  ]);
  if (autores.error) console.error("laudo do Pix (autor):", autores.error.message);
  return {
    estado: "ok",
    execucao,
    plano,
    autor: ((autores.data ?? []) as AutorLaudoPix[])[0] ?? null,
    tce,
  };
}

// ================================================================ um ente

export type LeituraLaudoEntePix =
  | Falha
  | { estado: "nao_encontrado" }
  | { estado: "ok"; execucao: ExecucaoPix; planos: PlanoLaudoPix[]; tce: TcePixMunicipio[] | null };

/** Os planos de um ente, pelo CNPJ ou pelo IBGE, do mais recente ao mais antigo. */
export async function lerLaudoEntePix(
  chave: { tipo: "cnpj" | "ibge"; valor: string },
  podeVer?: (p: PlanoLaudoPix) => boolean,
): Promise<LeituraLaudoEntePix> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const execucao = await execucaoPix(db);
  if (ehFalha(execucao)) return execucao;
  const campo = chave.tipo === "cnpj" ? "cnpj" : "cod_ibge";
  const r = await db
    .from("pix_laudo_plano")
    .select("*")
    .eq("execucao_id", execucao.id)
    .eq(campo, chave.valor)
    .order("ano", { ascending: false })
    .order("pago", { ascending: false })
    .limit(1000);
  if (r.error) return falha("laudo do Pix (ente)", r.error);
  const planos = ((r.data ?? []) as PlanoLaudoPix[]).map(planoSemContato);
  if (!planos.length || (podeVer && !planos.every(podeVer))) return { estado: "nao_encontrado" };
  return { estado: "ok", execucao, planos, tce: await tceDoMunicipio(db, planos[0].cod_ibge) };
}

// ================================================================ resumo (painel)

export interface ResumoPainelLaudoPix {
  resumo: ResumoLaudoPix[];
  titulos: Record<string, string>;
}

/** O resumo por item da execução do painel. `null` quando a oport_23 não está ativa ou a leitura falha. */
export async function lerResumoLaudoPix(execucaoId: number): Promise<ResumoPainelLaudoPix | null> {
  if (!authConfigurada()) return null;
  const db = clienteServidor();
  const [resumo, amostra] = await Promise.all([
    db.from("pix_laudo_resumo").select("*").eq("execucao_id", execucaoId).limit(1000),
    db.from("pix_laudo_plano").select("itens").eq("execucao_id", execucaoId).not("situacao", "like", "IMPEDIDO%").limit(1),
  ]);
  const erro = resumo.error ?? amostra.error;
  if (erro) {
    if (!ehEsquemaAusente(erro.code)) console.error("laudo do Pix (resumo):", erro.message);
    return null;
  }
  const itens = ((amostra.data ?? []) as Pick<PlanoLaudoPix, "itens">[])[0]?.itens ?? [];
  return {
    resumo: (resumo.data ?? []) as ResumoLaudoPix[],
    titulos: Object.fromEntries(itens.map((i) => [i.item, i.titulo])),
  };
}
