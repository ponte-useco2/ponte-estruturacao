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
 * CEIS e CNEP (D1, 08/10/2026) vêm de outro job, com execução própria: "registro no CEIS na data da consulta",
 * nunca "irregular" nem "condenada".
 *
 * Função pura, sem banco e sem relógio: `hoje` entra como parâmetro.
 */
import { formatarData } from "./central.ts";
import type { Risco } from "./laudo.ts";
import { moedaCurta } from "./radar.ts";
import { tceDoFornecedor, type TceFederalPar } from "./tce.ts";

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

// ================================================================ CEIS e CNEP (D1)

/*
 * Os cadastros de sanções da CGU, pela API do Portal da Transparência (decisão do titular de 29/09/2026: só pela
 * API, com a chave dele; o download direto tem CAPTCHA). O job `sancoes/` (semanal, oport_36) consulta por CNPJ as
 * empresas do painel — a filial leva junto a matriz, porque a sanção vale para a empresa inteira — e grava a
 * cobertura (`sancao_consulta`) e uma linha por sanção de pessoa jurídica (`sancao_registro`), com "vigente" medido
 * na data da consulta. Sem execução, a página diz "CEIS/CNEP não consultados": sem marca não é "sem sanção".
 */

export type CadastroSancao = "CEIS" | "CNEP";

export interface ConsultaSancao {
  cnpj: string;
  /** Filial: o CNPJ da matriz, consultado também. */
  matriz: string | null;
  consultado_em: string | null;
  n_ceis: number | null;
  n_cnep: number | null;
  n_vigentes: number | null;
  /** Preenchido quando a consulta falhou ou não coube na rodada: é "não consultado", não "sem sanção". */
  erro: string | null;
}

export const COLUNAS_CONSULTA_SANCAO = "cnpj,matriz,consultado_em,n_ceis,n_cnep,n_vigentes,erro";

export interface RegistroSancao {
  cnpj: string;
  /** O CNPJ no registro: o próprio fornecedor ou outro estabelecimento da mesma empresa. */
  cnpj_sancionado: string;
  cadastro: CadastroSancao;
  tipo: string | null;
  orgao: string | null;
  orgao_uf: string | null;
  orgao_esfera: string | null;
  abrangencia: string | null;
  dt_inicio: string | null;
  dt_fim: string | null;
  dt_publicacao: string | null;
  processo: string | null;
  /** A publicação da sanção (em geral no Diário Oficial). */
  link: string | null;
  valor_multa: number | null;
  /** Na data da consulta; sem data final conta como vigente. */
  vigente: boolean;
}

export const COLUNAS_REGISTRO_SANCAO =
  "cnpj,cnpj_sancionado,cadastro,tipo,orgao,orgao_uf,orgao_esfera,abrangencia,dt_inicio,dt_fim,dt_publicacao,processo,link,valor_multa,vigente";

/** CEIS e CNEP de um conjunto de CNPJs, da última rodada do job. `referencia`: a data da consulta (AAAA-MM-DD). */
export interface EntradaSancoes {
  referencia: string;
  consultas: ConsultaSancao[];
  registros: RegistroSancao[];
}

/** A leitura como um todo: consultados numa data, nunca consultados (sem execução) ou leitura que falhou agora. */
export type LeituraCeisCnep = { estado: "consultado"; referencia: string } | { estado: "nao_consultado" } | { estado: "falhou" };

/** `undefined`: o job não rodou ou a oport_36 não foi aplicada; `null`: a leitura falhou. */
export function leituraCeisCnep(s: EntradaSancoes | null | undefined): LeituraCeisCnep {
  if (s === undefined) return { estado: "nao_consultado" };
  if (s === null) return { estado: "falhou" };
  return { estado: "consultado", referencia: s.referencia };
}

export type SituacaoSancao = "nao_consultado" | "sem_sancao" | "vigente" | "encerrada";

