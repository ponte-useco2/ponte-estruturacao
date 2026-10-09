/**
 * A saúde das rodadas (onda 9, C, 09/10/2026): a tela `/mapa/painel/rodadas` mostra, job a job, a última execução
 * concluída e há quanto tempo, se alguma ficou "gravando" parada, as contagens principais do `contagens` e se a rodada
 * está em dia. Até aqui o supervisor conferia isso à mão, pelo MCP do Supabase e pelo `gh`.
 *
 * Funções puras, sem banco e sem relógio: o instante de agora entra como argumento. A leitura mora em
 * `rodadas.server.ts`.
 *
 * A cadência de cada job vem dos workflows do monorepo (`.github/workflows/*.yml`) e está escrita aqui como constante.
 * O teste lê os arquivos e falha se o cron, o tempo-limite ou a lista de workflows agendados mudarem sem esta tabela
 * mudar junto. O disparo diário do radar e do fiscal vem da Vercel às 11h30 UTC (`agendamento.ts`); o `schedule` do
 * GitHub é a reserva e, desde 29/08/2026, sai de 4 a 5 h depois do cron. Daí a folga: a rodada só fica "atrasada"
 * depois do intervalo da cadência mais a folga do job.
 *
 * Nomes das tabelas e das chaves do `contagens` conferidos pelo MCP em 09/10/2026 (só os catálogos e as tabelas
 * `*_execucao`; a coluna `erro`, texto livre, não é lida nem mostrada).
 */
import { REPOSITORIO } from "./agendamento.ts";
import { dataBrasilia } from "./datas.ts";

// ================================================================ cadência e folga

/** "assistida": coleta conduzida no navegador (Acesso Livre), sem agendamento; nunca fica atrasada. */
export type Cadencia = "diaria" | "semanal" | "mensal" | "assistida";

export const ROTULO_CADENCIA: Record<Cadencia, string> = {
  diaria: "diária",
  semanal: "semanal",
  mensal: "mensal",
  assistida: "assistida",
};

/** O maior intervalo entre dois disparos de cada cadência: o mês mais longo tem 31 dias. */
export const INTERVALO_H: Record<Exclude<Cadencia, "assistida">, number> = { diaria: 24, semanal: 7 * 24, mensal: 31 * 24 };

/** O atraso do agendador do GitHub desde 29/08/2026 (de 4 a 5 h depois do cron), arredondado para cima. */
export const ATRASO_GITHUB_H = 5;

/**
 * A folga de quase todos os jobs: o atraso do GitHub (5 h), o tempo-limite do workflow (até 2 h) e 1 h de margem. Nos
 * diários do agendador, cobre também a distância entre o disparo da Vercel (11h30 UTC) e o cron de reserva (até
 * 12h45): a rodada de ontem saiu às 11h50 pela Vercel, a de hoje sai às 19h05 se só a reserva rodar — 31 h depois.
 */
export const FOLGA_PADRAO_H = 8;

/** Uma execução "gravando" há mais que isto parou (o job morreu sem marcar erro: tempo-limite, runner derrubado). */
export const LIMITE_GRAVANDO_H = 2;

/** O tipo de cadência de um cron de cinco campos (minuto hora dia-do-mês mês dia-da-semana), ou null. */
export function cadenciaDoCron(cron: string): Exclude<Cadencia, "assistida"> | null {
  const campos = cron.trim().split(/\s+/);
  if (campos.length !== 5) return null;
  const [, , dia, mes, semana] = campos;
  if (mes !== "*") return null;
  if (dia === "*" && semana === "*") return "diaria";
  if (dia === "*") return "semanal";
  if (semana === "*") return "mensal";
  return null;
}

const DIAS_DA_SEMANA = ["todo domingo", "toda segunda", "toda terça", "toda quarta", "toda quinta", "toda sexta", "todo sábado"];

/** O cron por extenso, em UTC, como está no workflow: "todo dia, 12h45 UTC", "dias 20 e 28, 10h00 UTC". */
export function descreverCron(cron: string): string {
  const campos = cron.trim().split(/\s+/);
  const tipo = cadenciaDoCron(cron);
  if (!tipo) return cron;
  const [minuto, hora, dia, , semana] = campos;
  const quando = `${hora.padStart(2, "0")}h${minuto.padStart(2, "0")} UTC`;
  if (tipo === "diaria") return `todo dia, ${quando}`;
  if (tipo === "semanal") {
    const d = Number(semana);
    return Number.isInteger(d) && d >= 0 && d <= 7 ? `${DIAS_DA_SEMANA[d % 7]}, ${quando}` : cron;
  }
  const dias = dia.split(",");
  return dias.length === 1 ? `dia ${dias[0]}, ${quando}` : `dias ${dias.slice(0, -1).join(", ")} e ${dias.at(-1)}, ${quando}`;
}

