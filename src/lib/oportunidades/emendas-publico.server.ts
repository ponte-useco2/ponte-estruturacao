/**
 * Leitura do portal público das emendas federais com destino à PB (`/emendas`, 17/11/2026) — só servidor, só chave de
 * serviço, e SÓ as funções `emd_pub_*` da oport_67, com as colunas da lista branca (`COLUNAS_*` de
 * `emendas-publico.ts`). Nenhuma tabela é lida direto, nenhuma outra função é chamada: o teste
 * `emendas-publico.server.test.ts` lê este arquivo e confere.
 *
 * As tabelas `emd_*` continuam só para `service_role` (RLS sem política): o público nunca fala com o banco; o servidor
 * do site lê com a chave de serviço, como os outros leitores, e as funções já devolvem só o que pode sair (sem "vez",
 * motivo, laudo do Pix, catálogo bruto, CPF ou nome de microempreendedor individual). As linhas ainda passam por
 * `linhaSegura` (a mesma regra do banco, repetida) antes de chegar à página.
 *
 * CACHE (o dado muda uma vez por semana; nenhuma consulta pesada por visita):
 *   · a execução publicada (`emd_pub_execucao`) fica 10 minutos (a validade de sempre do cache de dados);
 *   · toda outra chamada leva na chave a execução das emendas e a do painel, do Pix e do fiscal (de onde vêm o objeto e
 *     o nome do município): execução nova, chave nova. Por isso ela pode ficar 6 horas na memória da instância e no
 *     cache comum (`cache-dados.server.ts`, com a validade própria desde 17/11/2026). Erro não se guarda.
 *
 * Os estados: função ausente (PGRST202, 42883: a oport_67 ainda não aplicada) e banco sem execução concluída viram
 * `sem_dado`; o outro erro, ou a chamada que passa de 8 s, vira `falha`, com `console.error` que diz onde e o código
 * (nunca as linhas); código, autor ou IBGE que não existem viram `nao_encontrado`. O que está fora do formato nem chega
 * ao banco. Fica de fora o `import "server-only"`: ele pede o pacote no `web/package.json`, que é de outra sessão.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { VALIDADE_DADOS_MS, chaveDaChamada } from "./cache-dados";
import { camadaDoCacheDeDados } from "./cache-dados.server";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import {
  COLUNAS_AGREGADO,
  COLUNAS_AUTOR,
  COLUNAS_CATALOGO,
  COLUNAS_EXECUCAO,
  COLUNAS_FACETA,
  COLUNAS_LINHA,
  COLUNAS_MUNICIPIO,
  COLUNAS_PF,
  COLUNAS_TOTAIS,
  LINHAS_POR_CHAMADA,
  MAX_PAGINAS_ARQUIVO,
  argumentosDaLista,
  codigoAutorPublicoDaUrl,
  codigoEmendaDaUrl,
  consultaDoAno,
  ibgeDaUrl,
  linhaSegura,
  paginaDaLista,
  type AgregadoPublico,
  type AutorPublico,
  type ConsultaLista,
  type ExecucaoPublica,
  type FacetaPublica,
  type FUNCOES_PUBLICAS,
  type Leitura,
  type LeituraFicha,
  type LinhaCatalogo,
  type LinhaPublica,
  type MunicipioPublico,
  type PfPublica,
  type RecorteFixo,
} from "./emendas-publico";
import { argumentosDasFacetas, argumentosDoRecorte, faixaDaPagina, type Periodo, type Recorte, type Soma } from "./emendas-recorte";

type Banco = ReturnType<typeof clienteServidor>;
type Erro = { message: string; code?: string };
type Resposta = { data: unknown; error: Erro | null };
type FuncaoPublica = (typeof FUNCOES_PUBLICAS)[number];

const TEMPO_LIMITE_MS = 8_000;
/** 6 horas: a chave já leva as execuções, e o dado de uma execução não muda. */
const VALIDADE_PORTAL_S = 6 * 3600;
/** Quantas chamadas de mil linhas correm juntas num arquivo (o banco tem ~1 GB de memória: devagar e sempre). */
const PARALELAS = 3;

/** O que pode dar errado numa leitura: função ausente (`sem_dado`) ou outra coisa (`falha`). */
type Problema = { problema: "sem_dado" | "falha" };
const ehProblema = (x: unknown): x is Problema => !!x && typeof x === "object" && "problema" in (x as object);
const estadoDe = (p: Problema): { estado: "sem_dado" } | { estado: "falha" } =>
  p.problema === "sem_dado" ? { estado: "sem_dado" } : { estado: "falha" };

function problemaDe(onde: string, erro: Erro): Problema {
  if (ehEsquemaAusente(erro.code)) return { problema: "sem_dado" };
  console.error(`emendas-publico (${onde}):`, erro.code ?? "sem código", erro.message);
  return { problema: "falha" };
}

