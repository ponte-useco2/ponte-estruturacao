/**
 * Leitura das emendas parlamentares com destino à PB (onda 14, parte 2, A, 13/10/2026) — só servidor, só chave de
 * serviço.
 *
 * Quem decide se a pessoa pode ver é a página: as telas são só de administrador até a revisão jurídica. As tabelas e as
 * funções `emd_*` da oport_39 não aceitam `anon` nem `authenticated` (RLS sem política, grants só para `service_role`):
 * a leitura vai pelo mesmo cliente de servidor dos outros leitores e chama as funções de leitura por RPC, que já somam
 * só o que nenhum outro canal cobre e nunca somam o catálogo com o canal.
 *
 * Uma execução só por leitura: a última concluída (`emd_ultima_execucao`) é lida primeiro, e o `id` dela vai como
 * `p_execucao` em toda função seguinte. Assim a página nunca mistura duas rodadas, nem quando o job semanal conclui no
 * meio da leitura. Da execução saem a data do dado (`dado_ate`, o Last-Modified do arquivo do Portal), a da rodada e
 * as propostas do FNS ainda sem o detalhe (`contagens.emd_fns_detalhes_pendentes`); a coluna `erro` não é lida.
 *
 * A população vem de `fiscal_municipio` da última execução do fiscal (ibge, nome e população dos 223), a mesma base da
 * página da UF. Sem execução do fiscal, ou com a tabela ausente, a lista de municípios vem vazia (o per capita sai
 * null); o erro do fiscal derruba a leitura (`falha`), porque a ficha sem população mostraria "0 atendidos".
 *
 * Os estados: tabela ou função ausente (42P01, PGRST205 e os de função, `ehEsquemaAusente`) e banco sem execução
 * concluída viram `sem_dado`; o outro erro, ou a consulta que passa de 8 s, vira `falha`, com `console.error` que diz
 * onde e o código, sem dado de pessoa (só a mensagem do banco, nunca as linhas); o código de autor que não existe na
 * execução vira `nao_encontrado`. O código fora do formato nem chega ao banco.
 *
 * Memória por instância de 10 minutos (`memoria.ts`), sem a camada compartilhada (`cache-dados.ts`): o dado é só de
 * administrador, e o cache comum guardaria dado interno para todas as instâncias. Fica o "ok" e, na ficha, o "não
 * encontrado"; `sem_dado` e `falha` voltam sem ficar, e a próxima visita lê de novo.
 *
 * Volume na execução 1 (12/10/2026): 383 autores; `emd_destino` de um autor, até umas centenas de linhas; `emd_safra`,
 * umas centenas. A API devolve no máximo mil linhas por pedido: as funções que podem passar disso são lidas em páginas
 * de mil, com ordem pela chave do agrupamento. Fica de fora o `import "server-only"`: ele pede o pacote no
 * `web/package.json`, que é de outra sessão.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import {
  codigoAutorDaUrl,
  type AnoCanalEmendas,
  type AutorEmendas,
  type DestinoEmendas,
  type ExecucaoEmendas,
  type LeituraEmendasMunicipio,
  type LeituraParlamentar,
  type LeituraParlamentares,
  type MunicipioPopulacao,
  type SafraEmendas,
} from "./emendas";

type Banco = ReturnType<typeof clienteServidor>;
type Erro = { message: string; code?: string };
type Resposta = { data: unknown; error: Erro | null };

const TEMPO_LIMITE_MS = 8_000;
/** 10 minutos, a validade de `memoria.ts`: o job é semanal, e 10 minutos não escondem rodada nenhuma. */
const VALIDADE_MS = 10 * 60 * 1000;
/** O limite de linhas por pedido da API. */
const PAGINA = 1000;
/** Teto de páginas por função: 50 mil linhas, o mesmo de `todas`. */
const MAX_PAGINAS = 50;

