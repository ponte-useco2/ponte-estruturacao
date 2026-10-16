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
 *
 * O frescor do dado (10/10/2026, onda 11, B): rodar em dia não é ter dado novo. Em 09/10/2026 o fiscal rodou todo dia,
 * no prazo, com o CAUC parado em 02/10, e a tela disse "em dia". Cada job diz agora onde a execução grava a data do
 * DADO (não a da rodada) e quanto ela pode ficar para trás da rodada que a leu; passou disso, com a rodada em dia, a
 * linha fica "dado velho".
 *
 * Os municípios (12/10/2026, onda 12, C): o job grava `contagens.periodo_por_fonte`, e a data do dado da linha é a do
 * Caged, a única fonte de cadência curta; as outras, anuais ou censitárias, vão como detalhe e nunca deixam o dado
 * velho. A execução sem o campo continua "o job não grava".
 */
import { REPOSITORIO } from "./agendamento.ts";
import { dataBrasilia, diaBrasilia } from "./datas.ts";
import { ehEsquemaAusente } from "./esquema.ts";
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";

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

// ================================================================ a data do dado e a defasagem esperada (10/10/2026, onda 11, B)

/**
 * A defasagem é medida na hora da rodada: o dia do dado contra o dia em que a rodada concluiu, os dois em Brasília. A
 * idade da rodada já é a regra de "atrasada"; assim as duas não se sobrepõem, e "dado velho" quer dizer uma coisa só:
 * o job rodou, mas a fonte não andou. Os limites abaixo saíram do código de cada job e do histórico das tabelas
 * `*_execucao`, lido pelo MCP em 09/10/2026.
 *
 * "dias": dias corridos. "dias_uteis": de segunda a sexta, sem o calendário de feriados (um dia útil de folga cobre um
 * feriado isolado). "meses": meses do calendário (o mês do dado contra o mês da rodada).
 */
export type UnidadeDefasagem = "dias" | "dias_uteis" | "meses";

/**
 * O arquivo do Transferegov (radar e painel): o `dado_ate` é o último carimbo do `siconv_historico_situacao`. O lote
 * noturno carimba entre 22h e 23h em Brasília, e a rodada da manhã lê o de ontem (D-1). Na segunda o dado é de sábado
 * (domingo em geral não tem lote), e o Transferegov às vezes pula a noite (23, 24 e 26/09 e 07 e 09/10/2026): D-2. Nas
 * 44 rodadas do radar desde 14/09/2026, nunca D-3. Fonte: `painel_execucao/trava_do_dia.py` e as execuções do radar e
 * do painel.
 */
export const DEFASAGEM_TRANSFEREGOV_DIAS = 2;

/**
 * O CAUC (fiscal): `contagens.cauc_data_pesquisa`, a data da pesquisa do relatório do Tesouro. Sai todo dia útil, por
 * volta das 11h10 UTC, e a rodada das 11h30 lê a do dia (0) ou, se a publicação atrasa, a da véspera (1); no fim de
 * semana fica a de sexta (27/09/2026, domingo: 25/09, 0). A única falha antes de outubro deu 2 (a rodada de 23/09 leu o
 * de 21/09). De 3 em diante é o mesmo limite de `DIAS_UTEIS_CAUC` (3) em `fiscal/regras.py` (onda 11, A), que deixa G7 e
 * G7A "desatualizado": a mesma regra na tela do fiscal e aqui (o teste confere). Fonte: execuções 1 a 27 do fiscal; em
 * 09/10/2026 o CAUC de 02/10 tinha 5 dias úteis.
 *
 * Os feriados (12/10/2026, onda 12, C, M1 da revisão D): desde a regra 2026-10-10.1 o fiscal grava
 * `contagens.cauc_dias_uteis`, contado com o calendário de `fiscal/calendario.py`, e é esse número que vale aqui
 * (`RegraDado.defasagemPronta`). Sem ele, o painel contaria o 12/10/2026 como útil, e em 14/10 o CAUC de 09/10 daria 3
 * ("dado velho") enquanto o fiscal dá 2, sem aviso. A conta daqui, de segunda a sexta, fica só para as execuções
 * antigas, sem o campo.
 */
export const DEFASAGEM_CAUC_DIAS_UTEIS = 2;

/**
 * Pix e fundo a fundo (semanal): `contagens.especiais_dado_ate` e `fundo_dado_ate`, o dia do último relatório ou
 * lançamento que a API do Transferegov trouxe (vale o mais velho dos dois). É D-1 útil: a API atualiza de madrugada e
 * quase ninguém registra no fim de semana (21/09/2026, segunda: dado de 18/09, sexta). Mais um dia útil para a rodada
 * que sai antes da atualização (as de 07/10/2026 à 01h51 e às 02h33 em Brasília leram o de 05/10) e para um feriado.
 * Fonte: `pix_fundo/especiais.py`, `pix_fundo/fundo.py` e as execuções 1 a 8 do Pix.
 */
export const DEFASAGEM_PIX_DIAS_UTEIS = 2;

/**
 * Pix, ciclo em curso (diário): `contagens.especiais_data_atualizacao`, a data que a própria API dos especiais informa
 * (`/especiais/data-atualizacao`, à 0h do dia). A rodada da manhã lê a do dia; em 21/09/2026 (segunda), às 12h38, a
 * API ainda dizia 20/09. Fonte: `pix_fundo/ciclo.py`, as execuções 1 a 4 do ciclo e 1 a 8 do Pix.
 */
export const DEFASAGEM_API_ESPECIAIS_DIAS = 1;

/**
 * O TCE-PB refaz o arquivo de despesas do ano corrente toda madrugada, mas o job só o baixa de novo a cada 7 dias
 * (`DIAS_ANO_CORRENTE` em `tce_federal/cache.py`; o teste confere o número no arquivo).
 */
export const DIAS_ANO_CORRENTE_TCE_PB = 7;

/**
 * Dinheiro federal no TCE-PB: o `dado_ate` é o maior Last-Modified dos arquivos de despesas lidos. Até 7 dias é a regra
 * do próprio job, mais 1 para os downloads que o prazo da rodada adia para o dia seguinte. Em 05/10/2026 o dado era de
 * 29/09 (6 dias); em 06/10 voltou a ser do dia. Fonte: `tce_federal/executar.py` e as execuções 1 a 14.
 */
export const DEFASAGEM_TCE_PB_DIAS = DIAS_ANO_CORRENTE_TCE_PB + 1;

