/**
 * Portal público das emendas parlamentares federais com destino à Paraíba (`/emendas`, 17/11/2026). Lógica pura: sem
 * banco e sem Next; a leitura mora em `emendas-publico.server.ts`, e o banco em `oport_67_emendas_publico.sql`.
 *
 * Especificação aprovada pelo titular em 17/11/2026: `Site-Ponte/transparencia-emendas/ESPEC-CONSTRUCAO.md`. O portal usa
 * a matriz do PNTP 2026 (critérios 17.1 e 17.3 e os da matriz comum que cabem num portal) como REFERÊNCIA de qualidade; a
 * PONTE não é jurisdicionada, o portal não é avaliado pelo programa e não tem selo.
 *
 * As regras que valem em toda tela e em todo arquivo (as da oport_39 e as decisões do titular):
 *   · a unidade da lista é a linha de canal não coberta (emenda × forma de repasse × instrumento);
 *   · o catálogo do Portal (execução orçamentária) e o canal nunca se somam; o catálogo só pelo recorte da PB;
 *   · "previsto" é o indicado pelo autor para aquele destino (o pagamento direto não tem); "realizado" é o pago;
 *   · pessoa física só somada; nenhum CPF; o microempreendedor individual (nome de pessoa na razão social) sai como
 *     "Microempreendedor individual (nome omitido)", com o CNPJ e os valores (regra do supervisor, 17/11/2026);
 *   · parlamentar, bancada e comissão são agentes públicos: o nome é o publicado; a autoria coletiva não tem "padrinho";
 *   · textos neutros ("não consta registro"); sem "melhor" e "pior"; ordem padrão alfabética, sem ranking. A pessoa pode
 *     ordenar por valor (decisão 5 do plano: aqui, ao contrário das telas públicas do Mapa, toda coluna ordena);
 *   · "caducou" é factual: "Proposta não assinada até 31/12/(ano da emenda + 1)".
 */
import { paraCsv, type ColunaCsv } from "./csv.ts";
import { dataBrasilia, diaBrasilia } from "./datas.ts";
import { ROTULO_ENTE_TIPO, type CanalEmenda, type EnteTipoEmenda, type TipoAutor } from "./emendas.ts";
import { padraoContem } from "./tabela-banco.ts";
import { gravarEstado, lerEstado, normalizarTexto, type ColunaTabela, type EstadoTabela, type ValorCelula } from "./tabela-filtro.ts";

export type { CanalEmenda, EnteTipoEmenda, TipoAutor } from "./emendas.ts";
export { ROTULO_ENTE_TIPO };

// ================================================================ tipos (as colunas das funções `emd_pub_*`)

export type TipoEmenda = "individual_finalidade" | "individual_especial" | "bancada" | "comissao" | "relator" | "outro";
export type EtapaPublica =
  | "proposta"
  | "assinatura"
  | "suspensiva"
  | "execucao"
  | "contas"
  | "concluido"
  | "extinto"
  | "caducou"
  | "impedido"
  | "reapresentado"
  | "sem_pagamento"
  | "pago_parcial"
  | "pago";
export type FonteObjeto = "convenio" | "plano_acao" | "proposta_fns" | "acao_orcamentaria";

/** Uma linha de `emd_pub_linhas` (sem o `total`, que é do recorte). Valores em reais, datas AAAA-MM-DD. */
export interface LinhaPublica {
  linha: number;
  ano: number | null;
  codigo: string | null;
  numero: string | null;
  tipo: TipoEmenda | null;
  tipo_texto: string | null;
  no_catalogo: boolean;
  autor_codigo: string | null;
  autor_nome: string | null;
  autor_tipo: TipoAutor | null;
  coletivo: boolean;
  canal: CanalEmenda;
  instrumento: string;
  ano_pagamento: number | null;
  ente_tipo: EnteTipoEmenda | null;
  ente_nome: string | null;
  ente_cnpj: string | null;
  ibge: string | null;
  municipio: string | null;
  uf: string | null;
  objeto: string | null;
  objeto_fonte: FonteObjeto | null;
  funcao: string | null;
  subfuncao: string | null;
  programa: string | null;
  acao: string | null;
  previsto: number | null;
  /** O empenhado do canal (oport_68): nulo no fundo a fundo e no pagamento direto (a fonte não traz). */
  empenhado: number | null;
  pago: number;
  n_autores: number | null;
  etapa: EtapaPublica | null;
  situacao: string | null;
  caducou_em: string | null;
  dt_assinatura: string | null;
  dt_primeiro_pagamento: string | null;
  dt_ultimo_pagamento: string | null;
  concedente: string | null;
  orgao: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  convenio_repasse: number | null;
  convenio_desembolsado: number | null;
  /** Do convênio (oport_68): o valor global, a contrapartida e a execução física atestada (fração de 0 a 1). */
  valor_global: number | null;
  contrapartida: number | null;
  fisico: number | null;
  pix_area: string | null;
  pix_custeio: number | null;
  pix_investimento: number | null;
  pix_fim_execucao: string | null;
  fns_tipo_recurso: string | null;
}

/** A execução publicada (`emd_pub_execucao`) e a data de cada fonte. */
export interface ExecucaoPublica {
  id: number;
  concluidaEm: string | null;
  /** O Last-Modified do arquivo de emendas do Portal da Transparência: a data do dado. */
  dadoAte: string | null;
  referencia: string | null;
  fnsPendentes: number;
  painelExecucao: number | null;
  painelDadoAte: string | null;
  pixExecucao: number | null;
  pixDadoAte: string | null;
  fiscalExecucao: number | null;
}

export type GrupoAgregado = "ano_tipo_canal_funcao" | "ano_tipo" | "ano_canal" | "ano" | "tipo" | "canal" | "funcao" | "ente" | "total";

/** Uma linha de `emd_pub_agregado`: a coluna fora do conjunto de agrupamento (`grupo`) vem nula. */
export interface AgregadoPublico {
  grupo: GrupoAgregado;
  ano: number | null;
  tipo: TipoEmenda | null;
  canal: CanalEmenda | null;
  funcao: string | null;
  ente_tipo: EnteTipoEmenda | null;
  emendas: number;
  linhas: number;
  /** oport_68: municípios com registro (o Estado não conta), empenhado e a cobertura de cada medida. */
  municipios: number;
  previsto: number;
  empenhado: number;
  pago: number;
  com_previsto: number;
  com_empenhado: number;
  com_fisico: number;
}

/** Uma linha de `emd_pub_emenda`: a execução orçamentária do catálogo; fora da PB, só a localidade (valores nulos). */
export interface LinhaCatalogo {
  codigo: string;
  linha: number;
  ano: number | null;
  tipo: TipoEmenda | null;
  tipo_texto: string | null;
  autor_codigo: string | null;
  autor_nome: string | null;
  numero: string | null;
  localidade: string | null;
  uf: string | null;
  ibge: string | null;
  pb_localidade: boolean;
  funcao: string | null;
  subfuncao: string | null;
  programa: string | null;
  acao: string | null;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
  rp_pago: number | null;
  rp_cancelado: number | null;
  pago_total: number | null;
  a_pagar: number | null;
  /** oport_68: a execução NACIONAL da emenda (todas as localidades do Portal), repetida em cada linha; nunca somada à PB. */
  nacional_empenhado: number | null;
  nacional_liquidado: number | null;
  nacional_pago: number | null;
  nacional_rp_pago: number | null;
  nacional_rp_cancelado: number | null;
  nacional_a_pagar: number | null;
  /** Quantas localidades a emenda tem no Portal. */
  localidades: number | null;
}

/** Uma linha de `emd_pub_pf`: a pessoa física SOMADA, por emenda e ano. */
export interface PfPublica {
  codigo: string;
  ano: number;
  n_pagamentos: number;
  valor: number;
}

/** Uma linha de `emd_pub_autores`. */
export interface AutorPublico {
  codigo: string;
  nome: string | null;
  tipo: TipoAutor;
  coletivo: boolean;
  emendas: number;
  linhas: number;
  previsto: number;
  pago: number;
  municipios: number;
  ano_min: number | null;
  ano_max: number | null;
  convenio_pago: number;
  pix_pago: number;
  fns_pago: number;
  favorecido_pago: number;
  emendas_catalogo_pb: number;
}

export type GrupoMunicipio = "municipio" | "estado" | "sem_municipio";

/** Uma linha de `emd_pub_municipios`. */
export interface MunicipioPublico {
  grupo: GrupoMunicipio;
  ibge: string | null;
  nome: string;
  emendas: number;
  linhas: number;
  previsto: number;
  pago: number;
  convenio_pago: number;
  pix_pago: number;
  fns_pago: number;
  favorecido_pago: number;
  entidades_pago: number;
}

/** Uma linha de `emd_pub_facetas` (oport_68): quantos registros cada opção de um grupo de filtro teria. */
export interface FacetaPublica {
  grupo: "canal" | "ente_tipo" | "funcao" | "tipo" | "autoria" | "ano";
  chave: string;
  rotulo: string | null;
  registros: number;
}

export type Leitura<T> = ({ estado: "ok" } & T) | { estado: "sem_dado" } | { estado: "falha" };
export type LeituraFicha<T> = Leitura<T> | { estado: "nao_encontrado" };

// ================================================================ a lista branca (o que o servidor pede ao banco)

/** As funções do banco que o portal chama: nenhuma outra (o teste de `emendas-publico.server.test.ts` confere). */
export const FUNCOES_PUBLICAS = Object.freeze([
  "emd_pub_execucao",
  "emd_pub_linhas",
  "emd_pub_agregado",
  "emd_pub_emenda",
  "emd_pub_pf",
  "emd_pub_autores",
  "emd_pub_municipios",
  "emd_pub_facetas",
] as const);

/** As colunas pedidas de cada função, explícitas (`select`). Coluna nova no banco só sai depois de entrar aqui. */
export const COLUNAS_LINHA = Object.freeze([
  "linha", "ano", "codigo", "numero", "tipo", "tipo_texto", "no_catalogo", "autor_codigo", "autor_nome", "autor_tipo", "coletivo",
  "canal", "instrumento", "ano_pagamento", "ente_tipo", "ente_nome", "ente_cnpj", "ibge", "municipio", "uf", "objeto",
  "objeto_fonte", "funcao", "subfuncao", "programa", "acao", "previsto", "empenhado", "pago", "n_autores", "etapa", "situacao",
  "caducou_em", "dt_assinatura", "dt_primeiro_pagamento", "dt_ultimo_pagamento", "concedente", "orgao", "vigencia_inicio",
  "vigencia_fim", "valor_global", "convenio_repasse", "contrapartida", "convenio_desembolsado", "fisico", "pix_area", "pix_custeio",
  "pix_investimento", "pix_fim_execucao", "fns_tipo_recurso",
] as const satisfies readonly (keyof LinhaPublica)[]);
/** Os totais do recorte INTEIRO (oport_68), repetidos em toda linha de `emd_pub_linhas`: nunca a soma só da página. */
export const COLUNAS_TOTAIS = Object.freeze([
  "total", "total_emendas", "total_previsto", "total_com_previsto", "total_empenhado", "total_com_empenhado", "total_pago",
] as const);
export const COLUNAS_EXECUCAO = Object.freeze([
  "id", "concluida_em", "dado_ate", "referencia", "fns_pendentes", "painel_execucao", "painel_dado_ate", "pix_execucao",
  "pix_dado_ate", "fiscal_execucao",
] as const);
export const COLUNAS_AGREGADO = Object.freeze([
  "grupo", "ano", "tipo", "canal", "funcao", "ente_tipo", "emendas", "linhas", "municipios", "previsto", "empenhado", "pago",
  "com_previsto", "com_empenhado", "com_fisico",
] as const satisfies readonly (keyof AgregadoPublico)[]);
export const COLUNAS_CATALOGO = Object.freeze([
  "codigo", "linha", "ano", "tipo", "tipo_texto", "autor_codigo", "autor_nome", "numero", "localidade", "uf", "ibge",
  "pb_localidade", "funcao", "subfuncao", "programa", "acao", "empenhado", "liquidado", "pago", "rp_pago", "rp_cancelado",
  "pago_total", "a_pagar", "nacional_empenhado", "nacional_liquidado", "nacional_pago", "nacional_rp_pago", "nacional_rp_cancelado",
  "nacional_a_pagar", "localidades",
] as const satisfies readonly (keyof LinhaCatalogo)[]);
export const COLUNAS_FACETA = Object.freeze(["grupo", "chave", "rotulo", "registros"] as const satisfies readonly (keyof FacetaPublica)[]);
export const COLUNAS_PF = Object.freeze(["codigo", "ano", "n_pagamentos", "valor"] as const satisfies readonly (keyof PfPublica)[]);
export const COLUNAS_AUTOR = Object.freeze([
  "codigo", "nome", "tipo", "coletivo", "emendas", "linhas", "previsto", "pago", "municipios", "ano_min", "ano_max",
  "convenio_pago", "pix_pago", "fns_pago", "favorecido_pago", "emendas_catalogo_pb",
] as const satisfies readonly (keyof AutorPublico)[]);
export const COLUNAS_MUNICIPIO = Object.freeze([
  "grupo", "ibge", "nome", "emendas", "linhas", "previsto", "pago", "convenio_pago", "pix_pago", "fns_pago", "favorecido_pago",
  "entidades_pago",
] as const satisfies readonly (keyof MunicipioPublico)[]);