/** A situação de uma empresa. Fora da cobertura da rodada ou com erro na consulta: "não consultado". */
export function situacaoSancao(cnpj: string, s: EntradaSancoes | null | undefined): SituacaoSancao {
  if (!s) return "nao_consultado";
  const c = s.consultas.find((x) => x.cnpj === cnpj);
  if (!c || c.erro) return "nao_consultado";
  const rs = s.registros.filter((r) => r.cnpj === cnpj);
  if (rs.length === 0) return "sem_sancao";
  return rs.some((r) => r.vigente) ? "vigente" : "encerrada";
}

export const ROTULO_SANCAO: Record<SituacaoSancao, string> = {
  nao_consultado: "CEIS/CNEP não consultados",
  sem_sancao: "sem registro no CEIS nem no CNEP",
  vigente: "registro vigente no CEIS/CNEP",
  encerrada: "registro encerrado no CEIS/CNEP",
};

/** "CEIS", "CNEP" ou "CEIS e CNEP", conforme os registros dados. */
export function cadastrosDe(rs: Pick<RegistroSancao, "cadastro">[]): string {
  return (["CEIS", "CNEP"] as const).filter((c) => rs.some((r) => r.cadastro === c)).join(" e ");
}

/** Uma sanção numa linha: cadastro, tipo, órgão que aplicou (UF), período e, se for o caso, o outro estabelecimento. */
export function descreverSancao(r: RegistroSancao): string {
  const partes = [r.tipo ?? "tipo não informado"];
  if (r.orgao) partes.push(`aplicada por ${r.orgao}${r.orgao_uf ? ` (${r.orgao_uf})` : ""}`);
  const ate = r.dt_fim ? `até ${formatarData(r.dt_fim)}` : "sem data final informada";
  partes.push(r.dt_inicio ? `de ${formatarData(r.dt_inicio)} ${ate}` : ate);
  if (r.cnpj_sancionado !== r.cnpj) partes.push(`em nome de outro estabelecimento da mesma empresa (CNPJ ${cnpjLegivel(r.cnpj_sancionado)})`);
  return `${r.cadastro}: ${partes.join(", ")}`;
}

/**
 * O alcance de uma sanção para o contrato de um convênio, que é assinado por outro ente (decisão do titular de
 * 09/10/2026, depois da 1ª rodada: dos 164 fornecedores com registro vigente, só 31 tinham sanção de alcance amplo).
 * - amplo: declaração de inidoneidade (Lei 14.133, art. 156, § 5º: todos os entes), abrangência "todas as esferas", e
 *   as sanções judiciais que param a própria empresa (Lei 12.846, art. 19: suspensão das atividades, dissolução);
 * - restrito: impedimento e suspensão, que valem no órgão ou no ente que os aplicou (Lei 14.133, art. 156, § 4º; Lei
 *   8.666, art. 87, III): a conferir se alcançam o contratante; CEIS de tipo não reconhecido também fica aqui;
 * - sem impedimento: as outras sanções do CNEP (multa, publicação extraordinária, perdimento de bens, proibição de
 *   receber incentivos), que não proíbem contratar.
 */
export type AlcanceSancao = "amplo" | "restrito" | "sem_impedimento";

const PARA_A_EMPRESA = /dissolu[cç][aã]o compuls[oó]ria|suspens[aã]o\/interdi[cç][aã]o das atividades/i;

export function alcanceSancao(r: Pick<RegistroSancao, "cadastro" | "tipo" | "abrangencia">): AlcanceSancao {
  const tipo = r.tipo ?? "";
  if (/inidoneidade/i.test(tipo) || /^\s*todas as esferas/i.test(r.abrangencia ?? "") || PARA_A_EMPRESA.test(tipo)) return "amplo";
  if (/impedimento|proibi[cç][aã]o de contratar|suspens[aã]o/i.test(tipo) || r.cadastro === "CEIS") return "restrito";
  return "sem_impedimento";
}

const ORDEM_ALCANCE: Record<AlcanceSancao, number> = { amplo: 0, restrito: 1, sem_impedimento: 2 };

