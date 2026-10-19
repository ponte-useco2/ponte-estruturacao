/**
 * Leitura das emendas da Câmara de João Pessoa (J2, 16/10/2026) — só servidor, só chave de serviço. A lógica é
 * `emendas-jp.ts`.
 *
 * As tabelas `ejp_*` da oport_44 não aceitam `anon` nem `authenticated` (RLS sem política, grants só para
 * `service_role`). Quem decide se a pessoa pode ver é a página: as telas são de administrador; a sala usa um retrato
 * gerado à parte, só com fatos públicos.
 *
 * O retrato é pequeno (na execução 1, de 16/10/2026: 416 linhas do painel, 409 dotações, 140 credores, 193 empenhos do
 * TCE-PB, 1.175 emendas do histórico e 771 linhas da LOA), então é lido inteiro, em páginas de mil. A matéria do SAPL e
 * a série (`ejp_movimento`, de todas as rodadas) só são lidas por emenda, na página dela.
 *
 * Uma execução por leitura: a última concluída (`ejp_ultima_execucao`), cujo `id` filtra as tabelas. Memória por
 * instância de 10 minutos (`memoria.ts`), sem o cache comum. Tabela ausente ou nenhuma execução → `sem_dado`; outro erro
 * ou consulta acima de 8 s → `falha`, com `console.error` só do lugar e do código.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import { emendasPbDaEntidade } from "./emendas-pb";
import { lerAssembleia, lerFederalPorAno } from "./emendas-pb.server";
import type { EstadualAno } from "./lado-a-lado";
import { lerCadastroOsc } from "./osc.server";
import {
  emendaJpDaUrl,
  emendasDoRetrato,
  type CredorEjp,
  type DotacaoEjp,
  type EntidadeCitadaJp,
  type EmpenhoEjp,
  type ExecucaoEjp,
  type HistEmendaEjp,
  type HistLoaEjp,
  type LeituraCamaraJp,
  type LeituraEmendaJp,
  type LinhaEjp,
  type MateriaEjp,
  type MovimentoEjp,
  type PfEjp,
  type VereadorEjp,
} from "./emendas-jp";

type Banco = ReturnType<typeof clienteServidor>;
type Erro = { message: string; code?: string };
type Resposta = { data: unknown; error: Erro | null };

const TEMPO_LIMITE_MS = 8_000;
const VALIDADE_MS = 10 * 60 * 1000;
const PAGINA = 1000;
const MAX_PAGINAS = 20;

type Problema = { problema: "sem_dado" | "falha" };
const ehProblema = (x: unknown): x is Problema => !!x && typeof x === "object" && "problema" in (x as object);

function problemaDe(onde: string, erro: Erro): Problema {
  if (ehEsquemaAusente(erro.code)) return { problema: "sem_dado" };
  console.error(`emendas de João Pessoa (${onde}):`, erro.code ?? "sem código", erro.message);
  return { problema: "falha" };
}

async function uma<T>(onde: string, consulta: (sinal: AbortSignal) => PromiseLike<Resposta>): Promise<T | Problema> {
  try {
    const r = await consulta(AbortSignal.timeout(TEMPO_LIMITE_MS));
    if (r.error) return problemaDe(onde, r.error);
    return r.data as T;
  } catch (e) {
    console.error(`emendas de João Pessoa (${onde}):`, e instanceof Error ? e.message : "falha na leitura");
    return { problema: "falha" };
  }
}

async function todasAsLinhas<T>(onde: string, consulta: (inicio: number, fim: number, sinal: AbortSignal) => PromiseLike<Resposta>): Promise<T[] | Problema> {
  const saida: T[] = [];
  for (let p = 0; p < MAX_PAGINAS; p += 1) {
    const inicio = p * PAGINA;
    const lote = await uma<T[]>(onde, (sinal) => consulta(inicio, inicio + PAGINA - 1, sinal));
    if (ehProblema(lote)) return lote;
    const linhas = lote ?? [];
    saida.push(...linhas);
    if (linhas.length < PAGINA) return saida;
  }
  return saida;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};
const numOuNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));

/** Os valores (numeric) chegam como número ou texto: tudo vira número aqui, uma vez. */
function comNumeros<T extends Record<string, unknown>>(linhas: T[], campos: readonly string[], nulos: readonly string[] = []): T[] {
  return linhas.map((l) => {
    const c: Record<string, unknown> = { ...l };
    for (const k of campos) c[k] = num(l[k]);
    for (const k of nulos) c[k] = numOuNull(l[k]);
    return c as T;
  });
}