/**
 * O que nunca pode sair ao público (especificação, "O dado"): de quem é a vez, motivo, válido, coberto, ano inferido,
 * os campos do laudo do Pix, o catálogo bruto, o `rp_inscrito`, o documento de pessoa e os dados internos da execução.
 */
export const CAMPOS_PROIBIDOS = Object.freeze([
  "vez", "motivo", "valido", "coberto_por", "ano_inferido", "pior", "n_critico", "n_alto", "n_moderado", "n_pendente", "itens",
  "versao", "analise_pt", "saldo", "rp_inscrito", "cpf", "documento", "pessoa", "pessoa_fonte", "fatia", "pagamentos", "autores",
  "contagens", "arquivos", "erro", "texto_busca",
] as const);
/** O catálogo bruto das funções de administrador (`catalogo_*` sem o recorte da PB traz o Brasil inteiro): nunca sai. */
export const CATALOGO_BRUTO = /^catalogo_/;

// ================================================================ rótulos (neutros, sem juízo)

export const TIPOS_EMENDA: readonly TipoEmenda[] = Object.freeze([
  "individual_finalidade", "individual_especial", "bancada", "comissao", "relator", "outro",
] as TipoEmenda[]);
export const ROTULO_TIPO_EMENDA: Readonly<Record<TipoEmenda, string>> = Object.freeze({
  individual_finalidade: "Individual, com finalidade definida",
  individual_especial: "Individual, transferência especial",
  bancada: "Bancada",
  comissao: "Comissão",
  relator: "Relator-geral",
  outro: "Outro",
});
export const TIPO_NAO_IDENTIFICADO = "Não identificado";
export function rotuloTipo(tipo: TipoEmenda | null | undefined): string {
  return tipo ? (ROTULO_TIPO_EMENDA[tipo] ?? ROTULO_TIPO_EMENDA.outro) : TIPO_NAO_IDENTIFICADO;
}

/** A forma de repasse (especificação): o canal da oport_39 com o nome que o cidadão reconhece. */
export const FORMAS: readonly CanalEmenda[] = Object.freeze(["convenio", "pix", "fns", "favorecido"] as CanalEmenda[]);
export const ROTULO_FORMA: Readonly<Record<CanalEmenda, string>> = Object.freeze({
  convenio: "Convênio ou contrato de repasse",
  pix: "Transferência especial",
  fns: "Fundo a fundo (saúde)",
  favorecido: "Pagamento direto ao favorecido",
});
export function rotuloForma(canal: CanalEmenda | null | undefined): string {
  return canal ? (ROTULO_FORMA[canal] ?? canal) : "—";
}

export const ENTES: readonly EnteTipoEmenda[] = Object.freeze([
  "municipio", "fundo_municipal", "estado", "fundo_estadual", "consorcio", "osc", "empresa", "orgao_federal", "outro",
] as EnteTipoEmenda[]);
export const ENTE_NAO_INFORMADO = "Não informado";
export function rotuloEnte(tipo: EnteTipoEmenda | null | undefined): string {
  return tipo ? (ROTULO_ENTE_TIPO[tipo] ?? ROTULO_ENTE_TIPO.outro) : ENTE_NAO_INFORMADO;
}

export const ETAPAS: readonly EtapaPublica[] = Object.freeze([
  "proposta", "assinatura", "suspensiva", "execucao", "contas", "concluido", "extinto", "caducou", "impedido", "reapresentado",
  "sem_pagamento", "pago_parcial", "pago",
] as EtapaPublica[]);
/** As do convênio são as de `ROTULO_ETAPA_LAUDO` (diagnostico.ts; o teste confere); as outras, do Pix, do FNS e do pagamento. */
export const ROTULO_ETAPA: Readonly<Record<EtapaPublica, string>> = Object.freeze({
  proposta: "Proposta em análise",
  assinatura: "Aprovado, esperando assinatura",
  suspensiva: "Assinado, em cláusula suspensiva",
  execucao: "Em execução",
  contas: "Prestação de contas",
  concluido: "Concluído",
  extinto: "Anulado, rescindido ou cancelado",
  caducou: "Proposta não assinada até 31/12 do ano seguinte",
  impedido: "Impedimento técnico registrado",
  reapresentado: "Reapresentado",
  sem_pagamento: "Sem pagamento registrado",
  pago_parcial: "Pago em parte",
  pago: "Pago",
});
/** A situação na linha: a etapa, e no "caducou" a data exata ("Proposta não assinada até 31/12/2025"). */
export function rotuloEtapa(etapa: EtapaPublica | null | undefined, ano?: number | null): string {
  if (!etapa) return "Não consta registro";
  if (etapa === "caducou" && typeof ano === "number" && Number.isInteger(ano)) return `Proposta não assinada até 31/12/${ano + 1}`;
  return ROTULO_ETAPA[etapa] ?? etapa;
}

/** A situação como a fonte publica, só quando ela diz algo além do rótulo da etapa ("Em execução" não se repete). */
export function situacaoDaFonte(l: Pick<LinhaPublica, "situacao" | "etapa" | "ano">): string | null {
  const s = (l.situacao ?? "").trim();
  if (!s) return null;
  return normalizarTexto(s) === normalizarTexto(rotuloEtapa(l.etapa, l.ano)) ? null : s;
}

export const ROTULO_FONTE_OBJETO: Readonly<Record<FonteObjeto, string>> = Object.freeze({
  convenio: "Objeto do convênio (Transferegov)",
  plano_acao: "Objeto do plano de ação (transferência especial)",
  proposta_fns: "Tipo da proposta no Fundo Nacional de Saúde",
  acao_orcamentaria: "Ação orçamentária da emenda (o pagamento direto não traz objeto)",
});

export const FUNCAO_NAO_CONSTA = "Não consta";

// ================================================================ privacidade (a mesma regra do banco, outra vez)

const CPF_NO_TEXTO = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
const MEI_NO_COMECO = /^\s*\d{2}\.?\d{3}\.?\d{3}\s/;
export const NOME_MEI_OMITIDO = "Microempreendedor individual (nome omitido)";

/** Qualquer número com formato de CPF vira "***.***.***-**" (o banco já faz; aqui é a segunda trava). */
export function mascararCpf(texto: string): string {
  return texto.replace(CPF_NO_TEXTO, "***.***.***-**");
}

/**
 * O nome do ente como o portal mostra: o do microempreendedor individual (a razão social começa pela raiz do CNPJ e traz
 * o nome da pessoa) sai como "Microempreendedor individual (nome omitido)"; no resto, o CPF mascarado. É a regra de
 * `emd_pub_ente_nome` (oport_67), repetida para nenhum caminho depender de um lugar só.
 */
export function nomePublicoDoEnte(nome: string | null | undefined): string | null {
  if (nome === null || nome === undefined) return null;
  if (MEI_NO_COMECO.test(nome)) return NOME_MEI_OMITIDO;
  return mascararCpf(nome);
}

/** A linha com os textos livres passados pelas duas regras (nome do ente e objeto), sem mudar a recebida. */
export function linhaSegura(l: LinhaPublica): LinhaPublica {
  return { ...l, ente_nome: nomePublicoDoEnte(l.ente_nome), objeto: l.objeto === null ? null : mascararCpf(l.objeto) };
}

// ================================================================ endereços

export const BASE_PORTAL = "/emendas";

/** O código de emenda da URL: 12 dígitos (ano, autor e número); senão null (404 sem ler o banco). */
export function codigoEmendaDaUrl(v: string | null | undefined): string | null {
  return typeof v === "string" && /^\d{12}$/.test(v) ? v : null;
}
/** O código do autor da URL: 4 dígitos. */
export function codigoAutorPublicoDaUrl(v: string | null | undefined): string | null {
  return typeof v === "string" && /^\d{4}$/.test(v) ? v : null;
}
/** O IBGE da URL: um município da Paraíba (7 dígitos começando por 25). */
export function ibgeDaUrl(v: string | null | undefined): string | null {
  return typeof v === "string" && /^25\d{5}$/.test(v) ? v : null;
}

/** "2024 1277 0015": o código em três blocos (ano, autor, número), para ler e conferir no Portal. */
export function codigoLegivel(codigo: string | null | undefined): string {
  if (!codigo) return "—";
  return /^\d{12}$/.test(codigo) ? `${codigo.slice(0, 4)} ${codigo.slice(4, 8)} ${codigo.slice(8)}` : codigo;
}

export const urlEmenda = (codigo: string) => `${BASE_PORTAL}/emenda/${encodeURIComponent(codigo)}`;
export const urlParlamentarPublico = (codigo: string) => `${BASE_PORTAL}/parlamentares/${encodeURIComponent(codigo)}`;
export const urlMunicipioPublico = (ibge: string) => `${BASE_PORTAL}/municipios/${encodeURIComponent(ibge)}`;

/** As fontes oficiais. O Transferegov não tem endereço por convênio para quem não entra: a consulta pública e o número. */
export const FONTES_OFICIAIS = Object.freeze({
  portalEmendas: "https://portaldatransparencia.gov.br/emendas",
  portalDownload: "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares",
  transferegovConsultaConvenio:
    "https://discricionarias.transferegov.sistema.gov.br/voluntarias/ForwardAction.do?modulo=Principal&path=/MostraPrincipalConsultarConvenio.do&Usr=guest&Pwd=guest",
  fns: "https://consultafns.saude.gov.br/",
  pntp: "https://radardatransparencia.atricon.org.br/",
});
export const urlPortalEmenda = (codigo: string) =>
  `https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda=${encodeURIComponent(codigo)}`;
export const urlPortalConvenio = (numero: string) => `https://portaldatransparencia.gov.br/convenios/${encodeURIComponent(numero)}`;
export const urlPortalPessoaJuridica = (cnpj: string) =>
  `https://portaldatransparencia.gov.br/pessoa-juridica/${encodeURIComponent(cnpj.replace(/\D/g, ""))}`;

// ================================================================ números e datas

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "R$ 1.234.567,89" (o valor exato, como na fonte); vazio: "—". */
export function moeda(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? MOEDA.format(v).replace(/ /g, " ") : "—";
}

