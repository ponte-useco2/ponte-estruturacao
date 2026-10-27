import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REPOSITORIO, WORKFLOWS } from "./agendamento.ts";
import {
  ATRASO_GITHUB_H,
  DEFASAGEM_API_ESPECIAIS_DIAS,
  DEFASAGEM_CAGED_MESES,
  DEFASAGEM_CAUC_DIAS_UTEIS,
  DEFASAGEM_CONSULTA_DIAS,
  DEFASAGEM_OSC_MESES,
  DEFASAGEM_PIX_DIAS_UTEIS,
  DEFASAGEM_PORTAL_EMENDAS_DIAS,
  DEFASAGEM_TCE_PB_DIAS,
  DEFASAGEM_TRANSFEREGOV_DIAS,
  DIAS_ANO_CORRENTE_TCE_PB,
  ESTADOS,
  FOLGA_EMENDAS_H,
  FOLGA_EMENDAS_JP_H,
  FOLGA_EMENDAS_PB_H,
  FOLGA_PADRAO_H,
  FOLGA_RADAR_H,
  FONTE_CAGED,
  INTERVALO_H,
  JOBS_RODADAS,
  LIMITE_GRAVANDO_H,
  MARCA_ESTADO,
  ROTULO_ESTADO,
  TOM_ESTADO,
  WORKFLOWS_DAS_RODADAS,
  avaliarDado,
  avaliarRodada,
  cadenciaDoCron,
  contarEstados,
  cronDoWorkflow,
  dataHoraBrasilia,
  defasagemEntre,
  descreverCron,
  detalheMunicipios,
  diaDoDado,
  githubPedeAtencao,
  haQuanto,
  horaBrasilia,
  leituraDasConsultas,
  periodosPorFonte,
  prazoH,
  rotuloEvento,
  rotuloGithub,
  textoDefasagem,
  textoDiaDoDado,
  textoEsperado,
  textoFrescor,
  textoPeriodo,
  textoPrazo,
  textoUnidade,
  ultimaNoGithub,
  urlDoGithub,
  urlExecucoesGithub,
  type ExecucaoAberta,
  type ExecucaoConcluida,
  type JobRodada,
  type LeituraDadoAte,
  type LeituraRodada,
  type RespostaConsulta,
} from "./rodadas.ts";

// Onda 9, C (09/10/2026): a saúde das rodadas.

const HORA = 3600 * 1000;
const AGORA = Date.parse("2026-10-09T21:00:00Z"); // 18h00 em Brasília
const job = (id: string): JobRodada => {
  const j = JOBS_RODADAS.find((x) => x.id === id);
  assert.ok(j, `job ${id} existe`);
  return j;
};
const concluida = (horasAtras: number, contagens: Record<string, unknown> = {}): ExecucaoConcluida => {
  const fim = new Date(AGORA - horasAtras * HORA).toISOString();
  return { id: 1, iniciada_em: new Date(AGORA - (horasAtras + 0.5) * HORA).toISOString(), concluida_em: fim, contagens };
};
const aberta = (status: string, horasAtras: number): ExecucaoAberta => ({ id: 9, status, iniciada_em: new Date(AGORA - horasAtras * HORA).toISOString() });
const ok = (ultima: ExecucaoConcluida | null, abertas: ExecucaoAberta[] = []): LeituraRodada => ({ estado: "ok", ultima, abertas });

// ================================================================ a cadência lida dos workflows

const PASTA_WORKFLOWS = path.join(import.meta.dirname, "..", "..", "..", "..", ".github", "workflows");
// No repositório publicado (o espelho de `web/`) não há `.github/workflows` do monorepo: lá estes testes não rodam.
const semWorkflows = !fs.existsSync(PASTA_WORKFLOWS);

function lerWorkflow(arquivo: string): { crons: string[]; tempoLimiteMin: number } {
  const fonte = fs.readFileSync(path.join(PASTA_WORKFLOWS, arquivo), "utf-8");
  const crons = [...fonte.matchAll(/^\s*-\s*cron:\s*"([^"]+)"/gm)].map((m) => m[1]);
  // Os jobs de um workflow rodam em sequência (a trava, depois o job): o tempo-limite é a soma.
  const tempoLimiteMin = [...fonte.matchAll(/timeout-minutes:\s*(\d+)/g)].reduce((s, m) => s + Number(m[1]), 0);
  return { crons, tempoLimiteMin };
}

const minutosDoDia = (cron: string) => {
  const [m, h] = cron.split(/\s+/).map(Number);
  return h * 60 + m;
};
const DISPARO_VERCEL_MIN = 11 * 60 + 30;

test("onda 9, C: o cron de cada job é o do workflow, e a cadência sai do cron", { skip: semWorkflows }, () => {
  for (const j of JOBS_RODADAS) {
    if (j.cadencia === "assistida") {
      assert.equal(j.workflow, null, `${j.id}: coleta assistida não tem workflow`);
      assert.equal(j.cron, null);
      continue;
    }
    assert.ok(j.workflow && j.cron, `${j.id}: job agendado tem workflow e cron`);
    const { crons } = lerWorkflow(j.workflow);
    assert.deepEqual(crons, [j.cron], `${j.id}: o schedule de ${j.workflow} mudou; atualize JOBS_RODADAS`);
    assert.equal(cadenciaDoCron(j.cron), j.cadencia, `${j.id}: a cadência escrita é a do cron`);
  }
});

test("onda 9, C: todo workflow agendado do monorepo tem linha na tela", { skip: semWorkflows }, () => {
  const agendados = fs
    .readdirSync(PASTA_WORKFLOWS)
    .filter((f) => /\.ya?ml$/.test(f) && lerWorkflow(f).crons.length > 0)
    .sort();
  assert.deepEqual([...WORKFLOWS_DAS_RODADAS].sort(), agendados);
});

test("onda 9, C: a folga cobre o atraso do GitHub, o tempo-limite e, nos do agendador, a distância até o cron", { skip: semWorkflows }, () => {
  for (const j of JOBS_RODADAS) {
    if (!j.workflow || !j.cron) continue;
    const { tempoLimiteMin } = lerWorkflow(j.workflow);
    const doAgendador = (WORKFLOWS as readonly string[]).includes(j.workflow);
    const distancia = doAgendador ? minutosDoDia(j.cron) - DISPARO_VERCEL_MIN : 0;
    const precisa = ATRASO_GITHUB_H * 60 + tempoLimiteMin + distancia;
    assert.ok(j.folgaH * 60 >= precisa, `${j.id}: folga de ${j.folgaH} h < ${precisa} min`);
  }
});

test("onda 9, C: os workflows do disparo da Vercel são diários", () => {
  for (const w of WORKFLOWS) {
    const jobs = JOBS_RODADAS.filter((j) => j.workflow === w);
    assert.ok(jobs.length > 0, `${w} tem linha na tela`);
    assert.ok(jobs.every((j) => j.cadencia === "diaria"), `${w} é diário`);
  }
  assert.equal(cronDoWorkflow("radar-propostas.yml"), "45 12 * * *");
  assert.equal(cronDoWorkflow("nao-existe.yml"), null);
});

test("onda 9, C: os 19 jobs, com as 17 tabelas (12 conferidas no banco em 09/10/2026; a emd_execucao na onda 14; a epb_execucao no E1; a ejp_execucao no J1; a fnas_execucao na primeira infância; a obr_execucao na P0.4)", () => {
  // Onda 14, integração (12/10/2026): as emendas parlamentares, a 15ª linha e a 13ª tabela. E1 das emendas estaduais
  // (16/10/2026): a 16ª linha e a 14ª tabela, da oport_41. J1 das emendas de João Pessoa (16/10/2026): a 17ª linha e a
  // 15ª tabela, da oport_44. FNAS (primeira infância, 22/10/2026): a 18ª linha e a 16ª tabela, da oport_47. Obras de
  // creche (P0.4, 27/10/2026): a 19ª linha e a 17ª tabela, da oport_49.
  assert.equal(JOBS_RODADAS.length, 19);
  assert.equal(new Set(JOBS_RODADAS.map((j) => j.id)).size, JOBS_RODADAS.length, "ids únicos");
  assert.deepEqual([...new Set(JOBS_RODADAS.map((j) => j.tabela))].sort(), [
    "al_execucao",
    "ejp_execucao",
    "emd_execucao",
    "epb_execucao",
    "exigencia_execucao",
    "fiscal_execucao",
    "fnas_execucao",
    "mun_execucao",
    "obr_execucao",
    "osc_execucao",
    "painel_execucao",
    "pix_execucao",
    "pixc_execucao",
    "radar_execucao",
    "sancao_execucao",
    "tce_execucao",
    "tcu_execucao",
  ]);
  for (const j of JOBS_RODADAS) {
    assert.equal(j.recorte !== null, j.tabela === "al_execucao" || j.tabela === "exigencia_execucao", `${j.id}: recorte só onde a tabela tem`);
    assert.equal(j.id, j.recorte ? `${j.tabela.replace(/_execucao$/, "")}:${j.recorte}` : j.tabela.replace(/_execucao$/, ""));
  }
});

test("onda 9, C: cadenciaDoCron e descreverCron", () => {
  assert.equal(cadenciaDoCron("45 12 * * *"), "diaria");
  assert.equal(cadenciaDoCron("15 8 * * 1"), "semanal");
  assert.equal(cadenciaDoCron("0 10 5 * *"), "mensal");
  assert.equal(cadenciaDoCron("0 10 20,28 * *"), "mensal");
  assert.equal(cadenciaDoCron("0 10 1 1 *"), null, "anual não é cadência da tela");
  assert.equal(cadenciaDoCron("0 10 * *"), null);
  assert.equal(descreverCron("45 12 * * *"), "todo dia, 12h45 UTC");
  assert.equal(descreverCron("15 8 * * 1"), "toda segunda, 08h15 UTC");
  assert.equal(descreverCron("15 3 * * 0"), "todo domingo, 03h15 UTC");
  assert.equal(descreverCron("0 9 * * 3"), "toda quarta, 09h00 UTC");
  assert.equal(descreverCron("0 10 5 * *"), "dia 5, 10h00 UTC");
  assert.equal(descreverCron("0 10 20,28 * *"), "dias 20 e 28, 10h00 UTC");
});

test("onda 9, C: o prazo é o intervalo da cadência mais a folga; a coleta assistida não tem prazo", () => {
  assert.equal(prazoH(job("radar")), 24 + FOLGA_RADAR_H);
  assert.equal(FOLGA_RADAR_H, 10, "27/10/2026: o radar no runner do titular, com 3 h de tempo-limite");
  assert.equal(prazoH(job("pix")), 7 * 24 + FOLGA_PADRAO_H);
  assert.equal(prazoH(job("mun")), 31 * 24 + FOLGA_PADRAO_H);
  assert.equal(prazoH(job("osc")), 31 * 24 + 8 * 24 + FOLGA_PADRAO_H);
  assert.equal(prazoH(job("al:obras")), null);
  assert.deepEqual(INTERVALO_H, { diaria: 24, semanal: 168, mensal: 744 });
});

// ================================================================ o estado

test("onda 9, C: em dia até o prazo; atrasada um minuto depois", () => {
  const radar = job("radar");
  const prazo = prazoH(radar) ?? 0;
  const noLimite = avaliarRodada(radar, ok(concluida(prazo, { janelas_abertas: 3245 })), AGORA);
  assert.equal(noLimite.estado, "em_dia");
  assert.equal(noLimite.linhas, 3245);
  assert.equal(noLimite.falhas, null, "o radar não conta falhas");
  assert.equal(avaliarRodada(radar, ok(concluida(prazo + 1 / 60)), AGORA).estado, "atrasada");
  // A rodada de ontem às 11h50 pela Vercel e a reserva do GitHub de hoje, que só sai às 17h45 UTC: ainda em dia.
  assert.equal(avaliarRodada(radar, ok(concluida(31)), AGORA).estado, "em_dia");
});

test("onda 9, C: a agendada que nunca concluiu está atrasada; a assistida, com aviso", () => {
  const nunca = avaliarRodada(job("tcu"), ok(null), AGORA);
  assert.equal(nunca.estado, "atrasada");
  assert.equal(nunca.concluidaEm, null);
  assert.equal(nunca.linhas, null);
  const coleta = avaliarRodada(job("exigencia:assinatura"), ok(null), AGORA);
  assert.equal(coleta.estado, "com_aviso");
  assert.deepEqual(coleta.avisos, ["nenhuma coleta concluída"]);
});

test("onda 9, C: a coleta assistida nunca fica atrasada, por velha que seja", () => {
  const velha = avaliarRodada(job("exigencia:suspensiva"), ok(concluida(18 * 24, { instrumentos: 288, instrumentos_com_erro: 0, recusados: 0 })), AGORA);
  assert.equal(velha.estado, "em_dia");
  assert.equal(velha.prazoH, null);
  assert.equal(velha.linhas, 288);
  assert.equal(velha.falhas, 0);
});

