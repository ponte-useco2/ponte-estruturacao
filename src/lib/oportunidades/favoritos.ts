/**
 * Itens seguidos e avisos sobre eles (onda 7) — puro: sem banco, rede nem relógio.
 *
 * A comparação que gera os avisos mora no banco (`oport_gerar_avisos_*`, oport_15).
 * Aqui ficam o que a tela e as ações precisam: validar a chave antes de gravar,
 * montar as janelas abertas que a geração recebe e transformar o aviso gravado
 * (campo, antes, depois) numa frase.
 */
import { formatarData } from "./central.ts";
import { ehAberta, type PayloadV2 } from "./contrato-v2.ts";
import { ROTULO_DESFECHO, percentual } from "./painel.ts";
import { moedaCurta } from "./radar.ts";

export type TipoItem = "janela" | "instrumento" | "proposta" | "municipio" | "entidade";

export const TIPOS_ITEM: readonly TipoItem[] = ["janela", "instrumento", "proposta", "municipio", "entidade"];

/** O mesmo teto da oport_15 (`oport_favorito_limite`). */
export const LIMITE_SEGUIDOS = 300;

/** As mesmas regras da tabela: a ação recusa antes de ir ao banco. */
export function chaveValida(tipo: unknown, chave: unknown): tipo is TipoItem {
  if (typeof chave !== "string") return false;
  if (tipo === "janela") return /^[A-Za-z0-9._-]{1,160}$/.test(chave);
  if (tipo === "instrumento") return /^[0-9A-Za-z]{1,20}$/.test(chave);
  if (tipo === "proposta") return /^[0-9]{1,12}$/.test(chave);
  if (tipo === "municipio") return /^[0-9]{7}$/.test(chave);
  // o CNPJ como a base guarda (oport_31): 14 posições, alfanumérico aceito
  if (tipo === "entidade") return /^[0-9A-Z]{12}[0-9]{2}$/.test(chave);
  return false;
}

export const chaveSeguida = (tipo: TipoItem, chave: string) => `${tipo}:${chave}`;

export const ROTULO_TIPO_ITEM: Record<TipoItem, string> = {
  janela: "Janela",
  instrumento: "Convênio",
  proposta: "Proposta",
  municipio: "Município",
  entidade: "Entidade",
};

/** Para onde o item leva. A janela não tem página própria: o cartão no catálogo tem âncora. */
/**
 * Onde o item abre. O município abre a página com abas para todo aprovado (F1, 06/10/2026): o que cada um vê
 * lá dentro depende do nível de acesso, e o relatório completo é uma das abas.
 */
export function urlDoItem(tipo: TipoItem, chave: string): string {
  if (tipo === "instrumento") return `/mapa/instrumento/${encodeURIComponent(chave)}`;
  if (tipo === "proposta") return `/mapa/proposta/${encodeURIComponent(chave)}`;
  if (tipo === "municipio") return `/mapa/municipio/${encodeURIComponent(chave)}`;
  if (tipo === "entidade") return `/mapa/entidade/${encodeURIComponent(chave)}`;
  return `/mapa#janela-${chave}`;
}

export interface ItemSeguido {
  tipo: TipoItem;
  chave: string;
  titulo: string | null;
  criado_em: string;
  /** Retrato ausente do painel: o item saiu do recorte da busca. */
  ausente: boolean;
}

export interface AvisoItem {
  id: string;
  tipo: TipoItem;
  chave: string;
  evento: string;
  titulo: string | null;
  antes: string | null;
  depois: string | null;
  criado_em: string;
  lida_em: string | null;
  arquivada_em: string | null;
}

/**
 * As janelas abertas hoje, no formato que `oport_gerar_avisos_janelas` recebe.
 * Mesma regra de "aberta" do catálogo (`ehAberta`): a que venceu hoje já não conta.
 */
export function abertasParaAvisos(payload: PayloadV2, hojeIso: string): Record<string, { titulo: string; prazo: string | null }> {
  const abertas: Record<string, { titulo: string; prazo: string | null }> = {};
  for (const o of payload.opportunities) {
    if (!ehAberta(o, hojeIso)) continue;
    const prazo = o.dates.deadline && /^\d{4}-\d{2}-\d{2}/.test(o.dates.deadline) ? o.dates.deadline.slice(0, 10) : null;
    abertas[o.id] = { titulo: o.title.slice(0, 300), prazo };
  }
  return abertas;
}