/** "R$ 1,2 mi", "R$ 350 mil": para as somas da série. */
export function moedaCurta(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const f = (n: number, casas: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${f(v / 1e9, 1)} bi`;
  if (a >= 1e6) return `R$ ${f(v / 1e6, 1)} mi`;
  if (a >= 1e3) return `R$ ${f(v / 1e3, 0)} mil`;
  return `R$ ${f(v, 0)}`;
}

export const inteiro = (n: number | null | undefined): string =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—";

/** "1 emenda", "2 emendas": o número com a palavra no singular ou no plural. */
export function contagem(n: number, singular: string, plural: string): string {
  return `${inteiro(n)} ${n === 1 ? singular : plural}`;
}

/** "DD/MM/AAAA" de uma data AAAA-MM-DD ou de um instante (em Brasília); vazio: "—". */
export function data(iso: string | null | undefined): string {
  return dataBrasilia(iso ?? null);
}

/** A frase da data do dado: "dado do Portal da Transparência de 30/10/2026; atualizado toda semana". */
/**
 * As datas do portal, sempre dizendo de quê (decisão do titular, 17/11/2026): a REFERÊNCIA é a data do arquivo de
 * emendas do Portal da Transparência (Last-Modified do zip; é o "até DD/MM" da frase do período) e a COLETA é quando a
 * PONTE terminou de ler as fontes. "Dados do Portal da Transparência de 13/11/2026, lidos pela PONTE em 17/11/2026."
 */
export function fraseDasDatas(e: Pick<ExecucaoPublica, "dadoAte" | "concluidaEm">): string {
  const d = dataBrasilia(e.dadoAte, "");
  const c = dataBrasilia(e.concluidaEm, "");
  return `Dados do Portal da Transparência ${d ? `de ${d}` : "com data não informada"}${c ? `, lidos pela PONTE em ${c}` : ""}.`;
}

/** A data de cada fonte (a dos instrumentos importa na ficha e no método): de quando é o dado, ou quando a PONTE leu. */
export function datasDasFontes(
  e: Pick<ExecucaoPublica, "dadoAte" | "concluidaEm" | "painelDadoAte" | "pixDadoAte">,
): { chave: "portal" | "convenio" | "especial" | "fns"; fonte: string; texto: string }[] {
  const de = (iso: string | null) => (dataBrasilia(iso, "") ? `dados de ${dataBrasilia(iso, "")}` : "data não informada");
  const lido = dataBrasilia(e.concluidaEm, "");
  return [
    { chave: "portal", fonte: "Portal da Transparência (arquivo de emendas e pagamentos a favorecidos)", texto: de(e.dadoAte) },
    { chave: "convenio", fonte: "Transferegov (convênios e contratos de repasse)", texto: de(e.painelDadoAte) },
    { chave: "especial", fonte: "Transferegov (transferências especiais)", texto: de(e.pixDadoAte) },
    { chave: "fns", fonte: "Fundo Nacional de Saúde (propostas e pagamentos)", texto: lido ? `lido pela PONTE em ${lido}` : "data não informada" },
  ];
}

// ================================================================ a tabela das linhas (17.1): colunas, filtros, ordem

/** O prefixo da tabela no endereço (`?t.emendas.<coluna>=…`), o mesmo em todas as páginas do portal. */
export const TABELA_EMENDAS = "emendas";
/** Linhas por página da lista. */
export const POR_PAGINA = 50;
/** O teto de páginas que um arquivo pede ao banco (1.000 linhas cada): 60 mil linhas, quase o triplo de hoje. */
export const MAX_PAGINAS_ARQUIVO = 60;
/** Mil: o máximo de linhas por chamada da função (e da API). */
export const LINHAS_POR_CHAMADA = 1000;

const num = (id: string, titulo: string, extra: Partial<ColunaTabela> = {}): ColunaTabela => ({ id, titulo, tipo: "numero", alinhar: "direita", ...extra });

/** As colunas da lista: as do 17.1, cada uma com filtro e ordem (as ocultas só filtram). */
export const COLUNAS_LISTA: ColunaTabela[] = [
  num("ano", "Ano", { alinhar: "esquerda" }),
  { id: "emenda", titulo: "Emenda", tipo: "texto", textoNoCsv: true },
  { id: "tipo", titulo: "Tipo", tipo: "categoria" },
  { id: "autor", titulo: "Autoria", tipo: "texto" },
  { id: "forma", titulo: "Forma de repasse", tipo: "categoria" },
  { id: "destino", titulo: "Destino", tipo: "texto" },
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  { id: "funcao", titulo: "Função de governo", tipo: "categoria" },
  num("previsto", "Previsto"),
  num("pago", "Realizado (pago)"),
  { id: "situacao", titulo: "Situação", tipo: "categoria" },
  { id: "ente", titulo: "Tipo do destino", tipo: "categoria", oculta: true, ordenavel: false },
  { id: "fonte-situacao", titulo: "Situação como a fonte publica", tipo: "texto", oculta: true, ordenavel: false },
  { id: "instrumento", titulo: "Instrumento (nº do convênio, plano, proposta ou CNPJ)", tipo: "texto", oculta: true, ordenavel: false, textoNoCsv: true },
];

/** A coluna da tela → a ordem que a função aceita (`p_ordem`). */
const ORDEM_NO_BANCO: Readonly<Record<string, string>> = Object.freeze({
  ano: "ano",
  emenda: "codigo",
  tipo: "tipo",
  autor: "autor",
  forma: "canal",
  destino: "ente",
  municipio: "municipio",
  objeto: "objeto",
  funcao: "funcao",
  previsto: "previsto",
  pago: "pago",
  situacao: "situacao",
});

export const DESCRICAO_ORDEM_PADRAO = "ano mais recente primeiro, depois autoria e código, em ordem alfabética";

/** As opções das categorias, na ordem fixa (nunca por valor). As funções vêm do banco (o agregado), em ordem alfabética. */
export function opcoesDaLista(funcoes: readonly (string | null)[]): Record<string, { valor: string; linhas: number | null }[]> {
  const op = (valores: readonly string[]) => valores.map((valor) => ({ valor, linhas: null }));
  const nomes = [...new Set(funcoes.map((f) => (f && f.trim() ? f : FUNCAO_NAO_CONSTA)))].sort((a, b) =>
    a === FUNCAO_NAO_CONSTA ? 1 : b === FUNCAO_NAO_CONSTA ? -1 : a.localeCompare(b, "pt-BR"),
  );
  return {
    tipo: op([...TIPOS_EMENDA.map((t) => ROTULO_TIPO_EMENDA[t]), TIPO_NAO_IDENTIFICADO]),
    forma: op(FORMAS.map((c) => ROTULO_FORMA[c])),
    funcao: op(nomes),
    situacao: op(ETAPAS.map((e) => ROTULO_ETAPA[e])),
    ente: op([...ENTES.map((e) => ROTULO_ENTE_TIPO[e]), ENTE_NAO_INFORMADO]),
  };
}

/** O que a lista pede: o estado da tabela (do endereço), a busca geral (`q`) e a página. */
export interface ConsultaLista {
  estado: EstadoTabela;
  busca: string;
  pagina: number;
}

/** O recorte fixo de uma ficha: o autor, o município ou a emenda (vão ao banco como igualdade, nunca como texto). */
export interface RecorteFixo {
  autor?: string | null;
  ibge?: string | null;
  emenda?: string | null;
}

const MAX_BUSCA = 200;

/** Os `searchParams` da página do Next como `URLSearchParams` (a chave repetida fica repetida). */
export function parametrosDoEndereco(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, x);
  return q;
}

/** Lê a consulta do endereço. Lixo vira o padrão (página 1, sem busca), nunca erro. */
export function lerConsulta(parametros: URLSearchParams): ConsultaLista {
  const pagina = Number(parametros.get("pagina"));
  return {
    estado: lerEstado(TABELA_EMENDAS, COLUNAS_LISTA, parametros),
    busca: (parametros.get("q") ?? "").trim().slice(0, MAX_BUSCA),
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 100_000 ? pagina : 1,
  };
}

/** O recorte fixo vindo do endereço de um arquivo (`autor`, `ibge`, `emenda`), validado. */
export function lerRecorteFixo(parametros: URLSearchParams): RecorteFixo {
  return {
    autor: codigoAutorPublicoDaUrl(parametros.get("autor")),
    ibge: ibgeDaUrl(parametros.get("ibge")),
    emenda: codigoEmendaDaUrl(parametros.get("emenda")),
  };
}

/** O endereço com a consulta (busca, página e a tabela), a partir de um caminho. A página 1 não vai ao endereço. */
export function urlComConsulta(caminho: string, c: ConsultaLista, extras: Record<string, string | null | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(extras)) if (v) q.set(k, v);
  if (c.busca) q.set("q", c.busca);
  if (c.pagina > 1) q.set("pagina", String(c.pagina));
  const s = gravarEstado(TABELA_EMENDAS, c.estado, q).toString();
  return s ? `${caminho}?${s}` : caminho;
}

/** O endereço da lista já filtrada (os atalhos da página inicial e das fichas), no formato da tabela. */
export function urlDaListaFiltrada(filtros: EstadoTabela["filtros"], caminho = `${BASE_PORTAL}/lista`): string {
  return urlComConsulta(caminho, { estado: { filtros, ordem: null }, busca: "", pagina: 1 });
}

/** O endereço do arquivo do recorte (CSV ou JSON), com o mesmo filtro, a mesma busca e o mesmo recorte fixo, sem página. */
export function urlDoRecorte(formato: "csv" | "json", c: ConsultaLista, fixo: RecorteFixo = {}): string {
  return urlComConsulta(`${BASE_PORTAL}/dados/recorte.${formato}`, { ...c, pagina: 1 }, {
    autor: fixo.autor ?? null,
    ibge: fixo.ibge ?? null,
    emenda: fixo.emenda ?? null,
  });
}

/** Um número no formato de CPF (11 dígitos, com ou sem pontuação) não vira busca: o banco não acha pessoa por documento. */
function pareceCpf(palavra: string): boolean {
  return /^[\d.\-/]+$/.test(palavra) && palavra.replace(/\D/g, "").length === 11;
}

const MAX_PALAVRAS = 8;
const MAX_PALAVRA = 60;

/** As palavras de um texto como padrões `like` do banco: sem acento, minúsculas, curingas escapados; sem nada: null. */
export function padroesDeTexto(texto: string | null | undefined): string[] | null {
  const palavras = normalizarTexto(texto ?? "")
    .split(" ")
    .filter((p) => p !== "" && !pareceCpf(p))
    .slice(0, MAX_PALAVRAS)
    .map((p) => padraoContem(p.slice(0, MAX_PALAVRA)));
  return palavras.length ? palavras : null;
}

const inverso = (m: Readonly<Record<string, string>>): Map<string, string> =>
  new Map(Object.entries(m).map(([codigo, rotulo]) => [normalizarTexto(rotulo), codigo]));
const TIPO_DO_ROTULO = inverso(ROTULO_TIPO_EMENDA);
const FORMA_DO_ROTULO = inverso(ROTULO_FORMA);
const ENTE_DO_ROTULO = inverso(ROTULO_ENTE_TIPO);
const ETAPA_DO_ROTULO = inverso(ROTULO_ETAPA);

/**
 * Os rótulos marcados numa categoria como os valores do banco. Rótulo que não existe (um endereço velho) vira um valor
 * que não acha nada, como na tela; o "não identificado / não informado / não consta" vira "" (o nulo, no banco).
 */
function valoresDaCategoria(rotulos: readonly string[], mapa: Map<string, string>, vazio: string | null): string[] {
  const alvo = vazio === null ? null : normalizarTexto(vazio);
  return rotulos.map((r) => {
    const n = normalizarTexto(r);
    if (alvo !== null && n === alvo) return "";
    return mapa.get(n) ?? "(nenhum)";
  });
}

const categoria = (estado: EstadoTabela, id: string): string[] | null => {
  const f = estado.filtros[id];
  return f && f.tipo === "categoria" && f.valores.length ? f.valores : null;
};
const texto = (estado: EstadoTabela, id: string): string[] | null => {
  const f = estado.filtros[id];
  return f && f.tipo === "texto" ? padroesDeTexto(f.contem) : null;
};
const faixa = (estado: EstadoTabela, id: string): { de: number | null; ate: number | null } => {
  const f = estado.filtros[id];
  if (!f || f.tipo !== "numero") return { de: null, ate: null };
  const ok = (n: number | null) => (n !== null && Number.isFinite(n) ? n : null);
  return { de: ok(f.de), ate: ok(f.ate) };
};

/**
 * A consulta como os argumentos de `emd_pub_linhas` (oport_67). Só vai o que filtra: o resto fica com o padrão da função
 * (nulo, "sem filtro"), e a chave do cache fica curta. `pagina` vira o limite e o deslocamento.
 */
export function argumentosDaLista(c: ConsultaLista, fixo: RecorteFixo = {}, pagina?: { limite: number; deslocamento: number }): Record<string, unknown> {
  const e = c.estado;
  const a: Record<string, unknown> = {};
  const por = (k: string, v: unknown) => {
    if (v !== null && v !== undefined) a[k] = v;
  };
  const ano = faixa(e, "ano");
  por("p_ano_de", ano.de === null ? null : Math.ceil(ano.de));
  por("p_ano_ate", ano.ate === null ? null : Math.floor(ano.ate));
  por("p_codigo", texto(e, "emenda"));
  por("p_emenda", fixo.emenda ? codigoEmendaDaUrl(fixo.emenda) : null);
  const tipos = categoria(e, "tipo");
  por("p_tipo", tipos && valoresDaCategoria(tipos, TIPO_DO_ROTULO, TIPO_NAO_IDENTIFICADO));
  por("p_autor", fixo.autor ? codigoAutorPublicoDaUrl(fixo.autor) : null);
  por("p_autor_nome", texto(e, "autor"));
  const formas = categoria(e, "forma");
  por("p_canal", formas && valoresDaCategoria(formas, FORMA_DO_ROTULO, null));
  const entes = categoria(e, "ente");
  por("p_ente_tipo", entes && valoresDaCategoria(entes, ENTE_DO_ROTULO, ENTE_NAO_INFORMADO));
  por("p_ente", texto(e, "destino"));
  por("p_ibge", fixo.ibge ? ibgeDaUrl(fixo.ibge) : null);
  por("p_municipio", texto(e, "municipio"));
  por("p_objeto", texto(e, "objeto"));
  const funcoes = categoria(e, "funcao");
  por("p_funcao", funcoes && funcoes.map((f) => (normalizarTexto(f) === normalizarTexto(FUNCAO_NAO_CONSTA) ? "" : normalizarTexto(f))));
  const etapas = categoria(e, "situacao");
  por("p_etapa", etapas && valoresDaCategoria(etapas, ETAPA_DO_ROTULO, null));
  por("p_situacao", texto(e, "fonte-situacao"));
  por("p_instrumento", texto(e, "instrumento"));
  const previsto = faixa(e, "previsto");
  por("p_previsto_de", previsto.de);
  por("p_previsto_ate", previsto.ate);
  const pago = faixa(e, "pago");
  por("p_pago_de", pago.de);
  por("p_pago_ate", pago.ate);
  por("p_busca", padroesDeTexto(c.busca));
  const ordem = e.ordem ? ORDEM_NO_BANCO[e.ordem.coluna] : undefined;
  if (e.ordem && ordem) {
    a.p_ordem = ordem;
    a.p_desc = e.ordem.sentido === "desc";
  }
  if (pagina) {
    a.p_limite = Math.max(1, Math.min(LINHAS_POR_CHAMADA, Math.trunc(pagina.limite)));
    a.p_deslocamento = Math.max(0, Math.trunc(pagina.deslocamento));
  }
  return a;
}

/** O limite e o deslocamento da página da lista. */
export function paginaDaLista(pagina: number): { limite: number; deslocamento: number } {
  const p = Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
  return { limite: POR_PAGINA, deslocamento: (p - 1) * POR_PAGINA };
}

/** Quantas páginas tem um total. */
export function totalDePaginas(total: number, porPagina = POR_PAGINA): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / porPagina));
}

/** O filtro em palavras, para a página e o arquivo dizerem o recorte. */
export function descreverConsulta(c: ConsultaLista, fixo: RecorteFixo = {}): string[] {
  const partes: string[] = [];
  if (fixo.autor) partes.push(`autor de código ${fixo.autor}`);
  if (fixo.ibge) partes.push(`município de código IBGE ${fixo.ibge}`);
  if (fixo.emenda) partes.push(`emenda ${codigoLegivel(fixo.emenda)}`);
  if (c.busca) partes.push(`busca “${c.busca}”`);
  for (const [id, f] of Object.entries(c.estado.filtros)) {
    const col = COLUNAS_LISTA.find((x) => x.id === id);
    if (!col) continue;
    if (f.tipo === "texto") partes.push(`${col.titulo} contém “${f.contem.trim()}”`);
    else if (f.tipo === "categoria") partes.push(`${col.titulo}: ${f.valores.join(" ou ")}`);
    else if (f.tipo === "numero") partes.push(`${col.titulo} ${f.de !== null ? `de ${f.de}` : ""}${f.de !== null && f.ate !== null ? " " : ""}${f.ate !== null ? `até ${f.ate}` : ""}`.trim());
  }
  return partes;
}

/** Os valores crus de uma linha para a tabela (filtro na tela, rótulo no celular): os rótulos, não os códigos. */
export function valoresDaLinha(l: LinhaPublica): Record<string, ValorCelula> {
  return {
    ano: l.ano,
    emenda: l.codigo,
    tipo: rotuloTipo(l.tipo),
    autor: l.autor_nome,
    forma: rotuloForma(l.canal),
    destino: nomePublicoDoEnte(l.ente_nome),
    municipio: l.municipio,
    objeto: l.objeto === null ? null : mascararCpf(l.objeto),
    funcao: l.funcao ?? FUNCAO_NAO_CONSTA,
    previsto: l.previsto,
    pago: l.pago,
    situacao: rotuloEtapa(l.etapa, l.ano),
    ente: rotuloEnte(l.ente_tipo),
    "fonte-situacao": l.situacao,
    instrumento: l.instrumento,
  };
}

/** A chave única da linha na tela (a linha da execução). */
export const chaveDaLinha = (l: Pick<LinhaPublica, "linha">) => String(l.linha);

// ================================================================ dados abertos (15.4): dicionário, CSV e JSON

export interface CampoDicionario<T> {
  campo: keyof T & string;
  tipo: "texto" | "inteiro" | "número (reais)" | "data" | "sim ou não" | "código";
  descricao: string;
  fonte: string;
  /** Identificador que o Excel estragaria: no CSV sai como ="…" (texto intacto); no JSON, puro. */
  identificador?: boolean;
}

const PORTAL = "Portal da Transparência (CGU), arquivo de emendas parlamentares";
const CANAL = "Fonte do canal: Transferegov (convênio e transferência especial), Fundo Nacional de Saúde ou Portal da Transparência (pagamento direto)";
const PONTE = "PONTE, a partir das fontes oficiais";

/** O dicionário do arquivo das linhas (critério 17.1), na ordem das colunas do arquivo. */
export const DICIONARIO_LINHAS: readonly CampoDicionario<LinhaPublica>[] = Object.freeze([
  { campo: "ano", tipo: "inteiro", descricao: "Ano da emenda (os quatro primeiros dígitos do código).", fonte: PORTAL },
  { campo: "codigo", tipo: "código", descricao: "Código da emenda, com 12 dígitos: ano, código do autor e número. Vazio na proposta do FNS ainda sem o detalhe da emenda.", fonte: PORTAL, identificador: true },
  { campo: "numero", tipo: "código", descricao: "Número da emenda (do arquivo do Portal; sem ele, os quatro últimos dígitos do código).", fonte: PORTAL, identificador: true },
  { campo: "tipo", tipo: "código", descricao: "Tipo da emenda: individual_finalidade (individual, com finalidade definida), individual_especial (individual, transferência especial), bancada, comissao, relator ou outro. Sem o texto do Portal, vem do tipo do autor e da forma de repasse.", fonte: PONTE },
  { campo: "tipo_texto", tipo: "texto", descricao: "Tipo da emenda como o Portal publica. Vazio quando a emenda não tem linha no arquivo do Portal.", fonte: PORTAL },
  { campo: "no_catalogo", tipo: "sim ou não", descricao: "A emenda tem linha no arquivo de emendas do Portal (o arquivo começa em 2014).", fonte: PONTE },
  { campo: "autor_codigo", tipo: "código", descricao: "Código do autor (4 dígitos, do mandato).", fonte: PORTAL, identificador: true },
  { campo: "autor_nome", tipo: "texto", descricao: "Autor como publicado: parlamentar, bancada, comissão ou relator-geral (agentes públicos).", fonte: PORTAL },
  { campo: "autor_tipo", tipo: "código", descricao: "individual, bancada, comissao, relator ou outro.", fonte: PONTE },
  { campo: "coletivo", tipo: "sim ou não", descricao: "Autoria coletiva (bancada, comissão ou relator-geral): o dado aberto não identifica quem indicou cada destino.", fonte: PONTE },
  { campo: "canal", tipo: "código", descricao: "Forma de repasse: convenio (convênio ou contrato de repasse), pix (transferência especial), fns (fundo a fundo da saúde) ou favorecido (pagamento direto ao favorecido).", fonte: PONTE },
  { campo: "instrumento", tipo: "código", descricao: "Número do convênio, identificador do plano de ação (transferência especial), número da proposta (FNS) ou CNPJ do favorecido.", fonte: CANAL, identificador: true },
  { campo: "ano_pagamento", tipo: "inteiro", descricao: "Só no pagamento direto: o ano do recebimento.", fonte: PORTAL },
  { campo: "ente_tipo", tipo: "código", descricao: "Tipo do destino: municipio, fundo_municipal, estado, fundo_estadual, consorcio, osc, empresa, orgao_federal ou outro.", fonte: PONTE },
  { campo: "ente_nome", tipo: "texto", descricao: "Nome do destino (pessoa jurídica). O microempreendedor individual sai como “Microempreendedor individual (nome omitido)”, porque a razão social traz o nome da pessoa.", fonte: CANAL },
  { campo: "ente_cnpj", tipo: "código", descricao: "CNPJ do destino.", fonte: CANAL, identificador: true },
  { campo: "ibge", tipo: "código", descricao: "Código IBGE do município do destino. Vazio no governo e nos fundos estaduais (a sede não é o destino).", fonte: CANAL, identificador: true },
  { campo: "municipio", tipo: "texto", descricao: "Nome do município.", fonte: "IBGE" },
  { campo: "uf", tipo: "texto", descricao: "Unidade da federação do destino.", fonte: CANAL },
  { campo: "objeto", tipo: "texto", descricao: "Objeto: o do convênio, o do plano de ação, o tipo da proposta do FNS ou, no pagamento direto, a ação orçamentária da emenda (ver objeto_fonte).", fonte: CANAL },
  { campo: "objeto_fonte", tipo: "código", descricao: "De onde vem o objeto: convenio, plano_acao, proposta_fns ou acao_orcamentaria.", fonte: PONTE },
  { campo: "funcao", tipo: "texto", descricao: "Função de governo da emenda.", fonte: PORTAL },
  { campo: "subfuncao", tipo: "texto", descricao: "Subfunção de governo da emenda.", fonte: PORTAL },
  { campo: "programa", tipo: "texto", descricao: "Programa orçamentário da emenda.", fonte: PORTAL },
  { campo: "acao", tipo: "texto", descricao: "Ação orçamentária da emenda.", fonte: PORTAL },
  { campo: "previsto", tipo: "número (reais)", descricao: "Valor previsto: o indicado pelo autor para este destino. Vazio no pagamento direto, que só traz o pago.", fonte: CANAL },
  { campo: "pago", tipo: "número (reais)", descricao: "Valor realizado (pago): no convênio, o desembolsado na parte desta emenda; na transferência especial, o pago; no FNS, o pago na parte desta emenda; no pagamento direto, o recebido no ano.", fonte: CANAL },
  { campo: "n_autores", tipo: "inteiro", descricao: "Quantos autores dividem o mesmo instrumento.", fonte: CANAL },
  { campo: "etapa", tipo: "código", descricao: "Etapa: proposta, assinatura, suspensiva, execucao, contas, concluido, extinto, caducou (proposta não assinada até 31/12 do ano seguinte ao da emenda), impedido, reapresentado, sem_pagamento, pago_parcial ou pago.", fonte: PONTE },
  { campo: "situacao", tipo: "texto", descricao: "Situação como a fonte publica.", fonte: CANAL },
  { campo: "caducou_em", tipo: "data", descricao: "Na proposta não assinada: a data-limite que passou.", fonte: PONTE },
  { campo: "dt_assinatura", tipo: "data", descricao: "Data de assinatura do convênio.", fonte: CANAL },
  { campo: "dt_primeiro_pagamento", tipo: "data", descricao: "Data do primeiro pagamento ou desembolso.", fonte: CANAL },
  { campo: "dt_ultimo_pagamento", tipo: "data", descricao: "Data do último pagamento ou desembolso.", fonte: CANAL },
  { campo: "concedente", tipo: "texto", descricao: "Convênio: o órgão superior concedente (a origem).", fonte: "Transferegov" },
  { campo: "orgao", tipo: "texto", descricao: "Convênio: o órgão ou a unidade concedente.", fonte: "Transferegov" },
  { campo: "vigencia_inicio", tipo: "data", descricao: "Convênio: início da vigência.", fonte: "Transferegov" },
  { campo: "vigencia_fim", tipo: "data", descricao: "Convênio: fim da vigência.", fonte: "Transferegov" },
  { campo: "convenio_repasse", tipo: "número (reais)", descricao: "Convênio: o valor de repasse do convênio inteiro (pode juntar várias emendas).", fonte: "Transferegov" },
  { campo: "convenio_desembolsado", tipo: "número (reais)", descricao: "Convênio: o valor desembolsado do convênio inteiro (o valor recebido).", fonte: "Transferegov" },
  { campo: "pix_area", tipo: "texto", descricao: "Transferência especial: a área do plano de ação.", fonte: "Transferegov (transferências especiais)" },
  { campo: "pix_custeio", tipo: "número (reais)", descricao: "Transferência especial: a parte de custeio do plano.", fonte: "Transferegov (transferências especiais)" },
  { campo: "pix_investimento", tipo: "número (reais)", descricao: "Transferência especial: a parte de investimento do plano.", fonte: "Transferegov (transferências especiais)" },
  { campo: "pix_fim_execucao", tipo: "data", descricao: "Transferência especial: o fim da execução do plano.", fonte: "Transferegov (transferências especiais)" },
  { campo: "fns_tipo_recurso", tipo: "texto", descricao: "FNS: o tipo do recurso (custeio ou investimento).", fonte: "Fundo Nacional de Saúde" },
]);

/** O dicionário da execução orçamentária do catálogo na PB (critério 17.3). */
export const DICIONARIO_CATALOGO: readonly CampoDicionario<LinhaCatalogo>[] = Object.freeze([
  { campo: "codigo", tipo: "código", descricao: "Código da emenda (12 dígitos).", fonte: PORTAL, identificador: true },
  { campo: "ano", tipo: "inteiro", descricao: "Ano da emenda.", fonte: PORTAL },
  { campo: "tipo", tipo: "código", descricao: "Tipo da emenda (os mesmos códigos do arquivo das linhas).", fonte: PONTE },
  { campo: "tipo_texto", tipo: "texto", descricao: "Tipo como o Portal publica.", fonte: PORTAL },
  { campo: "autor_codigo", tipo: "código", descricao: "Código do autor.", fonte: PORTAL, identificador: true },
  { campo: "autor_nome", tipo: "texto", descricao: "Autor como publicado.", fonte: PORTAL },
  { campo: "numero", tipo: "código", descricao: "Número da emenda.", fonte: PORTAL, identificador: true },
  { campo: "localidade", tipo: "texto", descricao: "Localidade do gasto como o Portal publica (só as linhas com a Paraíba).", fonte: PORTAL },
  { campo: "uf", tipo: "texto", descricao: "UF da localidade.", fonte: PORTAL },
  { campo: "ibge", tipo: "código", descricao: "Código IBGE do município da localidade, quando há.", fonte: PORTAL, identificador: true },
  { campo: "funcao", tipo: "texto", descricao: "Função de governo.", fonte: PORTAL },
  { campo: "subfuncao", tipo: "texto", descricao: "Subfunção de governo.", fonte: PORTAL },
  { campo: "programa", tipo: "texto", descricao: "Programa orçamentário.", fonte: PORTAL },
  { campo: "acao", tipo: "texto", descricao: "Ação orçamentária.", fonte: PORTAL },
  { campo: "empenhado", tipo: "número (reais)", descricao: "Valor empenhado.", fonte: PORTAL },
  { campo: "liquidado", tipo: "número (reais)", descricao: "Valor liquidado.", fonte: PORTAL },
  { campo: "pago", tipo: "número (reais)", descricao: "Valor pago no exercício.", fonte: PORTAL },
  { campo: "rp_pago", tipo: "número (reais)", descricao: "Restos a pagar pagos depois.", fonte: PORTAL },
  { campo: "rp_cancelado", tipo: "número (reais)", descricao: "Restos a pagar cancelados.", fonte: PORTAL },
  { campo: "pago_total", tipo: "número (reais)", descricao: "Pago no exercício mais os restos a pagar pagos.", fonte: PONTE },
  { campo: "a_pagar", tipo: "número (reais)", descricao: "Empenhado menos o pago, os restos pagos e os cancelados (nunca abaixo de zero).", fonte: PONTE },
]);

/** O dicionário da pessoa física somada. */
export const DICIONARIO_PF: readonly CampoDicionario<PfPublica>[] = Object.freeze([
  { campo: "codigo", tipo: "código", descricao: "Código da emenda.", fonte: PORTAL, identificador: true },
  { campo: "ano", tipo: "inteiro", descricao: "Ano do pagamento.", fonte: PORTAL },
  { campo: "n_pagamentos", tipo: "inteiro", descricao: "Quantos pagamentos a pessoas físicas na Paraíba (sem nome e sem documento).", fonte: PORTAL },
  { campo: "valor", tipo: "número (reais)", descricao: "A soma desses pagamentos.", fonte: PORTAL },
]);

/** As colunas do CSV de um dicionário: o cabeçalho é o nome do campo (o mesmo do JSON), legível por máquina. */
export function colunasCsv<T>(dicionario: readonly CampoDicionario<T>[]): ColunaCsv<T>[] {
  return dicionario.map((d) => ({
    titulo: d.campo,
    valor: (l: T) => {
      const v = (l as Record<string, unknown>)[d.campo];
      if (v === null || v === undefined) return null;
      if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return d.identificador && typeof v === "number" ? String(v) : v;
      return String(v);
    },
    texto: d.identificador,
    decimais: d.tipo === "número (reais)" ? 2 : undefined,
  }));
}

/**
 * Os valores em reais com duas casas também no JSON (`0.00`, `1761109.30`), como no dicionário: o `JSON.stringify`
 * escreve `0`, então o valor vai marcado (`reais`) e a marca vira o número literal com duas casas no texto final.
 */
export const reais = (v: unknown): unknown => (typeof v === "number" && Number.isFinite(v) ? `\u0001reais:${(Math.round(v * 100) / 100 || 0).toFixed(2)}` : v);
export function jsonComReais(valor: unknown): string {
  return JSON.stringify(valor).replace(/"\\u0001reais:(-?\d+\.\d{2})"/g, "$1");
}

/** O CSV (`;`, BOM, vírgula decimal, DD/MM/AAAA, proteção de fórmula): o cabeçalho na primeira linha, sem notas em cima. */
export function csvDe<T>(dicionario: readonly CampoDicionario<T>[], linhas: readonly T[]): string {
  return paraCsv(colunasCsv(dicionario), [...linhas]);
}

/** Os metadados do JSON: o que é, as fontes, a data do dado, a licença, como citar e o recorte. */
export interface Metadados {
  titulo: string;
  descricao: string;
  fontes: string[];
  /** A referência: a data do arquivo de emendas do Portal da Transparência (AAAA-MM-DD). */
  dados_do_portal_de: string | null;
  /** A coleta: quando a PONTE terminou de ler as fontes (AAAA-MM-DD). */
  lidos_pela_ponte_em: string | null;
  /** A data de cada fonte, dizendo de quê. */
  datas_das_fontes: { fonte: string; data: string }[];
  /** Quando este arquivo foi gerado (AAAA-MM-DD). */
  gerado_em: string;
  licenca: string;
  licenca_url: string;
  como_citar: string;
  dicionario: string;
  aviso: string;
  recorte: string[];
  total: number;
}

export const LICENCA = "Creative Commons Atribuição 4.0 Internacional (CC BY 4.0)";
export const LICENCA_URL = "https://creativecommons.org/licenses/by/4.0/deed.pt_BR";
export const AVISO_FIXO =
  "Portal mantido pela PONTE com dados públicos oficiais. Não é portal de ente público e não substitui o Portal da Transparência " +
  "nem o portal de cada município. Usa a matriz do PNTP 2026 como referência de qualidade; não foi avaliado pelo programa.";
/** O aviso de domínio oficial (decisão do titular, 17/11/2026): no rodapé e na Ajuda, em tom factual. */
export const AVISO_DE_DOMINIO =
  "Este portal só existe em ponteprojetos.com.br/emendas. A PONTE não intermedeia emendas nem pede pagamento ou dados pessoais.";
export const FONTES_DO_PORTAL: readonly string[] = Object.freeze([
  "Portal da Transparência (CGU): arquivo de emendas parlamentares e pagamentos a favorecidos",
  "Transferegov: convênios e contratos de repasse (SICONV) e transferências especiais",
  "Fundo Nacional de Saúde: propostas e pagamentos fundo a fundo",
]);

/** "PONTE … Emendas parlamentares federais com destino à Paraíba (dados abertos). Dado de 30/10/2026. …" */
export function comoCitar(dadoAte: string | null, site: string, acesso: string, lidoEm: string | null = null): string {
  const d = dataBrasilia(dadoAte, "");
  const l = dataBrasilia(lidoEm, "");
  return (
    "PONTE Estruturação de Projetos de Impacto. Emendas parlamentares federais com destino à Paraíba: dados abertos, " +
    "a partir do Portal da Transparência (CGU), do Transferegov e do Fundo Nacional de Saúde. " +
    `${d ? `Dados do Portal da Transparência de ${d}${l ? `, lidos pela PONTE em ${l}` : ""}. ` : ""}` +
    `Disponível em ${site.replace(/\/$/, "")}${BASE_PORTAL}/dados. Acesso em ${dataBrasilia(acesso)}.`
  );
}

export function metadados(o: {
  titulo: string;
  descricao: string;
  execucao: Pick<ExecucaoPublica, "dadoAte"> & Partial<Pick<ExecucaoPublica, "concluidaEm" | "painelDadoAte" | "pixDadoAte">>;
  geradoEm: string;
  site: string;
  recorte?: string[];
  total: number;
}): Metadados {
  return {
    titulo: o.titulo,
    descricao: o.descricao,
    fontes: [...FONTES_DO_PORTAL],
    dados_do_portal_de: o.execucao.dadoAte ? diaBrasilia(o.execucao.dadoAte) : null,
    lidos_pela_ponte_em: o.execucao.concluidaEm ? diaBrasilia(o.execucao.concluidaEm) : null,
    datas_das_fontes: datasDasFontes({
      dadoAte: o.execucao.dadoAte,
      concluidaEm: o.execucao.concluidaEm ?? null,
      painelDadoAte: o.execucao.painelDadoAte ?? null,
      pixDadoAte: o.execucao.pixDadoAte ?? null,
    }).map((x) => ({ fonte: x.fonte, data: x.texto })),
    gerado_em: diaBrasilia(o.geradoEm),
    licenca: LICENCA,
    licenca_url: LICENCA_URL,
    como_citar: comoCitar(o.execucao.dadoAte, o.site, o.geradoEm, o.execucao.concluidaEm ?? null),
    dicionario: `${o.site.replace(/\/$/, "")}${BASE_PORTAL}/dados#dicionario`,
    aviso: AVISO_FIXO,
    recorte: o.recorte ?? [],
    total: o.total,
  };
}

