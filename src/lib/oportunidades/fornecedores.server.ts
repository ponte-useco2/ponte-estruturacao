/**
 * Leitura dos fornecedores (onda 12, parte 3) — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página: o painel, o dossiê e a seção do laudo são só de
 * administradores (nomes de empresa, inclusive de MEI). As tabelas da oport_21 não aceitam `anon` nem
 * `authenticated`.
 *
 * Volume no SICONV de 14/09/2026: 4,3 mil empresas, 11 mil pares empresa × convênio, 14,6 mil contratos
 * e 223 municípios. A lista pede uma página ordenada ao banco; o filtro por município lê os pares
 * daquele município (em João Pessoa, poucas centenas) e completa com as empresas em lotes.
 *
 * CEIS e CNEP (D1, 08/10/2026) têm execução própria (`sancao_ultima_execucao`, oport_36), semanal e separada da
 * do painel: a marca de cada empresa vem da última rodada concluída, para os CNPJs da tela.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { diaBrasilia } from "./datas";
import { ehEsquemaAusente } from "./esquema";
import {
  COLUNAS_CONSULTA_SANCAO,
  COLUNAS_CONTRATO,
  COLUNAS_FORNECEDOR,
  COLUNAS_FORNECEDOR_CONVENIO,
  COLUNAS_REGISTRO_SANCAO,
  cadastrosDe,
  situacaoSancao,
  type ConcentracaoMunicipio,
  type ConsultaSancao,
  type Contrato,
  type EntradaFornecedores,
  type EntradaSancoes,
  type Fornecedor,
  type FornecedorConvenio,
  type LeituraCeisCnep,
  type RegistroSancao,
  type SituacaoSancao,
} from "./fornecedores";
import { todas } from "./padroes.server";
import { lerTceDoConvenio } from "./tce.server";

type Falha = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" };
type Banco = ReturnType<typeof clienteServidor>;
type Resposta = { data: unknown; error: { message: string; code?: string } | null };

interface Execucao {
  id: number;
  dado_ate: string;
  referencia: string | null;
}

/** Linhas por página da lista. */
export const POR_PAGINA = 100;
/** Quantos CNPJs vão num `in (...)`: o endereço da consulta não pode crescer sem limite. */
const LOTE_IN = 100;

function falha(onde: string, erro: { message: string; code?: string }): Falha {
  if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
  console.error(`${onde}:`, erro.message);
  return { estado: "erro" };
}

const ehFalha = <T,>(x: T | Falha): x is Falha => !!x && typeof x === "object" && "estado" in (x as object);

async function execucaoAtual(db: Banco): Promise<Execucao | Falha> {
  const r = await db.rpc("painel_ultima_execucao");
  if (r.error) return falha("fornecedores (execução)", r.error);
  const e = (r.data as Execucao[] | null)?.[0];
  return e ?? { estado: "sem_execucao" };
}

/** Linhas de uma tabela para uma lista de CNPJs, em lotes. */
async function porCnpjs<T>(onde: string, cnpjs: string[], consulta: (lote: string[]) => PromiseLike<Resposta>): Promise<T[] | Falha> {
  const saida: T[] = [];
  for (let k = 0; k < cnpjs.length; k += LOTE_IN) {
    const r = await consulta(cnpjs.slice(k, k + LOTE_IN));
    if (r.error) return falha(onde, r.error);
    saida.push(...((r.data ?? []) as T[]));
  }
  return saida;
}

// ================================================================ CEIS e CNEP (D1)

interface ExecucaoSancao {
  id: number;
  referencia: string | null;
  dado_ate: string | null;
}

/** A última rodada concluída de CEIS/CNEP. `undefined`: oport_36 não aplicada ou job sem rodada; `null`: falhou. */
async function execucaoSancao(db: Banco, onde: string): Promise<ExecucaoSancao | null | undefined> {
  const r = await db.rpc("sancao_ultima_execucao");
  if (r.error) {
    if (ehEsquemaAusente(r.error.code)) return undefined;
    console.error(`${onde} (CEIS/CNEP):`, r.error.message);
    return null;
  }
  return (r.data as ExecucaoSancao[] | null)?.[0] ?? undefined;
}