/** O que pode dar errado numa leitura: a tabela ausente (`sem_dado`) ou outra coisa (`falha`). */
type Problema = { problema: "sem_dado" | "falha" };
const ehProblema = (x: unknown): x is Problema => !!x && typeof x === "object" && "problema" in (x as object);

function problemaDe(onde: string, erro: Erro): Problema {
  if (ehEsquemaAusente(erro.code)) return { problema: "sem_dado" };
  console.error(`emendas (${onde}):`, erro.code ?? "sem código", erro.message);
  return { problema: "falha" };
}

function problemaDaExcecao(onde: string, e: unknown): Problema {
  console.error(`emendas (${onde}):`, e instanceof Error ? e.message : "falha na leitura");
  return { problema: "falha" };
}

/** Uma consulta com o tempo-limite; nunca rejeita. */
async function uma<T>(onde: string, consulta: (sinal: AbortSignal) => PromiseLike<Resposta>): Promise<T | Problema> {
  try {
    const r = await consulta(AbortSignal.timeout(TEMPO_LIMITE_MS));
    if (r.error) return problemaDe(onde, r.error);
    return r.data as T;
  } catch (e) {
    return problemaDaExcecao(onde, e);
  }
}

/** Todas as linhas, em páginas de mil, cada página com o seu tempo-limite; nunca rejeita. */
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
/** Os campos numéricos que a lógica lê, convertidos (o PostgREST manda `numeric` como número; aqui é só defesa). */
function comNumeros<T extends object>(linha: T, campos: readonly (keyof T)[]): T {
  const saida = { ...linha } as Record<keyof T, unknown>;
  for (const c of campos) saida[c] = num(saida[c]);
  return saida as T;
}

const CAMPOS_AUTOR = [
  "emendas", "convenio_indicado", "convenio_valido", "convenio_pago", "pix_indicado", "pix_valido", "pix_pago",
  "fns_indicado", "fns_valido", "fns_pago", "favorecido_pago", "caducados", "caducado_valor", "na_fila", "municipios",
  "catalogo_empenhado_pb", "catalogo_pago_total_pb",
] as const satisfies readonly (keyof AutorEmendas)[];
const CAMPOS_DESTINO = ["instrumentos", "emendas", "indicado", "valido", "pago", "caducado"] as const satisfies readonly (keyof DestinoEmendas)[];
const CAMPOS_ANO = ["ano", "emendas", "indicado", "valido", "pago", "caducado"] as const satisfies readonly (keyof AnoCanalEmendas)[];
const CAMPOS_SAFRA = ["ano", "autores", "emendas", "valido", "pago"] as const satisfies readonly (keyof SafraEmendas)[];

const autorDaLinha = (l: AutorEmendas): AutorEmendas => ({
  ...comNumeros(l, CAMPOS_AUTOR),
  ano_min: numOuNull(l.ano_min),
  ano_max: numOuNull(l.ano_max),
});

// ================================================================ execução e população

interface LinhaExecucao {
  id: number;
  concluida_em: string;
  dado_ate: string | null;
  contagens: Record<string, unknown> | null;
}

/** A última execução concluída; `sem_dado` sem a tabela ou sem execução concluída. */
async function lerExecucao(db: Banco): Promise<ExecucaoEmendas | Problema> {
  const r = await uma<LinhaExecucao[]>("execução", (sinal) =>
    db.rpc("emd_ultima_execucao").select("id,concluida_em,dado_ate,contagens").limit(1).abortSignal(sinal),
  );
  if (ehProblema(r)) return r;
  const e = (r ?? [])[0];
  if (!e) return { problema: "sem_dado" };
  return {
    id: num(e.id),
    concluidaEm: e.concluida_em,
    dadoAte: e.dado_ate ?? null,
    fnsPendentes: num(e.contagens?.emd_fns_detalhes_pendentes),
  };
}