/**
 * O JSON: `{ metadados, campos, linhas }`. `campos` são os nomes do dicionário, na ordem dele, e cada linha é uma LISTA
 * dos valores nessa ordem (o formato "colunas e linhas"; vazio = `null`). Com o nome do campo repetido em cada linha, o
 * arquivo de 2025 (2.897 registros na execução 13) teria ~3,6 MB, perto do limite de 4,5 MB da resposta de uma função da
 * Vercel; em listas, ~2,0 MB (medição no comentário de `arquivoDoEndereco`, 17/11/2026).
 */
export function jsonDe<T>(dicionario: readonly CampoDicionario<T>[], linhas: readonly T[], meta: Metadados): string {
  const campos = dicionario.map((d) => d.campo);
  const emReais = dicionario.map((d) => d.tipo === "número (reais)");
  const listas = linhas.map((l) => campos.map((c, i) => (emReais[i] ? reais((l as Record<string, unknown>)[c]) : (l as Record<string, unknown>)[c]) ?? null));
  return jsonComReais({ metadados: meta, campos, linhas: listas });
}

/** O nome do arquivo com a data do dado: "emendas-pb-linhas-dado-2026-10-30.csv". */
export function nomeDoArquivo(base: string, dadoAte: string | null, formato: "csv" | "json"): string {
  const d = dadoAte ? diaBrasilia(dadoAte) : "";
  return `emendas-pb-${base}${/^\d{4}-\d{2}-\d{2}$/.test(d) ? `-dado-${d}` : ""}.${formato}`;
}