/** O alcance mais largo entre os registros dados (o que manda no nível do risco). */
export function alcanceMaior(rs: Pick<RegistroSancao, "cadastro" | "tipo" | "abrangencia">[]): AlcanceSancao {
  return rs.map(alcanceSancao).sort((x, y) => ORDEM_ALCANCE[x] - ORDEM_ALCANCE[y])[0] ?? "sem_impedimento";
}

const RISCO_ALCANCE: Record<AlcanceSancao, { nivel: Risco["nivel"]; titulo: string; fecho: string }> = {
  amplo: {
    nivel: "alto",
    titulo: "que impede contratar com qualquer ente",
    fecho: "Vale conferir antes de novas contratações, aditivos e ordens de serviço.",
  },
  restrito: {
    nivel: "moderado",
    titulo: "restrito ao órgão ou à esfera que o aplicou",
    fecho:
      "Impedimento e suspensão valem no órgão ou no ente que os aplicou (Lei 14.133, art. 156, § 4º): a conferir se alcançam o " +
      "contratante deste convênio antes de novas contratações e aditivos.",
  },
  sem_impedimento: {
    nivel: "informativo",
    titulo: "que não proíbe contratar",
    fecho: "São sanções da Lei Anticorrupção (Lei 12.846/2013) que não proíbem contratar com a administração; ficam como informação.",
  },
};

/** A inidoneidade declarada pelo TCU também vai ao CEIS: com o risco do TCU no laudo, o registro não se repete. */
const ehDoTcu = (r: Pick<RegistroSancao, "orgao">) => /tribunal de contas da uni[aã]o|^\s*tcu\s*$/i.test(r.orgao ?? "");

/** O período que cobre os registros: o início mais antigo (sem início, desde sempre) e o fim mais distante. */
function periodoRegistros(rs: RegistroSancao[]): { inicio: string | null; fim: string | null } {
  const inicios = rs.map((r) => r.dt_inicio).filter((x): x is string => !!x).sort();
  const fins = rs.map((r) => r.dt_fim).filter((x): x is string => !!x).sort();
  return {
    inicio: inicios.length === rs.length ? inicios[0] : null,
    fim: fins.length === rs.length ? (fins.at(-1) ?? null) : null,
  };
}

const RELACAO_REGISTRO: Record<MomentoSancao, string> = {
  contratou: "Há contrato deste convênio assinado dentro do período do registro.",
  pagou: "Parte dos pagamentos deste convênio caiu dentro do período do registro, sem contrato assinado nele.",
  antes: "Os pagamentos e contratos deste convênio são anteriores ao início do registro.",
};

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
  /** Os pares do TCE-PB (município, CNPJ, ano) dos fornecedores; ausente ou `null`: sem leitura. */
  tce?: TceFederalPar[] | null;
  /** CEIS e CNEP das empresas deste convênio (D1). Ausente: não consultados; `null`: a leitura falhou. */
  sancoes?: EntradaSancoes | null;
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
  /** Como o TCE-PB vê o pagamento deste convênio à empresa ("no TCE-PB em 2024 e 2025"). */
  tce: string | null;
  /** CEIS e CNEP na data da consulta (D1). */
  ceisCnep: SituacaoSancao;
  sancoesCgu: RegistroSancao[];
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
  /** CEIS e CNEP: consultados em que data, não consultados (sem execução) ou leitura que falhou (D1). */
  ceisCnep: LeituraCeisCnep;
  riscos: Risco[];
}

type InstrumentoFornecedor = ColunasFornecedorInstrumento & {
  tipo_agente?: string | null;
  municipio?: string | null;
  nr_convenio?: string;
};

