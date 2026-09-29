/**
 * Leitura do dinheiro federal no TCE-PB (onda 12, parte 3B) — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página: tudo aqui é de administrador (nomes de empresa). As tabelas
 * da oport_22 não aceitam `anon` nem `authenticated`. Execução própria (`tce_ultima_execucao`), separada
 * da do painel: o TCE-PB é lido por partes, e um dia sem o TCE não tira o painel do ar.
 *
 * Volume esperado: 223 municípios × 3 anos na cobertura e na conciliação por município (~670 linhas cada),
 * alguns milhares de pares e de credores do Pix. As listas do painel leem em páginas de mil.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { todas } from "./padroes.server";
import type { TceCobertura, TceExecucao, TceFederalMunicipio, TceFederalPar, TcePixCredor, TcePixMunicipio } from "./tce";

type Falha = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" };
type Banco = ReturnType<typeof clienteServidor>;
type Resposta = { data: unknown; error: { message: string; code?: string } | null };

function falha(onde: string, erro: { message: string; code?: string }): Falha {
  if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
  console.error(`${onde}:`, erro.message);
  return { estado: "erro" };
}

const ehFalha = <T,>(x: T | Falha): x is Falha => !!x && typeof x === "object" && !Array.isArray(x) && "estado" in (x as object);

async function execucaoTce(db: Banco): Promise<TceExecucao | Falha> {
  const r = await db.rpc("tce_ultima_execucao");
  if (r.error) return falha("tce (execução)", r.error);
  return ((r.data as TceExecucao[] | null)?.[0] ?? { estado: "sem_execucao" }) as TceExecucao | Falha;
}

async function tudo<T>(onde: string, consulta: (a: number, b: number) => PromiseLike<Resposta>): Promise<T[] | Falha> {
  const r = await todas<T>(onde, consulta);
  return Array.isArray(r) ? r : falha(onde, { message: "leitura falhou" });
}

// ================================================================ painel

export type LeituraPainelTce =
  | Falha
  | {
      estado: "ok";
      execucao: TceExecucao;
      cobertura: TceCobertura[];
      pix: TcePixMunicipio[];
      municipios: TceFederalMunicipio[];
    };

export async function lerPainelTce(): Promise<LeituraPainelTce> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const execucao = await execucaoTce(db);
  if (ehFalha(execucao)) return execucao;
  const id = execucao.id;
  const [cobertura, pix, municipios] = await Promise.all([
    tudo<TceCobertura>("lerPainelTce (cobertura)", (a, b) =>
      db.from("tce_cobertura").select("ibge,ano,lido,modificado,coletado_em,motivo").eq("execucao_id", id).order("ibge").order("ano").range(a, b),
    ),
    tudo<TcePixMunicipio>("lerPainelTce (Pix)", (a, b) => db.from("tce_pix_municipio").select("*").eq("execucao_id", id).order("ibge").order("ano").range(a, b)),
    tudo<TceFederalMunicipio>("lerPainelTce (conciliação)", (a, b) =>
      db.from("tce_federal_municipio").select("*").eq("execucao_id", id).order("ibge").order("ano").range(a, b),
    ),
  ]);
  for (const x of [cobertura, pix, municipios]) if (ehFalha(x)) return x;
  return {
    estado: "ok",
    execucao,
    cobertura: cobertura as TceCobertura[],
    pix: pix as TcePixMunicipio[],
    municipios: municipios as TceFederalMunicipio[],
  };
}

// ================================================================ município

export type LeituraTceMunicipio =
  | Falha
  | {
      estado: "ok";
      execucao: TceExecucao;
      ibge: string;
      nome: string | null;
      cobertura: TceCobertura[];
      pix: TcePixMunicipio[];
      credores: TcePixCredor[];
      pares: TceFederalPar[];
      municipios: TceFederalMunicipio[];
    };

export async function lerTceMunicipio(ibge: string): Promise<LeituraTceMunicipio> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const execucao = await execucaoTce(db);
  if (ehFalha(execucao)) return execucao;
  const id = execucao.id;
  const doMunicipio = (t: string, colunas = "*") => (a: number, b: number) =>
    db.from(t).select(colunas).eq("execucao_id", id).eq("ibge", ibge).order("ano").range(a, b);
  const [cobertura, pix, credores, pares, municipios] = await Promise.all([
    tudo<TceCobertura>("lerTceMunicipio (cobertura)", doMunicipio("tce_cobertura", "ibge,ano,lido,modificado,coletado_em,motivo")),
    tudo<TcePixMunicipio>("lerTceMunicipio (Pix)", doMunicipio("tce_pix_municipio")),
    tudo<TcePixCredor>("lerTceMunicipio (credores)", doMunicipio("tce_pix_credor")),
    tudo<TceFederalPar>("lerTceMunicipio (pares)", doMunicipio("tce_federal_par")),
    tudo<TceFederalMunicipio>("lerTceMunicipio (conciliação)", doMunicipio("tce_federal_municipio")),
  ]);
  for (const x of [cobertura, pix, credores, pares, municipios]) if (ehFalha(x)) return x;
  const ms = municipios as TceFederalMunicipio[];
  const px = pix as TcePixMunicipio[];
  return {
    estado: "ok",
    execucao,
    ibge,
    nome: ms[0]?.municipio ?? px[0]?.municipio ?? null,
    cobertura: cobertura as TceCobertura[],
    pix: px,
    credores: credores as TcePixCredor[],
    pares: pares as TceFederalPar[],
    municipios: ms,
  };
}

// ================================================================ laudo e dossiê

/**
 * Os pares do TCE-PB dos fornecedores de um convênio, para o laudo. Falha vira `null` e uma linha em
 * `faltas`: é complemento.
 */