/**
 * As consultas ao vivo (sanções no Portal da Transparência, tomadas de contas no e-TCE): a API responde o cadastro do
 * momento, e o `dado_ate` é o instante da consulta. O dia do dado é o da rodada; 1 dia cobre a consulta que atravessa a
 * meia-noite. Fonte: `sancoes/executar.py` e `tce_tcu/executar.py` (`dado_ate=agora`).
 */
export const DEFASAGEM_CONSULTA_DIAS = 1;

/**
 * Emendas parlamentares (semanal, onda 14): o `dado_ate` é o Last-Modified do zip de emendas do Portal da Transparência.
 * O arquivo sai de madrugada e não sai todo dia: o de sábado, 10/10/2026 (02h57 UTC), seguia sendo o último na segunda,
 * 12/10, feriado. O de sábado 02h57 UTC é sexta 23h57 em Brasília: a rodada de terça já o lê com 4 dias; 5 cobrem o
 * fim de semana com um feriado na segunda (integração da onda 14). Semana em que o zip não muda: a rodada relê a
 * anterior e o `dado_ate` fica o mesmo — aí o dado velho é o Portal parado de verdade. Fonte: `emendas/portal.py` e o
 * HEAD do zip em 12/10/2026.
 */
export const DEFASAGEM_PORTAL_EMENDAS_DIAS = 5;

/**
 * A folga das emendas: o atraso do GitHub (5 h), o tempo-limite do `emendas.yml` (3 h, para caber a carga do FNS) e 1 h
 * de margem. A `FOLGA_PADRAO_H` conta 2 h de workflow e deixaria a rodada que dura o limite "atrasada".
 */
export const FOLGA_EMENDAS_H = ATRASO_GITHUB_H + 3 + 1;

/**
 * A folga das emendas estaduais (E1, 16/10/2026): o `emendas-pb.yml` roda no runner da máquina do titular, porque a API
 * da PB não responde ao GitHub. Com a máquina desligada na terça, o job espera na fila do GitHub até 24 h; somam-se o
 * atraso do agendamento (5 h) e 1 h de margem, onde cabe o tempo-limite de 30 min. Passou disso, a rodada da semana
 * não aconteceu.
 */
export const FOLGA_EMENDAS_PB_H = ATRASO_GITHUB_H + 24 + 1;

/**
 * As OSC (Mapa das OSC, Ipea): `contagens.versao_fonte`, a data no nome do arquivo (AAAAMMDD), que dá o mês do arquivo.
 * O Ipea publica o arquivo do mês por volta do dia 18 (agosto/2026: Last-Modified 18/08), e o job roda nos dias 20 e
 * 28: a carga do mês traz o arquivo do mês, ou o do mês anterior quando o do mês atrasa. Dois meses para trás é um mês
 * que o Ipea não publicou. Fonte: `osc_mapa/executar.py` e o estudo de 07/10/2026 (em 07/10, o de setembro ainda não
 * tinha saído).
 *
 * Supervisor, integração da onda 11 (10/10/2026): 2 meses, e não 1. O de setembro não saiu até 09/10, e com 1 o resumo
 * diário abriria todo dia com o Ipea como "dado velho" — atraso de fora, sem nada a fazer, num cadastro que muda
 * devagar. O job parado continua aparecendo pela cadência; o dado velho fica para o Ipea parado de verdade.
 */
export const DEFASAGEM_OSC_MESES = 2;

/**
 * Os indicadores dos municípios (12/10/2026, onda 12, C): `contagens.periodo_por_fonte`, o período de referência mais
 * recente de cada fonte, que o job grava desde a onda 12. Das 20 fontes, só o Novo Caged tem cadência conhecida e
 * curta: o MTE publica o mês M entre os dias 27 e 30 do mês seguinte (no FTP do PDET, lido em 12/10/2026: 05/2026 em
 * 30/06, 06/2026 em 29/07, 07/2026 em 28/08 e 08/2026 em 29/09), e o job roda no dia 5. A rodada do dia 5 lê o mês M-2
 * (em 09/10/2026, o de agosto). Mais um mês para a publicação que escorrega para depois do dia 5 (basta uma semana de
 * atraso do MTE) e para a fonte que falhou numa rodada e foi repetida da anterior (essa já é aviso). De 4 meses em
 * diante, o MTE deixou de publicar ou o job não lê o Caged novo há duas rodadas.
 *
 * Por que só o Caged: as outras fontes são anuais ou censitárias, com defasagem natural de anos (o IDHM é do Censo de
 * 2010, o ISH da ANA de 2021, o PIB de 2023, o SINISA de 2024) e sem data de publicação fixa; uma régua para elas
 * acenderia todo dia no e-mail, sem nada a fazer, como aconteceria com as OSC (integração da onda 11). As mensais de
 * calendário incerto (Anatel em 11/2025 na rodada de 09/10/2026, Senatran, CNES, APS, MI Social) também ficam fora:
 * aparecem como detalhe, nunca como "dado velho". Fonte: `municipios/economia.py` (doze meses até o último publicado)
 * e `mun_indicador` da execução 5, agregado por fonte pelo MCP em 12/10/2026.
 */
export const DEFASAGEM_CAGED_MESES = 3;

/** O nome da fonte do Caged em `periodo_por_fonte` (a `Leitura` de `municipios/economia.py`). */
export const FONTE_CAGED = "caged";

/** Onde a execução de um job grava a data do dado, e quanto ela pode ficar para trás da rodada. */
export interface RegraDado {
  /** O lugar na execução, por extenso: "coluna dado_ate (…)", "contagens.cauc_data_pesquisa". */
  onde: string;
  /** O que é o dado, curto, para a tela e o e-mail: "CAUC", "arquivo do Transferegov". */
  rotulo: string;
  /**
   * "coluna": a coluna `dado_ate`, lida numa consulta à parte que falha sozinha (`rodadas.server.ts`); "contagens": o
   * jsonb que a tela já lê.
   */
  origem: "coluna" | "contagens";
  /** A data do dado na execução, como veio (data, instante ou "AAAAMMDD"), ou null quando ela não a trouxe. */
  ler: (e: { contagens: Contagens; dadoAte: string | null }) => string | null;
  /** Quanto o dado pode ficar para trás da rodada; null: coleta assistida, sem defasagem esperada (nunca "velho"). */
  limite: number | null;
  unidade: UnidadeDefasagem;
  /**
   * "mes" (onda 12, C): o dado é de um mês, não de um dia (o Caged). `ler` devolve o dia 1 do mês, e a tela e o e-mail
   * escrevem "08/2026". Ausente: "dia".
   */
  precisao?: "dia" | "mes";
  /**
   * Se a execução já grava a data (onda 12, C). Falso: a execução é de antes de o job gravá-la (os municípios antes da
   * onda 12), e a coluna fica como era, "o job não grava", sem "não lido". Ausente: sempre grava.
   */
  grava?: (contagens: Contagens) => boolean;
  /** O resto da data do dado, numa frase curta para a coluna (onda 12, C: as outras fontes dos municípios). */
  detalhe?: (contagens: Contagens) => string | null;
  /**
   * A defasagem já contada pelo próprio job, na unidade da regra (onda 12, C, M1 da revisão D): o fiscal grava
   * `cauc_dias_uteis` com os feriados. Inteiro de 0 em diante: vale ele. null (ausente, ou não é inteiro): a conta
   * daqui, por `defasagemEntre`.
   */
  defasagemPronta?: (contagens: Contagens) => number | null;
}

