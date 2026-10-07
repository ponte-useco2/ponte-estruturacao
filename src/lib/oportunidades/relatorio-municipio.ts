/**
 * Relatório crítico do município (onda 14, camadas 1 e 2).
 *
 * O diagnóstico de Patos de 30/09/2026 para os 223 municípios da PB, montado só com o que a base já tem:
 * fiscal (com a série do RGF desde 2021), convênios, TCU, Acesso Livre, propostas, emendas, Pix, fundo a
 * fundo, TCE-PB e fornecedores (camada 1); e os indicadores do município em social, economia, território e
 * governança, lidos em lote de fontes oficiais pelo job `municipios/` (camada 2, `indicadores-municipio.ts`).
 * Cada fonte vira uma seção com a sua data, e cada ponto que pede atenção vira um achado com nível. Os achados
 * montam o "Em uma página" e o "O que fazer primeiro".
 *
 * Níveis: **crítico** só para bloqueio legal ou financeiro e para apontamento de órgão de controle; o resto
 * vai a alto, moderado ou informativo. "Em dia" registra o que foi conferido e está em ordem. "A conferir" é
 * ponto para olhar, nunca irregularidade. Sem nome de servidor ou de responsável (os nomes de parlamentar
 * das emendas ficam, como agentes públicos). Função pura, sem banco e sem relógio.
 */
import { formatarData } from "./central.ts";
import { DIAS_SEM_MEDICAO_MODERADO, riscosContasObras, type EntradaContasObras } from "./contas-obras.ts";
import { DIAS_SEM_MOVIMENTO, DIAS_VIGENCIA_CRITICA, PCT_FINANCEIRO_ALTO, PCT_FISICO_BAIXO } from "./diagnostico.ts";
import { NOME_CURTO, conclusaoDe, type ConclusaoFiscal, type MunicipioFiscal, type VerificacaoFiscal } from "./fiscal.ts";
import { faixaConcentracao, type ConcentracaoMunicipio } from "./fornecedores.ts";
import { pontosAConferir } from "./itens-laudo.ts";
import {
  VERSAO_REGRA_INDICADOR,
  frasesReferencia,
  indicadoresComNivel,
  lerIndicadores,
  type DimensaoIndicador,
  type EntradaIndicadores,
  type IndicadorLido,
  type LeituraIndicadores,
} from "./indicadores-municipio.ts";
import { diasEntre, type Nivel } from "./laudo.ts";
import { GRUPOS_SITUACAO } from "./busca.ts";
import { ROTULO_DESFECHO, type ColunaCsv } from "./painel.ts";
import type { PlanoFundo } from "./pix.ts";
import { compararFila, grupos, type ClasseFila, type QuemResolve } from "./fila.ts";
import { ordenarCiclo, pontoDoCiclo, type PlanoCicloPix, type PontoCiclo } from "./pix-ciclo.ts";
import { impedidosPorAno, type ImpedidosDoAno, type PlanoLaudoPix } from "./pix-laudo.ts";
import { riscoPc33, type ColunasPc33 } from "./portaria33.ts";
import { moedaCurta } from "./radar.ts";
import { marcasPix, resumirConciliacao, type TceFederalMunicipio, type TcePixMunicipio } from "./tce.ts";
import { riscoTceTcu, type ConsultaTcu, type TceTcu } from "./tce-tcu.ts";

export const VERSAO_RELATORIO = "2026-10-01.2";

// ================================================================ entrada

export interface PontoSerie {
  exercicio: number;
  periodicidade: string;
  periodo: number;
  dtp_pct: number | null;
  dtp?: number | null;
  rcl_ajustada?: number | null;
  limite_maximo_pct?: number | null;
  limite_prudencial_pct?: number | null;
}

/** A série do RGF que o job fiscal grava na evidência da G2 (`fiscal/coleta.py`, `serie_pessoal`). */
export interface SeriePessoal {
  anos: number[];
  periodos: PontoSerie[];
}

/** As colunas de `painel_instrumento` que o relatório lê. */
export interface InstrumentoRelatorio extends ColunasPc33 {
  nr_convenio: string;
  modalidade: string | null;
  situacao: string | null;
  subsituacao: string | null;
  orgao_sup: string | null;
  programa: string | null;
  objeto: string | null;
  vl_global: number | null;
  vl_repasse: number | null;
  vl_desembolsado: number | null;
  vl_pago: number | null;
  vl_saldo_conta: number | null;
  pct_fisico: number | null;
  dt_assinatura: string | null;
  dt_fim_vigencia: string | null;
  dt_limite_contas: string | null;
  dt_primeiro_desembolso: string | null;
  dt_ultimo_desembolso: string | null;
  dt_ultimo_pagamento: string | null;
  situacao_contratacao: string | null;
}

export interface EmendaRelatorio {
  nr_convenio: string;
  parlamentar: string | null;
  tipo_parlamentar: string | null;
  valor: number | null;
}

export interface PropostaRelatorio {
  id_proposta: string;
  ano_envio: number | null;
  desfecho: string;
  orgao_sup: string | null;
  programa: string | null;
  valor_repasse: number | null;
  dias_sem_evento: number | null;
  dt_ultimo_evento: string | null;
  /** Nenhum evento desde o envio (`painel_proposta.limbo`). */
  limbo?: boolean | null;
}

export interface JanelaRelatorio {
  titulo: string;
  orgao: string | null;
  fim: string | null;
}

/**
 * Tudo o que o relatório lê. `null` quer dizer que a leitura falhou (o nome vai em `faltas`); lista vazia,
 * que a fonte não tem nada do município.
 */
export interface EntradaRelatorio {
  ibge: string;
  nome: string;
  fiscal: { municipio: MunicipioFiscal; verificacoes: VerificacaoFiscal[]; referencia: string | null } | null;
  /** Da evidência da G2; null enquanto o job fiscal não gravou a série. */
  serie: SeriePessoal | null;
  instrumentos: InstrumentoRelatorio[] | null;
  /** Data do arquivo do SICONV que o painel leu. */
  referenciaPainel: string | null;
  emendas: EmendaRelatorio[] | null;
  propostas: PropostaRelatorio[] | null;
  tcu: { consultas: ConsultaTcu[]; tces: TceTcu[]; referencia: string | null } | null;
  /** Por número de convênio, só os que estão nas coletas do Acesso Livre. */
  contasObras: Record<string, EntradaContasObras> | null;
  pix: PlanoLaudoPix[] | null;
  /** Pix do exercício com o plano de trabalho pendente (oport_30); null quando a leitura falhou ou não existe. */
  pixCiclo?: PlanoCicloPix[] | null;
  pixTce: TcePixMunicipio[] | null;
  fundo: PlanoFundo[] | null;
  conciliacao: TceFederalMunicipio[] | null;
  fornecedores: { concentracao: ConcentracaoMunicipio | null; inidoneos: { cnpj: string; nome: string | null; pago: number }[] } | null;
  janelas: { elegiveis: number; urgentes: JanelaRelatorio[] } | null;
  /** Camada 2: a última execução do job `municipios/`; null sem a migração ou sem execução. */
  indicadores?: EntradaIndicadores | null;
  faltas: string[];
}

// ================================================================ saída

export type Dimensao = "fiscal" | "convenios" | "controle" | "propostas" | "pix" | "tce_pb" | "fornecedores" | "social" | "economia" | "territorio" | "governanca";

export const ROTULO_DIMENSAO: Record<Dimensao, string> = {
  fiscal: "Capacidade fiscal",
  convenios: "Convênios",
  controle: "Controle e prestação de contas",
  propostas: "Propostas",
  pix: "Pix e fundo a fundo",
  tce_pb: "TCE-PB",
  fornecedores: "Fornecedores",
  social: "Social",
  economia: "Economia",
  territorio: "Território",
  governanca: "Governança",
};

export type NivelAchado = Nivel | "em_dia";

export const ROTULO_NIVEL_ACHADO: Record<NivelAchado, string> = {
  critico: "crítico",
  alto: "alto",
  moderado: "moderado",
  informativo: "informação",
  em_dia: "em dia",
};

export interface Achado {
  nivel: NivelAchado;
  dimensao: Dimensao;
  titulo: string;
  fato: string;
  /** O que o município pode fazer; null quando a vez é de outro (concedente, Tribunal) ou não há ação. */
  acao: string | null;
  /** Desempate dentro do nível: o que destrava mais vem antes (o fiscal trava todo convênio novo). */
  peso: number;
  /** Convênios ou planos citados, para os links. */
  numeros?: string[];
  /** A fila (F1b, `fila.ts`): trava dinheiro novo, pode virar cobrança, tem prazo ou pede atenção. */
  classe?: ClasseFila;
  /** Quem resolve: o município, o órgão federal, o Tribunal ou outros. */
  quem?: QuemResolve;
  /** AAAA-MM-DD, quando o ponto tem data (ordena dentro da classe). */
  prazo?: string | null;
}