/** Os arquivos de `/emendas/dados/<arquivo>`. */
export const ARQUIVOS = Object.freeze({
  "linhas.csv": { conjunto: "linhas", formato: "csv" },
  "linhas.json": { conjunto: "linhas", formato: "json" },
  "execucao-orcamentaria.csv": { conjunto: "catalogo", formato: "csv" },
  "execucao-orcamentaria.json": { conjunto: "catalogo", formato: "json" },
  "pessoa-fisica.csv": { conjunto: "pf", formato: "csv" },
  "pessoa-fisica.json": { conjunto: "pf", formato: "json" },
  "recorte.csv": { conjunto: "recorte", formato: "csv" },
  "recorte.json": { conjunto: "recorte", formato: "json" },
} as const);
export type NomeArquivo = keyof typeof ARQUIVOS;
export type Arquivo = (typeof ARQUIVOS)[NomeArquivo] | { conjunto: "ano"; formato: "csv" | "json"; ano: number };

/**
 * Os arquivos POR ANO DA EMENDA (`linhas-AAAA.csv|json`): o caminho principal dos dados abertos (17/11/2026). O arquivo
 * completo da execução 13 tem ~14 MB em CSV e ~28 MB em JSON, e a resposta de uma função da Vercel tem limite de 4,5 MB
 * (a resposta em partes pode passar, mas não está garantido na documentação). Um ano cabe com folga. Medido em
 * 17/11/2026: o tamanho de cada linha da execução 13 por consulta de leitura na produção, calibrado no ensaio com o
 * CSV e o JSON que este módulo gera das mesmas linhas (o CSV real deu 0,92 da estimativa; o JSON em listas, a
 * estimativa com chaves menos ~574 B de nomes de campo por linha):
 *   · o pior ano é 2025: 2.897 registros (1.813 do FNS), CSV ~1,8–1,9 MB e JSON em listas ~2,0 MB (com o nome do campo
 *     em cada linha seriam ~3,6 MB); 2024: 2.621 registros, CSV ~1,7 MB e JSON ~1,7 MB; 2026 (ano em curso): 2.593,
 *     CSV ~1,7 MB e JSON ~1,75 MB;
 *   · por registro: ~650 B no CSV e ~680 B no JSON em listas; o maior registro tem ~6 kB (objeto longo);
 *   · o arquivo completo: CSV ~13–14 MB e JSON em listas ~14,5 MB.
 * Um ano só chegaria a 4,5 MB com uns 6,5 mil registros, mais que o dobro do pior de hoje.
 */
