/**
 * A apresentação das telas das emendas da Câmara de João Pessoa (J2, 16/10/2026): as colunas das tabelas com filtro e
 * ordem, os valores crus (que filtram, ordenam e vão ao CSV) e os títulos. Funções puras, com teste; a lógica do dado
 * é `emendas-jp.ts`.
 *
 * As telas são de administrador: toda coluna ordena. A lista dos vereadores abre por nome; ordenar por valor é leitura,
 * não posição.
 */
import {
  ROTULO_COMO,
  ROTULO_ETAPA,
  ROTULO_PONTO,
  pct,
  type CredorEjp,
  type EmendaDaEntidade,
  type EmendaJp,
  type EmpenhoEjp,
  type MovimentoEjp,
  type PontoParaOlhar,
  type VereadorJp,
} from "./emendas-jp.ts";
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";
import { tituloDaPagina } from "./titulo-pagina.ts";

// ================================================================ títulos

export const tituloCamaraJp = (parte?: string | null): string => tituloDaPagina(parte ?? null, "Câmara de João Pessoa", "Parlamentares");
/** Só o que está no endereço: o slug vira o nome em maiúsculas, sem ler o banco. */
export const tituloVereadorJp = (slug: string | null): string => tituloCamaraJp(slug ? slug.replace(/-/g, " ").toUpperCase() : "Vereador");
export const tituloEmendaJp = (ano: number | null, codigo: number | null): string =>
  tituloCamaraJp(ano && codigo !== null ? `Emenda ${codigo}/${ano}` : "Emenda municipal");