// O dia em Brasília quando só há o carimbo (A4x, integração da onda 4).
const referenciaSancao = (ex: ExecucaoSancao) => ex.referencia ?? (ex.dado_ate ? diaBrasilia(ex.dado_ate) : "");

/** A cobertura e os registros de uma lista de CNPJs numa rodada. `null`: a leitura falhou. */
async function sancoesDe(db: Banco, ex: ExecucaoSancao, cnpjs: string[], onde: string): Promise<EntradaSancoes | null> {
  const [consultas, registros] = await Promise.all([
    porCnpjs<ConsultaSancao>(`${onde} (CEIS/CNEP, cobertura)`, cnpjs, (lote) =>
      db.from("sancao_consulta").select(COLUNAS_CONSULTA_SANCAO).eq("execucao_id", ex.id).in("cnpj", lote),
    ),
    porCnpjs<RegistroSancao>(`${onde} (CEIS/CNEP, registros)`, cnpjs, (lote) =>
      db
        .from("sancao_registro")
        .select(COLUNAS_REGISTRO_SANCAO)
        .eq("execucao_id", ex.id)
        .in("cnpj", lote)
        .order("vigente", { ascending: false })
        .order("dt_inicio", { ascending: false })
        .limit(1000),
    ),
  ]);
  if (ehFalha(consultas) || ehFalha(registros)) return null;
  return { referencia: referenciaSancao(ex), consultas, registros };
}

/**
 * CEIS e CNEP de uma lista de CNPJs, para o laudo e o dossiê. `undefined`: "CEIS/CNEP não consultados" (sem
 * rodada); `null`: a leitura falhou agora.
 */
export async function lerSancoes(db: Banco, cnpjs: string[], onde: string): Promise<EntradaSancoes | null | undefined> {
  const ex = await execucaoSancao(db, onde);
  if (!ex) return ex;
  return sancoesDe(db, ex, cnpjs, onde);
}

/** Para a lista: a rodada e os CNPJs com registro vigente nela (a contagem e o filtro "só com registro"). */
async function vigentesDoPainel(
  db: Banco,
  onde: string,
): Promise<{ ex: ExecucaoSancao; vigentes: Set<string> } | null | undefined> {
  const ex = await execucaoSancao(db, onde);
  if (!ex) return ex;
  const v = await todas<{ cnpj: string }>(`${onde} (CEIS/CNEP vigentes)`, (a, b) =>
    db.from("sancao_registro").select("cnpj").eq("execucao_id", ex.id).eq("vigente", true).order("cnpj").range(a, b),
  );
  if (ehFalha(v)) return null;
  return { ex, vigentes: new Set(v.map((x) => x.cnpj)) };
}

// ================================================================ seção do laudo

/**
 * As empresas, os contratos e a concentração de um convênio, para o laudo. Falha vira `null` e uma linha
 * em `faltas`: a seção é complemento, não o laudo.
 */