/** Os 223 da última execução do fiscal (ibge, nome, população); vazio sem a tabela ou sem execução. */
async function lerMunicipios(db: Banco): Promise<MunicipioPopulacao[] | Problema> {
  const ex = await uma<{ id: number }[]>("execução do fiscal", (sinal) => db.rpc("fiscal_ultima_execucao").select("id").limit(1).abortSignal(sinal));
  if (ehProblema(ex)) return ex.problema === "sem_dado" ? [] : ex;
  const id = (ex ?? [])[0]?.id;
  if (id === undefined || id === null) return [];
  const r = await uma<{ ibge: string; nome: string; populacao: number | string | null }[]>("população", (sinal) =>
    db.from("fiscal_municipio").select("ibge,nome,populacao").eq("execucao_id", id).order("ibge").limit(PAGINA).abortSignal(sinal),
  );
  if (ehProblema(r)) return r.problema === "sem_dado" ? [] : r;
  return (r ?? []).map((m) => ({ ibge: m.ibge, nome: m.nome, populacao: numOuNull(m.populacao) }));
}

// ================================================================ as três leituras

const lista = criarMemoria<LeituraParlamentares>({ validadeMs: VALIDADE_MS, maximo: 1, guardar: (l) => l.estado === "ok" });
const fichas = criarMemoria<LeituraParlamentar>({
  validadeMs: VALIDADE_MS,
  maximo: 50,
  guardar: (l) => l.estado === "ok" || l.estado === "nao_encontrado",
});
const doMunicipio = criarMemoria<LeituraEmendasMunicipio>({ validadeMs: VALIDADE_MS, maximo: 50, guardar: (l) => l.estado === "ok" });

const estadoDe = (p: Problema): { estado: "sem_dado" } | { estado: "falha" } =>
  p.problema === "sem_dado" ? { estado: "sem_dado" } : { estado: "falha" };

/**
 * A lista dos autores (`emd_autores`), em ordem de código (a chave única, para as páginas de mil não pularem linha): a
 * página põe na ordem de tipo e nome com `ordenarAutores`. Não altere o objeto devolvido.
 */
export function lerParlamentares(): Promise<LeituraParlamentares> {
  return lista.obter("lista", lerParlamentaresDoBanco);
}

async function lerParlamentaresDoBanco(): Promise<LeituraParlamentares> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const execucao = await lerExecucao(db);
  if (ehProblema(execucao)) return estadoDe(execucao);
  const autores = await todasAsLinhas<AutorEmendas>("autores", (a, b, sinal) =>
    db.rpc("emd_autores", { p_execucao: execucao.id }).order("codigo").range(a, b).abortSignal(sinal),
  );
  if (ehProblema(autores)) return estadoDe(autores);
  return { estado: "ok", execucao, autores: autores.map(autorDaLinha) };
}

/**
 * A ficha de um autor: a linha dele em `emd_autores`, o acesso por ano e canal (`emd_autor_anos`), o destino
 * (`emd_destino` com `p_autor`), a safra da PB (`emd_safra`) e os municípios com a população. Código fora do formato:
 * `nao_encontrado`, sem ler o banco. Não altere o objeto devolvido.
 */
export function lerParlamentar(codigo: string): Promise<LeituraParlamentar> {
  const c = codigoAutorDaUrl(codigo);
  if (!c) return Promise.resolve({ estado: "nao_encontrado" });
  return fichas.obter(c, () => lerParlamentarDoBanco(c));
}