/** "88,9%"; sem base, "—". */
export function porcento(x: number | null): string {
  return x === null ? "—" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

const origem = (e: Pick<EmendaJp, "origem" | "mesReferencia">) => (e.origem === "painel" ? "Painel (diário)" : `Portal (${(e.mesReferencia ?? "—").toLowerCase()})`);

// ================================================================ a lista dos vereadores

export const TABELA_VEREADORES_JP = "cjp";

export const COLUNAS_VEREADORES_JP: ColunaTabela[] = [
  { id: "vereador", titulo: "Vereador ou colegiado", tipo: "texto" },
  { id: "tipo", titulo: "Tipo", tipo: "categoria" },
  { id: "ano-inicial", titulo: "Ano inicial", tipo: "numero", alinhar: "direita" },
  { id: "ano-final", titulo: "Ano final", tipo: "numero", alinhar: "direita" },
  { id: "emendas", titulo: "Emendas (2021 em diante)", tipo: "numero", alinhar: "direita" },
  { id: "atual", titulo: "Valor atual", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "pct-pago", titulo: "Pago ÷ atual (%)", tipo: "numero", alinhar: "direita" },
  { id: "exercicio-emendas", titulo: "Emendas no exercício", tipo: "numero", alinhar: "direita" },
  { id: "exercicio-atual", titulo: "Valor atual no exercício", tipo: "numero", alinhar: "direita" },
  { id: "exercicio-pago", titulo: "Pago no exercício", tipo: "numero", alinhar: "direita" },
  { id: "exercicio-sem-empenho", titulo: "Sem empenho no exercício", tipo: "numero", alinhar: "direita" },
];

export function valoresDoVereadorJp(v: VereadorJp): Record<string, ValorCelula> {
  return {
    vereador: v.pessoa,
    tipo: v.tipo === "colegiado" ? "Colegiado" : "Vereador",
    "ano-inicial": v.anoMin,
    "ano-final": v.anoMax,
    emendas: v.emendas,
    atual: v.atual,
    empenhado: v.empenhado,
    pago: v.pago,
    "pct-pago": pct(v.pago, v.atual),
    "exercicio-emendas": v.exercicioEmendas,
    "exercicio-atual": v.exercicioAtual,
    "exercicio-pago": v.exercicioPago,
    "exercicio-sem-empenho": v.exercicioSemEmpenho,
  };
}

// ================================================================ a fila da execução

export const TABELA_FILA_JP = "cjp-fila";

export const COLUNAS_FILA_JP: ColunaTabela[] = [
  { id: "emenda", titulo: "Emenda", tipo: "numero", alinhar: "direita" },
  { id: "vereador", titulo: "Vereador", tipo: "texto" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  { id: "unidade", titulo: "Unidade gestora", tipo: "categoria" },
  { id: "etapa", titulo: "Etapa", tipo: "categoria" },
  { id: "atual", titulo: "Valor atual", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "liquidado", titulo: "Liquidado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "primeiro-empenho", titulo: "Primeiro empenho (TCE-PB)", tipo: "data" },
  { id: "cnpj", titulo: "Entidade citada pelo CNPJ", tipo: "categoria" },
];

export function valoresDaFilaJp(e: EmendaJp): Record<string, ValorCelula> {
  return {
    emenda: e.codigo,
    vereador: e.pessoa ?? e.autorPublicado ?? "—",
    objeto: e.objeto ?? "",
    unidade: e.unidades.join(" · "),
    etapa: ROTULO_ETAPA[e.etapa],
    atual: e.atual,
    empenhado: e.empenhado,
    liquidado: e.liquidado,
    pago: e.pago,
    "primeiro-empenho": e.primeiroEmpenho,
    cnpj: e.cnpj ? "Sim" : "Não",
  };
}

// ================================================================ as emendas de um vereador

export const TABELA_EMENDAS_VEREADOR_JP = "cjp-emendas";

export const COLUNAS_EMENDAS_VEREADOR_JP: ColunaTabela[] = [
  { id: "ano", titulo: "Ano", tipo: "numero", alinhar: "direita" },
  { id: "emenda", titulo: "Emenda", tipo: "numero", alinhar: "direita" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  { id: "unidade", titulo: "Unidade gestora", tipo: "categoria" },
  { id: "etapa", titulo: "Etapa", tipo: "categoria" },
  { id: "original", titulo: "Valor original", tipo: "numero", alinhar: "direita" },
  { id: "atual", titulo: "Valor atual", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "fonte", titulo: "Fonte", tipo: "categoria" },
];

export function valoresDaEmendaDoVereadorJp(e: EmendaJp): Record<string, ValorCelula> {
  return {
    ano: e.ano,
    emenda: e.codigo,
    objeto: e.objeto ?? "",
    unidade: e.unidades.join(" · "),
    etapa: ROTULO_ETAPA[e.etapa],
    original: e.original,
    atual: e.atual,
    empenhado: e.empenhado,
    pago: e.pago,
    fonte: origem(e),
  };
}

// ================================================================ os empenhos do TCE-PB de uma emenda

export const TABELA_EMPENHOS_JP = "cjp-emp";

export const COLUNAS_EMPENHOS_JP: ColunaTabela[] = [
  { id: "numero", titulo: "Empenho", tipo: "texto" },
  { id: "data", titulo: "Data", tipo: "data" },
  { id: "unidade", titulo: "Unidade gestora", tipo: "categoria" },
  { id: "credor", titulo: "Credor", tipo: "texto" },
  { id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "liquidado", titulo: "Liquidado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "elemento", titulo: "Elemento", tipo: "categoria" },
  { id: "licitacao", titulo: "Modalidade de licitação", tipo: "categoria" },
];

export function valoresDoEmpenhoJp(e: EmpenhoEjp): Record<string, ValorCelula> {
  return {
    numero: e.numero_empenho,
    data: e.data_empenho,
    unidade: e.ug_nome ?? e.ug_codigo,
    credor: e.credor_nome ?? "",
    cnpj: e.credor_cnpj,
    empenhado: e.empenhado,
    liquidado: e.liquidado,
    pago: e.pago,
    elemento: e.elemento ?? "—",
    licitacao: e.modalidade_licitacao ?? "—",
  };
}

// ================================================================ a entidade

export const TABELA_ENTIDADE_JP = "cjp-ent";

export const COLUNAS_ENTIDADE_JP: ColunaTabela[] = [
  { id: "ano", titulo: "Ano", tipo: "numero", alinhar: "direita" },
  { id: "emenda", titulo: "Emenda", tipo: "numero", alinhar: "direita" },
  { id: "vereador", titulo: "Vereador", tipo: "texto" },
  { id: "como", titulo: "Como aparece", tipo: "categoria" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  { id: "atual", titulo: "Valor atual da emenda", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago na emenda", tipo: "numero", alinhar: "direita" },
  { id: "empenhado-tce", titulo: "Empenhado a ela (TCE-PB)", tipo: "numero", alinhar: "direita" },
  { id: "etapa", titulo: "Etapa", tipo: "categoria" },
];

export function valoresDaEntidadeJp(x: EmendaDaEntidade): Record<string, ValorCelula> {
  return {
    ano: x.emenda.ano,
    emenda: x.emenda.codigo,
    vereador: x.emenda.pessoa ?? x.emenda.autorPublicado ?? "—",
    como: ROTULO_COMO[x.como],
    objeto: x.emenda.objeto ?? "",
    atual: x.emenda.atual,
    pago: x.emenda.pago,
    "empenhado-tce": x.empenhadoTce > 0 ? x.empenhadoTce : null,
    etapa: ROTULO_ETAPA[x.emenda.etapa],
  };
}

// ================================================================ os credores que o painel lista

export const TABELA_CREDORES_JP = "cjp-cred";

export const COLUNAS_CREDORES_JP: ColunaTabela[] = [
  { id: "credor", titulo: "Credor", tipo: "texto" },
  { id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true },
  { id: "unidade", titulo: "Unidade gestora", tipo: "categoria" },
  { id: "contratacao", titulo: "Forma de contratação", tipo: "categoria" },
  { id: "historico", titulo: "Histórico", tipo: "texto" },
];

export function valoresDoCredorJp(c: CredorEjp): Record<string, ValorCelula> {
  return {
    credor: c.credor_nome ?? c.credor_cnpj,
    cnpj: c.credor_cnpj,
    unidade: c.ug,
    contratacao: c.modalidade_licitacao ?? "—",
    historico: c.historico ?? "",
  };
}

// ================================================================ a série (o que mudou, rodada a rodada)

export const TABELA_SERIE_JP = "cjp-serie";

export const ROTULO_CAMPO_SERIE: Record<string, string> = {
  linha: "Linha (apareceu ou sumiu)",
  dotacao: "Valor atual",
  empenhado: "Empenhado",
  liquidado: "Liquidado",
  pago: "Pago",
  empenhos_n: "Empenhos listados no painel",
  pagamentos_n: "Pagamentos listados no painel",
};

export const COLUNAS_SERIE_JP: ColunaTabela[] = [
  { id: "dia", titulo: "Dia da leitura", tipo: "data" },
  { id: "unidade", titulo: "Unidade gestora", tipo: "categoria" },
  { id: "campo", titulo: "O que mudou", tipo: "categoria" },
  { id: "antes", titulo: "Antes", tipo: "numero", alinhar: "direita" },
  { id: "depois", titulo: "Depois", tipo: "numero", alinhar: "direita" },
];

export function valoresDaSerieJp(m: MovimentoEjp): Record<string, ValorCelula> {
  return { dia: m.referencia, unidade: m.ug, campo: ROTULO_CAMPO_SERIE[m.campo] ?? m.campo, antes: m.antes, depois: m.depois };
}

// ================================================================ os pontos para olhar (J3, 19/10/2026)

export const TABELA_PONTOS_JP = "cjp-pontos";

export const COLUNAS_PONTOS_JP: ColunaTabela[] = [
  { id: "ponto", titulo: "Ponto para olhar", tipo: "categoria" },
  { id: "ano", titulo: "Ano", tipo: "numero", alinhar: "direita" },
  { id: "emenda", titulo: "Emenda", tipo: "numero", alinhar: "direita" },
  { id: "vereador", titulo: "Vereador", tipo: "texto" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  { id: "atual", titulo: "Valor atual", tipo: "numero", alinhar: "direita" },
  { id: "detalhe", titulo: "O que se vê", tipo: "texto" },
];

export function valoresDoPontoJp(p: PontoParaOlhar): Record<string, ValorCelula> {
  return {
    ponto: ROTULO_PONTO[p.ponto],
    ano: p.emenda.ano,
    emenda: p.emenda.codigo,
    vereador: p.emenda.pessoa ?? p.emenda.autorPublicado ?? "—",
    objeto: p.emenda.objeto ?? "",
    atual: p.emenda.atual,
    detalhe: p.detalhe,
  };
}
