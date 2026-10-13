/**
 * Dinheiro federal nas despesas dos municípios da PB (TCE-PB), cruzado com o SICONV (onda 12, parte 3B).
 *
 * O job (`tce_federal/`) grava, a cada rodada:
 *   · `tce_pix_municipio` e `tce_pix_credor`: a transferência especial da União (fonte 706, o "Pix") como
 *     o município gastou, por grupo de natureza, e as empresas que receberam;
 *   · `tce_federal_par`: por município, ano e CNPJ, o que o TCE registra pago (fonte de convênio federal,
 *     Pix e o resto) e o que o SICONV registra, com a situação do casamento;
 *   · `tce_federal_municipio`: os totais da conciliação;
 *   · `tce_cobertura`: que arquivo do TCE foi lido.
 *
 * Regra de redação: o que não casa é "a conferir", nunca irregularidade. O TCE não traz o número do
 * convênio: o casamento é por evidência (município, CNPJ, ano). As marcas do Pix citam o dispositivo da
 * Constituição e ficam versionadas. As normas foram lidas em 29/09/2026 (onda 13A): os 70% em capital da
 * LC 210/2024 (art. 10, XIX) contam por autor, e o laudo do plano (pix-laudo.ts) os confere assim; a marca
 * de capital por município, aqui, é indício para olhar.
 *
 * Função pura, sem banco e sem relógio.
 */
import { formatarData } from "./central.ts";
import { moedaCurta } from "./radar.ts";
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";

export interface TceExecucao {
  id: number;
  dado_ate: string | null;
  referencia: string | null;
  contagens: Record<string, unknown> | null;
}

export interface TceCobertura {
  ibge: string;
  ano: number;
  lido: boolean;
  modificado: string | null;
  coletado_em: string | null;
  motivo: string | null;
}

export interface TcePixMunicipio {
  ibge: string;
  ano: number;
  municipio: string | null;
  empenhado: number;
  liquidado: number;
  pago: number;
  pago_pessoal: number;
  pago_juros: number;
  pago_correntes: number;
  pago_investimentos: number;
  pago_inversoes: number;
  pago_amortizacao: number;
  pct_capital: number | null;
  n_empenhos: number;
  n_credores_pj: number;
  pago_pj: number;
  pago_pf: number;
  pago_emenda_individual: number;
  pago_emenda_bancada: number;
  pago_emenda_comissao: number;
  pago_com_licitacao: number;
  pago_com_obra: number;
}

export interface TcePixCredor {
  ibge: string;
  ano: number;
  cnpj: string;
  nome: string | null;
  pago: number;
  pago_investimentos: number;
  n_empenhos: number;
}

export type SituacaoPar = "casado" | "casado_ano_seguinte" | "casado_ano_anterior" | "so_siconv" | "so_tce" | "nao_verificado";

export interface TceFederalPar {
  ibge: string;
  ano: number;
  cnpj: string;
  nome: string | null;
  tce_convenio: number;
  tce_pix: number;
  tce_outras: number;
  siconv: number;
  convenios: string[];
  situacao: SituacaoPar;
}

export interface TceFederalMunicipio {
  ibge: string;
  ano: number;
  municipio: string | null;
  coberto: boolean;
  siconv_pj: number;
  siconv_casado: number;
  siconv_so: number;
  siconv_nao_verificado: number;
  tce_convenio_pj: number;
  tce_convenio_pf: number;
  tce_convenio_casado: number;
  tce_convenio_so: number;
  n_so_siconv: number;
  n_so_tce: number;
}

export const ROTULO_SITUACAO: Record<SituacaoPar, string> = {
  casado: "no SICONV e no TCE-PB",
  casado_ano_seguinte: "no TCE-PB no ano seguinte",
  casado_ano_anterior: "no SICONV no ano anterior",
  so_siconv: "só no SICONV",
  so_tce: "só no TCE-PB",
  nao_verificado: "TCE-PB não verificado",
};

export const CASADO: readonly SituacaoPar[] = ["casado", "casado_ano_seguinte", "casado_ano_anterior"];
export const casou = (s: SituacaoPar) => CASADO.includes(s);

export const urlTce = (ibge?: string) => (ibge ? `/mapa/painel/tce/${encodeURIComponent(ibge)}` : "/mapa/painel/tce");

