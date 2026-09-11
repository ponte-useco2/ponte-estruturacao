/**
 * Diferença entre duas publicações do catálogo de oportunidades.
 *
 * É a matéria-prima da central de notificações — e ela NÃO vem dos campos
 * `nova` e `encerradas` do contrato. Esses campos comparam com a execução
 * anterior do RADAR, não com o que este sistema processou por último: se o
 * radar roda duas vezes sem o site sincronizar entre elas, a novidade some.
 * Foi o que aconteceu em 10/09/2026 — 17 janelas marcadas como novas às 16:33
 * viraram 0 nas duas execuções seguintes, sem nenhuma mudança real no
 * catálogo. Aqui a diferença é calculada contra o último estado processado.
 *
 * Tudo é puro: sem banco, rede ou relógio. Garantir que a mesma mudança não
 * vire duas notificações quando a gravação roda de novo é trabalho dos índices
 * únicos da camada de persistência. Daqui se promete que a mesma entrada
 * produz sempre a mesma saída, e que reprocessar uma publicação já vista não
 * produz nada.
 *
 * Regra do contrato respeitada: `dias_restantes` é usado como publicado, nunca
 * recalculado a partir de `fecha`.
 */
import type { Oportunidade, Payload } from "./contrato";

/** Marcas de prazo que geram aviso, em dias restantes. */
export const LIMIARES = [7, 3, 1] as const;

export type TipoMudanca =
  | "nova"
  | "reaberta"
  | "prazo_alterado"
  | "fechando"
  | "situacao_mudou"
  | "encerrada"
  | "removida";

export interface Mudanca {
  tipo: TipoMudanca;
  chave: string;
  programa: string;
  orgao: string;
  /** Data de fechamento vigente — a nova, em `prazo_alterado`. ISO AAAA-MM-DD. */
  fecha: string;
  /** Só em `fechando`: qual marca foi cruzada. */
  limiar?: number;
  /** Só em `prazo_alterado` e `situacao_mudou`. */
  antes?: string;
  depois?: string;
}

/** O recorte de uma janela que precisa sobreviver de uma publicação para a outra. */
export interface JanelaMemoria {
  programa: string;
  orgao: string;
  fecha: string;
  dias_restantes: number;
  situacao: string;
}

/** O que o sistema processou por último. `null` antes da primeira execução. */
export interface EstadoProcessado {
  gerado_em: string;
  abertas: Record<string, JanelaMemoria>;
  /**
   * Chaves que já estiveram abertas e saíram. Sem isso não existe "reaberta".
   *
   * Inclui as que saíram antes do prazo. Se uma delas voltar, chamá-la de
   * "reaberta" é impreciso — talvez ela nunca tenha fechado —, mas é menos
   * errado do que anunciá-la como janela nova.
   */
  saidas: string[];
}

export interface ResultadoDiff {
  mudancas: Mudanca[];
  proximoEstado: EstadoProcessado;
  /** Primeira execução: registra o catálogo como está e não notifica ninguém. */
  linhaDeBase: boolean;
  /** Algo nesta publicação merece desconfiança antes de virar notificação. */
  suspeita: string | null;
}

/**
 * Identidade estável de uma janela.
 *
 * Não é o `id` do contrato, porque ele inclui a data de fechamento: uma
 * prorrogação apareceria como uma janela encerrada e outra nova. Nas 12
 * publicações entre 19/08 e 11/09/2026 isso teria acontecido 4 vezes.
 *
 * `canal` + `natureza` + códigos teve zero colisões nessas mesmas publicações.
 * Os códigos são ordenados porque a posição no array não carrega significado.
 */
export function chaveJanela(o: Pick<Oportunidade, "canal" | "natureza" | "codigos">): string {
  return `${o.canal}|${o.natureza}|${[...o.codigos].sort().join(",")}`;
}

function abertasDe(payload: Pick<Payload, "gerado_em" | "oportunidades">): Record<string, JanelaMemoria> {
  const abertas: Record<string, JanelaMemoria> = {};
  for (const o of payload.oportunidades) {
    const chave = chaveJanela(o);
    // Colisão significa que a identidade deixou de ser única — o contrato
    // mudou. Sobrescrever em silêncio faria uma janela sumir do diff sem
    // ninguém saber; é melhor não produzir diff nenhum.
    if (Object.hasOwn(abertas, chave)) {
      throw new Error(`Chave de janela duplicada na publicação ${payload.gerado_em}: ${chave}`);
    }
    abertas[chave] = {
      programa: o.programa,
      orgao: o.orgao,
      fecha: o.fecha,
      dias_restantes: o.dias_restantes,
      situacao: o.situacao ?? "",
    };
  }
  return abertas;
}