// ================================================================ a chamada (sempre a mesma forma, sempre com cache)

interface Chamada {
  funcao: FuncaoPublica;
  args: Record<string, unknown>;
  colunas: readonly string[];
  /** A ordem pela chave, para ler em páginas sem pular nem repetir linha. */
  ordem?: readonly string[];
  faixa?: readonly [number, number];
}

async function executar(db: Banco, c: Chamada): Promise<Resposta> {
  try {
    let q = db.rpc(c.funcao, c.args).select(c.colunas.join(","));
    for (const coluna of c.ordem ?? []) q = q.order(coluna, { ascending: true, nullsFirst: true });
    if (c.faixa) q = q.range(c.faixa[0], c.faixa[1]);
    const r = await q.abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));
    return { data: r.data ?? null, error: r.error ? { message: r.error.message, code: r.error.code } : null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "falha na leitura", code: "excecao" } };
  }
}

const guardavel = (r: Resposta) => r.error === null;
const memoriaDaExecucao = criarMemoria<Resposta>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 1,
  guardar: guardavel,
  compartilhada: camadaDoCacheDeDados<Resposta>({ leitor: "emendas-publico-execucao", guardavel }),
});
const memoriaDasChamadas = criarMemoria<Resposta>({
  validadeMs: VALIDADE_PORTAL_S * 1000,
  maximo: 300,
  guardar: guardavel,
  compartilhada: camadaDoCacheDeDados<Resposta>({ leitor: "emendas-publico", guardavel, validadeS: VALIDADE_PORTAL_S }),
});
/** As páginas de mil linhas dos arquivos: poucas por instância (cada uma tem ~1 MB). */
const memoriaDosArquivos = criarMemoria<Resposta>({
  validadeMs: VALIDADE_PORTAL_S * 1000,
  maximo: 30,
  guardar: guardavel,
  compartilhada: camadaDoCacheDeDados<Resposta>({ leitor: "emendas-publico-arquivo", guardavel, validadeS: VALIDADE_PORTAL_S }),
});

/** A chave das execuções: a das emendas e as das fontes do objeto e do município. */
const fontesDa = (e: ExecucaoPublica) => [e.id, e.painelExecucao, e.pixExecucao, e.fiscalExecucao];

async function chamar<T>(
  db: Banco,
  e: ExecucaoPublica,
  onde: string,
  c: Chamada,
  memoria = memoriaDasChamadas,
): Promise<T[] | Problema> {
  const chave = chaveDaChamada(e.id, c.funcao, { args: c.args, colunas: c.colunas, ordem: c.ordem ?? [], faixa: c.faixa ?? null, fontes: fontesDa(e) });
  const r = await memoria.obter(chave, () => executar(db, c));
  if (r.error) return problemaDe(onde, r.error);
  return Array.isArray(r.data) ? (r.data as T[]) : [];
}

/** Todas as linhas de uma função lida em faixas de mil (com a ordem pela chave), até o teto de páginas. */
async function todas<T>(db: Banco, e: ExecucaoPublica, onde: string, c: Omit<Chamada, "faixa">, memoria = memoriaDasChamadas): Promise<T[] | Problema> {
  const saida: T[] = [];
  for (let p = 0; p < MAX_PAGINAS_ARQUIVO; p += 1) {
    const inicio = p * LINHAS_POR_CHAMADA;
    const lote = await chamar<T>(db, e, onde, { ...c, faixa: [inicio, inicio + LINHAS_POR_CHAMADA - 1] }, memoria);
    if (ehProblema(lote)) return lote;
    saida.push(...lote);
    if (lote.length < LINHAS_POR_CHAMADA) return saida;
  }
  return saida;
}

// ================================================================ conversões (o PostgREST manda numeric como número; é defesa)

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};
const numOuNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : num(v));

function linhaDoBanco(l: Record<string, unknown>): LinhaPublica & { total: number } {
  const x = l as unknown as LinhaPublica & { total: number };
  return {
    ...linhaSegura(x),
    linha: num(x.linha),
    ano: numOuNull(x.ano),
    ano_pagamento: numOuNull(x.ano_pagamento),
    previsto: numOuNull(x.previsto),
    empenhado: numOuNull(x.empenhado),
    pago: num(x.pago),
    n_autores: numOuNull(x.n_autores),
    convenio_repasse: numOuNull(x.convenio_repasse),
    convenio_desembolsado: numOuNull(x.convenio_desembolsado),
    valor_global: numOuNull(x.valor_global),
    contrapartida: numOuNull(x.contrapartida),
    fisico: numOuNull(x.fisico),
    pix_custeio: numOuNull(x.pix_custeio),
    pix_investimento: numOuNull(x.pix_investimento),
    no_catalogo: x.no_catalogo === true,
    coletivo: x.coletivo === true,
    total: num(x.total),
  };
}

