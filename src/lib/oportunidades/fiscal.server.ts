/**
 * Leitura do Painel de Capacidade Fiscal — só servidor, só chave de serviço.
 *
 * As tabelas da `fiscal_1` não aceitam `anon` nem `authenticated`. Quem decide se a pessoa
 * pode ver é a página, com `ehAdministrador` (decisão do titular: MVP só para administradores).
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import type { ExecucaoFiscal, FonteEvidencia, HistoricoFiscal, MunicipioFiscal, ProjecaoFiscal, VerificacaoFiscal } from "./fiscal";

export type LeituraFiscal =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro" }
  | { estado: "ok"; execucao: ExecucaoFiscal; municipios: MunicipioFiscal[] };

export type LeituraMunicipioFiscal =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro" }
  | { estado: "nao_encontrado"; execucao: ExecucaoFiscal }
  | {
      estado: "ok";
      execucao: ExecucaoFiscal;
      municipio: MunicipioFiscal;
      verificacoes: VerificacaoFiscal[];
      historico: HistoricoFiscal[];
      /** CAUC e SIOPE, lidos uma vez para a UF inteira. */
      fontesUf: (FonteEvidencia & { chave: string })[];
      /** Cronograma do PVL de referência (`fiscal_2`); vazio sem pedido nos últimos 5 anos. */
      projecao: ProjecaoFiscal[];
    };

async function ultimaExecucao(): Promise<{ estado: "ok"; execucao: ExecucaoFiscal } | { estado: "nao_ativado" | "sem_execucao" | "erro" }> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const { data, error } = await clienteServidor().rpc("fiscal_ultima_execucao");
  if (error) {
    if (ehEsquemaAusente(error.code)) return { estado: "nao_ativado" };
    console.error("fiscal_ultima_execucao:", error.message);
    return { estado: "erro" };
  }
  const execucao = (data as ExecucaoFiscal[] | null)?.[0];
  return execucao ? { estado: "ok", execucao } : { estado: "sem_execucao" };
}

export async function lerFiscal(): Promise<LeituraFiscal> {
  const ultima = await ultimaExecucao();
  if (ultima.estado !== "ok") return ultima;
  const { data, error } = await clienteServidor()
    .from("fiscal_municipio")
    .select("ibge, nome, populacao, tce, estados, conclusoes, indicadores")
    .eq("execucao_id", ultima.execucao.id)
    .order("nome")
    .limit(1000);
  if (error) {
    console.error("lerFiscal:", error.message);
    return { estado: "erro" };
  }
  return { estado: "ok", execucao: ultima.execucao, municipios: (data ?? []) as MunicipioFiscal[] };
}

export async function lerFiscalMunicipio(ibge: string): Promise<LeituraMunicipioFiscal> {
  const ultima = await ultimaExecucao();
  if (ultima.estado !== "ok") return ultima;
  const db = clienteServidor();
  const id = ultima.execucao.id;
  const [municipio, verificacoes, historico, fontesUf, projecao] = await Promise.all([
    db.from("fiscal_municipio").select("ibge, nome, populacao, tce, estados, conclusoes, indicadores").eq("execucao_id", id).eq("ibge", ibge).maybeSingle(),
    db.from("fiscal_verificacao").select("codigo, nome, estado, resumo, decisoes, evidencia, base_legal, documental, versao").eq("execucao_id", id).eq("ibge", ibge).limit(100),
    db.from("fiscal_historico").select("codigo, estado, resumo, desde, visto_ate").eq("ibge", ibge).order("desde", { ascending: false }).limit(300),
    db.from("fiscal_fonte").select("chave, sistema, urls, situacoes, sha256, coletado_em, erro").eq("execucao_id", id).is("ibge", null).limit(10),
    db.from("fiscal_projecao").select("ano, servico_demais, servico_pleiteada, liberacoes").eq("execucao_id", id).eq("ibge", ibge).order("ano").limit(100),
  ]);
  const erro = municipio.error ?? verificacoes.error ?? historico.error ?? fontesUf.error ?? projecao.error;
  if (erro) {
    console.error("lerFiscalMunicipio:", erro.message);
    return { estado: "erro" };
  }
  if (!municipio.data) return { estado: "nao_encontrado", execucao: ultima.execucao };
  return {
    estado: "ok",
    execucao: ultima.execucao,
    municipio: municipio.data as MunicipioFiscal,
    verificacoes: (verificacoes.data ?? []) as VerificacaoFiscal[],
    historico: (historico.data ?? []) as HistoricoFiscal[],
    fontesUf: (fontesUf.data ?? []) as (FonteEvidencia & { chave: string })[],
    // numeric chega como número pelo PostgREST; Number() protege se vier como texto.
    projecao: ((projecao.data ?? []) as Record<keyof ProjecaoFiscal, number | string>[]).map((p) => ({
      ano: Number(p.ano),
      servico_demais: Number(p.servico_demais),
      servico_pleiteada: Number(p.servico_pleiteada),
      liberacoes: Number(p.liberacoes),
    })),
  };
}
