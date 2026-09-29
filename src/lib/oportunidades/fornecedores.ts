/**
 * Fornecedores dos convênios da PB (onda 12, parte 3): o painel administrativo e a seção do laudo.
 *
 * O job (`painel_execucao/fornecedores.py`) grava, a cada execução do painel:
 *   · `painel_fornecedor`: uma empresa por linha, com a atuação na PB e no Brasil e a marca do TCU;
 *   · `painel_fornecedor_convenio`: empresa × convênio, com o valor pago e a fatia no convênio;
 *   · `painel_contrato`: os contratos dos convênios da PB (sem fornecedor quando é pessoa física);
 *   · `painel_fornecedor_municipio`: a concentração nos convênios de cada prefeitura.
 *
 * Decisão do titular (29/09/2026): pessoa física só somada; pessoa jurídica com nome, inclusive MEI e
 * empresário individual, só para administradores. O laudo do cliente não mostra fornecedor.
 *
 * Regra de redação: concentração é indicador para olhar, nunca irregularidade. A lista do TCU diz quem
 * está sancionado hoje; o laudo separa o pagamento feito dentro do período da sanção do feito antes.
 *
 * Função pura, sem banco e sem relógio: `hoje` entra como parâmetro.
 */
import { formatarData } from "./central.ts";
import type { Risco } from "./laudo.ts";
import { moedaCurta } from "./radar.ts";

// ================================================================ linhas do banco

export interface Fornecedor {
  cnpj: string;
  nome: string | null;
  mei: boolean;
  pb_convenios: number;
  pb_municipios: number;
  pb_proponentes: number;
  pb_orgaos: number;
  pb_pago: number;
  pb_n_pagamentos: number;
  pb_primeiro_pagamento: string | null;
  pb_ultimo_pagamento: string | null;
  pb_contratos: number;
  pb_contratado: number;
  br_convenios: number;
  br_ufs: number;
  br_pago: number;
  /** `null`: a lista do TCU não pôde ser lida nesta execução — não é "limpo". */
  inidoneo_tcu: boolean | null;
  tcu_acordao: string | null;
  tcu_inicio: string | null;
  tcu_data_final: string | null;
  tcu_link: string | null;
}

export const COLUNAS_FORNECEDOR =
  "cnpj,nome,mei,pb_convenios,pb_municipios,pb_proponentes,pb_orgaos,pb_pago,pb_n_pagamentos,pb_primeiro_pagamento,pb_ultimo_pagamento," +
  "pb_contratos,pb_contratado,br_convenios,br_ufs,br_pago,inidoneo_tcu,tcu_acordao,tcu_inicio,tcu_data_final,tcu_link";

export interface FornecedorConvenio {
  cnpj: string;
  nr_convenio: string;
  cod_ibge: string | null;
  municipio: string | null;
  proponente: string | null;
  tipo_agente: string | null;
  orgao_sup: string | null;
  cod_programa: string | null;
  pago: number;
  n_pagamentos: number;
  primeiro_pagamento: string | null;
  ultimo_pagamento: string | null;
  /** Fatia no que o convênio pagou a pessoa jurídica (0 a 1). */
  fatia: number | null;
  n_contratos: number;
  contratado: number;
}

export const COLUNAS_FORNECEDOR_CONVENIO =
  "cnpj,nr_convenio,cod_ibge,municipio,proponente,tipo_agente,orgao_sup,cod_programa,pago,n_pagamentos,primeiro_pagamento,ultimo_pagamento," +
  "fatia,n_contratos,contratado";

export interface Contrato {
  nr_convenio: string;
  /** O contrato é identificado pela licitação e pelo número: o ID_CONTRATO sozinho se repete no SICONV. */
  id_licitacao: string;
  id_contrato: string;
  nr_contrato: string | null;
  cnpj: string | null;
  fornecedor: string | null;
  pessoa_fisica: boolean;
  tipo_aquisicao: string | null;
  objeto: string | null;
  valor: number | null;
  dt_assinatura: string | null;
  dt_publicacao: string | null;
  dt_inicio_vigencia: string | null;
  dt_fim_vigencia: string | null;
}

export const COLUNAS_CONTRATO =
  "nr_convenio,id_licitacao,id_contrato,nr_contrato,cnpj,fornecedor,pessoa_fisica,tipo_aquisicao,objeto,valor,dt_assinatura,dt_publicacao," +
  "dt_inicio_vigencia,dt_fim_vigencia";