const COLUNAS = {
  vereador: "pessoa,tipo,sapl_autor,grafias_painel,grafias_loa,anos",
  linha:
    "ano,codigo,ug,vereador_publicado,pessoa,sapl_materia,objeto,cnpj_objeto,cnpj_objeto_invalido,dotacao,empenhado,liquidado,pago," +
    "situacao,remanejada,empenhos_n,pagamentos_n",
  dotacao: "ano,codigo,seq,data,valor_original,valor_atual",
  credor: "ano,codigo,ug,seq,credor_cnpj,credor_nome,funcao,acao,fonte,modalidade_licitacao,historico",
  empenho:
    "ano,ug_codigo,ug_nome,numero_empenho,seq,data_empenho,credor_cnpj,credor_nome,empenhado,liquidado,pago,elemento," +
    "modalidade_licitacao,numero_licitacao,historico,codigo_citado,ano_citado",
  pf: "ano,codigo,empenhado,liquidado,pago,notas",
  hist: "ano,mes_referencia,ug_codigo,ug_nome,codigo,objetivo,cnpj_objeto,cnpj_objeto_invalido,autor_publicado,pessoa,original,atual,empenhado,liquidado,pago",
  loa: "ano,codigo,seq,autor_publicado,pessoa,funcional,natureza,fonte,objetivo,valor",
  materia: "sapl_id,numero,ano,loa,pessoa,ementa,data_apresentacao,em_tramitacao,texto_url",
} as const;

async function lerExecucao(db: Banco): Promise<ExecucaoEjp | Problema> {
  const r = await uma<{ id: number; concluida_em: string; dado_ate: string | null; referencia: string | null; contagens: Record<string, unknown> | null }[]>(
    "execução",
    (sinal) => db.rpc("ejp_ultima_execucao").select("id,concluida_em,dado_ate,referencia,contagens").limit(1).abortSignal(sinal),
  );
  if (ehProblema(r)) return r;
  const e = (r ?? [])[0];
  if (!e) return { problema: "sem_dado" };
  const painel = e.contagens?.ejp_painel as Record<string, unknown> | undefined;
  return {
    id: num(e.id),
    concluidaEm: e.concluida_em,
    dadoAte: e.dado_ate ?? null,
    referencia: e.referencia ?? null,
    exercicio: painel && painel.ano !== undefined ? num(painel.ano) || null : null,
  };
}

const estadoDe = (p: Problema): { estado: "sem_dado" } | { estado: "falha" } => (p.problema === "sem_dado" ? { estado: "sem_dado" } : { estado: "falha" });

const retratos = criarMemoria<LeituraCamaraJp>({ validadeMs: VALIDADE_MS, maximo: 1, guardar: (l) => l.estado === "ok" });
const paginas = criarMemoria<LeituraEmendaJp>({
  validadeMs: VALIDADE_MS,
  maximo: 100,
  guardar: (l) => l.estado === "ok" || l.estado === "nao_encontrado",
});

/** O retrato inteiro da última rodada. Não altere o objeto. */
export function lerCamaraJp(): Promise<LeituraCamaraJp> {
  return retratos.obter("retrato", lerDoBanco);
}

