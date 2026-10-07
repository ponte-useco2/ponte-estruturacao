/**
 * A fila do município (F1b, 07/10/2026): UMA regra para a aba "o que trava", a carteira e o "Em uma página" do
 * relatório, para as três telas nunca discordarem (decisão de design de 06/10/2026).
 *
 * Primeiro o que impede receber dinheiro novo (bloqueio legal ou financeiro), depois o que pode virar cobrança ao
 * município ou ao gestor (TCE, prestação vencida, dinheiro parado em conta), depois os prazos e, por fim, o que só
 * pede atenção. Dentro da classe: o prazo mais próximo (o vencido primeiro), depois o nível, depois o peso. O que
 * está em dia vai sempre por último.
 *
 * Cada ponto diz também quem resolve: o município, o órgão federal, o Tribunal, a Justiça, o autor da emenda ou terceiros. Função pura.
 */
export type ClasseFila = "bloqueio" | "cobranca" | "prazo" | "atencao";
export type QuemResolve = "municipio" | "entidade" | "orgao" | "tribunal" | "justica" | "autor" | "outro";

export const ORDEM_CLASSE: Record<ClasseFila, number> = { bloqueio: 0, cobranca: 1, prazo: 2, atencao: 3 };

export const ROTULO_CLASSE: Record<ClasseFila, string> = {
  bloqueio: "Trava dinheiro novo",
  cobranca: "Pode virar cobrança",
  prazo: "Tem prazo",
  atencao: "Pede atenção",
};

export const EXPLICA_CLASSE: Record<ClasseFila, string> = {
  bloqueio: "Enquanto isso não se resolve, o município não recebe transferência voluntária nem contrata crédito.",
  cobranca: "Pode virar devolução de dinheiro, Tomada de Contas Especial ou responsabilização do gestor.",
  prazo: "Tem data para acontecer; passado o prazo, o dinheiro ou a oportunidade se perdem.",
  atencao: "Não trava nada agora, mas vale acompanhar.",
};

export const ROTULO_QUEM: Record<QuemResolve, string> = {
  municipio: "o município",
  entidade: "a própria entidade",
  orgao: "o órgão federal",
  tribunal: "o Tribunal",
  justica: "a Justiça",
  autor: "o autor da emenda",
  outro: "terceiros",
};

const ORDEM_NIVEL: Record<string, number> = { critico: 0, alto: 1, moderado: 2, informativo: 3, em_dia: 4 };

export interface ItemFila {
  classe?: ClasseFila;
  nivel: string;
  /** AAAA-MM-DD; quanto mais perto (ou vencido), mais à frente dentro da classe. */
  prazo?: string | null;
  /** Desempate final, quando a classe, o prazo e o nível empatam. */
  peso?: number;
}

const classeNum = (x: ItemFila) => (x.nivel === "em_dia" ? 9 : ORDEM_CLASSE[x.classe ?? "atencao"]);

/** O comparador da fila. Ordenação estável: o que empata em tudo mantém a ordem de chegada. */
export function compararFila(a: ItemFila, b: ItemFila): number {
  return (
    classeNum(a) - classeNum(b) ||
    (a.prazo ?? "9999-12-31").localeCompare(b.prazo ?? "9999-12-31") ||
    (ORDEM_NIVEL[a.nivel] ?? 3) - (ORDEM_NIVEL[b.nivel] ?? 3) ||
    (a.peso ?? 0) - (b.peso ?? 0)
  );
}

/** Os itens agrupados por classe, na ordem da fila (para a aba "o que trava"). O que está em dia fica fora. */
export function grupos<T extends ItemFila>(itens: T[]): { classe: ClasseFila; itens: T[] }[] {
  const ordenados = [...itens].filter((x) => x.nivel !== "em_dia").sort(compararFila);
  const out: { classe: ClasseFila; itens: T[] }[] = [];
  for (const x of ordenados) {
    const c = x.classe ?? "atencao";
    const g = out.find((y) => y.classe === c);
    if (g) g.itens.push(x);
    else out.push({ classe: c, itens: [x] });
  }
  return out;
}