async function lerParlamentarDoBanco(codigo: string): Promise<LeituraParlamentar> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const execucao = await lerExecucao(db);
  if (ehProblema(execucao)) return estadoDe(execucao);
  const p = { p_execucao: execucao.id };
  const [autor, anos, destino, safra, municipios] = await Promise.all([
    uma<AutorEmendas[]>("autor", (sinal) => db.rpc("emd_autores", p).eq("codigo", codigo).limit(1).abortSignal(sinal)),
    todasAsLinhas<AnoCanalEmendas>("anos do autor", (a, b, sinal) =>
      db.rpc("emd_autor_anos", { ...p, p_autor: codigo }).order("ano").order("canal").range(a, b).abortSignal(sinal),
    ),
    todasAsLinhas<DestinoEmendas>("destino do autor", (a, b, sinal) =>
      db
        .rpc("emd_destino", { ...p, p_autor: codigo })
        .order("ibge", { nullsFirst: false })
        .order("canal")
        .order("ente_tipo", { nullsFirst: false })
        .range(a, b)
        .abortSignal(sinal),
    ),
    todasAsLinhas<SafraEmendas>("safra", (a, b, sinal) =>
      db.rpc("emd_safra", p).order("ano").order("canal").order("tipo").range(a, b).abortSignal(sinal),
    ),
    lerMunicipios(db),
  ]);
  for (const x of [autor, anos, destino, safra, municipios]) if (ehProblema(x)) return estadoDe(x);
  const linha = (autor as AutorEmendas[] | null)?.[0];
  if (!linha) return { estado: "nao_encontrado" };
  return {
    estado: "ok",
    execucao,
    autor: autorDaLinha(linha),
    anos: (anos as AnoCanalEmendas[]).map((l) => comNumeros(l, CAMPOS_ANO)),
    destino: (destino as DestinoEmendas[]).map((l) => comNumeros(l, CAMPOS_DESTINO)),
    safra: (safra as SafraEmendas[]).map((l) => comNumeros(l, CAMPOS_SAFRA)),
    municipios: municipios as MunicipioPopulacao[],
  };
}

/**
 * O bloco "de onde vêm as emendas" de um município: `emd_destino` com `p_ibge` (o autor null é a proposta do FNS ainda
 * sem o detalhe) e o nome, o tipo e a pessoa curada dos autores que aparecem nele. IBGE fora do formato: `sem_dado`,
 * sem ler o banco. Não altere o objeto devolvido.
 */
export function lerEmendasDoMunicipio(ibge: string): Promise<LeituraEmendasMunicipio> {
  if (typeof ibge !== "string" || !/^\d{7}$/.test(ibge)) return Promise.resolve({ estado: "sem_dado" });
  return doMunicipio.obter(ibge, () => lerEmendasDoMunicipioDoBanco(ibge));
}

async function lerEmendasDoMunicipioDoBanco(ibge: string): Promise<LeituraEmendasMunicipio> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const execucao = await lerExecucao(db);
  if (ehProblema(execucao)) return estadoDe(execucao);
  const p = { p_execucao: execucao.id };
  // Os autores vão junto, e não depois do destino: uma ida e volta a menos. São 383 linhas de 5 colunas.
  const [destino, autores] = await Promise.all([
    todasAsLinhas<DestinoEmendas>("destino do município", (a, b, sinal) =>
      db
        .rpc("emd_destino", { ...p, p_ibge: ibge })
        .order("autor_codigo", { nullsFirst: false })
        .order("canal")
        .order("ente_tipo", { nullsFirst: false })
        .range(a, b)
        .abortSignal(sinal),
    ),
    todasAsLinhas<Pick<AutorEmendas, "codigo" | "nome" | "tipo" | "coletivo" | "pessoa">>("autores do município", (a, b, sinal) =>
      db.rpc("emd_autores", p).select("codigo,nome,tipo,coletivo,pessoa").order("codigo").range(a, b).abortSignal(sinal),
    ),
  ]);
  if (ehProblema(destino)) return estadoDe(destino);
  if (ehProblema(autores)) return estadoDe(autores);
  const presentes = new Set(destino.map((d) => d.autor_codigo).filter((c): c is string => !!c));
  return {
    estado: "ok",
    execucao,
    destino: destino.map((l) => comNumeros(l, CAMPOS_DESTINO)),
    autores: autores.filter((a) => presentes.has(a.codigo)),
  };
}
