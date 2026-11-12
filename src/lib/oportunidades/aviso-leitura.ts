/**
 * O aviso fixo de leitura automática, numa redação só (D1, lote 5, A39 e A62, 12/11/2026).
 *
 * As regras 1 e 4 do dicionário dos sinais (D0, entrega 3) pedem que toda tela com sinal diga duas coisas no mesmo
 * lugar: que cada número é a posição de uma fonte numa data, e que «a conferir» é ponto para olhar, nunca
 * irregularidade. Até a rodada 2 da D1 havia quatro redações nos relatórios (município e entidade diziam as duas;
 * UF só a primeira; Brasil nenhuma) e cinco telas sem aviso (painel, ficha, Pix, radar, primeira infância). Aqui fica a
 * frase comum; cada tela só acrescenta o que é dela (a cobertura fora da PB, o uso interno, a versão do cliente).
 */

/** A frase comum: a posição numa data e «a conferir» como ponto para olhar. */
export const AVISO_LEITURA =
  "Leitura automática de fontes públicas pela PONTE, cada uma com a sua data{DATAS}. «A conferir» é ponto para olhar, nunca " +
  "irregularidade; não substitui certidão, parecer do concedente, decisão do Tribunal de Contas nem orientação jurídica.";

export interface OpcoesAviso {
  /** "Uso interno da PONTE." na frente (nível 3). */
  interno?: boolean;
  /** As datas de cada fonte estão no fim da página (relatórios para imprimir). */
  datasNoFim?: boolean;
  /** Frase própria da tela, antes da comum (ex.: a versão para a organização do cliente). */
  antes?: string;
  /** Frase própria da tela, depois da comum (ex.: a cobertura fora da Paraíba). */
  depois?: string;
}

/** O aviso de uma tela: a frase comum com o que é só dela. */
export function avisoLeitura(o: OpcoesAviso = {}): string {
  const comum = AVISO_LEITURA.replace("{DATAS}", o.datasNoFim ? " (ver o fim)" : "");
  return [o.interno ? "Uso interno da PONTE." : null, o.antes?.trim() || null, comum, o.depois?.trim() || null]
    .filter(Boolean)
    .join(" ");
}
