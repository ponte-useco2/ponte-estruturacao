/**
 * Leitura do laudo e da lista das suspensivas — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página (só administradores: o laudo nomeia servidores e
 * interpreta o andamento). As tabelas `exigencia_*` (oport_18) e `painel_*` não aceitam `anon` nem
 * `authenticated`; daqui para baixo, tudo é da chave de serviço e da última execução concluída.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import type { ContextoLaudo, Dossie, Lado } from "./laudo";

type Falha = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" };
type Banco = ReturnType<typeof clienteServidor>;

export interface ContextoPainel extends ContextoLaudo {
  nr_convenio: string;
  municipio: string | null;
  uf: string | null;
  cod_ibge: string | null;
  proponente: string | null;
  programa: string | null;
  objeto: string | null;
  modalidade: string | null;
  situacao: string | null;
}

const COLUNAS_BASE =
  "nr_convenio,municipio,uf,cod_ibge,proponente,orgao_sup,programa,objeto,modalidade,situacao," +
  "vl_repasse,vl_desembolsado,dt_assinatura,dt_suspensiva,dt_retirada_suspensiva,dt_fim_vigencia";
const COLUNAS_CONTEXTO = `${COLUNAS_BASE},motivo_suspensao`;

type Resposta = { data: unknown; error: { message: string; code?: string } | null };

/**
 * O site pode ir ao ar antes da oport_18b (a coluna `motivo_suspensao`). Coluna inexistente é o erro
 * 42703 do Postgres: nesse caso a leitura se repete sem ela, e o laudo diz "não informado" em vez de cair.
 */
async function comMotivo(consulta: (colunas: string) => PromiseLike<Resposta>): Promise<Resposta> {
  const r = await consulta(COLUNAS_CONTEXTO);
  if (r.error && (r.error.code === "42703" || /motivo_suspensao/.test(r.error.message))) return consulta(COLUNAS_BASE);
  return r;
}

export type LeituraLaudo =
  | { estado: "ok"; dossie: Dossie; contexto: ContextoPainel }
  | { estado: "sem_coleta"; contexto: ContextoPainel | null; coletadoEm: string | null }
  | Falha;

function falha(onde: string, erro: { message: string; code?: string }): Falha {
  if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
  console.error(`${onde}:`, erro.message);
  return { estado: "erro" };
}

async function execucaoPainel(db: Banco): Promise<number | Falha> {
  const r = await db.rpc("painel_ultima_execucao");
  if (r.error) return falha("laudo (painel)", r.error);
  const id = (r.data as { id: number }[] | null)?.[0]?.id;
  return id ?? { estado: "sem_execucao" };
}

/** O dossiê de um convênio e o contexto do painel, para montar o laudo. */
export async function lerLaudoInstrumento(numero: string): Promise<LeituraLaudo> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();

  const [dossie, painel] = await Promise.all([db.rpc("exigencia_dossie", { p_numero: numero }), execucaoPainel(db)]);
  if (dossie.error) return falha("lerLaudoInstrumento (dossiê)", dossie.error);
  if (typeof painel !== "number") return painel;

  const linha = await comMotivo((colunas) => db.from("painel_instrumento").select(colunas).eq("execucao_id", painel).eq("nr_convenio", numero).limit(1));
  if (linha.error) return falha("lerLaudoInstrumento (contexto)", linha.error);
  const contexto = ((linha.data ?? []) as unknown as ContextoPainel[])[0] ?? null;

  const d = dossie.data as Dossie | null;
  if (!d || !d.instrumento) return { estado: "sem_coleta", contexto, coletadoEm: d?.coletado_em ?? null };
  if (!contexto) return { estado: "sem_coleta", contexto: null, coletadoEm: d.coletado_em };
  return { estado: "ok", dossie: d, contexto };
}

// ================================================================ lista

export interface LinhaSuspensiva {
  numero: string;
  proposta: string | null;
  vez_de: Lado | null;
  ultimo_evento: string | null;
  parado_desde: string | null;
  rodadas_de_exigencia: number;
  envios_do_municipio: number;
  documentos: number;
  contexto: ContextoPainel | null;
}

export type LeituraSuspensivas =
  | { estado: "ok"; linhas: LinhaSuspensiva[]; coletadoEm: string | null; referencia: string | null }
  | Falha;

/** Os instrumentos da última coleta, cada um com o contexto do painel. */
export async function lerSuspensivas(): Promise<LeituraSuspensivas> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();

  const ex = await db.rpc("exigencia_ultima_execucao");
  if (ex.error) return falha("lerSuspensivas (execução)", ex.error);
  const execucao = (ex.data as { id: number; concluida_em: string; referencia: string | null }[] | null)?.[0];
  if (!execucao) return { estado: "sem_execucao" };

  const inst = await db
    .from("exigencia_instrumento")
    .select("numero,proposta,vez_de,ultimo_evento,parado_desde,rodadas_de_exigencia,envios_do_municipio,documentos")
    .eq("execucao_id", execucao.id)
    .is("erro", null)
    .limit(2000);
  if (inst.error) return falha("lerSuspensivas (instrumentos)", inst.error);
  const linhas = (inst.data ?? []) as Omit<LinhaSuspensiva, "contexto">[];

  const painel = await execucaoPainel(db);
  if (typeof painel !== "number") return painel;

  // Em lotes: 288 números cabem numa chamada, mas o filtro `in` vai na URL e ela tem limite.
  const contextos = new Map<string, ContextoPainel>();
  for (let i = 0; i < linhas.length; i += 200) {
    const lote = linhas.slice(i, i + 200).map((l) => l.numero);
    const r = await comMotivo((colunas) => db.from("painel_instrumento").select(colunas).eq("execucao_id", painel).in("nr_convenio", lote));
    if (r.error) return falha("lerSuspensivas (contexto)", r.error);
    for (const c of (r.data ?? []) as unknown as ContextoPainel[]) contextos.set(c.nr_convenio, c);
  }

  return {
    estado: "ok",
    linhas: linhas.map((l) => ({ ...l, contexto: contextos.get(l.numero) ?? null })),
    coletadoEm: execucao.concluida_em,
    referencia: execucao.referencia,
  };
}