/** A linha sem o `total` (que é do recorte, não da linha). */
function semTotal(l: LinhaPublica & { total: number }): LinhaPublica {
  const { total: _total, ...resto } = l;
  void _total;
  return resto;
}

const agregadoDoBanco = (a: AgregadoPublico): AgregadoPublico => ({
  ...a,
  ano: numOuNull(a.ano),
  emendas: num(a.emendas),
  linhas: num(a.linhas),
  municipios: num(a.municipios),
  previsto: num(a.previsto),
  empenhado: num(a.empenhado),
  pago: num(a.pago),
  com_previsto: num(a.com_previsto),
  com_empenhado: num(a.com_empenhado),
  com_fisico: num(a.com_fisico),
});
const catalogoDoBanco = (l: LinhaCatalogo): LinhaCatalogo => ({
  ...l,
  linha: num(l.linha),
  ano: numOuNull(l.ano),
  pb_localidade: l.pb_localidade === true,
  empenhado: numOuNull(l.empenhado),
  liquidado: numOuNull(l.liquidado),
  pago: numOuNull(l.pago),
  rp_pago: numOuNull(l.rp_pago),
  rp_cancelado: numOuNull(l.rp_cancelado),
  pago_total: numOuNull(l.pago_total),
  a_pagar: numOuNull(l.a_pagar),
  nacional_empenhado: numOuNull(l.nacional_empenhado),
  nacional_liquidado: numOuNull(l.nacional_liquidado),
  nacional_pago: numOuNull(l.nacional_pago),
  nacional_rp_pago: numOuNull(l.nacional_rp_pago),
  nacional_rp_cancelado: numOuNull(l.nacional_rp_cancelado),
  nacional_a_pagar: numOuNull(l.nacional_a_pagar),
  localidades: numOuNull(l.localidades),
});
const pfDoBanco = (p: PfPublica): PfPublica => ({ ...p, ano: num(p.ano), n_pagamentos: num(p.n_pagamentos), valor: num(p.valor) });
const autorDoBanco = (a: AutorPublico): AutorPublico => ({
  ...a,
  coletivo: a.coletivo === true,
  emendas: num(a.emendas),
  linhas: num(a.linhas),
  previsto: num(a.previsto),
  pago: num(a.pago),
  municipios: num(a.municipios),
  ano_min: numOuNull(a.ano_min),
  ano_max: numOuNull(a.ano_max),
  convenio_pago: num(a.convenio_pago),
  pix_pago: num(a.pix_pago),
  fns_pago: num(a.fns_pago),
  favorecido_pago: num(a.favorecido_pago),
  emendas_catalogo_pb: num(a.emendas_catalogo_pb),
});
const municipioDoBanco = (m: MunicipioPublico): MunicipioPublico => ({
  ...m,
  emendas: num(m.emendas),
  linhas: num(m.linhas),
  previsto: num(m.previsto),
  pago: num(m.pago),
  convenio_pago: num(m.convenio_pago),
  pix_pago: num(m.pix_pago),
  fns_pago: num(m.fns_pago),
  favorecido_pago: num(m.favorecido_pago),
  entidades_pago: num(m.entidades_pago),
});

// ================================================================ a execução

interface LinhaExecucao {
  id: number;
  concluida_em: string | null;
  dado_ate: string | null;
  referencia: string | null;
  fns_pendentes: number | null;
  painel_execucao: number | null;
  painel_dado_ate: string | null;
  pix_execucao: number | null;
  pix_dado_ate: string | null;
  fiscal_execucao: number | null;
}

async function lerExecucao(db: Banco): Promise<ExecucaoPublica | Problema> {
  const r = await memoriaDaExecucao.obter("execucao", () =>
    executar(db, { funcao: "emd_pub_execucao", args: {}, colunas: COLUNAS_EXECUCAO }),
  );
  if (r.error) return problemaDe("execução", r.error);
  const e = (Array.isArray(r.data) ? (r.data as LinhaExecucao[]) : [])[0];
  if (!e || e.id === null || e.id === undefined) return { problema: "sem_dado" };
  return {
    id: num(e.id),
    concluidaEm: e.concluida_em ?? null,
    dadoAte: e.dado_ate ?? null,
    referencia: e.referencia ?? null,
    fnsPendentes: num(e.fns_pendentes),
    painelExecucao: numOuNull(e.painel_execucao),
    painelDadoAte: e.painel_dado_ate ?? null,
    pixExecucao: numOuNull(e.pix_execucao),
    pixDadoAte: e.pix_dado_ate ?? null,
    fiscalExecucao: numOuNull(e.fiscal_execucao),
  };
}