async function lerDoBanco(): Promise<LeituraCamaraJp> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const execucao = await lerExecucao(db);
  if (ehProblema(execucao)) return estadoDe(execucao);
  const id = execucao.id;
  const tabela = <T,>(nome: string, colunas: string, ordem: string[]) =>
    todasAsLinhas<T>(nome, (a, b, sinal) => {
      let q = db.from(nome).select(colunas).eq("execucao_id", id);
      for (const o of ordem) q = q.order(o);
      return q.range(a, b).abortSignal(sinal);
    });
  const [vereadores, linhas, dotacoes, credores, empenhos, pf, hist, loa] = await Promise.all([
    tabela<VereadorEjp>("ejp_vereador", COLUNAS.vereador, ["pessoa"]),
    tabela<LinhaEjp>("ejp_linha", COLUNAS.linha, ["ano", "codigo", "ug"]),
    tabela<DotacaoEjp>("ejp_dotacao", COLUNAS.dotacao, ["ano", "codigo", "seq"]),
    tabela<CredorEjp>("ejp_credor", COLUNAS.credor, ["ano", "codigo", "ug", "seq"]),
    tabela<EmpenhoEjp>("ejp_empenho", COLUNAS.empenho, ["ano", "ug_codigo", "numero_empenho", "seq"]),
    tabela<PfEjp>("ejp_pf", COLUNAS.pf, ["ano", "codigo"]),
    tabela<HistEmendaEjp>("ejp_hist_emenda", COLUNAS.hist, ["ano", "ug_codigo", "codigo"]),
    tabela<HistLoaEjp>("ejp_hist_loa", COLUNAS.loa, ["ano", "codigo", "seq"]),
  ]);
  for (const x of [vereadores, linhas, dotacoes, credores, empenhos, pf, hist, loa]) if (ehProblema(x)) return estadoDe(x);
  return {
    estado: "ok",
    retrato: {
      execucao,
      vereadores: vereadores as VereadorEjp[],
      linhas: comNumeros(linhas as unknown as Record<string, unknown>[], ["ano", "codigo", "dotacao", "empenhado", "liquidado", "pago", "empenhos_n", "pagamentos_n"], ["sapl_materia"]) as unknown as LinhaEjp[],
      dotacoes: comNumeros(dotacoes as unknown as Record<string, unknown>[], ["ano", "codigo", "seq", "valor_original", "valor_atual"]) as unknown as DotacaoEjp[],
      credores: comNumeros(credores as unknown as Record<string, unknown>[], ["ano", "codigo", "seq"]) as unknown as CredorEjp[],
      empenhos: comNumeros(empenhos as unknown as Record<string, unknown>[], ["ano", "seq", "empenhado", "liquidado", "pago"], ["codigo_citado", "ano_citado"]) as unknown as EmpenhoEjp[],
      pf: comNumeros(pf as unknown as Record<string, unknown>[], ["ano", "empenhado", "liquidado", "pago", "notas"], ["codigo"]) as unknown as PfEjp[],
      hist: comNumeros(hist as unknown as Record<string, unknown>[], ["ano", "codigo", "original", "atual", "empenhado", "liquidado", "pago"]) as unknown as HistEmendaEjp[],
      loa: comNumeros(loa as unknown as Record<string, unknown>[], ["ano", "codigo", "seq", "valor"]) as unknown as HistLoaEjp[],
    },
  };
}

/** A página da emenda: o retrato, a matéria do SAPL e a série (o que mudou, rodada a rodada). */
export function lerEmendaJp(daUrl: string): Promise<LeituraEmendaJp> {
  return paginas.obter(daUrl, () => lerEmendaDoBanco(daUrl));
}