const ORDEM_NIVEL: Record<NivelAchado, number> = { critico: 0, alto: 1, moderado: 2, informativo: 3, em_dia: 4 };

export interface Cartao {
  rotulo: string;
  valor: string;
  nota: string;
  nivel: NivelAchado | null;
}

export interface LinhaConvenio {
  nr_convenio: string;
  orgao: string | null;
  objeto: string | null;
  valor: number | null;
  desembolsado: number | null;
  nota: string;
}

export interface Relatorio {
  ibge: string;
  nome: string;
  hoje: string;
  versao: string;
  achados: Achado[];
  /** O "Em uma página": os quatro números e os achados que mais pesam. */
  cartoes: Cartao[];
  destaques: Achado[];
  emDia: Achado[];
  /** O "O que fazer primeiro": as ações, do que destrava mais para o que destrava menos. */
  passos: { titulo: string; porque: string }[];
  fiscal: SecaoFiscal | null;
  convenios: SecaoConvenios | null;
  controle: SecaoControle | null;
  propostas: SecaoPropostas | null;
  emendas: { parlamentar: string; tipo: string | null; convenios: number; valor: number }[] | null;
  pix: SecaoPix | null;
  tcePb: SecaoTcePb | null;
  fornecedores: SecaoFornecedores | null;
  janelas: EntradaRelatorio["janelas"];
  /** Camada 2: o município, social, economia, território e governança. */
  indicadores: LeituraIndicadores | null;
  fontes: { fonte: string; data: string | null; nota: string }[];
  faltas: string[];
}

// ================================================================ utilidades

const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");
const n = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const plural = (q: number, um: string, varios: string) => `${n(q)} ${q === 1 ? um : varios}`;
const soma = <T>(xs: T[], f: (x: T) => number | null | undefined) => xs.reduce((t, x) => t + (f(x) ?? 0), 0);
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);
/** "Mortalidade infantil" → "mortalidade infantil"; sigla ("IDEB …") fica como está. */
const minuscula = (t: string) => (t.length > 1 && t[1] === t[1].toLowerCase() ? `${t.charAt(0).toLowerCase()}${t.slice(1)}` : t);

export function rotuloPeriodo(p: Pick<PontoSerie, "exercicio" | "periodicidade" | "periodo">): string {
  return p.periodicidade === "S" ? `${p.periodo}º semestre de ${p.exercicio}` : `${p.periodo}º quadrimestre de ${p.exercicio}`;
}

const grupoDe = (situacao: string | null) => GRUPOS_SITUACAO.find((g) => g.situacoes.includes(situacao ?? ""))?.id ?? "outro";

// ================================================================ fiscal

export interface SecaoFiscal {
  decisoes: { decisao: string; nome: string; estado: string; bloqueantes: string[] }[];
  verificacoes: { codigo: string; nome: string; estado: string; resumo: string }[];
  caucPendencias: string[];
  pessoal: number | null;
  serie: PontoSerie[];
  /** Períodos seguidos acima do limite máximo, contados do mais recente para trás. */
  acimaSeguidos: number;
  acimaDesde: PontoSerie | null;
  /** O último período do exercício de 2021, para a transição da LC 178/2021 (art. 15). */
  fim2021: PontoSerie | null;
  referencia: string | null;
}

const LIMITE_MAXIMO_PADRAO = 54;
const LIMITE_PRUDENCIAL_PADRAO = 51.3;

/** Quantos períodos seguidos, do mais recente para trás, ficaram acima do limite máximo. */
export function acimaDoLimite(serie: PontoSerie[]): { seguidos: number; desde: PontoSerie | null } {
  const ordenada = [...serie].filter((p) => p.dtp_pct !== null).sort((a, b) => a.exercicio - b.exercicio || a.periodo - b.periodo);
  let seguidos = 0;
  let desde: PontoSerie | null = null;
  for (let k = ordenada.length - 1; k >= 0; k--) {
    const p = ordenada[k];
    if ((p.dtp_pct as number) > (p.limite_maximo_pct ?? LIMITE_MAXIMO_PADRAO)) {
      seguidos += 1;
      desde = p;
    } else break;
  }
  return { seguidos, desde };
}

function secaoFiscal(e: EntradaRelatorio): SecaoFiscal | null {
  if (!e.fiscal) return null;
  const m = e.fiscal.municipio;
  const serie = [...(e.serie?.periodos ?? [])].sort((a, b) => a.exercicio - b.exercicio || a.periodo - b.periodo);
  const { seguidos, desde } = acimaDoLimite(serie);
  const de2021 = serie.filter((p) => p.exercicio === 2021);
  return {
    decisoes: (["A", "B", "C"] as const)
      .map((d) => conclusaoDe(m, d))
      .filter((c): c is ConclusaoFiscal => !!c)
      .map((c) => ({ decisao: c.decisao, nome: c.nome, estado: c.estado, bloqueantes: c.bloqueantes.map((g) => NOME_CURTO[g] ?? g) })),
    verificacoes: e.fiscal.verificacoes.map((v) => ({ codigo: v.codigo, nome: v.nome, estado: v.estado, resumo: v.resumo })),
    caucPendencias: m.indicadores.cauc_pendencias ?? [],
    pessoal: m.indicadores.pessoal_pct ?? null,
    serie,
    acimaSeguidos: seguidos,
    acimaDesde: desde,
    fim2021: de2021.at(-1) ?? null,
    referencia: e.fiscal.referencia,
  };
}

const EM_DIA_FISCAL: Record<string, string> = {
  G1: "Declarações ao Siconfi entregues",
  G11: "Mínimo de educação aplicado",
  G12: "Mínimo de saúde aplicado",
  G6: "Dívida consolidada abaixo do limite",
  G3: "Regra de ouro cumprida",
};

function achadosFiscais(s: SecaoFiscal): Achado[] {
  const a: Achado[] = [];
  const b = s.decisoes.find((d) => d.decisao === "B");
  const c = s.decisoes.find((d) => d.decisao === "C");
  const cauc = s.caucPendencias.length ? ` O CAUC registra pendência nos itens ${lista(s.caucPendencias)}.` : "";
  if (b?.estado === "nao_atendido") {
    const credito = c?.estado === "nao_atendido";
    a.push({
      nivel: "critico",
      dimensao: "fiscal",
      classe: "bloqueio",
      quem: "municipio",
      titulo: credito ? "Transferência voluntária e crédito travados" : "Transferência voluntária travada",
      fato:
        `No painel fiscal, a decisão de receber transferência voluntária está «não atendida»${b.bloqueantes.length ? ` por ${lista(b.bloqueantes)}` : ""}.` +
        cauc +
        " Saúde, educação e assistência social ficam fora da suspensão de transferências pela LRF (art. 25, § 3º).",
      acao: s.caucPendencias.length
        ? `Regularizar os itens ${lista(s.caucPendencias)} do CAUC: sem isso, cada convênio novo depende de exceção ou de decisão judicial.`
        : `Resolver ${lista(b.bloqueantes)} para voltar a receber transferência voluntária.`,
      peso: 0,
    });
  } else if (b?.estado === "atencao") {
    a.push({
      nivel: "moderado",
      dimensao: "fiscal",
      classe: "atencao",
      quem: "municipio",
      titulo: "Transferência voluntária com alertas",
      fato: `O painel fiscal registra alertas na decisão de receber transferência voluntária.${cauc}`,
      acao: null,
      peso: 0,
    });
  } else if (b?.estado === "atendido") {
    a.push({ nivel: "em_dia", dimensao: "fiscal", titulo: "Apto a receber transferência voluntária", fato: "Nenhum bloqueio na decisão B do painel fiscal.", acao: null, peso: 0 });
  }
  if (c?.estado === "nao_atendido" && b?.estado !== "nao_atendido") {
    a.push({
      nivel: "alto",
      dimensao: "fiscal",
      classe: "bloqueio",
      quem: "municipio",
      titulo: "Operação de crédito travada",
      fato: `A decisão de contratar operação de crédito está «não atendida»${c.bloqueantes.length ? ` por ${lista(c.bloqueantes)}` : ""}.`,
      acao: null,
      peso: 1,
    });
  }

  const ultimo = s.serie.at(-1);
  if (ultimo && ultimo.dtp_pct !== null) {
    const maximo = ultimo.limite_maximo_pct ?? LIMITE_MAXIMO_PADRAO;
    const prudencial = ultimo.limite_prudencial_pct ?? LIMITE_PRUDENCIAL_PADRAO;
    const transicao =
      s.fim2021 && s.fim2021.dtp_pct !== null && s.fim2021.dtp_pct > (s.fim2021.limite_maximo_pct ?? LIMITE_MAXIMO_PADRAO)
        ? ` No fim de 2021 estava em ${pct(s.fim2021.dtp_pct)}: vale conferir o regime de transição da LC 178/2021 (art. 15).`
        : "";
    if (s.acimaSeguidos > 0 && s.acimaDesde) {
      const unidade = ultimo.periodicidade === "S" ? ["semestre", "semestres"] : ["quadrimestre", "quadrimestres"];
      a.push({
        nivel: "alto",
        dimensao: "fiscal",
        classe: "bloqueio",
        quem: "municipio",
        titulo: `Despesa com pessoal acima do limite há ${plural(s.acimaSeguidos, unidade[0], unidade[1])}`,
        fato:
          `${pct(ultimo.dtp_pct)} da RCL ajustada no ${rotuloPeriodo(ultimo)}, para um limite de ${pct(maximo)}; acima dele desde o ` +
          `${rotuloPeriodo(s.acimaDesde)}. A LRF dá dois quadrimestres para reconduzir (art. 23); fora do prazo, valem as vedações do § 3º.` +
          transicao,
        acao: "Apresentar um plano de recondução da despesa com pessoal ao limite, com metas por quadrimestre.",
        peso: 1,
      });
    } else if (ultimo.dtp_pct > prudencial) {
      a.push({
        nivel: "moderado",
        dimensao: "fiscal",
        classe: "atencao",
        quem: "municipio",
        titulo: "Despesa com pessoal acima do prudencial",
        fato: `${pct(ultimo.dtp_pct)} da RCL ajustada no ${rotuloPeriodo(ultimo)}: acima do prudencial (${pct(prudencial)}), abaixo do máximo (${pct(maximo)}). Acima do prudencial, valem as vedações do art. 22, parágrafo único, da LRF.`,
        acao: null,
        peso: 2,
      });
    } else {
      a.push({ nivel: "em_dia", dimensao: "fiscal", titulo: "Despesa com pessoal abaixo do prudencial", fato: `${pct(ultimo.dtp_pct)} da RCL ajustada no ${rotuloPeriodo(ultimo)}.`, acao: null, peso: 2 });
    }
  }

  const atendidas = s.verificacoes.filter((v) => v.estado === "atendido" && EM_DIA_FISCAL[v.codigo]);
  if (atendidas.length) {
    a.push({
      nivel: "em_dia",
      dimensao: "fiscal",
      titulo: lista(atendidas.map((v) => EM_DIA_FISCAL[v.codigo])),
      fato: atendidas.map((v) => v.resumo).join(" "),
      acao: null,
      peso: 3,
    });
  }
  return a;
}