test("onda 9, C: 'gravando' há mais de 2 h é aviso; há menos, é a rodada em curso", () => {
  const radar = job("radar");
  const emCurso = avaliarRodada(radar, ok(concluida(20), [aberta("gravando", LIMITE_GRAVANDO_H - 0.1)]), AGORA);
  assert.equal(emCurso.estado, "em_dia");
  assert.equal(emCurso.gravando?.parada, false);
  const parada = avaliarRodada(radar, ok(concluida(20), [aberta("gravando", 1), aberta("gravando", 5)]), AGORA);
  assert.equal(parada.estado, "com_aviso");
  assert.equal(parada.gravando?.parada, true, "vale a mais antiga");
  assert.equal(Math.round(parada.gravando?.idadeH ?? 0), 5);
  assert.deepEqual(parada.avisos, [], "a gravando parada tem coluna própria; não se repete nos avisos");
  // Parada e atrasada ao mesmo tempo (o job morreu e não houve outra rodada): vale atrasada.
  assert.equal(avaliarRodada(radar, ok(concluida(40), [aberta("gravando", 30)]), AGORA).estado, "atrasada");
});

test("onda 9, C: o erro mais novo que a última concluída é aviso; o anterior é história", () => {
  const obras = job("al:obras");
  // 02/10/2026: erro às 03h06, concluída às 03h10 (o caso real do Acesso Livre de obras).
  const historia = avaliarRodada(obras, ok(concluida(10), [aberta("erro", 11)]), AGORA);
  assert.equal(historia.estado, "em_dia");
  assert.deepEqual(historia.avisos, []);
  const novo = avaliarRodada(job("painel"), ok(concluida(10), [aberta("erro", 2), aberta("erro", 3)]), AGORA);
  assert.equal(novo.estado, "com_aviso");
  assert.deepEqual(novo.avisos, ["a tentativa de 09/10/2026 às 16:00 terminou em erro"]);
});

test("onda 9, C: falha contada no jsonb é aviso, mesmo sem texto", () => {
  const tcu = avaliarRodada(job("tcu"), ok(concluida(30, { tcu_consultados: 6434, tcu_erros: 3, tcu_nao_consultados: 0, tcu_disjuntor: false })), AGORA);
  assert.equal(tcu.estado, "com_aviso");
  assert.equal(tcu.falhas, 3);
  assert.deepEqual(tcu.avisos, []);
});

test("onda 9, C: atrasada vence o aviso, e os avisos continuam listados", () => {
  const r = avaliarRodada(job("fiscal"), ok(concluida(40, { municipios: 223, fontes_com_erro: { siconfi_rreo1: 1 } })), AGORA);
  assert.equal(r.estado, "atrasada");
  assert.deepEqual(r.avisos, ["fonte com erro: siconfi_rreo1"]);
  assert.equal(r.falhas, 1);
});

test("onda 9, C: a leitura que falhou diz 'não lido', e as outras seguem", () => {
  const r = avaliarRodada(job("osc"), { estado: "nao_lido", motivo: "ausente" }, AGORA);
  assert.equal(r.estado, "nao_lido");
  assert.equal(r.motivoNaoLido, "ausente");
  assert.equal(r.concluidaEm, null);
  const linhas = [r, avaliarRodada(job("radar"), ok(concluida(1)), AGORA), avaliarRodada(job("tcu"), ok(null), AGORA)];
  // O "dado velho" entrou na contagem em 10/10/2026 (onda 11, B).
  assert.deepEqual(contarEstados(linhas), { em_dia: 1, atrasada: 1, dado_velho: 0, com_aviso: 0, nao_lido: 1 });
});

test("onda 9, C: estado com palavra e marca, não só cor", () => {
  assert.deepEqual(ROTULO_ESTADO, { em_dia: "em dia", atrasada: "atrasada", dado_velho: "dado velho", com_aviso: "com aviso", nao_lido: "não lido" });
  assert.equal(new Set(Object.values(MARCA_ESTADO)).size, 5, "uma marca diferente para cada estado");
  assert.equal(new Set(Object.values(TOM_ESTADO)).size, 5, "e um tom diferente");
});

// ================================================================ as contagens de cada job (formatos reais de 09/10/2026)

const contar = (id: string, c: Record<string, unknown>) => {
  const j = job(id);
  return { linhas: j.linhas(c), falhas: j.falhas(c), avisos: j.avisos(c) };
};

test("onda 9, C: TCE-PB — arquivos lidos, falhas de download e o que ficou para depois", () => {
  assert.deepEqual(
    contar("tce", {
      tce_arquivos_lidos: 669,
      tce_arquivos_esperados: 669,
      tce_listagem_ok: true,
      tce_downloads: { falhas: 0, adiados: 0, tarefas: 0, baixados: 0 },
    }),
    { linhas: 669, falhas: 0, avisos: [] },
  );
  assert.deepEqual(
    contar("tce", {
      tce_arquivos_lidos: 600,
      tce_arquivos_esperados: 669,
      tce_listagem_ok: false,
      tce_downloads: { falhas: 2, adiados: 67, tarefas: 69, baixados: 0 },
    }),
    {
      linhas: 600,
      falhas: 2,
      avisos: ["69 arquivos de 669 ainda não lidos", "67 downloads adiados para a próxima rodada", "a listagem de arquivos do TCE-PB não respondeu"],
    },
  );
});

test("onda 9, C: fiscal — as fontes com erro somam as falhas", () => {
  assert.deepEqual(contar("fiscal", { municipios: 223, fontes_com_erro: {} }), { linhas: 223, falhas: 0, avisos: [] });
  // 03/10/2026, execução 22.
  assert.deepEqual(contar("fiscal", { municipios: 223, fontes_com_erro: { siconfi_rreo1: 1, siconfi_rreo9: 1 } }), {
    linhas: 223,
    falhas: 2,
    avisos: ["fontes com erro: siconfi_rreo1, siconfi_rreo9"],
  });
});

test("onda 9, C: municípios — a fonte com aviso foi repetida da rodada anterior", () => {
  const base = { linhas_por_fonte: { ibge: 2000, inep_tdi: 446, creche: 223 } };
  assert.deepEqual(contar("mun", { ...base, avisos: {} }), { linhas: 2669, falhas: 0, avisos: [] });
  // 01/10/2026, execução 1 (as mensagens não aparecem: só o nome da fonte).
  assert.deepEqual(contar("mun", { ...base, avisos: { inep_tdi: ["TDI: FileNotFoundError"], inep_ideb: ["a", "b"] } }), {
    linhas: 2669,
    falhas: 2,
    avisos: ["fontes repetidas da rodada anterior: inep_tdi, inep_ideb"],
  });
  assert.equal(contar("mun", {}).linhas, null, "sem linhas_por_fonte, sem número");
});

test("onda 9, C: sanções, e-TCE, OSC, Pix, painel e exigências", () => {
  assert.deepEqual(contar("sancao", { sancao_consultados: 4352, sancao_erros: 0, sancao_nao_consultados: 0, sancao_parada: null }), {
    linhas: 4352,
    falhas: 0,
    avisos: [],
  });
  assert.deepEqual(contar("sancao", { sancao_consultados: 4000, sancao_erros: 1, sancao_nao_consultados: 352, sancao_parada: "prazo" }).avisos, [
    "352 fornecedores ficaram para a próxima rodada",
    "a consulta parou antes do fim",
  ]);
  assert.deepEqual(contar("tcu", { tcu_consultados: 6434, tcu_erros: 0, tcu_nao_consultados: 1, tcu_disjuntor: true }).avisos, [
    "1 convênio ficou para a próxima rodada",
    "o disjuntor interrompeu a consulta",
  ]);
  assert.deepEqual(contar("osc", { ativas: 10381, malformadas_pb: 0, cebas_ok: true, descartadas: {} }), { linhas: 10381, falhas: 0, avisos: [] });
  assert.deepEqual(contar("osc", { ativas: 10381, malformadas_pb: 0, cebas_ok: false, descartadas: { cnpj_invalido: 2, cnpj_repetido: 1 } }).avisos, [
    "as planilhas do CEBAS não foram lidas",
    "3 linhas descartadas (CNPJ inválido ou repetido)",
  ]);
  assert.equal(contar("pix", { especiais_planos: 57827, fundo_planos: 25972 }).linhas, 83799);
  assert.equal(contar("pix", {}).linhas, null);
  assert.deepEqual(contar("pixc", { ciclo_planos_uf: 336, ciclo_situacoes_novas: ["Nova"], ciclo_a_conferir: 2 }), {
    linhas: 336,
    falhas: null,
    avisos: ["1 situação nova de plano que o ciclo não conhece", "2 planos a conferir"],
  });
  assert.deepEqual(contar("painel", { instrumentos: 79199, pc33_arquivos_ausentes: [], tcu_verificado: true }), { linhas: 79199, falhas: null, avisos: [] });
  assert.deepEqual(contar("painel", { instrumentos: 79199, pc33_arquivos_ausentes: ["a.csv"], tcu_verificado: false }).avisos, [
    "1 arquivo da Portaria Conjunta 33 ausente",
    "a lista de inidôneos do TCU não foi verificada",
  ]);
  assert.deepEqual(contar("al:prestacao", { al_convenios: 887, al_erros: 0 }), { linhas: 887, falhas: 0, avisos: [] });
  assert.deepEqual(contar("exigencia:suspensiva", { instrumentos: 288, instrumentos_com_erro: 1, recusados: 4 }), {
    linhas: 288,
    falhas: 1,
    avisos: ["4 linhas recusadas na carga"],
  });
});

test("onda 9, C: chave ausente ou de outro tipo não vira número", () => {
  assert.deepEqual(contar("radar", { janelas_abertas: "3245" }), { linhas: null, falhas: null, avisos: [] });
  assert.deepEqual(contar("tce", { tce_downloads: null }), { linhas: null, falhas: null, avisos: [] });
});

// ================================================================ datas e tempos

test("onda 9, C: data e hora em Brasília, pela regra de datas.ts", () => {
  assert.equal(horaBrasilia("2026-10-09T11:49:06.274366+00:00"), "08:49");
  assert.equal(dataHoraBrasilia("2026-10-09T11:49:06.274366+00:00"), "09/10/2026 às 08:49");
  // A noite em Brasília fica no dia de Brasília.
  assert.equal(dataHoraBrasilia("2026-10-02T03:10:36+00:00"), "02/10/2026 às 00:10");
  assert.equal(dataHoraBrasilia("2026-10-02T02:10:36+00:00"), "01/10/2026 às 23:10");
  assert.equal(dataHoraBrasilia(null), "—");
  assert.equal(dataHoraBrasilia("sem data"), "—");
});

test("onda 9, C: há quanto tempo e o prazo por extenso", () => {
  assert.equal(haQuanto(0.001), "há 1 min");
  assert.equal(haQuanto(0.5), "há 30 min");
  assert.equal(haQuanto(6.9), "há 6 h");
  assert.equal(haQuanto(47.9), "há 47 h");
  assert.equal(haQuanto(50), "há 2 dias");
  assert.equal(textoPrazo(32), "32 h");
  assert.equal(textoPrazo(176), "7 dias e 8 h");
  assert.equal(textoPrazo(31 * 24), "31 dias");
  assert.equal(textoPrazo(prazoH(job("osc")) ?? 0), "39 dias e 8 h");
});

// ================================================================ o GitHub

type Pedido = { url: string; init: RequestInit };
/** Marca e palavra juntas, só para comparar no teste. */
const rotulo = (r: Parameters<typeof rotuloGithub>[0]) => {
  const { marca, texto } = rotuloGithub(r);
  return `${marca} ${texto}`;
};
function buscarFalso(resposta: { status: number; corpo?: unknown } | Error) {
  const pedidos: Pedido[] = [];
  const buscar = async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    if (resposta instanceof Error) throw resposta;
    return { status: resposta.status, json: async () => resposta.corpo };
  };
  return { buscar, pedidos };
}

const RUN = {
  status: "completed",
  conclusion: "success",
  event: "workflow_dispatch",
  created_at: "2026-10-09T11:30:12Z",
  html_url: `https://github.com/${REPOSITORIO}/actions/runs/1`,
};

test("onda 9, C: a última execução do workflow, lida com o token no cabeçalho", async () => {
  const { buscar, pedidos } = buscarFalso({ status: 200, corpo: { total_count: 1, workflow_runs: [RUN] } });
  const r = await ultimaNoGithub("tok", "fiscal.yml", buscar);
  assert.equal(pedidos[0].url, `https://api.github.com/repos/${REPOSITORIO}/actions/workflows/fiscal.yml/runs?per_page=1`);
  assert.equal(pedidos[0].url, urlExecucoesGithub("fiscal.yml"));
  assert.equal(pedidos[0].init.method, "GET");
  assert.equal((pedidos[0].init.headers as Record<string, string>).Authorization, "Bearer tok");
  assert.deepEqual(r, {
    workflow: "fiscal.yml",
    estado: "ok",
    status: "completed",
    conclusao: "success",
    evento: "workflow_dispatch",
    criadaEm: "2026-10-09T11:30:12Z",
    url: RUN.html_url,
    http: null,
  });
  assert.equal(rotulo(r), "✓ sucesso");
  assert.equal(rotuloEvento(r.evento), "disparo (Vercel ou manual)");
  assert.equal(githubPedeAtencao(r), false);
});

