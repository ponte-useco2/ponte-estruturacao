/**
 * Leitura das emendas estaduais da PB (E2, 16/10/2026) — só servidor, só chave de serviço. A lógica é `emendas-pb.ts`.
 *
 * As tabelas `epb_*` da oport_41 não aceitam `anon` nem `authenticated` (RLS sem política, grants só para
 * `service_role`). Quem decide se a pessoa pode ver é a página: todas são de administrador até a revisão jurídica.
 *
 * O retrato é pequeno (na execução 1, de 16/10/2026: 3.563 fichas, 3.522 linhas de catálogo, 3.052 destinos, 60 autores
 * e 20 linhas de pessoa física), então é lido inteiro, em páginas de mil, e as telas somam em memória — sem função de
 * leitura no banco e sem migração nova. O caminho com os pareceres (`epb_tramite`, ~16 mil linhas com texto) só é lido
 * por emenda, na página dela.
 *
 * Uma execução só por leitura: a última concluída (`epb_ultima_execucao`) vem primeiro, e o `id` dela filtra todas as
 * tabelas. Memória por instância de 10 minutos (`memoria.ts`), sem o cache comum: o dado é só de administrador. Fica o
 * "ok" (e, na emenda, o "não encontrado"); `sem_dado` e `falha` voltam sem ficar.
 *
 * Os estados: tabela ausente (`ehEsquemaAusente`) ou nenhuma execução concluída → `sem_dado`; outro erro ou consulta
 * acima de 8 s → `falha`, com `console.error` só do lugar e do código, nunca das linhas.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import {
  emendaDaUrl,
  type AutorEpb,
  type CatalogoEpb,
  type DestinoEpb,
  type ExecucaoEpb,
  type FichaEpb,
  type LeituraAssembleia,
  type LeituraEmendaEpb,
  type PfEpb,
  type TramiteEpb,
} from "./emendas-pb";
import type { CoberturaEstado, DespesaEstado, LeituraTceEstadoMunicipio, ReceitaEstado } from "./tce-estado";
import { federalPorAno, type LeituraFederalPorAno } from "./lado-a-lado";

type Banco = ReturnType<typeof clienteServidor>;
type Erro = { message: string; code?: string };
type Resposta = { data: unknown; error: Erro | null };

const TEMPO_LIMITE_MS = 8_000;
const VALIDADE_MS = 10 * 60 * 1000;
const PAGINA = 1000;
const MAX_PAGINAS = 50;

type Problema = { problema: "sem_dado" | "falha" };
const ehProblema = (x: unknown): x is Problema => !!x && typeof x === "object" && "problema" in (x as object);

function problemaDe(onde: string, erro: Erro): Problema {
  if (ehEsquemaAusente(erro.code)) return { problema: "sem_dado" };
  console.error(`emendas estaduais (${onde}):`, erro.code ?? "sem código", erro.message);
  return { problema: "falha" };
}

async function uma<T>(onde: string, consulta: (sinal: AbortSignal) => PromiseLike<Resposta>): Promise<T | Problema> {
  try {
    const r = await consulta(AbortSignal.timeout(TEMPO_LIMITE_MS));
    if (r.error) return problemaDe(onde, r.error);
    return r.data as T;
  } catch (e) {
    console.error(`emendas estaduais (${onde}):`, e instanceof Error ? e.message : "falha na leitura");
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

const COLUNAS_FICHA =
  "ano,emenda,prioridade,deputado_publicado,pessoa,autoria_divergente,no_catalogo,tipo,secretaria,objeto,retificacao_objeto," +
  "beneficiario_final,beneficiario_retido,tipo_entidade,valor,passo,passo_em,devolvida,datas_fora_de_ordem";
const COLUNAS_CATALOGO =
  "ano,emenda,seq,autor_publicado,pessoa,orgao,unidade,funcao,subfuncao,programa,acao,natureza,fonte_recurso,modalidade,elemento," +
  "valor_emenda,empenhado,liquidado,pago";
const COLUNAS_DESTINO = "ano,emenda,credor_cnpj,credor_nome,ibge,municipio,orgao,orgao_codigo,empenhado,liquidado,pago,notas,primeira,ultima";

async function lerExecucao(db: Banco): Promise<ExecucaoEpb | Problema> {
  const r = await uma<{ id: number; concluida_em: string; dado_ate: string | null; referencia: string | null; contagens: Record<string, unknown> | null }[]>(
    "execução",
    (sinal) => db.rpc("epb_ultima_execucao").select("id,concluida_em,dado_ate,referencia,contagens").limit(1).abortSignal(sinal),
  );
  if (ehProblema(r)) return r;
  const e = (r ?? [])[0];
  if (!e) return { problema: "sem_dado" };
  const anos = e.contagens?.epb_anos_lidos;
  return {
    id: num(e.id),
    concluidaEm: e.concluida_em,
    dadoAte: e.dado_ate ?? null,
    referencia: e.referencia ?? null,
    anosLidos: Array.isArray(anos) ? anos.map(num).filter((x) => x > 0) : [],
  };
}

const estadoDe = (p: Problema): { estado: "sem_dado" } | { estado: "falha" } => (p.problema === "sem_dado" ? { estado: "sem_dado" } : { estado: "falha" });

const retratos = criarMemoria<LeituraAssembleia>({ validadeMs: VALIDADE_MS, maximo: 1, guardar: (l) => l.estado === "ok" });
const caminhos = criarMemoria<LeituraEmendaEpb>({
  validadeMs: VALIDADE_MS,
  maximo: 100,
  guardar: (l) => l.estado === "ok" || l.estado === "nao_encontrado",
});

/** O retrato inteiro da última rodada (fichas, catálogo, destinos, autores e pessoa física). Não altere o objeto. */
export function lerAssembleia(): Promise<LeituraAssembleia> {
  return retratos.obter("retrato", lerAssembleiaDoBanco);
}