const DIA_PURO = /^\d{4}-\d{2}-\d{2}$/;
/** Instante sem fuso ("2026-10-09T00:00:00", da API dos especiais): já está em Brasília, e o dia é o do texto. */
const INSTANTE_SEM_FUSO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

function diaExiste(dia: string): boolean {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10) === dia;
}

/**
 * O dia do dado em Brasília ("AAAA-MM-DD"), ou null. Aceita a data pura, "AAAAMMDD" (a versão do Ipea), o instante com
 * fuso (convertido por `diaBrasilia`) e o instante sem fuso, que fica no dia escrito: o `Date.parse` o leria no fuso
 * da máquina (UTC na Vercel), e "09/10 0h" viraria 08/10.
 */
export function diaDoDado(valor: string | null | undefined): string | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const v = valor.trim();
  let dia: string;
  if (/^\d{8}$/.test(v)) dia = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  else if (DIA_PURO.test(v) || INSTANTE_SEM_FUSO.test(v)) dia = v.slice(0, 10);
  else if (Number.isNaN(Date.parse(v))) return null;
  else dia = diaBrasilia(v);
  return DIA_PURO.test(dia) && diaExiste(dia) ? dia : null;
}

const DIA_MS = 24 * 3600 * 1000;
const numeroDoDia = (dia: string) => Math.round(Date.parse(`${dia}T00:00:00Z`) / DIA_MS);

/**
 * Quanto o dia do dado ficou para trás do dia da rodada, na unidade dada (os dois "AAAA-MM-DD", em Brasília). O dado
 * mais novo que a rodada conta 0 aqui, mas `avaliarDado` o trata antes como "não lido" (onda 12, C, M3 da revisão D).
 * Dias úteis: os de segunda a sexta depois do dia do dado, até o dia da rodada (o domingo que lê o CAUC de sexta conta
 * 0; a sexta que lê o da sexta anterior conta 5).
 */
export function defasagemEntre(diaDado: string, diaRodada: string, unidade: UnidadeDefasagem): number {
  if (unidade === "meses") {
    const [ad, md] = diaDado.split("-").map(Number);
    const [ar, mr] = diaRodada.split("-").map(Number);
    return Math.max(0, ar * 12 + mr - (ad * 12 + md));
  }
  const de = numeroDoDia(diaDado);
  const ate = numeroDoDia(diaRodada);
  if (ate <= de) return 0;
  if (unidade === "dias") return ate - de;
  let uteis = 0;
  // O dia 0 (01/01/1970) foi uma quinta: (n + 4) % 7 dá 0 no domingo e 6 no sábado.
  for (let k = de + 1; k <= ate; k++) {
    const semana = (k + 4) % 7;
    if (semana !== 0 && semana !== 6) uteis += 1;
  }
  return uteis;
}

const NOME_UNIDADE: Record<UnidadeDefasagem, readonly [string, string]> = {
  dias: ["dia", "dias"],
  dias_uteis: ["dia útil", "dias úteis"],
  meses: ["mês", "meses"],
};

/** "1 dia útil", "5 dias úteis", "2 meses". */
export function textoUnidade(x: number, unidade: UnidadeDefasagem): string {
  const [um, varios] = NOME_UNIDADE[unidade];
  return `${x.toLocaleString("pt-BR")} ${x === 1 ? um : varios}`;
}

