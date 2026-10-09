/**
 * O título da aba do navegador nas páginas do Mapa (onda 7, C, 09/10/2026; achado N01 da auditoria R1, WCAG 2.4.2).
 *
 * Era um só para as 27 UFs ("Estado · Mapa de Oportunidades · PONTE"), um só para todo convênio e toda proposta, e o
 * mesmo entre duas abas da mesma página. O anunciador de rota do Next só fala quando o título muda: de uma UF para
 * outra, ou de uma aba para outra, o leitor de tela não dizia nada depois de "carregando a página". Agora o título
 * leva o nome (a UF, o número) e a aba: "Paraíba (PB) · Dinheiro federal · Mapa de Oportunidades · PONTE".
 *
 * Só entra o que já está no endereço (a sigla, o número) ou em tabela fixa (o nome da UF, o nome da aba): o título não
 * lê o banco e não diz nada que a página não diga a quem a abre. A aba é a que a página abre de fato para aquele nível
 * (`abaDaUf`, `abaDoBrasil`), nunca a pedida no endereço: a aba de cadastro que o público pede cai no Resumo, e o
 * título também. Endereço que não vale (sigla que não existe, número com caractere estranho) fica com o título
 * genérico do tipo, sem repetir o que veio na URL. Funções puras, com teste.
 */
import { numeroValido } from "./busca.ts";
import { ABAS_BRASIL, type AbaBrasil } from "./pagina-brasil.ts";
import { ABAS_UF, NOME_UF, type AbaUf } from "./pagina-uf.ts";

/** O fim de todo título do Mapa: o mesmo do layout, para a aba do navegador dizer de onde é a página. */
export const SUFIXO_DO_TITULO = "Mapa de Oportunidades · PONTE";

/** As partes que existem, da mais específica para a mais geral, e o sufixo: "Patos (PB) · Resumo · Mapa … · PONTE". */
export function tituloDaPagina(...partes: (string | null | undefined)[]): string {
  return [...partes.filter((p): p is string => typeof p === "string" && p.trim() !== ""), SUFIXO_DO_TITULO].join(" · ");
}

/** A UF pela sigla já validada (`siglaDaUrl`) e a aba que a página abre. Sem sigla conhecida, o título genérico. */
export function tituloUf(sigla: string | null | undefined, aba: AbaUf | null | undefined): string {
  const nome = sigla && Object.hasOwn(NOME_UF, sigla) ? NOME_UF[sigla] : null;
  if (!sigla || !nome) return tituloDaPagina("Estado");
  return tituloDaPagina(`${nome} (${sigla})`, ABAS_UF.find((a) => a.id === aba)?.nome);
}

/** O Brasil e a aba que a página abre. */
export function tituloBrasil(aba: AbaBrasil | null | undefined): string {
  return tituloDaPagina("Brasil", ABAS_BRASIL.find((a) => a.id === aba)?.nome);
}

/** O convênio pelo número do endereço, só se ele é um número de convênio (`numeroValido`). */
export function tituloInstrumento(numero: string | null | undefined): string {
  return tituloDaPagina(numeroValido(numero ?? undefined) ? `Convênio nº ${numero}` : "Convênio");
}

/**
 * A proposta pelo id do SICONV que está no endereço. Sem "nº": o número que a pessoa conhece (`nr_proposta`) é outro,
 * e para tê-lo o título leria o banco; o rótulo da página de "não encontrado" já diz "Proposta <id>" do mesmo jeito.
 */
export function tituloProposta(id: string | null | undefined): string {
  return tituloDaPagina(id && /^\d{1,12}$/.test(id) ? `Proposta ${id}` : "Proposta");
}
