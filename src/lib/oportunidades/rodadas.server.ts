/**
 * Leitura da saúde das rodadas (onda 9, C, 09/10/2026) — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página (só administradores). Para cada job de `JOBS_RODADAS`, duas consultas à
 * sua tabela `*_execucao`: a última concluída (a mesma ordem de `<prefixo>_ultima_execucao`, `concluida_em desc`) e as
 * últimas que não concluíram ("gravando" ou "erro"). Só as colunas que a tela usa: a `erro`, texto livre, não é lida.
 *
 * Cada job falha sozinho: tabela que não existe (migração não aplicada) ou consulta que não responde em 8 s vira
 * "não lido" naquela linha, e as outras seguem. O GitHub é opcional: sem `GITHUB_DISPARO_TOKEN` (o mesmo do agendador,
 * já na Vercel), a seção diz "não configurado"; com ele, uma chamada por workflow, também com tempo-limite.
 *
 * Volume: 14 linhas, 28 consultas pequenas em paralelo (uma linha e até 20 linhas) e 7 chamadas ao GitHub.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import {
  JOBS_RODADAS,
  WORKFLOWS_DAS_RODADAS,
  avaliarRodada,
  ultimaNoGithub,
  type ExecucaoAberta,
  type ExecucaoConcluida,
  type JobRodada,
  type LeituraRodada,
  type LinhaRodada,
  type RodadaGithub,
} from "./rodadas";

type Banco = ReturnType<typeof clienteServidor>;

const TEMPO_LIMITE_MS = 8_000;
const COLUNAS_CONCLUIDA = "id,iniciada_em,concluida_em,contagens";
const COLUNAS_ABERTA = "id,status,iniciada_em";
/** As últimas execuções não concluídas de cada job: basta para achar a "gravando" parada e o erro mais novo. */
const ABERTAS = 20;

async function lerJob(db: Banco, job: JobRodada): Promise<LeituraRodada> {
  try {
    let concluida = db.from(job.tabela).select(COLUNAS_CONCLUIDA).eq("status", "concluida");
    let abertas = db.from(job.tabela).select(COLUNAS_ABERTA).in("status", ["gravando", "erro"]);
    if (job.recorte) {
      concluida = concluida.eq("recorte", job.recorte);
      abertas = abertas.eq("recorte", job.recorte);
    }
    const [c, a] = await Promise.all([
      concluida.order("concluida_em", { ascending: false, nullsFirst: false }).limit(1).abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS)),
      abertas.order("iniciada_em", { ascending: false }).limit(ABERTAS).abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS)),
    ]);
    const erro = c.error ?? a.error;
    if (erro) {
      if (ehEsquemaAusente(erro.code)) return { estado: "nao_lido", motivo: "ausente" };
      console.error(`rodadas (${job.id}):`, erro.message);
      return { estado: "nao_lido", motivo: "falha" };
    }
    return {
      estado: "ok",
      ultima: ((c.data ?? []) as ExecucaoConcluida[])[0] ?? null,
      abertas: (a.data ?? []) as ExecucaoAberta[],
    };
  } catch (e) {
    console.error(`rodadas (${job.id}):`, e instanceof Error ? e.message : "falha na leitura");
    return { estado: "nao_lido", motivo: "falha" };
  }
}

/** A última execução de cada workflow no GitHub; null quando o token não está configurado. */
async function lerGithub(): Promise<RodadaGithub[] | null> {
  const token = process.env.GITHUB_DISPARO_TOKEN;
  if (!token) return null;
  return Promise.all(WORKFLOWS_DAS_RODADAS.map((w) => ultimaNoGithub(token, w)));
}

export interface PainelRodadas {
  /** O instante da leitura (ISO): "há quanto tempo" é contado até ele. */
  lidoEm: string;
  linhas: LinhaRodada[];
  /** null: `GITHUB_DISPARO_TOKEN` não configurado. */
  github: RodadaGithub[] | null;
}

export async function lerRodadas(): Promise<PainelRodadas> {
  const agora = Date.now();
  const db = authConfigurada() ? clienteServidor() : null;
  const [leituras, github] = await Promise.all([
    Promise.all(JOBS_RODADAS.map((j): Promise<LeituraRodada> => (db ? lerJob(db, j) : Promise.resolve({ estado: "nao_lido", motivo: "falha" })))),
    lerGithub(),
  ]);
  return {
    lidoEm: new Date(agora).toISOString(),
    linhas: JOBS_RODADAS.map((j, k) => avaliarRodada(j, leituras[k], agora)),
    github,
  };
}