export const ANO_MINIMO_ARQUIVO = 2000;
export const ANO_MAXIMO_ARQUIVO = 2100;

export function arquivoDoEndereco(nome: string): Arquivo | null {
  if (Object.prototype.hasOwnProperty.call(ARQUIVOS, nome)) return ARQUIVOS[nome as NomeArquivo];
  const m = /^linhas-(\d{4})\.(csv|json)$/.exec(nome);
  if (!m) return null;
  const ano = Number(m[1]);
  if (ano < ANO_MINIMO_ARQUIVO || ano > ANO_MAXIMO_ARQUIVO) return null;
  return { conjunto: "ano", formato: m[2] as "csv" | "json", ano };
}

/** O ano de um instante, em Brasília (o ano corrente da lista de arquivos). */
export function anoDeBrasilia(iso: string): number {
  return Number(diaBrasilia(iso).slice(0, 4));
}

/** O endereço do arquivo de um ano. */
export const urlDoArquivoDoAno = (ano: number, formato: "csv" | "json") => `${BASE_PORTAL}/dados/linhas-${ano}.${formato}`;

/** A consulta das linhas de um ano da emenda (o filtro "Ano" de..até no mesmo ano). */
export function consultaDoAno(ano: number): ConsultaLista {
  return { estado: { filtros: { ano: { tipo: "numero", de: ano, ate: ano } }, ordem: null }, busca: "", pagina: 1 };
}

/**
 * Os anos da lista de arquivos, do mais recente ao mais antigo: de 2014 (ou do primeiro ano com dado, se antes) até o
 * ano corrente (ou o último com dado), com o número de registros de cada um quando o agregado veio (`grupo = 'ano'`);
 * sem o agregado (banco fora do ar), o número fica nulo e a lista sai do mesmo jeito.
 */
export function anosDosArquivos(agregado: readonly AgregadoPublico[] | null, anoAtual: number): { ano: number; linhas: number | null }[] {
  const contagem = new Map<number, number>();
  for (const a of agregado ?? []) if (a.grupo === "ano" && a.ano !== null) contagem.set(a.ano, a.linhas);
  const anos = [...contagem.keys()];
  const inicio = Math.min(ANO_INICIAL_SERIE, ...anos);
  const fim = Math.max(anoAtual, ...anos);
  const saida: { ano: number; linhas: number | null }[] = [];
  for (let ano = fim; ano >= inicio; ano -= 1) saida.push({ ano, linhas: agregado ? (contagem.get(ano) ?? 0) : null });
  return saida;
}

// ================================================================ as somas: série, função, forma, total

export interface Soma {
  emendas: number;
  linhas: number;
  previsto: number;
  pago: number;
}
const ZERO: Soma = Object.freeze({ emendas: 0, linhas: 0, previsto: 0, pago: 0 });
const somaDe = (a: Pick<AgregadoPublico, "emendas" | "linhas" | "previsto" | "pago">): Soma => ({
  emendas: a.emendas,
  linhas: a.linhas,
  previsto: a.previsto,
  pago: a.pago,
});

/** O total do recorte (a linha `grupo = 'total'`), ou zeros. */
export function totalDoAgregado(agregado: readonly AgregadoPublico[]): Soma {
  const t = agregado.find((a) => a.grupo === "total");
  return t ? somaDe(t) : { ...ZERO };
}

/** O ano de início da série: o arquivo de emendas do Portal começa em 2014 (os anos antes vêm só dos convênios). */
export const ANO_INICIAL_SERIE = 2014;

export interface AnoDaSerie {
  ano: number;
  total: Soma;
  porChave: Record<string, Soma>;
}

/**
 * A série por ano, com uma coluna por tipo de emenda ou por forma de repasse: todo ano de 2014 (ou do primeiro com dado)
 * até o último com dado, os anos sem nada com zero (a série histórica não pula ano). O total do ano conta as emendas
 * distintas (a linha `grupo = 'ano'`); o ano não identificado (a proposta do FNS sem detalhe) fica em `semAno`.
 */
export function serieAnual(
  agregado: readonly AgregadoPublico[],
  dimensao: "tipo" | "canal",
): { anos: AnoDaSerie[]; chaves: string[]; semAno: Soma | null } {
  const grupo = dimensao === "tipo" ? "ano_tipo" : "ano_canal";
  const ordem: readonly string[] = dimensao === "tipo" ? TIPOS_EMENDA : FORMAS;
  const porAno = new Map<number, AnoDaSerie>();
  const chaves = new Set<string>();
  let semAno: Soma | null = null;
  const doAno = (ano: number) => {
    let x = porAno.get(ano);
    if (!x) {
      x = { ano, total: { ...ZERO }, porChave: {} };
      porAno.set(ano, x);
    }
    return x;
  };
  for (const a of agregado) {
    if (a.grupo === "ano") {
      if (a.ano === null) semAno = somaDe(a);
      else doAno(a.ano).total = somaDe(a);
    } else if (a.grupo === grupo && a.ano !== null) {
      const chave = (dimensao === "tipo" ? a.tipo : a.canal) ?? "";
      chaves.add(chave);
      doAno(a.ano).porChave[chave] = somaDe(a);
    }
  }
  const anos = [...porAno.keys()];
  const fim = anos.length ? Math.max(...anos) : ANO_INICIAL_SERIE;
  const inicio = Math.min(ANO_INICIAL_SERIE, ...(anos.length ? anos : [ANO_INICIAL_SERIE]));
  const serie: AnoDaSerie[] = [];
  for (let ano = inicio; ano <= fim; ano += 1) serie.push(porAno.get(ano) ?? { ano, total: { ...ZERO }, porChave: {} });
  const ordenadas = [...chaves].sort((a, b) => {
    const ia = ordem.indexOf(a);
    const ib = ordem.indexOf(b);
    return (ia < 0 ? ordem.length : ia) - (ib < 0 ? ordem.length : ib);
  });
  return { anos: serie, chaves: ordenadas, semAno };
}

/** Por função de governo, em ordem ALFABÉTICA (nunca por valor); a função não informada no fim, como "Não consta". */
export function porFuncao(agregado: readonly AgregadoPublico[]): { funcao: string; soma: Soma }[] {
  return agregado
    .filter((a) => a.grupo === "funcao")
    .map((a) => ({ funcao: a.funcao && a.funcao.trim() ? a.funcao : FUNCAO_NAO_CONSTA, soma: somaDe(a) }))
    .sort((a, b) => (a.funcao === FUNCAO_NAO_CONSTA ? 1 : b.funcao === FUNCAO_NAO_CONSTA ? -1 : a.funcao.localeCompare(b.funcao, "pt-BR")));
}

/** Por forma de repasse, na ordem fixa. */
export function porForma(agregado: readonly AgregadoPublico[]): { canal: CanalEmenda; soma: Soma }[] {
  const m = new Map(agregado.filter((a) => a.grupo === "canal" && a.canal).map((a) => [a.canal as CanalEmenda, somaDe(a)]));
  return FORMAS.filter((c) => m.has(c)).map((c) => ({ canal: c, soma: m.get(c) as Soma }));
}

/** Por tipo do destino, na ordem fixa; o não informado no fim. */
export function porEnte(agregado: readonly AgregadoPublico[]): { ente: EnteTipoEmenda | null; soma: Soma }[] {
  const linhas = agregado.filter((a) => a.grupo === "ente");
  const pos = (e: EnteTipoEmenda | null) => (e === null ? ENTES.length + 1 : ENTES.indexOf(e) < 0 ? ENTES.length : ENTES.indexOf(e));
  return linhas.map((a) => ({ ente: a.ente_tipo, soma: somaDe(a) })).sort((a, b) => pos(a.ente) - pos(b.ente));
}