/** O começo de toda leitura: o banco configurado e a execução publicada. */
async function abrir(): Promise<{ db: Banco; execucao: ExecucaoPublica } | Problema> {
  if (!authConfigurada()) return { problema: "sem_dado" };
  const db = clienteServidor();
  const execucao = await lerExecucao(db);
  if (ehProblema(execucao)) return execucao;
  return { db, execucao };
}

// ================================================================ as peças (cada uma falha sozinha)

/** A linha e os totais do recorte INTEIRO (oport_68): a tela e o arquivo nunca somam só a página. */
const COLUNAS_COM_TOTAL = [...COLUNAS_LINHA, ...COLUNAS_TOTAIS] as const;

const somaDaLinha = (l: Record<string, unknown>): Soma => ({
  registros: num(l.total),
  emendas: num(l.total_emendas),
  previsto: num(l.total_previsto),
  comPrevisto: num(l.total_com_previsto),
  empenhado: num(l.total_empenhado),
  comEmpenhado: num(l.total_com_empenhado),
  realizado: num(l.total_pago),
});

async function pedirLinhas(db: Banco, e: ExecucaoPublica, onde: string, args: Record<string, unknown>, memoria = memoriaDasChamadas) {
  const r = await chamar<Record<string, unknown>>(db, e, onde, { funcao: "emd_pub_linhas", args, colunas: COLUNAS_COM_TOTAL }, memoria);
  if (ehProblema(r)) return r;
  const linhas = r.map(linhaDoBanco);
  return { linhas: linhas.map(semTotal), total: linhas[0]?.total ?? null, soma: r[0] ? somaDaLinha(r[0]) : null };
}

/** Uma página da lista; com a página além do fim, o total vem de uma chamada de uma linha. */
async function paginaDeLinhas(db: Banco, e: ExecucaoPublica, c: ConsultaLista, fixo: RecorteFixo) {
  const r = await pedirLinhas(db, e, "linhas", argumentosDaLista(c, fixo, paginaDaLista(c.pagina)));
  if (ehProblema(r)) return r;
  if (r.total !== null || c.pagina <= 1) return { linhas: r.linhas, total: r.total ?? 0 };
  const t = await pedirLinhas(db, e, "total das linhas", argumentosDaLista(c, fixo, { limite: 1, deslocamento: 0 }));
  if (ehProblema(t)) return t;
  return { linhas: r.linhas, total: t.total ?? 0 };
}

async function agregado(db: Banco, e: ExecucaoPublica, filtro: { p_autor?: string; p_ibge?: string } = {}) {
  const r = await todas<AgregadoPublico>(db, e, "agregado", {
    funcao: "emd_pub_agregado",
    args: filtro,
    colunas: COLUNAS_AGREGADO,
    ordem: ["grupo", "ano", "tipo", "canal", "funcao", "ente_tipo"],
  });
  return ehProblema(r) ? r : r.map(agregadoDoBanco);
}

const funcoesDo = (a: readonly AgregadoPublico[]) => a.filter((x) => x.grupo === "funcao").map((x) => x.funcao);

async function autores(db: Banco, e: ExecucaoPublica) {
  const r = await todas<AutorPublico>(db, e, "autores", { funcao: "emd_pub_autores", args: {}, colunas: COLUNAS_AUTOR, ordem: ["codigo"] });
  return ehProblema(r) ? r : r.map(autorDoBanco);
}

async function municipios(db: Banco, e: ExecucaoPublica) {
  const r = await todas<MunicipioPublico>(db, e, "municípios", {
    funcao: "emd_pub_municipios",
    args: {},
    colunas: COLUNAS_MUNICIPIO,
    ordem: ["grupo", "ibge"],
  });
  return ehProblema(r) ? r : r.map(municipioDoBanco);
}

// ================================================================ as leituras das páginas

export type LeituraInicio = Leitura<{ execucao: ExecucaoPublica; agregado: AgregadoPublico[] }>;
export type LeituraLista = Leitura<{ execucao: ExecucaoPublica; linhas: LinhaPublica[]; total: number; funcoes: (string | null)[] }>;
export type LeituraEmenda = LeituraFicha<{
  execucao: ExecucaoPublica;
  linhas: LinhaPublica[];
  total: number;
  catalogo: LinhaCatalogo[];
  pf: PfPublica[];
}>;
export type LeituraAutores = Leitura<{ execucao: ExecucaoPublica; autores: AutorPublico[] }>;
export type LeituraAutor = LeituraFicha<{
  execucao: ExecucaoPublica;
  autor: AutorPublico;
  agregado: AgregadoPublico[];
  linhas: LinhaPublica[];
  total: number;
}>;
export type LeituraMunicipios = Leitura<{ execucao: ExecucaoPublica; municipios: MunicipioPublico[] }>;
export type LeituraMunicipio = LeituraFicha<{
  execucao: ExecucaoPublica;
  municipio: MunicipioPublico;
  agregado: AgregadoPublico[];
  linhas: LinhaPublica[];
  total: number;
}>;
export type LeituraExecucao = Leitura<{ execucao: ExecucaoPublica }>;

