/**
 * Um aviso por vez no pé da janela (onda 8, C, 09/10/2026; N20 da auditoria R1, WCAG 2.4.11 como referência).
 *
 * A estrela (`EstrelaSeguir`) e "Marcar como lidas" (`carteira/MarcarLidas`) têm cada uma o seu aviso com "Desfazer", no
 * mesmo lugar fixo (estrela.css). Na carteira, deixar de seguir um item e marcar as mudanças como lidas em menos de 10 s
 * punha os dois avisos um sobre o outro: o de baixo ficava coberto, com o "Desfazer" fora de alcance.
 *
 * Quem publica toma a vez, e o aviso que estava à vista fecha. Fica o mais novo, que é o da ação que a pessoa acabou de
 * fazer (o mesmo critério das barras de aviso: uma por vez, a nova substitui a velha). Esperar o velho fechar atrasaria
 * a confirmação do gesto feito agora. Puro, sem React, com teste em `lib/oportunidades/espera-e-aviso.test.ts`.
 */

let daVez: (() => void) | null = null;

/** Quem vai mostrar um aviso chama isto antes, com a função que fecha o próprio aviso; o aviso de outro fecha. */
export function tomarAVez(fechar: () => void): void {
  const anterior = daVez;
  daVez = fechar;
  if (anterior && anterior !== fechar) anterior();
}

/** Quem fechou o próprio aviso devolve a vez (sem efeito se a vez já é de outro). */
export function largarAVez(fechar: () => void): void {
  if (daVez === fechar) daVez = null;
}