// ================================================================ convênios

export interface SecaoConvenios {
  porGrupo: { id: string; rotulo: string; n: number; valor: number }[];
  emExecucao: LinhaConvenio[];
  vigenciaVencida: LinhaConvenio[];
  semMovimento: LinhaConvenio[];
  contasAtrasadas: LinhaConvenio[];
  contasNegativas: LinhaConvenio[];
  /** Aprovados sem assinatura com a vigência ainda em aberto. */
  nuncaAssinados: LinhaConvenio[];
  /** Os que venceram sem assinatura: não há mais o que assinar. */
  nuncaAssinadosVencidos: number;
  liminar: LinhaConvenio[];
  pc33: (LinhaConvenio & { nivel: Nivel })[];
  referencia: string | null;
}

const CONTAS_NEGATIVO = new Set(["Prestação de Contas Rejeitada", "Inadimplente"]);

function linha(i: InstrumentoRelatorio, nota: string): LinhaConvenio {
  return { nr_convenio: i.nr_convenio, orgao: i.orgao_sup, objeto: i.objeto, valor: i.vl_global, desembolsado: i.vl_desembolsado, nota };
}

function secaoConvenios(e: EntradaRelatorio, hoje: string): SecaoConvenios | null {
  if (!e.instrumentos) return null;
  const is = e.instrumentos;
  const porGrupo = [...GRUPOS_SITUACAO, { id: "outro", rotulo: "Sem situação ou outra", situacoes: [] }]
    .map((g) => {
      const doGrupo = is.filter((i) => grupoDe(i.situacao) === g.id);
      return { id: g.id, rotulo: g.rotulo, n: doGrupo.length, valor: soma(doGrupo, (i) => i.vl_global) };
    })
    .filter((g) => g.n > 0);
  const execucao = is.filter((i) => i.situacao === "Em execução").sort((a, b) => (b.vl_global ?? 0) - (a.vl_global ?? 0));
  const vencida = execucao.filter((i) => i.dt_fim_vigencia && i.dt_fim_vigencia < hoje);
  const semMovimento = execucao.filter((i) => {
    if (!i.dt_primeiro_desembolso) return false;
    const ultimo = [i.dt_ultimo_pagamento, i.dt_ultimo_desembolso].filter((x): x is string => !!x).sort().at(-1);
    return !!ultimo && diasEntre(ultimo, hoje) > DIAS_SEM_MOVIMENTO;
  });
  const atrasadas = is.filter((i) => i.situacao === "Aguardando Prestação de Contas" && i.dt_limite_contas && i.dt_limite_contas < hoje);
  const negativas = is.filter((i) => CONTAS_NEGATIVO.has(i.situacao ?? ""));
  const nunca = is.filter((i) => i.situacao === "Proposta/Plano de Trabalho Aprovado");
  const liminar = is.filter((i) => /liminar/i.test(i.situacao_contratacao ?? ""));
  const pc33 = is
    .map((i) => ({ i, r: riscoPc33(i) }))
    .filter((x) => x.r)
    .map(({ i, r }) => ({ ...linha(i, (r?.titulo ?? "").replace(/^Execução [^:]+: /, "")), nivel: (r?.nivel ?? "moderado") as Nivel }));
  return {
    porGrupo,
    emExecucao: execucao.map((i) =>
      linha(i, `vigência até ${data(i.dt_fim_vigencia)}${i.pct_fisico !== null ? ` · físico ${Math.round(i.pct_fisico * 100)}%` : ""}`),
    ),
    vigenciaVencida: vencida.map((i) => linha(i, `vigência terminou em ${data(i.dt_fim_vigencia)}; ${moedaCurta(i.vl_saldo_conta ?? 0)} em conta`)),
    semMovimento: semMovimento.map((i) => linha(i, `último movimento em ${data([i.dt_ultimo_pagamento, i.dt_ultimo_desembolso].filter(Boolean).sort().at(-1))}`)),
    contasAtrasadas: atrasadas.map((i) => linha(i, `prazo terminou em ${data(i.dt_limite_contas)}`)),
    contasNegativas: negativas.map((i) => linha(i, i.situacao ?? "")),
    nuncaAssinados: nunca.filter((i) => !i.dt_fim_vigencia || i.dt_fim_vigencia >= hoje).map((i) => linha(i, `vigência até ${data(i.dt_fim_vigencia)}`)),
    nuncaAssinadosVencidos: nunca.filter((i) => i.dt_fim_vigencia && i.dt_fim_vigencia < hoje).length,
    liminar: liminar.map((i) => linha(i, i.situacao_contratacao ?? "")),
    pc33,
    referencia: e.referenciaPainel,
  };
}