test("onda 9, C: sem execução, HTTP de erro e falha de rede; o token não vaza", async () => {
  const vazio = await ultimaNoGithub("tok", "osc.yml", buscarFalso({ status: 200, corpo: { total_count: 0, workflow_runs: [] } }).buscar);
  assert.equal(vazio.estado, "sem_execucao");
  assert.equal(rotulo(vazio), "– nenhuma execução");
  const negado = await ultimaNoGithub("segredo-que-nao-pode-vazar", "osc.yml", buscarFalso({ status: 401 }).buscar);
  assert.equal(negado.estado, "falha");
  assert.equal(negado.http, 401);
  assert.equal(rotulo(negado), "? não respondeu (HTTP 401)");
  assert.equal(githubPedeAtencao(negado), true);
  assert.ok(!JSON.stringify(negado).includes("segredo-que-nao-pode-vazar"));
  const rede = await ultimaNoGithub("tok", "osc.yml", buscarFalso(new Error("timeout")).buscar);
  assert.equal(rede.estado, "falha");
  assert.equal(rede.http, 0);
  assert.equal(rotulo(rede), "? não respondeu");
});

test("onda 9, C: os rótulos do GitHub, com marca e palavra", () => {
  const r = (status: string, conclusao: string | null) => ({ estado: "ok" as const, status, conclusao, http: null });
  assert.equal(rotulo(r("completed", "failure")), "✕ falhou");
  assert.equal(rotulo(r("completed", "timed_out")), "✕ estourou o tempo-limite");
  assert.equal(rotulo(r("completed", "cancelled")), "– cancelada");
  assert.equal(rotulo(r("in_progress", null)), "… em andamento");
  assert.equal(rotulo(r("queued", null)), "… na fila");
  assert.equal(githubPedeAtencao(r("completed", "failure")), true);
  assert.equal(githubPedeAtencao(r("completed", "timed_out")), true);
  assert.equal(githubPedeAtencao(r("in_progress", null)), false);
  assert.equal(rotuloEvento("schedule"), "agendamento do GitHub");
  assert.equal(rotuloEvento(null), "—");
});

// ================================================================ o frescor do dado (10/10/2026, onda 11, B)

/** Uma execução real, com o instante de fim dado (as contagens reduzidas às chaves que a tela lê). */
const execucao = (id: number, iniciada: string, fim: string, contagens: Record<string, unknown> = {}): ExecucaoConcluida => ({
  id,
  iniciada_em: iniciada,
  concluida_em: fim,
  contagens,
});
/** A leitura com a coluna `dado_ate` da mesma execução. */
const comDadoAte = (e: ExecucaoConcluida, dadoAte: string | null): LeituraRodada => ({
  estado: "ok",
  ultima: e,
  abertas: [],
  dadoAte: { estado: "ok", id: e.id, dadoAte },
});
const depoisDe = (iso: string, horas: number) => Date.parse(iso) + horas * HORA;

test("onda 11, B: cada job diz onde grava a data do dado, ou que não grava", () => {
  const onde = Object.fromEntries(JOBS_RODADAS.map((j) => [j.id, j.dado ? `${j.dado.origem}:${j.dado.unidade}:${j.dado.limite}` : null]));
  assert.deepEqual(onde, {
    radar: `coluna:dias:${DEFASAGEM_TRANSFEREGOV_DIAS}`,
    pixc: `contagens:dias:${DEFASAGEM_API_ESPECIAIS_DIAS}`,
    painel: `coluna:dias:${DEFASAGEM_TRANSFEREGOV_DIAS}`,
    tce: `coluna:dias:${DEFASAGEM_TCE_PB_DIAS}`,
    fiscal: `contagens:dias_uteis:${DEFASAGEM_CAUC_DIAS_UTEIS}`,
    pix: `contagens:dias_uteis:${DEFASAGEM_PIX_DIAS_UTEIS}`,
    tcu: `coluna:dias:${DEFASAGEM_CONSULTA_DIAS}`,
    sancao: `coluna:dias:${DEFASAGEM_CONSULTA_DIAS}`,
    // Onda 14, integração (12/10/2026): o Last-Modified do zip de emendas do Portal, na coluna.
    emd: `coluna:dias:${DEFASAGEM_PORTAL_EMENDAS_DIAS}`,
    // E1 das emendas estaduais (16/10/2026): a API da PB não informa a data do dado; vale o instante da leitura.
    epb: `coluna:dias:${DEFASAGEM_CONSULTA_DIAS}`,
    // J1 das emendas de João Pessoa (16/10/2026): a `ultimaAtualizacao` do painel, que acompanha a hora da leitura.
    ejp: `coluna:dias:${DEFASAGEM_CONSULTA_DIAS}`,
    // Primeira infância (22/10/2026): a carga do portal do MDS, na coluna.
    fnas: `coluna:dias:${DEFASAGEM_CONSULTA_DIAS}`,
    // P0.4 (27/10/2026): a API do Obrasgov não informa a data do dado; vale o instante da leitura.
    obr: `coluna:dias:${DEFASAGEM_CONSULTA_DIAS}`,
    // Onda 12, C (12/10/2026): o Caged, de `contagens.periodo_por_fonte`. Até aqui, null.
    mun: `contagens:meses:${DEFASAGEM_CAGED_MESES}`,
    osc: `contagens:meses:${DEFASAGEM_OSC_MESES}`,
    "al:prestacao": "coluna:dias:null",
    "al:obras": "coluna:dias:null",
    "exigencia:suspensiva": "coluna:dias:null",
    "exigencia:assinatura": "coluna:dias:null",
  });
  // Só as coletas assistidas ficam sem defasagem esperada, como ficam sem cadência.
  for (const j of JOBS_RODADAS) {
    if (j.dado) assert.equal(j.dado.limite === null, j.cadencia === "assistida", `${j.id}: limite só onde há cadência`);
    if (j.dado) assert.ok(j.dado.onde && j.dado.rotulo, `${j.id}: onde e rótulo por extenso`);
  }
  // As 14 linhas da coluna fazem as 14 consultas a mais de `rodadas.server.ts` (38 + 14 = 52; até o FNAS, 36 + 13 e 34 + 12 antes dele; até o
  // J1 das emendas de João Pessoa, 32 + 11; até o E1 das emendas estaduais, 30 + 10; até a onda 14, 28 + 9).
  assert.equal(JOBS_RODADAS.filter((j) => j.dado?.origem === "coluna").length, 14);
});

test("onda 11, B: as defasagens esperadas, com o porquê nas constantes", () => {
  assert.deepEqual(
    {
      DEFASAGEM_TRANSFEREGOV_DIAS,
      DEFASAGEM_CAUC_DIAS_UTEIS,
      DEFASAGEM_PIX_DIAS_UTEIS,
      DEFASAGEM_API_ESPECIAIS_DIAS,
      DEFASAGEM_TCE_PB_DIAS,
      DEFASAGEM_CONSULTA_DIAS,
      DEFASAGEM_OSC_MESES,
      DEFASAGEM_CAGED_MESES,
      DEFASAGEM_PORTAL_EMENDAS_DIAS,
    },
    {
      DEFASAGEM_TRANSFEREGOV_DIAS: 2,
      DEFASAGEM_CAUC_DIAS_UTEIS: 2,
      DEFASAGEM_PIX_DIAS_UTEIS: 2,
      DEFASAGEM_API_ESPECIAIS_DIAS: 1,
      DEFASAGEM_TCE_PB_DIAS: 8,
      DEFASAGEM_CONSULTA_DIAS: 1,
      DEFASAGEM_OSC_MESES: 2,
      // Onda 12, C: M-2 na rodada do dia 5, mais um mês para a publicação do MTE que escorrega.
      DEFASAGEM_CAGED_MESES: 3,
      // Onda 14, integração: a terça já lê o zip de sexta à noite (Brasília) com 4 dias; mais 1 para a segunda de feriado.
      DEFASAGEM_PORTAL_EMENDAS_DIAS: 5,
    },
  );
  assert.equal(DEFASAGEM_TCE_PB_DIAS, DIAS_ANO_CORRENTE_TCE_PB + 1, "a regra do job mais 1 dia para o download adiado");
});

const REGRAS_FISCAL = path.join(import.meta.dirname, "..", "..", "..", "..", "fiscal", "regras.py");
const DIAS_UTEIS_CAUC = fs.existsSync(REGRAS_FISCAL) ? fs.readFileSync(REGRAS_FISCAL, "utf-8").match(/^DIAS_UTEIS_CAUC\s*=\s*(\d+)/m) : null;

test("onda 11, B: o CAUC fica 'dado velho' no mesmo dia útil em que o fiscal o marca 'desatualizado'", { skip: !DIAS_UTEIS_CAUC }, () => {
  // `fiscal/regras.py` (onda 11, A): desatualizado com idade >= DIAS_UTEIS_CAUC; aqui, velho com defasagem > limite.
  assert.equal(DEFASAGEM_CAUC_DIAS_UTEIS + 1, Number(DIAS_UTEIS_CAUC?.[1]), "o fiscal mudou o limite do CAUC; atualize a defasagem");
});

const CACHE_TCE = path.join(import.meta.dirname, "..", "..", "..", "..", "tce_federal", "cache.py");

test("onda 11, B: o TCE-PB baixa o ano corrente a cada DIAS_ANO_CORRENTE dias, como diz tce_federal/cache.py", { skip: !fs.existsSync(CACHE_TCE) }, () => {
  const m = fs.readFileSync(CACHE_TCE, "utf-8").match(/^DIAS_ANO_CORRENTE\s*=\s*(\d+)/m);
  assert.ok(m, "DIAS_ANO_CORRENTE existe no cache do job");
  assert.equal(Number(m[1]), DIAS_ANO_CORRENTE_TCE_PB, "o job mudou o ciclo do ano corrente; atualize a defasagem do TCE-PB");
});

test("onda 11, B: o dia do dado em Brasília, qualquer que seja o formato e o fuso da máquina", () => {
  assert.equal(diaDoDado("2026-10-02"), "2026-10-02", "a data pura do CAUC passa direto");
  assert.equal(diaDoDado("20260806"), "2026-08-06", "a versão do Ipea");
  // O carimbo do Transferegov: 07/10, 22h34 em Brasília.
  assert.equal(diaDoDado("2026-10-08T01:34:18+00:00"), "2026-10-07");
  assert.equal(diaDoDado("2026-10-06T06:16:42.382+00:00"), "2026-10-06");
  // A API dos especiais grava sem fuso, já em Brasília: "09/10 0h" não pode virar 08/10 na Vercel (UTC).
  assert.equal(diaDoDado("2026-10-09T00:00:00"), "2026-10-09");
  for (const ruim of [null, undefined, "", "   ", "não é data", "2026-02-30", "20261340"]) assert.equal(diaDoDado(ruim), null, String(ruim));
});

test("onda 11, B: a defasagem em dias, em dias úteis e em meses", () => {
  assert.equal(defasagemEntre("2026-10-07", "2026-10-09", "dias"), 2);
  assert.equal(defasagemEntre("2026-10-09", "2026-10-09", "dias"), 0);
  assert.equal(defasagemEntre("2026-10-10", "2026-10-09", "dias"), 0, "o dado mais novo que a rodada conta 0");
  // Dias úteis: os de segunda a sexta depois do dia do dado, até o dia da rodada.
  assert.equal(defasagemEntre("2026-10-02", "2026-10-09", "dias_uteis"), 5, "sexta lendo a sexta anterior");
  assert.equal(defasagemEntre("2026-09-25", "2026-09-27", "dias_uteis"), 0, "domingo lendo a sexta");
  assert.equal(defasagemEntre("2026-10-02", "2026-10-03", "dias_uteis"), 0, "sábado lendo a sexta");
  assert.equal(defasagemEntre("2026-10-02", "2026-10-05", "dias_uteis"), 1, "segunda lendo a sexta");
  assert.equal(defasagemEntre("2026-10-02", "2026-10-06", "dias_uteis"), 2);
  assert.equal(defasagemEntre("2026-09-29", "2026-10-07", "dias_uteis"), 6);
  assert.equal(defasagemEntre("2026-08-06", "2026-10-08", "meses"), 2);
  assert.equal(defasagemEntre("2026-09-30", "2026-10-01", "meses"), 1);
  assert.equal(defasagemEntre("2025-12-18", "2026-01-20", "meses"), 1, "a virada do ano");
  assert.equal(defasagemEntre("2026-10-01", "2026-10-31", "meses"), 0);
});

test("onda 11, B: o caso real — o fiscal de 09/10/2026, com o CAUC de 02/10, sai 'dado velho'", () => {
  // Execução 27 (fiscal_execucao), lida pelo MCP em 09/10/2026; a tela lida às 18h54 em Brasília.
  const agora = Date.parse("2026-10-09T21:54:37Z");
  const real = execucao(27, "2026-10-09T12:26:46.742699+00:00", "2026-10-09T12:26:54.882441+00:00", {
    municipios: 223,
    fontes_com_erro: {},
    cauc_data_pesquisa: "2026-10-02",
  });
  const r = avaliarRodada(job("fiscal"), ok(real), agora);
  assert.equal(r.estado, "dado_velho");
  assert.equal(`${MARCA_ESTADO[r.estado]} ${ROTULO_ESTADO[r.estado]}`, "↻ dado velho");
  assert.equal(r.dado.situacao, "velho");
  assert.equal(r.dado.dia, "2026-10-02");
  assert.equal(r.dado.defasagem, 5);
  assert.equal(textoFrescor(r.dado), "CAUC de 02/10/2026, 5 dias úteis antes da rodada (esperado: até 2 dias úteis)");
  // A rodada em si estava em dia (9 h), sem falha e sem aviso: só a data do dado muda o estado. Antes da onda 11, "em dia".
  assert.ok((r.idadeH ?? 99) < 10);
  assert.equal(r.falhas, 0);
  assert.deepEqual(r.avisos, []);
  assert.equal(avaliarRodada(job("fiscal"), ok({ ...real, contagens: { municipios: 223, fontes_com_erro: {} } }), agora).estado, "em_dia");
});