const ORDEM: Record<TipoMudanca, number> = {
  nova: 0,
  reaberta: 1,
  prazo_alterado: 2,
  fechando: 3,
  situacao_mudou: 4,
  encerrada: 5,
  removida: 6,
};

/**
 * Ordem estável, só para que a mesma entrada produza sempre a mesma saída.
 * Apresentar por urgência é decisão da tela, não daqui.
 */
function ordenar(a: Mudanca, b: Mudanca): number {
  if (a.chave !== b.chave) return a.chave < b.chave ? -1 : 1;
  if (a.tipo !== b.tipo) return ORDEM[a.tipo] - ORDEM[b.tipo];
  return (b.limiar ?? 0) - (a.limiar ?? 0);
}

export function calcularDiff(
  anterior: EstadoProcessado | null,
  atual: Pick<Payload, "gerado_em" | "oportunidades">,
): ResultadoDiff {
  const abertas = abertasDe(atual);

  if (anterior === null) {
    return {
      mudancas: [],
      proximoEstado: { gerado_em: atual.gerado_em, abertas, saidas: [] },
      linhaDeBase: true,
      suspeita: null,
    };
  }

  // Publicação já processada, ou mais antiga que a última. Diferenciar para
  // trás produziria mudanças invertidas: encerramentos virariam janelas novas.
  if (atual.gerado_em <= anterior.gerado_em) {
    return { mudancas: [], proximoEstado: anterior, linhaDeBase: false, suspeita: null };
  }

  // O radar grava `gerado_em` sem fuso. Tomar a data como está erra, no máximo,
  // para o lado seguro: faz uma janela parecer vencida um pouco antes, nunca
  // faz uma janela vencida parecer removida antes do prazo.
  const dia = atual.gerado_em.slice(0, 10);
  const saidas = new Set(anterior.saidas);
  const mudancas: Mudanca[] = [];
  let removidas = 0;

  for (const [chave, j] of Object.entries(abertas)) {
    const antes = anterior.abertas[chave];
    const base = { chave, programa: j.programa, orgao: j.orgao, fecha: j.fecha };

    if (!antes) {
      // Janela que já chega perto do prazo gera só "nova": nenhum cruzamento de
      // marca foi observado, e dois avisos para a mesma novidade seriam ruído.
      mudancas.push({ ...base, tipo: saidas.has(chave) ? "reaberta" : "nova" });
      saidas.delete(chave);
      continue;
    }

    if (antes.fecha !== j.fecha) {
      // Com prazo novo a contagem de dias recomeça. Comparar através da troca
      // inventaria cruzamentos de marca que não aconteceram.
      mudancas.push({ ...base, tipo: "prazo_alterado", antes: antes.fecha, depois: j.fecha });
    } else {
      for (const limiar of LIMIARES) {
        // Uma mudança por marca cruzada. Um salto de 8 para 2 dias — radar
        // parado por alguns dias — cruza 7 e 3, e gera as duas.
        if (antes.dias_restantes > limiar && j.dias_restantes <= limiar) {
          mudancas.push({ ...base, tipo: "fechando", limiar });
        }
      }
    }

    if (antes.situacao !== j.situacao) {
      mudancas.push({ ...base, tipo: "situacao_mudou", antes: antes.situacao, depois: j.situacao });
    }
  }

  for (const [chave, j] of Object.entries(anterior.abertas)) {
    if (Object.hasOwn(abertas, chave)) continue;
    saidas.add(chave);
    const base = { chave, programa: j.programa, orgao: j.orgao, fecha: j.fecha };
    // Queda de volume, sozinha, NÃO é sinal de problema: em 07/09/2026 sumiram
    // 15 janelas num dia, e todas tinham fechado no prazo. O que separa
    // encerramento de falha é a data: sair no prazo é esperado; sair antes
    // dele é cancelamento ou dado quebrado, e ganha nome próprio.
    if (j.fecha <= dia) {
      mudancas.push({ ...base, tipo: "encerrada" });
    } else {
      mudancas.push({ ...base, tipo: "removida" });
      removidas++;
    }
  }

  mudancas.sort(ordenar);

  return {
    mudancas,
    proximoEstado: { gerado_em: atual.gerado_em, abertas, saidas: [...saidas].sort() },
    linhaDeBase: false,
    suspeita: removidas > 0 ? `${removidas} janela(s) saíram do catálogo antes do prazo` : null,
  };
}