/** O dia do dado por extenso: "02/10/2026"; com a precisão de mês (onda 12, C), "08/2026". Vazio: "—". */
export function textoDiaDoDado(dia: string | null | undefined, precisao: "dia" | "mes" = "dia"): string {
  return precisao === "mes" && dia && DIA_PURO.test(dia) ? `${dia.slice(5, 7)}/${dia.slice(0, 4)}` : dataBrasilia(dia);
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

/** O inteiro de 0 em diante de uma chave do `contagens`, ou null (onda 12, C: a idade do CAUC contada pelo fiscal). */
function inteiroNaoNegativo(c: Contagens, chave: string): number | null {
  const v = numero(c, chave);
  return v !== null && Number.isInteger(v) && v >= 0 ? v : null;
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

/** A soma de uma chave em cada ano de `epb_anos` (emendas estaduais), ou null quando nenhum ano a traz. */
function somaPorAno(c: Contagens, chave: string): number | null {
  const valores = Object.values(objeto(c, "epb_anos"))
    .map((ano) => (ano && typeof ano === "object" && !Array.isArray(ano) ? numero(ano as Contagens, chave) : null))
    .filter((x): x is number => x !== null);
  return valores.length ? valores.reduce((s, x) => s + x, 0) : null;
}

/** O texto de uma chave do `contagens`, ou null (a data do dado, quando o job a grava lá). */
const textoDe = (c: Contagens, chave: string) => {
  const v = c[chave];
  return typeof v === "string" && v ? v : null;
};

/** A data do dado na coluna `dado_ate` da execução. */
const colunaDadoAte = ({ dadoAte }: { dadoAte: string | null }) => dadoAte;

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
  /**
   * Onde a execução grava a data do dado e a defasagem esperada (10/10/2026, onda 11, B). null: o job não grava uma data
   * do dado que valha para a rodada inteira. Até a onda 12 era o caso dos indicadores dos municípios; desde 12/10/2026
   * (onda 12, C), todos os jobs têm regra, e o null fica para um job novo que não grave.
   */
  dado: RegraDado | null;
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

// A data do dado de cada job (10/10/2026, onda 11, B). Os limites e o porquê estão nas constantes `DEFASAGEM_*`.

/** O radar e o painel leem o mesmo arquivo: o `siconv_historico_situacao` do Transferegov. */
const DADO_TRANSFEREGOV: RegraDado = {
  onde: "coluna dado_ate: o último carimbo do siconv_historico_situacao",
  rotulo: "arquivo do Transferegov",
  origem: "coluna",
  ler: colunaDadoAte,
  limite: DEFASAGEM_TRANSFEREGOV_DIAS,
  unidade: "dias",
};

const dadoDaConsulta = (rotulo: string): RegraDado => ({
  onde: "coluna dado_ate: o instante da consulta à API",
  rotulo,
  origem: "coluna",
  ler: colunaDadoAte,
  limite: DEFASAGEM_CONSULTA_DIAS,
  unidade: "dias",
});

/** Nas coletas assistidas a data aparece, mas não há defasagem esperada, como não há cadência: nunca "dado velho". */
const DADO_ACESSO_LIVRE: RegraDado = {
  onde: "coluna dado_ate: a leitura mais nova da coleta no navegador",
  rotulo: "coleta no Acesso Livre",
  origem: "coluna",
  ler: colunaDadoAte,
  limite: null,
  unidade: "dias",
};

const DADO_EXIGENCIAS: RegraDado = {
  onde: "coluna dado_ate: o evento mais novo do retrato coletado",
  rotulo: "evento mais novo do retrato",
  origem: "coluna",
  ler: colunaDadoAte,
  limite: null,
  unidade: "dias",
};

// ---------------------------------------------------------------- os municípios (12/10/2026, onda 12, C)

/** O período de uma fonte dos municípios, como o job grava em `contagens.periodo_por_fonte`. */
export interface PeriodoFonte {
  /** O nome da `Leitura` no job ("caged", "ipeadata", "inep_ideb"…). */
  fonte: string;
  /** "AAAA" ou "AAAA-MM"; null quando a fonte não trouxe período (falhou sem herança, ou só linhas sem valor). */
  periodo: string | null;
  /** Repetida da execução anterior (falhou nesta, ou ficou fora de um disparo parcial). */
  herdada: boolean;
}

const NOME_DE_FONTE = /^[a-z][a-z0-9_]{0,39}$/;
const PERIODO_DE_FONTE = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

/**
 * O `periodo_por_fonte` da execução, por fonte, ou null quando a execução é de antes do campo (todas até a onda 12).
 * Só esse campo das `contagens`, e só o que tem a forma esperada: nome de fonte em minúsculas e período "AAAA" ou
 * "AAAA-MM". Qualquer outro texto é descartado, e nada de texto livre chega à tela ou ao e-mail.
 */
export function periodosPorFonte(c: Contagens): PeriodoFonte[] | null {
  const bruto = c.periodo_por_fonte;
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  return Object.entries(bruto as Record<string, unknown>)
    .filter(([fonte]) => NOME_DE_FONTE.test(fonte))
    .map(([fonte, v]) => {
      const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
      const periodo = typeof o.periodo === "string" && PERIODO_DE_FONTE.test(o.periodo) ? o.periodo : null;
      return { fonte, periodo, herdada: o.herdada === true };
    })
    .sort((a, b) => a.fonte.localeCompare(b.fonte));
}

/** "2010", "09/2026". */
export function textoPeriodo(periodo: string): string {
  return periodo.length === 7 ? `${periodo.slice(5, 7)}/${periodo.slice(0, 4)}` : periodo;
}

/** Para ordenar: no mesmo ano, o ano sozinho vem antes dos meses. */
const chavePeriodo = (p: string) => Number(p.slice(0, 4)) * 100 + (p.length === 7 ? Number(p.slice(5, 7)) : 0);

/**
 * As fontes dos municípios além do Caged, numa frase para a coluna "Dado até": "demais 19 fontes de 2010 (ipeadata) a
 * 09/2026 (mds_misocial)", mais as repetidas da rodada anterior e as sem período. Não mudam o estado (ver
 * `DEFASAGEM_CAGED_MESES`). null: a execução é de antes do campo.
 */
export function detalheMunicipios(c: Contagens): string | null {
  const todas = periodosPorFonte(c);
  if (!todas) return null;
  const caged = todas.find((p) => p.fonte === FONTE_CAGED);
  const demais = todas.filter((p) => p.fonte !== FONTE_CAGED);
  const comPeriodo = demais
    .filter((p): p is PeriodoFonte & { periodo: string } => p.periodo !== null)
    .sort((a, b) => chavePeriodo(a.periodo) - chavePeriodo(b.periodo) || a.fonte.localeCompare(b.fonte));
  const partes: string[] = [];
  if (caged?.herdada) partes.push("Caged repetido da rodada anterior");
  if (comPeriodo.length === 1 && demais.length === 1) {
    partes.push(`a outra fonte é de ${textoPeriodo(comPeriodo[0].periodo)} (${comPeriodo[0].fonte})`);
  } else if (comPeriodo.length) {
    const velha = comPeriodo[0];
    const nova = comPeriodo[comPeriodo.length - 1];
    partes.push(
      velha.periodo === nova.periodo
        ? `demais ${n(demais.length)} fontes de ${textoPeriodo(velha.periodo)}`
        : `demais ${n(demais.length)} fontes de ${textoPeriodo(velha.periodo)} (${velha.fonte}) a ${textoPeriodo(nova.periodo)} (${nova.fonte})`,
    );
  }
  const herdadas = demais.filter((p) => p.herdada).length;
  if (herdadas) partes.push(`${herdadas === 1 ? "uma repetida" : `${n(herdadas)} repetidas`} da rodada anterior`);
  const sem = demais.filter((p) => p.periodo === null).map((p) => p.fonte);
  if (sem.length) partes.push(`sem período: ${sem.join(", ")}`);
  return partes.length ? partes.join("; ") : null;
}

/**
 * A data do dado dos municípios é a do Caged, a única fonte de cadência conhecida e curta; as outras vão como
 * detalhe. A execução sem `periodo_por_fonte` (todas até a onda 12) fica como antes: "o job não grava".
 */
const DADO_MUNICIPIOS: RegraDado = {
  onde: "contagens.periodo_por_fonte.caged: o último mês dos doze do Novo Caged (as outras fontes, como detalhe)",
  rotulo: "Caged",
  origem: "contagens",
  ler: ({ contagens }) => {
    const p = periodosPorFonte(contagens)?.find((x) => x.fonte === FONTE_CAGED)?.periodo ?? null;
    return p && p.length === 7 ? `${p}-01` : null;
  },
  limite: DEFASAGEM_CAGED_MESES,
  unidade: "meses",
  precisao: "mes",
  grava: (c) => periodosPorFonte(c) !== null,
  detalhe: detalheMunicipios,
};

/**
 * Os jobs com tabela de execução no banco, na ordem da tela: diários, semanais, mensais, assistidos. Conferidos em
 * 09/10/2026 contra os workflows e contra o catálogo do banco (12 tabelas `*_execucao`, 14 linhas com os recortes).
 *
 * As emendas parlamentares (`emd`) entraram na onda 14 (onda 14, integração, 12/10/2026), com a tabela `emd_execucao`
 * criada pela `oport_39`: 13 tabelas e 15 linhas. Em 12/10/2026 a oport_39 ainda não estava aplicada (conferido pelo
 * MCP). Até ser aplicada, a linha diz "não lido" (a tabela não existe; `leituraDasConsultas`); aplicada, fica
 * "atrasada" até a primeira rodada concluída, como toda agendada que nunca concluiu (`avaliarRodada`).
 *
 * As emendas estaduais (`epb`, E1, 16/10/2026) vêm com a `epb_execucao` da `oport_41`: 14 tabelas e 16 linhas, com o
 * mesmo caminho até a primeira rodada ("não lido" sem a tabela; "atrasada" com ela e sem rodada concluída).
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
    dado: DADO_TRANSFEREGOV,
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
    // O `dado_ate` do ciclo é o instante da rodada; a data do dado é a que a API dos especiais informa.
    dado: {
      onde: "contagens.especiais_data_atualizacao: a data de atualização que a API dos especiais informa",
      rotulo: "atualização da API dos especiais",
      origem: "contagens",
      ler: ({ contagens }) => textoDe(contagens, "especiais_data_atualizacao"),
      limite: DEFASAGEM_API_ESPECIAIS_DIAS,
      unidade: "dias",
    },
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
    dado: DADO_TRANSFEREGOV,
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
    dado: {
      onde: "coluna dado_ate: o maior Last-Modified dos arquivos de despesas lidos",
      rotulo: "arquivos do TCE-PB",
      origem: "coluna",
      ler: colunaDadoAte,
      limite: DEFASAGEM_TCE_PB_DIAS,
      unidade: "dias",
    },
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
    // O `dado_ate` do fiscal é o instante da rodada; o que envelhece sem aviso é o CAUC (09/10/2026: parado em 02/10).
    dado: {
      onde: "contagens.cauc_data_pesquisa: a data da pesquisa do relatório do CAUC",
      rotulo: "CAUC",
      origem: "contagens",
      ler: ({ contagens }) => textoDe(contagens, "cauc_data_pesquisa"),
      limite: DEFASAGEM_CAUC_DIAS_UTEIS,
      unidade: "dias_uteis",
      // A idade que o fiscal contou com os feriados (onda 12, C, M1 da revisão D). Só o número: o `cauc_aviso`, texto,
      // não é lido.
      defasagemPronta: (c) => inteiroNaoNegativo(c, "cauc_dias_uteis"),
    },
    linhas: (c) => numero(c, "municipios"),
    rotuloLinhas: "municípios",
    // `fontes_com_erro`: {fonte: chamadas que falharam} (09/10: vazio; 03/10: siconfi_rreo1 e siconfi_rreo9).
    falhas: (c) => soma(objeto(c, "fontes_com_erro")),
    avisos: (c) => {
      const fontes = Object.keys(objeto(c, "fontes_com_erro"));
      return [
        ...(fontes.length ? [`fonte${fontes.length === 1 ? "" : "s"} com erro: ${fontes.join(", ")}`] : []),
        // `siope_incompletos` (onda 12, C, pedido do supervisor; o campo é do agente E): os municípios cuja leitura do
        // SIOPE voltou pela metade, com HTTP 200 e sem erro (A3 da revisão D). Ausente ou 0: nada.
        ...seMaior(numero(c, "siope_incompletos"), (x) => `SIOPE incompleto em ${plural(x, "município", "municípios")}`),
      ];
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
    // A coluna `dado_ate` é a mais nova das duas datas; aqui vale a mais velha, para um módulo parado não se esconder.
    dado: {
      onde: "contagens.especiais_dado_ate e fundo_dado_ate: o último relatório ou lançamento na API (o mais velho)",
      rotulo: "API do Transferegov (especiais e fundo a fundo)",
      origem: "contagens",
      ler: ({ contagens }) => {
        const dias = [textoDe(contagens, "especiais_dado_ate"), textoDe(contagens, "fundo_dado_ate")]
          .map(diaDoDado)
          .filter((d): d is string => d !== null)
          .sort();
        return dias[0] ?? null;
      },
      limite: DEFASAGEM_PIX_DIAS_UTEIS,
      unidade: "dias_uteis",
    },
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
    dado: dadoDaConsulta("consulta ao e-TCE"),
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
    dado: dadoDaConsulta("consulta ao CEIS e ao CNEP"),
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
    // Onda 14 (12/10/2026): catálogo do Portal + saúde fundo a fundo do FNS + convênio e Pix do banco.
    id: "emd",
    nome: "Emendas parlamentares",
    tabela: "emd_execucao",
    recorte: null,
    cadencia: "semanal",
    workflow: "emendas.yml",
    cron: "15 9 * * 2",
    folgaH: FOLGA_EMENDAS_H,
    dado: {
      onde: "coluna dado_ate: o Last-Modified do zip de emendas do Portal da Transparência",
      rotulo: "arquivo de emendas do Portal",
      origem: "coluna",
      ler: colunaDadoAte,
      limite: DEFASAGEM_PORTAL_EMENDAS_DIAS,
      unidade: "dias",
    },
    linhas: (c) => numero(c, "emd_catalogo_codigos"),
    rotuloLinhas: "emendas da PB no catálogo",
    // `emd_fns_erro`: o motivo de o FNS não ter vindo inteiro (texto, não lido aqui; só se existe).
    falhas: (c) => (textoDe(c, "emd_fns_erro") ? 1 : 0),
    avisos: (c) => {
      const origem = textoDe(c, "emd_fns_origem");
      return [
        ...(origem === "parcial" ? ["o FNS desta rodada veio pela metade"] : []),
        ...(origem === "anterior" ? ["o FNS desta rodada é o da rodada anterior"] : []),
        ...seMaior(numero(c, "emd_fns_detalhes_pendentes"), (x) => `${plural(x, "proposta do FNS ficou", "propostas do FNS ficaram")} sem o detalhe, para a próxima rodada`),
      ];
    },
  },
  {
    // Emendas estaduais, E1 (16/10/2026): a API de dados abertos da PB, lida do runner da máquina do titular.
    id: "epb",
    nome: "Emendas estaduais (PB)",
    tabela: "epb_execucao",
    recorte: null,
    cadencia: "semanal",
    workflow: "emendas-pb.yml",
    cron: "0 13 * * 2",
    folgaH: FOLGA_EMENDAS_PB_H,
    // A API não informa a data do dado: o `dado_ate` é o instante da leitura (`emendas_pb/executar.py`).
    dado: dadoDaConsulta("leitura da API da PB"),
    linhas: (c) => somaPorAno(c, "emendas"),
    rotuloLinhas: "emendas no catálogo, de 2021 em diante",
    // A rodada com falha não publica (bloqueio, API fora, ano fechado vazio ou divergente): não há falha parcial.
    falhas: semFalhas,
    avisos: (c) => [
      ...seMaior(Object.keys(objeto(c, "epb_autor_sem_pessoa")).length, (x) => `${plural(x, "grafia de autor", "grafias de autor")} fora da semente`),
      ...seMaior(somaPorAno(c, "empenho_sem_catalogo"), (x) => `${plural(x, "emenda empenhada", "emendas empenhadas")} sem linha no catálogo`),
      ...seMaior(somaPorAno(c, "municipio_sem_ibge"), (x) => `${plural(x, "destino", "destinos")} sem o IBGE do município`),
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
    // O `dado_ate` é o instante da rodada, e cada fonte tem o seu período (`mun_indicador.ano`: MapBiomas anual, Caged
    // mensal…). Desde 12/10/2026 (onda 12, C), o job grava `periodo_por_fonte`: a data do dado é a do Caged, e as outras
    // fontes vão como detalhe (ver `DEFASAGEM_CAGED_MESES`). A fonte que falha continua sendo aviso.
    dado: DADO_MUNICIPIOS,
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
    dado: {
      onde: "contagens.versao_fonte: a data no nome do arquivo do Ipea (AAAAMMDD), que dá o mês do arquivo",
      rotulo: "arquivo do Ipea",
      origem: "contagens",
      ler: ({ contagens }) => textoDe(contagens, "versao_fonte"),
      limite: DEFASAGEM_OSC_MESES,
      unidade: "meses",
    },
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
    dado: DADO_ACESSO_LIVRE,
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
    dado: DADO_ACESSO_LIVRE,
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
    dado: DADO_EXIGENCIAS,
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
    dado: DADO_EXIGENCIAS,
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

/** "dado_velho" (10/10/2026, onda 11, B): a rodada está em dia, mas a data do dado passou da defasagem esperada. */
export type EstadoRodada = "em_dia" | "atrasada" | "dado_velho" | "com_aviso" | "nao_lido";

export const ROTULO_ESTADO: Record<EstadoRodada, string> = {
  em_dia: "em dia",
  atrasada: "atrasada",
  dado_velho: "dado velho",
  com_aviso: "com aviso",
  nao_lido: "não lido",
};

/**
 * Marca de forma, além da cor: o estado não pode depender só de cor (WCAG 1.4.1), como em `fiscal.ts`. O "dado velho"
 * usa a marca e o tom do "Desatualizado" do fiscal (↻), o mesmo vocabulário para a mesma ideia.
 */
export const MARCA_ESTADO: Record<EstadoRodada, string> = { em_dia: "✓", atrasada: "▲", dado_velho: "↻", com_aviso: "!", nao_lido: "?" };

export const TOM_ESTADO: Record<EstadoRodada, "aderente" | "urgente" | "nova" | "proto" | "neutro"> = {
  em_dia: "aderente",
  atrasada: "urgente",
  dado_velho: "nova",
  com_aviso: "proto",
  nao_lido: "neutro",
};

/** A ordem dos cartões do topo: o que pede ação primeiro. */
export const ESTADOS: readonly EstadoRodada[] = ["atrasada", "dado_velho", "com_aviso", "nao_lido", "em_dia"];

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

/**
 * A coluna `dado_ate` da última concluída (10/10/2026, onda 11, B), lida numa consulta à parte: se ela falhar, só a
 * coluna "dado até" diz "não lido", e a linha segue. O `id` confere que é a mesma execução da outra consulta.
 */
export type LeituraDadoAte = { estado: "ok"; id: number | null; dadoAte: string | null } | { estado: "falha" };

export type LeituraRodada =
  | {
      estado: "ok";
      ultima: ExecucaoConcluida | null;
      abertas: readonly ExecucaoAberta[];
      /** Só nos jobs cuja data do dado está na coluna (`RegraDado.origem` "coluna"). Ausente nesses: "não lido". */
      dadoAte?: LeituraDadoAte;
    }
  | { estado: "nao_lido"; motivo: MotivoNaoLido };

/** O que uma consulta do PostgREST devolve, só o que a leitura usa (onda 14, integração, 12/10/2026). */
export interface RespostaConsulta {
  data: readonly unknown[] | null;
  error: { code?: string | null; message: string } | null;
}

/**
 * A leitura de uma linha a partir das duas consultas de `rodadas.server.ts` (a última concluída e as abertas), à parte
 * para o teste (onda 14, integração, 12/10/2026). A tabela que não existe — 42P01 do Postgres ou PGRST205 do PostgREST,
 * como a `emd_execucao` antes da oport_39 — é "não lido" com motivo "ausente"; qualquer outro erro, "falha". Nos dois,
 * só aquela linha: a tela e o e-mail seguem com as outras.
 */
export function leituraDasConsultas(concluida: RespostaConsulta, abertas: RespostaConsulta, dadoAte?: LeituraDadoAte): LeituraRodada {
  const erro = concluida.error ?? abertas.error;
  if (erro) return { estado: "nao_lido", motivo: ehEsquemaAusente(erro.code) ? "ausente" : "falha" };
  return {
    estado: "ok",
    ultima: ((concluida.data ?? []) as ExecucaoConcluida[])[0] ?? null,
    abertas: (abertas.data ?? []) as ExecucaoAberta[],
    dadoAte,
  };
}

/**
 * A data do dado de uma linha (10/10/2026, onda 11, B).
 * - "no_prazo" e "velho": a data foi lida, e a defasagem ficou dentro ou passou do limite da regra;
 * - "sem_prazo": a data foi lida, mas a coleta assistida não tem defasagem esperada;
 * - "nao_grava": o job não grava uma data do dado da rodada inteira (`JobRodada.dado` null), ou a execução é de antes
 *   de gravá-la (`RegraDado.grava` falso: os municípios antes de 12/10/2026, onda 12, C);
 * - "nao_lido": a consulta da coluna falhou, ou a rodada não trouxe a data, ou trouxe uma depois do dia da rodada
 *   (onda 12, C, M3 da revisão D) (`motivo`);
 * - "sem_execucao": nenhuma execução concluída, ou a linha inteira não foi lida.
 */
export type SituacaoDado = "no_prazo" | "velho" | "sem_prazo" | "nao_grava" | "nao_lido" | "sem_execucao";

export interface FrescorDado {
  situacao: SituacaoDado;
  /** O dia do dado em Brasília ("AAAA-MM-DD"). */
  dia: string | null;
  /** Quanto o dado ficou para trás da rodada, na unidade da regra. */
  defasagem: number | null;
  /** O que a tela e o e-mail precisam da regra do job; null quando o job não grava a data. */
  regra: Pick<RegraDado, "rotulo" | "limite" | "unidade" | "precisao"> | null;
  /**
   * Em "nao_lido": "falha" (a consulta não respondeu) ou "sem_data" (a rodada não gravou a data, não é data, ou é depois
   * do dia da rodada).
   */
  motivo: "falha" | "sem_data" | null;
  /** O resto da data do dado, quando a regra tem (`RegraDado.detalhe`; onda 12, C: as outras fontes dos municípios). */
  detalhe?: string | null;
}

/**
 * A data do dado da última concluída e a defasagem contra o dia da rodada (os dois em Brasília). Função pura: a
 * leitura da coluna, quando a regra pede, vem pronta em `dadoAte`.
 */
export function avaliarDado(
  job: Pick<JobRodada, "dado">,
  ultima: Pick<ExecucaoConcluida, "id" | "contagens"> | null,
  concluidaEm: string | null,
  dadoAte?: LeituraDadoAte,
): FrescorDado {
  const regra = job.dado;
  const vazio: FrescorDado = { situacao: "sem_execucao", dia: null, defasagem: null, regra: null, motivo: null };
  if (!regra) return { ...vazio, situacao: "nao_grava" };
  const base = { ...vazio, regra: { rotulo: regra.rotulo, limite: regra.limite, unidade: regra.unidade, precisao: regra.precisao ?? "dia" } };
  if (!ultima || !concluidaEm) return base;
  // A execução de antes de o job gravar a data (onda 12, C): como antes, "não grava", sem "não lido".
  if (regra.grava && !regra.grava(ultima.contagens ?? {})) return { ...base, situacao: "nao_grava" };
  const detalhe = regra.detalhe?.(ultima.contagens ?? {}) ?? null;

  let coluna: string | null = null;
  if (regra.origem === "coluna") {
    // Sem a leitura, com a leitura que falhou, ou com outra execução (uma rodada concluiu entre as duas consultas).
    if (!dadoAte || dadoAte.estado === "falha" || dadoAte.id !== ultima.id) return { ...base, situacao: "nao_lido", motivo: "falha" };
    coluna = dadoAte.dadoAte;
  }
  const dia = diaDoDado(regra.ler({ contagens: ultima.contagens ?? {}, dadoAte: coluna }));
  const diaRodada = diaDoDado(concluidaEm);
  // O dado depois do dia da rodada (onda 12, C, M3 da revisão D) é data errada (a posição do CAUC com o ano trocado),
  // não dado fresco: "não lido", como a data que não veio, e nunca "no prazo".
  if (!dia || !diaRodada || dia > diaRodada) return { ...base, situacao: "nao_lido", motivo: "sem_data", detalhe };

  // A idade que o job já contou, com os feriados (onda 12, C, M1 da revisão D); sem ela, a conta daqui.
  const defasagem = regra.defasagemPronta?.(ultima.contagens ?? {}) ?? defasagemEntre(dia, diaRodada, regra.unidade);
  const situacao: SituacaoDado = regra.limite === null ? "sem_prazo" : defasagem > regra.limite ? "velho" : "no_prazo";
  return { ...base, situacao, dia, defasagem, detalhe };
}

/** "5 dias úteis antes da rodada", "do mesmo dia da rodada", "do mesmo mês da rodada". */
export function textoDefasagem(f: Pick<FrescorDado, "defasagem" | "regra">): string {
  if (f.defasagem === null || !f.regra) return "";
  if (f.defasagem === 0) return f.regra.unidade === "meses" ? "do mesmo mês da rodada" : "do mesmo dia da rodada";
  return `${textoUnidade(f.defasagem, f.regra.unidade)} antes da rodada`;
}

/** "esperado: até 1 dia útil"; vazio sem limite (coleta assistida). */
export function textoEsperado(regra: Pick<RegraDado, "limite" | "unidade"> | null): string {
  return regra && regra.limite !== null ? `esperado: até ${textoUnidade(regra.limite, regra.unidade)}` : "";
}

/**
 * A data do dado numa frase, para o e-mail e a tela: "CAUC de 02/10/2026, 5 dias úteis antes da rodada (esperado: até
 * 1 dia útil)"; com a precisão de mês (onda 12, C), "Caged de 07/2026, 4 meses antes da rodada (esperado: até 3
 * meses)". Vazio quando a data não foi lida.
 */
export function textoFrescor(f: FrescorDado): string {
  if (!f.dia || !f.regra) return "";
  const esperado = textoEsperado(f.regra);
  return `${f.regra.rotulo} de ${textoDiaDoDado(f.dia, f.regra.precisao)}, ${textoDefasagem(f)}${esperado ? ` (${esperado})` : ""}`;
}

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
  /** A data do dado da última concluída e a defasagem (10/10/2026, onda 11, B). */
  dado: FrescorDado;
}

const HORA_MS = 3600 * 1000;

function horasDesde(iso: string, agora: number): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : (agora - t) / HORA_MS;
}