// ================================================================ os jobs

export type Contagens = Record<string, unknown>;

const n = (x: number) => x.toLocaleString("pt-BR");
const plural = (x: number, um: string, varios: string) => `${n(x)} ${x === 1 ? um : varios}`;

/** O número de uma chave do `contagens`, ou null quando falta ou não é número. */
export function numero(c: Contagens, chave: string): number | null {
  const v = c[chave];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function objeto(c: Contagens, chave: string): Record<string, unknown> {
  const v = c[chave];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const tamanho = (c: Contagens, chave: string) => {
  const v = c[chave];
  return Array.isArray(v) ? v.length : 0;
};

const soma = (o: Record<string, unknown>) => Object.values(o).reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0);

/** Avisos de "ficou para a próxima rodada" e afins: só entram quando o número é maior que zero. */
function seMaior(x: number | null, texto: (x: number) => string): string[] {
  return x !== null && x > 0 ? [texto(x)] : [];
}

export interface JobRodada {
  /** O prefixo da tabela, mais o recorte quando a tabela tem recorte ("al:obras"). */
  id: string;
  nome: string;
  /** A tabela de execuções no Supabase. */
  tabela: string;
  /** Só `al_execucao` e `exigencia_execucao`: cada recorte tem a sua última execução. */
  recorte: string | null;
  cadencia: Cadencia;
  /** O arquivo em `.github/workflows/` (null: coleta assistida). */
  workflow: string | null;
  /** O `schedule` do workflow, como está lá (UTC). */
  cron: string | null;
  folgaH: number;
  /** A contagem principal do `contagens` e o que ela conta. */
  linhas: (c: Contagens) => number | null;
  rotuloLinhas: string;
  /** null: o job não conta falhas no `contagens`. */
  falhas: (c: Contagens) => number | null;
  /** O que o próprio job anotou como incompleto. Sem nome de pessoa: só números e nomes de fonte. */
  avisos: (c: Contagens) => string[];
}

const nenhumAviso = () => [];
const semFalhas = () => null;

/**
 * Os jobs com tabela de execução no banco, na ordem da tela: diários, semanais, mensais, assistidos. Conferidos em
 * 09/10/2026 contra os workflows e contra o catálogo do banco (12 tabelas `*_execucao`, 14 linhas com os recortes).
 */
export const JOBS_RODADAS: readonly JobRodada[] = [
  // radar-propostas.yml: quatro passos no mesmo job, cada um com a sua execução.
  {
    id: "radar",
    nome: "Radar de propostas",
    tabela: "radar_execucao",
    recorte: null,
    cadencia: "diaria",
    workflow: "radar-propostas.yml",
    cron: "45 12 * * *",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => numero(c, "janelas_abertas"),
    rotuloLinhas: "janelas abertas",
    falhas: semFalhas,
    avisos: nenhumAviso,
  },
  {
    id: "pixc",
    nome: "Pix: ciclo em curso",
    tabela: "pixc_execucao",
    recorte: null,
    cadencia: "diaria",
    workflow: "radar-propostas.yml",
    cron: "45 12 * * *",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => numero(c, "ciclo_planos_uf"),
    rotuloLinhas: "planos da UF no ciclo",
    falhas: semFalhas,
    avisos: (c) => [
      ...seMaior(tamanho(c, "ciclo_situacoes_novas"), (x) => `${plural(x, "situação nova", "situações novas")} de plano que o ciclo não conhece`),
      ...seMaior(numero(c, "ciclo_a_conferir"), (x) => `${plural(x, "plano", "planos")} a conferir`),
    ],
  },
  {
    id: "painel",
    nome: "Painel de execução",
    tabela: "painel_execucao",
    recorte: null,
    cadencia: "diaria",
    workflow: "radar-propostas.yml",
    cron: "45 12 * * *",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => numero(c, "instrumentos"),
    rotuloLinhas: "instrumentos",
    falhas: semFalhas,
    avisos: (c) => [
      ...seMaior(tamanho(c, "pc33_arquivos_ausentes"), (x) => `${plural(x, "arquivo", "arquivos")} da Portaria Conjunta 33 ausente${x === 1 ? "" : "s"}`),
      ...(c.tcu_verificado === false ? ["a lista de inidôneos do TCU não foi verificada"] : []),
    ],
  },
  {
    id: "tce",
    nome: "Dinheiro federal no TCE-PB",
    tabela: "tce_execucao",
    recorte: null,
    cadencia: "diaria",
    workflow: "radar-propostas.yml",
    cron: "45 12 * * *",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => numero(c, "tce_arquivos_lidos"),
    rotuloLinhas: "arquivos do TCE-PB lidos",
    falhas: (c) => numero(objeto(c, "tce_downloads"), "falhas"),
    avisos: (c) => {
      const lidos = numero(c, "tce_arquivos_lidos");
      const esperados = numero(c, "tce_arquivos_esperados");
      const faltam = lidos !== null && esperados !== null ? esperados - lidos : null;
      return [
        ...seMaior(faltam, (x) => `${plural(x, "arquivo", "arquivos")} de ${n(esperados ?? 0)} ainda não lido${x === 1 ? "" : "s"}`),
        ...seMaior(numero(objeto(c, "tce_downloads"), "adiados"), (x) => `${plural(x, "download adiado", "downloads adiados")} para a próxima rodada`),
        ...(c.tce_listagem_ok === false ? ["a listagem de arquivos do TCE-PB não respondeu"] : []),
      ];
    },
  },
  {
    id: "fiscal",
    nome: "Capacidade fiscal (PB)",
    tabela: "fiscal_execucao",
    recorte: null,
    cadencia: "diaria",
    workflow: "fiscal.yml",
    cron: "0 12 * * *",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => numero(c, "municipios"),
    rotuloLinhas: "municípios",
    // `fontes_com_erro`: {fonte: chamadas que falharam} (09/10: vazio; 03/10: siconfi_rreo1 e siconfi_rreo9).
    falhas: (c) => soma(objeto(c, "fontes_com_erro")),
    avisos: (c) => {
      const fontes = Object.keys(objeto(c, "fontes_com_erro"));
      return fontes.length ? [`fonte${fontes.length === 1 ? "" : "s"} com erro: ${fontes.join(", ")}`] : [];
    },
  },
  {
    id: "pix",
    nome: "Pix e fundo a fundo",
    tabela: "pix_execucao",
    recorte: null,
    cadencia: "semanal",
    workflow: "pix-fundo.yml",
    cron: "15 8 * * 1",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => {
      const especiais = numero(c, "especiais_planos");
      const fundo = numero(c, "fundo_planos");
      return especiais === null && fundo === null ? null : (especiais ?? 0) + (fundo ?? 0);
    },
    rotuloLinhas: "planos (especiais e fundo a fundo)",
    falhas: semFalhas,
    avisos: nenhumAviso,
  },
  {
    id: "tcu",
    nome: "Tomadas de contas especiais (e-TCE do TCU)",
    tabela: "tcu_execucao",
    recorte: null,
    cadencia: "semanal",
    workflow: "tce-tcu.yml",
    cron: "0 9 * * 3",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => numero(c, "tcu_consultados"),
    rotuloLinhas: "convênios consultados",
    falhas: (c) => numero(c, "tcu_erros"),
    avisos: (c) => [
      ...seMaior(numero(c, "tcu_nao_consultados"), (x) => `${plural(x, "convênio ficou", "convênios ficaram")} para a próxima rodada`),
      ...(c.tcu_disjuntor === true ? ["o disjuntor interrompeu a consulta"] : []),
    ],
  },
  {
    id: "sancao",
    nome: "Sanções (CEIS e CNEP)",
    tabela: "sancao_execucao",
    recorte: null,
    cadencia: "semanal",
    workflow: "sancoes.yml",
    cron: "15 3 * * 0",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => numero(c, "sancao_consultados"),
    rotuloLinhas: "fornecedores consultados",
    falhas: (c) => numero(c, "sancao_erros"),
    avisos: (c) => [
      ...seMaior(numero(c, "sancao_nao_consultados"), (x) => `${plural(x, "fornecedor ficou", "fornecedores ficaram")} para a próxima rodada`),
      // `sancao_parada`: o motivo de a consulta parar antes do fim (null quando foi até o fim).
      ...(c.sancao_parada !== null && c.sancao_parada !== undefined ? ["a consulta parou antes do fim"] : []),
    ],
  },
  {
    id: "mun",
    nome: "Indicadores dos municípios",
    tabela: "mun_execucao",
    recorte: null,
    cadencia: "mensal",
    workflow: "municipios.yml",
    cron: "0 10 5 * *",
    folgaH: FOLGA_PADRAO_H,
    linhas: (c) => {
      const porFonte = objeto(c, "linhas_por_fonte");
      return Object.keys(porFonte).length ? soma(porFonte) : null;
    },
    rotuloLinhas: "linhas de indicador",
    // `avisos`: {fonte: mensagens}. A fonte que falha repete as linhas da rodada anterior (com nota).
    falhas: (c) => Object.keys(objeto(c, "avisos")).length,
    avisos: (c) => {
      const fontes = Object.keys(objeto(c, "avisos"));
      return fontes.length ? [`fonte${fontes.length === 1 ? "" : "s"} repetida${fontes.length === 1 ? "" : "s"} da rodada anterior: ${fontes.join(", ")}`] : [];
    },
  },
  {
    id: "osc",
    nome: "Organizações da sociedade civil",
    tabela: "osc_execucao",
    recorte: null,
    cadencia: "mensal",
    workflow: "osc.yml",
    cron: "0 10 20,28 * *",
    // O job não grava execução quando a versão do arquivo do Ipea é a da última carga, e o dia 28 existe para pegar o
    // arquivo que sai atrasado: a carga de um mês pode vir até 8 dias depois da do anterior (dia 20 → dia 28).
    folgaH: 8 * 24 + FOLGA_PADRAO_H,
    linhas: (c) => numero(c, "ativas"),
    rotuloLinhas: "OSC ativas na PB",
    falhas: (c) => numero(c, "malformadas_pb"),
    avisos: (c) => [
      ...(c.cebas_ok === false ? ["as planilhas do CEBAS não foram lidas"] : []),
      ...seMaior(soma(objeto(c, "descartadas")), (x) => `${plural(x, "linha descartada", "linhas descartadas")} (CNPJ inválido ou repetido)`),
    ],
  },
  // Coletas assistidas no navegador (Acesso Livre): sem agendamento, cada recorte com a sua última execução.
  {
    id: "al:prestacao",
    nome: "Acesso Livre: prestação de contas",
    tabela: "al_execucao",
    recorte: "prestacao",
    cadencia: "assistida",
    workflow: null,
    cron: null,
    folgaH: 0,
    linhas: (c) => numero(c, "al_convenios"),
    rotuloLinhas: "convênios",
    falhas: (c) => numero(c, "al_erros"),
    avisos: nenhumAviso,
  },
  {
    id: "al:obras",
    nome: "Acesso Livre: obras",
    tabela: "al_execucao",
    recorte: "obras",
    cadencia: "assistida",
    workflow: null,
    cron: null,
    folgaH: 0,
    linhas: (c) => numero(c, "al_convenios"),
    rotuloLinhas: "convênios",
    falhas: (c) => numero(c, "al_erros"),
    avisos: nenhumAviso,
  },
  {
    id: "exigencia:suspensiva",
    nome: "Exigências da suspensiva",
    tabela: "exigencia_execucao",
    recorte: "suspensiva",
    cadencia: "assistida",
    workflow: null,
    cron: null,
    folgaH: 0,
    linhas: (c) => numero(c, "instrumentos"),
    rotuloLinhas: "instrumentos",
    falhas: (c) => numero(c, "instrumentos_com_erro"),
    avisos: (c) => seMaior(numero(c, "recusados"), (x) => `${plural(x, "linha recusada", "linhas recusadas")} na carga`),
  },
  {
    id: "exigencia:assinatura",
    nome: "Exigências antes da assinatura",
    tabela: "exigencia_execucao",
    recorte: "assinatura",
    cadencia: "assistida",
    workflow: null,
    cron: null,
    folgaH: 0,
    linhas: (c) => numero(c, "instrumentos"),
    rotuloLinhas: "instrumentos",
    falhas: (c) => numero(c, "instrumentos_com_erro"),
    avisos: (c) => seMaior(numero(c, "recusados"), (x) => `${plural(x, "linha recusada", "linhas recusadas")} na carga`),
  },
];

/** Os workflows agendados das rodadas, sem repetição, na ordem da tela. */
export const WORKFLOWS_DAS_RODADAS: readonly string[] = [
  ...new Set(JOBS_RODADAS.map((j) => j.workflow).filter((w): w is string => w !== null)),
];

/** O cron de cada workflow, tirado da tabela dos jobs (o mesmo para todos os jobs de um workflow). */
export function cronDoWorkflow(workflow: string): string | null {
  return JOBS_RODADAS.find((j) => j.workflow === workflow)?.cron ?? null;
}

/** Quanto tempo a última concluída pode ter antes de a rodada ficar atrasada; null para a coleta assistida. */
export function prazoH(job: Pick<JobRodada, "cadencia" | "folgaH">): number | null {
  return job.cadencia === "assistida" ? null : INTERVALO_H[job.cadencia] + job.folgaH;
}

// ================================================================ o estado de cada linha

export type EstadoRodada = "em_dia" | "atrasada" | "com_aviso" | "nao_lido";

export const ROTULO_ESTADO: Record<EstadoRodada, string> = {
  em_dia: "em dia",
  atrasada: "atrasada",
  com_aviso: "com aviso",
  nao_lido: "não lido",
};

/** Marca de forma, além da cor: o estado não pode depender só de cor (WCAG 1.4.1), como em `fiscal.ts`. */
export const MARCA_ESTADO: Record<EstadoRodada, string> = { em_dia: "✓", atrasada: "▲", com_aviso: "!", nao_lido: "?" };

export const TOM_ESTADO: Record<EstadoRodada, "aderente" | "urgente" | "proto" | "neutro"> = {
  em_dia: "aderente",
  atrasada: "urgente",
  com_aviso: "proto",
  nao_lido: "neutro",
};

/** A ordem dos cartões do topo: o que pede ação primeiro. */
export const ESTADOS: readonly EstadoRodada[] = ["atrasada", "com_aviso", "nao_lido", "em_dia"];

/** A última execução concluída, só com as colunas que a tela usa. */
export interface ExecucaoConcluida {
  id: number;
  iniciada_em: string;
  concluida_em: string | null;
  contagens: Contagens | null;
}

/** As execuções que não concluíram ("gravando" ou "erro"), mais novas primeiro. */
export interface ExecucaoAberta {
  id: number;
  status: string;
  iniciada_em: string;
}

/** "ausente": a tabela não existe no banco (migração não aplicada); "falha": a leitura não respondeu. */
export type MotivoNaoLido = "ausente" | "falha";

export type LeituraRodada =
  | { estado: "ok"; ultima: ExecucaoConcluida | null; abertas: readonly ExecucaoAberta[] }
  | { estado: "nao_lido"; motivo: MotivoNaoLido };

export interface GravandoAgora {
  iniciadaEm: string;
  idadeH: number;
  /** Mais de `LIMITE_GRAVANDO_H` gravando: o job morreu sem marcar erro. */
  parada: boolean;
}

export interface LinhaRodada {
  job: JobRodada;
  estado: EstadoRodada;
  motivoNaoLido: MotivoNaoLido | null;
  /** O fim da última execução concluída (o início, se o fim faltar). */
  concluidaEm: string | null;
  idadeH: number | null;
  prazoH: number | null;
  linhas: number | null;
  falhas: number | null;
  /** O erro mais novo que a última concluída e o que o job anotou. A "gravando" parada tem coluna própria. */
  avisos: string[];
  /** A execução "gravando" mais antiga, se houver. */
  gravando: GravandoAgora | null;
}

const HORA_MS = 3600 * 1000;

function horasDesde(iso: string, agora: number): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : (agora - t) / HORA_MS;
}