/** O retrato de uma janela na hora de seguir: é o que a primeira comparação usa. */
export function retratoDaJanela(payload: PayloadV2, id: string, hojeIso: string): { titulo: string; estado: { aberta: boolean; prazo: string | null } } | null {
  const o = payload.opportunities.find((x) => x.id === id);
  if (!o) return null;
  const prazo = o.dates.deadline && /^\d{4}-\d{2}-\d{2}/.test(o.dates.deadline) ? o.dates.deadline.slice(0, 10) : null;
  return { titulo: o.title.slice(0, 300), estado: { aberta: ehAberta(o, hojeIso), prazo } };
}

const numero = (t: string | null) => (t === null || t === "" || Number.isNaN(Number(t)) ? null : Number(t));
const data = (t: string | null) => (t ? formatarData(t) : "sem data");
const texto = (t: string | null) => t ?? "não informada";

export interface FraseAviso {
  /** O que aconteceu, curto. */
  rotulo: string;
  /** Antes e depois, ou o contexto. */
  detalhe: string;
}

/** As três decisões do painel fiscal, como o relatório do município as nomeia. */
const DECISAO_FISCAL: Record<string, string> = {
  fiscal_a: "declarações fiscais em dia",
  fiscal_b: "receber transferência voluntária",
  fiscal_c: "contratar operação de crédito",
};

const ROTULO_ESTADO_FISCAL: Record<string, string> = {
  atendido: "atendido",
  nao_atendido: "não atendido",
  atencao: "atenção",
  nao_verificavel: "não verificável",
  desatualizado: "desatualizado",
};

function contagem(antes: string | null, depois: string | null): string {
  return `${antes ?? "0"} → ${depois ?? "0"}`;
}

