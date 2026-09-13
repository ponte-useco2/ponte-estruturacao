/**
 * Consulta pública de programas do Transferegov.
 *
 * O sistema de origem não tem URL por programa: é POST com sessão. O painel
 * público resolve do mesmo jeito — abre a consulta e a pessoa procura o
 * programa.
 *
 * Mora aqui desde 12/09/2026, quando o catálogo (`/mapa`) passou a precisar do
 * mesmo endereço que a central (`/mapa/avisos`) já usava. Dois componentes com
 * a mesma URL colada é o jeito de um dos dois ficar com o endereço velho.
 */
export const TRANSFEREGOV_CONSULTA =
  "https://discricionarias.transferegov.sistema.gov.br/voluntarias/ForwardAction.do?modulo=programa&path=/ConsultarPrograma/ConsultarPrograma.do&Usr=guest&Pwd=guest";