export async function lerFornecedoresDoConvenio(
  db: Banco,
  execucaoId: number,
  i: { nr_convenio: string; tipo_agente?: string | null; cod_ibge?: string | null },
  faltas: string[],
): Promise<EntradaFornecedores | null> {
  const nome = "fornecedores";
  const [linhas, contratos, municipio] = await Promise.all([
    db.from("painel_fornecedor_convenio").select(COLUNAS_FORNECEDOR_CONVENIO).eq("execucao_id", execucaoId).eq("nr_convenio", i.nr_convenio).limit(1000),
    db.from("painel_contrato").select(COLUNAS_CONTRATO).eq("execucao_id", execucaoId).eq("nr_convenio", i.nr_convenio).order("dt_assinatura").limit(1000),
    i.tipo_agente === "municipio" && i.cod_ibge
      ? db.from("painel_fornecedor_municipio").select("*").eq("execucao_id", execucaoId).eq("cod_ibge", i.cod_ibge).limit(1)
      : Promise.resolve({ data: [], error: null } as Resposta),
  ]);
  const erro = linhas.error ?? contratos.error ?? municipio.error;
  if (erro) {
    if (!ehEsquemaAusente(erro.code)) console.error(`laudo do instrumento (${nome}):`, erro.message);
    faltas.push(nome);
    return null;
  }
  const ls = (linhas.data ?? []) as unknown as FornecedorConvenio[];
  const fornecedores = await porCnpjs<Fornecedor>(`laudo do instrumento (${nome})`, [...new Set(ls.map((l) => l.cnpj))], (lote) =>
    db.from("painel_fornecedor").select(COLUNAS_FORNECEDOR).eq("execucao_id", execucaoId).in("cnpj", lote),
  );
  if (ehFalha(fornecedores)) {
    faltas.push(nome);
    return null;
  }
  // O TCE-PB é complemento do complemento: sem ele, a seção sai sem a coluna. CEIS e CNEP (D1) também: sem rodada,
  // a seção diz "CEIS/CNEP não consultados"; se a leitura falhar, vai para as faltas.
  const cnpjs = [...new Set(ls.map((l) => l.cnpj))];
  const [tce, sancoes] = await Promise.all([
    i.cod_ibge ? lerTceDoConvenio(db, i.cod_ibge, cnpjs, faltas) : Promise.resolve(null),
    cnpjs.length > 0 ? lerSancoes(db, cnpjs, `laudo do instrumento (${nome})`) : Promise.resolve(undefined),
  ]);
  if (sancoes === null) faltas.push("sanções no CEIS e no CNEP");
  return {
    tce,
    sancoes,
    linhas: ls,
    fornecedores,
    contratos: (contratos.data ?? []) as unknown as Contrato[],
    municipio: ((municipio.data ?? []) as ConcentracaoMunicipio[])[0] ?? null,
  };
}

// ================================================================ relatório do município (onda 8, B)

/** O que o relatório do município usa dos fornecedores: a concentração e os inidôneos com o que receberam lá. */
export type LeituraInidoneosMunicipio =
  | Falha
  | { estado: "ok"; concentracao: ConcentracaoMunicipio | null; inidoneos: { cnpj: string; nome: string | null; pago: number }[] };

/**
 * A concentração do município e os fornecedores inidôneos (TCU) que receberam nos convênios dele, para o relatório do
 * município (onda 8, B, 09/10/2026; R2 de 09/10, §2.4 e §5.5 item 5). Só a leitura completa, do nível 1 em diante: a
 * pública não lê fornecedores (onda 7, A).
 *
 * Antes, o relatório pedia a lista do painel (`lerPainelFornecedores`, com o município e a marca "inidôneos"), que lê o
 * que o relatório não usa: as 4 contagens exatas da base inteira, os CNPJs com registro no CEIS/CNEP e a situação de
 * cada linha. E lia TODOS os pares do município por OFFSET (João Pessoa: 2.466 pares, 3 páginas) e TODAS as empresas
 * deles em lotes de 100, um depois do outro (1.565 CNPJs, 16 lotes), para no fim ficar só com os inidôneos — 15 na base
 * inteira em 09/10. Em João Pessoa eram ~29 pedidos e ~21 idas e voltas em série; em Patos, ~13 e ~8.
 *
 * Agora, 3 pedidos em 2 idas e voltas, em qualquer município: os inidôneos da execução (uma página) junto com a
 * concentração do município (pela chave); depois, só os pares desses CNPJs no município, pelo índice
 * `(execucao_id, cnpj)` (João Pessoa: 4 pares). Sem índice novo: o que pesava eram as idas e voltas, não o banco (a
 * página de pares por IBGE leva 5 ms e as contagens, 1 ms cada; medido pelo MCP em 09/10).
 *
 * O resultado é o mesmo da lista antiga: a soma por CNPJ não muda quando se filtra pelo CNPJ antes de somar, e seguem a
 * mesma ordem (o que recebeu mais primeiro), o mesmo corte de `POR_PAGINA` e o mesmo "só quem recebeu" (pago > 0).
 * Conferido pelo MCP em 09/10, refazendo as duas formas em SQL: 223 municípios, 223 iguais (36 inidôneos em 30
 * municípios). O município sem concentração caía na lista geral, sem o valor de lá, e saía sem inidôneo nenhum: aqui,
 * direto. A diferença está só nas falhas: as contagens e o CEIS/CNEP não lidos já não podem derrubar a seção.
 */
