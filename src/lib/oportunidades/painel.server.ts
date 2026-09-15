/**
 * Leitura do painel de execução no Supabase — só servidor, só chave de serviço.
 *
 * As tabelas e funções da `oport_8` não aceitam `anon` nem `authenticated`. Quem
 * decide se a pessoa pode ver é a página, com `ehAdministrador`; daqui para
 * baixo, a leitura é da chave de serviço. Cada visão consulta só o que desenha.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import {
  DESFECHOS_ABERTOS,
  anoPadrao,
  datasAssinatura,
  ehVisaoConvenio,
  type LinhaDesfecho,
  type LinhaEtapa,
  type LinhaResumo,
  type ParametrosFicha,
  type ParametrosPainel,
  type PropostaPainel,
  type PropostasDoAno,
} from "./painel";

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
  cod_ibge: string | null;
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
      /** Visões de convênio com UF: os municípios do seletor. */
      opcoesMunicipio: OpcaoMunicipio[];
    };

export interface OpcaoMunicipio {
  cod_ibge: string;
  municipio: string | null;
  convenios: number;
  propostas: number;
}

/** O que as visões que não usam uma lista devolvem nela. */
const VAZIO = {
  porOrgao: [],
  convenios: [],
  vencidos: [],
  municipios: [],
  etapas: [],
  desfechos: [],
  ano: null,
  opcoesMunicipio: [],
};

export const LIMITE_LISTA = 50;
/** Programas na matriz de tempos: os de mais assinaturas na janela. */
export const LIMITE_PROGRAMAS = 40;
export const LIMITE_MUNICIPIOS = 100;
export const LIMITE_VENCIDOS = 20;
/** Órgãos na tabela; a lista do filtro usa o mesmo recorte com folga. */
export const LIMITE_ORGAOS = 60;