/** A largura relativa de uma barra (0 a 100), para o desenho da série; zero e negativo: 0. */
export function largura(valor: number, maximo: number): number {
  if (!(maximo > 0) || !(valor > 0)) return 0;
  return Math.max(0.5, Math.min(100, (valor / maximo) * 100));
}

// ================================================================ autores e municípios (listas em ordem alfabética)

const nomeOrdenavel = (s: string | null | undefined) => (s ?? "").trim();

/**
 * Os autores em ordem ALFABÉTICA, separados: os individuais e, à parte, a autoria coletiva (bancada, comissão e
 * relator-geral). Só entram os que têm alguma linha na PB ou emenda do catálogo com a PB na localidade.
 */
export function separarAutores(autores: readonly AutorPublico[]): { individuais: AutorPublico[]; coletivos: AutorPublico[] } {
  const comPb = autores.filter((a) => a.linhas > 0 || a.emendas_catalogo_pb > 0);
  const alfabetica = (a: AutorPublico, b: AutorPublico) =>
    nomeOrdenavel(a.nome).localeCompare(nomeOrdenavel(b.nome), "pt-BR", { sensitivity: "base" }) || (a.codigo < b.codigo ? -1 : 1);
  return {
    individuais: comPb.filter((a) => !a.coletivo).sort(alfabetica),
    coletivos: comPb.filter((a) => a.coletivo).sort(alfabetica),
  };
}

export const ROTULO_TIPO_AUTOR_PUBLICO: Readonly<Record<TipoAutor, string>> = Object.freeze({
  individual: "Individual (deputado ou senador)",
  bancada: "Bancada",
  comissao: "Comissão",
  relator: "Relator-geral",
  outro: "Outro",
});

export const COLUNAS_AUTORES: ColunaTabela[] = [
  { id: "nome", titulo: "Autoria", tipo: "texto" },
  { id: "tipo", titulo: "Tipo", tipo: "categoria" },
  num("emendas", "Emendas com registro na PB"),
  num("municipios", "Municípios"),
  { id: "anos", titulo: "Anos", tipo: "texto" },
  num("previsto", "Previsto"),
  num("pago", "Realizado (pago)"),
  { id: "codigo", titulo: "Código do autor", tipo: "texto", textoNoCsv: true, oculta: true },
];

export function valoresDoAutor(a: AutorPublico): Record<string, ValorCelula> {
  return {
    nome: a.nome ?? `Autor ${a.codigo}`,
    tipo: ROTULO_TIPO_AUTOR_PUBLICO[a.tipo] ?? a.tipo,
    emendas: a.emendas,
    municipios: a.municipios,
    anos: a.ano_min === null ? null : a.ano_min === a.ano_max ? String(a.ano_min) : `${a.ano_min}–${a.ano_max}`,
    previsto: a.previsto,
    pago: a.pago,
    codigo: a.codigo,
  };
}

/** Os 223 em ordem ALFABÉTICA; o estado e o "sem município" à parte. */
export function separarMunicipios(m: readonly MunicipioPublico[]): {
  municipios: MunicipioPublico[];
  estado: MunicipioPublico | null;
  semMunicipio: MunicipioPublico | null;
} {
  return {
    municipios: m.filter((x) => x.grupo === "municipio").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || ((a.ibge ?? "") < (b.ibge ?? "") ? -1 : 1)),
    estado: m.find((x) => x.grupo === "estado") ?? null,
    semMunicipio: m.find((x) => x.grupo === "sem_municipio") ?? null,
  };
}

export const COLUNAS_MUNICIPIOS: ColunaTabela[] = [
  { id: "nome", titulo: "Município", tipo: "texto" },
  num("emendas", "Emendas"),
  num("linhas", "Registros"),
  num("previsto", "Previsto"),
  num("pago", "Realizado (pago)"),
  num("entidades", "Pago a entidades com sede no município"),
  num("convenio", "Convênio (pago)", { oculta: true }),
  num("pix", "Transferência especial (pago)", { oculta: true }),
  num("fns", "Fundo a fundo da saúde (pago)", { oculta: true }),
  num("favorecido", "Pagamento direto (pago)", { oculta: true }),
  { id: "ibge", titulo: "Código IBGE", tipo: "texto", textoNoCsv: true, oculta: true },
];

export function valoresDoMunicipio(m: MunicipioPublico): Record<string, ValorCelula> {
  return {
    nome: m.nome,
    emendas: m.emendas,
    linhas: m.linhas,
    previsto: m.previsto,
    pago: m.pago,
    entidades: m.entidades_pago,
    convenio: m.convenio_pago,
    pix: m.pix_pago,
    fns: m.fns_pago,
    favorecido: m.favorecido_pago,
    ibge: m.ibge,
  };
}

/** Quantos municípios têm algum registro (para a frase "n de 223"). */
export function municipiosComRegistro(m: readonly MunicipioPublico[]): number {
  return m.filter((x) => x.grupo === "municipio" && x.linhas > 0).length;
}

// ================================================================ a ficha da emenda

