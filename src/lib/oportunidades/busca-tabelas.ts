/**
 * As listas da busca como tabelas com filtro e ordem em cada coluna (onda 15, fase 3, F3.5b, 28/10/2026). Puro, com
 * teste; as células ficam em `app/mapa/busca/BuscaConteudo.tsx`.
 *
 * Convênios e propostas vão ao banco pelas funções v2 da `oport_51`: o estado da tabela (o do endereço) vira os
 * parâmetros delas (`parametrosDaTabela`). As organizações vão pelo tradutor (`tabela-banco.ts`) sobre `osc_entidade`.
 * O formulário de cima (termo, UF, município, tema, situação) continua escolhendo o universo; a tabela filtra dentro dele.
 *
 * A busca é para quem tem cadastro (não é tela pública): toda coluna ordena. É também a porta da raspagem: quem não
 * administra navega até `RESULTADOS_NAVEGAVEIS` resultados (`tetoDePaginas`); o total é sempre dito.
 */
import { GRUPOS_SITUACAO } from "./busca.ts";
import { ROTULO_AREA, ROTULO_NATUREZA } from "./osc.ts";
import { ROTULO_DESFECHO } from "./painel.ts";
import type { CamposBanco } from "./tabela-banco.ts";
import { padraoContem } from "./tabela-banco.ts";
import { gravarEstado, lerEstado, normalizarTexto, type ColunaTabela, type EstadoTabela, type FiltroColuna } from "./tabela-filtro.ts";

export const TABELA_BUSCA_CONVENIOS = "busca-convenios";
export const TABELA_BUSCA_PROPOSTAS = "busca-propostas";
export const TABELA_BUSCA_ORGANIZACOES = "busca-organizacoes";

/** A coluna da estrela: só desenho (sem filtro, sem ordem, fora do CSV). */
const SEGUIR: ColunaTabela = { id: "seguir", titulo: "Seguir", tipo: "texto", filtravel: false, ordenavel: false, semCsv: true };
const num = (titulo: string, id: string, oculta = false): ColunaTabela => ({ id, titulo, tipo: "numero", alinhar: "direita", ...(oculta ? { oculta } : {}) });
const oculta = (id: string, titulo: string, tipo: ColunaTabela["tipo"] = "texto"): ColunaTabela => ({ id, titulo, tipo, oculta: true });

/** As situações do convênio que a busca conhece (as dos grupos), em ordem: as opções da coluna. */
export const SITUACOES_CONVENIO: readonly string[] = GRUPOS_SITUACAO.flatMap((g) => g.situacoes);

export function colunasDosConvenios(comSeguir: boolean): ColunaTabela[] {
  return [
    { id: "numero", titulo: "Convênio", tipo: "texto", textoNoCsv: true },
    ...(comSeguir ? [SEGUIR] : []),
    { id: "proponente", titulo: "Proponente", tipo: "texto" },
    { id: "programa", titulo: "Programa e objeto", tipo: "texto" },
    { id: "situacao", titulo: "Situação", tipo: "categoria" },
    num("Repasse", "repasse"),
    oculta("municipio", "Município"),
    oculta("objeto", "Objeto"),
    oculta("orgao", "Órgão"),
    oculta("assinatura", "Assinatura", "data"),
    num("Desembolsado", "desembolsado", true),
  ];
}

export function colunasDasPropostas(comSeguir: boolean): ColunaTabela[] {
  return [
    { id: "numero", titulo: "Proposta", tipo: "texto", textoNoCsv: true },
    ...(comSeguir ? [SEGUIR] : []),
    { id: "proponente", titulo: "Proponente", tipo: "texto" },
    { id: "programa", titulo: "Programa e objeto", tipo: "texto" },
    { id: "desfecho", titulo: "Desfecho", tipo: "categoria" },
    num("Repasse pedido", "repasse"),
    oculta("municipio", "Município"),
    oculta("objeto", "Objeto"),
    oculta("orgao", "Órgão"),
    oculta("envio", "Enviada", "data"),
  ];
}

