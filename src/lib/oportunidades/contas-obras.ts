/**
 * Prestação de contas e obra do convênio, pelas coletas do Acesso Livre (onda 13C.2 e 13C.3).
 *
 * `acesso_livre/carregar.py` grava, por recorte, o que a tela da prestação de contas e o módulo de medição
 * mostram e os dados abertos não têm: os eventos SIAFI (valor aprovado × impugnado), os pareceres da análise
 * com a situação, o cumprimento do objeto declarado; e, da obra, a última medição, os dias sem medição, o
 * atraso, a paralisação e o executado atestado pelo convenente × pela concedente/mandatária.
 *
 * Redação: impugnação é o concedente recusando a comprovação de uma parte; não é julgamento. Parecer em
 * diligência pede complemento. O nome do servidor que deu o parecer só aparece para administrador.
 * Função pura, sem banco e sem relógio.
 */
import { formatarData } from "./central.ts";
import type { Risco } from "./laudo.ts";

export interface PcConvenio {
  nr_convenio: string;
  n_eventos: number;
  valor_comprovado: number | null;
  valor_aprovado: number | null;
  valor_impugnado: number | null;
  dt_comprovacao: string | null;
  dt_ultimo_evento: string | null;
  ultimo_evento: string | null;
  cumprimento: string | null;
  pct_fisico_declarado: number | null;
  n_pareceres: number;
  parecer_data: string | null;
  parecer_tipo: string | null;
  parecer_situacao: string | null;
  erro: string | null;
}

export interface PcEvento {
  ordem: number;
  evento: string | null;
  situacao: string | null;
  data_hora: string | null;
  valor: number | null;
}

export interface PcParecer {
  ordem: number;
  data: string | null;
  tipo: string | null;
  situacao: string | null;
  emitido_por: string | null;
  responsavel: string | null;
  atribuicao: string | null;
  funcao: string | null;
  texto: string | null;
  n_anexos: number | null;
  detalhado: boolean;
}

export interface ObraConvenio {
  nr_convenio: string;
  codigo: string;
  mensagem: string | null;
  n_lotes: number;
  ultima_medicao: number | null;
  dias_sem_medicao: number | null;
  atrasado: boolean | null;
  paralisado: boolean | null;
  valor_total: number | null;
  realizado_convenente: number | null;
  realizado_concedente: number | null;
  pct_convenente: number | null;
  pct_concedente: number | null;
}

/** O que o laudo recebe das duas coletas. Cada parte `null` quando o convênio não está nela. */
export interface EntradaContasObras {
  prestacao: { convenio: PcConvenio; eventos: PcEvento[]; pareceres: PcParecer[]; referencia: string | null } | null;
  obra: { convenio: ObraConvenio; referencia: string | null } | null;
}

/** Dias sem medição a partir dos quais a obra atrasada vira risco alto (abaixo, de 90, moderado). */
export const DIAS_SEM_MEDICAO_ALTO = 180;
export const DIAS_SEM_MEDICAO_MODERADO = 90;
/** Diferença, em pontos, entre o executado que o convenente atestou e o que a concedente/mandatária atestou. */
export const PONTOS_ATESTADO = 20;
/** Com a obra atestada por inteiro pelo convenente, a diferença que já indica aceite pendente. */
export const PONTOS_ACEITE_FINAL = 5;

/** O convenente já atestou a obra inteira: a falta de medição nova não é obra parada. */
const obraCompleta = (o: ObraConvenio) => (o.pct_convenente ?? 0) >= 99.5;

export const moedaContas = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const dia = (iso: string | null) => (iso ? formatarData(iso.slice(0, 10)) : "—");

export interface SecaoContasObras {
  prestacao: {
    frase: string;
    eventos: PcEvento[];
    pareceres: PcParecer[];
    cumprimento: string | null;
    referencia: string | null;
  } | null;
  obra: { frase: string; atestado: string | null; referencia: string | null } | null;
}

function frasePrestacao(c: PcConvenio): string {
  if (!c.n_eventos) return "Nenhum evento de prestação de contas registrado no SIAFI até a coleta.";
  const partes: string[] = [];
  if (c.valor_comprovado !== null) partes.push(`${moedaContas(c.valor_comprovado)} comprovados${c.dt_comprovacao ? ` em ${dia(c.dt_comprovacao)}` : ""}`);
  if (c.valor_aprovado !== null) partes.push(`${moedaContas(c.valor_aprovado)} aprovados`);
  if (c.valor_impugnado !== null) partes.push(`${moedaContas(c.valor_impugnado)} impugnados`);
  const ultimo = c.ultimo_evento ? ` O último evento é ${c.ultimo_evento.toLowerCase()}, em ${dia(c.dt_ultimo_evento)}.` : "";
  return `No SIAFI: ${partes.join("; ")}.${ultimo}`;
}

