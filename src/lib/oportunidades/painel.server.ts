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
  ANOS_MOTIVOS,
  DESFECHOS_ABERTOS,
  anoPadrao,
  datasAssinatura,
  ehVisaoConvenio,
  type ContagemMudanca,
  type LadoContas,
  type LinhaAditivoMotivo,
  type LinhaDesfecho,
  type LinhaEtapa,
  type LinhaResumo,
  type Movimento,
  type MudancaPainel,
  type ParametrosFicha,
  type ParametrosPainel,
  type PropostaPainel,
  type PropostasDoAno,
  type Visao,
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
  dt_ultima_movimentacao: string | null;
  dias_sem_movimentacao: number | null;
  ultima_movimentacao_tipo: string | null;
  n_aditivos_vigencia: number | null;
  motivo_aditivo: string | null;
  pct_fisico: number | null;
  financeiro_sem_fisico: boolean;
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
      /** Só na vigência: aditivos de vigência do recorte por motivo, nos últimos anos. */
      aditivosMotivo: LinhaAditivoMotivo[];
      /** Só em mudanças: a lista (filtrada pelo tipo) e as contagens por tipo do período. */
      mudancas: MudancaPainel[];
      contagensMudanca: ContagemMudanca[];
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
  aditivosMotivo: [],
  mudancas: [],
  contagensMudanca: [],
};

export const LIMITE_LISTA = 50;
/** Mudanças numa página: a lista é de leitura diária, não de exportação. */
export const LIMITE_MUDANCAS = 100;
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
  "dt_fim_vigencia, dias_para_fim, pct_desembolsado, contas_lado, dias_apos_limite, dias_com_concedente, nunca_pagou, " +
  "dt_ultima_movimentacao, dias_sem_movimentacao, ultima_movimentacao_tipo, n_aditivos_vigencia, motivo_aditivo, " +
  "pct_fisico, financeiro_sem_fisico";

type Banco = ReturnType<typeof clienteServidor>;

export interface FiltrosConvenio {
  uf?: string | null;
  orgao?: string | null;
  ibge?: string | null;
  agente?: string | null;
  assinadoDe?: number | null;
  assinadoAte?: number | null;
  movimento?: Movimento | null;
}

/** Os filtros comuns a painel, ficha e exportação, sobre `painel_convenio`. */
function consultaConvenios(db: Banco, execucaoId: number, f: FiltrosConvenio) {
  const datas = datasAssinatura(f.assinadoDe ?? null, f.assinadoAte ?? null);
  let b = db.from("painel_convenio").select(COLUNAS_CONVENIO).eq("execucao_id", execucaoId);
  if (f.uf) b = b.eq("uf", f.uf);
  if (f.orgao) b = b.eq("orgao_sup", f.orgao);
  if (f.ibge) b = b.eq("cod_ibge", f.ibge);
  if (f.agente) b = b.eq("tipo_agente", f.agente);
  if (datas.de) b = b.gte("dt_assinatura", datas.de);
  if (datas.ate) b = b.lte("dt_assinatura", datas.ate);
  if (f.movimento === "parado_1ano") b = b.gt("dias_sem_movimentacao", 365);
  if (f.movimento === "recente_30d") b = b.lte("dias_sem_movimentacao", 30);
  return b;
}
type ConsultaConvenios = ReturnType<typeof consultaConvenios>;

/**
 * O universo e a ordem de urgência de cada visão de convênio — a mesma na tela e no CSV.
 * Na suspensiva, `vencidos` separa os prazos já passados (ver `lerPainel`).
 */