function achadosConvenios(s: SecaoConvenios, e: EntradaRelatorio, hoje: string, comTce: Set<string>): Achado[] {
  const a: Achado[] = [];
  const is = e.instrumentos ?? [];
  const por = (nr: string) => is.find((i) => i.nr_convenio === nr);

  const negativas = s.contasNegativas.filter((l) => !comTce.has(l.nr_convenio));
  if (negativas.length) {
    a.push({
      nivel: "critico",
      dimensao: "controle",
      classe: "cobranca",
      quem: "municipio",
      titulo: negativas.length === 1 ? negativas[0].nota : `${n(negativas.length)} prestações de contas rejeitadas ou inadimplentes`,
      fato: `O SICONV registra ${lista(negativas.map((l) => `o convênio ${l.nr_convenio} (${l.nota})`))}. Rejeição leva à devolução e, sem ela, à tomada de contas especial.`,
      acao: "Conferir a devolução ou o recurso de cada prestação rejeitada antes que vire tomada de contas especial.",
      peso: 1,
      numeros: negativas.map((l) => l.nr_convenio),
    });
  }
  if (s.contasAtrasadas.length) {
    const mais = [...s.contasAtrasadas].sort((x, y) => (por(x.nr_convenio)?.dt_limite_contas ?? "").localeCompare(por(y.nr_convenio)?.dt_limite_contas ?? ""))[0];
    a.push({
      nivel: "alto",
      dimensao: "controle",
      classe: "cobranca",
      quem: "municipio",
      titulo: s.contasAtrasadas.length === 1 ? "Prestação de contas atrasada" : `${n(s.contasAtrasadas.length)} prestações de contas atrasadas`,
      fato: `${lista(s.contasAtrasadas.map((l) => `${l.nr_convenio} (${l.orgao ?? "órgão não informado"})`))}: o prazo de prestar contas venceu e o SICONV mostra «Aguardando Prestação de Contas». A mais antiga venceu em ${data(por(mais.nr_convenio)?.dt_limite_contas)}.`,
      acao: "Enviar a prestação de contas atrasada: prazo vencido sem prestação é motivo de tomada de contas especial.",
      peso: 2,
      numeros: s.contasAtrasadas.map((l) => l.nr_convenio),
    });
  }
  if (s.vigenciaVencida.length) {
    const parado = soma(s.vigenciaVencida.map((l) => por(l.nr_convenio)), (i) => i?.vl_saldo_conta);
    a.push({
      nivel: "alto",
      dimensao: "convenios",
      classe: "cobranca",
      quem: "municipio",
      titulo: s.vigenciaVencida.length === 1 ? "Convênio com a vigência vencida em execução" : `${n(s.vigenciaVencida.length)} convênios com a vigência vencida em execução`,
      fato: `${lista(s.vigenciaVencida.map((l) => l.nr_convenio))}: a vigência terminou e o SICONV ainda mostra «Em execução»${parado > 0 ? `, com ${moedaCurta(parado)} em conta` : ""}. Sem aditivo, o saldo volta e a prestação de contas começa a contar.`,
      acao: "Pedir a prorrogação (se houver objeto a executar) ou preparar a prestação de contas e a devolução do saldo.",
      peso: 3,
      numeros: s.vigenciaVencida.map((l) => l.nr_convenio),
    });
  }
  const acabando = is.filter((i) => i.situacao === "Em execução" && i.dt_fim_vigencia && i.dt_fim_vigencia >= hoje && diasEntre(hoje, i.dt_fim_vigencia) <= DIAS_VIGENCIA_CRITICA);
  if (acabando.length) {
    a.push({
      nivel: "alto",
      dimensao: "convenios",
      classe: "prazo",
      quem: "municipio",
      prazo: acabando.map((i) => i.dt_fim_vigencia as string).sort()[0] ?? null,
      titulo: acabando.length === 1 ? "Vigência acabando em 30 dias" : `${n(acabando.length)} vigências acabando em 30 dias`,
      fato: lista(acabando.map((i) => `${i.nr_convenio} (até ${data(i.dt_fim_vigencia)})`)) + ".",
      acao: "Pedir o aditivo de prazo antes do fim da vigência, se o objeto não vai terminar a tempo.",
      peso: 3,
      numeros: acabando.map((i) => i.nr_convenio),
    });
  }
  if (s.semMovimento.length) {
    a.push({
      nivel: "alto",
      dimensao: "convenios",
      classe: "cobranca",
      quem: "municipio",
      titulo: s.semMovimento.length === 1 ? "Convênio sem movimento financeiro há mais de um ano" : `${n(s.semMovimento.length)} convênios sem movimento financeiro há mais de um ano`,
      fato: `${lista(s.semMovimento.map((l) => `${l.nr_convenio} (${l.nota})`))}.`,
      acao: "Retomar a execução (licitar, contratar, pagar) ou tratar com o concedente a rescisão e a devolução do saldo, antes do bloqueio da conta.",
      peso: 4,
      numeros: s.semMovimento.map((l) => l.nr_convenio),
    });
  }
  if (s.liminar.length) {
    a.push({
      nivel: "alto",
      dimensao: "convenios",
      classe: "atencao",
      quem: "justica",
      titulo: s.liminar.length === 1 ? "Convênio assinado sob liminar" : `${n(s.liminar.length)} convênios assinados sob liminar`,
      fato: `O Transferegov registra a contratação de ${lista(s.liminar.map((l) => l.nr_convenio))} como «${s.liminar[0].nota}». O andamento depende da decisão judicial.`,
      acao: null,
      peso: 2,
      numeros: s.liminar.map((l) => l.nr_convenio),
    });
  }
  const frente = is.filter(
    (i) => i.situacao === "Em execução" && i.vl_repasse && (i.vl_desembolsado ?? 0) / i.vl_repasse >= PCT_FINANCEIRO_ALTO && i.pct_fisico !== null && i.pct_fisico < PCT_FISICO_BAIXO,
  );
  if (frente.length) {
    a.push({
      nivel: "moderado",
      dimensao: "convenios",
      classe: "atencao",
      quem: "municipio",
      titulo: frente.length === 1 ? "Dinheiro na frente da obra" : `${n(frente.length)} convênios com o dinheiro na frente da obra`,
      fato: `${lista(frente.map((i) => i.nr_convenio))}: 80% ou mais do repasse desembolsado e menos de 30% de execução física registrada.`,
      acao: "Atualizar a execução física no Transferegov ou explicar a diferença ao concedente.",
      peso: 5,
      numeros: frente.map((i) => i.nr_convenio),
    });
  }
  if (s.pc33.length) {
    const pior = s.pc33.some((x) => x.nivel === "critico") ? "critico" : s.pc33.some((x) => x.nivel === "alto") ? "alto" : "moderado";
    a.push({
      nivel: pior === "critico" ? "alto" : pior,
      dimensao: "convenios",
      classe: "atencao",
      quem: "municipio",
      titulo: `${plural(s.pc33.length, "convênio", "convênios")} com pontos a conferir na norma de convênios`,
      fato: `${lista(s.pc33.map((x) => `${x.nr_convenio} (${x.nota})`))}. O detalhe de cada ponto está no laudo do convênio.`,
      acao: "Conferir no laudo de cada convênio os pontos apontados e resolver com o concedente o que depende do município.",
      peso: 5,
      numeros: s.pc33.map((x) => x.nr_convenio),
    });
  }
  const nuncaVivos = (e.instrumentos ?? []).filter((i) => i.situacao === "Proposta/Plano de Trabalho Aprovado" && (!i.dt_fim_vigencia || i.dt_fim_vigencia >= hoje));
  if (nuncaVivos.length) {
    a.push({
      nivel: "moderado",
      dimensao: "convenios",
      classe: "atencao",
      quem: "orgao",
      titulo: `${plural(nuncaVivos.length, "convênio aprovado espera", "convênios aprovados esperam")} assinatura`,
      fato: `${moedaCurta(soma(nuncaVivos, (i) => i.vl_global))} aprovados e ainda não assinados, com a vigência registrada em aberto: ${lista(nuncaVivos.slice(0, 6).map((i) => i.nr_convenio))}${nuncaVivos.length > 6 ? " e outros" : ""}.`,
      acao: "Cobrar do concedente a assinatura dos aprovados com vigência em aberto (e conferir as exigências pendentes de cada um).",
      peso: 6,
      numeros: nuncaVivos.map((i) => i.nr_convenio),
    });
  }
  return a;
}

// ================================================================ controle (TCU e Acesso Livre)

export interface SecaoControle {
  tces: TceTcu[];
  debitoOriginal: number;
  debitoComJuros: number;
  /** TCE no TCU de convênio que o SICONV mostra como concluído ou aprovado. */
  divergentes: { nr_convenio: string; situacao: string }[];
  consultados: number;
  referenciaTcu: string | null;
  contas: { nr_convenio: string; titulo: string; nivel: Nivel; fato: string }[];
}

function secaoControle(e: EntradaRelatorio): SecaoControle | null {
  if (!e.tcu && !e.contasObras) return null;
  const tces = e.tcu?.tces ?? [];
  const sit = new Map((e.instrumentos ?? []).map((i) => [i.nr_convenio, i.situacao ?? ""]));
  const comTce = new Set(tces.map((t) => t.nr_convenio));
  const contas = Object.entries(e.contasObras ?? {}).flatMap(([nr, c]) =>
    riscosContasObras(c, { comTce: comTce.has(nr) }).map((r) => ({ nr_convenio: nr, titulo: r.titulo, nivel: r.nivel, fato: r.fato })),
  );
  return {
    tces,
    debitoOriginal: soma(tces, (t) => t.debito_original),
    debitoComJuros: soma(tces, (t) => t.debito_com_juros),
    divergentes: [...comTce]
      .map((nr) => ({ nr_convenio: nr, situacao: sit.get(nr) ?? "" }))
      .filter((x) => /Concluída|Aprovada/.test(x.situacao)),
    consultados: e.tcu?.consultas.length ?? 0,
    referenciaTcu: e.tcu?.referencia ?? null,
    contas,
  };
}