async function lerAssembleiaDoBanco(): Promise<LeituraAssembleia> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const execucao = await lerExecucao(db);
  if (ehProblema(execucao)) return estadoDe(execucao);
  const id = execucao.id;
  const [fichas, catalogo, destinos, autores, pf] = await Promise.all([
    todasAsLinhas<FichaEpb>("fichas", (a, b, sinal) =>
      db.from("epb_ficha").select(COLUNAS_FICHA).eq("execucao_id", id).order("emenda").range(a, b).abortSignal(sinal),
    ),
    todasAsLinhas<CatalogoEpb>("catálogo", (a, b, sinal) =>
      db.from("epb_emenda").select(COLUNAS_CATALOGO).eq("execucao_id", id).order("emenda").order("seq").range(a, b).abortSignal(sinal),
    ),
    todasAsLinhas<DestinoEpb>("destinos", (a, b, sinal) =>
      db
        .from("epb_destino")
        .select(COLUNAS_DESTINO)
        .eq("execucao_id", id)
        .order("emenda")
        .order("credor_cnpj")
        .order("ibge", { nullsFirst: true })
        .order("orgao_codigo", { nullsFirst: true })
        .range(a, b)
        .abortSignal(sinal),
    ),
    todasAsLinhas<AutorEpb>("autores", (a, b, sinal) =>
      db.from("epb_autor").select("pessoa,pessoa_fonte,grafias_catalogo,grafias_ficha,emendas,anos").eq("execucao_id", id).order("pessoa").range(a, b).abortSignal(sinal),
    ),
    todasAsLinhas<PfEpb>("pessoa física (soma)", (a, b, sinal) =>
      db.from("epb_pf").select("ano,emenda,empenhado,pago,notas").eq("execucao_id", id).order("emenda").range(a, b).abortSignal(sinal),
    ),
  ]);
  for (const x of [fichas, catalogo, destinos, autores, pf]) if (ehProblema(x)) return estadoDe(x);
  return {
    estado: "ok",
    retrato: {
      execucao,
      fichas: (fichas as FichaEpb[]).map((f) => ({ ...f, ano: num(f.ano), valor: num(f.valor), prioridade: numOuNull(f.prioridade) })),
      catalogo: (catalogo as CatalogoEpb[]).map((c) => ({
        ...c,
        ano: num(c.ano),
        seq: num(c.seq),
        valor_emenda: num(c.valor_emenda),
        empenhado: num(c.empenhado),
        liquidado: num(c.liquidado),
        pago: num(c.pago),
      })),
      // O `orgao_codigo` só serve à ordem das páginas (a chave única); não vai ao retrato.
      destinos: (destinos as DestinoEpb[]).map((d) => ({
        ano: num(d.ano),
        emenda: d.emenda,
        credor_cnpj: d.credor_cnpj,
        credor_nome: d.credor_nome,
        ibge: d.ibge,
        municipio: d.municipio,
        orgao: d.orgao,
        empenhado: num(d.empenhado),
        liquidado: num(d.liquidado),
        pago: num(d.pago),
        notas: num(d.notas),
        primeira: d.primeira,
        ultima: d.ultima,
      })),
      autores: (autores as AutorEpb[]).map((a) => ({
        ...a,
        grafias_catalogo: a.grafias_catalogo ?? [],
        grafias_ficha: a.grafias_ficha ?? [],
        emendas: num(a.emendas),
        anos: (a.anos ?? []).map(num),
      })),
      pf: (pf as PfEpb[]).map((p) => ({ ...p, ano: num(p.ano), empenhado: num(p.empenhado), pago: num(p.pago), notas: num(p.notas) })),
    },
  };
}