test("onda 11, B: as rodadas fiscais de 22/09 a 09/10/2026 — 'dado velho' a partir de 07/10", () => {
  // [execução, fim (UTC), CAUC, fontes com erro] — fiscal_execucao 11 a 27, lidas pelo MCP em 09/10/2026.
  const historico: [number, string, string, Record<string, number>][] = [
    [11, "2026-09-22T11:53:21Z", "2026-09-21", {}], // o Tesouro não publicou em 22 e 23/09
    [12, "2026-09-23T12:12:17Z", "2026-09-21", {}], // 2 dias úteis: ainda o esperado
    [13, "2026-09-24T16:59:35Z", "2026-09-24", {}],
    [16, "2026-09-27T11:52:54Z", "2026-09-25", {}], // domingo lendo a sexta
    [17, "2026-09-28T11:52:48Z", "2026-09-28", {}],
    [18, "2026-09-29T11:53:00Z", "2026-09-29", {}],
    [19, "2026-09-30T11:52:14Z", "2026-09-30", {}],
    [20, "2026-10-01T18:27:06Z", "2026-10-01", { siconfi_rgf: 6, siconfi_rreo1: 4, siconfi_rreo9: 2, siconfi_extrato: 6, siconfi_rgf_anterior: 5 }],
    [21, "2026-10-02T17:55:19Z", "2026-10-02", { siconfi_rgf: 1, siconfi_rreo1: 3, siconfi_rreo9: 3, siconfi_extrato: 6, siconfi_rgf_anterior: 1 }],
    [22, "2026-10-03T11:57:07Z", "2026-10-02", { siconfi_rreo1: 1, siconfi_rreo9: 1 }], // sábado
    [23, "2026-10-05T18:33:00Z", "2026-10-02", {}], // segunda: 1 dia útil, ainda no esperado
    [24, "2026-10-06T12:34:41Z", "2026-10-02", {}], // 2, como em 23/09
    // De 3 em diante, o mesmo dia em que o fiscal da onda 11, A, marca G7 e G7A "desatualizado".
    [25, "2026-10-07T12:30:38Z", "2026-10-02", {}],
    [26, "2026-10-08T12:16:20Z", "2026-10-02", {}],
    [27, "2026-10-09T12:26:54Z", "2026-10-02", {}],
  ];
  const estados = historico.map(([id, fim, cauc, fontes]) => {
    const e = execucao(id, fim, fim, { municipios: 223, fontes_com_erro: fontes, cauc_data_pesquisa: cauc });
    const r = avaliarRodada(job("fiscal"), ok(e), depoisDe(fim, 1));
    return `${fim.slice(8, 10)}/${fim.slice(5, 7)} ${r.estado} ${r.dado.defasagem}`;
  });
  assert.deepEqual(estados, [
    "22/09 em_dia 1",
    "23/09 em_dia 2",
    "24/09 em_dia 0",
    "27/09 em_dia 0",
    "28/09 em_dia 0",
    "29/09 em_dia 0",
    "30/09 em_dia 0",
    "01/10 com_aviso 0",
    "02/10 com_aviso 0",
    "03/10 com_aviso 0",
    "05/10 em_dia 1",
    "06/10 em_dia 2",
    "07/10 dado_velho 3",
    "08/10 dado_velho 4",
    "09/10 dado_velho 5",
  ]);
});

/**
 * As emendas antes da primeira rodada (onda 14, integração, 12/10/2026): a `emd_execucao` criada e ainda sem linha, como
 * o servidor a lê (a consulta do `dado_ate` respondeu, sem execução).
 */
const EMD_SEM_EXECUCAO: LeituraRodada = { estado: "ok", ultima: null, abertas: [], dadoAte: { estado: "ok", id: null, dadoAte: null } };

test("onda 11, B: o estado de hoje, com as 14 últimas concluídas lidas pelo MCP em 09/10/2026 e as emendas sem execução", () => {
  const agora = Date.parse("2026-10-09T21:54:37Z");
  const leituras: Record<string, LeituraRodada> = {
    radar: comDadoAte(execucao(44, "2026-10-09T11:49:06.274366+00:00", "2026-10-09T11:49:12.4345+00:00", { janelas_abertas: 3245 }), "2026-10-08T01:34:18+00:00"),
    pixc: ok(
      execucao(4, "2026-10-09T11:51:20.879013+00:00", "2026-10-09T11:51:21.140545+00:00", {
        ciclo_planos_uf: 336,
        ciclo_a_conferir: 0,
        ciclo_situacoes_novas: [],
        especiais_data_atualizacao: "2026-10-09T00:00:00",
      }),
    ),
    painel: comDadoAte(
      execucao(43, "2026-10-09T11:55:18.637489+00:00", "2026-10-09T11:58:56.855779+00:00", { instrumentos: 79199, tcu_verificado: true, pc33_arquivos_ausentes: [] }),
      "2026-10-08T01:34:18+00:00",
    ),
    tce: comDadoAte(
      execucao(14, "2026-10-09T12:22:30.765045+00:00", "2026-10-09T12:22:34.735635+00:00", {
        tce_arquivos_lidos: 669,
        tce_arquivos_esperados: 669,
        tce_listagem_ok: true,
        tce_downloads: { falhas: 0, adiados: 0, tarefas: 0, baixados: 0 },
      }),
      "2026-10-06T06:16:42.382+00:00",
    ),
    fiscal: ok(execucao(27, "2026-10-09T12:26:46.742699+00:00", "2026-10-09T12:26:54.882441+00:00", { municipios: 223, fontes_com_erro: {}, cauc_data_pesquisa: "2026-10-02" })),
    pix: ok(
      execucao(8, "2026-10-07T12:01:40.636266+00:00", "2026-10-07T12:01:53.020396+00:00", {
        especiais_planos: 57827,
        fundo_planos: 25972,
        especiais_dado_ate: "2026-10-06",
        fundo_dado_ate: "2026-10-06",
      }),
    ),
    tcu: comDadoAte(
      execucao(2, "2026-10-07T17:06:16.027309+00:00", "2026-10-07T17:06:21.531592+00:00", { tcu_consultados: 6434, tcu_erros: 0, tcu_nao_consultados: 0, tcu_disjuntor: false }),
      "2026-10-07T17:06:15.156545+00:00",
    ),
    sancao: comDadoAte(
      execucao(1, "2026-10-09T13:35:26.644682+00:00", "2026-10-09T13:35:31.963232+00:00", { sancao_consultados: 4352, sancao_erros: 0, sancao_nao_consultados: 0, sancao_parada: null }),
      "2026-10-09T12:45:03.514201+00:00",
    ),
    // Onda 14, integração (12/10/2026): nenhuma rodada ainda.
    emd: EMD_SEM_EXECUCAO,
    // E1 das emendas estaduais (16/10/2026): idem.
    epb: EMD_SEM_EXECUCAO,
    // J1 das emendas de João Pessoa (16/10/2026): idem.
    ejp: EMD_SEM_EXECUCAO,
    fnas: EMD_SEM_EXECUCAO,
    obr: EMD_SEM_EXECUCAO,
    mun: ok(execucao(5, "2026-10-09T18:25:14.450873+00:00", "2026-10-09T18:25:22.305704+00:00", { linhas_por_fonte: { ibge: 2453, mapbiomas: 892 }, avisos: {} })),
    osc: ok(
      execucao(1, "2026-10-08T12:44:57.557481+00:00", "2026-10-08T12:45:17.547464+00:00", { ativas: 10381, malformadas_pb: 0, cebas_ok: true, descartadas: {}, versao_fonte: "20260806" }),
    ),
    "al:prestacao": comDadoAte(execucao(1, "2026-10-01T23:24:05.752592+00:00", "2026-10-01T23:24:13.352749+00:00", { al_convenios: 887, al_erros: 0 }), "2026-10-01T22:47:37.857+00:00"),
    "al:obras": comDadoAte(execucao(3, "2026-10-02T03:10:36.529684+00:00", "2026-10-02T03:10:43.682594+00:00", { al_convenios: 1798, al_erros: 0 }), "2026-10-02T02:30:07.393+00:00"),
    "exigencia:suspensiva": comDadoAte(
      execucao(2, "2026-09-21T04:06:52.5974+00:00", "2026-09-21T04:07:07.815939+00:00", { instrumentos: 288, instrumentos_com_erro: 0, recusados: 0 }),
      "2026-09-16T20:40:51+00:00",
    ),
    "exigencia:assinatura": comDadoAte(
      execucao(3, "2026-09-28T17:20:16.418661+00:00", "2026-09-28T17:20:23.793006+00:00", { instrumentos: 239, instrumentos_com_erro: 0, recusados: 0 }),
      "2026-09-28T15:52:17+00:00",
    ),
  };
  const linhas = JOBS_RODADAS.map((j) => avaliarRodada(j, leituras[j.id], agora));
  const resumo = Object.fromEntries(linhas.map((l) => [l.job.id, `${l.estado} · ${l.dado.situacao} ${l.dado.dia ?? "—"} ${l.dado.defasagem ?? "—"}`]));
  assert.deepEqual(resumo, {
    radar: "em_dia · no_prazo 2026-10-07 2",
    pixc: "em_dia · no_prazo 2026-10-09 0",
    painel: "em_dia · no_prazo 2026-10-07 2",
    tce: "em_dia · no_prazo 2026-10-06 3",
    fiscal: "dado_velho · velho 2026-10-02 5",
    pix: "em_dia · no_prazo 2026-10-06 1",
    tcu: "em_dia · no_prazo 2026-10-07 0",
    sancao: "em_dia · no_prazo 2026-10-09 0",
    // A agendada que nunca concluiu é "atrasada" (a regra da onda 9, C), e a data do dado fica "sem execução": a tela
    // mostra "nenhuma" e "—"; o e-mail a põe no bloco do topo até a primeira rodada concluir (onda 14, integração).
    emd: "atrasada · sem_execucao — —",
    epb: "atrasada · sem_execucao — —",
    ejp: "atrasada · sem_execucao — —",
    fnas: "atrasada · sem_execucao — —",
    obr: "atrasada · sem_execucao — —",
    // A execução 5 é de antes do `periodo_por_fonte` (onda 12, C): continua como era. Conferido de novo em 12/10/2026,
    // ainda a última concluída.
    mun: "em_dia · nao_grava — —",
    // O arquivo de agosto (versão 20260806) lido em outubro: o de setembro não tinha saído em 07/10/2026. Com a
    // defasagem de 2 meses (integração da onda 11), é o Ipea atrasado, e não dado velho.
    osc: "em_dia · no_prazo 2026-08-06 2",
    "al:prestacao": "em_dia · sem_prazo 2026-10-01 0",
    "al:obras": "em_dia · sem_prazo 2026-10-01 1",
    "exigencia:suspensiva": "em_dia · sem_prazo 2026-09-16 5",
    "exigencia:assinatura": "em_dia · sem_prazo 2026-09-28 0",
  });
  assert.deepEqual(contarEstados(linhas), { em_dia: 13, atrasada: 5, dado_velho: 1, com_aviso: 0, nao_lido: 0 });
  assert.equal(textoFrescor(linhas.find((l) => l.job.id === "osc")?.dado ?? linhas[0].dado), "arquivo do Ipea de 06/08/2026, 2 meses antes da rodada (esperado: até 2 meses)");
  const emd = linhas.find((l) => l.job.id === "emd");
  assert.deepEqual([emd?.concluidaEm, emd?.idadeH, emd?.linhas, emd?.falhas, emd?.avisos], [null, null, null, null, []]);
  // E hoje de fato, com a oport_39 ainda não aplicada (12/10/2026): a tabela não existe, e a linha é "não lido".
  const semTabela = avaliarRodada(job("emd"), { estado: "nao_lido", motivo: "ausente" }, agora);
  assert.deepEqual([semTabela.estado, semTabela.motivoNaoLido, semTabela.dado.situacao], ["nao_lido", "ausente", "sem_execucao"]);
});

