import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REPOSITORIO, WORKFLOWS } from "./agendamento.ts";
import {
  ATRASO_GITHUB_H,
  FOLGA_PADRAO_H,
  INTERVALO_H,
  JOBS_RODADAS,
  LIMITE_GRAVANDO_H,
  MARCA_ESTADO,
  ROTULO_ESTADO,
  WORKFLOWS_DAS_RODADAS,
  avaliarRodada,
  cadenciaDoCron,
  contarEstados,
  cronDoWorkflow,
  dataHoraBrasilia,
  descreverCron,
  githubPedeAtencao,
  haQuanto,
  horaBrasilia,
  prazoH,
  rotuloEvento,
  rotuloGithub,
  textoPrazo,
  ultimaNoGithub,
  urlExecucoesGithub,
  type ExecucaoAberta,
  type ExecucaoConcluida,
  type JobRodada,
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
  assert.deepEqual(contarEstados(linhas), { em_dia: 1, atrasada: 1, com_aviso: 0, nao_lido: 1 });
});

test("onda 9, C: estado com palavra e marca, não só cor", () => {
  assert.deepEqual(ROTULO_ESTADO, { em_dia: "em dia", atrasada: "atrasada", com_aviso: "com aviso", nao_lido: "não lido" });
  assert.equal(new Set(Object.values(MARCA_ESTADO)).size, 4, "uma marca diferente para cada estado");
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
