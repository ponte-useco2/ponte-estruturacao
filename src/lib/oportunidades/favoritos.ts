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

export type TipoItem = "janela" | "instrumento" | "proposta";

export const TIPOS_ITEM: readonly TipoItem[] = ["janela", "instrumento", "proposta"];

/** O mesmo teto da oport_15 (`oport_favorito_limite`). */
export const LIMITE_SEGUIDOS = 300;

/** As mesmas regras da tabela: a ação recusa antes de ir ao banco. */
export function chaveValida(tipo: unknown, chave: unknown): tipo is TipoItem {
  if (typeof chave !== "string") return false;
  if (tipo === "janela") return /^[A-Za-z0-9._-]{1,160}$/.test(chave);
  if (tipo === "instrumento") return /^[0-9A-Za-z]{1,20}$/.test(chave);
  if (tipo === "proposta") return /^[0-9]{1,12}$/.test(chave);
  return false;
}

export const chaveSeguida = (tipo: TipoItem, chave: string) => `${tipo}:${chave}`;

export const ROTULO_TIPO_ITEM: Record<TipoItem, string> = {
  janela: "Janela",
  instrumento: "Convênio",
  proposta: "Proposta",
};

/** Para onde o item leva. A janela não tem página própria: o cartão no catálogo tem âncora. */
export function urlDoItem(tipo: TipoItem, chave: string): string {
  if (tipo === "instrumento") return `/mapa/instrumento/${encodeURIComponent(chave)}`;
  if (tipo === "proposta") return `/mapa/proposta/${encodeURIComponent(chave)}`;
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

/**
 * O aviso em palavras. Campo desconhecido (a tabela aceita campo novo antes da tela)
 * vira uma frase genérica com antes e depois, nunca some.
 */
export function fraseDoAviso(a: Pick<AvisoItem, "tipo" | "evento" | "antes" | "depois">): FraseAviso {
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
