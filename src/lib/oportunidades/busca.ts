/**
 * Busca, instrumento, proposta e investimentos do município — a parte pura das telas da onda 6.
 *
 * Para qualquer usuário APROVADO (decisão do titular em 15/09/2026). Os dados vêm das tabelas e
 * funções da `oport_14`, gravadas pelo job `painel_execucao/` na mesma execução diária do painel.
 * Nada aqui mostra os sinais de "problema" do painel dos administradores: a tela descreve o
 * instrumento, não o julga.
 */
import { UFS } from "./organizacao.ts";
import { ufDoIbge } from "./painel.ts";
import { ehTemaConhecido } from "./temas.ts";

export type AbaBusca = "instrumentos" | "propostas";

/** Grupos de situação do convênio, em linguagem de gente. As situações são as do arquivo do SICONV. */
export const GRUPOS_SITUACAO: { id: string; rotulo: string; situacoes: string[] }[] = [
  { id: "execucao", rotulo: "Em execução", situacoes: ["Em execução"] },
  {
    id: "contas",
    rotulo: "Prestando contas",
    situacoes: [
      "Aguardando Prestação de Contas",
      "Prestação de Contas Iniciada Por Antecipação",
      "Prestação de Contas enviada para Análise",
      "Prestação de Contas em Análise",
      "Prestação de Contas em Complementação",
      "Prestação de Contas Comprovada em Análise",
      "Prestação de Contas Rejeitada",
      "Inadimplente",
    ],
  },
  {
    id: "concluido",
    rotulo: "Concluído",
    situacoes: ["Prestação de Contas Aprovada", "Prestação de Contas Aprovada com Ressalvas", "Prestação de Contas Concluída"],
  },
  {
    id: "assinatura",
    rotulo: "Aprovado, antes da assinatura",
    situacoes: [
      "Proposta/Plano de Trabalho Aprovado",
      "Proposta/Plano de Trabalho Complementado em Análise",
      "Proposta/Plano de Trabalho Complementado Enviado para Análise",
      "Assinatura Pendente Registro TV Siafi",
    ],
  },
  { id: "encerrado", rotulo: "Anulado ou cancelado", situacoes: ["Convênio Anulado", "Convênio Rescindido", "Cancelado"] },
];

export const GRUPOS_DESFECHO: { id: string; rotulo: string; desfechos: string[] }[] = [
  { id: "andamento", rotulo: "Em andamento", desfechos: ["aberta_concedente", "aberta_proponente", "aguardando_assinatura"] },
  { id: "assinada", rotulo: "Assinada", desfechos: ["assinada"] },
  { id: "negada", rotulo: "Reprovada ou impedida", desfechos: ["reprovada", "impedimento", "eliminada"] },
  { id: "cancelada", rotulo: "Cancelada ou anulada", desfechos: ["cancelada", "anulada"] },
];

export const LIMITE_POR_PAGINA = 30;
/** A função do banco não passa do offset 10.000: com isso a paginação para em 334 páginas. */
export const PAGINA_MAXIMA = Math.floor(10_000 / LIMITE_POR_PAGINA) + 1;
const MAXIMO_TERMOS = 6;