/**
 * O estado de uma linha. A ordem decide quando mais de um vale: "não lido" (nada a dizer), "atrasada" (a rodada não
 * veio; os avisos continuam listados), "dado velho" (a rodada veio, a fonte não andou), "com aviso" (rodou no prazo,
 * mas parou, falhou ou deixou coisa para depois), "em dia".
 *
 * - Atrasada: a última concluída passou de `prazoH` (intervalo da cadência + folga), ou a agendada nunca concluiu.
 * - Dado velho (10/10/2026, onda 11, B): a data do dado da última concluída ficou mais para trás da rodada do que a
 *   defasagem esperada do job (`avaliarDado`). O fiscal de 09/10/2026, com o CAUC de 02/10 (5 dias úteis), é o caso.
 *   A data que não pôde ser lida não muda o estado: a coluna diz "não lido".
 * - Com aviso: uma execução "gravando" há mais de `LIMITE_GRAVANDO_H`; uma tentativa em erro mais nova que a última
 *   concluída; falha contada no `contagens`; um aviso do próprio job; a coleta assistida que nunca concluiu.
 * A tentativa em erro anterior à última concluída é história, não aviso (o Acesso Livre de obras, 02/10/2026: erro às
 * 03h06 UTC, concluída às 03h10 UTC).
 */