export interface ConcentracaoMunicipio {
  cod_ibge: string;
  municipio: string | null;
  convenios: number;
  n_fornecedores: number;
  pago_pj: number;
  pago_pf: number;
  maior_cnpj: string | null;
  maior_nome: string | null;
  maior_pago: number | null;
  maior_fatia: number | null;
  hhi: number | null;
}

/** As colunas que a oport_21 acrescentou a `painel_instrumento` (só os da PB têm valor). */
export interface ColunasFornecedorInstrumento {
  pago_pj?: number | null;
  pago_pf?: number | null;
  n_pagamentos_pf?: number | null;
  pago_convenente?: number | null;
  n_fornecedores_pj?: number | null;
  empenhado_corrente?: number | null;
  empenhado_capital?: number | null;
  dt_primeiro_ingresso_contrapartida?: string | null;
  dt_ultimo_ingresso_contrapartida?: string | null;
  n_ingressos_contrapartida?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ================================================================ apresentação

/** "08761124000100" → "08.761.124/0001-00". Outro formato sai como veio. */
export function cnpjLegivel(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const d = cnpj.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
}

/** Só os 14 dígitos, ou `null`: o CNPJ da URL do dossiê nunca vai ao banco sem passar por aqui. */
export function cnpjValido(texto: string | null | undefined): string | null {
  const d = (texto ?? "").replace(/\D/g, "");
  return d.length === 14 ? d : null;
}

// O mesmo padrão do job (`definicoes.REGEX_CPF`): CPF com ou sem pontuação, fora de sequência maior.
const CPF = /(^|[^0-9])[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}(?=[^0-9]|$)/g;

/** Nome para a tela. O job já mascara o CPF da razão social; aqui é a segunda trava. */
export function nomeFornecedor(f: { nome: string | null; cnpj?: string | null }): string {
  const nome = (f.nome ?? "").replace(CPF, "$1***").trim();
  return nome || `CNPJ ${cnpjLegivel(f.cnpj) ?? "não informado"}`;
}

export const urlFornecedor = (cnpj: string) => `/mapa/fornecedor/${encodeURIComponent(cnpj)}`;

// ================================================================ concentração

export type FaixaConcentracao = "alta" | "moderada" | "baixa" | "pouco_dado";

/** Abaixo disto pago a empresas, a concentração não é lida: dois ou três contratos pequenos dão 100%. */
export const PAGO_MINIMO_CONCENTRACAO = 1_000_000;
/** Um fornecedor com mais da metade do que a prefeitura pagou a empresas. */
export const FATIA_ALTA = 0.5;
/** HHI (soma dos quadrados das fatias) a partir do qual a compra está concentrada em poucos. */
export const HHI_MODERADO = 0.25;

export const ROTULO_FAIXA: Record<FaixaConcentracao, string> = {
  alta: "um fornecedor com mais da metade",
  moderada: "concentrada em poucos",
  baixa: "distribuída",
  pouco_dado: "pouco pago para ler",
};

export function faixaConcentracao(m: Pick<ConcentracaoMunicipio, "pago_pj" | "maior_fatia" | "hhi">): FaixaConcentracao {
  if (m.pago_pj < PAGO_MINIMO_CONCENTRACAO) return "pouco_dado";
  if ((m.maior_fatia ?? 0) > FATIA_ALTA) return "alta";
  if ((m.hhi ?? 0) >= HHI_MODERADO) return "moderada";
  return "baixa";
}

// ================================================================ sanção

export type SituacaoTcu = "inidoneo" | "fora_da_lista" | "nao_verificado";

export function situacaoTcu(f: Pick<Fornecedor, "inidoneo_tcu">): SituacaoTcu {
  return f.inidoneo_tcu === null ? "nao_verificado" : f.inidoneo_tcu ? "inidoneo" : "fora_da_lista";
}

/**
 * Em que momento da sanção a empresa entrou neste convênio:
 *   · "contratou": algum contrato assinado dentro do período — o sinal forte;
 *   · "pagou": pagamento dentro do período, com o contrato anterior a ele (ou sem contrato registrado) —
 *     executar contrato antigo não é, por si, irregular, mas pede conferência;
 *   · "antes": tudo antes do início da sanção.
 * O início é o trânsito em julgado do acórdão (sem ele, a sanção conta "desde sempre": o erro seguro é
 * mandar conferir); o fim é a data final (sem ela, vigente). Pagamento conta pelo intervalo do primeiro
 * ao último. `null`: a empresa não está na lista.
 */
export type MomentoSancao = "contratou" | "pagou" | "antes";

export function momentoDaSancao(
  f: Pick<Fornecedor, "inidoneo_tcu" | "tcu_inicio" | "tcu_data_final">,
  pagamentos: { primeiro: string | null; ultimo: string | null },
  contratos: Pick<Contrato, "dt_assinatura">[],
): MomentoSancao | null {
  if (!f.inidoneo_tcu) return null;
  const ini = f.tcu_inicio ?? "0000-01-01";
  const fim = f.tcu_data_final ?? "9999-12-31";
  if (contratos.some((c) => !!c.dt_assinatura && c.dt_assinatura >= ini && c.dt_assinatura <= fim)) return "contratou";
  if (!!pagamentos.primeiro && !!pagamentos.ultimo && pagamentos.ultimo >= ini && pagamentos.primeiro <= fim) return "pagou";
  return "antes";
}

export const ROTULO_MOMENTO: Record<MomentoSancao, string> = {
  contratou: "contratado na sanção",
  pagou: "pago na sanção",
  antes: "antes da sanção",
};

export const NIVEL_MOMENTO: Record<MomentoSancao, "critico" | "alto" | "moderado"> = { contratou: "critico", pagou: "alto", antes: "moderado" };

function periodoSancao(f: Pick<Fornecedor, "tcu_acordao" | "tcu_inicio" | "tcu_data_final">): string {
  const acordao = f.tcu_acordao ? `acórdão ${f.tcu_acordao}` : "acórdão não informado";
  const de = f.tcu_inicio ? `de ${formatarData(f.tcu_inicio)} ` : "";
  const ate = f.tcu_data_final ? `até ${formatarData(f.tcu_data_final)}` : "sem data final informada";
  return `${acordao}; sanção ${de}${ate}`;
}

// ================================================================ seção do laudo

export interface EntradaFornecedores {
  /** `painel_fornecedor_convenio` deste convênio. */
  linhas: FornecedorConvenio[];
  /** `painel_fornecedor` das empresas deste convênio. */
  fornecedores: Fornecedor[];
  /** `painel_contrato` deste convênio. */
  contratos: Contrato[];
  /** Concentração nos convênios da prefeitura, quando o proponente é a prefeitura. */
  municipio: ConcentracaoMunicipio | null;
}

export interface LinhaFornecedor {
  cnpj: string;
  nome: string;
  mei: boolean;
  pago: number;
  fatia: number | null;
  nPagamentos: number;
  primeiro: string | null;
  ultimo: string | null;
  nContratos: number;
  contratado: number;
  /** Na PB inteira: municípios e convênios em que recebeu. */
  pbMunicipios: number | null;
  pbConvenios: number | null;
  brUfs: number | null;
  tcu: SituacaoTcu;
  /** Onde este convênio cai em relação à sanção do TCU; `null` fora da lista. */
  momento: MomentoSancao | null;
  sancao: string | null;
}

export interface SecaoFornecedores {
  linhas: LinhaFornecedor[];
  pagoPj: number | null;
  pagoPf: number | null;
  nPagamentosPf: number | null;
  pagoConvenente: number | null;
  contratos: Contrato[];
  municipio: (ConcentracaoMunicipio & { faixa: FaixaConcentracao; nesteConvenio: boolean }) | null;
  /** A lista do TCU foi lida nesta execução (há ao menos uma empresa e nenhuma veio `null`). */
  tcuVerificado: boolean;
  riscos: Risco[];
}

type InstrumentoFornecedor = ColunasFornecedorInstrumento & { tipo_agente?: string | null; municipio?: string | null };

export function lerSecaoFornecedores(e: EntradaFornecedores, i: InstrumentoFornecedor): SecaoFornecedores {
  const porCnpj = new Map(e.fornecedores.map((f) => [f.cnpj, f]));
  const linhas: LinhaFornecedor[] = e.linhas
    .map((l) => {
      const f = porCnpj.get(l.cnpj);
      const contratos = e.contratos.filter((c) => c.cnpj === l.cnpj);
      const momento = f ? momentoDaSancao(f, { primeiro: l.primeiro_pagamento, ultimo: l.ultimo_pagamento }, contratos) : null;
      return {
        cnpj: l.cnpj,
        nome: nomeFornecedor({ nome: f?.nome ?? null, cnpj: l.cnpj }),
        mei: !!f?.mei,
        pago: l.pago,
        fatia: l.fatia,
        nPagamentos: l.n_pagamentos,
        primeiro: l.primeiro_pagamento,
        ultimo: l.ultimo_pagamento,
        nContratos: l.n_contratos,
        contratado: l.contratado,
        pbMunicipios: f?.pb_municipios ?? null,
        pbConvenios: f?.pb_convenios ?? null,
        brUfs: f?.br_ufs ?? null,
        tcu: f ? situacaoTcu(f) : "nao_verificado",
        momento,
        sancao: f?.inidoneo_tcu ? periodoSancao(f) : null,
      };
    })
    .sort((a, b) => b.pago - a.pago || b.contratado - a.contratado || a.nome.localeCompare(b.nome));

  const prefeitura = i.tipo_agente === "municipio";
  const m = e.municipio && prefeitura ? e.municipio : null;
  const municipio = m
    ? { ...m, faixa: faixaConcentracao(m), nesteConvenio: !!m.maior_cnpj && linhas.some((l) => l.cnpj === m.maior_cnpj && l.pago > 0) }
    : null;

  const riscos: Risco[] = [];
  for (const l of linhas) {
    if (!l.momento) continue;
    const periodo = l.primeiro && l.ultimo ? `entre ${formatarData(l.primeiro)} e ${formatarData(l.ultimo)}` : "sem data de pagamento";
    const recebeu =
      l.pago > 0
        ? `recebeu ${moedaCurta(l.pago)} neste convênio ${periodo}`
        : `tem ${l.nContratos === 1 ? "um contrato" : `${l.nContratos} contratos`} neste convênio`;
    const texto: Record<MomentoSancao, { titulo: string; fato: string }> = {
      contratou: {
        titulo: `${l.nome}: contratado dentro da sanção do TCU`,
        fato: `A empresa está na lista de licitantes inidôneos do TCU (${l.sancao}), tem contrato deste convênio assinado dentro desse período e ${recebeu}. Vale conferir o processo licitatório.`,
      },
      pagou: {
        titulo: `${l.nome}: pago durante a sanção do TCU`,
        fato: `A empresa está na lista de licitantes inidôneos do TCU (${l.sancao}) e ${recebeu}; parte disso caiu dentro da sanção. O contrato registrado é anterior a ela: executar contrato antigo não é, por si, irregular, mas vale conferir aditivos e novas ordens.`,
      },
      antes: {
        titulo: `${l.nome}: hoje na lista de inidôneos do TCU`,
        fato: `A empresa ${recebeu}, antes do período da sanção (${l.sancao}). Nada deste convênio cai dentro dele; a marca vale para contratações novas.`,
      },
    };
    riscos.push({ nivel: NIVEL_MOMENTO[l.momento], ...texto[l.momento] });
  }
  if (municipio?.faixa === "alta" && municipio.nesteConvenio && municipio.maior_fatia !== null) {
    riscos.push({
      nivel: "informativo",
      titulo: "Um fornecedor concentra mais da metade das compras da prefeitura",
      fato:
        `Nos convênios federais da prefeitura de ${municipio.municipio ?? i.municipio ?? "este município"}, ` +
        `${nomeFornecedor({ nome: municipio.maior_nome, cnpj: municipio.maior_cnpj })} recebeu ${moedaCurta(municipio.maior_pago)} dos ` +
        `${moedaCurta(municipio.pago_pj)} pagos a empresas (${Math.round(municipio.maior_fatia * 100)}%), e também é fornecedor deste convênio. ` +
        "É um indicador para olhar, não uma irregularidade.",
    });
  }

  return {
    linhas,
    pagoPj: i.pago_pj ?? null,
    pagoPf: i.pago_pf ?? null,
    nPagamentosPf: i.n_pagamentos_pf ?? null,
    pagoConvenente: i.pago_convenente ?? null,
    contratos: e.contratos,
    municipio,
    tcuVerificado: e.fornecedores.length > 0 && e.fornecedores.every((f) => f.inidoneo_tcu !== null),
    riscos,
  };
}