/**
 * O estado de uma linha. A ordem decide quando mais de um vale: "não lido" (nada a dizer), "atrasada" (o dado está
 * velho; os avisos continuam listados), "com aviso" (rodou no prazo, mas parou, falhou ou deixou coisa para depois),
 * "em dia".
 *
 * - Atrasada: a última concluída passou de `prazoH` (intervalo da cadência + folga), ou a agendada nunca concluiu.
 * - Com aviso: uma execução "gravando" há mais de `LIMITE_GRAVANDO_H`; uma tentativa em erro mais nova que a última
 *   concluída; falha contada no `contagens`; um aviso do próprio job; a coleta assistida que nunca concluiu.
 * A tentativa em erro anterior à última concluída é história, não aviso (o Acesso Livre de obras, 02/10/2026: erro às
 * 03h06 UTC, concluída às 03h10 UTC).
 */
export function avaliarRodada(job: JobRodada, leitura: LeituraRodada, agora: number): LinhaRodada {
  const prazo = prazoH(job);
  const base = { job, prazoH: prazo, linhas: null, falhas: null, avisos: [], gravando: null, concluidaEm: null, idadeH: null };
  if (leitura.estado === "nao_lido") return { ...base, estado: "nao_lido", motivoNaoLido: leitura.motivo };

  const { ultima, abertas } = leitura;
  const concluidaEm = ultima ? (ultima.concluida_em ?? ultima.iniciada_em) : null;
  const idadeH = concluidaEm ? horasDesde(concluidaEm, agora) : null;
  const c = ultima?.contagens ?? {};

  const gravandoMaisAntiga = abertas
    .filter((a) => a.status === "gravando")
    .reduce<ExecucaoAberta | null>((velha, a) => (!velha || Date.parse(a.iniciada_em) < Date.parse(velha.iniciada_em) ? a : velha), null);
  let gravando: GravandoAgora | null = null;
  if (gravandoMaisAntiga) {
    const h = horasDesde(gravandoMaisAntiga.iniciada_em, agora) ?? 0;
    gravando = { iniciadaEm: gravandoMaisAntiga.iniciada_em, idadeH: h, parada: h > LIMITE_GRAVANDO_H };
  }

  const avisos: string[] = [];
  const inicioUltima = ultima ? Date.parse(ultima.iniciada_em) : Number.NEGATIVE_INFINITY;
  const erroNovo = abertas
    .filter((a) => a.status === "erro" && Date.parse(a.iniciada_em) > inicioUltima)
    .sort((a, b) => Date.parse(b.iniciada_em) - Date.parse(a.iniciada_em))[0];
  if (erroNovo) avisos.push(`a tentativa de ${dataHoraBrasilia(erroNovo.iniciada_em)} terminou em erro`);

  if (ultima) avisos.push(...job.avisos(c));
  else if (job.cadencia === "assistida") avisos.push("nenhuma coleta concluída");

  const falhas = ultima ? job.falhas(c) : null;
  const atrasada = prazo !== null && (idadeH === null || idadeH > prazo);
  const comAviso = avisos.length > 0 || (falhas ?? 0) > 0 || gravando?.parada === true;
  const estado: EstadoRodada = atrasada ? "atrasada" : comAviso ? "com_aviso" : "em_dia";

  return {
    job,
    estado,
    motivoNaoLido: null,
    concluidaEm,
    idadeH,
    prazoH: prazo,
    linhas: ultima ? job.linhas(c) : null,
    falhas,
    avisos,
    gravando,
  };
}

