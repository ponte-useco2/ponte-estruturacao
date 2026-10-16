/**
 * A apresentação das telas das emendas estaduais (E2, 16/10/2026): as colunas das tabelas com filtro e ordem, os valores
 * crus (que filtram, ordenam e vão ao CSV) e os títulos das páginas. Funções puras, com teste; a lógica do dado é
 * `emendas-pb.ts`.
 *
 * Todas as telas são de administrador (até a revisão jurídica): toda coluna ordena. A ordem padrão da lista dos
 * deputados é o nome; ordenar por valor é leitura do administrador, não posição.
 */
import {
  ROTULO_MODALIDADE,
  ROTULO_PASSO,
  VEZ_DEPOIS,
  diasEntre,
  pct,
  type AnoDoDeputado,
  type CredorDestino,
  type DeputadoEpb,
  type DestinoEpb,
  type EmendaEpb,
  type ItemFila,
  type MunicipioDestino,
} from "./emendas-pb.ts";
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";
import { tituloDaPagina } from "./titulo-pagina.ts";

// ================================================================ títulos

export const tituloAssembleia = (parte?: string | null): string => tituloDaPagina(parte ?? null, "Assembleia (PB)", "Parlamentares");
/** Só o que está no endereço: o slug vira o nome em maiúsculas ("dr-erico" → "DR ERICO"), sem ler o banco. */
export const tituloDeputado = (slug: string | null): string => tituloAssembleia(slug ? slug.replace(/-/g, " ").toUpperCase() : "Deputado estadual");
export const tituloEmendaEpb = (emenda: string | null): string => tituloAssembleia(emenda ? `Emenda ${emenda}` : "Emenda estadual");

// ================================================================ células comuns

