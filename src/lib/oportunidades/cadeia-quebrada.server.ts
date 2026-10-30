/**
 * Leitura da cadeia quebrada do gasto (PUB-11, 29/10/2026) — só servidor, chave de serviço. A última execução
 * concluída de `cq_execucao` e as linhas dela (oport_56); os conjuntos por órgão ficam fora da consulta.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { VALIDADE_DADOS_MS } from "./cache-dados";
import { BLOCOS, montarCadeia, situacaoDosCasos, type BlocoId, type CadeiaQuebrada, type CasoCq, type ExecucaoCq, type LinhaCq } from "./cadeia-quebrada";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";

export type LeituraCadeia =
  | { estado: "nao_ativado" | "sem_execucao" | "erro" }
  | { estado: "ok"; execucao: ExecucaoCq; cadeia: CadeiaQuebrada };

const COLUNAS_EXECUCAO =
  "id,concluida_em,dado_ate,sha256_pacote,versao_pacote,gerado_em,regra_versao,regra_fecha,limiar_precisao,contagens,cobertura,regra_alcance";

async function lerDoBanco(): Promise<LeituraCadeia> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ultima = await db.rpc("cq_ultima_execucao").select(COLUNAS_EXECUCAO);
  if (ultima.error) {
    if (ehEsquemaAusente(ultima.error.code)) return { estado: "nao_ativado" };
    console.error("cadeia quebrada:", ultima.error.message);
    return { estado: "erro" };
  }
  const ex = (ultima.data as ExecucaoCq[] | null)?.[0];
  if (!ex) return { estado: "sem_execucao" };
  const r = await db
    .from("cq_resultado")
    .select("conjunto,ordem,orgao,situacao,confianca,soma_como_fecha,pares,pago")
    .eq("execucao_id", ex.id)
    .in("conjunto", ["notas", "emendas", "sancoes_classe"])
    .order("conjunto")
    .order("ordem")
    .limit(500);
  if (r.error) {
    console.error("cadeia quebrada (resultado):", r.error.message);
    return { estado: "erro" };
  }
  return { estado: "ok", execucao: ex, cadeia: montarCadeia(ex, (r.data ?? []) as LinhaCq[]) };
}

const memoria = criarMemoria<LeituraCadeia>({ validadeMs: VALIDADE_DADOS_MS, maximo: 2, guardar: (l) => l.estado === "ok" });

/** A última geração carregada, da memória quando há (10 minutos). Não altere o objeto devolvido. */
export function lerCadeiaQuebrada(): Promise<LeituraCadeia> {
  return memoria.obter("cq", lerDoBanco);
}

const COLUNAS_CASO = "ordem,teste,situacao,cnpj,orgao,pago,notas,anos,link_diario,tipo_ato,data_ato,motivo,sancao";

export type LeituraSituacao =
  | { estado: "nao_ativado" | "sem_execucao" | "erro" | "nao_encontrado" }
  | { estado: "ok"; execucao: ExecucaoCq; linha: CadeiaQuebrada["notas"]["linhas"][number]; porOrgao: LinhaCq[]; motivos: LinhaCq[]; casos: CasoCq[] };

/**
 * Uma situação de um bloco (30/10/2026): a linha da tabela, o recorte por órgão (notas) ou por motivo (sanções), e os
 * casos por CNPJ da situação — de um órgão só, com `orgao`. Situação que não está na geração: "não encontrado".
 */
export async function lerSituacaoCadeia(bloco: BlocoId, situacao: string, orgao: string | null): Promise<LeituraSituacao> {
  const base = await lerCadeiaQuebrada();
  if (base.estado !== "ok") return base;
  const linha = base.cadeia[bloco].linhas.find((l) => l.situacao === situacao);
  if (!linha) return { estado: "nao_encontrado" };
  const db = clienteServidor();
  const def = BLOCOS[bloco];
  const id = base.execucao.id;
  let qCasos = db
    .from("cq_caso")
    .select(COLUNAS_CASO)
    .eq("execucao_id", id)
    .eq("teste", def.teste)
    .eq("situacao", situacaoDosCasos(bloco, situacao))
    .order("pago", { ascending: false, nullsFirst: false })
    .order("ordem")
    .limit(2000);
  if (orgao) qCasos = qCasos.eq("orgao", orgao);
  const [casos, porOrgao, motivos] = await Promise.all([
    qCasos,
    def.porOrgao
      ? db.from("cq_resultado").select("conjunto,ordem,orgao,situacao,confianca,soma_como_fecha,pares,pago").eq("execucao_id", id).eq("conjunto", def.porOrgao).eq("situacao", situacao).limit(500)
      : Promise.resolve({ data: [], error: null }),
    bloco === "sancoes"
      ? db.from("cq_resultado").select("conjunto,ordem,orgao,situacao,confianca,soma_como_fecha,pares,pago").eq("execucao_id", id).eq("conjunto", "sancoes_motivo").limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const erro = casos.error ?? porOrgao.error ?? motivos.error;
  if (erro) {
    // Sem a oport_57 (casos) a situação ainda abre, com o recorte e sem a lista.
    if (casos.error && ehEsquemaAusente(casos.error.code) && !porOrgao.error && !motivos.error) {
      return { estado: "ok", execucao: base.execucao, linha, porOrgao: (porOrgao.data ?? []) as LinhaCq[], motivos: (motivos.data ?? []) as LinhaCq[], casos: [] };
    }
    console.error("cadeia quebrada (situação):", erro.message);
    return { estado: "erro" };
  }
  return {
    estado: "ok",
    execucao: base.execucao,
    linha,
    porOrgao: ((porOrgao.data ?? []) as LinhaCq[]).sort((a, b) => Number(b.pago ?? 0) - Number(a.pago ?? 0)),
    motivos: (motivos.data ?? []) as LinhaCq[],
    casos: (casos.data ?? []) as CasoCq[],
  };
}

export type LeituraCnpjCadeia =
  | { estado: "nao_ativado" | "sem_execucao" | "erro" | "nao_encontrado" }
  | { estado: "ok"; execucao: ExecucaoCq; casos: CasoCq[]; noPainelFederal: boolean };

/** Os casos de um CNPJ na última geração e se ele tem dossiê no painel de fornecedores (convênios federais da PB). */
export async function lerCnpjCadeia(cnpj: string): Promise<LeituraCnpjCadeia> {
  const base = await lerCadeiaQuebrada();
  if (base.estado !== "ok") return base;
  const db = clienteServidor();
  const ultimaPainel = await db.rpc("painel_ultima_execucao");
  const painelId = (ultimaPainel.data as { id: number }[] | null)?.[0]?.id ?? null;
  const [casos, forn] = await Promise.all([
    db.from("cq_caso").select(COLUNAS_CASO).eq("execucao_id", base.execucao.id).eq("cnpj", cnpj).order("pago", { ascending: false, nullsFirst: false }).limit(200),
    painelId === null
      ? Promise.resolve({ data: [], error: null })
      : db.from("painel_fornecedor").select("cnpj").eq("execucao_id", painelId).eq("cnpj", cnpj).limit(1),
  ]);
  if (casos.error) {
    if (!ehEsquemaAusente(casos.error.code)) console.error("cadeia quebrada (CNPJ):", casos.error.message);
    return { estado: ehEsquemaAusente(casos.error.code) ? "nao_ativado" : "erro" };
  }
  const lista = (casos.data ?? []) as CasoCq[];
  if (lista.length === 0) return { estado: "nao_encontrado" };
  return { estado: "ok", execucao: base.execucao, casos: lista, noPainelFederal: !forn.error && (forn.data ?? []).length > 0 };
}