/** Só a execução publicada (a data do dado), para as páginas de texto. */
export async function lerExecucaoPublica(): Promise<LeituraExecucao> {
  const a = await abrir();
  return ehProblema(a) ? estadoDe(a) : { estado: "ok", execucao: a.execucao };
}

/** A página inicial: a execução e as somas de toda a PB. */
export async function lerInicio(): Promise<LeituraInicio> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const ag = await agregado(a.db, a.execucao);
  if (ehProblema(ag)) return estadoDe(ag);
  return { estado: "ok", execucao: a.execucao, agregado: ag };
}

/** A lista (17.1): uma página do recorte e as funções de governo (para o filtro). */
export async function lerLista(c: ConsultaLista): Promise<LeituraLista> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const [pagina, ag] = await Promise.all([paginaDeLinhas(a.db, a.execucao, c, {}), agregado(a.db, a.execucao)]);
  if (ehProblema(pagina)) return estadoDe(pagina);
  if (ehProblema(ag)) return estadoDe(ag);
  return { estado: "ok", execucao: a.execucao, linhas: pagina.linhas, total: pagina.total, funcoes: funcoesDo(ag) };
}

/** Até quantas linhas a ficha de uma emenda traz (a maior tinha 380 em 17/11/2026). */
const MAX_LINHAS_FICHA = 5 * LINHAS_POR_CHAMADA;

/** A ficha da emenda: as linhas dela (todas), o catálogo (execução orçamentária na PB) e a pessoa física somada. */
export async function lerEmenda(codigo: string): Promise<LeituraEmenda> {
  const c = codigoEmendaDaUrl(codigo);
  if (!c) return { estado: "nao_encontrado" };
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const { db, execucao } = a;
  const linhas: LinhaPublica[] = [];
  let total = 0;
  for (let deslocamento = 0; deslocamento < MAX_LINHAS_FICHA; deslocamento += LINHAS_POR_CHAMADA) {
    const r = await pedirLinhas(db, execucao, "linhas da emenda", { p_emenda: c, p_limite: LINHAS_POR_CHAMADA, p_deslocamento: deslocamento });
    if (ehProblema(r)) return estadoDe(r);
    linhas.push(...r.linhas);
    total = r.total ?? total;
    if (r.linhas.length < LINHAS_POR_CHAMADA) break;
  }
  const [catalogo, pf] = await Promise.all([
    todas<LinhaCatalogo>(db, execucao, "catálogo da emenda", { funcao: "emd_pub_emenda", args: { p_codigo: c }, colunas: COLUNAS_CATALOGO, ordem: ["codigo", "linha"] }),
    todas<PfPublica>(db, execucao, "pessoa física da emenda", { funcao: "emd_pub_pf", args: { p_codigo: c }, colunas: COLUNAS_PF, ordem: ["codigo", "ano"] }),
  ]);
  if (ehProblema(catalogo)) return estadoDe(catalogo);
  if (ehProblema(pf)) return estadoDe(pf);
  if (linhas.length === 0 && catalogo.length === 0 && pf.length === 0) return { estado: "nao_encontrado" };
  return { estado: "ok", execucao, linhas, total, catalogo: catalogo.map(catalogoDoBanco), pf: pf.map(pfDoBanco) };
}

/** Os autores (todos os da execução; a página separa e põe em ordem alfabética). */
export async function lerAutores(): Promise<LeituraAutores> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const r = await autores(a.db, a.execucao);
  return ehProblema(r) ? estadoDe(r) : { estado: "ok", execucao: a.execucao, autores: r };
}

/** A ficha do autor: a linha dele, as somas (série) e uma página das linhas dele. */
export async function lerAutor(codigo: string, c: ConsultaLista): Promise<LeituraAutor> {
  const k = codigoAutorPublicoDaUrl(codigo);
  if (!k) return { estado: "nao_encontrado" };
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const [lista, ag, pagina] = await Promise.all([
    autores(a.db, a.execucao),
    agregado(a.db, a.execucao, { p_autor: k }),
    paginaDeLinhas(a.db, a.execucao, c, { autor: k }),
  ]);
  if (ehProblema(lista)) return estadoDe(lista);
  if (ehProblema(ag)) return estadoDe(ag);
  if (ehProblema(pagina)) return estadoDe(pagina);
  const autor = lista.find((x) => x.codigo === k);
  if (!autor) return { estado: "nao_encontrado" };
  return { estado: "ok", execucao: a.execucao, autor, agregado: ag, linhas: pagina.linhas, total: pagina.total };
}

