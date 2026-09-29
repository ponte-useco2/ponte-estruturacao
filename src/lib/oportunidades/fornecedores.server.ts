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
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import {
  COLUNAS_CONTRATO,
  COLUNAS_FORNECEDOR,
  COLUNAS_FORNECEDOR_CONVENIO,
  type ConcentracaoMunicipio,
  type Contrato,
  type EntradaFornecedores,
  type Fornecedor,
  type FornecedorConvenio,
} from "./fornecedores";
import { todas } from "./padroes.server";

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
  return {
    linhas: ls,
    fornecedores,
    contratos: (contratos.data ?? []) as unknown as Contrato[],
    municipio: ((municipio.data ?? []) as ConcentracaoMunicipio[])[0] ?? null,
  };
}

// ================================================================ painel

export type Ordem = "municipios" | "valor";
export type Marca = "inidoneos" | "mei";

export interface FiltroFornecedores {
  q: string | null;
  municipio: string | null;
  ordem: Ordem;
  marca: Marca | null;
}

/** Uma empresa da lista; com filtro de município, o que ela recebeu nos convênios de lá. */
export type LinhaPainel = Fornecedor & { noMunicipio: { pago: number; convenios: number } | null };

export type LeituraPainelFornecedores =
  | Falha
  | {
      estado: "ok";
      execucao: Execucao;
      linhas: LinhaPainel[];
      /** Quantas empresas atendem o filtro (a lista mostra até `POR_PAGINA`). */
      total: number;
      totais: { fornecedores: number; inidoneos: number; mei: number; naoVerificados: number };
      municipios: ConcentracaoMunicipio[];
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
  const [municipios, nTotal, nInidoneos, nMei, nSemTcu] = await Promise.all([
    db.from("painel_fornecedor_municipio").select("*").eq("execucao_id", id).order("pago_pj", { ascending: false }).limit(1000),
    contar(),
    contar((q) => q.eq("inidoneo_tcu", true)),
    contar((q) => q.eq("mei", true)),
    contar((q) => q.is("inidoneo_tcu", null)),
  ]);
  const erro = municipios.error ?? nTotal.error ?? nInidoneos.error ?? nMei.error ?? nSemTcu.error;
  if (erro) return falha("lerPainelFornecedores (totais)", erro);
  const ms = (municipios.data ?? []) as ConcentracaoMunicipio[];
  const totais = { fornecedores: nTotal.count ?? 0, inidoneos: nInidoneos.count ?? 0, mei: nMei.count ?? 0, naoVerificados: nSemTcu.count ?? 0 };

  const digitos = (filtro.q ?? "").replace(/\D/g, "");
  const porCnpj = digitos.length >= 8 && digitos.length === (filtro.q ?? "").replace(/[\s./-]/g, "").length;
  const texto = (filtro.q ?? "").trim();
  const casa = (f: Fornecedor) =>
    (!texto || (porCnpj ? f.cnpj.startsWith(digitos) : (f.nome ?? "").toLowerCase().includes(texto.toLowerCase()))) &&
    (filtro.marca !== "inidoneos" || f.inidoneo_tcu === true) &&
    (filtro.marca !== "mei" || f.mei);
  const ordenar = (a: LinhaPainel, b: LinhaPainel) => {
    const pa = a.noMunicipio?.pago ?? a.pb_pago;
    const pb = b.noMunicipio?.pago ?? b.pb_pago;
    return filtro.ordem === "valor" ? pb - pa : b.pb_municipios - a.pb_municipios || pb - pa;
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
    const linhas = fs
      .filter(casa)
      .map((f) => ({ ...f, noMunicipio: agregado.get(f.cnpj) ?? null }))
      .sort(ordenar);
    return { estado: "ok", execucao, linhas: linhas.slice(0, POR_PAGINA), total: linhas.length, totais, municipios: ms };
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
  const linhas = ((r.data ?? []) as unknown as Fornecedor[]).map((f) => ({ ...f, noMunicipio: null }));
  return { estado: "ok", execucao, linhas, total: r.count ?? linhas.length, totais, municipios: ms };
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

  const [convenios, contratos, lidera] = await Promise.all([
    todas<FornecedorConvenio>("lerDossieFornecedor (convênios)", (a, b) =>
      db.from("painel_fornecedor_convenio").select(COLUNAS_FORNECEDOR_CONVENIO).eq("execucao_id", id).eq("cnpj", cnpj).order("nr_convenio").range(a, b),
    ),
    todas<Contrato>("lerDossieFornecedor (contratos)", (a, b) =>
      db.from("painel_contrato").select(COLUNAS_CONTRATO).eq("execucao_id", id).eq("cnpj", cnpj).order("dt_assinatura").range(a, b),
    ),
    db.from("painel_fornecedor_municipio").select("*").eq("execucao_id", id).eq("maior_cnpj", cnpj).order("maior_fatia", { ascending: false }).limit(300),
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
  };
}