function achadosControle(s: SecaoControle, e: EntradaRelatorio): Achado[] {
  const a: Achado[] = [];
  if (s.tces.length) {
    const porConvenio = [...new Set(s.tces.map((t) => t.nr_convenio))];
    const risco = riscoTceTcu({ consulta: null, tces: s.tces, referencia: s.referenciaTcu });
    const orgaos = porConvenio.map((nr) => {
      const i = (e.instrumentos ?? []).find((x) => x.nr_convenio === nr);
      return `${nr}${i?.orgao_sup ? ` (${i.orgao_sup})` : ""}`;
    });
    a.push({
      nivel: "critico",
      dimensao: "controle",
      classe: "cobranca",
      quem: "tribunal",
      titulo: risco?.titulo ?? "Tomada de Contas Especial no TCU",
      fato:
        `${risco?.fato ?? ""} Convênios: ${lista(orgaos)}.` +
        (s.divergentes.length
          ? ` O SICONV mostra ${lista(s.divergentes.map((d) => `${d.nr_convenio} como «${d.situacao}»`))}: a situação do arquivo aberto não acompanha a TCE.`
          : ""),
      acao: "Acompanhar cada TCE no TCU e reunir a defesa ou o recolhimento do débito; débito julgado vira inscrição no CADIN.",
      peso: 1,
      numeros: porConvenio,
    });
  } else if (s.consultados > 0) {
    a.push({
      nivel: "em_dia",
      dimensao: "controle",
      titulo: "Nenhuma TCE no TCU",
      fato: `${plural(s.consultados, "convênio consultado", "convênios consultados")} no e-TCE em ${data(s.referenciaTcu)}, sem tomada de contas especial.`,
      acao: null,
      peso: 9,
    });
  }
  // Um ponto por tipo: o título de cada risco traz número (valor impugnado, dias sem medição), e agrupar pelo título
  // fazia cada obra virar um cartão (teste de 07/10/2026).
  const grupos = new Map<string, { tipo: TipoContas | null; titulo: string; nivel: Nivel; nrs: string[]; fatos: string[] }>();
  for (const c of s.contas) {
    const tipo = TIPOS_CONTAS.find((t) => t.re.test(c.titulo)) ?? null;
    const k = tipo ? tipo.re.source : c.titulo;
    const g = grupos.get(k) ?? { tipo, titulo: c.titulo, nivel: c.nivel, nrs: [], fatos: [] };
    g.nrs.push(c.nr_convenio);
    g.fatos.push(`${c.nr_convenio}: ${c.fato}`);
    if (ORDEM_NIVEL[c.nivel] < ORDEM_NIVEL[g.nivel]) g.nivel = c.nivel;
    grupos.set(k, g);
  }
  for (const g of grupos.values()) {
    const varios = g.nrs.length > 1;
    a.push({
      nivel: g.nivel,
      dimensao: "controle",
      classe: g.tipo?.classe ?? "cobranca",
      quem: g.tipo?.quem ?? "municipio",
      titulo: !varios ? g.titulo : g.tipo ? g.tipo.varios(g.nrs.length) : `${g.titulo} (${n(g.nrs.length)} convênios)`,
      fato: g.fatos.join(" "),
      acao: g.tipo?.acao ?? null,
      peso: 3,
      numeros: g.nrs,
    });
  }
  return a;
}

interface TipoContas {
  re: RegExp;
  varios: (k: number) => string;
  classe: ClasseFila;
  quem: QuemResolve;
  acao: string;
}

/** Os riscos de contas e obras (`contas-obras.ts`) por tipo: título para vários, classe da fila, quem resolve e o que fazer. */
const TIPOS_CONTAS: readonly TipoContas[] = [
  {
    re: /impugnados na prestação de contas$/,
    varios: (k) => `Valores impugnados na prestação de contas de ${n(k)} convênios`,
    classe: "cobranca",
    quem: "municipio",
    acao: "Devolver o valor impugnado ou apresentar ao concedente a justificativa e os documentos que faltam; sem isso, vira tomada de contas especial.",
  },
  {
    re: /^Prestação de contas em diligência$/,
    varios: (k) => `Prestação de contas em diligência em ${n(k)} convênios`,
    classe: "cobranca",
    quem: "municipio",
    acao: "Responder à diligência da prestação de contas.",
  },
  {
    re: /^Obra paralisada$/,
    varios: (k) => `${n(k)} obras paralisadas`,
    classe: "cobranca",
    quem: "municipio",
    acao: "Registrar no Transferegov o motivo da paralisação e o plano de retomada, ou tratar com o concedente a rescisão e a devolução do saldo.",
  },
  {
    re: /^Obra sem medição há \d+ dias$/,
    varios: (k) => `${n(k)} obras sem medição há ${DIAS_SEM_MEDICAO_MODERADO} dias ou mais`,
    classe: "cobranca",
    quem: "municipio",
    acao: "Lançar no acompanhamento de obras do Transferegov as medições em atraso, ou registrar a paralisação com o motivo.",
  },
  {
    re: /^Obra atestada por inteiro, aceite da concedente pendente$/,
    varios: (k) => `${n(k)} obras atestadas por inteiro com o aceite da concedente pendente`,
    classe: "atencao",
    quem: "orgao",
    acao: "Cobrar da concedente ou da mandatária o aceite das medições já atestadas.",
  },
  {
    re: /^Executado atestado pelo convenente acima do da concedente$/,
    varios: (k) => `Executado atestado pelo convenente acima do da concedente em ${n(k)} convênios`,
    classe: "cobranca",
    quem: "municipio",
    acao: "Conferir com a mandatária as medições ainda não aceitas e completar o que falta para o aceite.",
  },
];

// ================================================================ propostas

export interface SecaoPropostas {
  desde: number;
  enviadas: number;
  assinadas: number;
  reprovadas: number;
  abertas: number;
  porDesfecho: { desfecho: string; rotulo: string; n: number; valor: number }[];
  paradasConcedente: PropostaRelatorio[];
  comProponente: PropostaRelatorio[];
}

export const ANO_INICIO_PROPOSTAS = 2019;
/** Proposta com o concedente sem evento há mais que isso é proposta parada. */
export const DIAS_PROPOSTA_PARADA = 365;

function secaoPropostas(e: EntradaRelatorio): SecaoPropostas | null {
  if (!e.propostas) return null;
  const ps = e.propostas.filter((p) => (p.ano_envio ?? 0) >= ANO_INICIO_PROPOSTAS);
  const contar = (d: string) => ps.filter((p) => p.desfecho === d).length;
  const desfechos = [...new Set(ps.map((p) => p.desfecho))];
  return {
    desde: ANO_INICIO_PROPOSTAS,
    enviadas: ps.length,
    assinadas: contar("assinada"),
    reprovadas: contar("reprovada"),
    abertas: ps.filter((p) => p.desfecho.startsWith("aberta") || p.desfecho === "aguardando_assinatura").length,
    porDesfecho: desfechos
      .map((d) => ({ desfecho: d, rotulo: ROTULO_DESFECHO[d] ?? d, n: contar(d), valor: soma(ps.filter((p) => p.desfecho === d), (p) => p.valor_repasse) }))
      .sort((a, b) => b.n - a.n),
    paradasConcedente: ps
      .filter((p) => p.desfecho === "aberta_concedente" && (p.dias_sem_evento ?? 0) > DIAS_PROPOSTA_PARADA)
      .sort((a, b) => (b.dias_sem_evento ?? 0) - (a.dias_sem_evento ?? 0)),
    comProponente: ps.filter((p) => p.desfecho === "aberta_proponente"),
  };
}

function achadosPropostas(s: SecaoPropostas): Achado[] {
  const a: Achado[] = [];
  if (s.paradasConcedente.length) {
    const anos = s.paradasConcedente.map((p) => p.ano_envio).filter((x): x is number => !!x);
    const nunca = s.paradasConcedente.filter((p) => p.limbo).length;
    a.push({
      nivel: "moderado",
      dimensao: "propostas",
      classe: "atencao",
      quem: "orgao",
      titulo: `${plural(s.paradasConcedente.length, "proposta parada", "propostas paradas")} com o concedente há mais de um ano`,
      fato:
        `Enviadas de ${Math.min(...anos)} a ${Math.max(...anos)}, sem evento há mais de um ano` +
        (nunca ? `; ${n(nunca)} ${nunca === 1 ? "delas não teve" : "delas não tiveram"} nenhum evento desde o envio` : "") +
        `. Das ${n(s.enviadas)} propostas enviadas desde ${s.desde}, ${n(s.assinadas)} foram assinadas e ${n(s.reprovadas)} reprovadas.`,
      acao: "Cobrar o concedente pelas propostas paradas, ou retirá-las, para liberar a capacidade da equipe.",
      peso: 6,
    });
  }
  if (s.comProponente.length) {
    a.push({
      nivel: "moderado",
      dimensao: "propostas",
      classe: "prazo",
      quem: "municipio",
      titulo: `${plural(s.comProponente.length, "proposta espera", "propostas esperam")} complementação do município`,
      fato: `O concedente pediu complemento e a vez é do município: ${moedaCurta(soma(s.comProponente, (p) => p.valor_repasse))} em repasse.`,
      acao: "Responder às complementações pedidas pelo concedente.",
      peso: 4,
    });
  }
  return a;
}