function naVisao(q: ConsultaConvenios, visao: Visao, lado: LadoContas, vencidos = false): ConsultaConvenios {
  switch (visao) {
    case "suspensiva":
      return vencidos
        ? q.eq("em_suspensiva", true).lt("suspensiva_dias", 0).order("suspensiva_prazo", { ascending: false })
        : q.eq("em_suspensiva", true).gte("suspensiva_dias", 0).order("suspensiva_prazo", { ascending: true });
    case "nunca":
      return q
        .eq("nunca_desembolsado", true)
        .order("aceite_parado", { ascending: false })
        .order("dt_aceite", { ascending: true, nullsFirst: false })
        .order("dt_assinatura", { ascending: true });
    case "vigencia":
      return q.not("vigencia_faixa", "is", null).order("dias_para_fim", { ascending: true });
    case "contas":
      // As atrasadas há mais tempo são convênios de 2008 que ninguém vai regularizar;
      // as recentes são onde ainda dá para agir antes da inadimplência.
      if (lado === "atrasada") return q.eq("contas_atrasada", true).order("dias_apos_limite", { ascending: true });
      if (lado === "negativo") return q.eq("contas_lado", "negativo").order("repasse", { ascending: false });
      if (lado === "tce") return q.eq("tce", true).order("repasse", { ascending: false });
      return q.eq("contas_lado", "concedente").order("dias_com_concedente", { ascending: false });
    case "saldo":
      return q.eq("saldo_parado", true).order("saldo_conta", { ascending: false });
    case "fisico":
      return q.eq("financeiro_sem_fisico", true).order("desembolsado", { ascending: false });
    default:
      return q;
  }
}

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
  const filtros = semNulos({
    p_ibge: p.municipio,
    p_assinado_de: datas.de,
    p_assinado_ate: datas.ate,
    p_movimento: p.movimento,
  });
  const resumo = db.rpc("painel_resumo", { p_uf: p.uf, p_orgao: p.orgao, ...filtros });
  const recorte = p.uf ?? "BR";

  if (p.visao === "tempos" && p.ano !== null) {
    // Por ano de término: órgãos do recorte e, na dimensão programa, os programas do
    // Brasil (por UF e ano a amostra de um programa é pequena demais e o job não grava).
    const ano = p.ano;
    const base = () => db.from("painel_etapa_ano").select("*").eq("execucao_id", execucao.id).eq("ano_fim", ano);
    let programas = base().eq("recorte", "BR").eq("dimensao", "programa").limit(1000);
    if (p.orgao) programas = programas.eq("orgao_sup", p.orgao);
    const [r, o, pr] = await Promise.all([
      resumo,
      base().eq("recorte", recorte).eq("dimensao", "orgao").limit(1000),
      p.dimensao === "programa" && !p.uf ? programas : Promise.resolve({ data: [], error: null }),
    ]);
    const erro = r.error ?? o.error ?? pr.error;
    if (erro) {
      console.error("lerPainel:", erro.message);
      return { estado: "erro", mensagem: erro.message };
    }
    // Mesmo formato da janela: sem estoque "ainda nesta etapa", que só existe hoje.
    const comoEtapa = (l: Omit<LinhaEtapa, "em_aberto" | "idade_mediana_aberto">): LinhaEtapa => ({
      ...l,
      em_aberto: 0,
      idade_mediana_aberto: null,
    });
    const linhasPrograma = ((pr.data ?? []) as LinhaEtapa[])
      .map(comoEtapa)
      // Os 40 programas com mais assinaturas no ano, como na janela.
      .filter((l, _, todas) => {
        const topo = todas
          .filter((x) => x.etapa === "envio_assinatura")
          .sort((a, b) => b.n - a.n)
          .slice(0, LIMITE_PROGRAMAS)
          .map((x) => x.chave);
        return topo.includes(l.chave);
      });
    return {
      estado: "ok",
      execucao,
      resumo: (r.data ?? []) as LinhaResumo[],
      ...VAZIO,
      ano,
      etapas: [...((o.data ?? []) as LinhaEtapa[]).map(comoEtapa), ...linhasPrograma],
    };
  }

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

  if (p.visao === "mudancas") {
    const filtrosMudanca = semNulos({ p_dias: p.dias, p_uf: p.uf, p_ibge: p.municipio });
    const [r, c, l, m] = await Promise.all([
      resumo,
      db.rpc("painel_mudancas_resumo", filtrosMudanca),
      db.rpc("painel_mudancas", { ...filtrosMudanca, ...semNulos({ p_tipo: p.tipo }), p_limite: LIMITE_MUDANCAS }),
      p.uf ? db.rpc("painel_municipios", { p_uf: p.uf }) : Promise.resolve({ data: [], error: null }),
    ]);
    // Sem a oport_11 as funções não existem: o resto do painel segue, e a visão avisa.
    const semTabela = (e: { code?: string } | null) => e !== null && ehEsquemaAusente(e.code);
    const erro = r.error ?? (semTabela(c.error) ? null : c.error) ?? (semTabela(l.error) ? null : l.error);
    if (erro) {
      console.error("lerPainel:", erro.message);
      return { estado: "erro", mensagem: erro.message };
    }
    if (m.error) console.error("lerPainel (municípios):", m.error.message);
    return {
      estado: "ok",
      execucao,
      resumo: (r.data ?? []) as LinhaResumo[],
      ...VAZIO,
      opcoesMunicipio: m.error ? [] : ((m.data ?? []) as OpcaoMunicipio[]),
      contagensMudanca: c.error ? [] : ((c.data ?? []) as ContagemMudanca[]),
      mudancas: l.error ? [] : ((l.data ?? []) as MudancaPainel[]),
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
  const filtrosConvenio: FiltrosConvenio = {
    uf: p.uf,
    orgao: p.orgao,
    ibge: p.municipio,
    assinadoDe: p.assinadoDe,
    assinadoAte: p.assinadoAte,
    movimento: p.movimento,
  };
  const lista = naVisao(consultaConvenios(db, execucao.id, filtrosConvenio), p.visao, p.lado).limit(LIMITE_LISTA);
  const vencidos =
    p.visao === "suspensiva"
      ? naVisao(consultaConvenios(db, execucao.id, filtrosConvenio), "suspensiva", p.lado, true).limit(LIMITE_VENCIDOS)
      : Promise.resolve({ data: [], error: null });
  // "Por que se prorroga": aditivos de vigência do recorte nos últimos anos.
  const anoDado = Number(execucao.referencia.slice(0, 4));
  const motivos =
    p.visao === "vigencia"
      ? db
          .from("painel_aditivo_motivo")
          .select("recorte, ano, motivo, aditivos, convenios")
          .eq("execucao_id", execucao.id)
          .eq("recorte", recorte)
          .gte("ano", anoDado - (ANOS_MOTIVOS - 1))
          .limit(1000)
      : Promise.resolve({ data: [], error: null });

  const [r, o, c, v, m, a] = await Promise.all([
    resumo,
    db.rpc("painel_por_orgao", { p_visao: p.visao, p_uf: p.uf, p_limite: LIMITE_ORGAOS, ...filtros }),
    lista,
    vencidos,
    p.uf && ehVisaoConvenio(p.visao)
      ? db.rpc("painel_municipios", { p_uf: p.uf })
      : Promise.resolve({ data: [], error: null }),
    motivos,
  ]);
  const erro = r.error ?? o.error ?? c.error ?? v.error ?? a.error;
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
    aditivosMotivo: (a.data ?? []) as LinhaAditivoMotivo[],
  };
}

