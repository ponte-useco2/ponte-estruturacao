/**
 * Leitura do painel de execução no Supabase — só servidor, só chave de serviço.
 *
 * As tabelas e funções da `oport_8` não aceitam `anon` nem `authenticated`. Quem
 * decide se a pessoa pode ver é a página, com `ehAdministrador`; daqui para
 * baixo, a leitura é da chave de serviço. Cada visão consulta só o que desenha.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { anoPadrao, type LinhaDesfecho, type LinhaEtapa, type LinhaResumo, type ParametrosPainel } from "./painel";

export interface ExecucaoPainel {
  id: number;
  dado_ate: string;
  referencia: string;
  concluida_em: string;
  arquivos: Record<string, string | null>;
  contagens: Record<string, unknown>;
}

export interface LinhaOrgao {
  orgao: string;
  n: number;
  valor: number;
  destaque: number;
}

/** As colunas de `painel_convenio` que as listas mostram. */
export interface ConvenioPainel {
  nr_convenio: string;
  uf: string | null;
  municipio: string | null;
  proponente: string | null;
  tipo_agente: string | null;
  orgao_sup: string | null;
  programa: string | null;
  objeto: string | null;
  situacao: string | null;
  dt_assinatura: string | null;
  repasse: number | null;
  empenhado: number | null;
  desembolsado: number | null;
  saldo_conta: number | null;
  rendimento_implicito: number | null;
  dt_ultimo_pagamento: string | null;
  dias_sem_movimento: number | null;
  n_extensoes: number | null;
  suspensiva_prazo: string | null;
  suspensiva_dias: number | null;
  exige_titularidade: boolean | null;
  exige_projeto: boolean | null;
  exige_licenca: boolean | null;
  exige_sustentabilidade: boolean | null;
  exige_termo_referencia: boolean | null;
  grupo_suspensiva: string | null;
  etapa_licitacao: string | null;
  dt_aceite: string | null;
  aceite_parado: boolean;
  dt_fim_vigencia: string | null;
  dias_para_fim: number | null;
  pct_desembolsado: number | null;
  contas_lado: string | null;
  dias_apos_limite: number | null;
  dias_com_concedente: number | null;
  nunca_pagou: boolean | null;
}

export interface MunicipioPainel {
  cod_ibge: string;
  uf: string | null;
  municipio: string | null;
  n_sinais: number;
  sinal_saldo: boolean;
  n_saldo: number;
  valor_saldo: number;
  sinal_suspensiva: boolean;
  n_suspensiva: number;
  valor_suspensiva: number;
  sinal_contas_atrasadas: boolean;
  n_contas_atrasadas: number;
  sinal_contas_negativas: boolean;
  n_contas_negativas: number;
  sinal_sem_desembolso: boolean;
  n_sem_desembolso: number;
  valor_sem_desembolso: number;
}

export type LeituraPainel =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro"; mensagem: string }
  | {
      estado: "ok";
      execucao: ExecucaoPainel;
      resumo: LinhaResumo[];
      porOrgao: LinhaOrgao[];
      convenios: ConvenioPainel[];
      /** Só na suspensiva: os já vencidos, em lista à parte (ver `lerPainel`). */
      vencidos: ConvenioPainel[];
      municipios: MunicipioPainel[];
      /** Só em tempos: linhas de órgão (sempre) e de programa (na dimensão programa). */
      etapas: LinhaEtapa[];
      /** Só em aprovação: total, órgãos e programas do ano. */
      desfechos: LinhaDesfecho[];
      /** Só em aprovação: o ano efetivamente consultado. */
      ano: number | null;
    };

/** O que as visões que não usam uma lista devolvem nela. */
const VAZIO = { porOrgao: [], convenios: [], vencidos: [], municipios: [], etapas: [], desfechos: [], ano: null };

export const LIMITE_LISTA = 50;
/** Programas na matriz de tempos: os de mais assinaturas na janela. */
export const LIMITE_PROGRAMAS = 40;
export const LIMITE_MUNICIPIOS = 100;
export const LIMITE_VENCIDOS = 20;
/** Órgãos na tabela; a lista do filtro usa o mesmo recorte com folga. */
export const LIMITE_ORGAOS = 60;