test("onda 11, B: a data que não pôde ser lida diz 'não lido' na coluna, e a linha segue", () => {
  const radar = job("radar");
  const e = execucao(44, "2026-10-09T11:49:06Z", "2026-10-09T11:49:12Z", { janelas_abertas: 3245 });
  const agora = depoisDe("2026-10-09T11:49:12Z", 2);
  const casos: [string, LeituraDadoAte | undefined][] = [
    ["a consulta falhou", { estado: "falha" }],
    ["sem a consulta", undefined],
    ["outra execução (uma rodada concluiu entre as consultas)", { estado: "ok", id: 45, dadoAte: "2026-10-09T01:30:00+00:00" }],
  ];
  for (const [caso, dadoAte] of casos) {
    const r = avaliarRodada(radar, { estado: "ok", ultima: e, abertas: [], dadoAte }, agora);
    assert.equal(r.estado, "em_dia", caso);
    assert.equal(r.linhas, 3245, `${caso}: o resto da linha segue`);
    assert.deepEqual([r.dado.situacao, r.dado.motivo], ["nao_lido", "falha"], caso);
  }
  // A rodada que não gravou a data (o CAUC não lido) ou gravou o que não é data: "não lido", sem mudar o estado.
  for (const cauc of [undefined, null, "sem data", 20261002]) {
    const r = avaliarRodada(job("fiscal"), ok(execucao(27, "2026-10-09T12:26:46Z", "2026-10-09T12:26:54Z", { municipios: 223, fontes_com_erro: {}, cauc_data_pesquisa: cauc })), agora);
    assert.equal(r.estado, "em_dia", String(cauc));
    assert.deepEqual([r.dado.situacao, r.dado.motivo], ["nao_lido", "sem_data"], String(cauc));
  }
  // A coluna existe, mas veio vazia.
  assert.equal(avaliarRodada(radar, comDadoAte(e, null), agora).dado.motivo, "sem_data");
  // A linha inteira não lida, e a agendada que nunca concluiu: sem data, sem quebrar.
  assert.equal(avaliarRodada(radar, { estado: "nao_lido", motivo: "falha" }, agora).dado.situacao, "sem_execucao");
  const nunca = avaliarRodada(job("tcu"), ok(null), agora);
  assert.deepEqual([nunca.estado, nunca.dado.situacao], ["atrasada", "sem_execucao"]);
  // Os municípios de antes do `periodo_por_fonte` (onda 12, C) não gravam a data do dado: nunca "dado velho", nunca
  // "não lido". Sem execução, como os outros jobs: "sem_execucao" (até a onda 11, o job não tinha regra e dava "nao_grava").
  assert.equal(avaliarRodada(job("mun"), ok(execucao(5, "2026-10-09T18:25:14Z", "2026-10-09T18:25:22Z", {})), agora).dado.situacao, "nao_grava");
  assert.equal(avaliarDado(job("mun"), null, null).situacao, "sem_execucao");
  assert.equal(avaliarDado({ dado: null }, null, null).situacao, "nao_grava", "o job sem regra continua 'não grava'");
});

test("onda 11, B: atrasada vence o dado velho; o dado velho vence o aviso, e os avisos continuam listados", () => {
  const velho = { municipios: 223, cauc_data_pesquisa: "2026-10-02" };
  const fim = "2026-10-09T12:26:54Z";
  const atrasada = avaliarRodada(job("fiscal"), ok(execucao(27, fim, fim, { ...velho, fontes_com_erro: {} })), depoisDe(fim, 40));
  assert.equal(atrasada.estado, "atrasada");
  assert.equal(atrasada.dado.situacao, "velho", "a coluna continua dizendo que o dado é velho");
  const comFalha = avaliarRodada(job("fiscal"), ok(execucao(27, fim, fim, { ...velho, fontes_com_erro: { siconfi_rreo1: 1 } })), depoisDe(fim, 2));
  assert.equal(comFalha.estado, "dado_velho");
  assert.deepEqual(comFalha.avisos, ["fonte com erro: siconfi_rreo1"]);
  assert.equal(comFalha.falhas, 1);
  assert.deepEqual(ESTADOS, ["atrasada", "dado_velho", "com_aviso", "nao_lido", "em_dia"]);
});

test("onda 11, B: o arquivo do Transferegov — D-2 na segunda ainda no esperado, D-3 é dado velho", () => {
  // 05/10/2026, segunda: o arquivo trouxe dado até sábado, 22h34 em Brasília (o caso real do radar, execução 39).
  const segunda = execucao(39, "2026-10-05T11:49:06Z", "2026-10-05T11:49:13Z", { janelas_abertas: 3200 });
  const r = avaliarRodada(job("radar"), comDadoAte(segunda, "2026-10-04T01:34:16+00:00"), depoisDe("2026-10-05T11:49:13Z", 1));
  assert.deepEqual([r.estado, r.dado.defasagem], ["em_dia", 2]);
  // A terça com o mesmo arquivo: o Transferegov não publicou na segunda.
  const terca = execucao(40, "2026-10-06T11:49:06Z", "2026-10-06T11:49:13Z", { instrumentos: 79000 });
  const p = avaliarRodada(job("painel"), comDadoAte(terca, "2026-10-04T01:34:16+00:00"), depoisDe("2026-10-06T11:49:13Z", 1));
  assert.deepEqual([p.estado, p.dado.defasagem], ["dado_velho", 3]);
  assert.equal(textoFrescor(p.dado), "arquivo do Transferegov de 03/10/2026, 3 dias antes da rodada (esperado: até 2 dias)");
});

test("onda 11, B: TCE-PB, consultas ao vivo, Pix, ciclo e OSC", () => {
  // TCE-PB: 6 dias (05/10/2026, o real) no esperado; 9 dias, dado velho.
  const tce = (fim: string, dadoAte: string) => avaliarRodada(job("tce"), comDadoAte(execucao(9, fim, fim, {}), dadoAte), depoisDe(fim, 1));
  assert.deepEqual([tce("2026-10-05T12:21:51Z", "2026-09-29T06:18:45.71+00:00").estado, tce("2026-10-05T12:21:51Z", "2026-09-29T06:18:45.71+00:00").dado.defasagem], ["em_dia", 6]);
  assert.equal(tce("2026-10-08T12:21:51Z", "2026-09-29T06:18:45.71+00:00").estado, "dado_velho");
  // Sanções: a consulta que começou às 23h50 de um dia e concluiu no outro ainda é do esperado.
  const virada = avaliarRodada(job("sancao"), comDadoAte(execucao(2, "2026-10-12T03:30:00Z", "2026-10-12T03:30:00Z", {}), "2026-10-12T02:50:00+00:00"), depoisDe("2026-10-12T03:30:00Z", 1));
  assert.deepEqual([virada.estado, virada.dado.defasagem], ["em_dia", 1]);
  // Pix: vale o mais velho dos dois módulos; a rodada antes da atualização da API (07/10, 02h33) fica no esperado.
  const pix = (especiais: string, fundo: string, fim: string) =>
    avaliarRodada(job("pix"), ok(execucao(7, fim, fim, { especiais_planos: 1, fundo_planos: 1, especiais_dado_ate: especiais, fundo_dado_ate: fundo })), depoisDe(fim, 1));
  assert.deepEqual([pix("2026-10-05", "2026-10-05", "2026-10-07T05:33:54Z").estado, pix("2026-10-05", "2026-10-05", "2026-10-07T05:33:54Z").dado.defasagem], ["em_dia", 2]);
  const parado = pix("2026-09-29", "2026-10-06", "2026-10-07T12:01:53Z");
  assert.deepEqual([parado.estado, parado.dado.dia, parado.dado.defasagem], ["dado_velho", "2026-09-29", 6]);
  // Ciclo: a data da API sem fuso, no dia escrito; dois dias para trás é dado velho.
  const ciclo = (atualizacao: string) =>
    avaliarRodada(job("pixc"), ok(execucao(4, "2026-10-09T11:51:20Z", "2026-10-09T11:51:21Z", { ciclo_planos_uf: 336, especiais_data_atualizacao: atualizacao })), depoisDe("2026-10-09T11:51:21Z", 1));
  assert.equal(ciclo("2026-10-08T00:00:00").estado, "em_dia");
  assert.equal(ciclo("2026-10-07T00:00:00").estado, "dado_velho");
  // OSC: o arquivo de setembro lido em outubro está no esperado.
  const osc = avaliarRodada(job("osc"), ok(execucao(2, "2026-10-20T10:05:00Z", "2026-10-20T10:06:00Z", { ativas: 10400, versao_fonte: "20260906" })), depoisDe("2026-10-20T10:06:00Z", 1));
  assert.deepEqual([osc.estado, osc.dado.defasagem], ["em_dia", 1]);
  // O de agosto lido em outubro (o caso real de 09/10, com o Ipea atrasado) ainda é do esperado; o de julho, não.
  const agosto = avaliarRodada(job("osc"), ok(execucao(2, "2026-10-08T10:05:00Z", "2026-10-08T10:06:00Z", { ativas: 10400, versao_fonte: "20260818" })), depoisDe("2026-10-08T10:06:00Z", 1));
  assert.deepEqual([agosto.estado, agosto.dado.defasagem], ["em_dia", 2]);
  const julho = avaliarRodada(job("osc"), ok(execucao(2, "2026-10-08T10:05:00Z", "2026-10-08T10:06:00Z", { ativas: 10400, versao_fonte: "20260718" })), depoisDe("2026-10-08T10:06:00Z", 1));
  assert.equal(julho.estado, "dado_velho");
});

test("onda 11, B: as coletas assistidas mostram a data, sem esperado, e nunca ficam com dado velho", () => {
  const fim = "2026-09-21T04:07:07Z";
  const r = avaliarRodada(job("exigencia:suspensiva"), comDadoAte(execucao(2, fim, fim, { instrumentos: 288 }), "2026-08-01T12:00:00+00:00"), depoisDe(fim, 1));
  assert.deepEqual([r.estado, r.dado.situacao, r.dado.defasagem], ["em_dia", "sem_prazo", 51]);
  assert.equal(textoEsperado(r.dado.regra), "");
  assert.equal(textoFrescor(r.dado), "evento mais novo do retrato de 01/08/2026, 51 dias antes da rodada");
});

test("onda 11, B: os textos da defasagem", () => {
  assert.equal(textoUnidade(1, "dias_uteis"), "1 dia útil");
  assert.equal(textoUnidade(5, "dias_uteis"), "5 dias úteis");
  assert.equal(textoUnidade(1, "meses"), "1 mês");
  assert.equal(textoUnidade(2, "dias"), "2 dias");
  const regra = (unidade: "dias" | "dias_uteis" | "meses") => ({ rotulo: "x", limite: 1, unidade });
  assert.equal(textoDefasagem({ defasagem: 0, regra: regra("dias") }), "do mesmo dia da rodada");
  assert.equal(textoDefasagem({ defasagem: 0, regra: regra("meses") }), "do mesmo mês da rodada");
  assert.equal(textoDefasagem({ defasagem: 2, regra: regra("meses") }), "2 meses antes da rodada");
  assert.equal(textoDefasagem({ defasagem: null, regra: regra("dias") }), "");
  assert.equal(textoEsperado(regra("dias_uteis")), "esperado: até 1 dia útil");
  assert.equal(textoEsperado(null), "");
  assert.equal(textoFrescor({ situacao: "nao_lido", dia: null, defasagem: null, regra: regra("dias"), motivo: "falha" }), "");
});

// ================================================================ os municípios (12/10/2026, onda 12, C)

/**
 * O `periodo_por_fonte` que a execução 5 (09/10/2026) teria gravado: os anos de `mun_indicador`, agregados por fonte
 * pelo MCP em 12/10/2026, pela regra de `municipios/executar.py` (o mesmo caso de `test_os_formatos_reais_da_execucao_5`).
 */
const PERIODOS_EXECUCAO_5: Record<string, string> = {
  ana_ish: "2021",
  anatel: "2025-11",
  aps: "2026-07",
  atlas_desastres: "2025",
  caged: "2026-08",
  cnes: "2026-08",
  creche: "2025",
  ibge: "2026",
  inep_ideb: "2025",
  inep_tdi: "2025",
  ipeadata: "2010",
  mapbiomas: "2025",
  mds_misocial: "2026-09",
  pntp: "2025",
  ripsa_icsap: "2024",
  senatran_frota: "2026-08",
  sim_sinasc: "2024",
  sinesp: "2025",
  sinisa: "2024",
  tce_licitacoes: "2025",
};

/** As contagens de uma execução dos municípios com o `periodo_por_fonte` dado; `herdadas` levam a marca. */
const comPeriodos = (periodos: Record<string, unknown>, herdadas: string[] = [], avisos: Record<string, string[]> = {}) => ({
  linhas_por_fonte: { ibge: 2453, caged: 446 },
  avisos,
  periodo_por_fonte: Object.fromEntries(
    Object.entries(periodos).map(([fonte, periodo]) => [fonte, herdadas.includes(fonte) ? { periodo, herdada: true } : { periodo }]),
  ),
});
/** A rodada dos municípios que concluiu em `fim`, avaliada 1 h depois. */
const rodadaMun = (fim: string, contagens: Record<string, unknown>) => avaliarRodada(job("mun"), ok(execucao(6, fim, fim, contagens)), depoisDe(fim, 1));
/** O dia 5, 10h UTC do cron, mais as 5 h do atraso do GitHub. */
const DIA_5_NOVEMBRO = "2026-11-05T15:10:00Z";