const simNao = (b: boolean): string => (b ? "Sim" : "Não");
/** O texto longo (objeto) na célula: até `max` caracteres, cortado na palavra, com reticências. O CSV leva o inteiro. */
export function resumir(texto: string | null | undefined, max = 160): string {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[\s,;.:]+$/, "")}…`;
}

/** "88,9%"; sem base, "—". */
export function porcento(x: number | null): string {
  return x === null ? "—" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

// ================================================================ a lista dos deputados

export const TABELA_DEPUTADOS = "alpb";

export const COLUNAS_DEPUTADOS: ColunaTabela[] = [
  { id: "deputado", titulo: "Deputado", tipo: "texto" },
  { id: "semente", titulo: "Na tabela curada", tipo: "categoria" },
  { id: "ano-inicial", titulo: "Ano inicial", tipo: "numero", alinhar: "direita" },
  { id: "ano-final", titulo: "Ano final", tipo: "numero", alinhar: "direita" },
  { id: "emendas", titulo: "Emendas", tipo: "numero", alinhar: "direita" },
  { id: "valor", titulo: "Valor das emendas", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "pct-pago", titulo: "Pago ÷ valor (%)", tipo: "numero", alinhar: "direita" },
  { id: "para-municipios", titulo: "A municípios", tipo: "numero", alinhar: "direita" },
  { id: "para-entidades", titulo: "A entidades", tipo: "numero", alinhar: "direita" },
  { id: "aplicacao-direta", titulo: "Aplicação direta", tipo: "numero", alinhar: "direita" },
  { id: "municipios", titulo: "Municípios atendidos", tipo: "numero", alinhar: "direita" },
  { id: "entidades", titulo: "Entidades credoras", tipo: "numero", alinhar: "direita" },
  { id: "no-caminho", titulo: "Ainda não pagas", tipo: "numero", alinhar: "direita" },
  { id: "devolvidas", titulo: "Com devolução", tipo: "numero", alinhar: "direita" },
  { id: "divergentes", titulo: "Autoria divergente", tipo: "numero", alinhar: "direita" },
];

export function valoresDoDeputado(d: DeputadoEpb): Record<string, ValorCelula> {
  return {
    deputado: d.pessoa,
    semente: simNao(!!d.fonte),
    "ano-inicial": d.anoMin,
    "ano-final": d.anoMax,
    emendas: d.emendas,
    valor: d.valor,
    empenhado: d.empenhado,
    pago: d.pago,
    "pct-pago": pct(d.pago, d.valor),
    "para-municipios": d.porModalidade.municipios,
    "para-entidades": d.porModalidade.entidades,
    "aplicacao-direta": d.porModalidade.direta,
    municipios: d.municipios,
    entidades: d.entidades,
    "no-caminho": d.noCaminho,
    devolvidas: d.devolvidas,
    divergentes: d.divergentes,
  };
}

// ================================================================ a fila do ciclo

export const TABELA_FILA = "alpb-fila";

export const COLUNAS_FILA: ColunaTabela[] = [
  { id: "emenda", titulo: "Emenda", tipo: "texto", textoNoCsv: true },
  { id: "ano", titulo: "Ano", tipo: "numero", alinhar: "direita" },
  { id: "deputado", titulo: "Deputado", tipo: "texto" },
  { id: "passo", titulo: "Onde está", tipo: "categoria" },
  { id: "desde", titulo: "Desde", tipo: "data", alinhar: "direita" },
  { id: "dias", titulo: "Dias no passo", tipo: "numero", alinhar: "direita" },
  { id: "vez", titulo: "Vez de", tipo: "categoria" },
  { id: "valor", titulo: "Valor", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "falta-pagar", titulo: "Empenhado sem pagar", tipo: "numero", alinhar: "direita" },
  { id: "modalidade", titulo: "Modalidade", tipo: "categoria" },
  { id: "secretaria", titulo: "Secretaria", tipo: "texto" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  { id: "devolvida", titulo: "Com devolução", tipo: "categoria" },
];

export function valoresDaFila(i: ItemFila): Record<string, ValorCelula> {
  return {
    emenda: i.emenda,
    ano: i.ano,
    deputado: i.pessoa,
    passo: ROTULO_PASSO[i.passo],
    desde: i.passoEm,
    dias: i.dias,
    vez: i.vez ?? "—",
    valor: i.valor,
    empenhado: i.empenhado,
    "falta-pagar": i.faltaPagar,
    modalidade: i.noCatalogo ? ROTULO_MODALIDADE[i.modalidade] : "Sem catálogo",
    secretaria: i.secretaria,
    objeto: i.objeto,
    devolvida: simNao(i.devolvida),
  };
}

// ================================================================ a ficha do deputado

export const TABELA_ANOS_DEPUTADO = "alpb-anos";

export const COLUNAS_ANOS_DEPUTADO: ColunaTabela[] = [
  { id: "ano", titulo: "Ano da emenda", tipo: "numero", alinhar: "direita" },
  { id: "emendas", titulo: "Emendas", tipo: "numero", alinhar: "direita" },
  { id: "valor", titulo: "Valor", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "pct", titulo: "Pago ÷ valor (%)", tipo: "numero", alinhar: "direita" },
  { id: "pct-assembleia", titulo: "Assembleia na safra (%)", tipo: "numero", alinhar: "direita" },
  { id: "no-caminho", titulo: "Ainda não pagas", tipo: "numero", alinhar: "direita" },
];

export function valoresDoAno(a: AnoDoDeputado): Record<string, ValorCelula> {
  return {
    ano: a.ano,
    emendas: a.emendas,
    valor: a.valor,
    empenhado: a.empenhado,
    pago: a.pago,
    pct: a.pctPago,
    "pct-assembleia": a.pctPagoAssembleia,
    "no-caminho": a.noCaminho,
  };
}

export const TABELA_EMENDAS_DEPUTADO = "alpb-emendas";

export const COLUNAS_EMENDAS: ColunaTabela[] = [
  { id: "emenda", titulo: "Emenda", tipo: "texto", textoNoCsv: true },
  { id: "ano", titulo: "Ano", tipo: "numero", alinhar: "direita" },
  { id: "tipo", titulo: "Tipo", tipo: "categoria" },
  { id: "modalidade", titulo: "Modalidade", tipo: "categoria" },
  { id: "secretaria", titulo: "Secretaria", tipo: "texto" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  { id: "valor", titulo: "Valor", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "passo", titulo: "Onde está", tipo: "categoria" },
  { id: "dias", titulo: "Dias no passo", tipo: "numero", alinhar: "direita" },
  { id: "devolvida", titulo: "Com devolução", tipo: "categoria" },
];

export function valoresDaEmenda(e: EmendaEpb, hoje: string): Record<string, ValorCelula> {
  return {
    emenda: e.emenda,
    ano: e.ano,
    tipo: e.tipo ?? "—",
    modalidade: e.noCatalogo ? ROTULO_MODALIDADE[e.modalidade] : "Sem catálogo",
    secretaria: e.secretaria,
    objeto: e.objeto,
    valor: e.valor,
    empenhado: e.empenhado,
    pago: e.pago,
    passo: e.temFicha ? ROTULO_PASSO[e.passo] : "Sem ficha",
    dias: e.temFicha && e.passo !== "paga" ? diasEntre(e.passoEm, hoje) : null,
    devolvida: simNao(e.devolvida),
  };
}

export const TABELA_MUNICIPIOS_DEPUTADO = "alpb-mun";

export const COLUNAS_MUNICIPIOS: ColunaTabela[] = [
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "ibge", titulo: "IBGE", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "emendas", titulo: "Emendas", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
];

export function valoresDoMunicipio(m: MunicipioDestino): Record<string, ValorCelula> {
  return { municipio: m.municipio, ibge: m.ibge, emendas: m.emendas, empenhado: m.empenhado, pago: m.pago };
}

export const TABELA_CREDORES_DEPUTADO = "alpb-cred";

export const COLUNAS_CREDORES: ColunaTabela[] = [
  { id: "credor", titulo: "Credor (pessoa jurídica)", tipo: "texto" },
  { id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true },
  { id: "municipio", titulo: "Município do credor", tipo: "texto" },
  { id: "modalidade", titulo: "Modalidade", tipo: "categoria" },
  { id: "emendas", titulo: "Emendas", tipo: "numero", alinhar: "direita" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
];

export function valoresDoCredor(c: CredorDestino): Record<string, ValorCelula> {
  return {
    credor: c.nome ?? c.cnpj,
    cnpj: c.cnpj,
    municipio: c.municipio,
    modalidade: ROTULO_MODALIDADE[c.modalidade],
    emendas: c.emendas,
    empenhado: c.empenhado,
    pago: c.pago,
  };
}

// ================================================================ a página da emenda

export const TABELA_DESTINO_EMENDA = "alpb-dest";

export const COLUNAS_DESTINO_EMENDA: ColunaTabela[] = [
  { id: "credor", titulo: "Credor (pessoa jurídica)", tipo: "texto" },
  { id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true },
  { id: "municipio", titulo: "Município do credor", tipo: "texto" },
  { id: "orgao", titulo: "Órgão do empenho", tipo: "texto" },
  { id: "empenhado", titulo: "Empenhado", tipo: "numero", alinhar: "direita" },
  { id: "liquidado", titulo: "Liquidado", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "notas", titulo: "Notas de empenho", tipo: "numero", alinhar: "direita" },
  { id: "primeira", titulo: "Primeiro empenho", tipo: "data", alinhar: "direita" },
  { id: "ultima", titulo: "Último empenho", tipo: "data", alinhar: "direita" },
];

export function valoresDoDestino(d: DestinoEpb): Record<string, ValorCelula> {
  return {
    credor: d.credor_nome ?? d.credor_cnpj,
    cnpj: d.credor_cnpj,
    municipio: d.municipio,
    orgao: d.orgao,
    empenhado: d.empenhado,
    liquidado: d.liquidado,
    pago: d.pago,
    notas: d.notas,
    primeira: d.primeira,
    ultima: d.ultima,
  };
}

// ================================================================ o lugar (município e entidade)

export const TABELA_EPB_MUNICIPIO = "alpb-mun-pub";
export const TABELA_EPB_ENTIDADES_MUNICIPIO = "alpb-mun-ent";
export const TABELA_EPB_ENTIDADE = "alpb-ent";

export const COLUNAS_EMENDAS_DO_LUGAR: ColunaTabela[] = [
  { id: "emenda", titulo: "Emenda", tipo: "texto", textoNoCsv: true },
  { id: "ano", titulo: "Ano", tipo: "numero", alinhar: "direita" },
  { id: "deputado", titulo: "Deputado", tipo: "texto" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  { id: "empenhado", titulo: "Empenhado aqui", tipo: "numero", alinhar: "direita" },
  { id: "pago", titulo: "Pago aqui", tipo: "numero", alinhar: "direita" },
  { id: "passo", titulo: "Onde está", tipo: "categoria" },
];

export function valoresDaEmendaNoLugar(e: EmendaEpb & { empenhadoAqui: number; pagoAqui: number }): Record<string, ValorCelula> {
  return {
    emenda: e.emenda,
    ano: e.ano,
    deputado: e.pessoa,
    objeto: e.objeto,
    empenhado: e.empenhadoAqui,
    pago: e.pagoAqui,
    passo: e.temFicha ? ROTULO_PASSO[e.passo] : "Sem ficha",
  };
}

/** A vez em texto, para a emenda que ainda não está paga e tem a data do último passo. */
export function vezDaEmenda(e: Pick<EmendaEpb, "temFicha" | "passo" | "passoEm">): string | null {
  return e.temFicha && e.passoEm && e.passo !== "paga" ? VEZ_DEPOIS[e.passo] : null;
}