async function lerEmendaDoBanco(daUrl: string): Promise<LeituraEmendaJp> {
  const alvo = emendaJpDaUrl(daUrl);
  if (!alvo) return { estado: "nao_encontrado" };
  const leitura = await lerCamaraJp();
  if (leitura.estado !== "ok") return leitura;
  const { retrato } = leitura;
  const emenda = emendasDoRetrato(retrato).find((e) => e.ano === alvo.ano && e.codigo === alvo.codigo);
  if (!emenda) return { estado: "nao_encontrado" };
  const db = clienteServidor();
  const [materias, movimentos] = await Promise.all([
    uma<MateriaEjp[]>("matéria", (sinal) =>
      db.from("ejp_materia").select(COLUNAS.materia).eq("execucao_id", retrato.execucao.id).eq("loa", alvo.ano).eq("numero", alvo.codigo).limit(1).abortSignal(sinal),
    ),
    uma<{ execucao_id: number; ug: string; campo: string; antes: unknown; depois: unknown }[]>("movimento", (sinal) =>
      db.from("ejp_movimento").select("execucao_id,ug,campo,antes,depois").eq("ano", alvo.ano).eq("codigo", alvo.codigo).order("execucao_id").limit(2000).abortSignal(sinal),
    ),
  ]);
  if (ehProblema(materias)) return estadoDe(materias);
  if (ehProblema(movimentos)) return estadoDe(movimentos);
  const ids = [...new Set((movimentos ?? []).map((m) => m.execucao_id))];
  let referencias = new Map<number, string | null>();
  if (ids.length) {
    const execs = await uma<{ id: number; referencia: string | null }[]>("rodadas", (sinal) =>
      db.from("ejp_execucao").select("id,referencia").in("id", ids).abortSignal(sinal),
    );
    if (ehProblema(execs)) return estadoDe(execs);
    referencias = new Map((execs ?? []).map((e) => [num(e.id), e.referencia ?? null]));
  }
  const materia = (materias ?? [])[0];
  const entidade = emenda.cnpj ? await lerEntidadeCitada(emenda.cnpj) : null;
  return {
    estado: "ok",
    retrato,
    ano: alvo.ano,
    codigo: alvo.codigo,
    entidade,
    materia: materia ? { ...materia, sapl_id: num(materia.sapl_id), numero: num(materia.numero), ano: num(materia.ano), loa: num(materia.loa) } : null,
    movimentos: (movimentos ?? []).map(
      (m): MovimentoEjp => ({ referencia: referencias.get(num(m.execucao_id)) ?? null, ug: m.ug, campo: m.campo, antes: numOuNull(m.antes), depois: numOuNull(m.depois) }),
    ),
  };
}

/**
 * A entidade citada no objeto (J3, 19/10/2026): o cadastro no Mapa das OSC e o que ela recebeu de emendas federais
 * (canais com destino, `emd_canal`) e estaduais (credora do empenho, `epb_destino`), por ano. Cada parte falha
 * sozinha e vira null ("não lido agora"); a página nunca cai por ela.
 */
async function lerEntidadeCitada(cnpj: string): Promise<EntidadeCitadaJp> {
  const [osc, federal, assembleia] = await Promise.all([
    lerCadastroOsc(cnpj, null).catch(() => ({ estado: "indisponivel" as const })),
    lerFederalPorAno({ cnpj }).catch(() => ({ estado: "falha" as const })),
    lerAssembleia().catch(() => ({ estado: "falha" as const })),
  ]);
  let estadual: EstadualAno[] | null = null;
  if (assembleia.estado === "ok") {
    const porAno = new Map<number, EstadualAno>();
    for (const e of emendasPbDaEntidade(assembleia.retrato, cnpj).emendas) {
      const a = porAno.get(e.ano) ?? { ano: e.ano, empenhado: 0, pago: 0 };
      a.empenhado += e.empenhadoAqui;
      a.pago += e.pagoAqui;
      porAno.set(e.ano, a);
    }
    estadual = [...porAno.values()];
  }
  return {
    cnpj,
    osc:
      osc.estado === "ok"
        ? {
            estado: "ok",
            razaoSocial: osc.cadastro.razao_social,
            ativa: osc.cadastro.ativa,
            natureza: osc.cadastro.natureza_juridica,
            areas: osc.cadastro.areas ?? [],
            municipio: osc.cadastro.municipio,
          }
        : osc.estado === "nao_encontrado"
          ? { estado: "nao_encontrada" }
          : null,
    federal: federal.estado === "ok" ? federal.anos : federal.estado === "sem_dado" ? [] : null,
    estadual,
  };
}
