/**
 * "Combina com o que você acompanha" — a regra do destaque `aderente`.
 *
 * Decisão de 11/09/2026, em `docs/superpowers/specs/aderente-decisao-privacidade.md`:
 * vale só o que a pessoa MARCOU. Nada é deduzido do que ela abre, filtra ou
 * busca — é essa a diferença entre preferência e perfilamento, e é o que o
 * aviso de privacidade promete.
 *
 * O cálculo acontece na LEITURA da central, não na distribuição: quem muda as
 * preferências hoje vê o destaque mudar nos avisos de ontem, sem reprocessar
 * nada. É por isso que os eixos da janela viajam em `oport_mudanca`.
 *
 * Tudo puro: sem banco, sem rede, sem relógio.
 */
import { ROTULO_TEMA, temasDaJanela } from "./temas.ts";

export interface Preferencias {
  /** Ids de `temas.ts`, nunca os radicais do radar. */
  temas: string[];
  orgaos: string[];
  naturezas: string[];
}

export const PREFERENCIAS_VAZIAS: Preferencias = { temas: [], orgaos: [], naturezas: [] };

/** O que a janela tem de comparável com uma preferência. */
export interface EixosDaJanela {
  temas?: string[];
  orgao?: string;
  natureza?: string;
}

export function temPreferencia(p: Preferencias): boolean {
  return p.temas.length > 0 || p.orgaos.length > 0 || p.naturezas.length > 0;
}

/**
 * O que fez a janela combinar, em texto curto, ou `null` quando não combina.
 *
 * Devolver o motivo, e não só um sim ou não, é o que permite a tela dizer
 * "combina com Turismo" em vez de exibir um selo sem explicação. Selo sem
 * motivo vira enfeite, e ninguém confia no que não entende.
 *
 * Sem preferência nenhuma, nada combina: o destaque existe para separar o que
 * a pessoa escolheu do resto, e destacar tudo é o mesmo que não destacar nada.
 */
export function motivoDaCombinacao(janela: EixosDaJanela, p: Preferencias): string | null {
  if (!temPreferencia(p)) return null;

  const tema = temasDaJanela(janela.temas).find((t) => p.temas.includes(t));
  if (tema) return ROTULO_TEMA[tema];

  if (janela.orgao && p.orgaos.includes(janela.orgao)) return janela.orgao;
  if (janela.natureza && p.naturezas.includes(janela.natureza)) return janela.natureza;

  return null;
}

export function combina(janela: EixosDaJanela, p: Preferencias): boolean {
  return motivoDaCombinacao(janela, p) !== null;
}