const COLUNAS_CONVENIO =
  "nr_convenio, uf, municipio, cod_ibge, proponente, tipo_agente, orgao_sup, programa, objeto, situacao, dt_assinatura, " +
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

  // Filtros novos só vão ao banco quando usados: sem eles, a chamada é a mesma da
  // oport_8, e a página segue funcionando se o site chegar antes da oport_9.
  const datas = datasAssinatura(p.assinadoDe, p.assinadoAte);
  const filtros = semNulos({ p_ibge: p.municipio, p_assinado_de: datas.de, p_assinado_ate: datas.ate });
  const resumo = db.rpc("painel_resumo", { p_uf: p.uf, p_orgao: p.orgao, ...filtros });
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

  const convenios = () => {
    let b = db.from("painel_convenio").select(COLUNAS_CONVENIO).eq("execucao_id", execucao.id);
    if (p.uf) b = b.eq("uf", p.uf);
    if (p.orgao) b = b.eq("orgao_sup", p.orgao);
    if (p.municipio) b = b.eq("cod_ibge", p.municipio);
    if (datas.de) b = b.gte("dt_assinatura", datas.de);
    if (datas.ate) b = b.lte("dt_assinatura", datas.ate);
    return b;
  };
  let q = convenios();

  // Cada visão tem a sua ordem de urgência, declarada na tela.
  switch (p.visao) {
    case "suspensiva": {
      vencidos = convenios()
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

  const [r, o, c, v, m] = await Promise.all([
    resumo,
    db.rpc("painel_por_orgao", { p_visao: p.visao, p_uf: p.uf, p_limite: LIMITE_ORGAOS, ...filtros }),
    q.limit(LIMITE_LISTA),
    vencidos,
    p.uf && ehVisaoConvenio(p.visao)
      ? db.rpc("painel_municipios", { p_uf: p.uf })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const erro = r.error ?? o.error ?? c.error ?? v.error;
  if (erro) {
    console.error("lerPainel:", erro.message);
    return { estado: "erro", mensagem: erro.message };
  }
  // O seletor de município é conveniência: sem ele, o resto do painel continua de pé.
  if (m.error) console.error("lerPainel (municípios):", m.error.message);
  return {
    estado: "ok",
    execucao,
    resumo: (r.data ?? []) as LinhaResumo[],
    ...VAZIO,
    porOrgao: (o.data ?? []) as LinhaOrgao[],
    convenios: (c.data ?? []) as unknown as ConvenioPainel[],
    vencidos: (v.data ?? []) as unknown as ConvenioPainel[],
    opcoesMunicipio: m.error ? [] : ((m.data ?? []) as OpcaoMunicipio[]),
  };
}

function semNulos<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

// ============================================================================ ficha do município

export const LIMITE_FICHA_CONVENIOS = 50;
export const LIMITE_FICHA_PROPOSTAS = 50;
export const LIMITE_FICHA_RECENTES = 30;

const COLUNAS_PROPOSTA =
  "id_proposta, nr_proposta, proponente, tipo_agente, orgao_sup, cod_programa, programa, objeto, valor_repasse, " +
  "com_emenda, dt_envio, ano_envio, desfecho, em_lote, limbo, situacao, dt_ultimo_evento, dias_sem_evento, " +
  "dt_assinatura, nr_convenio";

export interface FichaMunicipio {
  execucao: ExecucaoPainel;
  nome: string | null;
  sinais: MunicipioPainel | null;
  resumo: LinhaResumo[];
  suspensiva: ConvenioPainel[];
  nunca: ConvenioPainel[];
  vigencia: ConvenioPainel[];
  contas: ConvenioPainel[];
  saldo: ConvenioPainel[];
  porAno: PropostasDoAno[];
  semDesfecho: PropostaPainel[];
  negadas: PropostaPainel[];
  assinadas: PropostaPainel[];
}

export type LeituraFicha =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro"; mensagem: string }
  | ({ estado: "ok" } & FichaMunicipio);

/**
 * Tudo o que trava num município. Os convênios respeitam o período de assinatura; as
 * propostas não (a ficha mostra as recentes, pelo envio). "Prefeitura" filtra pelo tipo
 * de proponente municipal, nos dois.
 */
export async function lerFichaMunicipio(f: ParametrosFicha): Promise<LeituraFicha> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();

  const ultima = await db.rpc("painel_ultima_execucao");
  if (ultima.error) {
    if (ehEsquemaAusente(ultima.error.code)) return { estado: "nao_ativado" };
    console.error("lerFichaMunicipio:", ultima.error.message);
    return { estado: "erro", mensagem: ultima.error.message };
  }
  const execucao = (ultima.data as ExecucaoPainel[] | null)?.[0];
  if (!execucao) return { estado: "sem_execucao" };

  const agente = f.quem === "prefeitura" ? "municipio" : null;
  const datas = datasAssinatura(f.assinadoDe, f.assinadoAte);
  const convenios = () => {
    let b = db
      .from("painel_convenio")
      .select(COLUNAS_CONVENIO)
      .eq("execucao_id", execucao.id)
      .eq("cod_ibge", f.ibge);
    if (agente) b = b.eq("tipo_agente", agente);
    if (datas.de) b = b.gte("dt_assinatura", datas.de);
    if (datas.ate) b = b.lte("dt_assinatura", datas.ate);
    return b;
  };
  const propostas = () => {
    let b = db.from("painel_proposta").select(COLUNAS_PROPOSTA).eq("execucao_id", execucao.id).eq("cod_ibge", f.ibge);
    if (agente) b = b.eq("tipo_agente", agente);
    return b;
  };

  const leituras = await Promise.all([
    db.from("painel_municipio").select("*").eq("execucao_id", execucao.id).eq("cod_ibge", f.ibge).limit(1),
    db.rpc("painel_resumo", semNulos({ p_ibge: f.ibge, p_agente: agente, p_assinado_de: datas.de, p_assinado_ate: datas.ate })),
    convenios().eq("em_suspensiva", true).order("suspensiva_prazo", { ascending: true }).limit(LIMITE_FICHA_CONVENIOS),
    convenios()
      .eq("nunca_desembolsado", true)
      .order("aceite_parado", { ascending: false })
      .order("dt_aceite", { ascending: true, nullsFirst: false })
      .order("dt_assinatura", { ascending: true })
      .limit(LIMITE_FICHA_CONVENIOS),
    convenios().not("vigencia_faixa", "is", null).order("dias_para_fim", { ascending: true }).limit(LIMITE_FICHA_CONVENIOS),
    convenios().or("contas_lado.not.is.null,tce.eq.true").order("repasse", { ascending: false }).limit(LIMITE_FICHA_CONVENIOS),
    convenios().eq("saldo_parado", true).order("saldo_conta", { ascending: false }).limit(LIMITE_FICHA_CONVENIOS),
    db.rpc("painel_propostas_por_ano", { p_ibge: f.ibge, p_agente: agente }),
    propostas()
      .in("desfecho", DESFECHOS_ABERTOS)
      .order("dias_sem_evento", { ascending: false })
      .limit(LIMITE_FICHA_PROPOSTAS),
    propostas()
      .in("desfecho", ["reprovada", "impedimento", "eliminada"])
      .order("dt_ultimo_evento", { ascending: false })
      .limit(LIMITE_FICHA_RECENTES),
    propostas()
      .eq("desfecho", "assinada")
      .order("dt_assinatura", { ascending: false, nullsFirst: false })
      .limit(LIMITE_FICHA_RECENTES),
    // O nome vem de qualquer linha do município, de qualquer proponente.
    db.from("painel_proposta").select("municipio").eq("execucao_id", execucao.id).eq("cod_ibge", f.ibge).not("municipio", "is", null).limit(1),
    db.from("painel_convenio").select("municipio").eq("execucao_id", execucao.id).eq("cod_ibge", f.ibge).not("municipio", "is", null).limit(1),
  ]);
  const erro = leituras.find((l) => l.error)?.error;
  if (erro) {
    console.error("lerFichaMunicipio:", erro.message);
    return { estado: "erro", mensagem: erro.message };
  }
  const [sinais, resumo, suspensiva, nunca, vigencia, contas, saldo, porAno, semDesfecho, negadas, assinadas, nomeP, nomeC] =
    leituras.map((l) => (l.data ?? []) as unknown[]);
  const municipio = (sinais as MunicipioPainel[])[0] ?? null;
  const nome =
    municipio?.municipio ??
    (nomeC as { municipio: string }[])[0]?.municipio ??
    (nomeP as { municipio: string }[])[0]?.municipio ??
    null;

  return {
    estado: "ok",
    execucao,
    nome,
    sinais: municipio,
    resumo: resumo as LinhaResumo[],
    suspensiva: suspensiva as ConvenioPainel[],
    nunca: nunca as ConvenioPainel[],
    vigencia: vigencia as ConvenioPainel[],
    contas: contas as ConvenioPainel[],
    saldo: saldo as ConvenioPainel[],
    porAno: porAno as PropostasDoAno[],
    semDesfecho: semDesfecho as PropostaPainel[],
    negadas: negadas as PropostaPainel[],
    assinadas: assinadas as PropostaPainel[],
  };
}
