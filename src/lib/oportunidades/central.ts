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

/**
 * O universo do catálogo, para a tela poder falar do que NÃO virou aviso.
 *
 * "Nenhuma notificação por ler" sem isto lê como "nada acontecendo"; com isto,
 * a tela diz que as janelas abertas continuam lá.
 */
export interface ResumoCatalogo {
  total: number;
  /** Janelas que fecham dentro do primeiro corte de prazo. */
  fecham7: number;
  /** Data do corte de 7 dias, em AAAA-MM-DD. */
  ate: string;
  /** Janelas sem tema declarado na fonte — explica os zeros do seletor. */
  semTema: number;
}

export interface GrupoPrazo {
  id: string;
  titulo: string;
  itens: ItemCentral[];
  naoLidas: number;
  /** O grupo mais longo nasce recolhido: é o maior e o menos urgente. */
  recolhido: boolean;
}

/** Cortes de prazo, em dias. Os dois primeiros espelham as marcas que geram aviso. */
export const CORTES_PRAZO = [7, 30, 90] as const;

function somaDias(agora: Date, dias: number): string {
  const d = new Date(agora.getTime());
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Agrupa por prazo, preservando a ordem recebida dentro de cada grupo.
 *
 * A faixa relativa nomeia o grupo ("em até 7 dias") e a data absoluta o define
 * ("até 18/09/2026") — contagem relativa sozinha erra quando o dado é de ontem.
 * Grupo vazio não aparece: cabeçalho sem item é ruído.
 */
export function agruparPorPrazo(itens: ItemCentral[], agora: Date): GrupoPrazo[] {
  const [c7, c30, c90] = CORTES_PRAZO.map((d) => somaDias(agora, d));
  const grupos: GrupoPrazo[] = [
    { id: "ate7", titulo: `Fecha em até 7 dias · até ${formatarData(c7)}`, itens: [], naoLidas: 0, recolhido: false },
    { id: "ate30", titulo: `Fecha em 8 a 30 dias · até ${formatarData(c30)}`, itens: [], naoLidas: 0, recolhido: false },
    { id: "ate90", titulo: `Fecha em 31 a 90 dias · até ${formatarData(c90)}`, itens: [], naoLidas: 0, recolhido: false },
    { id: "depois", titulo: `Fecha depois de ${formatarData(c90)}`, itens: [], naoLidas: 0, recolhido: true },
  ];

  for (const i of itens) {
    const g = i.fecha <= c7 ? grupos[0] : i.fecha <= c30 ? grupos[1] : i.fecha <= c90 ? grupos[2] : grupos[3];
    g.itens.push(i);
    if (!i.lida_em) g.naoLidas += 1;
  }

  return grupos.filter((g) => g.itens.length > 0);
}

/**
 * Códigos do programa, tirados da chave `canal|natureza|códigos`.
 *
 * O Transferegov não tem endereço por programa — é sistema com POST e sessão.
 * O caminho honesto é copiar o código e abrir a consulta, como o painel público
 * já faz.
 */
export function codigosDaChave(chave: string): string[] {
  const partes = chave.split("|");
  if (partes.length < 3) return [];
  return partes[2].split(",").map((c) => c.trim()).filter(Boolean);
}

/**
 * Onde entra a divisória "desde a sua última visita".
 *
 * Devolve o índice do primeiro item publicado ANTES da visita anterior — ou
 * `null` quando a divisória não ajudaria: sem visita anterior, com tudo novo,
 * ou com tudo velho. Régua no topo ou no rodapé da lista é enfeite.
 */
export function indiceDivisor(itens: ItemCentral[], visitaAnterior: string | null): number | null {
  if (!visitaAnterior) return null;

  const corte = paraInstante(visitaAnterior);
  if (corte === null) return null;

  const antesDaVisita = (i: ItemCentral) => {
    const t = paraInstante(i.publicado_em);
    return t !== null && t < corte;
  };

  const indice = itens.findIndex(antesDaVisita);
  if (indice <= 0) return null;
  return indice;
}