// ================================================================ Pix: as marcas, com o dispositivo

export const VERSAO_REGRAS_PIX = "2026-09-29.1";
/** Capital mínimo da transferência especial (CF, art. 166-A, § 5º). */
export const CAPITAL_MINIMO = 0.7;
/** Abaixo disto pago no ano, a fatia de capital não é lida: um empenho pequeno faz 0% ou 100%. */
export const PAGO_MINIMO_PIX = 50_000;

export type RegraPix = "pessoal" | "divida" | "capital";

// Pessoal e dívida são vedados (alto); capital abaixo de 70% num ano é indício, porque o § 5º vale para a
// transferência inteira (moderado).
export const REGRAS_PIX: Record<RegraPix, { titulo: string; dispositivo: string; nivel: "alto" | "moderado" }> = {
  pessoal: { titulo: "Pessoal e encargos pagos com o Pix", dispositivo: "CF, art. 166-A, § 1º, I (EC 105/2019)", nivel: "alto" },
  divida: { titulo: "Serviço da dívida pago com o Pix", dispositivo: "CF, art. 166-A, § 1º, II (EC 105/2019)", nivel: "alto" },
  capital: { titulo: "Menos de 70% do pago em capital", dispositivo: "CF, art. 166-A, § 5º (EC 105/2019)", nivel: "moderado" },
};

export interface MarcaPix {
  regra: RegraPix;
  titulo: string;
  dispositivo: string;
  nivel: "alto" | "moderado";
  fato: string;
}

/**
 * O que a despesa do ano mostra contra o art. 166-A. É para conferir, não conclusão: o TCE registra a
 * classificação que o município deu à despesa, e os 70% do § 5º valem para a transferência, não para cada
 * ano de pagamento.
 */
export function marcasPix(p: TcePixMunicipio): MarcaPix[] {
  const m: MarcaPix[] = [];
  const add = (regra: RegraPix, fato: string) => m.push({ regra, ...REGRAS_PIX[regra], fato });
  if (p.pago_pessoal > 0) add("pessoal", `${moedaCurta(p.pago_pessoal)} pagos em pessoal e encargos com a fonte do Pix em ${p.ano}.`);
  const divida = p.pago_juros + p.pago_amortizacao;
  if (divida > 0) add("divida", `${moedaCurta(divida)} pagos em juros e amortização de dívida com a fonte do Pix em ${p.ano}.`);
  if (p.pago >= PAGO_MINIMO_PIX && p.pct_capital !== null && p.pct_capital < CAPITAL_MINIMO) {
    add("capital", `Em ${p.ano}, ${pct(p.pct_capital)} do pago com o Pix foi capital (a CF pede ao menos 70% da transferência especial).`);
  }
  return m;
}

// ================================================================ conciliação

export interface ResumoConciliacao {
  siconv: number;
  siconvCasado: number;
  siconvSo: number;
  naoVerificado: number;
  /** Casado sobre o verificado (sem o "não verificado"); null sem pagamento verificado. */
  taxa: number | null;
  tceConvenio: number;
  tceSo: number;
  nSoSiconv: number;
  nSoTce: number;
}

export function resumirConciliacao(ms: TceFederalMunicipio[]): ResumoConciliacao {
  const s = (f: (m: TceFederalMunicipio) => number) => ms.reduce((t, m) => t + f(m), 0);
  const siconv = s((m) => m.siconv_pj);
  const naoVerificado = s((m) => m.siconv_nao_verificado);
  const siconvCasado = s((m) => m.siconv_casado);
  const verificado = siconv - naoVerificado;
  return {
    siconv,
    siconvCasado,
    siconvSo: s((m) => m.siconv_so),
    naoVerificado,
    taxa: verificado > 0 ? siconvCasado / verificado : null,
    tceConvenio: s((m) => m.tce_convenio_pj),
    tceSo: s((m) => m.tce_convenio_so),
    nSoSiconv: s((m) => m.n_so_siconv),
    nSoTce: s((m) => m.n_so_tce),
  };
}

/**
 * Como o TCE-PB vê um fornecedor num convênio: os pares (município, CNPJ, ano) em que o SICONV registra
 * pagamento deste convênio. Frase curta para a tabela do laudo.
 */