test("onda 12, C: os municípios — a data do dado é a do Caged, e as outras fontes vão como detalhe", () => {
  // A execução 5 real, como se já gravasse o campo: 09/10/2026, com o Caged de agosto.
  const r = rodadaMun("2026-10-09T18:25:22Z", comPeriodos(PERIODOS_EXECUCAO_5));
  assert.deepEqual([r.estado, r.dado.situacao, r.dado.dia, r.dado.defasagem], ["em_dia", "no_prazo", "2026-08-01", 2]);
  assert.equal(r.dado.regra?.precisao, "mes");
  assert.equal(textoFrescor(r.dado), "Caged de 08/2026, 2 meses antes da rodada (esperado: até 3 meses)");
  assert.equal(r.dado.detalhe, "demais 19 fontes de 2010 (ipeadata) a 09/2026 (mds_misocial)");
  assert.equal(textoDiaDoDado(r.dado.dia, r.dado.regra?.precisao), "08/2026");
  // Os outros jobs continuam no dia, e sem detalhe.
  assert.equal(textoDiaDoDado("2026-10-02"), "02/10/2026");
  assert.equal(textoDiaDoDado(null, "mes"), "—");
  const fim = "2026-10-09T12:26:54Z";
  const fiscal = avaliarRodada(job("fiscal"), ok(execucao(27, fim, fim, { municipios: 223, cauc_data_pesquisa: "2026-10-02" })), depoisDe(fim, 1));
  assert.equal(fiscal.dado.regra?.precisao, "dia");
  assert.equal(fiscal.dado.detalhe ?? null, null);
  assert.equal(textoFrescor(fiscal.dado), "CAUC de 02/10/2026, 5 dias úteis antes da rodada (esperado: até 2 dias úteis)");
});

test("onda 12, C: o Caged na rodada do dia 5 — M-2 e M-3 no esperado, M-4 é dado velho", () => {
  const caged = (periodo: string, fim = DIA_5_NOVEMBRO) => rodadaMun(fim, comPeriodos({ ...PERIODOS_EXECUCAO_5, caged: periodo }));
  // O de setembro (o MTE publica no fim de outubro): o normal.
  assert.deepEqual([caged("2026-09").estado, caged("2026-09").dado.defasagem], ["em_dia", 2]);
  // O de agosto: o MTE atrasou a publicação para depois do dia 5. Ainda no esperado: nada a fazer até ele publicar.
  assert.deepEqual([caged("2026-08").estado, caged("2026-08").dado.defasagem], ["em_dia", 3]);
  // O de julho: duas publicações sem chegar ao job.
  const velho = caged("2026-07");
  assert.deepEqual([velho.estado, velho.dado.situacao, velho.dado.defasagem], ["dado_velho", "velho", 4]);
  assert.equal(textoFrescor(velho.dado), "Caged de 07/2026, 4 meses antes da rodada (esperado: até 3 meses)");
  // A virada do ano: a rodada de 05/01/2027 com o de novembro, e com o de setembro.
  assert.equal(caged("2026-11", "2027-01-05T15:10:00Z").dado.defasagem, 2);
  assert.equal(caged("2026-09", "2027-01-05T15:10:00Z").estado, "dado_velho");
});

test("onda 12, C: as fontes anuais e censitárias nunca deixam o dado velho", () => {
  // IDHM de 2010, ISH de 2021, Anatel mensal parada em 2024: só o Caged decide.
  const r = rodadaMun(DIA_5_NOVEMBRO, comPeriodos({ ...PERIODOS_EXECUCAO_5, caged: "2026-09", anatel: "2024-01", ipeadata: "2010", ana_ish: "2021" }));
  assert.deepEqual([r.estado, r.dado.situacao], ["em_dia", "no_prazo"]);
  assert.equal(r.dado.detalhe, "demais 19 fontes de 2010 (ipeadata) a 09/2026 (mds_misocial)");
  // Mesmo com todas as outras paradas há anos.
  const antigas = Object.fromEntries(Object.keys(PERIODOS_EXECUCAO_5).map((f) => [f, f === FONTE_CAGED ? "2026-09" : "2000"]));
  const s = rodadaMun(DIA_5_NOVEMBRO, comPeriodos(antigas));
  assert.equal(s.estado, "em_dia");
  assert.equal(s.dado.detalhe, "demais 19 fontes de 2000");
});

test("onda 12, C: o Caged herdado da rodada anterior diz isso no detalhe; a falha continua sendo aviso", () => {
  // O Caged falhou e foi repetido da anterior (o de agosto, na rodada de novembro): no esperado, com aviso pela falha.
  const r = rodadaMun(DIA_5_NOVEMBRO, comPeriodos({ ...PERIODOS_EXECUCAO_5, caged: "2026-08" }, ["caged", "pntp"], { caged: ["Caged: TimeoutError"] }));
  assert.deepEqual([r.estado, r.dado.situacao, r.dado.defasagem], ["com_aviso", "no_prazo", 3]);
  assert.deepEqual(r.avisos, ["fonte repetida da rodada anterior: caged"]);
  assert.equal(r.dado.detalhe, "Caged repetido da rodada anterior; demais 19 fontes de 2010 (ipeadata) a 09/2026 (mds_misocial); uma repetida da rodada anterior");
  // Falhou de novo em dezembro: o de agosto já tem 4 meses, e o dado velho vence o aviso.
  const dezembro = rodadaMun("2026-12-05T15:10:00Z", comPeriodos({ ...PERIODOS_EXECUCAO_5, caged: "2026-08" }, ["caged"], { caged: ["x"] }));
  assert.deepEqual([dezembro.estado, dezembro.dado.defasagem], ["dado_velho", 4]);
  assert.deepEqual(dezembro.avisos, ["fonte repetida da rodada anterior: caged"]);
});

test("onda 12, C: o Caged sem período (falhou sem herança) é 'não lido' na coluna, sem mudar o estado", () => {
  for (const caged of [null, "agosto", "2026-13", "2026", 202608]) {
    const r = rodadaMun(DIA_5_NOVEMBRO, comPeriodos({ ...PERIODOS_EXECUCAO_5, caged }));
    assert.deepEqual([r.estado, r.dado.situacao, r.dado.motivo], ["em_dia", "nao_lido", "sem_data"], String(caged));
    assert.equal(r.dado.detalhe, "demais 19 fontes de 2010 (ipeadata) a 09/2026 (mds_misocial)", "o detalhe continua");
  }
  // Sem a chave do Caged, e com o campo vazio.
  const semCaged = Object.fromEntries(Object.entries(PERIODOS_EXECUCAO_5).filter(([f]) => f !== FONTE_CAGED));
  assert.equal(rodadaMun(DIA_5_NOVEMBRO, comPeriodos(semCaged)).dado.motivo, "sem_data");
  const vazio = rodadaMun(DIA_5_NOVEMBRO, { linhas_por_fonte: { ibge: 1 }, avisos: {}, periodo_por_fonte: {} });
  assert.deepEqual([vazio.estado, vazio.dado.situacao, vazio.dado.detalhe], ["em_dia", "nao_lido", null]);
  // Outra fonte sem período entra no detalhe pelo nome.
  assert.equal(
    detalheMunicipios(comPeriodos({ caged: "2026-09", ipeadata: "2010", inep_tdi: null, mds_misocial: "2026-10" })),
    "demais 3 fontes de 2010 (ipeadata) a 10/2026 (mds_misocial); sem período: inep_tdi",
  );
  assert.equal(detalheMunicipios(comPeriodos({ caged: "2026-09", ipeadata: "2010" })), "a outra fonte é de 2010 (ipeadata)");
  assert.equal(detalheMunicipios(comPeriodos({ caged: "2026-09" })), null);
});

test("onda 12, C: a execução de antes do campo fica como hoje — 'não grava', sem erro e sem mudar o estado", () => {
  // As chaves reais das contagens da execução 5 (lidas pelo MCP em 12/10/2026), sem periodo_por_fonte.
  const real = { linhas_por_fonte: { ibge: 2453, caged: 446, mapbiomas: 892 }, indicadores_por_fonte: { caged: ["caged_saldo_12m"] }, indicadores: {}, grupos: 223, avisos: {} };
  const r = rodadaMun("2026-10-09T18:25:22Z", real);
  assert.deepEqual([r.estado, r.dado.situacao, r.dado.dia, r.dado.defasagem], ["em_dia", "nao_grava", null, null]);
  assert.equal(r.dado.regra?.rotulo, "Caged", "a regra existe; a execução é que não gravou");
  assert.equal(textoFrescor(r.dado), "");
  // O campo em outro formato também não quebra: "não grava".
  for (const estranho of [null, [], "2026-08", 7]) {
    assert.equal(rodadaMun("2026-10-09T18:25:22Z", { ...real, periodo_por_fonte: estranho }).dado.situacao, "nao_grava", JSON.stringify(estranho));
  }
});

test("onda 12, C: do periodo_por_fonte só passam nome de fonte e período; texto livre fica de fora", () => {
  const p = periodosPorFonte({
    periodo_por_fonte: {
      "Fonte com espaço": { periodo: "2026-08" },
      caged: { periodo: "<b>2026-08</b>", herdada: "sim" },
      ipeadata: { periodo: "2010", herdada: true, nota: "texto livre que não aparece" },
      sinisa: "2024",
      "<script>": { periodo: "2026" },
    },
  });
  assert.deepEqual(p, [
    { fonte: "caged", periodo: null, herdada: false },
    { fonte: "ipeadata", periodo: "2010", herdada: true },
    { fonte: "sinisa", periodo: null, herdada: false },
  ]);
  assert.equal(periodosPorFonte({}), null);
  assert.equal(periodosPorFonte({ periodo_por_fonte: [] }), null);
  assert.equal(textoPeriodo("2026-09"), "09/2026");
  assert.equal(textoPeriodo("2010"), "2010");
  const detalhe = detalheMunicipios({ periodo_por_fonte: { caged: { periodo: "2026-08" }, ipeadata: { periodo: "2010", nota: "<b>x</b>" }, "Outra Fonte": { periodo: "2026" } } });
  assert.equal(detalhe, "a outra fonte é de 2010 (ipeadata)");
});

const ECONOMIA_PY = path.join(import.meta.dirname, "..", "..", "..", "..", "municipios", "economia.py");

test("onda 12, C: FONTE_CAGED é o nome que o job dá à leitura do Caged", { skip: !fs.existsSync(ECONOMIA_PY) }, () => {
  assert.match(fs.readFileSync(ECONOMIA_PY, "utf-8"), new RegExp(`\\bLeitura\\("${FONTE_CAGED}"\\)`));
});

// ================================================================ o link do GitHub (12/10/2026, onda 12, C, M6)

test("onda 12, C: só o endereço do próprio GitHub vira link", async () => {
  const bom = `https://github.com/${REPOSITORIO}/actions/runs/1`;
  assert.equal(urlDoGithub(bom), bom);
  for (const ruim of [
    "javascript:alert(1)",
    "http://github.com/x/y",
    "https://github.com.exemplo.net/x",
    "https://exemplo.net/https://github.com/",
    "//github.com/x",
    "https://github.com",
    " https://github.com/x",
    "",
    null,
    42,
  ]) {
    assert.equal(urlDoGithub(ruim), null, String(ruim));
  }
  // Na leitura: a execução continua com os outros campos, sem o link.
  const { buscar } = buscarFalso({ status: 200, corpo: { workflow_runs: [{ ...RUN, html_url: "javascript:alert(1)" }] } });
  const r = await ultimaNoGithub("tok", "fiscal.yml", buscar);
  assert.deepEqual([r.estado, r.conclusao, r.url], ["ok", "success", null]);
});

// ================================================================ pedidos do supervisor, revisão D (12/10/2026, onda 12, C)

/** Uma rodada do fiscal que concluiu em `fim`, avaliada 1 h depois. */
const rodadaFiscal = (fim: string, contagens: Record<string, unknown>) =>
  avaliarRodada(job("fiscal"), ok(execucao(31, fim, fim, { municipios: 223, fontes_com_erro: {}, ...contagens })), depoisDe(fim, 1));
/** 13/10/2026, terça, às 09h30 em Brasília: a rodada do dia seguinte ao feriado de 12/10. */
const DIA_13 = "2026-10-13T12:30:00Z";
const DIA_14 = "2026-10-14T12:30:00Z";