/** Quantas linhas em cada estado, para os cartões do topo. */
export function contarEstados(linhas: readonly Pick<LinhaRodada, "estado">[]): Record<EstadoRodada, number> {
  const conta: Record<EstadoRodada, number> = { em_dia: 0, atrasada: 0, com_aviso: 0, nao_lido: 0 };
  for (const l of linhas) conta[l.estado] += 1;
  return conta;
}

// ================================================================ datas e tempos por extenso

/** "HH:MM" em Brasília: a mesma regra de `datas.ts` (UTC−3, sem horário de verão). Instante inválido: "". */
export function horaBrasilia(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t - 3 * HORA_MS).toISOString().slice(11, 16);
}

/** "09/10/2026 às 08:49", em Brasília (o dia por `dataBrasilia`). Vazio ou inválido: "—". */
export function dataHoraBrasilia(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "—";
  return `${dataBrasilia(iso)} às ${horaBrasilia(iso)}`;
}

/** "há 35 min", "há 6 h", "há 3 dias". Menos de um minuto conta como um; até 48 h, em horas. */
export function haQuanto(horas: number): string {
  if (horas < 1) return `há ${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `há ${Math.floor(horas)} h`;
  return `há ${Math.floor(horas / 24)} dias`;
}

/** O prazo por extenso: "32 h", "7 dias e 8 h", "31 dias". */
export function textoPrazo(horas: number): string {
  if (horas < 48) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return resto ? `${dias} dias e ${resto} h` : `${dias} dias`;
}

// ================================================================ a última execução no GitHub (opcional)

/**
 * A última execução de um workflow no GitHub, pelo token do agendador (`GITHUB_DISPARO_TOKEN`, fine-grained, só
 * Actions do ponte-oportunidades, "read and write": a leitura cabe). Quem chama é `rodadas.server.ts`, no servidor; sem
 * o token, a coluna diz "não configurado". O token nunca aparece no retorno, como em `agendamento.ts`.
 */
export interface RodadaGithub {
  workflow: string;
  estado: "ok" | "sem_execucao" | "falha";
  /** "queued", "in_progress", "completed"… */
  status: string | null;
  /** "success", "failure", "cancelled", "skipped"… (null enquanto roda). */
  conclusao: string | null;
  evento: string | null;
  criadaEm: string | null;
  url: string | null;
  /** Na falha: o status HTTP (0 = rede ou tempo-limite). */
  http: number | null;
}

type BuscarGithub = (url: string, init: RequestInit) => Promise<Pick<Response, "status" | "json">>;

const TEMPO_LIMITE_GITHUB_MS = 8_000;

export function urlExecucoesGithub(workflow: string): string {
  return `https://api.github.com/repos/${REPOSITORIO}/actions/workflows/${workflow}/runs?per_page=1`;
}

