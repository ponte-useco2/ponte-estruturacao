/**
 * A página do município em abas (F1 da revisão da navegação, decisões de 06/10/2026): um endereço,
 * `/mapa/municipio/[ibge]`, no lugar das telas espalhadas (ficha do painel, investimentos, relatório, fiscal,
 * TCE-PB). O que cada nível de acesso vê segue a decisão D1:
 *   0 público · 1 cadastrado (aprovado) · 2 cliente (o próprio município) · 3 administrador.
 * Na F1a a página continua atrás do portão de aprovados, então o nível mínimo de quem chega é 1; o público
 * entra na F1d. Função pura, sem banco.
 */

export type NivelAcesso = 0 | 1 | 2 | 3;

export type AbaMunicipio = "trava" | "resumo" | "dinheiro" | "contas" | "controle" | "indicadores" | "relatorio";

export const ABAS_MUNICIPIO: readonly { id: AbaMunicipio; nome: string; minimo: NivelAcesso }[] = [
  { id: "trava", nome: "O que trava e o que destrava", minimo: 1 },
  { id: "resumo", nome: "Resumo", minimo: 0 },
  { id: "dinheiro", nome: "Dinheiro federal", minimo: 0 },
  { id: "contas", nome: "Contas públicas", minimo: 1 },
  { id: "controle", nome: "Controle", minimo: 1 },
  { id: "indicadores", nome: "Indicadores", minimo: 0 },
  { id: "relatorio", nome: "Relatório e dados", minimo: 1 },
];

export function nivelDeAcesso(v: { aprovado: boolean; administrador: boolean; clienteDoMunicipio: boolean }): NivelAcesso {
  if (!v.aprovado) return 0;
  if (v.administrador) return 3;
  return v.clienteDoMunicipio ? 2 : 1;
}

/** A aba que abre: a pedida, se existe e o nível alcança; senão a de entrada (o que trava, ou o resumo para o público). */
export function abaEscolhida(pedida: string | string[] | undefined, nivel: NivelAcesso): AbaMunicipio {
  const p = Array.isArray(pedida) ? pedida[0] : pedida;
  const aba = ABAS_MUNICIPIO.find((a) => a.id === p);
  if (aba && nivel >= aba.minimo) return aba.id;
  return nivel >= 1 ? "trava" : "resumo";
}

export function urlMunicipio(ibge: string, aba?: AbaMunicipio): string {
  return `/mapa/municipio/${encodeURIComponent(ibge)}${aba && aba !== "trava" ? `?aba=${aba}` : ""}`;
}

/** O que cada nível alcança dentro das abas. */
export const PODE = {
  /** O laudo do convênio: o cliente vê o dos instrumentos do próprio município; o cadastrado vai à página do instrumento. */
  laudo: (n: NivelAcesso) => n >= 2,
  simulador: (n: NivelAcesso) => n >= 2,
  /** Fornecedor com nome, processos nominais e os painéis dos 223. */
  interno: (n: NivelAcesso) => n >= 3,
};

/** "/mapa/instrumento/942082/laudo" para quem pode o laudo; "/mapa/instrumento/942082" para os outros. */
export function destinoConvenio(nivel: NivelAcesso): (nr: string) => string {
  return PODE.laudo(nivel) ? (nr) => `/mapa/instrumento/${nr}/laudo` : (nr) => `/mapa/instrumento/${nr}`;
}