/** Teto da exportação: acima disso o CSV para de crescer e o nome do arquivo avisa. */
export const LIMITE_EXPORTACAO = 50_000;
const PAGINA_EXPORTACAO = 1000;

export type LeituraExportacao<T> =
  | { estado: "nao_ativado" | "sem_execucao" }
  | { estado: "erro"; mensagem: string }
  | { estado: "ok"; execucao: ExecucaoPainel; linhas: T[]; truncado: boolean };

async function exportarPaginado<T>(
  montar: (db: Banco, execucaoId: number) => { range: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> },
): Promise<LeituraExportacao<T>> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ultima = await db.rpc("painel_ultima_execucao");
  if (ultima.error) {
    if (ehEsquemaAusente(ultima.error.code)) return { estado: "nao_ativado" };
    return { estado: "erro", mensagem: ultima.error.message };
  }
  const execucao = (ultima.data as ExecucaoPainel[] | null)?.[0];
  if (!execucao) return { estado: "sem_execucao" };

  // O PostgREST corta cada resposta em 1.000 linhas: lê em páginas, com ordem total.
  const linhas: T[] = [];
  for (let inicio = 0; inicio < LIMITE_EXPORTACAO; inicio += PAGINA_EXPORTACAO) {
    const pagina = await montar(db, execucao.id).range(inicio, inicio + PAGINA_EXPORTACAO - 1);
    if (pagina.error) {
      console.error("exportar:", pagina.error.message);
      return { estado: "erro", mensagem: pagina.error.message };
    }
    const dados = (pagina.data ?? []) as T[];
    linhas.push(...dados);
    if (dados.length < PAGINA_EXPORTACAO) return { estado: "ok", execucao, linhas, truncado: false };
  }
  return { estado: "ok", execucao, linhas, truncado: true };
}

/**
 * Todos os convênios de uma visão com os filtros da tela. `null` como visão = todos os
 * convênios do painel que passam nos filtros (a exportação da ficha do município).
 */