export async function lerInidoneosDoMunicipio(db: Banco, execucaoId: number, ibge: string): Promise<LeituraInidoneosMunicipio> {
  const onde = "relatório do município (fornecedores)";
  const [municipio, inidoneos] = await Promise.all([
    db.from("painel_fornecedor_municipio").select("*").eq("execucao_id", execucaoId).eq("cod_ibge", ibge).limit(1),
    todas<Pick<Fornecedor, "cnpj" | "nome">>(`${onde}, inidôneos`, (a, b) =>
      db.from("painel_fornecedor").select("cnpj,nome").eq("execucao_id", execucaoId).eq("inidoneo_tcu", true).order("cnpj").range(a, b),
    ),
  ]);
  if (municipio.error) return falha(`${onde}, concentração`, municipio.error);
  if (ehFalha(inidoneos)) return inidoneos;
  const concentracao = ((municipio.data ?? []) as ConcentracaoMunicipio[])[0] ?? null;
  if (!concentracao || inidoneos.length === 0) return { estado: "ok", concentracao, inidoneos: [] };

  // O que cada inidôneo recebeu no município: só os pares dele lá, somados na ordem em que chegam, como antes.
  const recebido = new Map<string, number>();
  for (let k = 0; k < inidoneos.length; k += LOTE_IN) {
    const lote = inidoneos.slice(k, k + LOTE_IN).map((f) => f.cnpj);
    const pares = await todas<Pick<FornecedorConvenio, "cnpj" | "pago">>(`${onde}, pares`, (a, b) =>
      db.from("painel_fornecedor_convenio").select("cnpj,pago").eq("execucao_id", execucaoId).eq("cod_ibge", ibge).in("cnpj", lote).order("cnpj").range(a, b),
    );
    if (ehFalha(pares)) return pares;
    for (const p of pares) recebido.set(p.cnpj, (recebido.get(p.cnpj) ?? 0) + p.pago);
  }
  const lista = inidoneos
    .filter((f) => recebido.has(f.cnpj))
    .map((f) => ({ cnpj: f.cnpj, nome: f.nome, pago: recebido.get(f.cnpj) ?? 0 }))
    .sort((a, b) => b.pago - a.pago)
    .slice(0, POR_PAGINA)
    .filter((f) => f.pago > 0);
  return { estado: "ok", concentracao, inidoneos: lista };
}

// ================================================================ painel

export type Ordem = "municipios" | "valor";
/** `sancionadas` (D1): só as empresas com registro vigente no CEIS ou no CNEP na última consulta. */
export type Marca = "inidoneos" | "mei" | "sancionadas";

export interface FiltroFornecedores {
  q: string | null;
  municipio: string | null;
  ordem: Ordem;
  marca: Marca | null;
}

type NoMunicipio = { pago: number; convenios: number } | null;

/**
 * Uma empresa da lista; com filtro de município, o que ela recebeu nos convênios de lá. `ceisCnep` e `cadastros`
 * (D1): a situação na última consulta e, quando há registro vigente, em que cadastro.
 */