function fraseObra(o: ObraConvenio): string {
  if (o.codigo === "err005") return "O acompanhamento da obra ainda não começou: a licitação não foi aceita no módulo VRPL.";
  if (o.codigo === "err007") return "Esta obra não é acompanhada pelo módulo de medição (não segue o fluxo VRPL/AIO): o acompanhamento é pelos relatórios do SICONV.";
  if (o.codigo !== "ok") return "O módulo de medição não respondeu para este convênio na coleta.";
  if (!o.n_lotes) return "Nenhum contrato cadastrado no módulo de medição.";
  if (obraCompleta(o) && !o.paralisado) {
    return (
      `No acompanhamento de obras: ${o.ultima_medicao ? `${o.ultima_medicao}ª medição` : "medição"}, com a obra inteira atestada pelo convenente` +
      (o.dias_sem_medicao !== null ? `; a última medição foi há ${o.dias_sem_medicao} dias.` : ".")
    );
  }
  const partes = [
    o.ultima_medicao ? `${o.ultima_medicao}ª medição` : "nenhuma medição",
    o.dias_sem_medicao !== null ? `${o.dias_sem_medicao} dias sem medição` : null,
    o.paralisado ? "marcada como paralisada" : o.atrasado ? "marcada como atrasada" : null,
  ].filter(Boolean);
  return `No acompanhamento de obras: ${partes.join(", ")}.`;
}

function fraseAtestado(o: ObraConvenio): string | null {
  if (o.pct_convenente === null && o.pct_concedente === null) return null;
  const conv = o.pct_convenente !== null ? `o convenente atestou ${pct(o.pct_convenente)}` : null;
  const conc = o.pct_concedente !== null ? `a concedente ou mandatária, ${pct(o.pct_concedente)}` : null;
  return `Do valor da obra, ${[conv, conc].filter(Boolean).join("; ")}.`;
}

/**
 * A seção do laudo, ou `null` quando o convênio não está em nenhuma das duas coletas. `semNomes` (laudo
 * do cliente) tira o nome do servidor dos pareceres.
 */
export function secaoContasObras(e: EntradaContasObras | null | undefined, { semNomes = false }: { semNomes?: boolean } = {}): SecaoContasObras | null {
  if (!e || (!e.prestacao && !e.obra)) return null;
  const p = e.prestacao;
  const pareceres = p
    ? [...p.pareceres]
        .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || a.ordem - b.ordem)
        .map((x) => (semNomes ? { ...x, responsavel: null } : x))
    : [];
  return {
    prestacao: p
      ? {
          frase: frasePrestacao(p.convenio),
          eventos: [...p.eventos].sort((a, b) => (a.data_hora ?? "").localeCompare(b.data_hora ?? "")),
          pareceres,
          cumprimento:
            p.convenio.cumprimento || p.convenio.pct_fisico_declarado !== null
              ? `O convenente declarou o objeto cumprido ${p.convenio.cumprimento ?? "—"}${p.convenio.pct_fisico_declarado !== null ? `, com ${pct(p.convenio.pct_fisico_declarado)} de execução física` : ""}.`
              : null,
          referencia: p.referencia,
        }
      : null,
    obra: e.obra ? { frase: fraseObra(e.obra.convenio), atestado: fraseAtestado(e.obra.convenio), referencia: e.obra.referencia } : null,
  };
}