/**
 * Uma emenda (`AAAA-NNNN` no endereço): o retrato e o caminho dela, com os pareceres e o responsável de cada passo (nome
 * de servidor: só administrador). Fora do formato ou fora da rodada: `nao_encontrado`. Não altere o objeto.
 */
export function lerEmendaEpb(daUrl: string): Promise<LeituraEmendaEpb> {
  const emenda = emendaDaUrl(daUrl);
  if (!emenda) return Promise.resolve({ estado: "nao_encontrado" });
  return caminhos.obter(emenda, () => lerEmendaDoBanco(emenda));
}

async function lerEmendaDoBanco(emenda: string): Promise<LeituraEmendaEpb> {
  const leitura = await lerAssembleia();
  if (leitura.estado !== "ok") return leitura;
  const r = leitura.retrato;
  if (!r.fichas.some((f) => f.emenda === emenda) && !r.catalogo.some((c) => c.emenda === emenda)) return { estado: "nao_encontrado" };
  const db = clienteServidor();
  const tramites = await uma<TramiteEpb[]>("caminho da emenda", (sinal) =>
    db
      .from("epb_tramite")
      .select("emenda,ordem,passo,data,texto,responsavel")
      .eq("execucao_id", r.execucao.id)
      .eq("emenda", emenda)
      .order("ordem")
      .limit(20)
      .abortSignal(sinal),
  );
  if (ehProblema(tramites)) return estadoDe(tramites);
  return { estado: "ok", retrato: r, emenda, tramites: (tramites ?? []).map((t) => ({ ...t, ordem: num(t.ordem) })) };
}

// ================================================================ o dinheiro do Estado no TCE-PB (E3, 16/10/2026)

const tcePorMunicipio = criarMemoria<LeituraTceEstadoMunicipio>({ validadeMs: VALIDADE_MS, maximo: 50, guardar: (l) => l.estado === "ok" });

/**
 * O que o município registrou no TCE-PB como recebido do Estado e o que gastou com fonte estadual (`tce_estado_*`, da
 * oport_42, na execução `tce_*` do job diário). Só servidor, só chave de serviço; a página decide quem vê (só o
 * administrador). IBGE fora do formato: `sem_dado`, sem ler o banco.
 */
export function lerTceEstadoDoMunicipio(ibge: string): Promise<LeituraTceEstadoMunicipio> {
  if (typeof ibge !== "string" || !/^\d{7}$/.test(ibge)) return Promise.resolve({ estado: "sem_dado" });
  return tcePorMunicipio.obter(ibge, () => lerTceEstadoDoBanco(ibge));
}