/** As opções das categorias, que o servidor conhece sem ler o banco. */
export const OPCOES_CONVENIOS = { situacao: SITUACOES_CONVENIO.map((valor) => ({ valor, linhas: null })) };
export const OPCOES_PROPOSTAS = { desfecho: [...new Set(Object.values(ROTULO_DESFECHO))].map((valor) => ({ valor, linhas: null })) };

/** O estado de cada tabela da busca, lido do endereço (a página lê o da aba). */
export function estadoDaBusca(aba: "instrumentos" | "propostas" | "organizacoes", parametros: URLSearchParams): EstadoTabela {
  if (aba === "instrumentos") return lerEstado(TABELA_BUSCA_CONVENIOS, colunasDosConvenios(true), parametros);
  if (aba === "propostas") return lerEstado(TABELA_BUSCA_PROPOSTAS, colunasDasPropostas(true), parametros);
  return lerEstado(TABELA_BUSCA_ORGANIZACOES, COLUNAS_ORGANIZACOES, parametros);
}

const TABELA_DA_ABA = { instrumentos: TABELA_BUSCA_CONVENIOS, propostas: TABELA_BUSCA_PROPOSTAS, organizacoes: TABELA_BUSCA_ORGANIZACOES } as const;

/** Um endereço da busca (a página seguinte, a anterior) com o filtro e a ordem da tabela da aba junto. */
export function urlComTabela(url: string, aba: "instrumentos" | "propostas" | "organizacoes", estado: EstadoTabela): string {
  const [caminho, consulta = ""] = url.split("?");
  const q = gravarEstado(TABELA_DA_ABA[aba], estado, new URLSearchParams(consulta)).toString();
  return q ? `${caminho}?${q}` : caminho;
}

/** As palavras do filtro de texto como padrões `like` (sem acento, minúsculas, curingas escapados); vazio: null. */
function padroes(f: FiltroColuna | undefined): string[] | null {
  if (!f || f.tipo !== "texto") return null;
  const p = normalizarTexto(f.contem).split(" ").filter(Boolean).map(padraoContem);
  return p.length ? p : null;
}

const faixa = (f: FiltroColuna | undefined, tipo: "numero" | "data") =>
  f && f.tipo === tipo ? { de: f.de, ate: f.ate } : { de: null, ate: null };

/** Os desfechos (códigos) dos rótulos marcados; um rótulo pode valer vários códigos (cancelada e anulada). */
function desfechosDosRotulos(rotulos: string[]): string[] {
  const alvo = new Set(rotulos.map(normalizarTexto));
  return Object.entries(ROTULO_DESFECHO)
    .filter(([, r]) => alvo.has(normalizarTexto(r)))
    .map(([codigo]) => codigo);
}

/** As colunas que as funções v2 sabem ordenar (o mesmo nome da coluna da tela). */
const ORDENAVEIS: Readonly<Record<"instrumentos" | "propostas", readonly string[]>> = {
  instrumentos: ["numero", "proponente", "municipio", "programa", "orgao", "situacao", "assinatura", "repasse", "desembolsado"],
  propostas: ["numero", "proponente", "municipio", "programa", "orgao", "desfecho", "envio", "repasse"],
};

/**
 * O estado da tabela como os parâmetros da função v2 (`oport_51`). Só entram os filtros ativos: o resto vai como null,
 * que a função lê como "sem filtro". Categoria marcada que não existe (um rótulo velho no endereço) vira uma lista que
 * não acha nada, como na tela.
 */
export function parametrosDaTabela(aba: "instrumentos" | "propostas", estado: EstadoTabela): Record<string, unknown> {
  const f = estado.filtros;
  const valor = faixa(f.repasse, "numero");
  const data = faixa(aba === "instrumentos" ? f.assinatura : f.envio, "data");
  const ordem = estado.ordem && ORDENAVEIS[aba].includes(estado.ordem.coluna) ? estado.ordem : null;
  const comuns: Record<string, unknown> = {
    p_numero: padroes(f.numero),
    p_proponente: padroes(f.proponente),
    p_municipio: padroes(f.municipio),
    p_programa: padroes(f.programa),
    p_objeto: padroes(f.objeto),
    p_orgao_texto: padroes(f.orgao),
    p_repasse_de: valor.de,
    p_repasse_ate: valor.ate,
    p_data_de: data.de,
    p_data_ate: data.ate,
    p_ordem: ordem?.coluna ?? null,
    p_crescente: ordem?.sentido === "asc",
  };
  if (aba === "instrumentos") {
    const desemb = faixa(f.desembolsado, "numero");
    const sit = f.situacao;
    return {
      ...comuns,
      p_marcadas: sit?.tipo === "categoria" && sit.valores.length ? sit.valores : null,
      p_desemb_de: desemb.de,
      p_desemb_ate: desemb.ate,
    };
  }
  const des = f.desfecho;
  const marcados = des?.tipo === "categoria" && des.valores.length ? desfechosDosRotulos(des.valores) : null;
  return { ...comuns, p_marcados: marcados === null ? null : marcados.length ? marcados : ["(nenhum)"] };
}