/** Os riscos do quadro que vêm das duas coletas. `comTce`: o convênio já tem TCE no TCU (onda 13C.1). */
export function riscosContasObras(e: EntradaContasObras | null | undefined, { comTce = false }: { comTce?: boolean } = {}): Risco[] {
  const riscos: Risco[] = [];
  const c = e?.prestacao?.convenio;
  if (c && (c.valor_impugnado ?? 0) > 0) {
    const impugnacao = [...(e!.prestacao!.eventos)].filter((x) => /^impugna/i.test(x.evento ?? "")).pop();
    riscos.push({
      nivel: "alto",
      titulo: `${moedaContas(c.valor_impugnado!)} impugnados na prestação de contas`,
      fato:
        `O concedente registrou no SIAFI a impugnação de ${moedaContas(c.valor_impugnado!)}` +
        (impugnacao?.data_hora ? ` em ${dia(impugnacao.data_hora)}` : "") +
        (c.valor_aprovado !== null ? `, e a aprovação de ${moedaContas(c.valor_aprovado)}` : "") +
        (c.valor_comprovado !== null ? `, de ${moedaContas(c.valor_comprovado)} comprovados` : "") +
        (comTce
          ? ". A impugnação já virou Tomada de Contas Especial no TCU."
          : ". O valor impugnado é o que o convenente terá de devolver ou justificar; sem isso, vira Tomada de Contas Especial."),
    });
  }
  if (c && /dilig/i.test(c.parecer_situacao ?? "")) {
    riscos.push({
      nivel: "moderado",
      titulo: "Prestação de contas em diligência",
      fato: `O parecer${c.parecer_tipo ? ` ${c.parecer_tipo.toLowerCase()}` : ""} de ${dia(c.parecer_data)} está "${c.parecer_situacao}": o concedente pediu complemento ao convenente.`,
    });
  }
  const o = e?.obra?.convenio;
  if (o && o.codigo === "ok") {
    const diferenca = o.pct_convenente !== null && o.pct_concedente !== null ? o.pct_convenente - o.pct_concedente : 0;
    if (o.paralisado) {
      riscos.push({ nivel: "alto", titulo: "Obra paralisada", fato: "O acompanhamento de obras do Transferegov marca o contrato como paralisado." });
    } else if (obraCompleta(o)) {
      // Obra atestada por inteiro: o que pode estar parado é o aceite da concedente/mandatária.
      if (diferenca >= PONTOS_ACEITE_FINAL && (o.dias_sem_medicao ?? 0) >= DIAS_SEM_MEDICAO_MODERADO) {
        riscos.push({
          nivel: "moderado",
          titulo: "Obra atestada por inteiro, aceite da concedente pendente",
          fato:
            `O convenente atestou ${pct(o.pct_convenente!)} da obra; a concedente ou mandatária aceitou ${pct(o.pct_concedente!)}, e a última ` +
            `medição (a ${o.ultima_medicao ?? "—"}ª) foi há ${o.dias_sem_medicao} dias. A diferença é o que a medição ainda não aceitou.`,
        });
      }
    } else if (o.atrasado && (o.dias_sem_medicao ?? 0) >= DIAS_SEM_MEDICAO_MODERADO) {
      riscos.push({
        nivel: (o.dias_sem_medicao ?? 0) >= DIAS_SEM_MEDICAO_ALTO ? "alto" : "moderado",
        titulo: `Obra sem medição há ${o.dias_sem_medicao} dias`,
        fato: `A última medição registrada é a ${o.ultima_medicao ?? "—"}ª, há ${o.dias_sem_medicao} dias, e o acompanhamento de obras marca o contrato como atrasado.`,
      });
    }
    if (!obraCompleta(o) && o.pct_convenente !== null && o.pct_concedente !== null && diferenca >= PONTOS_ATESTADO) {
      riscos.push({
        nivel: "moderado",
        titulo: "Executado atestado pelo convenente acima do da concedente",
        fato: `O convenente atestou ${pct(o.pct_convenente)} da obra; a concedente ou mandatária, ${pct(o.pct_concedente)}. A diferença é o que ainda não foi aceito na medição.`,
      });
    }
  }
  return riscos;
}

// ================================================================ painel (administrador)

export interface LinhaImpugnacao extends PcConvenio {
  municipio: string | null;
  proponente: string | null;
  situacao_convenio: string | null;
}

export interface LinhaObraParada extends ObraConvenio {
  municipio: string | null;
  proponente: string | null;
}

/** As obras que o painel lista: paralisadas, ou atrasadas há pelo menos 90 dias, da mais parada à menos. */
export function obrasParadas(linhas: LinhaObraParada[]): LinhaObraParada[] {
  return linhas
    .filter((o) => o.codigo === "ok" && (o.paralisado || (!obraCompleta(o) && o.atrasado && (o.dias_sem_medicao ?? 0) >= DIAS_SEM_MEDICAO_MODERADO)))
    .sort((a, b) => Number(b.paralisado) - Number(a.paralisado) || (b.dias_sem_medicao ?? 0) - (a.dias_sem_medicao ?? 0));
}
