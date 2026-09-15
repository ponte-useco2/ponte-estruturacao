/**
 * Pix (transferências especiais) e fundo a fundo — a parte pura de `/mapa/painel/pix`.
 *
 * Os números vêm prontos do job `pix_fundo/` (tabelas da `oport_13`). Aqui só se decide
 * como dizer: a aba, o recorte, os rótulos e as somas que a tela mostra. As regras estão
 * no job, com teste e com a regressão contra o estudo "Caminhos do dinheiro federal".
 */
import { UFS } from "./organizacao.ts";

export type AbaPix = "especiais" | "fundo";

export interface ParametrosPix {
  aba: AbaPix;
  /** Null = Brasil. */
  uf: string | null;
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parametrosPix(sp: Record<string, string | string[] | undefined>): ParametrosPix {
  const uf = um(sp.uf)?.toUpperCase() ?? null;
  return {
    aba: um(sp.aba) === "fundo" ? "fundo" : "especiais",
    uf: uf && (UFS as readonly string[]).includes(uf) ? uf : null,
  };
}

export function urlPix(atual: ParametrosPix, muda: Partial<ParametrosPix>): string {
  const p = { ...atual, ...muda };
  const q = new URLSearchParams();
  if (p.aba !== "especiais") q.set("aba", p.aba);
  if (p.uf) q.set("uf", p.uf);
  const s = q.toString();
  return s ? `/mapa/painel/pix?${s}` : "/mapa/painel/pix";
}

// ============================ LINHAS (como o job grava) ============================

export interface ExecucaoPix {
  id: number;
  dado_ate: string;
  referencia: string;
  concluida_em: string;
  contagens: Record<string, unknown>;
}

export interface LinhaEspecialAno {
  recorte: string;
  ano: number | null;
  planos: number;
  indicado: number;
  nao_impedido: number;
  impedidos: number;
  valor_impedido: number;
  duplicados: number;
  valor_duplicado: number;
  empenhado: number;
  planos_pagos: number;
  pago: number;
  pago_pt_aprovado: number;
  pago_com_relatorio: number;
  pago_com_final: number;
  executado_declarado: number;
  planos_pagos_12m: number;
  pago_12m: number;
  planos_12m_sem_relatorio: number;
  pago_12m_sem_relatorio: number;
  planos_execucao_encerrada: number;
  planos_encerrada_sem_final: number;
  pago_encerrada_sem_final: number;
}

export interface LinhaEspecialMotivo {
  recorte: string;
  ano: number | null;
  motivo: string | null;
  impedidos: number;
  valor_impedido: number;
  impedidos_ciclo1: number;
  reapresentados: number;
  valor_reapresentado: number;
  pago_no_gemeo: number;
}

export interface PlanoEspecial {
  id_plano_acao: number;
  codigo_plano_acao: string | null;
  ano: number | null;
  beneficiario: string | null;
  cnpj: string | null;
  numero_emenda: number | null;
  situacao: string | null;
  motivo: string | null;
  valor: number | null;
  empenhado: number | null;
  pago: number | null;
  dt_primeira_ob: string | null;
  situacao_pt: string | null;
  fim_execucao: string | null;
  relatorio_entregue: boolean;
  final_entregue: boolean;
  duplicado: boolean;
  reapresentado: boolean;
  sem_relatorio_12m: boolean;
  encerrada_sem_final: boolean;
}

export interface LinhaFundoAno {
  recorte: string;
  ano: number | null;
  orgao: string | null;
  planos: number;
  entes: number;
  repasse: number;
  planos_autorizados: number;
  repasse_autorizado: number;
  planos_com_saldo: number;
  saldo_contas: number;
  planos_vigencia_encerrada: number;
  planos_encerrada_com_saldo: number;
  saldo_encerrada: number;
}

export interface LinhaFundoRelatorio {
  recorte: string;
  ano: number | null;
  orgao: string | null;
  situacao: string;
  tipo: string;
  planos: number;
  repasse: number;
  relatorio_mais_antigo: string | null;
}

export interface PlanoFundo {
  id_plano_acao: number;
  codigo_plano_acao: string | null;
  ano: number | null;
  orgao: string | null;
  programa: string | null;
  ente: string | null;
  cnpj: string | null;
  cod_ibge: string | null;
  situacao: string | null;
  repasse: number | null;
  fim_vigencia: string | null;
  saldo_contas: number | null;
  contas: number;
  repasse_creditado: number | null;
  pago: number | null;
  dt_primeiro_credito: string | null;
  dt_ultimo_pagamento: string | null;
  dt_ultimo_movimento: string | null;
  situacao_relatorio: string | null;
  tipo_relatorio: string | null;
  dt_relatorio: string | null;
  parado_12m: boolean;
  nunca_pagou: boolean;
  vigencia_encerrada: boolean;
}

// ============================ RÓTULOS ============================

/** Quem precisava agir para o plano não ficar impedido. */
export type LadoMotivo = "orgao" | "beneficiario" | "outro";

/** Os motivos que o job grava (pix_fundo/especiais.py, MOTIVOS), na ordem do estudo. */
export const MOTIVOS_ESPECIAIS: { motivo: string; rotulo: string; lado: LadoMotivo }[] = [
  { motivo: "falta_analise", rotulo: "O órgão federal não analisou o plano no prazo", lado: "orgao" },
  { motivo: "falta_complementacao", rotulo: "O ente não complementou o plano de trabalho no prazo", lado: "beneficiario" },
  { motivo: "nao_ciencia_envio", rotulo: "O ente não deu ciência ou não enviou o plano no prazo", lado: "beneficiario" },
  { motivo: "rejeicao_pt", rotulo: "Plano de trabalho rejeitado", lado: "outro" },
  { motivo: "regra_70_capital", rotulo: "Regra dos 70% em despesa de capital", lado: "outro" },
  { motivo: "pendencia_anos_anteriores", rotulo: "Plano de trabalho de anos anteriores pendente", lado: "beneficiario" },
  { motivo: "obice_empenho", rotulo: "Óbice que impede o empenho no ano", lado: "outro" },
  { motivo: "erro_indicacao", rotulo: "Omissão ou erro na indicação do beneficiário", lado: "outro" },
  { motivo: "ajuste_orcamentario", rotulo: "Ajuste orçamentário (GND ou SIOP)", lado: "outro" },
  { motivo: "determinacao_judicial", rotulo: "Determinação judicial, da AGU ou do controle", lado: "outro" },
  { motivo: "pedido_autor", rotulo: "Pedido do autor da emenda", lado: "outro" },
  { motivo: "outros", rotulo: "Outros motivos", lado: "outro" },
  { motivo: "sem_motivo", rotulo: "Impedido sem motivo registrado", lado: "outro" },
];

export const ROTULO_LADO_MOTIVO: Record<LadoMotivo, string> = {
  orgao: "do órgão federal",
  beneficiario: "do ente",
  outro: "outros",
};

const MOTIVO = new Map(MOTIVOS_ESPECIAIS.map((m, i) => [m.motivo, { ...m, ordem: i }]));

export function rotuloMotivo(motivo: string | null): string {
  return (motivo && MOTIVO.get(motivo)?.rotulo) || "Impedido sem motivo registrado";
}

/** Situação do último relatório de gestão do fundo a fundo (grafia da API). */
export const ROTULO_SITUACAO_RELATORIO: Record<string, string> = {
  SEM_RELATORIO: "Nenhum relatório registrado",
  EM_ELABORACAO: "Em elaboração pelo ente",
  ENVIADO_ANALISE: "Enviado, aguardando análise",
  ENVIADO_ANALISE_CONSELHO: "Aguardando o conselho",
  EM_COMPLEMENTACAO: "Devolvido para complementação",
  APROVADO: "Aprovado",
  APROVADO_CONSELHO: "Aprovado pelo conselho",
  REJEITADO: "Rejeitado",
};

/** Ordem de leitura da fila: primeiro o que espera alguém. */
export const ORDEM_SITUACAO_RELATORIO = [
  "ENVIADO_ANALISE",
  "ENVIADO_ANALISE_CONSELHO",
  "EM_COMPLEMENTACAO",
  "EM_ELABORACAO",
  "SEM_RELATORIO",
  "REJEITADO",
  "APROVADO",
  "APROVADO_CONSELHO",
];

// ============================ CONTAS ============================

export type Numericas<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

/** Soma um campo nas linhas de um recorte (e, se dado, só nos anos pedidos). */
export function soma<T extends { recorte: string; ano: number | null }>(
  linhas: T[],
  recorte: string,
  campo: Numericas<T>,
  anos?: number[],
): number {
  let s = 0;
  for (const l of linhas) {
    if (l.recorte !== recorte || (anos && (l.ano === null || !anos.includes(l.ano)))) continue;
    s += Number(l[campo]) || 0;
  }
  return s;
}

export function fracaoDe(parte: number, total: number): number | null {
  return total > 0 ? parte / total : null;
}

/** Percentual com uma casa: nas especiais, 21,4% e 21% contam histórias diferentes. */
export function percentual1(f: number | null | undefined): string {
  if (f === null || f === undefined || !Number.isFinite(f)) return "—";
  return `${(f * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function anosDe<T extends { recorte: string; ano: number | null }>(linhas: T[], recorte: string): number[] {
  return [...new Set(linhas.filter((l) => l.recorte === recorte && l.ano !== null).map((l) => l.ano as number))].sort((a, b) => a - b);
}

export interface EtapaFunil {
  rotulo: string;
  valor: number;
  /** Do valor indicado. */
  fracao: number | null;
  nota?: string;
}

/** O caminho do dinheiro das especiais, do indicado ao relatório final. */
export function funilEspeciais(linhas: LinhaEspecialAno[], recorte: string, anos?: number[]): EtapaFunil[] {
  const s = (c: Numericas<LinhaEspecialAno>) => soma(linhas, recorte, c, anos);
  const indicado = s("indicado");
  const etapa = (rotulo: string, valor: number, nota?: string): EtapaFunil => ({ rotulo, valor, fracao: fracaoDe(valor, indicado), nota });
  return [
    etapa("Indicado nas emendas", indicado),
    etapa("Sem impedimento", s("nao_impedido")),
    etapa("Empenhado", s("empenhado")),
    etapa("Pago (ordem bancária)", s("pago")),
    etapa("Pago com plano de trabalho aprovado", s("pago_pt_aprovado"), "inclui o legado da ADPF 854"),
    etapa("Pago com algum relatório de gestão entregue", s("pago_com_relatorio")),
    etapa("Pago com relatório final entregue", s("pago_com_final")),
  ];
}

export interface ReapresentacaoAno {
  ano: number;
  impedidosCiclo1: number;
  reapresentados: number;
  fracao: number | null;
  pagoNoGemeo: number;
}

/**
 * Impedidos do 1º ciclo que voltaram idênticos num ciclo posterior do mesmo ano e ficaram
 * cientes. Só os anos em que houve ciclo posterior (sem ele, a fração seria sempre zero).
 */
export function reapresentacao(motivos: LinhaEspecialMotivo[], recorte: string): ReapresentacaoAno[] {
  const porAno = new Map<number, ReapresentacaoAno>();
  for (const m of motivos) {
    if (m.recorte !== recorte || m.ano === null) continue;
    const a = porAno.get(m.ano) ?? { ano: m.ano, impedidosCiclo1: 0, reapresentados: 0, fracao: null, pagoNoGemeo: 0 };
    a.impedidosCiclo1 += m.impedidos_ciclo1;
    a.reapresentados += m.reapresentados;
    a.pagoNoGemeo += m.pago_no_gemeo;
    porAno.set(m.ano, a);
  }
  return [...porAno.values()]
    .filter((a) => a.reapresentados > 0)
    .map((a) => ({ ...a, fracao: fracaoDe(a.reapresentados, a.impedidosCiclo1) }))
    .sort((a, b) => b.ano - a.ano);
}

export interface MotivoSomado {
  motivo: string;
  rotulo: string;
  lado: LadoMotivo;
  impedidos: number;
  valor: number;
  reapresentados: number;
  impedidosCiclo1: number;
}

/** Impedidos por motivo no recorte (todos os anos ou os pedidos), do maior para o menor. */
export function motivosSomados(motivos: LinhaEspecialMotivo[], recorte: string, anos?: number[]): MotivoSomado[] {
  const acc = new Map<string, MotivoSomado>();
  for (const m of motivos) {
    if (m.recorte !== recorte || (anos && (m.ano === null || !anos.includes(m.ano)))) continue;
    const chave = m.motivo ?? "sem_motivo";
    const def = MOTIVO.get(chave);
    const a = acc.get(chave) ?? {
      motivo: chave,
      rotulo: def?.rotulo ?? chave,
      lado: def?.lado ?? "outro",
      impedidos: 0,
      valor: 0,
      reapresentados: 0,
      impedidosCiclo1: 0,
    };
    a.impedidos += m.impedidos;
    a.valor += m.valor_impedido;
    a.reapresentados += m.reapresentados;
    a.impedidosCiclo1 += m.impedidos_ciclo1;
    acc.set(chave, a);
  }
  return [...acc.values()].sort((a, b) => b.valor - a.valor || (MOTIVO.get(a.motivo)?.ordem ?? 99) - (MOTIVO.get(b.motivo)?.ordem ?? 99));
}

export interface FundoPorChave {
  chave: string;
  planos: number;
  repasse: number;
  repasseAutorizado: number;
  saldo: number;
  encerradaComSaldo: number;
  saldoEncerrada: number;
}

/** Fundo a fundo agregado por ano ou por órgão, no recorte. */
export function fundoPor(linhas: LinhaFundoAno[], recorte: string, por: "ano" | "orgao"): FundoPorChave[] {
  const acc = new Map<string, FundoPorChave>();
  for (const l of linhas) {
    if (l.recorte !== recorte) continue;
    const chave = por === "ano" ? String(l.ano ?? "—") : (l.orgao ?? "(sem órgão)");
    const a = acc.get(chave) ?? { chave, planos: 0, repasse: 0, repasseAutorizado: 0, saldo: 0, encerradaComSaldo: 0, saldoEncerrada: 0 };
    a.planos += l.planos;
    a.repasse += l.repasse;
    a.repasseAutorizado += l.repasse_autorizado;
    a.saldo += l.saldo_contas;
    a.encerradaComSaldo += l.planos_encerrada_com_saldo;
    a.saldoEncerrada += l.saldo_encerrada;
    acc.set(chave, a);
  }
  const lista = [...acc.values()];
  return por === "ano" ? lista.sort((a, b) => a.chave.localeCompare(b.chave)) : lista.sort((a, b) => b.repasse - a.repasse);
}

export interface FilaRelatorio {
  situacao: string;
  rotulo: string;
  planos: number;
  repasse: number;
  maisAntigo: string | null;
}

/** Planos em execução pela situação do último relatório, na ordem de ORDEM_SITUACAO_RELATORIO. */
export function filaRelatorios(linhas: LinhaFundoRelatorio[], recorte: string): FilaRelatorio[] {
  const acc = new Map<string, FilaRelatorio>();
  for (const l of linhas) {
    if (l.recorte !== recorte) continue;
    const a = acc.get(l.situacao) ?? {
      situacao: l.situacao,
      rotulo: ROTULO_SITUACAO_RELATORIO[l.situacao] ?? l.situacao,
      planos: 0,
      repasse: 0,
      maisAntigo: null,
    };
    a.planos += l.planos;
    a.repasse += l.repasse;
    if (l.relatorio_mais_antigo && (!a.maisAntigo || l.relatorio_mais_antigo < a.maisAntigo)) a.maisAntigo = l.relatorio_mais_antigo;
    acc.set(l.situacao, a);
  }
  const ordem = (s: string) => {
    const i = ORDEM_SITUACAO_RELATORIO.indexOf(s);
    return i === -1 ? 99 : i;
  };
  return [...acc.values()].sort((a, b) => ordem(a.situacao) - ordem(b.situacao) || a.situacao.localeCompare(b.situacao));
}

/** A data de um campo das contagens (texto ISO), ou null. */
export function dataDasContagens(c: Record<string, unknown>, chave: string): string | null {
  const v = c[chave];
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null;
}