/** Os 223 municípios (e o estado e o "sem município" à parte). */
export async function lerMunicipios(): Promise<LeituraMunicipios> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const r = await municipios(a.db, a.execucao);
  return ehProblema(r) ? estadoDe(r) : { estado: "ok", execucao: a.execucao, municipios: r };
}

/** A ficha do município: a linha dele, as somas e uma página das linhas com o IBGE dele. */
export async function lerMunicipio(ibge: string, c: ConsultaLista): Promise<LeituraMunicipio> {
  const k = ibgeDaUrl(ibge);
  if (!k) return { estado: "nao_encontrado" };
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const [lista, ag, pagina] = await Promise.all([
    municipios(a.db, a.execucao),
    agregado(a.db, a.execucao, { p_ibge: k }),
    paginaDeLinhas(a.db, a.execucao, c, { ibge: k }),
  ]);
  if (ehProblema(lista)) return estadoDe(lista);
  if (ehProblema(ag)) return estadoDe(ag);
  if (ehProblema(pagina)) return estadoDe(pagina);
  const municipio = lista.find((x) => x.grupo === "municipio" && x.ibge === k);
  if (!municipio) return { estado: "nao_encontrado" };
  return { estado: "ok", execucao: a.execucao, municipio, agregado: ag, linhas: pagina.linhas, total: pagina.total };
}

// ================================================================ os arquivos de dados abertos

export type LeituraArquivo<T> = Leitura<{ execucao: ExecucaoPublica; linhas: T[]; total: number; truncado: boolean }>;

/**
 * Todas as linhas de um recorte (o arquivo completo é o recorte sem filtro), em chamadas de mil: a primeira diz o total,
 * as outras correm `PARALELAS` por vez. Tudo ou nada: uma chamada que falha derruba o arquivo (nunca um arquivo pela
 * metade). Teto: `MAX_PAGINAS_ARQUIVO` chamadas (`truncado` diz se passou).
 */
export async function lerArquivoDeLinhas(c: ConsultaLista, fixo: RecorteFixo): Promise<LeituraArquivo<LinhaPublica>> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const { db, execucao } = a;
  const pagina = (deslocamento: number) =>
    pedirLinhas(db, execucao, "arquivo das linhas", argumentosDaLista({ ...c, pagina: 1 }, fixo, { limite: LINHAS_POR_CHAMADA, deslocamento }), memoriaDosArquivos);
  const primeira = await pagina(0);
  if (ehProblema(primeira)) return estadoDe(primeira);
  const total = primeira.total ?? 0;
  const paginas = Math.min(MAX_PAGINAS_ARQUIVO, Math.ceil(total / LINHAS_POR_CHAMADA));
  const linhas = [...primeira.linhas];
  for (let p = 1; p < paginas; p += PARALELAS) {
    const lote = await Promise.all(
      Array.from({ length: Math.min(PARALELAS, paginas - p) }, (_, i) => pagina((p + i) * LINHAS_POR_CHAMADA)),
    );
    for (const r of lote) {
      if (ehProblema(r)) return estadoDe(r);
      linhas.push(...r.linhas);
    }
  }
  return { estado: "ok", execucao, linhas, total, truncado: total > linhas.length };
}

/** As linhas de um ano da emenda: o arquivo por ano, o caminho principal dos dados abertos (cada um bem abaixo de 4,5 MB). */
export function lerArquivoDoAno(ano: number): Promise<LeituraArquivo<LinhaPublica>> {
  return lerArquivoDeLinhas(consultaDoAno(ano), {});
}

/** A execução orçamentária do catálogo, só as linhas com a PB na localidade (17.3). */
export async function lerArquivoDoCatalogo(): Promise<LeituraArquivo<LinhaCatalogo>> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const r = await todas<LinhaCatalogo>(
    a.db,
    a.execucao,
    "arquivo do catálogo",
    { funcao: "emd_pub_emenda", args: {}, colunas: COLUNAS_CATALOGO, ordem: ["codigo", "linha"] },
    memoriaDosArquivos,
  );
  if (ehProblema(r)) return estadoDe(r);
  return { estado: "ok", execucao: a.execucao, linhas: r.map(catalogoDoBanco), total: r.length, truncado: false };
}

/** A pessoa física somada, por emenda e ano. */
export async function lerArquivoDaPf(): Promise<LeituraArquivo<PfPublica>> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const r = await todas<PfPublica>(a.db, a.execucao, "arquivo da pessoa física", {
    funcao: "emd_pub_pf",
    args: {},
    colunas: COLUNAS_PF,
    ordem: ["codigo", "ano"],
  });
  if (ehProblema(r)) return estadoDe(r);
  return { estado: "ok", execucao: a.execucao, linhas: r.map(pfDoBanco), total: r.length, truncado: false };
}