export type LinhaPainel = Fornecedor & { noMunicipio: NoMunicipio; ceisCnep: SituacaoSancao; cadastros: string | null };

export type LeituraPainelFornecedores =
  | Falha
  | {
      estado: "ok";
      execucao: Execucao;
      linhas: LinhaPainel[];
      /** Quantas empresas atendem o filtro (a lista mostra até `POR_PAGINA`). */
      total: number;
      /** `sancionadas`: empresas com registro vigente no CEIS/CNEP; `null` quando não há leitura (D1). */
      totais: { fornecedores: number; inidoneos: number; mei: number; naoVerificados: number; sancionadas: number | null };
      municipios: ConcentracaoMunicipio[];
      ceisCnep: LeituraCeisCnep;
    };

export async function lerPainelFornecedores(filtro: FiltroFornecedores): Promise<LeituraPainelFornecedores> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const execucao = await execucaoAtual(db);
  if (ehFalha(execucao)) return execucao;
  const id = execucao.id;

  const base = () => db.from("painel_fornecedor").select("cnpj", { count: "exact", head: true }).eq("execucao_id", id);
  type Contagem = ReturnType<typeof base>;
  const contar = (filtrar: (q: Contagem) => Contagem = (q) => q) => filtrar(base());
  const [municipios, nTotal, nInidoneos, nMei, nSemTcu, cgu] = await Promise.all([
    db.from("painel_fornecedor_municipio").select("*").eq("execucao_id", id).order("pago_pj", { ascending: false }).limit(1000),
    contar(),
    contar((q) => q.eq("inidoneo_tcu", true)),
    contar((q) => q.eq("mei", true)),
    contar((q) => q.is("inidoneo_tcu", null)),
    // D1: a falha do CEIS/CNEP não derruba a lista; a página diz que não leu.
    vigentesDoPainel(db, "lerPainelFornecedores"),
  ]);
  const erro = municipios.error ?? nTotal.error ?? nInidoneos.error ?? nMei.error ?? nSemTcu.error;
  if (erro) return falha("lerPainelFornecedores (totais)", erro);
  const ms = (municipios.data ?? []) as ConcentracaoMunicipio[];
  const vigentes = cgu ? cgu.vigentes : new Set<string>();
  const totais = {
    fornecedores: nTotal.count ?? 0,
    inidoneos: nInidoneos.count ?? 0,
    mei: nMei.count ?? 0,
    naoVerificados: nSemTcu.count ?? 0,
    sancionadas: cgu ? vigentes.size : null,
  };

  // A situação CEIS/CNEP de cada empresa da tela, pela cobertura e pelos registros da rodada (D1).
  let ceisCnep: LeituraCeisCnep =
    cgu === undefined ? { estado: "nao_consultado" } : cgu === null ? { estado: "falhou" } : { estado: "consultado", referencia: referenciaSancao(cgu.ex) };
  const marcar = async (fs: (Fornecedor & { noMunicipio: NoMunicipio })[]): Promise<LinhaPainel[]> => {
    const s = cgu && fs.length > 0 ? await sancoesDe(db, cgu.ex, fs.map((f) => f.cnpj), "lerPainelFornecedores") : undefined;
    if (s === null) ceisCnep = { estado: "falhou" };
    return fs.map((f) => {
      const vig = s ? s.registros.filter((r) => r.cnpj === f.cnpj && r.vigente) : [];
      return { ...f, ceisCnep: situacaoSancao(f.cnpj, s), cadastros: vig.length > 0 ? cadastrosDe(vig) : null };
    });
  };

  const digitos = (filtro.q ?? "").replace(/\D/g, "");
  const porCnpj = digitos.length >= 8 && digitos.length === (filtro.q ?? "").replace(/[\s./-]/g, "").length;
  const texto = (filtro.q ?? "").trim();
  const casa = (f: Fornecedor) =>
    (!texto || (porCnpj ? f.cnpj.startsWith(digitos) : (f.nome ?? "").toLowerCase().includes(texto.toLowerCase()))) &&
    (filtro.marca !== "inidoneos" || f.inidoneo_tcu === true) &&
    (filtro.marca !== "mei" || f.mei) &&
    (filtro.marca !== "sancionadas" || vigentes.has(f.cnpj));
  const ordenar = (a: { pb_pago: number; pb_municipios: number; noMunicipio: NoMunicipio }, b: typeof a) => {
    const pa = a.noMunicipio?.pago ?? a.pb_pago;
    const pb = b.noMunicipio?.pago ?? b.pb_pago;
    return filtro.ordem === "valor" ? pb - pa : b.pb_municipios - a.pb_municipios || pb - pa;
  };
  /** Filtra, ordena e corta na memória o que já foi lido em lotes (o município ou "só com registro no CEIS/CNEP"). */
  const naMemoria = async (fs: Fornecedor[], noMunicipio: (cnpj: string) => NoMunicipio): Promise<LeituraPainelFornecedores> => {
    const todasAsLinhas = fs
      .filter(casa)
      .map((f) => ({ ...f, noMunicipio: noMunicipio(f.cnpj) }))
      .sort(ordenar);
    const linhas = await marcar(todasAsLinhas.slice(0, POR_PAGINA));
    return { estado: "ok", execucao, linhas, total: todasAsLinhas.length, totais, municipios: ms, ceisCnep };
  };

  // Com município: as empresas que receberam nos convênios de lá, com o valor de lá.
  if (filtro.municipio && ms.some((m) => m.cod_ibge === filtro.municipio)) {
    const pares = await todas<Pick<FornecedorConvenio, "cnpj" | "nr_convenio" | "pago">>("lerPainelFornecedores (município)", (a, b) =>
      db
        .from("painel_fornecedor_convenio")
        .select("cnpj,nr_convenio,pago")
        .eq("execucao_id", id)
        .eq("cod_ibge", filtro.municipio as string)
        .order("cnpj")
        .range(a, b),
    );
    if (ehFalha(pares)) return pares;
    const agregado = new Map<string, { pago: number; convenios: number }>();
    for (const p of pares) {
      const x = agregado.get(p.cnpj) ?? { pago: 0, convenios: 0 };
      x.pago += p.pago;
      x.convenios += p.pago > 0 ? 1 : 0;
      agregado.set(p.cnpj, x);
    }
    const fs = await porCnpjs<Fornecedor>("lerPainelFornecedores (empresas do município)", [...agregado.keys()], (lote) =>
      db.from("painel_fornecedor").select(COLUNAS_FORNECEDOR).eq("execucao_id", id).in("cnpj", lote),
    );
    if (ehFalha(fs)) return fs;
    return naMemoria(fs, (cnpj) => agregado.get(cnpj) ?? null);
  }

  // Só com registro vigente no CEIS/CNEP: poucas dezenas de empresas, lidas em lotes pelo CNPJ (D1).
  if (filtro.marca === "sancionadas") {
    const fs = await porCnpjs<Fornecedor>("lerPainelFornecedores (CEIS/CNEP)", [...vigentes].sort(), (lote) =>
      db.from("painel_fornecedor").select(COLUNAS_FORNECEDOR).eq("execucao_id", id).in("cnpj", lote),
    );
    if (ehFalha(fs)) return fs;
    return naMemoria(fs, () => null);
  }

  let q = db.from("painel_fornecedor").select(COLUNAS_FORNECEDOR, { count: "exact" }).eq("execucao_id", id);
  if (texto) q = porCnpj ? q.like("cnpj", `${digitos}%`) : q.ilike("nome", `%${texto}%`);
  if (filtro.marca === "inidoneos") q = q.eq("inidoneo_tcu", true);
  if (filtro.marca === "mei") q = q.eq("mei", true);
  q =
    filtro.ordem === "valor"
      ? q.order("pb_pago", { ascending: false })
      : q.order("pb_municipios", { ascending: false }).order("pb_pago", { ascending: false });
  const r = await q.order("cnpj").range(0, POR_PAGINA - 1);
  if (r.error) return falha("lerPainelFornecedores (lista)", r.error);
  const linhas = await marcar(((r.data ?? []) as unknown as Fornecedor[]).map((f) => ({ ...f, noMunicipio: null })));
  return { estado: "ok", execucao, linhas, total: r.count ?? linhas.length, totais, municipios: ms, ceisCnep };
}

