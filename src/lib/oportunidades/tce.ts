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
 * Constituição e ficam versionadas; a LC 210/2024 e a IN 93/2024 ainda não foram lidas para elas.
 *
 * Função pura, sem banco e sem relógio.
 */
import { formatarData } from "./central.ts";
import { moedaCurta } from "./radar.ts";

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