// ================================================================ Pix e fundo a fundo

export interface SecaoPix {
  planos: number;
  pago: number;
  pontos: { item: string; titulo: string; nivel: Nivel; planos: number; valor: number }[];
  marcas: { ano: number; titulo: string; nivel: Nivel; fato: string }[];
  semMarcaNoTce: boolean;
  fundo: { planos: number; repasse: number; encerradosComSaldo: number; saldoEncerrados: number; parados: number } | null;
  /** Planos impedidos nos dois últimos exercícios, por ano e motivo (oport_29, 07/10/2026). */
  impedidos: ImpedidosDoAno[];
  /** O ciclo em curso: um ponto por plano pendente, da vez do município primeiro (oport_30). */
  ciclo: PontoCiclo[];
}

/** O mesmo piso do job do fundo a fundo (pix_fundo/fundo.py, SALDO_MINIMO): saldo menor não é dinheiro parado. */
export const SALDO_MINIMO_FUNDO = 1000;

function secaoPix(e: EntradaRelatorio, hoje: string): SecaoPix | null {
  if (!e.pix && !e.pixTce && !e.fundo && !e.pixCiclo?.length) return null;
  const planos = e.pix ?? [];
  const pontos = new Map<string, { item: string; titulo: string; nivel: Nivel; planos: number; valor: number }>();
  for (const p of planos) {
    for (const i of pontosAConferir(p.itens)) {
      const k = `${i.item}|${i.titulo}`;
      const g = pontos.get(k) ?? { item: i.item, titulo: i.titulo, nivel: i.nivel as Nivel, planos: 0, valor: 0 };
      g.planos += 1;
      g.valor += p.pago || p.valor;
      pontos.set(k, g);
    }
  }
  const marcas = (e.pixTce ?? []).flatMap((t) => marcasPix(t).map((m) => ({ ano: t.ano, titulo: m.titulo, nivel: m.nivel as Nivel, fato: m.fato })));
  const comSaldo = (e.fundo ?? []).filter((f) => f.vigencia_encerrada && (f.saldo_contas ?? 0) > SALDO_MINIMO_FUNDO);
  const fundo = e.fundo
    ? {
        planos: e.fundo.length,
        repasse: soma(e.fundo, (f) => f.repasse),
        encerradosComSaldo: comSaldo.length,
        saldoEncerrados: soma(comSaldo, (f) => f.saldo_contas),
        parados: e.fundo.filter((f) => f.parado_12m).length,
      }
    : null;
  return {
    planos: planos.length,
    pago: soma(planos, (p) => p.pago),
    pontos: [...pontos.values()].sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] || b.valor - a.valor),
    marcas,
    semMarcaNoTce: (e.pixTce ?? []).length > 0 && marcas.length === 0,
    fundo,
    impedidos: impedidosPorAno(planos, Number(hoje.slice(0, 4)) - 1),
    ciclo: ordenarCiclo(e.pixCiclo ?? []).map((p) => pontoDoCiclo(p, hoje)),
  };
}

/** O que o município faz em cada item do laudo do Pix (`pix_fundo/laudo.py`, ITENS). Sem ação: o que depende de outro. */
const ACAO_PIX: Record<string, string> = {
  A1: "Cadastrar no plano de ação do Transferegov o e-mail da Câmara Municipal.",
  A4: "Manter cada transferência numa conta específica, em banco oficial, informada no plano de ação.",
  A4b: "Conferir no extrato cada saída para outra conta do município: retenção de tributo se explica; o resto volta à conta do plano.",
  C1: "Entregar os relatórios de gestão do Pix no Transferegov.",
  C1b: "Entregar os relatórios de gestão do Pix no Transferegov.",
  C3: "Anexar ao relatório de gestão os documentos de liquidação das despesas.",
  D1: "Concluir a execução no prazo; a prorrogação só cabe por atraso na liberação ou por paralisação (IN-TCU 93/2024, art. 5º).",
  D2: "Atualizar no relatório de gestão a execução do plano ou explicar o atraso.",
};

function achadosPix(s: SecaoPix): Achado[] {
  const a: Achado[] = [];
  for (const p of s.pontos) {
    a.push({
      nivel: p.nivel,
      dimensao: "pix",
      // o título do item é a regra ("Relatório de gestão no prazo"), e não o resultado: vai com "a conferir" na frente
      classe: /relat[óo]rio/i.test(p.titulo) ? "cobranca" : "atencao",
      // os 70% de capital são somados por autor da emenda (LC 210, art. 10, XIX): quem acerta é ele, não o município
      quem: p.item === "B4" ? "autor" : "municipio",
      titulo: `Pix, a conferir: ${p.titulo.charAt(0).toLowerCase()}${p.titulo.slice(1)} (${plural(p.planos, "plano", "planos")})`,
      fato: `${plural(p.planos, "plano", "planos")} do Pix com este ponto a conferir no roteiro da IN-TCU 93/2024, somando ${moedaCurta(p.valor)}. O detalhe está no laudo do Pix do ente.`,
      acao: ACAO_PIX[p.item] ?? (/relat[óo]rio/i.test(p.titulo) ? ACAO_PIX.C1 : null),
      peso: 4,
    });
  }
  for (const m of s.marcas) {
    a.push({
      nivel: m.nivel,
      dimensao: "pix",
      classe: "cobranca",
      quem: "municipio",
      titulo: `Pix no TCE-PB: ${m.titulo.toLowerCase()} (${m.ano})`,
      fato: m.fato,
      acao: "Conferir com a contabilidade as despesas pagas com a fonte 706 que o TCE-PB mostra e corrigir a classificação ou a destinação.",
      peso: 5,
    });
  }
  // Ciclo em curso: plano à espera do município pesa como o bloqueio fiscal (sem resposta no prazo, impedimento).
  for (const c of s.ciclo) {
    a.push({ nivel: c.nivel, dimensao: "pix", classe: c.classe, quem: c.quem, prazo: c.prazo, titulo: c.titulo, fato: c.fato, acao: c.acao, peso: c.nivel === "alto" ? 2 : 6 });
  }
  // Impedido: o dinheiro do plano não veio, salvo o que voltou no mesmo ano (reapresentação no ciclo seguinte,
  // ou repetição do mesmo plano). O que pesa é a PERDA LÍQUIDA: pela vez do município (não deu ciência, não
  // enviou, não complementou) é ponto para o próximo ciclo; sem perda, ou pela vez do órgão, é informação.
  for (const i of s.impedidos) {
    const doEnte = i.lado === "beneficiario";
    const perdeu = i.valorPerdido > 0;
    a.push({
      nivel: doEnte && perdeu ? "moderado" : "informativo",
      dimensao: "pix",
      classe: "atencao",
      quem: doEnte ? "municipio" : "orgao",
      titulo:
        `Pix impedido em ${i.ano}: ${i.rotulo.charAt(0).toLowerCase()}${i.rotulo.slice(1)} (${plural(i.planos, "plano", "planos")}, ` +
        (perdeu ? `${moedaCurta(i.valorPerdido)} perdidos)` : "nada perdido)"),
      fato:
        `${plural(i.planos, "plano", "planos")} do Pix ${i.planos === 1 ? "ficou impedido" : "ficaram impedidos"} em ${i.ano}, somando ${moedaCurta(i.valor)}.` +
        (i.recuperados
          ? ` ${plural(i.recuperados, "voltou", "voltaram")} no mesmo ano, reapresentado${i.recuperados === 1 ? "" : "s"} num ciclo seguinte (${moedaCurta(i.valorRecuperado)}); a perda líquida foi de ${moedaCurta(i.valorPerdido)}.`
          : " Nenhum voltou no mesmo ano.") +
        (i.reindicados ? ` Em ${i.ano + 1}, ${i.reindicados === 1 ? "1 teve" : `${i.reindicados} tiveram`} o município indicado de novo pelo mesmo autor.` : "") +
        " O porquê de cada um, com o parecer do órgão quando há, está no laudo do plano.",
      acao: doEnte && perdeu ? "Acompanhar os prazos do próximo ciclo do Pix e responder no Transferegov às complementações do plano de trabalho." : null,
      peso: 5,
    });
  }
  if (s.semMarcaNoTce) {
    a.push({
      nivel: "em_dia",
      dimensao: "pix",
      titulo: "Pix gasto em capital, sem pessoal nem dívida",
      fato: "Nas despesas abertas do TCE-PB com a fonte do Pix, nenhum pagamento de pessoal ou dívida e capital acima de 70% em cada ano.",
      acao: null,
      peso: 8,
    });
  }
  if (s.fundo && s.fundo.encerradosComSaldo > 0) {
    a.push({
      nivel: "moderado",
      dimensao: "pix",
      classe: "cobranca",
      quem: "municipio",
      titulo: `Fundo a fundo: ${plural(s.fundo.encerradosComSaldo, "plano encerrado", "planos encerrados")} com saldo em conta`,
      fato: `${moedaCurta(s.fundo.saldoEncerrados)} em conta em planos com a vigência encerrada.`,
      acao: null,
      peso: 6,
    });
  }
  return a;
}