test("onda 12, C (M1 da revisão D): o CAUC conta os dias úteis do fiscal, com o feriado de 12/10", () => {
  // 13/10: o CAUC de 09/10 (sexta), e o fiscal conta 1 (o 12/10 não é útil). No prazo.
  const treze = rodadaFiscal(DIA_13, { cauc_data_pesquisa: "2026-10-09", cauc_dias_uteis: 1 });
  assert.deepEqual([treze.estado, treze.dado.situacao, treze.dado.defasagem], ["em_dia", "no_prazo", 1]);
  assert.equal(textoFrescor(treze.dado), "CAUC de 09/10/2026, 1 dia útil antes da rodada (esperado: até 2 dias úteis)");
  // Sem o campo (as rodadas de antes da regra 2026-10-10.1), a conta daqui: o 12/10 entra como útil.
  assert.equal(rodadaFiscal(DIA_13, { cauc_data_pesquisa: "2026-10-09" }).dado.defasagem, 2);
  // 14/10: o caso do M1. O fiscal conta 2, sem aviso; a conta daqui daria 3, "dado velho" na tela e no e-mail.
  const quatorze = rodadaFiscal(DIA_14, { cauc_data_pesquisa: "2026-10-09", cauc_dias_uteis: 2 });
  assert.deepEqual([quatorze.estado, quatorze.dado.defasagem], ["em_dia", 2]);
  assert.deepEqual([rodadaFiscal(DIA_14, { cauc_data_pesquisa: "2026-10-09" }).estado, rodadaFiscal(DIA_14, { cauc_data_pesquisa: "2026-10-09" }).dado.defasagem], ["dado_velho", 3]);
  // 15/10: o fiscal conta 3, o dia em que ele avisa e marca G7 "desatualizado". Aqui, "dado velho" no mesmo dia.
  assert.equal(rodadaFiscal("2026-10-15T12:30:00Z", { cauc_data_pesquisa: "2026-10-09", cauc_dias_uteis: 3 }).estado, "dado_velho");
  // Só o número inteiro de 0 em diante vale; o resto cai na conta daqui (2 em 13/10).
  for (const ruim of ["1", -1, 1.5, null, Number.NaN]) {
    assert.equal(rodadaFiscal(DIA_13, { cauc_data_pesquisa: "2026-10-09", cauc_dias_uteis: ruim }).dado.defasagem, 2, String(ruim));
  }
  // O `cauc_aviso`, texto do job, não é lido: não chega à linha.
  const comAviso = rodadaFiscal("2026-10-15T12:30:00Z", { cauc_data_pesquisa: "2026-10-09", cauc_dias_uteis: 3, cauc_aviso: "texto do job que não aparece" });
  assert.equal(JSON.stringify(comAviso).includes("texto do job"), false);
  assert.deepEqual(comAviso.avisos, []);
});

test("onda 12, C (M3 da revisão D): a data do dado depois do dia da rodada é 'não lido', nunca 'no prazo'", () => {
  // A posição do CAUC com o ano errado: o fiscal contaria 0 dia útil. Aqui, "não lido", e o estado não muda.
  const anoErrado = rodadaFiscal(DIA_13, { cauc_data_pesquisa: "2027-10-09", cauc_dias_uteis: 0 });
  assert.deepEqual([anoErrado.estado, anoErrado.dado.situacao, anoErrado.dado.motivo, anoErrado.dado.dia], ["em_dia", "nao_lido", "sem_data", null]);
  assert.equal(textoFrescor(anoErrado.dado), "");
  // O dia seguinte já é futuro; o mesmo dia, ainda que mais tarde, é o dado do dia.
  assert.equal(rodadaFiscal(DIA_13, { cauc_data_pesquisa: "2026-10-14" }).dado.motivo, "sem_data");
  assert.deepEqual([rodadaFiscal(DIA_13, { cauc_data_pesquisa: "2026-10-13" }).dado.situacao, rodadaFiscal(DIA_13, { cauc_data_pesquisa: "2026-10-13" }).dado.defasagem], ["no_prazo", 0]);
  // Na coluna `dado_ate`: o arquivo do Transferegov carimbado em 14/10 (Brasília) lido pela rodada de 13/10.
  const radar = execucao(50, "2026-10-13T11:49:06Z", "2026-10-13T11:49:12Z", { janelas_abertas: 3245 });
  const futuro = avaliarRodada(job("radar"), comDadoAte(radar, "2026-10-15T01:34:18+00:00"), depoisDe("2026-10-13T11:49:12Z", 1));
  assert.deepEqual([futuro.estado, futuro.dado.situacao, futuro.dado.motivo], ["em_dia", "nao_lido", "sem_data"]);
  // O carimbo das 22h34 de 13/10 em Brasília (01h34 UTC de 14/10) é do mesmo dia da rodada: não é futuro.
  assert.equal(avaliarRodada(job("radar"), comDadoAte(radar, "2026-10-14T01:34:18+00:00"), depoisDe("2026-10-13T11:49:12Z", 1)).dado.situacao, "no_prazo");
  // O mês do Caged depois do mês da rodada também.
  assert.equal(rodadaMun("2026-10-09T18:25:22Z", comPeriodos({ ...PERIODOS_EXECUCAO_5, caged: "2026-11" })).dado.motivo, "sem_data");
  // As coletas assistidas, sem esperado, idem: a data errada não aparece como data.
  const fim = "2026-09-21T04:07:07Z";
  assert.equal(avaliarRodada(job("exigencia:suspensiva"), comDadoAte(execucao(2, fim, fim, {}), "2027-01-01T12:00:00+00:00"), depoisDe(fim, 1)).dado.situacao, "nao_lido");
});

test("onda 12, C: o SIOPE incompleto deixa o fiscal 'com aviso'; ausente ou 0, nada muda", () => {
  const cauc = { cauc_data_pesquisa: "2026-10-13", cauc_dias_uteis: 0 };
  for (const [caso, extra] of [
    ["ausente", {}],
    ["zero", { siope_incompletos: 0 }],
    ["texto, não número", { siope_incompletos: "37" }],
  ] as const) {
    const r = rodadaFiscal(DIA_13, { ...cauc, ...extra });
    assert.deepEqual([r.estado, r.avisos, r.falhas], ["em_dia", [], 0], caso);
  }
  const r = rodadaFiscal(DIA_13, { ...cauc, siope_incompletos: 37 });
  assert.deepEqual([r.estado, r.avisos, r.falhas], ["com_aviso", ["SIOPE incompleto em 37 municípios"], 0]);
  assert.deepEqual(contar("fiscal", { municipios: 223, fontes_com_erro: {}, siope_incompletos: 1 }).avisos, ["SIOPE incompleto em 1 município"]);
  // Junto das fontes com erro, depois delas.
  assert.deepEqual(contar("fiscal", { municipios: 223, fontes_com_erro: { siconfi_rreo1: 1 }, siope_incompletos: 37 }).avisos, [
    "fonte com erro: siconfi_rreo1",
    "SIOPE incompleto em 37 municípios",
  ]);
  // O dado velho vence o aviso, e o aviso continua listado.
  const velho = rodadaFiscal(DIA_14, { cauc_data_pesquisa: "2026-10-08", cauc_dias_uteis: 3, siope_incompletos: 37 });
  assert.deepEqual([velho.estado, velho.avisos], ["dado_velho", ["SIOPE incompleto em 37 municípios"]]);
});

// ================================================================ as emendas parlamentares (onda 14, integração, 12/10/2026)

/** Uma rodada das emendas que concluiu em `fim`, com o `dado_ate` dado, avaliada 1 h depois; o FNS coletado inteiro. */
const rodadaEmd = (fim: string, dadoAte: string | null, contagens: Record<string, unknown> = {}) =>
  avaliarRodada(
    job("emd"),
    comDadoAte(
      execucao(1, fim, fim, { emd_catalogo_codigos: 4321, emd_fns_origem: "coletado", emd_fns_erro: null, emd_fns_detalhes_pendentes: 0, ...contagens }),
      dadoAte,
    ),
    depoisDe(fim, 1),
  );
/** Terça, 13/10/2026: o cron das 09h15 UTC mais o atraso do GitHub (11h20 em Brasília). */
const TERCA_13 = "2026-10-13T14:20:00Z";
/** O zip de sábado, 10/10/2026, às 02h57 UTC: sexta, 09/10, às 23h57 em Brasília (o HEAD de 12/10/2026). */
const ZIP_SABADO = "2026-10-10T02:57:00+00:00";

test("onda 14, integração: emendas — o zip de até 5 dias está no prazo; o de 6 é dado velho", () => {
  const r = rodadaEmd(TERCA_13, ZIP_SABADO);
  assert.deepEqual([r.estado, r.dado.situacao, r.dado.dia, r.dado.defasagem], ["em_dia", "no_prazo", "2026-10-09", 4]);
  assert.equal(textoFrescor(r.dado), "arquivo de emendas do Portal de 09/10/2026, 4 dias antes da rodada (esperado: até 5 dias)");
  assert.deepEqual([r.linhas, r.falhas, r.avisos], [4321, 0, []]);
  // Um dia a mais (o zip da madrugada de sexta, quinta à noite em Brasília): 5 dias, ainda no prazo.
  const cinco = rodadaEmd(TERCA_13, "2026-10-09T02:57:00+00:00");
  assert.deepEqual([cinco.estado, cinco.dado.situacao, cinco.dado.defasagem], ["em_dia", "no_prazo", 5]);
  // Dois dias a mais (quarta à noite em Brasília): dado velho, com a rodada em dia.
  const velho = rodadaEmd(TERCA_13, "2026-10-08T02:57:00+00:00");
  assert.deepEqual([velho.estado, velho.dado.situacao, velho.dado.defasagem], ["dado_velho", "velho", 6]);
  assert.equal(textoFrescor(velho.dado), "arquivo de emendas do Portal de 07/10/2026, 6 dias antes da rodada (esperado: até 5 dias)");
  // A semana normal: o zip da madrugada de terça (segunda à noite em Brasília), 1 dia.
  assert.equal(rodadaEmd("2026-10-20T14:20:00Z", "2026-10-20T02:57:00+00:00").dado.defasagem, 1);
  // A semana em que o zip não muda: a rodada relê o `dado_ate` da anterior, e o Portal parado aparece.
  const parado = rodadaEmd("2026-10-20T14:20:00Z", ZIP_SABADO);
  assert.deepEqual([parado.estado, parado.dado.defasagem], ["dado_velho", 11]);
  // A cadência é a do `emendas.yml`: toda terça, e atrasada depois de 7 dias e 9 h (o tempo-limite de 3 h do workflow).
  assert.equal(descreverCron(job("emd").cron ?? ""), "toda terça, 09h15 UTC");
  assert.equal(FOLGA_EMENDAS_H, 9);
  assert.equal(prazoH(job("emd")), 7 * 24 + FOLGA_EMENDAS_H);
  const semana = (horas: number) =>
    avaliarRodada(job("emd"), comDadoAte(execucao(1, TERCA_13, TERCA_13, { emd_catalogo_codigos: 4321 }), ZIP_SABADO), depoisDe(TERCA_13, horas)).estado;
  assert.deepEqual([semana(7 * 24 + FOLGA_EMENDAS_H), semana(7 * 24 + FOLGA_EMENDAS_H + 1 / 60)], ["em_dia", "atrasada"]);
});

test("onda 14, integração: emendas — o FNS parcial ou da rodada anterior vira aviso", () => {
  const parcial = rodadaEmd(TERCA_13, ZIP_SABADO, { emd_fns_origem: "parcial" });
  assert.deepEqual([parcial.estado, parcial.avisos, parcial.falhas], ["com_aviso", ["o FNS desta rodada veio pela metade"], 0]);
  const anterior = rodadaEmd(TERCA_13, ZIP_SABADO, { emd_fns_origem: "anterior" });
  assert.deepEqual([anterior.estado, anterior.avisos, anterior.falhas], ["com_aviso", ["o FNS desta rodada é o da rodada anterior"], 0]);
  // Coletado, ausente ou outro texto: nada.
  for (const origem of ["coletado", undefined, null, "outra coisa"]) {
    const r = rodadaEmd(TERCA_13, ZIP_SABADO, { emd_fns_origem: origem });
    assert.deepEqual([r.estado, r.avisos], ["em_dia", []], String(origem));
  }
});

test("onda 14, integração: emendas — os detalhes pendentes do FNS viram aviso, com o plural certo", () => {
  const pendentes = (x: unknown) => contar("emd", { emd_catalogo_codigos: 4321, emd_fns_origem: "coletado", emd_fns_detalhes_pendentes: x }).avisos;
  assert.deepEqual(pendentes(1), ["1 proposta do FNS ficou sem o detalhe, para a próxima rodada"]);
  assert.deepEqual(pendentes(2), ["2 propostas do FNS ficaram sem o detalhe, para a próxima rodada"]);
  assert.deepEqual(pendentes(1234), ["1.234 propostas do FNS ficaram sem o detalhe, para a próxima rodada"]);
  // Zero, ausente, negativo ou texto: nada.
  for (const x of [0, undefined, null, -1, "12"]) assert.deepEqual(pendentes(x), [], String(x));
  // Na linha: "com aviso", sem falha.
  const r = rodadaEmd(TERCA_13, ZIP_SABADO, { emd_fns_detalhes_pendentes: 2500 });
  assert.deepEqual([r.estado, r.falhas, r.avisos], ["com_aviso", 0, ["2.500 propostas do FNS ficaram sem o detalhe, para a próxima rodada"]]);
});

test("onda 14, integração: emendas — o erro do FNS é 1 falha, e o texto do erro não chega à linha", () => {
  const erro = "ReadTimeout: texto do job que não aparece";
  const r = rodadaEmd(TERCA_13, ZIP_SABADO, { emd_fns_erro: erro });
  assert.deepEqual([r.estado, r.falhas, r.avisos], ["com_aviso", 1, []]);
  assert.equal(JSON.stringify(r).includes("texto do job"), false);
  // Sem erro (null, vazio, ausente ou não texto): 0.
  for (const x of [null, "", undefined, true, 1]) assert.equal(contar("emd", { emd_fns_erro: x }).falhas, 0, String(x));
  // O FNS que parou no meio, como o job grava: parcial, com o erro e o que ficou para depois, na ordem do job.
  const meio = rodadaEmd(TERCA_13, ZIP_SABADO, { emd_fns_origem: "parcial", emd_fns_erro: erro, emd_fns_detalhes_pendentes: 1 });
  assert.deepEqual(
    [meio.estado, meio.falhas, meio.avisos],
    ["com_aviso", 1, ["o FNS desta rodada veio pela metade", "1 proposta do FNS ficou sem o detalhe, para a próxima rodada"]],
  );
  // O dado velho vence o aviso, e os avisos continuam listados.
  const velho = rodadaEmd(TERCA_13, "2026-10-08T02:57:00+00:00", { emd_fns_origem: "anterior", emd_fns_erro: erro });
  assert.deepEqual([velho.estado, velho.falhas, velho.avisos], ["dado_velho", 1, ["o FNS desta rodada é o da rodada anterior"]]);
  // Sem o catálogo nas contagens: sem número de linhas.
  assert.equal(contar("emd", {}).linhas, null);
});