export async function lerTceDoConvenio(db: Banco, ibge: string, cnpjs: string[], faltas: string[]): Promise<TceFederalPar[] | null> {
  if (!cnpjs.length) return [];
  const execucao = await execucaoTce(db);
  if (ehFalha(execucao)) {
    if (execucao.estado !== "sem_execucao") faltas.push("TCE-PB");
    return execucao.estado === "sem_execucao" ? [] : null;
  }
  const r = await db.from("tce_federal_par").select("*").eq("execucao_id", execucao.id).eq("ibge", ibge).in("cnpj", cnpjs.slice(0, 200)).limit(2000);
  if (r.error) {
    if (!ehEsquemaAusente(r.error.code)) console.error("laudo do instrumento (TCE-PB):", r.error.message);
    faltas.push("TCE-PB");
    return null;
  }
  return (r.data ?? []) as TceFederalPar[];
}

export interface TceDoFornecedor {
  pares: TceFederalPar[];
  pix: TcePixCredor[];
  /** IBGE -> nome do município, para os que não estão nos convênios do dossiê (o Pix não tem convênio). */
  nomes: Record<string, string>;
}

/** O que o TCE-PB registra pago a um CNPJ, em qualquer município da PB. `null`: a leitura falhou. */
export async function lerTceDoFornecedor(cnpj: string): Promise<TceDoFornecedor | null> {
  if (!authConfigurada()) return null;
  const db = clienteServidor();
  const execucao = await execucaoTce(db);
  if (ehFalha(execucao)) return execucao.estado === "sem_execucao" || execucao.estado === "nao_ativado" ? { pares: [], pix: [], nomes: {} } : null;
  const [pares, pix] = await Promise.all([
    db.from("tce_federal_par").select("*").eq("execucao_id", execucao.id).eq("cnpj", cnpj).order("ano").limit(2000),
    db.from("tce_pix_credor").select("*").eq("execucao_id", execucao.id).eq("cnpj", cnpj).order("ano").limit(2000),
  ]);
  const erro = pares.error ?? pix.error;
  if (erro) {
    if (!ehEsquemaAusente(erro.code)) console.error("dossiê do fornecedor (TCE-PB):", erro.message);
    return null;
  }
  const ps = (pares.data ?? []) as TceFederalPar[];
  const px = (pix.data ?? []) as TcePixCredor[];
  const ibges = [...new Set([...ps.map((p) => p.ibge), ...px.map((p) => p.ibge)])];
  const nomes: Record<string, string> = {};
  if (ibges.length) {
    const m = await db.from("tce_federal_municipio").select("ibge,municipio").eq("execucao_id", execucao.id).in("ibge", ibges.slice(0, 250)).limit(1000);
    for (const x of (m.data ?? []) as { ibge: string; municipio: string | null }[]) if (x.municipio) nomes[x.ibge] = x.municipio;
  }
  return { pares: ps, pix: px, nomes };
}