// ================================================================ o teto de páginas (a porta da raspagem)

/** Quantos resultados quem não administra percorre página a página: 34 páginas de 30. */
export const RESULTADOS_NAVEGAVEIS = 1_020;

/** A última página que a pessoa pode abrir: o administrador vai até o teto da função (10 mil); os outros, até 34. */
export function tetoDePaginas(porPagina: number, administrador: boolean, paginaMaxima: number): number {
  return administrador ? paginaMaxima : Math.min(paginaMaxima, Math.ceil(RESULTADOS_NAVEGAVEIS / porPagina));
}

// ================================================================ as organizações (pelo tradutor, sem migração)

export const COLUNAS_ORGANIZACOES: ColunaTabela[] = [
  { id: "organizacao", titulo: "Organização", tipo: "texto" },
  { id: "natureza", titulo: "Natureza e área", tipo: "categoria" },
  { id: "situacao", titulo: "Situação", tipo: "categoria" },
  oculta("cnpj", "CNPJ"),
  oculta("municipio", "Município"),
  oculta("area", "Área", "categoria"),
];

const ATIVA = "Ativa na Receita";
const NAO_ATIVA = "Não ativa (ou fora do Mapa)";
export const OPCOES_ORGANIZACOES = {
  natureza: Object.values(ROTULO_NATUREZA).map((valor) => ({ valor, linhas: null })),
  situacao: [ATIVA, NAO_ATIVA].map((valor) => ({ valor, linhas: null })),
  area: Object.values(ROTULO_AREA).map((valor) => ({ valor, linhas: null })),
};
export const rotuloSituacaoOsc = (ativa: boolean) => (ativa ? ATIVA : NAO_ATIVA);

/** As áreas marcadas como `areas.ov.{…}` (a lista do cadastro tem alguma delas); nenhuma conhecida: nada passa. */
function areasNoBanco(f: FiltroColuna): string | null {
  if (f.tipo !== "categoria" || !f.valores.length) return null;
  const alvo = new Set(f.valores.map(normalizarTexto));
  const chaves = Object.entries(ROTULO_AREA)
    .filter(([, r]) => alvo.has(normalizarTexto(r)))
    .map(([k]) => k);
  return chaves.length ? `areas.ov.{${chaves.join(",")}}` : "cnpj.is.null";
}

const inverso = (m: Readonly<Record<string, string>>) => Object.fromEntries(Object.entries(m).map(([v, r]) => [r, v]));

/** Cada coluna das organizações em `osc_entidade`; o nome e o CNPJ pelo `texto_busca` (já sem acento). */
export const CAMPOS_ORGANIZACAO: CamposBanco = {
  organizacao: { coluna: "razao_social", busca: "texto_busca" },
  natureza: { coluna: "natureza_juridica", valores: inverso(ROTULO_NATUREZA) },
  situacao: { coluna: "ativa", valores: { [ATIVA]: "true", [NAO_ATIVA]: "false" } },
  cnpj: { coluna: "cnpj" },
  municipio: { coluna: "municipio", curinga: true },
  area: { coluna: "areas", especial: areasNoBanco },
};

/** A ordem de sempre: as ativas primeiro, depois o nome e o CNPJ. */
export const ORDEM_ORGANIZACOES = [
  { coluna: "ativa", ascendente: false },
  { coluna: "razao_social", ascendente: true },
  { coluna: "cnpj", ascendente: true },
] as const;
