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

/**
 * O nome das abas que se repetem nos 4 níveis do território — Brasil, UF, município e entidade (B11, 08/10/2026;
 * achado H08 da auditoria B1+B2). A mesma coisa tinha dois nomes: "Dinheiro federal" no município e "Dinheiro" nos
 * outros três. Fica "Dinheiro federal" em todos: é o que a aba mostra em qualquer nível (convênios, emendas, Pix,
 * fundo a fundo e o dinheiro federal nas despesas do TCE-PB), e no município ela fica ao lado de "Contas públicas",
 * que é o dinheiro do próprio município. As listas dos outros níveis (`ABAS_UF`, `ABAS_BRASIL`, `ABAS_ENTIDADE`) leem
 * o nome daqui, para não voltarem a divergir.
 */
export const NOME_ABA = {
  trava: "O que trava e o que destrava",
  resumo: "Resumo",
  dinheiro: "Dinheiro federal",
  controle: "Controle",
  relatorio: "Relatório e dados",
} as const;

/**
 * A ordem das abas em qualquer nível (B11): as comuns sempre na mesma posição relativa — a fila, o resumo, o dinheiro,
 * o controle e, por último, o relatório — e as próprias de cada nível entre elas (as unidades de baixo logo depois do
 * resumo; contas, indicadores e tempos depois do dinheiro). O teste confere as quatro listas contra esta.
 */
export const ORDEM_DAS_ABAS: readonly string[] = [
  "trava",
  "resumo",
  "estados",
  "municipios",
  "estado",
  "instrumentos",
  "dinheiro",
  "contas",
  "controle",
  "indicadores",
  "tempos",
  "relatorio",
];

export const ABAS_MUNICIPIO: readonly { id: AbaMunicipio; nome: string; minimo: NivelAcesso }[] = [
  { id: "trava", nome: NOME_ABA.trava, minimo: 1 },
  { id: "resumo", nome: NOME_ABA.resumo, minimo: 0 },
  { id: "dinheiro", nome: NOME_ABA.dinheiro, minimo: 0 },
  { id: "contas", nome: "Contas públicas", minimo: 1 },
  { id: "controle", nome: NOME_ABA.controle, minimo: 1 },
  { id: "indicadores", nome: "Indicadores", minimo: 0 },
  { id: "relatorio", nome: NOME_ABA.relatorio, minimo: 1 },
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
