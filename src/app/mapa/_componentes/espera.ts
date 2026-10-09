/**
 * A espera entre o clique e a página nova, em funções puras (onda 8, C, 09/10/2026), com teste em
 * `lib/oportunidades/espera-e-aviso.test.ts`. Sem import nenhum: vale no servidor (`Esqueleto`) e no cliente
 * (`Carregando`), e o Node roda o teste direto.
 *
 * 1. N22 da auditoria R1: o que a região de status única da moldura diz. Antes, cada link do Mapa levava a sua região
 *    `role="status"` (a aba Municípios da PB montava mais de 230), e o nome do link, durante a espera, virava "Patos
 *    carregando a página". Agora os links pendentes e os esqueletos dos `loading.tsx` só informam a moldura, e uma região
 *    só fala.
 * 2. N13 da auditoria R1: as abas que o esqueleto desenha, pelo nível de quem olha, sem ler a sessão.
 */

// ================================================================ N22: a região de status única

/** O que a região diz enquanto um link espera a página (o mesmo texto de antes, dentro de cada link). */
export const AVISO_DO_LINK = "carregando a página";

export interface EstadoDaEspera {
  /** Os links com navegação pendente (o `useId` de cada `Carregando`). */
  links: readonly string[];
  /** Os esqueletos montados, na ordem em que montaram, com o texto de cada um ("Carregando a página do município…"). */
  esqueletos: readonly { id: string; texto: string }[];
}

export const ESPERA_VAZIA: EstadoDaEspera = { links: [], esqueletos: [] };

/** Liga ou desliga um link pendente. Sem mudança, devolve o mesmo objeto: o React não renderiza de novo. */
export function marcarLink(e: EstadoDaEspera, id: string, pendente: boolean): EstadoDaEspera {
  const tem = e.links.includes(id);
  if (pendente === tem) return e;
  return { ...e, links: pendente ? [...e.links, id] : e.links.filter((x) => x !== id) };
}

/** Põe (texto) ou tira (null) o aviso de um esqueleto. Sem mudança, devolve o mesmo objeto. */
export function marcarEsqueleto(e: EstadoDaEspera, id: string, texto: string | null): EstadoDaEspera {
  const atual = e.esqueletos.find((x) => x.id === id);
  if (texto === null) return atual ? { ...e, esqueletos: e.esqueletos.filter((x) => x.id !== id) } : e;
  if (atual?.texto === texto) return e;
  const outros = e.esqueletos.filter((x) => x.id !== id);
  return { ...e, esqueletos: [...outros, { id, texto }] };
}

/**
 * O texto da região. O esqueleto vence o link: ele diz qual página vem ("Carregando a página do município…"), e o link
 * pendente costuma sair da tela no mesmo instante em que o esqueleto entra, o que troca um texto pelo outro de uma vez,
 * sem passar pelo vazio. Com dois esqueletos, fala o último que montou. Sem nada pendente, a região fica vazia, e a
 * página nova chega calada (quem anuncia a página é o título, N01).
 */
export function textoDaEspera(e: EstadoDaEspera): string {
  const ultimo = e.esqueletos[e.esqueletos.length - 1];
  if (ultimo) return ultimo.texto;
  return e.links.length > 0 ? AVISO_DO_LINK : "";
}

// ================================================================ N13: as abas do esqueleto pelo nível

/** O que o esqueleto precisa saber de cada aba: o nível mínimo, o mesmo das listas `ABAS_MUNICIPIO`, `ABAS_UF`… */
export interface AbaComNivel {
  minimo: number;
}

export interface AbaDoEsqueleto {
  /** Só quem tem cadastro vê: a versão pública esconde (`.mp-root[data-publico]`, esqueleto.css). */
  cadastro: boolean;
  /** A aba de entrada de quem tem cadastro: a primeira da lista. */
  entrada: boolean;
  /** A aba de entrada do público: a primeira que o nível 0 vê (o resumo, no município e na entidade). */
  entradaDoPublico: boolean;
}

/**
 * As abas do esqueleto. Com um número, são abas sem nível, todas à vista (o desenho de antes). Com a lista de abas da
 * página, cada uma leva o nível: o esqueleto do município desenha as 7 para quem tem cadastro e as 3 do público, sem
 * ler a sessão (o `loading.tsx` precisa sair na hora). A lista vem da própria página, então as duas nunca divergem.
 */
export function abasDoEsqueleto(abas: number | readonly AbaComNivel[]): AbaDoEsqueleto[] {
  const lista: readonly AbaComNivel[] = typeof abas === "number" ? Array.from({ length: Math.max(0, abas) }, () => ({ minimo: 0 })) : abas;
  const primeiraDoPublico = lista.findIndex((a) => a.minimo <= 0);
  return lista.map((a, i) => ({ cadastro: a.minimo > 0, entrada: i === 0, entradaDoPublico: i === primeiraDoPublico }));
}
