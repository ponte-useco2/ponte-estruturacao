/**
 * Rascunho do Formulário de Perfil Institucional, guardado no navegador.
 *
 * Por que `localStorage` e não `sessionStorage`: o formulário tem dez blocos e
 * pede coisas que a pessoa quase nunca tem à mão (receita dos três últimos
 * exercícios, nº dos convênios, CPF da diretoria inteira). O preenchimento
 * acontece em várias sessões, muitas vezes depois de uma ida ao contador — um
 * rascunho que morre ao fechar a aba seria inútil aqui.
 *
 * Nada disso sai do navegador: não há envio para servidor. O fecho é manual,
 * pelo botão "Copiar respostas".
 *
 * A leitura é exposta por `useSyncExternalStore`, seguindo o mesmo desenho de
 * `plataforma/app/_lib/sessao.tsx`: storage é fonte externa, e o React sabe ler
 * fonte externa sem `useEffect` + `setState` (que renderiza em cascata e é
 * barrado pelo lint). O snapshot de servidor é o objeto vazio, então o HTML
 * hidratado bate com o que o servidor produziu e o rascunho entra logo depois.
 */

import { ENTRADAS } from "./campos";

/**
 * Chave herdada do protótipo do Claude Design. Mantida idêntica para não
 * descartar o que alguém já tenha digitado numa versão anterior do link.
 * Virar `-v2` é o caminho se a lista de campos mudar a ponto de invalidar o
 * que está salvo.
 */
const CHAVE = "ponte-perfil-osc-v1";

export type Respostas = Record<string, string | boolean>;

/** Nomes válidos: filtra lixo e campos que deixaram de existir. */
const NOMES = new Set(ENTRADAS.map((e) => e.nome));

/**
 * Referência estável para "nenhuma resposta". `getSnapshot` precisa devolver a
 * MESMA referência enquanto nada mudar — um `{}` novo a cada chamada põe o
 * React em laço de renderização.
 */
const VAZIO: Respostas = Object.freeze({}) as Respostas;

let cache: Respostas = VAZIO;
let lido = false;
const ouvintes = new Set<() => void>();

function ler(): Respostas {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE) || "{}") as unknown;
    if (!bruto || typeof bruto !== "object") return VAZIO;
    const limpo: Respostas = {};
    for (const [nome, valor] of Object.entries(bruto as Record<string, unknown>)) {
      if (!NOMES.has(nome)) continue;
      if (typeof valor === "string" || typeof valor === "boolean") limpo[nome] = valor;
    }
    return limpo;
  } catch {
    // Rascunho corrompido ou storage bloqueado: começa em branco. Perder o
    // rascunho é ruim; travar a página inteira por causa dele é pior.
    return VAZIO;
  }
}

function publicar(proximas: Respostas) {
  cache = proximas;
  lido = true;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(proximas));
  } catch {
    // Modo privado ou cota estourada: o preenchimento continua em memória, só
    // não sobrevive ao recarregamento.
  }
  ouvintes.forEach((f) => f());
}

export function inscrever(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

export function snapshot(): Respostas {
  if (!lido) {
    cache = ler();
    lido = true;
  }
  return cache;
}

export function snapshotServidor(): Respostas {
  return VAZIO;
}

export function definir(nome: string, valor: string | boolean) {
  publicar({ ...snapshot(), [nome]: valor });
}

export function limparTudo() {
  publicar({});
}