export function lerSecaoFornecedores(e: EntradaFornecedores, i: InstrumentoFornecedor): SecaoFornecedores {
  const porCnpj = new Map(e.fornecedores.map((f) => [f.cnpj, f]));
  // Pares "só no SICONV" deste convênio, por CNPJ: viram risco, não coluna.
  const soSiconv = new Map<string, TceFederalPar[]>();
  const linhas: LinhaFornecedor[] = e.linhas
    .map((l) => {
      const f = porCnpj.get(l.cnpj);
      const contratos = e.contratos.filter((c) => c.cnpj === l.cnpj);
      const momento = f ? momentoDaSancao(f, { primeiro: l.primeiro_pagamento, ultimo: l.ultimo_pagamento }, contratos) : null;
      const noTce = e.tce && i.nr_convenio ? tceDoFornecedor(e.tce, l.cnpj, i.nr_convenio) : null;
      if (noTce?.soSiconv.length) soSiconv.set(l.cnpj, noTce.soSiconv);
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
        tce: noTce?.frase ?? null,
        ceisCnep: situacaoSancao(l.cnpj, e.sancoes),
        sancoesCgu: e.sancoes ? e.sancoes.registros.filter((r) => r.cnpj === l.cnpj) : [],
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
  // D1: registro vigente no CEIS ou no CNEP na data da consulta. O nível segue o alcance da sanção (`alcanceSancao`,
  // 09/10/2026): alto só quando ela impede contratar com qualquer ente; o inidôneo do TCU, acima, segue com o nível do
  // momento da sanção. O texto diz o fato e onde o convênio cai no período, sem julgar.
  const ceisCnep = leituraCeisCnep(e.sancoes);
  for (const l of linhas) {
    if (l.ceisCnep !== "vigente" || ceisCnep.estado !== "consultado") continue;
    const vigentes = l.sancoesCgu.filter((r) => r.vigente && !(l.momento && ehDoTcu(r)));
    if (vigentes.length === 0) continue;
    const cad = cadastrosDe(vigentes);
    const p = periodoRegistros(vigentes);
    const contratos = e.contratos.filter((c) => c.cnpj === l.cnpj);
    const temDatas = (!!l.primeiro && !!l.ultimo) || contratos.some((c) => !!c.dt_assinatura);
    const momento = temDatas
      ? momentoDaSancao({ inidoneo_tcu: true, tcu_inicio: p.inicio, tcu_data_final: p.fim }, { primeiro: l.primeiro, ultimo: l.ultimo }, contratos)
      : null;
    const um = vigentes.length === 1;
    const alcance = RISCO_ALCANCE[alcanceMaior(vigentes)];
    riscos.push({
      nivel: alcance.nivel,
      titulo: `${l.nome}: registro no ${cad} ${alcance.titulo}`,
      fato:
        `A empresa tem ${um ? "um registro" : `${vigentes.length} registros`} no ${cad} ${um ? "vigente" : "vigentes"} na consulta de ` +
        `${formatarData(ceisCnep.referencia)} (${vigentes.map(descreverSancao).join("; ")}).` +
        `${momento ? ` ${RELACAO_REGISTRO[momento]}` : ""} ${alcance.fecho}`,
    });
  }
  // Pago no SICONV e sem nenhum pagamento a esse CNPJ nas despesas do município no TCE-PB, no ano nem no
  // seguinte. O TCE não traz o número do convênio: o casamento é por município, CNPJ e ano.
  for (const l of linhas) {
    const so = soSiconv.get(l.cnpj);
    if (!so) continue;
    const valor = so.reduce((s, p) => s + p.siconv, 0);
    const anos = so.map((p) => String(p.ano));
    riscos.push({
      nivel: "moderado",
      titulo: `${l.nome}: pago no SICONV sem registro no TCE-PB`,
      fato:
        `O SICONV registra ${moedaCurta(valor)} pagos à empresa em ${anos.length > 1 ? `${anos.slice(0, -1).join(", ")} e ${anos.at(-1)}` : anos[0]} ` +
        `nos convênios da administração municipal, entre eles este, e as despesas do município no TCE-PB não têm pagamento a esse CNPJ ` +
        "nesse ano nem no seguinte. Pode ser lançamento com outro CNPJ (filial) ou atraso na prestação de contas ao TCE-PB; vale conferir.",
    });
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
    ceisCnep,
    riscos,
  };
}