export function tceDoFornecedor(pares: TceFederalPar[], cnpj: string, nrConvenio: string): { frase: string; soSiconv: TceFederalPar[] } | null {
  const meus = pares.filter((p) => p.cnpj === cnpj && p.siconv > 0 && p.convenios.includes(nrConvenio)).sort((a, b) => a.ano - b.ano);
  if (!meus.length) return null;
  const anos = (xs: TceFederalPar[]) => lista(xs.map((p) => String(p.ano)));
  const casados = meus.filter((p) => casou(p.situacao));
  const so = meus.filter((p) => p.situacao === "so_siconv");
  const nv = meus.filter((p) => p.situacao === "nao_verificado");
  const partes = [
    casados.length ? `no TCE-PB em ${anos(casados)}` : null,
    so.length ? `sem registro no TCE-PB em ${anos(so)}` : null,
    nv.length ? `TCE-PB não verificado em ${anos(nv)}` : null,
  ].filter(Boolean);
  return { frase: partes.join("; "), soSiconv: so };
}

export function descreverCobertura(c: TceCobertura[]): string {
  const lidos = c.filter((x) => x.lido).length;
  const datas = c.map((x) => x.coletado_em).filter((x): x is string => !!x).sort();
  const ultima = datas.at(-1);
  return `${n(lidos)} de ${n(c.length)} arquivos de despesa lidos${ultima ? ` (o mais recente em ${formatarData(ultima)})` : ""}`;
}

const n = (x: number) => x.toLocaleString("pt-BR");
export const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);

// ================================================================ as tabelas das telas (onda 15, fase 2, lote C, 13/10/2026)

/**
 * As quatro listas do TCE-PB com filtro e ordem em cada coluna (a regra do titular de 13/10/2026; telas de
 * administrador, toda coluna ordena). As células continuam as de antes; aqui ficam os valores crus. As colunas ocultas
 * levam o que a célula junta (o IBGE, as empresas, as marcas, o CNPJ, os convênios). Percentual vai de 0 a 100, com
 * uma casa: "de 50" no filtro é 50%.
 *
 * O nome da empresa e o CNPJ chegam prontos da tela (`nomeFornecedor`, que mascara o CPF que vem colado no nome do
 * MEI, e `cnpjLegivel`): `fornecedores.ts` importa este arquivo, e importar de volta faria um ciclo.
 */
export const TABELA_TCE_PIX = "pix";
export const TABELA_TCE_CONCILIACAO = "conciliacao";
export const TABELA_TCE_EMPRESAS_PIX = "empresas-pix";
export const TABELA_TCE_PARES = "pares";

/** O nome curto de cada marca do Pix (a etiqueta da tabela e a legenda; saiu de `TceConteudo` para a coluna "Marcas"). */
export const ROTULO_MARCA_PIX: Record<RegraPix, string> = { pessoal: "pessoal", divida: "dívida", capital: "capital < 70%" };

/** Fração de 0 a 1 em percentual de 0 a 100, com uma casa; null fica null. */
const emPercentual = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 1000) / 10);

export const COLUNAS_TCE_PIX: ColunaTabela[] = [
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "ibge", titulo: "IBGE", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "empresas", titulo: "Empresas pagas", tipo: "numero", oculta: true },
  { id: "marcas", titulo: "Marcas", tipo: "texto", oculta: true },
  { id: "n-marcas", titulo: "Quantas marcas", tipo: "numero", oculta: true },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "emenda-individual", titulo: "Pago de emenda individual", tipo: "numero", oculta: true },
  { id: "capital", titulo: "Capital (%)", tipo: "numero", alinhar: "direita" },
  { id: "pessoal-divida", titulo: "Pessoal e dívida", tipo: "numero", alinhar: "direita" },
];

export function valoresTcePix(p: TcePixMunicipio): Record<string, ValorCelula> {
  const marcas = marcasPix(p);
  return {
    municipio: p.municipio ?? `IBGE ${p.ibge}`,
    ibge: p.ibge,
    empresas: p.n_credores_pj,
    marcas: marcas.length ? marcas.map((m) => ROTULO_MARCA_PIX[m.regra]).join(", ") : null,
    "n-marcas": marcas.length,
    pago: p.pago,
    "emenda-individual": p.pago_emenda_individual,
    capital: emPercentual(p.pct_capital),
    "pessoal-divida": p.pago_pessoal + p.pago_juros + p.pago_amortizacao,
  };
}

