import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REPOSITORIO, WORKFLOWS } from "./agendamento.ts";
import {
  ATRASO_GITHUB_H,
  DEFASAGEM_API_ESPECIAIS_DIAS,
  DEFASAGEM_CAUC_DIAS_UTEIS,
  DEFASAGEM_CONSULTA_DIAS,
  DEFASAGEM_OSC_MESES,
  DEFASAGEM_PIX_DIAS_UTEIS,
  DEFASAGEM_TCE_PB_DIAS,
  DEFASAGEM_TRANSFEREGOV_DIAS,
  DIAS_ANO_CORRENTE_TCE_PB,
  ESTADOS,
  FOLGA_PADRAO_H,
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
  diaDoDado,
  githubPedeAtencao,
  haQuanto,
  horaBrasilia,
  prazoH,
  rotuloEvento,
  rotuloGithub,
  textoDefasagem,
  textoEsperado,
  textoFrescor,
  textoPrazo,
  textoUnidade,
  ultimaNoGithub,
  urlExecucoesGithub,
  type ExecucaoAberta,
  type ExecucaoConcluida,
  type JobRodada,
  type LeituraDadoAte,
  type LeituraRodada,
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

test("onda 9, C: os 14 jobs, com as 12 tabelas conferidas no banco em 09/10/2026", () => {
  assert.equal(JOBS_RODADAS.length, 14);
  assert.equal(new Set(JOBS_RODADAS.map((j) => j.id)).size, JOBS_RODADAS.length, "ids únicos");
  assert.deepEqual([...new Set(JOBS_RODADAS.map((j) => j.tabela))].sort(), [
    "al_execucao",
    "exigencia_execucao",
    "fiscal_execucao",
    "mun_execucao",
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
  assert.equal(prazoH(job("radar")), 24 + FOLGA_PADRAO_H);
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
    mun: null,
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
  // As 9 linhas da coluna fazem as 9 consultas a mais de `rodadas.server.ts` (28 + 9 = 37).
  assert.equal(JOBS_RODADAS.filter((j) => j.dado?.origem === "coluna").length, 9);
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
    },
    {
      DEFASAGEM_TRANSFEREGOV_DIAS: 2,
      DEFASAGEM_CAUC_DIAS_UTEIS: 2,
      DEFASAGEM_PIX_DIAS_UTEIS: 2,
      DEFASAGEM_API_ESPECIAIS_DIAS: 1,
      DEFASAGEM_TCE_PB_DIAS: 8,
      DEFASAGEM_CONSULTA_DIAS: 1,
      DEFASAGEM_OSC_MESES: 2,
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

test("onda 11, B: o estado de hoje, com as 14 últimas concluídas lidas pelo MCP em 09/10/2026", () => {
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
    mun: "em_dia · nao_grava — —",
    // O arquivo de agosto (versão 20260806) lido em outubro: o de setembro não tinha saído em 07/10/2026. Com a
    // defasagem de 2 meses (integração da onda 11), é o Ipea atrasado, e não dado velho.
    osc: "em_dia · no_prazo 2026-08-06 2",
    "al:prestacao": "em_dia · sem_prazo 2026-10-01 0",
    "al:obras": "em_dia · sem_prazo 2026-10-01 1",
    "exigencia:suspensiva": "em_dia · sem_prazo 2026-09-16 5",
    "exigencia:assinatura": "em_dia · sem_prazo 2026-09-28 0",
  });
  assert.deepEqual(contarEstados(linhas), { em_dia: 13, atrasada: 0, dado_velho: 1, com_aviso: 0, nao_lido: 0 });
  assert.equal(textoFrescor(linhas.find((l) => l.job.id === "osc")?.dado ?? linhas[0].dado), "arquivo do Ipea de 06/08/2026, 2 meses antes da rodada (esperado: até 2 meses)");
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
  // Os municípios não gravam a data do dado da rodada: nunca "dado velho", nunca "não lido".
  assert.equal(avaliarRodada(job("mun"), ok(execucao(5, "2026-10-09T18:25:14Z", "2026-10-09T18:25:22Z", {})), agora).dado.situacao, "nao_grava");
  assert.equal(avaliarDado(job("mun"), null, null).situacao, "nao_grava");
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
