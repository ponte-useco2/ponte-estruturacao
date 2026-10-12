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
 * A data do dado (10/10/2026, onda 11, B): nos jobs que a gravam na coluna `dado_ate`, uma terceira consulta lê só
 * `id,dado_ate` da última concluída. Ela falha sozinha: a coluna "dado até" diz "não lido" e o resto da linha segue. Nos
 * que a gravam no `contagens` (fiscal, Pix, ciclo, OSC e, desde 12/10/2026, onda 12, C, os municípios), a primeira
 * consulta já a traz. Nos municípios, das `contagens` a data sai só de `periodo_por_fonte`, filtrado em
 * `periodosPorFonte` (nome de fonte e "AAAA" ou "AAAA-MM"; o resto é descartado): nem a coluna `erro` nem as mensagens
 * dos `avisos` entram. Não há consulta a mais: o `id` é o da própria execução.
 *
 * O GitHub é pedido por quem lê (12/10/2026, onda 12, C, M6 da revisão da onda 11): a tela pede, e o resumo diário
 * (`/api/painel/resumo-diario`) chama `lerRodadas({ github: false })`, porque o e-mail não usa a coluna do GitHub.
 * Fica de fora o `import "server-only"`: ele pede o pacote no `web/package.json`, que é de outra sessão.
 *
 * Volume: uma linha por job de `JOBS_RODADAS`, duas consultas pequenas por linha (uma linha e até 20 linhas), mais a
 * do `dado_ate` nas que a gravam na coluna, todas em paralelo, e, na tela, uma chamada ao GitHub por workflow. Com as
 * emendas (onda 14, integração, 12/10/2026): 15 linhas, 40 consultas e 8 chamadas.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import {
  JOBS_RODADAS,
  WORKFLOWS_DAS_RODADAS,
  avaliarRodada,
  leituraDasConsultas,
  ultimaNoGithub,
  type JobRodada,
  type LeituraDadoAte,
  type LeituraRodada,
  type LinhaRodada,
  type RodadaGithub,
} from "./rodadas";

type Banco = ReturnType<typeof clienteServidor>;

const TEMPO_LIMITE_MS = 8_000;
const COLUNAS_CONCLUIDA = "id,iniciada_em,concluida_em,contagens";
const COLUNAS_ABERTA = "id,status,iniciada_em";
const COLUNAS_DADO = "id,dado_ate";
/** As últimas execuções não concluídas de cada job: basta para achar a "gravando" parada e o erro mais novo. */
const ABERTAS = 20;

/**
 * A coluna `dado_ate` da última concluída (10/10/2026, onda 11, B). Nunca rejeita: o erro vira "falha", e só a coluna
 * "dado até" da linha diz "não lido". A mesma ordem da outra consulta; o `id` confere que é a mesma execução.
 */
async function lerDadoAte(db: Banco, job: JobRodada): Promise<LeituraDadoAte> {
  try {
    let q = db.from(job.tabela).select(COLUNAS_DADO).eq("status", "concluida");
    if (job.recorte) q = q.eq("recorte", job.recorte);
    const { data, error } = await q
      .order("concluida_em", { ascending: false, nullsFirst: false })
      .limit(1)
      .abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));
    if (error) {
      // A tabela que não existe (onda 14, integração, 12/10/2026: a `emd_execucao` antes da oport_39) já é "não lido"
      // pela consulta principal; aqui não se registra de novo como erro, a cada tela e a cada e-mail.
      if (!ehEsquemaAusente(error.code)) console.error(`rodadas (${job.id}, dado_ate):`, error.message);
      return { estado: "falha" };
    }
    const linha = ((data ?? []) as { id: number; dado_ate: string | null }[])[0];
    return { estado: "ok", id: linha?.id ?? null, dadoAte: linha?.dado_ate ?? null };
  } catch (e) {
    console.error(`rodadas (${job.id}, dado_ate):`, e instanceof Error ? e.message : "falha na leitura");
    return { estado: "falha" };
  }
}

async function lerJob(db: Banco, job: JobRodada): Promise<LeituraRodada> {
  try {
    let concluida = db.from(job.tabela).select(COLUNAS_CONCLUIDA).eq("status", "concluida");
    let abertas = db.from(job.tabela).select(COLUNAS_ABERTA).in("status", ["gravando", "erro"]);
    if (job.recorte) {
      concluida = concluida.eq("recorte", job.recorte);
      abertas = abertas.eq("recorte", job.recorte);
    }
    const [c, a, dadoAte] = await Promise.all([
      concluida.order("concluida_em", { ascending: false, nullsFirst: false }).limit(1).abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS)),
      abertas.order("iniciada_em", { ascending: false }).limit(ABERTAS).abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS)),
      job.dado?.origem === "coluna" ? lerDadoAte(db, job) : Promise.resolve(undefined),
    ]);
    // A tabela que não existe vira "não lido" (ausente), sem log; o outro erro, "não lido" (falha), com log. A regra
    // mora em `leituraDasConsultas`, que o teste exercita (onda 14, integração, 12/10/2026).
    const leitura = leituraDasConsultas(c, a, dadoAte);
    if (leitura.estado === "nao_lido" && leitura.motivo === "falha") console.error(`rodadas (${job.id}):`, (c.error ?? a.error)?.message);
    return leitura;
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
  /** null: `GITHUB_DISPARO_TOKEN` não configurado, ou a leitura foi pedida sem o GitHub (`github: false`). */
  github: RodadaGithub[] | null;
}

export interface OpcoesRodadas {
  /**
   * false: não chama o GitHub, e `github` vem null (12/10/2026, onda 12, C). O resumo diário pede assim: o e-mail não
   * usa a coluna, e o token não precisa sair para isso. Padrão: true (a tela).
   */
  github?: boolean;
}

export async function lerRodadas({ github: comGithub = true }: OpcoesRodadas = {}): Promise<PainelRodadas> {
  const agora = Date.now();
  const db = authConfigurada() ? clienteServidor() : null;
  const [leituras, github] = await Promise.all([
    Promise.all(JOBS_RODADAS.map((j): Promise<LeituraRodada> => (db ? lerJob(db, j) : Promise.resolve({ estado: "nao_lido", motivo: "falha" })))),
    comGithub ? lerGithub() : Promise.resolve(null),
  ]);
  return {
    lidoEm: new Date(agora).toISOString(),
    linhas: JOBS_RODADAS.map((j, k) => avaliarRodada(j, leituras[k], agora)),
    github,
  };
}