export const COLUNAS_TCE_CONCILIACAO: ColunaTabela[] = [
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "ibge", titulo: "IBGE", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "arquivo", titulo: "Arquivo do TCE-PB", tipo: "categoria", oculta: true },
  { id: "siconv", titulo: "SICONV pagou", tipo: "numero", alinhar: "direita" },
  { id: "achado", titulo: "Achado no TCE-PB (%)", tipo: "numero", alinhar: "direita" },
  { id: "so-siconv", titulo: "Só no SICONV", tipo: "numero", alinhar: "direita" },
  { id: "empresas-so-siconv", titulo: "Empresas só no SICONV", tipo: "numero", oculta: true },
  { id: "convenio-tce", titulo: "Convênio no TCE-PB", tipo: "numero", alinhar: "direita" },
  { id: "so-tce", titulo: "Só no TCE-PB", tipo: "numero", alinhar: "direita" },
  { id: "empresas-so-tce", titulo: "Empresas só no TCE-PB", tipo: "numero", oculta: true },
];

/** O "achado no TCE-PB" é o casado sobre o verificado, como na célula; sem pagamento verificado, null ("—"). */
export function valoresTceConciliacao(m: TceFederalMunicipio): Record<string, ValorCelula> {
  const verificado = m.siconv_pj - m.siconv_nao_verificado;
  return {
    municipio: m.municipio ?? `IBGE ${m.ibge}`,
    ibge: m.ibge,
    arquivo: m.coberto ? "lido" : "ainda não lido",
    siconv: m.siconv_pj,
    achado: verificado > 0 ? emPercentual(m.siconv_casado / verificado) : null,
    "so-siconv": m.siconv_so,
    "empresas-so-siconv": m.n_so_siconv,
    "convenio-tce": m.tce_convenio_pj,
    "so-tce": m.tce_convenio_so,
    "empresas-so-tce": m.n_so_tce,
  };
}

/** O nome e o CNPJ como a tela escreve (ver a nota acima). */
export interface IdentificacaoEmpresa {
  nome: string;
  cnpj: string;
}

export const COLUNAS_TCE_EMPRESAS_PIX: ColunaTabela[] = [
  { id: "empresa", titulo: "Empresa", tipo: "texto" },
  { id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "ano", titulo: "Ano", tipo: "numero" },
  { id: "pago", titulo: "Pago", tipo: "numero", alinhar: "direita" },
  { id: "investimentos", titulo: "Em investimentos", tipo: "numero", alinhar: "direita" },
];

export function valoresTceCredor(c: TcePixCredor, id: IdentificacaoEmpresa): Record<string, ValorCelula> {
  return { empresa: id.nome, cnpj: id.cnpj, ano: c.ano, pago: c.pago, investimentos: c.pago_investimentos };
}

export const COLUNAS_TCE_PARES: ColunaTabela[] = [
  { id: "empresa", titulo: "Empresa", tipo: "texto" },
  { id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "convenios", titulo: "Convênios no SICONV", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "ano", titulo: "Ano", tipo: "numero" },
  { id: "siconv", titulo: "SICONV", tipo: "numero", alinhar: "direita" },
  { id: "tce", titulo: "TCE-PB", tipo: "numero", alinhar: "direita" },
  { id: "tce-convenio", titulo: "TCE-PB de convênio", tipo: "numero", oculta: true },
  { id: "tce-pix", titulo: "TCE-PB do Pix", tipo: "numero", oculta: true },
  { id: "situacao", titulo: "Situação", tipo: "categoria" },
];

/** Os convênios vão todos, separados por vírgula (a célula mostra os 4 primeiros e "e mais N"). */
export function valoresTcePar(p: TceFederalPar, id: IdentificacaoEmpresa): Record<string, ValorCelula> {
  return {
    empresa: id.nome,
    cnpj: id.cnpj,
    convenios: p.convenios.length ? p.convenios.join(", ") : null,
    ano: p.ano,
    siconv: p.siconv,
    tce: p.tce_convenio + p.tce_pix + p.tce_outras,
    "tce-convenio": p.tce_convenio,
    "tce-pix": p.tce_pix,
    situacao: ROTULO_SITUACAO[p.situacao],
  };
}
