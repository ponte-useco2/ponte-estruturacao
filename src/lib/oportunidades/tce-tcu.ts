/**
 * Tomada de Contas Especial pelo e-TCE do TCU (onda 13C).
 *
 * O job `tce_tcu` consulta, toda semana, a API pública do e-TCE para os convênios assinados da PB e grava
 * a cobertura (`tcu_consulta`: consultado, quantas TCE, ou o erro) e as TCE (`tcu_tce`). A aba "TCE" do
 * convênio no Transferegov fica vazia mesmo quando há TCE: ela hoje corre no e-TCE.
 *
 * Redação: TCE instaurada é o órgão dizendo que há dano a apurar; o julgamento é do TCU. "Processo
 * autuado" é a TCE chegando ao Tribunal, não condenação. A API não traz responsável, e aqui não há nome.
 * Função pura, sem banco e sem relógio.
 */
import { formatarData } from "./central.ts";
import type { Risco } from "./laudo.ts";

export interface TceTcu {
  nr_convenio: string;
  codigo: number | null;
  numero: string | null;
  ano: number | null;
  situacao: string | null;
  origem_recursos: string | null;
  motivo: string | null;
  submotivo: string | null;
  iniciativa: string | null;
  dt_instauracao: string | null;
  dt_inicio_prazo: string | null;
  dt_prestacao_contas: string | null;
  dt_atualizacao_debito: string | null;
  debito_original: number | null;
  debito_sem_juros: number | null;
  debito_com_juros: number | null;
  numero_processo: string | null;
  url_processo: string | null;
  numero_acordao: string | null;
  origem_acordao: string | null;
  parecer_controle_interno: string | null;
  analise_boa_fe: boolean | null;
}

export interface ConsultaTcu {
  nr_convenio: string;
  situacao_convenio: string | null;
  cod_ibge: string | null;
  n_tce: number | null;
  erro: string | null;
}

export interface ExecucaoTcu {
  id: number;
  dado_ate: string | null;
  referencia: string | null;
  contagens: Record<string, unknown>;
}

/** O que o laudo de um convênio recebe: a consulta dele (ou nada), as TCE e a data da rodada. */
export interface EntradaTceTcu {
  consulta: ConsultaTcu | null;
  tces: TceTcu[];
  /** Dia da consulta (AAAA-MM-DD), da execução do job. */
  referencia: string | null;
}

export type EstadoTceTcu = "com_tce" | "sem_tce" | "nao_consultado";

export interface SecaoTceTcu {
  estado: EstadoTceTcu;
  frase: string;
  tces: TceTcu[];
  debitoOriginal: number;
  debitoComJuros: number;
}

/** "R$ 103.439,36" — o débito se mostra inteiro, como o TCU publica. */
export const moedaExata = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const soma = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

/** A seção do laudo, ou `null` quando o convênio não está no universo do job (fora da PB, ou antes da oport_25). */
export function secaoTceTcu(e: EntradaTceTcu | null | undefined): SecaoTceTcu | null {
  if (!e) return null;
  const quando = e.referencia ? ` em ${formatarData(e.referencia)}` : "";
  const tces = [...e.tces].sort((a, b) => (b.dt_instauracao ?? "").localeCompare(a.dt_instauracao ?? ""));
  const debitoOriginal = soma(tces.map((t) => t.debito_original));
  const debitoComJuros = soma(tces.map((t) => t.debito_com_juros));
  if (tces.length) {
    const n = tces.length;
    return {
      estado: "com_tce",
      frase: `${n === 1 ? "Há uma Tomada de Contas Especial" : `Há ${n} Tomadas de Contas Especiais`} deste convênio no e-TCE do TCU (consulta${quando}).`,
      tces,
      debitoOriginal,
      debitoComJuros,
    };
  }
  if (!e.consulta || e.consulta.n_tce === null) {
    return {
      estado: "nao_consultado",
      frase: e.consulta?.erro
        ? `O e-TCE do TCU não respondeu para este convênio na última consulta${quando}: fica sem verificação até a próxima.`
        : "Este convênio ainda não foi consultado no e-TCE do TCU.",
      tces: [],
      debitoOriginal: 0,
      debitoComJuros: 0,
    };
  }
  return { estado: "sem_tce", frase: `Nenhuma Tomada de Contas Especial deste convênio no e-TCE do TCU (consulta${quando}).`, tces: [], debitoOriginal: 0, debitoComJuros: 0 };
}

