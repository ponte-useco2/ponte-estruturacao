/**
 * Disparo diário dos workflows do monorepo pela API do GitHub.
 *
 * Por que existe: desde 29/08/2026 o agendador do GitHub cria as execuções agendadas de 4 a 5 horas
 * depois do cron, em qualquer minuto (medido em 18/09: fiscal das 12h00 às 16h34–16h39, radar das
 * 12h45 às 17h15). O cron da Vercel, no plano atual, dispara dentro da hora marcada. A rota
 * `/api/agendamento/disparar` chama esta função; o `schedule` dos workflows fica de reserva, com uma
 * trava que não deixa rodar de novo no dia em que já houve execução bem-sucedida.
 *
 * O token (`GITHUB_DISPARO_TOKEN`, fine-grained, só Actions do ponte-oportunidades) nunca aparece
 * no retorno nem no log: só o status e o começo da mensagem de erro do GitHub.
 */

export const REPOSITORIO = "siteponte/ponte-oportunidades";
export const WORKFLOWS = ["fiscal.yml", "radar-propostas.yml"] as const;
/** O workflow só aceita inputs que declara; `origem` liga a trava do dia. */
export const ORIGEM = "agendador";
const TEMPO_LIMITE_MS = 15_000;
const MAX_ERRO = 300;

export interface ResultadoDisparo {
  workflow: string;
  ok: boolean;
  status: number;
  erro?: string;
}

type Buscar = (url: string, init: RequestInit) => Promise<Pick<Response, "status" | "text">>;

export function urlDisparo(workflow: string): string {
  return `https://api.github.com/repos/${REPOSITORIO}/actions/workflows/${workflow}/dispatches`;
}

/** Dispara cada workflow na `main`, um de cada vez; a falha de um não impede o outro. */
export async function dispararWorkflows(token: string, buscar: Buscar = fetch): Promise<ResultadoDisparo[]> {
  const resultados: ResultadoDisparo[] = [];
  for (const workflow of WORKFLOWS) {
    try {
      const r = await buscar(urlDisparo(workflow), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "ponte-agendador",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main", inputs: { origem: ORIGEM } }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      // 204 é a resposta clássica; com `return_run_details` o GitHub responde 200.
      if (r.status >= 200 && r.status < 300) {
        resultados.push({ workflow, ok: true, status: r.status });
      } else {
        const texto = (await r.text().catch(() => "")).slice(0, MAX_ERRO);
        resultados.push({ workflow, ok: false, status: r.status, erro: texto || "sem corpo" });
      }
    } catch (e) {
      resultados.push({ workflow, ok: false, status: 0, erro: e instanceof Error ? e.message.slice(0, MAX_ERRO) : "falha de rede" });
    }
  }
  return resultados;
}