// ================================================================ TCE-PB e fornecedores

export interface SecaoTcePb {
  anos: number[];
  siconv: number;
  casado: number;
  taxa: number | null;
  soTce: number;
}

function secaoTcePb(e: EntradaRelatorio): SecaoTcePb | null {
  if (!e.conciliacao || !e.conciliacao.length) return null;
  const r = resumirConciliacao(e.conciliacao);
  return { anos: [...new Set(e.conciliacao.map((m) => m.ano))].sort(), siconv: r.siconv, casado: r.siconvCasado, taxa: r.taxa, soTce: r.tceSo };
}

export interface SecaoFornecedores {
  concentracao: ConcentracaoMunicipio | null;
  faixa: string | null;
  inidoneos: { cnpj: string; nome: string | null; pago: number }[];
}

function achadosFornecedores(s: SecaoFornecedores): Achado[] {
  const a: Achado[] = [];
  if (s.inidoneos.length) {
    a.push({
      nivel: "alto",
      dimensao: "fornecedores",
      classe: "cobranca",
      quem: "municipio",
      titulo: `${plural(s.inidoneos.length, "fornecedor", "fornecedores")} na lista de inidôneos do TCU`,
      fato: `${lista(s.inidoneos.map((f) => `${f.nome ?? f.cnpj} (${moedaCurta(f.pago)} pagos)`))}. O laudo de cada convênio diz se o contrato é anterior ou posterior à sanção.`,
      acao: "Conferir no laudo de cada convênio se o contrato é posterior à sanção e, se for, comunicar ao concedente.",
      peso: 3,
    });
  }
  const c = s.concentracao;
  if (c && s.faixa === "alta") {
    a.push({
      nivel: "informativo",
      dimensao: "fornecedores",
      classe: "atencao",
      quem: "municipio",
      titulo: "Um fornecedor com mais da metade do pago",
      fato: `${c.maior_nome ?? c.maior_cnpj ?? "Um fornecedor"} recebeu ${c.maior_fatia !== null ? `${Math.round(c.maior_fatia * 100)}%` : "mais da metade"} do pago a empresas nos convênios do município. É indicador para olhar, não irregularidade.`,
      acao: null,
      peso: 8,
    });
  } else if (c && !s.inidoneos.length && s.faixa !== "pouco_dado") {
    a.push({
      nivel: "em_dia",
      dimensao: "fornecedores",
      titulo: "Fornecedores sem concentração e nenhum inidôneo no TCU",
      fato: `${plural(c.n_fornecedores, "empresa recebeu", "empresas receberam")} ${moedaCurta(c.pago_pj)} nos convênios do município.`,
      acao: null,
      peso: 9,
    });
  }
  return a;
}

// ================================================================ indicadores (camada 2)

const DIMENSAO_DO_INDICADOR: Record<DimensaoIndicador, Dimensao | null> = {
  municipio: null,
  saude: "social",
  educacao: "social",
  assistencia: "social",
  seguranca: "social",
  economia: "economia",
  territorio: "territorio",
  governanca: "governanca",
};