/** Uma TCE numa linha: ano, número, motivo e o débito. */
export function descreverTce(t: TceTcu): string {
  const partes = [
    t.numero && t.ano ? `TCE nº ${t.numero}/${t.ano}` : t.ano ? `TCE de ${t.ano}` : "TCE",
    t.dt_instauracao ? `instaurada em ${formatarData(t.dt_instauracao)}` : null,
    // Só a primeira letra desce: o motivo cita a União, que fica maiúscula.
    t.motivo ? `por "${t.motivo.charAt(0).toLowerCase()}${t.motivo.slice(1)}"` : null,
  ].filter(Boolean);
  const em = t.dt_atualizacao_debito ? ` em ${formatarData(t.dt_atualizacao_debito)}` : "";
  const debito =
    t.debito_original !== null
      ? `débito original de ${moedaExata(t.debito_original)}` +
        (t.debito_com_juros !== null && t.debito_com_juros !== t.debito_original ? ` (${moedaExata(t.debito_com_juros)} com juros${em})` : "")
      : // Há TCE antiga sem o débito original na API: vale o atualizado.
        t.debito_com_juros !== null
        ? `débito de ${moedaExata(t.debito_com_juros)} com juros${em} (o original não é informado)`
        : null;
  return [partes.join(" "), debito].filter(Boolean).join(", ") + ".";
}

/** O título de uma TCE: o débito original ou, sem ele, o atualizado. */
export function tituloDebito(t: Pick<TceTcu, "debito_original" | "debito_com_juros">): string {
  if (t.debito_original !== null) return `Débito original de ${moedaExata(t.debito_original)}`;
  if (t.debito_com_juros !== null) return `Débito de ${moedaExata(t.debito_com_juros)} com juros`;
  return "Débito não informado";
}

/** O risco do quadro: crítico, porque é dano apurado pelo órgão e já no Tribunal ou a caminho dele. */
export function riscoTceTcu(e: EntradaTceTcu | null | undefined): Risco | null {
  const s = secaoTceTcu(e);
  if (!s || s.estado !== "com_tce") return null;
  const n = s.tces.length;
  const processos = [...new Set(s.tces.map((t) => t.numero_processo).filter((p): p is string => !!p))];
  return {
    nivel: "critico",
    titulo: n === 1 ? "Tomada de Contas Especial no TCU" : `${n} Tomadas de Contas Especiais no TCU`,
    fato:
      (s.debitoOriginal > 0
        ? `Débito original de ${moedaExata(s.debitoOriginal)}` + (s.debitoComJuros > s.debitoOriginal ? `, ${moedaExata(s.debitoComJuros)} com juros` : "")
        : s.debitoComJuros > 0
          ? `Débito de ${moedaExata(s.debitoComJuros)} com juros`
          : "Débito não informado") +
      (processos.length ? `; processo ${processos.join(", ")} no TCU` : "") +
      ". TCE não é julgamento: o Tribunal ainda decide. O detalhe está na seção de contas.",
  };
}

// ================================================================ painel (administrador)

export interface LinhaTcePainel extends TceTcu {
  municipio: string | null;
  proponente: string | null;
  orgao_sup: string | null;
  situacao_convenio: string | null;
}

export interface MunicipioTce {
  municipio: string;
  convenios: number;
  tces: number;
  debitoOriginal: number;
  debitoComJuros: number;
  /** Alguma TCE do município informa o débito original (há TCE antiga só com o valor atualizado). */
  temOriginal: boolean;
}

/** As TCE por município, do maior débito atualizado ao menor. */
export function porMunicipio(linhas: LinhaTcePainel[]): MunicipioTce[] {
  const por = new Map<string, MunicipioTce & { nrs: Set<string> }>();
  for (const l of linhas) {
    const chave = l.municipio ?? "(sem município)";
    const m = por.get(chave) ?? { municipio: chave, convenios: 0, tces: 0, debitoOriginal: 0, debitoComJuros: 0, temOriginal: false, nrs: new Set<string>() };
    if (l.debito_original !== null) m.temOriginal = true;
    m.nrs.add(l.nr_convenio);
    m.tces += 1;
    m.debitoOriginal += l.debito_original ?? 0;
    m.debitoComJuros += l.debito_com_juros ?? 0;
    por.set(chave, m);
  }
  return [...por.values()]
    .map(({ nrs, ...m }) => ({ ...m, convenios: nrs.size }))
    .sort((a, b) => b.debitoComJuros - a.debitoComJuros || a.municipio.localeCompare(b.municipio, "pt-BR"));
}

export const urlContas = () => "/mapa/painel/contas";