function pct(v: number | null): string {
  return v === null ? "sem dado" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * O aviso em palavras. Campo desconhecido (a tabela aceita campo novo antes da tela)
 * vira uma frase genérica com antes e depois, nunca some. Com `hoje`, o aviso de prazo
 * de uma janela que já fechou diz que fechou, em vez de repetir a contagem do dia do aviso.
 */
export function fraseDoAviso(a: Pick<AvisoItem, "tipo" | "evento" | "antes" | "depois">, hoje?: string): FraseAviso {
  const { antes, depois } = a;
  switch (a.evento) {
    case "situacao":
      return {
        rotulo: a.tipo === "proposta" ? "A proposta mudou de situação" : "O convênio mudou de situação",
        detalhe: `${texto(antes)} → ${texto(depois)}`,
      };
    case "subsituacao":
      return { rotulo: "Mudou a subsituação", detalhe: `${antes ?? "nenhuma"} → ${depois ?? "nenhuma"}` };
    case "vl_desembolsado": {
      const de = numero(antes) ?? 0;
      const para = numero(depois) ?? 0;
      return para > de
        ? { rotulo: "Novo desembolso", detalhe: `${moedaCurta(para - de)} a mais · total de ${moedaCurta(de)} para ${moedaCurta(para)}` }
        : { rotulo: "O total desembolsado mudou", detalhe: `${moedaCurta(de)} → ${moedaCurta(para)}` };
    }
    case "n_aditivos":
      return { rotulo: "Termo aditivo novo", detalhe: `${antes ?? "0"} → ${depois ?? "0"} termos aditivos` };
    case "n_prorrogas":
      return { rotulo: "Prorrogação de ofício", detalhe: `${antes ?? "0"} → ${depois ?? "0"} prorrogações` };
    case "dt_fim_vigencia":
      return { rotulo: "A vigência mudou", detalhe: `até ${data(antes)} → até ${data(depois)}` };
    case "dt_limite_contas":
      return { rotulo: "O prazo de prestar contas mudou", detalhe: `${data(antes)} → ${data(depois)}` };
    case "dt_retirada_suspensiva":
      return depois
        ? { rotulo: "Cláusula suspensiva retirada", detalhe: `em ${data(depois)}` }
        : { rotulo: "A retirada da cláusula suspensiva saiu do registro", detalhe: `era ${data(antes)}` };
    case "pct_fisico":
      return { rotulo: "A execução física foi atualizada", detalhe: `${percentual(numero(antes))} → ${percentual(numero(depois))}` };
    case "desfecho":
      return {
        rotulo: "A proposta teve novo desfecho",
        detalhe: `${antes ? (ROTULO_DESFECHO[antes] ?? antes) : "sem desfecho"} → ${depois ? (ROTULO_DESFECHO[depois] ?? depois) : "sem desfecho"}`,
      };
    case "nr_convenio":
      return depois
        ? { rotulo: "A proposta virou convênio", detalhe: `convênio nº ${depois}` }
        : { rotulo: "O convênio saiu do registro da proposta", detalhe: `era o nº ${antes ?? "—"}` };
    case "em_execucao":
      return { rotulo: "Convênios em execução", detalhe: contagem(antes, depois) };
    case "instrumentos":
      return { rotulo: "Instrumentos no painel", detalhe: contagem(antes, depois) };
    case "propostas":
      return { rotulo: "Propostas no painel", detalhe: contagem(antes, depois) };
    case "em_suspensiva":
      return { rotulo: "Convênios em cláusula suspensiva", detalhe: contagem(antes, depois) };
    case "contas_atrasadas":
      return { rotulo: "Prestações de contas atrasadas", detalhe: contagem(antes, depois) };
    case "contas_rejeitadas":
      return { rotulo: "Contas rejeitadas ou inadimplência", detalhe: contagem(antes, depois) };
    case "saldo_parado":
      return { rotulo: "Convênios com saldo parado em conta", detalhe: contagem(antes, depois) };
    case "sem_desembolso":
      return { rotulo: "Convênios assinados sem desembolso", detalhe: contagem(antes, depois) };
    case "tce_tcu":
      return { rotulo: "Tomadas de Contas Especiais no TCU", detalhe: contagem(antes, depois) };
    case "fiscal_a":
    case "fiscal_b":
    case "fiscal_c":
      return {
        rotulo: `Painel fiscal: ${DECISAO_FISCAL[a.evento]}`,
        detalhe: `${ROTULO_ESTADO_FISCAL[antes ?? ""] ?? antes ?? "sem dado"} → ${ROTULO_ESTADO_FISCAL[depois ?? ""] ?? depois ?? "sem dado"}`,
      };
    case "cauc":
      return { rotulo: "Pendências no CAUC", detalhe: `${antes || "nenhuma"} → ${depois || "nenhuma"}` };
    case "pessoal_pct":
      return { rotulo: "Despesa com pessoal (% da RCL ajustada)", detalhe: `${pct(numero(antes))} → ${pct(numero(depois))}` };
    case "pix_vez_ente":
      return { rotulo: "Pix: planos à espera do município no ciclo", detalhe: contagem(antes, depois) };
    case "pix_vez_orgao":
      return { rotulo: "Pix: planos em análise no órgão federal", detalhe: contagem(antes, depois) };
    case "pix_prazo_ente":
      return { rotulo: "Pix: prazo da etapa do município", detalhe: `${antes ? data(antes) : "sem prazo"} → ${depois ? data(depois) : "sem prazo"}` };
    case "fora_do_recorte":
      return {
        rotulo: "Saiu da busca",
        detalhe: "Não está mais no recorte do painel: fora da Paraíba, a busca só guarda o que está em execução ou em prestação de contas.",
      };
    case "prazo":
      return { rotulo: "O prazo da janela mudou", detalhe: `${antes ? formatarData(antes) : "sem prazo"} → ${depois ? formatarData(depois) : "sem prazo"}` };
    case "encerrada":
      return { rotulo: "A janela fechou", detalhe: antes ? `O prazo era ${formatarData(antes)}.` : "Saiu das janelas abertas." };
    case "reaberta":
      return { rotulo: "A janela abriu de novo", detalhe: depois ? `Fecha em ${formatarData(depois)}.` : "Sem prazo informado pela fonte." };
    case "fechando": {
      const dias = numero(depois);
      if (hoje && antes && antes < hoje) {
        return { rotulo: "A janela fechou", detalhe: `O prazo era ${formatarData(antes)}; o aviso foi do dia em que ${dias === 1 ? "faltava 1 dia" : `faltavam ${dias ?? "poucos"} dias`}.` };
      }
      const quando = dias === 0 ? "Fecha hoje" : dias === 1 ? "Falta 1 dia" : `Faltam ${dias ?? "poucos"} dias`;
      return { rotulo: quando, detalhe: antes ? `O prazo é ${formatarData(antes)}.` : "Prazo curto." };
    }
    default:
      return { rotulo: "O item mudou", detalhe: `${a.evento}: ${antes ?? "—"} → ${depois ?? "—"}` };
  }
}

export type AbaItens = "nao_lidas" | "todas" | "arquivadas";

export function filtrarAvisos<T extends Pick<AvisoItem, "lida_em" | "arquivada_em">>(avisos: readonly T[], aba: AbaItens): T[] {
  return avisos.filter((a) => (aba === "arquivadas" ? a.arquivada_em !== null : a.arquivada_em === null && (aba === "todas" || a.lida_em === null)));
}

/** A soma das duas filas de não lidos da aba. Se as duas falharam, não há número a mostrar. */
export function somaNaoLidos(janelas: number | null, itens: number | null): number | null {
  if (janelas === null && itens === null) return null;
  return (janelas ?? 0) + (itens ?? 0);
}