async function lerTceEstadoDoBanco(ibge: string): Promise<LeituraTceEstadoMunicipio> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const ex = await uma<{ id: number; dado_ate: string | null }[]>("execução do TCE-PB", (sinal) =>
    db.rpc("tce_ultima_execucao").select("id,dado_ate").limit(1).abortSignal(sinal),
  );
  if (ehProblema(ex)) return estadoDe(ex);
  const e = (ex ?? [])[0];
  if (!e) return { estado: "sem_dado" };
  const [cobertura, receita, despesa] = await Promise.all([
    uma<CoberturaEstado[]>("cobertura estadual do TCE-PB", (sinal) =>
      db.from("tce_estado_cobertura").select("ano,receitas_lidas,despesas_lidas,motivo").eq("execucao_id", e.id).eq("ibge", ibge).order("ano").abortSignal(sinal),
    ),
    uma<ReceitaEstado[]>("receita estadual no TCE-PB", (sinal) =>
      db.from("tce_estado_receita").select("ano,fonte,co,tipo,valor").eq("execucao_id", e.id).eq("ibge", ibge).order("ano").limit(PAGINA).abortSignal(sinal),
    ),
    uma<DespesaEstado[]>("despesa estadual no TCE-PB", (sinal) =>
      db.from("tce_estado_despesa").select("ano,fonte,co,grupo,empenhado,pago").eq("execucao_id", e.id).eq("ibge", ibge).order("ano").limit(PAGINA).abortSignal(sinal),
    ),
  ]);
  for (const x of [cobertura, receita, despesa]) if (ehProblema(x)) return estadoDe(x);
  const cob = (cobertura as CoberturaEstado[] | null) ?? [];
  // Execução de antes da oport_42 aplicada (ou de antes do job novo): sem cobertura estadual, não há o que mostrar.
  if (!cob.length) return { estado: "sem_dado" };
  return {
    estado: "ok",
    dadoAte: e.dado_ate ?? null,
    cobertura: cob.map((c) => ({ ...c, ano: num(c.ano) })),
    receita: ((receita as ReceitaEstado[] | null) ?? []).map((r) => ({ ...r, ano: num(r.ano), valor: num(r.valor) })),
    despesa: ((despesa as DespesaEstado[] | null) ?? []).map((d) => ({ ...d, ano: num(d.ano), empenhado: num(d.empenhado), pago: num(d.pago) })),
  };
}

// ================================================================ federal e estadual lado a lado (E3, 16/10/2026)

const federalPorAlvo = criarMemoria<LeituraFederalPorAno>({ validadeMs: VALIDADE_MS, maximo: 100, guardar: (l) => l.estado === "ok" });

/**
 * As emendas FEDERAIS por ano da emenda, para pôr ao lado das estaduais: as linhas de `emd_canal` (oport_39) que nenhum
 * outro canal cobre, da prefeitura e dos fundos municipais do IBGE, ou do CNPJ da entidade. Só o válido e o pago do que
 * é válido (`federalPorAno`). Alvo fora do formato: `sem_dado`, sem ler o banco.
 */
export function lerFederalPorAno(alvo: { ibge: string } | { cnpj: string }): Promise<LeituraFederalPorAno> {
  const chave = "ibge" in alvo ? (/^\d{7}$/.test(alvo.ibge) ? `ibge:${alvo.ibge}` : null) : /^[0-9A-Z]{12}\d{2}$/.test(alvo.cnpj) ? `cnpj:${alvo.cnpj}` : null;
  if (!chave) return Promise.resolve({ estado: "sem_dado" });
  return federalPorAlvo.obter(chave, () => lerFederalDoBanco(alvo));
}

async function lerFederalDoBanco(alvo: { ibge: string } | { cnpj: string }): Promise<LeituraFederalPorAno> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const ex = await uma<{ id: number }[]>("execução das emendas federais", (sinal) => db.rpc("emd_ultima_execucao").select("id").limit(1).abortSignal(sinal));
  if (ehProblema(ex)) return estadoDe(ex);
  const id = (ex ?? [])[0]?.id;
  if (id === undefined || id === null) return { estado: "sem_dado" };
  const linhas = await todasAsLinhas<{ ano: number | null; valido: boolean; indicado: number | null; pago: number | null }>("emendas federais por ano", (a, b, sinal) => {
    let q = db.from("emd_canal").select("ano,valido,indicado,pago,linha").eq("execucao_id", id).is("coberto_por", null);
    q = "ibge" in alvo ? q.eq("ibge", alvo.ibge).in("ente_tipo", ["municipio", "fundo_municipal"]) : q.eq("ente_cnpj", alvo.cnpj);
    return q.order("linha").range(a, b).abortSignal(sinal);
  });
  if (ehProblema(linhas)) return estadoDe(linhas);
  return {
    estado: "ok",
    anos: federalPorAno(linhas.map((l) => ({ ano: l.ano === null ? null : num(l.ano), valido: !!l.valido, indicado: numOuNull(l.indicado), pago: numOuNull(l.pago) }))),
  };
}