export function avaliarRodada(job: JobRodada, leitura: LeituraRodada, agora: number): LinhaRodada {
  const prazo = prazoH(job);
  const base = {
    job,
    prazoH: prazo,
    linhas: null,
    falhas: null,
    avisos: [],
    gravando: null,
    concluidaEm: null,
    idadeH: null,
    dado: avaliarDado(job, null, null),
  };
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
  const dado = avaliarDado(job, ultima, concluidaEm, leitura.dadoAte);
  const atrasada = prazo !== null && (idadeH === null || idadeH > prazo);
  const comAviso = avisos.length > 0 || (falhas ?? 0) > 0 || gravando?.parada === true;
  const estado: EstadoRodada = atrasada ? "atrasada" : dado.situacao === "velho" ? "dado_velho" : comAviso ? "com_aviso" : "em_dia";

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
    dado,
  };
}

/** Quantas linhas em cada estado, para os cartões do topo. */
export function contarEstados(linhas: readonly Pick<LinhaRodada, "estado">[]): Record<EstadoRodada, number> {
  const conta: Record<EstadoRodada, number> = { em_dia: 0, atrasada: 0, dado_velho: 0, com_aviso: 0, nao_lido: 0 };
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
 *
 * M6 da revisão de segurança da onda 11 (12/10/2026, onda 12, C): o token dispara workflows, e a tela só lê. Desde a
 * onda 12 o e-mail diário não chama o GitHub (`lerRodadas({ github: false })`), e o link da execução só é desenhado
 * se for do próprio GitHub (`urlDoGithub`). Falta um token só de leitura (Actions: read) para a tela, que é segredo
 * novo na Vercel e fica com o titular.
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

/**
 * O endereço da execução, só se for do próprio GitHub (M6 da revisão da onda 11; 12/10/2026, onda 12, C): começa por
 * "https://github.com/" e a origem lida pelo `URL` é a mesma. Outro esquema ("javascript:", "http:"), outro domínio
 * ("https://github.com.exemplo.net/") ou texto que não é endereço dão null, e a tela não desenha o link.
 */
export function urlDoGithub(v: unknown): string | null {
  const u = texto(v);
  if (!u || !u.startsWith("https://github.com/")) return null;
  try {
    return new URL(u).origin === "https://github.com" ? u : null;
  } catch {
    return null;
  }
}

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
      // Só o endereço do próprio GitHub (onda 12, C).
      url: urlDoGithub(run.html_url),
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

// ================================================================ a tabela da tela (onda 15, fase 2, lote C, 13/10/2026)

/**
 * A tabela dos jobs com filtro e ordem em cada coluna (a regra do titular de 13/10/2026; tela de administrador, toda
 * coluna ordena). As células da tela continuam as de antes; aqui ficam os valores crus, que filtram, ordenam e vão ao
 * CSV. As colunas ocultas levam o que a célula junta: a tabela do banco (debaixo do nome do job), as horas desde a
 * concluída (o "há quanto"), a situação do dado e o workflow (debaixo da cadência).
 *
 * As datas são o dia em Brasília (`diaBrasilia`, UTC−3 fixo): a mesma conta em qualquer fuso do servidor.
 */
export const TABELA_RODADAS = "jobs";

/** A situação do dado em palavras, como a célula "Dado até" diz. */
export const ROTULO_SITUACAO_DADO: Record<SituacaoDado, string> = {
  no_prazo: "no esperado",
  velho: "dado velho",
  sem_prazo: "coleta assistida, sem esperado",
  nao_grava: "o job não grava a data",
  nao_lido: "não lido",
  sem_execucao: "sem execução",
};

export const COLUNAS_RODADAS: ColunaTabela[] = [
  { id: "job", titulo: "Job", tipo: "texto" },
  { id: "tabela", titulo: "Tabela no banco", tipo: "texto", oculta: true },
  { id: "estado", titulo: "Estado", tipo: "categoria" },
  { id: "concluida", titulo: "Última concluída", tipo: "data" },
  { id: "horas", titulo: "Horas desde a última concluída", tipo: "numero", oculta: true },
  { id: "dado-ate", titulo: "Dado até", tipo: "data" },
  { id: "dado", titulo: "Situação do dado", tipo: "categoria", oculta: true },
  { id: "cadencia", titulo: "Cadência", tipo: "categoria" },
  { id: "workflow", titulo: "Workflow", tipo: "categoria", oculta: true },
  { id: "linhas", titulo: "Linhas", tipo: "numero" },
  { id: "falhas", titulo: "Falhas", tipo: "numero", alinhar: "direita" },
  { id: "gravando", titulo: "Gravando", tipo: "categoria" },
  { id: "avisos", titulo: "Avisos", tipo: "texto" },
];

/**
 * Os valores crus de uma linha, por coluna de `COLUNAS_RODADAS`. A linha "não lido" fica só com o nome, o estado e a
 * cadência: a tela mostra "—" no resto, e o vazio não entra em filtro nenhum.
 */
export function valoresDaRodada(l: LinhaRodada): Record<string, ValorCelula> {
  const { job } = l;
  const lida = l.estado !== "nao_lido";
  return {
    job: job.nome,
    tabela: `${job.tabela}${job.recorte ? ` · recorte ${job.recorte}` : ""}`,
    estado: ROTULO_ESTADO[l.estado],
    concluida: lida && l.concluidaEm ? diaBrasilia(l.concluidaEm) : null,
    horas: lida && l.idadeH !== null ? Math.round(l.idadeH * 10) / 10 : null,
    "dado-ate": lida ? l.dado.dia : null,
    dado: lida ? ROTULO_SITUACAO_DADO[l.dado.situacao] : null,
    cadencia: ROTULO_CADENCIA[job.cadencia],
    workflow: job.workflow,
    linhas: l.linhas,
    falhas: l.falhas,
    gravando: !lida ? null : !l.gravando ? "não" : l.gravando.parada ? "parada" : "em curso",
    avisos: l.avisos.length ? l.avisos.join("; ") : null,
  };
}