// ================================================================ versão 2 do desenho: o recorte no endereço

/** Os nomes dos 223 municípios (o seletor, os chips e a trilha), da mesma função da lista de municípios. */
export type NomesDosMunicipios = { ibge: string; nome: string }[];
const nomesDe = (ms: readonly MunicipioPublico[]): NomesDosMunicipios =>
  ms.filter((m) => m.grupo === "municipio" && m.ibge).map((m) => ({ ibge: m.ibge as string, nome: m.nome }));
const SOMA_VAZIA: Soma = { registros: 0, emendas: 0, previsto: 0, comPrevisto: 0, empenhado: 0, comEmpenhado: 0, realizado: 0 };

/** Todas as linhas de um recorte, em chamadas de mil (a primeira diz o total; as outras correm `PARALELAS` por vez). */
async function todasDoRecorte(db: Banco, e: ExecucaoPublica, r: Recorte, onde: string, memoria = memoriaDasChamadas) {
  const pagina = (deslocamento: number) =>
    pedirLinhas(db, e, onde, argumentosDoRecorte(r, { limite: LINHAS_POR_CHAMADA, deslocamento }), memoria);
  const primeira = await pagina(0);
  if (ehProblema(primeira)) return primeira;
  const total = primeira.total ?? 0;
  const paginas = Math.min(MAX_PAGINAS_ARQUIVO, Math.ceil(total / LINHAS_POR_CHAMADA));
  const linhas = [...primeira.linhas];
  for (let p = 1; p < paginas; p += PARALELAS) {
    const lote = await Promise.all(Array.from({ length: Math.min(PARALELAS, paginas - p) }, (_, i) => pagina((p + i) * LINHAS_POR_CHAMADA)));
    for (const x of lote) {
      if (ehProblema(x)) return x;
      linhas.push(...x.linhas);
    }
  }
  return { linhas, total, soma: primeira.soma ?? SOMA_VAZIA, truncado: total > linhas.length };
}

const recorteDoMunicipio = (ibge: string, p: Periodo): Recorte => ({
  municipio: ibge,
  periodo: p,
  canal: [],
  destinatario: [],
  funcao: [],
  tipo: [],
  autoria: [],
  ano: [],
  q: "",
  ordem: { campo: "codigo", desc: false },
  pagina: 1,
  por: 20,
});

export type LeituraInicioV2 = Leitura<{
  execucao: ExecucaoPublica;
  municipios: NomesDosMunicipios;
  /** O total da PB no período (grupo `total` do agregado com o período). */
  pb: AgregadoPublico | null;
  /** O total do município escolhido no período (o rótulo do mapa). */
  municipio: AgregadoPublico | null;
}>;

/** O início: os três números da PB no período e, se houver município escolhido, o total dele. */
export async function lerInicioV2(p: Periodo, ibge: string | null): Promise<LeituraInicioV2> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const ag = (filtro: Record<string, unknown>) =>
    chamar<AgregadoPublico>(a.db, a.execucao, "agregado do período", {
      funcao: "emd_pub_agregado",
      args: { ...filtro, p_ano_de: p.de, p_ano_ate: p.ate },
      colunas: COLUNAS_AGREGADO,
      ordem: ["grupo", "ano", "tipo", "canal", "funcao", "ente_tipo"],
      faixa: [0, LINHAS_POR_CHAMADA - 1],
    });
  const k = ibge ? ibgeDaUrl(ibge) : null;
  const [ms, pb, mun] = await Promise.all([
    municipios(a.db, a.execucao),
    ag({}),
    k ? ag({ p_ibge: k }) : Promise.resolve([] as AgregadoPublico[]),
  ]);
  if (ehProblema(ms)) return estadoDe(ms);
  if (ehProblema(pb)) return estadoDe(pb);
  if (ehProblema(mun)) return estadoDe(mun);
  const total = (xs: AgregadoPublico[]) => {
    const t = xs.find((x) => x.grupo === "total");
    return t ? agregadoDoBanco(t) : null;
  };
  return { estado: "ok", execucao: a.execucao, municipios: nomesDe(ms), pb: total(pb), municipio: total(mun) };
}

export type LeituraMunicipioV2 = LeituraFicha<{
  execucao: ExecucaoPublica;
  municipios: NomesDosMunicipios;
  nome: string;
  /** Todas as linhas do município no período: os blocos saem delas, e o total bate com a tela de registros. */
  linhas: LinhaPublica[];
  soma: Soma;
  truncado: boolean;
}>;