function fatoIndicador(x: IndicadorLido): string {
  const grupos = [x.porte ? `do porte ${x.porte}` : null, x.regiao ? `da região imediata ${x.regiao}` : null].filter(Boolean);
  return [
    `${x.texto} (${x.ano}).`,
    frasesReferencia(x) ? `${frasesReferencia(x)}.` : null,
    grupos.length ? `Mediana ${grupos.join("; ")}.` : null,
    `Fonte: ${x.fonte}.`,
    x.nota,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Um achado por indicador-chave alto ou moderado; os em dia viram um registro por dimensão. */
function achadosIndicadores(l: LeituraIndicadores): Achado[] {
  const a: Achado[] = [];
  const emDia = new Map<Dimensao, IndicadorLido[]>();
  for (const x of indicadoresComNivel(l)) {
    const dimensao = DIMENSAO_DO_INDICADOR[x.dimensao];
    if (!dimensao) continue;
    if (x.nivel === "em_dia") {
      emDia.set(dimensao, [...(emDia.get(dimensao) ?? []), x]);
      continue;
    }
    a.push({
      nivel: x.nivel === "alto" ? "alto" : "moderado",
      dimensao,
      classe: "atencao",
      quem: "municipio",
      titulo: `${x.nome}: ${x.porque}`,
      fato: fatoIndicador(x),
      acao: null,
      peso: x.nivel === "alto" ? 6 : 7,
    });
  }
  for (const [dimensao, xs] of emDia) {
    a.push({
      nivel: "em_dia",
      dimensao,
      titulo: `${ROTULO_DIMENSAO[dimensao]}: ${plural(xs.length, "indicador-chave", "indicadores-chave")} na mediana da PB ou melhor`,
      fato: `${lista(xs.map((x) => `${minuscula(x.nome)} (${x.texto})`))}.`,
      acao: null,
      peso: 10,
    });
  }
  return a;
}

// ================================================================ montagem

/** Os quatro números do topo, como no relatório de Patos. */
function cartoes(r: Pick<Relatorio, "fiscal" | "convenios" | "controle">, e: EntradaRelatorio): Cartao[] {
  const c: Cartao[] = [];
  const f = r.fiscal;
  const ultimo = f?.serie.at(-1);
  if (f && (ultimo?.dtp_pct ?? f.pessoal) !== null) {
    const valor = ultimo?.dtp_pct ?? f.pessoal ?? 0;
    c.push({
      rotulo: "Pessoal / RCL ajustada",
      valor: pct(valor),
      nota: f.acimaSeguidos ? `Teto de ${pct(ultimo?.limite_maximo_pct ?? LIMITE_MAXIMO_PADRAO)}. Acima dele desde o ${rotuloPeriodo(f.acimaDesde as PontoSerie)}.` : ultimo ? rotuloPeriodo(ultimo) : "último RGF",
      nivel: f.acimaSeguidos ? "alto" : valor > LIMITE_PRUDENCIAL_PADRAO ? "moderado" : "em_dia",
    });
  }
  if (f) {
    const p = f.caucPendencias;
    c.push({
      rotulo: "CAUC",
      valor: p.length ? plural(p.length, "pendência", "pendências") : "sem pendência",
      nota: p.length ? `Itens ${lista(p)}${e.fiscal?.referencia ? `, em ${data(e.fiscal.referencia)}` : ""}.` : "Nenhum item pendente no relatório do Tesouro.",
      nivel: p.length ? "critico" : "em_dia",
    });
  }
  const conv = r.convenios;
  if (conv) {
    const ex = (e.instrumentos ?? []).filter((i) => i.situacao === "Em execução");
    c.push({
      rotulo: "Convênios em execução",
      valor: moedaCurta(soma(ex, (i) => i.vl_global)),
      nota: `${plural(ex.length, "instrumento", "instrumentos")}; ${moedaCurta(soma(ex, (i) => i.vl_desembolsado))} desembolsados até agora.`,
      nivel: null,
    });
  }
  const ct = r.controle;
  if (ct) {
    c.push({
      rotulo: "TCE no TCU",
      valor: n(new Set(ct.tces.map((t) => t.nr_convenio)).size),
      nota: ct.tces.length ? `${moedaCurta(ct.debitoOriginal)} de débito original; ${moedaCurta(ct.debitoComJuros)} com juros.` : `Consulta de ${data(ct.referenciaTcu)}.`,
      nivel: ct.tces.length ? "critico" : "em_dia",
    });
  }
  return c;
}

/** A fila única (F1b): a mesma regra da carteira e da aba "o que trava". */
const ordenar = (a: Achado, b: Achado) => compararFila(a, b);

/** Quantos achados entram no "Em uma página". */
export const MAX_DESTAQUES = 6;
export const MAX_PASSOS = 5;

export function montarRelatorio(e: EntradaRelatorio, hoje: string): Relatorio {
  const fiscal = secaoFiscal(e);
  const convenios = secaoConvenios(e, hoje);
  const controle = secaoControle(e);
  const propostas = secaoPropostas(e);
  const pix = secaoPix(e, hoje);
  const tcePb = secaoTcePb(e);
  const fornecedores = e.fornecedores
    ? {
        concentracao: e.fornecedores.concentracao,
        faixa: e.fornecedores.concentracao ? faixaConcentracao(e.fornecedores.concentracao) : null,
        inidoneos: e.fornecedores.inidoneos,
      }
    : null;
  const comTce = new Set((controle?.tces ?? []).map((t) => t.nr_convenio));
  const indicadores = e.indicadores ? lerIndicadores(e.indicadores) : null;

  const achados = [
    ...(fiscal ? achadosFiscais(fiscal) : []),
    ...(controle ? achadosControle(controle, e) : []),
    ...(convenios ? achadosConvenios(convenios, e, hoje, comTce) : []),
    ...(propostas ? achadosPropostas(propostas) : []),
    ...(pix ? achadosPix(pix) : []),
    ...(fornecedores ? achadosFornecedores(fornecedores) : []),
    ...(indicadores ? achadosIndicadores(indicadores) : []),
  ].sort(ordenar);

  const emendas = e.emendas
    ? [...e.emendas.reduce((m, x) => {
        const k = x.parlamentar ?? "Não informado";
        const g = m.get(k) ?? { parlamentar: k, tipo: x.tipo_parlamentar, convenios: new Set<string>(), valor: 0 };
        g.convenios.add(x.nr_convenio);
        g.valor += x.valor ?? 0;
        return m.set(k, g);
      }, new Map<string, { parlamentar: string; tipo: string | null; convenios: Set<string>; valor: number }>()).values()]
        .map((g) => ({ parlamentar: g.parlamentar, tipo: g.tipo, convenios: g.convenios.size, valor: g.valor }))
        .sort((a, b) => b.valor - a.valor)
    : null;

  const base = { fiscal, convenios, controle };
  return {
    ibge: e.ibge,
    nome: e.nome,
    hoje,
    versao: VERSAO_RELATORIO,
    achados,
    cartoes: cartoes(base, e),
    destaques: achados.filter((a) => a.nivel !== "em_dia" && a.nivel !== "informativo").slice(0, MAX_DESTAQUES),
    emDia: achados.filter((a) => a.nivel === "em_dia"),
    passos: achados
      .filter((a) => a.acao && a.nivel !== "em_dia")
      .slice(0, MAX_PASSOS)
      .map((a) => ({ titulo: a.acao as string, porque: `Por quê: ${a.titulo.charAt(0).toLowerCase()}${a.titulo.slice(1)}.` })),
    fiscal,
    convenios,
    controle,
    propostas,
    emendas,
    pix,
    tcePb,
    fornecedores,
    janelas: e.janelas,
    indicadores,
    fontes: [
      { fonte: "Painel fiscal (Siconfi, CAUC, SIOPE, SIOPS, SADIPEM)", data: e.fiscal?.referencia ?? null, nota: "RGF do Executivo; série desde 2021 na evidência da despesa com pessoal." },
      { fonte: "SICONV / Transferegov (arquivos abertos)", data: e.referenciaPainel, nota: "Convênios, propostas, emendas e os pontos da Portaria Conjunta 33/2023." },
      { fonte: "e-TCE do TCU (API pública)", data: e.tcu?.referencia ?? null, nota: "Tomadas de contas especiais por convênio." },
      { fonte: "Acesso Livre do Transferegov", data: null, nota: "Prestação de contas e obras, só nos convênios das coletas." },
      { fonte: "API das transferências especiais e do fundo a fundo", data: null, nota: "Laudo do Pix pelo roteiro da IN-TCU 93/2024." },
      { fonte: "TCE-PB (despesas abertas)", data: null, nota: "Pix na despesa do município e conciliação com o SICONV." },
      {
        fonte: "Indicadores do município (IBGE, Ministério da Saúde, INEP, MDS, MJSP, MTE, Ministério das Cidades, MIDR, ANA, Anatel, Senatran, Atricon e TCE-PB)",
        data: e.indicadores?.coletadoEm ?? null,
        nota: `Arquivos e APIs abertos, lidos em lote pela PONTE; cada indicador traz o seu ano e a sua fonte. Nível pela regra ${VERSAO_REGRA_INDICADOR}: alto no pior quartil da PB e pior que o Brasil; moderado pior que a mediana da PB ou que o Brasil; diferença de até 5% conta como empate.`,
      },
    ],
    faltas: e.faltas,
  };
}

/** As dimensões da camada 2 (estratégia): ficam na aba "Indicadores", fora da fila de operação. */
const CAMADA_2: readonly Dimensao[] = ["social", "economia", "territorio", "governanca"];

export interface FilaMunicipio {
  grupos: { classe: ClasseFila; itens: Achado[] }[];
  /** O que fica fora da fila, com a aba onde mora: pontos só de informação e indicadores piores que a PB. */
  informativos: number;
  indicadores: number;
}

/**
 * A aba "o que trava e o que destrava" (F1b): os pontos de operação do município em classes (trava dinheiro novo,
 * pode virar cobrança, tem prazo, pede atenção), na mesma ordem do "Em uma página" e da carteira. Sai o que está
 * em dia, o que é só informação e os indicadores da camada 2, que são estratégia e moram na aba deles.
 */
export function filaDoMunicipio(r: Relatorio): FilaMunicipio {
  const vivos = r.achados.filter((a) => a.nivel !== "em_dia");
  const camada2 = (a: Achado) => CAMADA_2.includes(a.dimensao);
  return {
    grupos: grupos(vivos.filter((a) => !camada2(a) && a.nivel !== "informativo")),
    informativos: vivos.filter((a) => !camada2(a) && a.nivel === "informativo").length,
    indicadores: vivos.filter((a) => camada2(a) && a.nivel !== "informativo").length,
  };
}

/**
 * A versão do relatório para quem não é administrador (decisão D1 de 06/10/2026: o cadastrado vê o relatório, mas
 * o fornecedor com nome fica no painel interno). Sai só o que identifica a empresa: a razão social e o CNPJ do
 * inidôneo e do maior fornecedor. Contagens, valores e o resto do relatório ficam como estão.
 */
export function relatorioSemNomes(r: Relatorio): Relatorio {
  const s = r.fornecedores;
  if (!s) return r;
  const semNome = (a: Achado): Achado => {
    if (a.dimensao !== "fornecedores") return a;
    if (a.titulo.includes("inidôneos do TCU")) {
      return {
        ...a,
        fato: `Somam ${moedaCurta(soma(s.inidoneos, (f) => f.pago))} pagos nos convênios do município. O nome de cada empresa fica no painel interno da PONTE; o laudo de cada convênio diz se o contrato é anterior ou posterior à sanção.`,
      };
    }
    if (a.titulo === "Um fornecedor com mais da metade do pago") {
      const fatia = s.concentracao?.maior_fatia;
      return {
        ...a,
        fato: `Uma empresa recebeu ${fatia !== null && fatia !== undefined ? `${Math.round(fatia * 100)}%` : "mais da metade"} do pago a empresas nos convênios do município. É indicador para olhar, não irregularidade.`,
      };
    }
    return a;
  };
  const trocados = new Map(r.achados.map((a) => [a, semNome(a)]));
  const troca = (xs: Achado[]) => xs.map((a) => trocados.get(a) ?? semNome(a));
  return {
    ...r,
    achados: troca(r.achados),
    destaques: troca(r.destaques),
    emDia: troca(r.emDia),
    fornecedores: {
      ...s,
      concentracao: s.concentracao ? { ...s.concentracao, maior_nome: null, maior_cnpj: null } : null,
      inidoneos: s.inidoneos.map((f) => ({ cnpj: "", nome: null, pago: f.pago })),
    },
  };
}

/** O CSV do relatório: um achado por linha (pelo `paraCsv` do painel). */
export const COLUNAS_CSV_ACHADOS: ColunaCsv<Achado>[] = [
  { titulo: "Nível", valor: (a) => ROTULO_NIVEL_ACHADO[a.nivel] },
  { titulo: "Dimensão", valor: (a) => ROTULO_DIMENSAO[a.dimensao] },
  { titulo: "Achado", valor: (a) => a.titulo },
  { titulo: "Fato", valor: (a) => a.fato },
  { titulo: "O que fazer", valor: (a) => a.acao },
  { titulo: "Convênios", valor: (a) => (a.numeros ?? []).join(" ") },
];
