/**
 * Itens de laudo que o job grava prontos — estado, nível, fato e dispositivo de cada regra: o laudo do Pix
 * (`pix_laudo_plano.itens`, onda 13A) e a execução do convênio pela PC 33 (`painel_instrumento.pc33_itens`,
 * onda 13B). As regras moram no job; aqui só rótulos, cor e ordem.
 *
 * Redação: "não atendido" aparece como "a conferir", nunca "irregular"; falta de dado é "não verificável".
 * Função pura, sem banco e sem relógio.
 */

export type EstadoItem = "atendido" | "nao_atendido" | "informativo" | "pendente" | "legado" | "nao_verificavel" | "nao_se_aplica";
export type NivelItem = "critico" | "alto" | "moderado";

export interface ItemLaudo {
  item: string;
  titulo: string;
  dispositivo: string;
  estado: EstadoItem;
  nivel: NivelItem | null;
  fato: string;
}

export const ROTULO_ESTADO: Record<EstadoItem, string> = {
  atendido: "atendido",
  nao_atendido: "a conferir",
  informativo: "informação",
  pendente: "no prazo",
  legado: "legado",
  nao_verificavel: "não verificável",
  nao_se_aplica: "não se aplica",
};

export const ROTULO_NIVEL: Record<NivelItem, string> = { critico: "crítico", alto: "alto", moderado: "moderado" };

const PESO_NIVEL: Record<NivelItem, number> = { critico: 0, alto: 1, moderado: 2 };

/** Os pontos a conferir, do mais grave ao mais leve, na ordem do catálogo dentro do mesmo nível. */
export function pontosAConferir<T extends Pick<ItemLaudo, "estado" | "nivel">>(itens: T[]): T[] {
  return itens
    .map((i, k) => ({ i, k }))
    .filter(({ i }) => i.estado === "nao_atendido" && i.nivel)
    .sort((a, b) => PESO_NIVEL[a.i.nivel as NivelItem] - PESO_NIVEL[b.i.nivel as NivelItem] || a.k - b.k)
    .map(({ i }) => i);
}

/** Classe de cor do estado (as mesmas etiquetas `mp-laudo-*` do laudo). */
export function classeEstado(i: Pick<ItemLaudo, "estado" | "nivel">): string {
  if (i.estado === "nao_atendido" && i.nivel) return `mp-laudo-${i.nivel}`;
  if (i.estado === "atendido") return "mp-laudo-atendido";
  return "mp-laudo-informativo";
}

export function rotuloItem(i: Pick<ItemLaudo, "estado" | "nivel">): string {
  if (i.estado === "nao_atendido" && i.nivel) return `a conferir · ${ROTULO_NIVEL[i.nivel]}`;
  return ROTULO_ESTADO[i.estado];
}