const texto = (v: unknown) => (typeof v === "string" && v ? v : null);

export async function ultimaNoGithub(token: string, workflow: string, buscar: BuscarGithub = fetch): Promise<RodadaGithub> {
  const vazio = { workflow, status: null, conclusao: null, evento: null, criadaEm: null, url: null, http: null };
  try {
    const r = await buscar(urlExecucoesGithub(workflow), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ponte-rodadas",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_GITHUB_MS),
    });
    if (r.status < 200 || r.status >= 300) return { ...vazio, estado: "falha", http: r.status };
    const corpo = (await r.json()) as { workflow_runs?: unknown };
    const run = Array.isArray(corpo?.workflow_runs) ? (corpo.workflow_runs[0] as Record<string, unknown> | undefined) : undefined;
    if (!run || typeof run !== "object") return { ...vazio, estado: "sem_execucao" };
    return {
      workflow,
      estado: "ok",
      status: texto(run.status),
      conclusao: texto(run.conclusion),
      evento: texto(run.event),
      criadaEm: texto(run.created_at),
      url: texto(run.html_url),
      http: null,
    };
  } catch {
    return { ...vazio, estado: "falha", http: 0 };
  }
}

/**
 * A situação da execução no GitHub, com marca e palavra ("✓" "sucesso", "✕" "falhou"). A marca fica fora da leitura em
 * voz alta; a palavra é lida.
 */