export interface ParametrosBusca {
  aba: AbaBusca;
  /** O que a pessoa digitou, já aparado (a normalização para o banco é `termosDaBusca`). */
  q: string;
  uf: string | null;
  municipio: string | null;
  tema: string | null;
  /** Um id de GRUPOS_SITUACAO (instrumentos) ou de GRUPOS_DESFECHO (propostas). */
  grupo: string | null;
  pagina: number;
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parametrosBusca(sp: Record<string, string | string[] | undefined>): ParametrosBusca {
  const aba: AbaBusca = um(sp.aba) === "propostas" ? "propostas" : "instrumentos";
  const ufUrl = um(sp.uf)?.toUpperCase() ?? null;
  const uf = ufUrl && (UFS as readonly string[]).includes(ufUrl) ? ufUrl : null;
  const ibge = um(sp.municipio)?.trim() ?? null;
  const ufMunicipio = ufDoIbge(ibge);
  // Município só vale na UF dele; sem UF na URL, a UF passa a ser a do município.
  const municipio = ufMunicipio && (uf === null || uf === ufMunicipio) ? ibge : null;
  const tema = um(sp.tema) ?? "";
  const grupo = um(sp.grupo) ?? "";
  const grupos = aba === "instrumentos" ? GRUPOS_SITUACAO : GRUPOS_DESFECHO;
  const pagina = Number(um(sp.pagina));
  return {
    aba,
    q: (um(sp.q) ?? "").trim().slice(0, 200),
    uf: municipio ? ufMunicipio : uf,
    municipio,
    tema: ehTemaConhecido(tema) ? tema : null,
    grupo: grupos.some((g) => g.id === grupo) ? grupo : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 ? Math.min(pagina, PAGINA_MAXIMA) : 1,
  };
}

export function urlBusca(atual: ParametrosBusca, muda: Partial<ParametrosBusca>): string {
  const trocouAba = muda.aba !== undefined && muda.aba !== atual.aba;
  // Mudar qualquer filtro volta à primeira página; trocar de aba solta o grupo, que é de outra lista.
  const p = { ...atual, pagina: 1, ...(trocouAba ? { grupo: null } : {}), ...muda };
  if (p.municipio && ufDoIbge(p.municipio) !== p.uf) p.municipio = null;
  const q = new URLSearchParams();
  if (p.aba !== "instrumentos") q.set("aba", p.aba);
  if (p.q) q.set("q", p.q);
  if (p.uf) q.set("uf", p.uf);
  if (p.municipio) q.set("municipio", p.municipio);
  if (p.tema) q.set("tema", p.tema);
  if (p.grupo) q.set("grupo", p.grupo);
  if (p.pagina > 1) q.set("pagina", String(p.pagina));
  const s = q.toString();
  return s ? `/mapa/busca?${s}` : "/mapa/busca";
}

/** Minúsculas e sem acento — o mesmo que o job faz em `texto_busca` (`painel_execucao/temas.py`, `dobrar`). */
export function dobrar(texto: string): string {
  return texto.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Do que a pessoa digitou aos termos que o banco procura (todos precisam aparecer).
 *
 * CNPJ com pontuação vira só dígitos, porque o job grava o CNPJ sem pontuação. `%`, `_` e
 * barra invertida saem: são curingas do LIKE e deixariam a pessoa varrer a tabela por acidente.
 * Termo de uma letra não filtra nada e sai.
 */
export function termosDaBusca(q: string): string[] {
  const semCnpj = q.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, (c) => c.replace(/\D/g, ""));
  const termos = dobrar(semCnpj)
    .replace(/[%_\\]/g, " ")
    .split(" ")
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((t) => t.length >= 2);
  return [...new Set(termos)].slice(0, MAXIMO_TERMOS);
}

export function situacoesDoGrupo(grupo: string | null): string[] | null {
  return grupo ? (GRUPOS_SITUACAO.find((g) => g.id === grupo)?.situacoes ?? null) : null;
}

export function desfechosDoGrupo(grupo: string | null): string[] | null {
  return grupo ? (GRUPOS_DESFECHO.find((g) => g.id === grupo)?.desfechos ?? null) : null;
}

export function grupoDaSituacao(situacao: string | null): string | null {
  return situacao ? (GRUPOS_SITUACAO.find((g) => g.situacoes.includes(situacao))?.id ?? null) : null;
}

export function totalDePaginas(total: number): number {
  return Math.max(1, Math.min(Math.ceil(total / LIMITE_POR_PAGINA), PAGINA_MAXIMA));
}

// ============================ ENDEREÇOS ============================

/** Número de convênio: só dígitos e letras (há números como 7AACFT). */
export function numeroValido(nr: string | undefined): nr is string {
  return typeof nr === "string" && /^[0-9A-Za-z]{1,20}$/.test(nr);
}

export const urlInstrumento = (nr: string) => `/mapa/instrumento/${encodeURIComponent(nr)}`;
export const urlProposta = (id: string) => `/mapa/proposta/${encodeURIComponent(id)}`;
export const urlInvestimentos = (ibge: string) => `/mapa/municipio/${ibge}/investimentos`;

// ============================ LINHAS (como a oport_14 devolve) ============================

export interface InstrumentoBusca {
  nr_convenio: string;
  nr_proposta: string | null;
  modalidade: string | null;
  situacao: string | null;
  vivo: boolean;
  detalhe: boolean;
  uf: string | null;
  cod_ibge: string | null;
  municipio: string | null;
  proponente: string | null;
  orgao_sup: string | null;
  programa: string | null;
  temas: string[];
  objeto: string | null;
  vl_repasse: number | null;
  vl_desembolsado: number | null;
  dt_assinatura: string | null;
  dt_fim_vigencia: string | null;
  total: number;
}

export interface PropostaBusca {
  id_proposta: string;
  nr_proposta: string | null;
  uf: string | null;
  cod_ibge: string | null;
  municipio: string | null;
  proponente: string | null;
  orgao_sup: string | null;
  programa: string | null;
  temas: string[];
  objeto: string | null;
  valor_repasse: number | null;
  dt_envio: string | null;
  ano_envio: number | null;
  desfecho: string | null;
  situacao: string | null;
  nr_convenio: string | null;
  total: number;
}

/** Uma linha de `painel_instrumento`, inteira. */
export interface Instrumento extends Omit<InstrumentoBusca, "total"> {
  id_proposta: string | null;
  subsituacao: string | null;
  cnpj: string | null;
  tipo_agente: string | null;
  orgao: string | null;
  cod_programa: string | null;
  com_emenda: boolean;
  vl_global: number | null;
  vl_contrapartida: number | null;
  vl_empenhado: number | null;
  vl_pago: number | null;
  vl_saldo_conta: number | null;
  pct_desembolsado: number | null;
  pct_fisico: number | null;
  dt_inicio_vigencia: string | null;
  dt_limite_contas: string | null;
  dt_suspensiva: string | null;
  dt_retirada_suspensiva: string | null;
  n_aditivos: number;
  n_prorrogas: number;
  dt_primeiro_desembolso: string | null;
  dt_ultimo_desembolso: string | null;
  dt_ultimo_pagamento: string | null;
}

export type TipoEvento = "situacao" | "desembolso" | "pagamento" | "tributo" | "aditivo" | "prorrogacao" | "licitacao";

export interface EventoInstrumento {
  data: string;
  tipo: TipoEvento;
  descricao: string | null;
  categoria: string | null;
  valor: number | null;
  quantidade: number | null;
  data_fim: string | null;
}

export interface LinhaInvestimento {
  dimensao: "tipo" | "tema" | "situacao" | "modalidade";
  chave: string;
  n: number;
  valor: number | null;
  executado: number | null;
}

/** "1 plano", "2 planos", "1.234 convênios": o número no formato brasileiro com a palavra concordando. */
export function contagem(quantidade: number, um: string, varios: string): string {
  return `${quantidade.toLocaleString("pt-BR")} ${Math.abs(quantidade) === 1 ? um : varios}`;
}

// ============================ LINHA DO TEMPO ============================

export const ROTULO_TIPO_EVENTO: Record<TipoEvento, string> = {
  situacao: "Situação",
  desembolso: "Desembolso",
  pagamento: "Pagamento",
  tributo: "Tributo",
  aditivo: "Termo aditivo",
  prorrogacao: "Prorrogação de ofício",
  licitacao: "Licitação",
};

/** As situações do histórico do SICONV que merecem outra frase; as demais viram texto a partir do código. */
const ROTULO_HISTORICO: Record<string, string> = {
  PROPOSTA_CADASTRADA: "Proposta cadastrada",
  PROPOSTA_ENVIADA_ANALISE: "Proposta enviada para análise",
  PROPOSTA_EM_ANALISE: "Proposta em análise",
  PROPOSTA_EM_COMPLEMENTACAO: "Proposta devolvida para complementação",
  PROPOSTA_COMPLEMENTADA_ENVIADA_ANALISE: "Proposta complementada e reenviada",
  PLANO_TRABALHO_APROVADO: "Plano de trabalho aprovado",
  ASSINADA: "Instrumento assinado",
  ASSINATURA_PENDENTE_REGISTRO_TV_SIAFI: "Assinatura aguardando registro no SIAFI",
  EM_EXECUCAO: "Em execução",
  AGUARDANDO_PRESTACAO_CONTAS: "Prazo de prestar contas começou",
  PRESTACAO_CONTAS_ENVIADA_ANALISE: "Prestação de contas enviada",
  PRESTACAO_CONTAS_EM_ANALISE: "Prestação de contas em análise",
  PRESTACAO_CONTAS_EM_COMPLEMENTACAO: "Prestação de contas devolvida para complementação",
  PRESTACAO_CONTAS_APROVADA: "Prestação de contas aprovada",
  PRESTACAO_CONTAS_APROVADA_COM_RESSALVAS: "Prestação de contas aprovada com ressalvas",
  PRESTACAO_CONTAS_REJEITADA: "Prestação de contas rejeitada",
  PRESTACAO_CONTAS_CONCLUIDA: "Prestação de contas concluída",
  CONVENIO_ANULADO: "Convênio anulado",
  CONVENIO_RESCINDIDO: "Convênio rescindido",
  INADIMPLENTE: "Inadimplente",
};

export function rotuloSituacaoHistorico(codigo: string | null): string {
  if (!codigo) return "Situação sem nome";
  if (ROTULO_HISTORICO[codigo]) return ROTULO_HISTORICO[codigo];
  const texto = codigo.replace(/_/g, " ").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Os eventos do mais recente ao mais antigo, agrupados por ano, para a leitura começar pelo que acabou de acontecer. */
export function porAno(eventos: EventoInstrumento[]): { ano: number; eventos: EventoInstrumento[] }[] {
  const grupos = new Map<number, EventoInstrumento[]>();
  const ordenados = [...eventos].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  for (const e of ordenados) {
    const ano = Number(e.data.slice(0, 4));
    grupos.set(ano, [...(grupos.get(ano) ?? []), e]);
  }
  return [...grupos.entries()].map(([ano, lista]) => ({ ano, eventos: lista }));
}

/** Soma de pagamentos, desembolsos e aditivos do instrumento, para o resumo acima da linha do tempo. */
export function resumoEventos(eventos: EventoInstrumento[]): Record<TipoEvento, { n: number; valor: number }> {
  const r = Object.fromEntries(
    (Object.keys(ROTULO_TIPO_EVENTO) as TipoEvento[]).map((t) => [t, { n: 0, valor: 0 }]),
  ) as Record<TipoEvento, { n: number; valor: number }>;
  for (const e of eventos) {
    r[e.tipo].n += e.tipo === "pagamento" || e.tipo === "desembolso" || e.tipo === "tributo" ? (e.quantidade ?? 1) : 1;
    r[e.tipo].valor += e.valor ?? 0;
  }
  return r;
}

// ============================ INVESTIMENTOS ============================

export const ROTULO_TIPO_INVESTIMENTO: Record<string, string> = {
  convenio: "Convênios e contratos de repasse",
  especial: "Transferências especiais (Pix)",
  fundo: "Fundo a fundo (Transferegov)",
};

export const ROTULO_GRUPO_INVESTIMENTO: Record<string, string> = {
  execucao: "Em execução",
  contas: "Prestando contas",
  concluido: "Concluído",
  encerrado: "Anulado ou cancelado",
  outros: "Outras situações",
};

export function linhasDe(linhas: LinhaInvestimento[], dimensao: LinhaInvestimento["dimensao"]): LinhaInvestimento[] {
  return linhas.filter((l) => l.dimensao === dimensao).sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0) || a.chave.localeCompare(b.chave));
}

/** Fração de cada barra sobre a maior, para um gráfico de barras em CSS. */
export function fracoesDaMaior<T>(itens: T[], valor: (x: T) => number): { item: T; fracao: number }[] {
  const maior = Math.max(0, ...itens.map(valor));
  return itens.map((item) => ({ item, fracao: maior > 0 ? valor(item) / maior : 0 }));
}