const COLUNAS_CONVENIO =
  "nr_convenio, uf, municipio, proponente, tipo_agente, orgao_sup, programa, objeto, situacao, dt_assinatura, " +
  "repasse, empenhado, desembolsado, saldo_conta, rendimento_implicito, dt_ultimo_pagamento, dias_sem_movimento, " +
  "n_extensoes, suspensiva_prazo, suspensiva_dias, exige_titularidade, exige_projeto, exige_licenca, " +
  "exige_sustentabilidade, exige_termo_referencia, grupo_suspensiva, etapa_licitacao, dt_aceite, aceite_parado, " +
  "dt_fim_vigencia, dias_para_fim, pct_desembolsado, contas_lado, dias_apos_limite, dias_com_concedente, nunca_pagou";

export async function lerPainel(p: ParametrosPainel): Promise<LeituraPainel> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();

  const ultima = await db.rpc("painel_ultima_execucao");
  if (ultima.error) {
    if (ehEsquemaAusente(ultima.error.code)) return { estado: "nao_ativado" };
    console.error("lerPainel:", ultima.error.message);
    return { estado: "erro", mensagem: ultima.error.message };
  }
  const execucao = (ultima.data as ExecucaoPainel[] | null)?.[0];
  if (!execucao) return { estado: "sem_execucao" };

  const resumo = db.rpc("painel_resumo", { p_uf: p.uf, p_orgao: p.orgao });
  const recorte = p.uf ?? "BR";

  if (p.visao === "tempos") {
    // Órgãos sempre (tabela ou lista do filtro). Programas: os de mais assinaturas na
    // janela, e depois todas as etapas só deles — a tabela inteira passa de mil linhas.
    const orgaos = db
      .from("painel_etapa_tempo")
      .select("*")
      .eq("execucao_id", execucao.id)
      .eq("recorte", recorte)
      .eq("dimensao", "orgao")
      .limit(1000);
    let topo = db
      .from("painel_etapa_tempo")
      .select("chave")
      .eq("execucao_id", execucao.id)
      .eq("recorte", recorte)
      .eq("dimensao", "programa")
      .eq("etapa", "envio_assinatura")
      .order("n", { ascending: false })
      .limit(LIMITE_PROGRAMAS);
    if (p.orgao) topo = topo.eq("orgao_sup", p.orgao);
    const [r, o, t] = await Promise.all([
      resumo,
      orgaos,
      p.dimensao === "programa" ? topo : Promise.resolve({ data: [], error: null }),
    ]);
    let erro = r.error ?? o.error ?? t.error;
    let programas: LinhaEtapa[] = [];
    const chaves = ((t.data ?? []) as { chave: string }[]).map((x) => x.chave);
    if (!erro && chaves.length > 0) {
      const pr = await db
        .from("painel_etapa_tempo")
        .select("*")
        .eq("execucao_id", execucao.id)
        .eq("recorte", recorte)
        .eq("dimensao", "programa")
        .in("chave", chaves)
        .limit(1000);
      erro = pr.error;
      programas = (pr.data ?? []) as LinhaEtapa[];
    }
    if (erro) {
      console.error("lerPainel:", erro.message);
      return { estado: "erro", mensagem: erro.message };
    }
    return {
      estado: "ok",
      execucao,
      resumo: (r.data ?? []) as LinhaResumo[],
      ...VAZIO,
      etapas: [...((o.data ?? []) as LinhaEtapa[]), ...programas],
    };
  }

  if (p.visao === "aprovacao") {
    const ano = p.ano ?? anoPadrao(execucao.referencia);
    const base = () =>
      db.from("painel_programa_desfecho").select("*").eq("execucao_id", execucao.id).eq("uf", recorte).eq("ano_envio", ano);
    let programas = base().not("cod_programa", "is", null).order("enviadas", { ascending: false }).limit(LIMITE_LISTA);
    if (p.orgao) programas = programas.eq("orgao_sup", p.orgao);
    let total = base().is("cod_programa", null);
    total = p.orgao ? total.eq("orgao_sup", p.orgao) : total.is("orgao_sup", null);
    const [r, t, o, pr] = await Promise.all([
      resumo,
      total,
      base().is("cod_programa", null).not("orgao_sup", "is", null).order("enviadas", { ascending: false }).limit(LIMITE_ORGAOS),
      programas,
    ]);
    const erro = r.error ?? t.error ?? o.error ?? pr.error;
    if (erro) {
      console.error("lerPainel:", erro.message);
      return { estado: "erro", mensagem: erro.message };
    }
    // Com órgão escolhido, a linha "total" é a do órgão: marca como total para a tela.
    const totais = ((t.data ?? []) as LinhaDesfecho[]).map((x) => ({ ...x, orgao_sup: null }));
    return {
      estado: "ok",
      execucao,
      resumo: (r.data ?? []) as LinhaResumo[],
      ...VAZIO,
      ano,
      desfechos: [...totais, ...((o.data ?? []) as LinhaDesfecho[]), ...((pr.data ?? []) as LinhaDesfecho[])],
    };
  }

  if (p.visao === "municipios") {
    let q = db
      .from("painel_municipio")
      .select("*")
      .eq("execucao_id", execucao.id)
      .order("n_sinais", { ascending: false })
      .order("valor_saldo", { ascending: false })
      .order("valor_sem_desembolso", { ascending: false })
      .limit(LIMITE_MUNICIPIOS);
    if (p.uf) q = q.eq("uf", p.uf);
    const [r, m] = await Promise.all([resumo, q]);
    const erro = r.error ?? m.error;
    if (erro) {
      console.error("lerPainel:", erro.message);
      return { estado: "erro", mensagem: erro.message };
    }
    return {
      estado: "ok",
      execucao,
      resumo: (r.data ?? []) as LinhaResumo[],
      ...VAZIO,
      municipios: (m.data ?? []) as MunicipioPainel[],
    };
  }

  // Na suspensiva, ordenar só pelo prazo poria no topo prazos vencidos em 2013,
  // e o que vence semana que vem sumiria. Duas listas: a vencer, pelo mais
  // próximo; e os já vencidos, dos mais recentes aos mais antigos.
  let vencidos: PromiseLike<{ data: unknown; error: { message: string } | null }> = Promise.resolve({
    data: [],
    error: null,
  });

  let q = db.from("painel_convenio").select(COLUNAS_CONVENIO).eq("execucao_id", execucao.id);
  if (p.uf) q = q.eq("uf", p.uf);
  if (p.orgao) q = q.eq("orgao_sup", p.orgao);

  // Cada visão tem a sua ordem de urgência, declarada na tela.
  switch (p.visao) {
    case "suspensiva": {
      let v = db.from("painel_convenio").select(COLUNAS_CONVENIO).eq("execucao_id", execucao.id);
      if (p.uf) v = v.eq("uf", p.uf);
      if (p.orgao) v = v.eq("orgao_sup", p.orgao);
      vencidos = v
        .eq("em_suspensiva", true)
        .lt("suspensiva_dias", 0)
        .order("suspensiva_prazo", { ascending: false })
        .limit(LIMITE_VENCIDOS);
      q = q.eq("em_suspensiva", true).gte("suspensiva_dias", 0).order("suspensiva_prazo", { ascending: true });
      break;
    }
    case "nunca":
      q = q
        .eq("nunca_desembolsado", true)
        .order("aceite_parado", { ascending: false })
        .order("dt_aceite", { ascending: true, nullsFirst: false })
        .order("dt_assinatura", { ascending: true });
      break;
    case "vigencia":
      q = q.not("vigencia_faixa", "is", null).order("dias_para_fim", { ascending: true });
      break;
    case "contas":
      // As atrasadas há mais tempo são convênios de 2008 que ninguém vai regularizar;
      // as recentes são onde ainda dá para agir antes da inadimplência.
      if (p.lado === "atrasada") q = q.eq("contas_atrasada", true).order("dias_apos_limite", { ascending: true });
      else if (p.lado === "negativo") q = q.eq("contas_lado", "negativo").order("repasse", { ascending: false });
      else if (p.lado === "tce") q = q.eq("tce", true).order("repasse", { ascending: false });
      else q = q.eq("contas_lado", "concedente").order("dias_com_concedente", { ascending: false });
      break;
    case "saldo":
      q = q.eq("saldo_parado", true).order("saldo_conta", { ascending: false });
      break;
  }

  const [r, o, c, v] = await Promise.all([
    resumo,
    db.rpc("painel_por_orgao", { p_visao: p.visao, p_uf: p.uf, p_limite: LIMITE_ORGAOS }),
    q.limit(LIMITE_LISTA),
    vencidos,
  ]);
  const erro = r.error ?? o.error ?? c.error ?? v.error;
  if (erro) {
    console.error("lerPainel:", erro.message);
    return { estado: "erro", mensagem: erro.message };
  }
  return {
    estado: "ok",
    execucao,
    resumo: (r.data ?? []) as LinhaResumo[],
    porOrgao: (o.data ?? []) as LinhaOrgao[],
    convenios: (c.data ?? []) as unknown as ConvenioPainel[],
    vencidos: (v.data ?? []) as unknown as ConvenioPainel[],
    municipios: [],
    etapas: [],
    desfechos: [],
    ano: null,
  };
}
