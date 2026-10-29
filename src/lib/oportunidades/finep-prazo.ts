/**
 * O prazo da rodada da Subvenção Econômica Regional da FINEP que o formulário de `/finep-subvencao` atende (A1-01 da
 * investigação do portal, 29/10/2026). A página dizia "prazo final: 07 de abril de 2026 até às 18h" e seguia aceitando
 * envio sete meses depois. Agora a página e a action leem daqui: passado o prazo, a página avisa e não mostra o
 * formulário, e a action recusa o envio que chegar mesmo assim.
 *
 * Rodada nova: trocar `PRAZO_FINEP_SUBVENCAO` (e o texto da rodada), e a página volta a abrir sozinha.
 */
export const RODADA_FINEP_SUBVENCAO = "Rodada 2";

/** 07/04/2026 às 18h de Brasília (UTC−3). */
export const PRAZO_FINEP_SUBVENCAO = "2026-04-07T18:00:00-03:00";

export function finepSubvencaoAberta(agora: Date = new Date(), prazo: string = PRAZO_FINEP_SUBVENCAO): boolean {
  return agora.getTime() <= Date.parse(prazo);
}