// ================================================================ dossiê

/** O mínimo do instrumento para a tabela do dossiê. */
export interface InstrumentoDoFornecedor {
  nr_convenio: string;
  programa: string | null;
  objeto: string | null;
  situacao: string | null;
}

export type LeituraDossieFornecedor =
  | Falha
  | { estado: "nao_encontrado"; execucao: Execucao }
  | {
      estado: "ok";
      execucao: Execucao;
      fornecedor: Fornecedor;
      convenios: FornecedorConvenio[];
      contratos: Contrato[];
      instrumentos: InstrumentoDoFornecedor[];
      /** Municípios em que esta empresa é o maior fornecedor da prefeitura. */
      lidera: ConcentracaoMunicipio[];
      /** CEIS e CNEP (D1). `undefined`: não consultados (sem rodada); `null`: a leitura falhou agora. */
      sancoes: EntradaSancoes | null | undefined;
    };

export async function lerDossieFornecedor(cnpj: string): Promise<LeituraDossieFornecedor> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const execucao = await execucaoAtual(db);
  if (ehFalha(execucao)) return execucao;
  const id = execucao.id;

  const f = await db.from("painel_fornecedor").select(COLUNAS_FORNECEDOR).eq("execucao_id", id).eq("cnpj", cnpj).limit(1);
  if (f.error) return falha("lerDossieFornecedor (empresa)", f.error);
  const fornecedor = ((f.data ?? []) as unknown as Fornecedor[])[0];
  if (!fornecedor) return { estado: "nao_encontrado", execucao };

  const [convenios, contratos, lidera, sancoes] = await Promise.all([
    todas<FornecedorConvenio>("lerDossieFornecedor (convênios)", (a, b) =>
      db.from("painel_fornecedor_convenio").select(COLUNAS_FORNECEDOR_CONVENIO).eq("execucao_id", id).eq("cnpj", cnpj).order("nr_convenio").range(a, b),
    ),
    todas<Contrato>("lerDossieFornecedor (contratos)", (a, b) =>
      db.from("painel_contrato").select(COLUNAS_CONTRATO).eq("execucao_id", id).eq("cnpj", cnpj).order("dt_assinatura").range(a, b),
    ),
    db.from("painel_fornecedor_municipio").select("*").eq("execucao_id", id).eq("maior_cnpj", cnpj).order("maior_fatia", { ascending: false }).limit(300),
    lerSancoes(db, [cnpj], "lerDossieFornecedor"),
  ]);
  if (ehFalha(convenios)) return convenios;
  if (ehFalha(contratos)) return contratos;
  if (lidera.error) return falha("lerDossieFornecedor (concentração)", lidera.error);

  const nrs = [...new Set([...convenios.map((c) => c.nr_convenio), ...contratos.map((c) => c.nr_convenio)])];
  const instrumentos = await porCnpjs<InstrumentoDoFornecedor>("lerDossieFornecedor (instrumentos)", nrs, (lote) =>
    db.from("painel_instrumento").select("nr_convenio,programa,objeto,situacao").eq("execucao_id", id).in("nr_convenio", lote),
  );
  if (ehFalha(instrumentos)) return instrumentos;

  return {
    estado: "ok",
    execucao,
    fornecedor,
    convenios,
    contratos,
    instrumentos,
    lidera: (lidera.data ?? []) as ConcentracaoMunicipio[],
    sancoes,
  };
}