/** A execução orçamentária do catálogo na PB (17.3): a soma das linhas com a PB na localidade. */
export function execucaoNaPb(catalogo: readonly LinhaCatalogo[]): {
  linhas: LinhaCatalogo[];
  fora: string[];
  soma: { empenhado: number; liquidado: number; pago: number; rp_pago: number; rp_cancelado: number; pago_total: number; a_pagar: number };
} {
  const pb = catalogo.filter((l) => l.pb_localidade);
  const v = (x: number | null) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  const soma = { empenhado: 0, liquidado: 0, pago: 0, rp_pago: 0, rp_cancelado: 0, pago_total: 0, a_pagar: 0 };
  for (const l of pb) {
    soma.empenhado += v(l.empenhado);
    soma.liquidado += v(l.liquidado);
    soma.pago += v(l.pago);
    soma.rp_pago += v(l.rp_pago);
    soma.rp_cancelado += v(l.rp_cancelado);
    soma.pago_total += v(l.pago_total);
    soma.a_pagar += v(l.a_pagar);
  }
  const fora = [...new Set(catalogo.filter((l) => !l.pb_localidade).map((l) => (l.localidade ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  return { linhas: pb, fora, soma };
}

/** Os dados de identificação da emenda (17.1), da primeira linha que os tem: o catálogo primeiro, depois o canal. */
export interface IdentificacaoEmenda {
  codigo: string;
  ano: number | null;
  numero: string | null;
  tipo: TipoEmenda | null;
  tipo_texto: string | null;
  autor_codigo: string | null;
  autor_nome: string | null;
  coletivo: boolean;
  funcao: string | null;
  subfuncao: string | null;
  programa: string | null;
  acao: string | null;
  no_catalogo: boolean;
}

export function identificacaoDaEmenda(codigo: string, linhas: readonly LinhaPublica[], catalogo: readonly LinhaCatalogo[]): IdentificacaoEmenda {
  const c = catalogo.find((l) => l.pb_localidade) ?? catalogo[0];
  const l = linhas[0];
  return {
    codigo,
    ano: c?.ano ?? l?.ano ?? (Number(codigo.slice(0, 4)) || null),
    numero: c?.numero ?? l?.numero ?? codigo.slice(8),
    tipo: c?.tipo ?? l?.tipo ?? null,
    tipo_texto: c?.tipo_texto ?? l?.tipo_texto ?? null,
    autor_codigo: c?.autor_codigo ?? l?.autor_codigo ?? codigo.slice(4, 8),
    autor_nome: c?.autor_nome ?? l?.autor_nome ?? null,
    coletivo: l?.coletivo ?? false,
    funcao: c?.funcao ?? l?.funcao ?? null,
    subfuncao: c?.subfuncao ?? l?.subfuncao ?? null,
    programa: c?.programa ?? l?.programa ?? null,
    acao: c?.acao ?? l?.acao ?? null,
    no_catalogo: catalogo.length > 0 || (l?.no_catalogo ?? false),
  };
}

/**
 * A soma das linhas (dos canais) de um conjunto: previsto, pago e por forma. Os canais não se cobrem (o banco tirou).
 * `comPrevisto` diz se alguma linha tem previsto (só pagamento direto: a tela mostra "—", e não "R$ 0,00").
 */
export function somaDasLinhas(linhas: readonly LinhaPublica[]): {
  previsto: number;
  pago: number;
  comPrevisto: boolean;
  porForma: { canal: CanalEmenda; previsto: number; pago: number; linhas: number }[];
} {
  const m = new Map<CanalEmenda, { previsto: number; pago: number; linhas: number }>();
  let previsto = 0;
  let pago = 0;
  for (const l of linhas) {
    const x = m.get(l.canal) ?? { previsto: 0, pago: 0, linhas: 0 };
    x.previsto += l.previsto ?? 0;
    x.pago += l.pago ?? 0;
    x.linhas += 1;
    m.set(l.canal, x);
    previsto += l.previsto ?? 0;
    pago += l.pago ?? 0;
  }
  return {
    previsto,
    pago,
    comPrevisto: linhas.some((l) => l.previsto !== null),
    porForma: FORMAS.filter((c) => m.has(c)).map((c) => ({ canal: c, ...(m.get(c) as { previsto: number; pago: number; linhas: number }) })),
  };
}

/** As colunas dos caminhos de uma emenda (a ficha): cada linha de canal, com filtro e ordem. */
export const COLUNAS_CAMINHOS: ColunaTabela[] = [
  { id: "forma", titulo: "Forma de repasse", tipo: "categoria" },
  { id: "instrumento", titulo: "Instrumento", tipo: "texto", textoNoCsv: true },
  { id: "destino", titulo: "Destino", tipo: "texto" },
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "objeto", titulo: "Objeto", tipo: "texto" },
  num("previsto", "Previsto"),
  num("pago", "Realizado (pago)"),
  { id: "situacao", titulo: "Situação", tipo: "categoria" },
  { id: "datas", titulo: "Datas", tipo: "texto", ordenavel: false },
  { id: "ente", titulo: "Tipo do destino", tipo: "categoria", oculta: true },
];

export function valoresDoCaminho(l: LinhaPublica): Record<string, ValorCelula> {
  return {
    forma: rotuloForma(l.canal),
    instrumento: l.instrumento,
    destino: nomePublicoDoEnte(l.ente_nome),
    municipio: l.municipio,
    objeto: l.objeto === null ? null : mascararCpf(l.objeto),
    previsto: l.previsto,
    pago: l.pago,
    situacao: rotuloEtapa(l.etapa, l.ano),
    datas: datasDaLinha(l).map((d) => `${d.rotulo} ${d.valor}`).join("; ") || null,
    ente: rotuloEnte(l.ente_tipo),
  };
}

/** As datas de uma linha que existem, com rótulo: assinatura, vigência, pagamentos, fim da execução, prazo que passou. */
export function datasDaLinha(l: LinhaPublica): { rotulo: string; valor: string }[] {
  const d: { rotulo: string; valor: string }[] = [];
  const por = (rotulo: string, v: string | null) => {
    if (v) d.push({ rotulo, valor: data(v) });
  };
  por("assinatura", l.dt_assinatura);
  if (l.vigencia_inicio || l.vigencia_fim) d.push({ rotulo: "vigência", valor: `${data(l.vigencia_inicio)} a ${data(l.vigencia_fim)}` });
  por("primeiro pagamento", l.dt_primeiro_pagamento);
  if (l.dt_ultimo_pagamento && l.dt_ultimo_pagamento !== l.dt_primeiro_pagamento) por("último pagamento", l.dt_ultimo_pagamento);
  por("fim da execução do plano", l.pix_fim_execucao);
  por("prazo de assinatura que passou", l.caducou_em);
  return d;
}

// ================================================================ acessibilidade: preferências por pessoa (13.1, 13.3, 13.4)

/**
 * Versão 2 do desenho (17/11/2026): o painel de acessibilidade tem tema (automático, claro, escuro, alto contraste),
 * tamanho do texto (80% a 160%, de 10 em 10), movimento (normal ou reduzido) e títulos em fonte simples (a Inter no lugar
 * da Bricolage, para baixa visão e dislexia). Quatro cookies, só em `/emendas`, por um ano, gravados só quando a pessoa
 * muda uma opção; "Restaurar padrão" apaga todos. Os dois da versão 1 (`emendas_contraste`, `emendas_fonte`) ainda são
 * lidos (o alto contraste e o tamanho escolhidos continuam) e são apagados na próxima escolha.
 */
export const COOKIE_TEMA = "emendas_tema";
export const COOKIE_TEXTO = "emendas_texto";
export const COOKIE_MOVIMENTO = "emendas_movimento";
export const COOKIE_TITULOS = "emendas_titulos";
export const COOKIES_ANTIGOS = Object.freeze(["emendas_contraste", "emendas_fonte"] as const);
/** Todos os cookies de preferência do portal (o "Restaurar padrão" apaga estes). */
export const COOKIES_DO_PORTAL = Object.freeze([COOKIE_TEMA, COOKIE_TEXTO, COOKIE_MOVIMENTO, COOKIE_TITULOS, ...COOKIES_ANTIGOS]);
/** Um ano: a escolha fica para a próxima visita, só neste navegador e só para isto. */
export const VALIDADE_COOKIE_S = 365 * 24 * 3600;
export type Tema = "sistema" | "claro" | "escuro" | "contraste";
export const TEMAS: readonly { id: Tema; rotulo: string }[] = Object.freeze([
  { id: "sistema", rotulo: "Automático" },
  { id: "claro", rotulo: "Claro" },
  { id: "escuro", rotulo: "Escuro" },
  { id: "contraste", rotulo: "Alto contraste" },
] as { id: Tema; rotulo: string }[]);
export const TEXTO_MIN = 80;
export const TEXTO_MAX = 160;
export const TEXTO_PASSO = 10;

export interface Preferencias {
  tema: Tema;
  /** O tamanho do texto, em porcentagem do padrão (80 a 160). */
  texto: number;
  movimento: "normal" | "reduzido";
  /** Títulos na fonte do texto (Inter) em vez da Bricolage. */
  titulos: "padrao" | "simples";
}
export const PREFERENCIAS_PADRAO: Preferencias = Object.freeze({ tema: "sistema", texto: 100, movimento: "normal", titulos: "padrao" }) as Preferencias;

/** As preferências guardadas (cookies); lixo vira o padrão. Sem os cookies novos, os da versão 1 valem. */
export function lerPreferencias(c: {
  tema?: string | null;
  texto?: string | null;
  movimento?: string | null;
  titulos?: string | null;
  contrasteAntigo?: string | null;
  fonteAntiga?: string | null;
}): Preferencias {
  const tema = TEMAS.some((t) => t.id === c.tema) ? (c.tema as Tema) : c.contrasteAntigo === "alto" ? "contraste" : "sistema";
  const n = Number(c.texto);
  const antigo: Record<string, number> = { "-1": 90, "0": 100, "1": 110, "2": 130, "3": 150 };
  const texto =
    Number.isInteger(n) && n >= TEXTO_MIN && n <= TEXTO_MAX && n % TEXTO_PASSO === 0 ? n : (antigo[String(c.fonteAntiga ?? "")] ?? 100);
  return { tema, texto, movimento: c.movimento === "reduzido" ? "reduzido" : "normal", titulos: c.titulos === "simples" ? "simples" : "padrao" };
}

/**
 * O pedido do painel (`?tema=escuro`, `?texto=mais|menos|normal`, `?movimento=reduzido|normal`,
 * `?titulos=simples|padrao`) aplicado ao de agora. O "Restaurar padrão" (`?restaurar=1`) não passa por aqui: a rota
 * apaga os cookies.
 */
export function aplicarPedido(
  atual: Preferencias,
  pedido: { tema?: string | null; texto?: string | null; movimento?: string | null; titulos?: string | null },
): Preferencias {
  const tema = TEMAS.some((t) => t.id === pedido.tema) ? (pedido.tema as Tema) : atual.tema;
  let texto = atual.texto;
  if (pedido.texto === "mais") texto = Math.min(TEXTO_MAX, texto + TEXTO_PASSO);
  else if (pedido.texto === "menos") texto = Math.max(TEXTO_MIN, texto - TEXTO_PASSO);
  else if (pedido.texto === "normal") texto = 100;
  const movimento = pedido.movimento === "reduzido" ? "reduzido" : pedido.movimento === "normal" ? "normal" : atual.movimento;
  const titulos = pedido.titulos === "simples" ? "simples" : pedido.titulos === "padrao" ? "padrao" : atual.titulos;
  return { tema, texto, movimento, titulos };
}

/**
 * Para onde voltar depois de trocar a preferência: a página do portal de onde a pessoa veio (o `Referer`, só se for do
 * mesmo site e de dentro de `/emendas`), com a consulta; qualquer outra coisa volta ao início do portal. Nunca leva para
 * fora (sem redirecionamento aberto).
 */
export function voltaSegura(referer: string | null | undefined, origemDoPedido: string): string {
  if (!referer) return BASE_PORTAL;
  let u: URL;
  let o: URL;
  try {
    u = new URL(referer);
    o = new URL(origemDoPedido);
  } catch {
    return BASE_PORTAL;
  }
  if (u.origin !== o.origin) return BASE_PORTAL;
  const caminho = u.pathname;
  if (caminho !== BASE_PORTAL && !caminho.startsWith(`${BASE_PORTAL}/`)) return BASE_PORTAL;
  if (caminho.startsWith(`${BASE_PORTAL}/preferencias`) || caminho.includes("//") || caminho.includes("\\")) return BASE_PORTAL;
  return `${caminho}${u.search}`;
}

// ================================================================ a autoavaliação pelo PNTP (sem selo)

export type SituacaoPntp = "atende" | "parcial" | "nao_se_aplica";
export interface ItemPntp {
  criterio: string;
  exige: string;
  faz: string;
  situacao: SituacaoPntp;
}
export const ROTULO_SITUACAO_PNTP: Readonly<Record<SituacaoPntp, string>> = Object.freeze({
  atende: "Atende",
  parcial: "Atende em parte",
  nao_se_aplica: "Não se aplica",
});

/**
 * A autoavaliação item por item, pela matriz do PNTP 2026 (lida em 17/11/2026). É a régua de qualidade que o portal
 * escolheu, não uma avaliação do programa: a PONTE não é jurisdicionada e o portal não tem selo.
 */
export const AUTOAVALIACAO_PNTP: readonly ItemPntp[] = Object.freeze([
  {
    criterio: "17.1 — Emendas federais recebidas",
    exige: "Origem, forma de repasse, tipo, número, autoria, valor previsto e realizado, objeto e função de governo.",
    faz: "A lista e a ficha de cada emenda trazem os oito campos, por destino na Paraíba. O valor previsto é o indicado pelo autor; no pagamento direto ao favorecido, o Portal só publica o pago. O objeto é o do convênio, do plano de ação ou da proposta do FNS; no pagamento direto, a ação orçamentária.",
    situacao: "atende",
  },
  {
    criterio: "17.3 — Execução orçamentária e financeira",
    exige: "A execução orçamentária e financeira das emendas recebidas.",
    faz: "A ficha mostra empenhado, liquidado, pago, restos a pagar pagos e cancelados e o que falta pagar (só a parte da Paraíba), e, por instrumento, o previsto, o pago, a situação, as datas e, no convênio, o desembolsado e a vigência. Arquivo próprio em dados abertos.",
    situacao: "atende",
  },
  {
    criterio: "17.2 — Emendas estaduais e municipais",
    exige: "As mesmas informações para as emendas estaduais e municipais.",
    faz: "Fora deste portal por ora (escopo: emendas federais). As emendas estaduais da Paraíba e as da Câmara de João Pessoa já estão na base da PONTE e ficam para uma etapa seguinte.",
    situacao: "nao_se_aplica",
  },
  {
    criterio: "Atualidade e série histórica",
    exige: "Dado atualizado e série dos três anos anteriores (2023 a 2025).",
    faz: "Atualizado toda semana, com a data do dado em todas as páginas; a série vai de 2014 (início do arquivo do Portal) ao ano corrente, e os convênios desde 2010.",
    situacao: "atende",
  },
  {
    criterio: "Gravação de relatórios",
    exige: "Exportação em formato editável (não só PDF).",
    faz: "CSV e JSON por ano da emenda, do arquivo completo e de qualquer recorte filtrado, sem cadastro.",
    situacao: "atende",
  },
  {
    criterio: "Filtro de pesquisa",
    exige: "Filtro de pesquisa nas informações.",
    faz: "Filtro e ordem em cada coluna, busca geral, estado do filtro no endereço (para compartilhar) e paginação.",
    situacao: "atende",
  },
  {
    criterio: "1.4 — Ferramenta de pesquisa",
    exige: "Campo de busca no portal.",
    faz: "Campo de busca em todas as páginas, que funciona sem JavaScript.",
    situacao: "atende",
  },
  {
    criterio: "2.7 — Perguntas frequentes",
    exige: "Seção de perguntas frequentes.",
    faz: "Página de perguntas frequentes sobre o portal e o dado.",
    situacao: "atende",
  },
  {
    criterio: "13.1 — Símbolo de acessibilidade em destaque",
    exige: "Símbolo de acessibilidade visível, com os recursos do portal.",
    faz: "Símbolo e barra de acessibilidade no topo de todas as páginas, com a página que explica os recursos.",
    situacao: "atende",
  },
  {
    criterio: "13.2 — Caminho percorrido",
    exige: "Trilha de navegação.",
    faz: "Trilha “Onde você está” em todas as páginas.",
    situacao: "atende",
  },
  {
    criterio: "13.3 — Alto contraste",
    exige: "Alternativa de alto contraste.",
    faz: "Tema Alto contraste no painel de acessibilidade (além de Automático, Claro e Escuro), guardado para a próxima visita; funciona sem JavaScript.",
    situacao: "atende",
  },
  {
    criterio: "13.4 — Redimensionamento de texto",
    exige: "Aumentar e diminuir o texto.",
    faz: "Botões A− e A+ no painel de acessibilidade, de 80% a 160%, guardados para a próxima visita; o zoom do navegador também funciona sem quebrar a página.",
    situacao: "atende",
  },
  {
    criterio: "13.5 — Mapa do site",
    exige: "Mapa do site.",
    faz: "Página de mapa do site com todas as páginas e arquivos do portal.",
    situacao: "atende",
  },
  {
    criterio: "15.2 — Política de privacidade",
    exige: "Política de privacidade publicada.",
    faz: "A política de privacidade do site vale para o portal; o portal não pede cadastro nem guarda dado de quem visita, só as preferências de acessibilidade escolhidas (em cookies deste navegador).",
    situacao: "parcial",
  },
  {
    criterio: "15.4 — Dados abertos",
    exige: "Dados legíveis por máquina, com as regras de utilização.",
    faz: "CSV e JSON (um arquivo por ano da emenda e o completo), com dicionário de dados, licença CC BY 4.0, como citar e data do dado na página de dados abertos.",
    situacao: "atende",
  },
  {
    criterio: "5.1 — Convênios recebidos (no canal convênio)",
    exige: "Número e ano, valor previsto, valor recebido, objeto, vigência, concedente e inteiro teor.",
    faz: "A ficha da emenda traz o número, a assinatura, o previsto da emenda, o repasse e o desembolsado do convênio, o objeto, a vigência e o concedente. Cada convênio abre direto na consulta pública do Transferegov, e a emenda no Portal da Transparência.",
    situacao: "parcial",
  },
]);
