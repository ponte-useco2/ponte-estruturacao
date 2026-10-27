/**
 * As molas e a cascata do Mapa (onda 16, 27/10/2026): os números do movimento num lugar só, para o mapa, os
 * instrumentos, os gráficos e o relatório falarem a mesma língua. O Framer Motion lê estes objetos como `transition`.
 *
 * Mola em vez de duração fixa: o elemento chega com massa e assenta, em vez de parar seco. Os valores foram escolhidos
 * para assentar em cerca de 0,3 a 0,5 s, sem quicar além de um leve passo (o `pin` quica de propósito, é pequeno).
 * Puro, com teste (`molas.test.ts`).
 */

export const MOLA = {
  /** Cartões, painéis, seções do relatório: chega e assenta sem quicar. */
  suave: { type: "spring", stiffness: 260, damping: 30, mass: 1 },
  /** Realce de área no mapa, sublinhado de aba: resposta rápida ao dedo. */
  firme: { type: "spring", stiffness: 420, damping: 34, mass: 0.9 },
  /** Marcadores e números pequenos: um leve quique, que só cabe em coisa pequena. */
  pin: { type: "spring", stiffness: 520, damping: 22, mass: 0.8 },
  /** Barras dos gráficos e da execução: crescem e assentam devagar o bastante para o olho seguir. */
  barra: { type: "spring", stiffness: 140, damping: 22, mass: 1 },
} as const;

/** O passo da cascata entre um item e o próximo, em segundos. */
export const PASSO_DA_CASCATA = 0.045;

/**
 * Depois de quantos itens a cascata para de esperar. Uma lista de 200 instrumentos não pode levar 9 s para aparecer: do
 * 12º em diante, todos entram juntos com o último atraso.
 */
export const TETO_DA_CASCATA = 12;

/** O atraso do item `i` (a partir de 0) na cascata, com teto. */
export function atrasoDaCascata(i: number, passo = PASSO_DA_CASCATA, teto = TETO_DA_CASCATA): number {
  if (!Number.isFinite(i) || i <= 0) return 0;
  return Math.round(Math.min(Math.floor(i), teto) * passo * 1000) / 1000;
}

/** A cascata para os `variants` de um contêiner: o Framer Motion espera `staggerChildren` e `delayChildren`. */
export function cascata(atrasoInicial = 0.04, passo = PASSO_DA_CASCATA) {
  return { staggerChildren: passo, delayChildren: atrasoInicial } as const;
}

/**
 * A curva de uma mola amostrada para o CSS (`animation-timing-function: linear(...)`), com a duração até assentar. Serve
 * para as barras que vêm prontas do servidor (dezenas por página): crescem com a física da mesma mola do Framer Motion,
 * sem virar componente de cliente. Integração do oscilador amortecido de 0 a 1 (massa, rigidez, amortecimento), passo
 * de 1 ms, até ficar a menos de 0,1% do alvo e quase parado.
 */
export function curvaDaMola(mola: { stiffness: number; damping: number; mass: number }, amostras = 32): { duracaoMs: number; linear: string } {
  const dt = 0.001;
  let x = 0;
  let v = 0;
  const serie: number[] = [0];
  let t = 0;
  while (t < 5) {
    const a = (-mola.stiffness * (x - 1) - mola.damping * v) / mola.mass;
    v += a * dt;
    x += v * dt;
    t += dt;
    serie.push(x);
    if (t > 0.05 && Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01) break;
  }
  const n = serie.length - 1;
  const pontos: string[] = [];
  for (let i = 0; i <= amostras; i++) {
    const valor = i === amostras ? 1 : serie[Math.round((i / amostras) * n)];
    pontos.push(String(Math.round(valor * 1000) / 1000));
  }
  return { duracaoMs: Math.round(n * dt * 1000), linear: `linear(${pontos.join(", ")})` };
}
