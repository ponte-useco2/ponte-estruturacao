/**
 * Lógica pura da aba Mapa de Oportunidades — a central de notificações.
 *
 * Fica fora do componente para que as três coisas que a revisão de design
 * mostrou estarem erradas no protótipo sejam provadas por teste, e não só
 * inspecionadas na tela:
 *
 *  1. A ordem. O protótipo seguia a ordem dos dados, e a janela que fechava em
 *     três dias aparecia abaixo de uma que fechava em sessenta. Aqui a ordem é
 *     de urgência.
 *  2. As contagens. Os chips contavam também as arquivadas e ignoravam a aba
 *     aberta. Aqui contam o que a pessoa está vendo.
 *  3. O vazio. "Nada mudou" com dado de três dias atrás é atestado de calmaria
 *     sobre ausência de informação. Aqui o frescor do dado decide o que o vazio
 *     pode afirmar.
 */
import type { Mudanca, TipoMudanca } from "./diff";

/** Uma mudança do catálogo como chegou a uma pessoa. */
export interface ItemCentral extends Mudanca {
  id: string;
  /** `gerado_em` da publicação do radar que originou a mudança. */
  publicado_em: string;
  lida_em: string | null;
  arquivada_em: string | null;
}

export type Aba = "nao_lidas" | "todas" | "arquivadas";

/** Acima disto, o dado não autoriza dizer que nada mudou. Mesmo limite do brief. */
export const HORAS_DADO_VELHO = 36;

export const ROTULO_TIPO: Record<TipoMudanca, string> = {
  fechando: "Prazo se aproximando",
  prazo_alterado: "Prazo alterado",
  removida: "Saiu antes do prazo",
  nova: "Janela nova",
  reaberta: "Reaberta",
  situacao_mudou: "Situação mudou",
  encerrada: "Encerrada",
};

/**
 * Posição na fila de urgência — menor vem antes.
 *
 * Só `fechando` tem prazo correndo de verdade, e a marca de 1 dia pesa mais que
 * a de 7. Prazo alterado vem logo depois porque invalida o planejamento que a
 * pessoa já fez; sair antes do prazo, idem. Encerrada fica no fim: é sinal de
 * parar, não de agir.
 */
const URGENCIA: Record<TipoMudanca, number> = {
  fechando: 0,
  prazo_alterado: 3,
  removida: 4,
  nova: 5,
  reaberta: 5,
  situacao_mudou: 6,
  encerrada: 7,
};

function urgencia(i: ItemCentral): number {
  if (i.tipo !== "fechando") return URGENCIA[i.tipo];
  return i.limiar === 1 ? 0 : i.limiar === 3 ? 1 : 2;
}

function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Urgência; depois o prazo mais próximo; depois a publicação mais recente. */
export function ordenarPorUrgencia(itens: readonly ItemCentral[]): ItemCentral[] {
  return [...itens].sort(
    (a, b) =>
      urgencia(a) - urgencia(b) ||
      comparar(a.fecha, b.fecha) ||
      comparar(b.publicado_em, a.publicado_em) ||
      comparar(a.id, b.id),
  );
}

export function filtrar(itens: readonly ItemCentral[], aba: Aba, tipos: readonly TipoMudanca[]): ItemCentral[] {
  return itens.filter((i) => {
    if (aba === "arquivadas") {
      if (!i.arquivada_em) return false;
    } else {
      if (i.arquivada_em) return false;
      if (aba === "nao_lidas" && i.lida_em) return false;
    }
    return tipos.length === 0 || tipos.includes(i.tipo);
  });
}

/** Contagem por tipo DENTRO da aba aberta — nunca sobre o conjunto inteiro. */
export function contarPorTipo(itens: readonly ItemCentral[], aba: Aba): Partial<Record<TipoMudanca, number>> {
  const contagem: Partial<Record<TipoMudanca, number>> = {};
  for (const i of filtrar(itens, aba, [])) contagem[i.tipo] = (contagem[i.tipo] ?? 0) + 1;
  return contagem;
}

export function contarNaoLidas(itens: readonly ItemCentral[]): number {
  return filtrar(itens, "nao_lidas", []).length;
}

/**
 * O radar grava `gerado_em` sem fuso, em UTC. Sem o "Z", o JavaScript leria como
 * hora local — e o mesmo instante mudaria conforme o navegador de quem abre.
 * A fração vem com seis dígitos; só os três primeiros são garantidos pelo formato.
 */