export function lerConveniosParaExportar(visao: Visao | null, lado: LadoContas, filtros: FiltrosConvenio) {
  return exportarPaginado<ConvenioPainel>((db, execucaoId) => {
    const base = consultaConvenios(db, execucaoId, filtros);
    // Na suspensiva o CSV leva os vencidos junto, pelo prazo; a tela os separa em duas listas.
    const consulta =
      visao === null
        ? base
        : visao === "suspensiva"
          ? base.eq("em_suspensiva", true).order("suspensiva_prazo", { ascending: true })
          : naVisao(base, visao, lado);
    // Desempate pelo número: sem ordem total, a paginação por faixa repete ou pula linhas.
    return consulta.order("nr_convenio", { ascending: true });
  });
}

/** As propostas recentes de um município, para o CSV da ficha. */
export function lerPropostasParaExportar(ibge: string, agente: string | null) {
  return exportarPaginado<PropostaPainel & { municipio: string | null; uf: string | null }>((db, execucaoId) => {
    let q = db
      .from("painel_proposta")
      .select(`uf, municipio, ${COLUNAS_PROPOSTA}`)
      .eq("execucao_id", execucaoId)
      .eq("cod_ibge", ibge);
    if (agente) q = q.eq("tipo_agente", agente);
    return q.order("dt_envio", { ascending: false }).order("id_proposta", { ascending: true });
  });
}

function semNulos<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

// ============================================================================ ficha do município

export const LIMITE_FICHA_CONVENIOS = 50;
export const LIMITE_FICHA_PROPOSTAS = 50;
export const LIMITE_FICHA_RECENTES = 30;
export const LIMITE_FICHA_MUDANCAS = 30;
/** A ficha mostra a última semana de mudanças do município. */
export const DIAS_FICHA_MUDANCAS = 7;

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
  fisico: ConvenioPainel[];
  porAno: PropostasDoAno[];
  semDesfecho: PropostaPainel[];
  negadas: PropostaPainel[];
  assinadas: PropostaPainel[];
  mudancas: MudancaPainel[];
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
  const filtros: FiltrosConvenio = {
    ibge: f.ibge,
    agente,
    assinadoDe: f.assinadoDe,
    assinadoAte: f.assinadoAte,
    movimento: f.movimento,
  };
  const convenios = () => consultaConvenios(db, execucao.id, filtros);
  const propostas = () => {
    let b = db.from("painel_proposta").select(COLUNAS_PROPOSTA).eq("execucao_id", execucao.id).eq("cod_ibge", f.ibge);
    if (agente) b = b.eq("tipo_agente", agente);
    return b;
  };

  // Fora do Promise.all das outras: sem a oport_11 a função não existe, e a ficha segue sem o bloco.
  const mudancas = db.rpc(
    "painel_mudancas",
    semNulos({ p_dias: DIAS_FICHA_MUDANCAS, p_ibge: f.ibge, p_agente: agente, p_limite: LIMITE_FICHA_MUDANCAS }),
  );
  const leituras = await Promise.all([
    db.from("painel_municipio").select("*").eq("execucao_id", execucao.id).eq("cod_ibge", f.ibge).limit(1),
    db.rpc(
      "painel_resumo",
      semNulos({
        p_ibge: f.ibge,
        p_agente: agente,
        p_assinado_de: datas.de,
        p_assinado_ate: datas.ate,
        p_movimento: f.movimento,
      }),
    ),
    convenios().eq("em_suspensiva", true).order("suspensiva_prazo", { ascending: true }).limit(LIMITE_FICHA_CONVENIOS),
    naVisao(convenios(), "nunca", "atrasada").limit(LIMITE_FICHA_CONVENIOS),
    naVisao(convenios(), "vigencia", "atrasada").limit(LIMITE_FICHA_CONVENIOS),
    convenios().or("contas_lado.not.is.null,tce.eq.true").order("repasse", { ascending: false }).limit(LIMITE_FICHA_CONVENIOS),
    naVisao(convenios(), "saldo", "atrasada").limit(LIMITE_FICHA_CONVENIOS),
    naVisao(convenios(), "fisico", "atrasada").limit(LIMITE_FICHA_CONVENIOS),
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
  const m = await mudancas;
  if (m.error) console.error("lerFichaMunicipio (mudanças):", m.error.message);
  const [sinais, resumo, suspensiva, nunca, vigencia, contas, saldo, fisico, porAno, semDesfecho, negadas, assinadas, nomeP, nomeC] =
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
    fisico: fisico as ConvenioPainel[],
    porAno: porAno as PropostasDoAno[],
    semDesfecho: semDesfecho as PropostaPainel[],
    negadas: negadas as PropostaPainel[],
    assinadas: assinadas as PropostaPainel[],
    mudancas: m.error ? [] : ((m.data ?? []) as MudancaPainel[]),
  };
}