export async function lerMunicipioV2(ibge: string, p: Periodo): Promise<LeituraMunicipioV2> {
  const k = ibgeDaUrl(ibge);
  if (!k) return { estado: "nao_encontrado" };
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const [ms, r] = await Promise.all([
    municipios(a.db, a.execucao),
    todasDoRecorte(a.db, a.execucao, recorteDoMunicipio(k, p), "linhas do município"),
  ]);
  if (ehProblema(ms)) return estadoDe(ms);
  if (ehProblema(r)) return estadoDe(r);
  const nomes = nomesDe(ms);
  const nome = nomes.find((m) => m.ibge === k)?.nome;
  if (!nome) return { estado: "nao_encontrado" };
  return { estado: "ok", execucao: a.execucao, municipios: nomes, nome, linhas: r.linhas, soma: r.soma, truncado: r.truncado };
}

export type LeituraRegistros = Leitura<{
  execucao: ExecucaoPublica;
  municipios: NomesDosMunicipios;
  autores: { codigo: string; nome: string | null }[];
  linhas: LinhaPublica[];
  soma: Soma;
  /** As contagens do painel "Filtrar" (oport_68); sem elas (falha só desta chamada), o painel sai sem números. */
  facetas: FacetaPublica[] | null;
}>;

/** Uma página dos registros do recorte e os totais do recorte inteiro (com a cobertura). */
export async function lerRegistros(r: Recorte): Promise<LeituraRegistros> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const [ms, au, pagina, fac] = await Promise.all([
    municipios(a.db, a.execucao),
    r.autoria.length ? autores(a.db, a.execucao) : Promise.resolve([] as AutorPublico[]),
    pedirLinhas(a.db, a.execucao, "registros", argumentosDoRecorte(r, faixaDaPagina(r))),
    chamar<FacetaPublica>(a.db, a.execucao, "facetas", { funcao: "emd_pub_facetas", args: argumentosDasFacetas(r), colunas: COLUNAS_FACETA }),
  ]);
  if (ehProblema(ms)) return estadoDe(ms);
  if (ehProblema(au)) return estadoDe(au);
  if (ehProblema(pagina)) return estadoDe(pagina);
  let soma = pagina.soma;
  if (!soma && r.pagina > 1) {
    // A página além do fim não traz linha: o total vem de uma chamada de uma linha.
    const t = await pedirLinhas(a.db, a.execucao, "total dos registros", argumentosDoRecorte(r, { limite: 1, deslocamento: 0 }));
    if (ehProblema(t)) return estadoDe(t);
    soma = t.soma;
  }
  return {
    estado: "ok",
    execucao: a.execucao,
    municipios: nomesDe(ms),
    autores: au.map((x) => ({ codigo: x.codigo, nome: x.nome })),
    linhas: pagina.linhas,
    soma: soma ?? SOMA_VAZIA,
    facetas: ehProblema(fac) ? null : fac.map((f) => ({ ...f, chave: f.chave ?? "", registros: num(f.registros) })),
  };
}

export type LeituraArquivoDoRecorte = Leitura<{
  execucao: ExecucaoPublica;
  municipios: NomesDosMunicipios;
  autores: { codigo: string; nome: string | null }[];
  linhas: LinhaPublica[];
  soma: Soma;
  truncado: boolean;
}>;

/** O recorte INTEIRO para o arquivo (todas as páginas, na ordem da tela). Tudo ou nada. */
export async function lerArquivoDoRecorte(r: Recorte): Promise<LeituraArquivoDoRecorte> {
  const a = await abrir();
  if (ehProblema(a)) return estadoDe(a);
  const [ms, au, x] = await Promise.all([
    municipios(a.db, a.execucao),
    r.autoria.length ? autores(a.db, a.execucao) : Promise.resolve([] as AutorPublico[]),
    todasDoRecorte(a.db, a.execucao, r, "arquivo do recorte", memoriaDosArquivos),
  ]);
  if (ehProblema(ms)) return estadoDe(ms);
  if (ehProblema(au)) return estadoDe(au);
  if (ehProblema(x)) return estadoDe(x);
  return {
    estado: "ok",
    execucao: a.execucao,
    municipios: nomesDe(ms),
    autores: au.map((y) => ({ codigo: y.codigo, nome: y.nome })),
    linhas: x.linhas,
    soma: x.soma,
    truncado: x.truncado,
  };
}

/** Os nomes dos municípios para a ficha (o rótulo da volta e o destaque); sem banco, lista vazia. */
export async function lerNomesDosMunicipios(): Promise<NomesDosMunicipios> {
  const a = await abrir();
  if (ehProblema(a)) return [];
  const ms = await municipios(a.db, a.execucao);
  return ehProblema(ms) ? [] : nomesDe(ms);
}