export function rotuloGithub(r: Pick<RodadaGithub, "estado" | "status" | "conclusao" | "http">): { marca: string; texto: string } {
  if (r.estado === "sem_execucao") return { marca: "–", texto: "nenhuma execução" };
  if (r.estado === "falha") return { marca: "?", texto: r.http ? `não respondeu (HTTP ${r.http})` : "não respondeu" };
  if (r.status !== "completed") return { marca: "…", texto: r.status === "in_progress" ? "em andamento" : "na fila" };
  switch (r.conclusao) {
    case "success":
      return { marca: "✓", texto: "sucesso" };
    case "failure":
      return { marca: "✕", texto: "falhou" };
    case "timed_out":
      return { marca: "✕", texto: "estourou o tempo-limite" };
    case "cancelled":
      return { marca: "–", texto: "cancelada" };
    case "skipped":
      return { marca: "–", texto: "pulada" };
    default:
      return { marca: "–", texto: r.conclusao ?? "concluída" };
  }
}

/** De onde veio a execução: o `schedule` (a reserva) ou o disparo (a Vercel às 11h30 UTC, ou alguém à mão). */
export function rotuloEvento(evento: string | null): string {
  if (evento === "schedule") return "agendamento do GitHub";
  if (evento === "workflow_dispatch") return "disparo (Vercel ou manual)";
  return evento ?? "—";
}

/** Uma execução do GitHub que pede atenção: falhou, estourou o tempo ou não respondeu. */
export function githubPedeAtencao(r: Pick<RodadaGithub, "estado" | "status" | "conclusao">): boolean {
  if (r.estado === "falha") return true;
  return r.estado === "ok" && r.status === "completed" && (r.conclusao === "failure" || r.conclusao === "timed_out");
}