export function paraInstante(geradoEm: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(geradoEm);
  if (!m) return null;
  const fracao = m[2] ? m[2].slice(0, 4) : "";
  const d = new Date(`${m[1]}${fracao}${m[3] ?? "Z"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type Frescor = { estado: "fresco" | "velho"; horas: number } | { estado: "desconhecido" };

export function frescorDoDado(geradoEm: string | null | undefined, agora: Date): Frescor {
  if (!geradoEm) return { estado: "desconhecido" };
  const d = paraInstante(geradoEm);
  if (!d) return { estado: "desconhecido" };
  const horas = (agora.getTime() - d.getTime()) / 36e5;
  // Publicação "do futuro" é relógio torto. Não autoriza afirmar frescor.
  if (horas < 0) return { estado: "desconhecido" };
  return { estado: horas >= HORAS_DADO_VELHO ? "velho" : "fresco", horas };
}

/** "2026-09-14" → "14/09/2026". Data do contrato: sem hora, sem fuso, sem conversão. */
export function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const FORMATO_PUBLICACAO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Instante da publicação no horário de quem usa o painel (PB, sem horário de verão). */
export function formatarPublicacao(geradoEm: string): string {
  const d = paraInstante(geradoEm);
  if (!d) return "data desconhecida";
  const p = Object.fromEntries(FORMATO_PUBLICACAO.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
}

const DESCRICAO: Record<TipoMudanca, (i: ItemCentral) => string> = {
  // A marca cruzada fica no passado; a data absoluta ancora o que "faltam" quer
  // dizer. Contagem relativa sozinha envelhece mal com dado velho.
  fechando: (i) => `Faltam ${i.limiar} ${i.limiar === 1 ? "dia" : "dias"} ou menos · fecha em ${formatarData(i.fecha)}`,
  prazo_alterado: (i) => `Prazo mudou de ${formatarData(i.antes ?? "")} para ${formatarData(i.depois ?? i.fecha)}`,
  removida: (i) => `Saiu do catálogo antes do prazo, que era ${formatarData(i.fecha)}`,
  nova: (i) => `Fecha em ${formatarData(i.fecha)}`,
  reaberta: (i) => `Voltou a receber propostas · fecha em ${formatarData(i.fecha)}`,
  situacao_mudou: (i) => `Situação: ${i.antes || "sem registro"} → ${i.depois || "sem registro"}`,
  encerrada: (i) => `Encerrou em ${formatarData(i.fecha)}`,
};

export function descrever(i: ItemCentral): string {
  return DESCRICAO[i.tipo](i);
}

export interface MensagemVazio {
  titulo: string;
  texto: string;
  /** Se a mensagem afirma que não há nada a ver. Só pode ser `true` com dado fresco. */
  afirmaCalmaria: boolean;
}

export function mensagemVazio(p: {
  aba: Aba;
  filtrando: boolean;
  frescor: Frescor;
  publicadoEm: string | null;
}): MensagemVazio {
  if (p.aba === "arquivadas") {
    return { titulo: "Nenhuma notificação arquivada.", texto: "O que você arquivar fica guardado aqui.", afirmaCalmaria: false };
  }
  if (p.filtrando) {
    return { titulo: "Nenhuma notificação com esses filtros.", texto: "Remova um filtro para ver as demais.", afirmaCalmaria: false };
  }
  if (p.frescor.estado === "velho") {
    return {
      titulo: "Não foi possível verificar se há novidades.",
      texto:
        `A última publicação do catálogo é de ${formatarPublicacao(p.publicadoEm ?? "")}, há mais de ` +
        `${HORAS_DADO_VELHO} horas. Prazos podem ter mudado sem aparecer aqui.`,
      afirmaCalmaria: false,
    };
  }
  if (p.frescor.estado === "desconhecido") {
    return {
      titulo: "Não foi possível verificar se há novidades.",
      texto: "Não há registro confiável de quando o catálogo foi publicado pela última vez.",
      afirmaCalmaria: false,
    };
  }
  return {
    titulo: p.aba === "nao_lidas" ? "Nenhuma notificação por ler." : "Nenhuma mudança registrada.",
    texto: `Catálogo verificado em ${formatarPublicacao(p.publicadoEm ?? "")}.`,
    afirmaCalmaria: true,
  };
}