test("onda 14, integração: emendas antes da primeira rodada — atrasada, também enquanto a primeira grava ou depois de um erro", () => {
  const nunca = avaliarRodada(job("emd"), EMD_SEM_EXECUCAO, AGORA);
  assert.deepEqual([nunca.estado, nunca.concluidaEm, nunca.dado.situacao, nunca.avisos], ["atrasada", null, "sem_execucao", []]);
  // A primeira gravando há 1 h: em curso, e ainda atrasada (nenhuma concluída).
  const gravando = avaliarRodada(job("emd"), { ...EMD_SEM_EXECUCAO, abertas: [aberta("gravando", 1)] }, AGORA);
  assert.deepEqual([gravando.estado, gravando.gravando?.parada], ["atrasada", false]);
  // A primeira terminou em erro (o Portal barrou, por exemplo): atrasada, com o aviso do erro.
  const erro = avaliarRodada(job("emd"), { ...EMD_SEM_EXECUCAO, abertas: [aberta("erro", 3)] }, AGORA);
  assert.deepEqual([erro.estado, erro.avisos], ["atrasada", ["a tentativa de 09/10/2026 às 15:00 terminou em erro"]]);
});

// ================================================================ as emendas estaduais (E1, 16/10/2026)

/** Os anos como o `emendas_pb/montar.py` grava em `epb_anos` (a rodada real de 16/10/2026, só as chaves lidas aqui). */
const EPB_ANOS = {
  "2021": { emendas: 251, empenho_sem_catalogo: 0, municipio_sem_ibge: 0 },
  "2022": { emendas: 395, empenho_sem_catalogo: 0, municipio_sem_ibge: 0 },
  "2023": { emendas: 515, empenho_sem_catalogo: 0, municipio_sem_ibge: 0 },
  "2024": { emendas: 823, empenho_sem_catalogo: 0, municipio_sem_ibge: 0 },
  "2025": { emendas: 828, empenho_sem_catalogo: 0, municipio_sem_ibge: 0 },
  "2026": { emendas: 680, empenho_sem_catalogo: 0, municipio_sem_ibge: 0 },
};
/** Terça, 13/10/2026: o cron das 13h00 UTC mais o atraso do GitHub. */
const TERCA_EPB = "2026-10-13T17:40:00Z";

test("E1 das emendas estaduais: a linha soma as emendas dos anos e avisa o que ficou fora da semente", () => {
  assert.deepEqual(contar("epb", { epb_anos: EPB_ANOS, epb_autor_sem_pessoa: {} }), { linhas: 3492, falhas: null, avisos: [] });
  const avisos = (anos: Record<string, unknown>, semPessoa: Record<string, number>) =>
    contar("epb", { epb_anos: anos, epb_autor_sem_pessoa: semPessoa }).avisos;
  assert.deepEqual(avisos({ "2025": { emendas: 828, empenho_sem_catalogo: 1, municipio_sem_ibge: 0 } }, { "ficha:NOVO": 3 }), [
    "1 grafia de autor fora da semente",
    "1 emenda empenhada sem linha no catálogo",
  ]);
  assert.deepEqual(
    avisos(
      { "2025": { emendas: 828, empenho_sem_catalogo: 2, municipio_sem_ibge: 1 }, "2026": { emendas: 680, municipio_sem_ibge: 2 } },
      { "ficha:NOVO": 3, "catalogo:NOVO NOME": 1 },
    ),
    ["2 grafias de autor fora da semente", "2 emendas empenhadas sem linha no catálogo", "3 destinos sem o IBGE do município"],
  );
  // Sem os anos, ou com formato estranho: sem número e sem aviso, sem quebrar.
  for (const c of [{}, { epb_anos: null }, { epb_anos: [] }, { epb_anos: { "2025": "x" } }, { epb_anos: { "2025": { emendas: "828" } } }]) {
    assert.deepEqual(contar("epb", c), { linhas: null, falhas: null, avisos: [] }, JSON.stringify(c));
  }
});

test("E1 das emendas estaduais: a cadência do runner próprio, com a folga da máquina desligada", () => {
  assert.equal(descreverCron(job("epb").cron ?? ""), "toda terça, 13h00 UTC");
  assert.equal(FOLGA_EMENDAS_PB_H, 30);
  assert.equal(prazoH(job("epb")), 7 * 24 + 30);
  const r = avaliarRodada(job("epb"), comDadoAte(execucao(1, TERCA_EPB, TERCA_EPB, { epb_anos: EPB_ANOS }), TERCA_EPB), depoisDe(TERCA_EPB, 1));
  assert.deepEqual([r.estado, r.dado.situacao, r.dado.defasagem, r.linhas], ["em_dia", "no_prazo", 0, 3492]);
  assert.equal(r.job.nome, "Emendas estaduais (PB)");
  // A máquina desligada na terça seguinte: o job espera na fila até 24 h; só depois disso a rodada está atrasada.
  const semana = (horas: number) =>
    avaliarRodada(job("epb"), comDadoAte(execucao(1, TERCA_EPB, TERCA_EPB, { epb_anos: EPB_ANOS }), TERCA_EPB), depoisDe(TERCA_EPB, horas)).estado;
  assert.deepEqual([semana(7 * 24 + 30), semana(7 * 24 + 30 + 1 / 60)], ["em_dia", "atrasada"]);
  // Antes da oport_41: "não lido"; com ela e sem rodada: atrasada, como as emendas federais.
  assert.equal(avaliarRodada(job("epb"), { estado: "nao_lido", motivo: "ausente" }, AGORA).estado, "nao_lido");
  assert.equal(avaliarRodada(job("epb"), EMD_SEM_EXECUCAO, AGORA).estado, "atrasada");
});

// ================================================================ as emendas de João Pessoa (J1, 16/10/2026)

/** As contagens como o `emendas_jp/executar.py` grava (a rodada local de 16/10/2026, só as chaves lidas aqui). */
const EJP = { ejp_painel: { linhas: 416, cnpj_invalido: 10 }, ejp_sem_pessoa: {}, ejp_apps_script_mudou: false, ejp_tce: { "2026": { arquivo: true } } };
/** 16/10/2026: o cron das 12h30 UTC mais o atraso do GitHub. */
const DIA_EJP = "2026-10-16T17:10:00Z";

test("J1 das emendas de João Pessoa: a linha conta as linhas do painel e só avisa o que pede ação nossa", () => {
  assert.deepEqual(contar("ejp", EJP), { linhas: 416, falhas: null, avisos: [] });
  assert.deepEqual(
    contar("ejp", { ...EJP, ejp_sem_pessoa: { "NOVA GRAFIA": 2 }, ejp_apps_script_mudou: true, ejp_tce: { "2026": { arquivo: false } } }).avisos,
    [
      "1 grafia de autor fora da semente",
      "a Prefeitura reimplantou o painel (URL do Apps Script nova): conferir os campos",
      "o TCE-PB ainda não tem o arquivo de despesas de 2026",
    ],
  );
  // O CNPJ com dígito errado no objeto é da fonte: fica nas contagens, sem acender a linha.
  for (const c of [{}, { ejp_painel: null }, { ejp_painel: { linhas: "416" } }, { ejp_tce: [] }]) {
    assert.deepEqual(contar("ejp", c), { linhas: null, falhas: null, avisos: [] }, JSON.stringify(c));
  }
});

test("J1 das emendas de João Pessoa: diária no runner próprio, com a folga da máquina desligada", () => {
  assert.equal(descreverCron(job("ejp").cron ?? ""), "todo dia, 12h30 UTC");
  assert.equal(FOLGA_EMENDAS_JP_H, 30);
  assert.equal(prazoH(job("ejp")), 24 + 30);
  const rodada = (horas: number) => avaliarRodada(job("ejp"), comDadoAte(execucao(1, DIA_EJP, DIA_EJP, EJP), DIA_EJP), depoisDe(DIA_EJP, horas));
  const r = rodada(1);
  assert.deepEqual([r.estado, r.dado.situacao, r.linhas, r.job.nome], ["em_dia", "no_prazo", 416, "Emendas de João Pessoa"]);
  assert.deepEqual([rodada(24 + 30).estado, rodada(24 + 30 + 1 / 60).estado], ["em_dia", "atrasada"]);
  assert.equal(avaliarRodada(job("ejp"), { estado: "nao_lido", motivo: "ausente" }, AGORA).estado, "nao_lido");
});

// ================================================================ a tabela que ainda não existe (onda 14, integração, 12/10/2026)

/** A resposta do PostgREST para a tabela que não existe (a `emd_execucao` antes da oport_39). */
const semTabela = (code: string): RespostaConsulta => ({
  data: null,
  error: { code, message: "Could not find the table 'public.emd_execucao' in the schema cache" },
});
const vazia: RespostaConsulta = { data: [], error: null };

test("onda 14, integração: a tabela que não existe (42P01, PGRST205) é 'não lido' ausente; outro erro, falha", () => {
  for (const code of ["PGRST205", "42P01"]) {
    assert.deepEqual(leituraDasConsultas(semTabela(code), semTabela(code), { estado: "falha" }), { estado: "nao_lido", motivo: "ausente" }, code);
    // Basta uma das duas consultas.
    assert.deepEqual(leituraDasConsultas(vazia, semTabela(code)), { estado: "nao_lido", motivo: "ausente" }, code);
    assert.deepEqual(leituraDasConsultas(semTabela(code), vazia), { estado: "nao_lido", motivo: "ausente" }, code);
  }
  // O tempo-limite do Postgres, a permissão negada, o erro sem código: "falha".
  for (const code of ["57014", "42501", null, undefined]) {
    assert.deepEqual(leituraDasConsultas({ data: null, error: { code, message: "x" } }, vazia), { estado: "nao_lido", motivo: "falha" }, String(code));
  }
  // A tabela criada e ainda sem linha: "ok", sem execução (a mesma leitura do "estado de hoje").
  assert.deepEqual(leituraDasConsultas(vazia, vazia, { estado: "ok", id: null, dadoAte: null }), EMD_SEM_EXECUCAO);
  // Com linhas: a primeira concluída e as abertas como vieram.
  const e = concluida(2, { emd_catalogo_codigos: 4321 });
  const a = aberta("gravando", 1);
  assert.deepEqual(leituraDasConsultas({ data: [e], error: null }, { data: [a], error: null }), { estado: "ok", ultima: e, abertas: [a], dadoAte: undefined });
  assert.deepEqual(leituraDasConsultas({ data: null, error: null }, { data: null, error: null }), { estado: "ok", ultima: null, abertas: [], dadoAte: undefined });
});

test("onda 14, integração: sem a emd_execucao, só a linha das emendas fica 'não lido', e a tela segue com as outras 18", () => {
  const ausente = leituraDasConsultas(semTabela("PGRST205"), semTabela("PGRST205"), { estado: "falha" });
  const linhas = JOBS_RODADAS.map((j) => avaliarRodada(j, j.id === "emd" ? ausente : ok(concluida(1)), AGORA));
  assert.deepEqual(contarEstados(linhas), { em_dia: 18, atrasada: 0, dado_velho: 0, com_aviso: 0, nao_lido: 1 });
  const emd = linhas.find((l) => l.job.id === "emd");
  assert.deepEqual([emd?.estado, emd?.motivoNaoLido, emd?.dado.situacao, emd?.linhas, emd?.avisos], ["nao_lido", "ausente", "sem_execucao", null, []]);
});

const LEITURA_SERVIDOR = path.join(import.meta.dirname, "rodadas.server.ts");

test("onda 14, integração: rodadas.server.ts lê pela leituraDasConsultas e não registra a tabela ausente como erro", () => {
  const fonte = fs.readFileSync(LEITURA_SERVIDOR, "utf-8");
  assert.match(fonte, /const leitura = leituraDasConsultas\(c, a, dadoAte\);/);
  // Só a "falha" vai ao log; a regra do "ausente" não é repetida no servidor.
  assert.match(fonte, /if \(leitura\.estado === "nao_lido" && leitura\.motivo === "falha"\) console\.error/);
  // A consulta do `dado_ate` da tabela ausente também não vai ao log (a principal já diz "não lido").
  assert.match(fonte, /if \(!ehEsquemaAusente\(error\.code\)\) console\.error\(`rodadas \(\$\{job\.id\}, dado_ate\):`/);
  // A leitura sai de JOBS_RODADAS, sem lista fixa de tabelas.
  assert.match(fonte, /JOBS_RODADAS\.map\(\(j\): Promise<LeituraRodada> =>/);
  assert.equal(/"[a-z]+_execucao"/.test(fonte), false, "nenhuma tabela escrita à mão no servidor");
});
