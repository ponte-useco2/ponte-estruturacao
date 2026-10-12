/**
 * A saúde das rodadas (onda 9, C, 09/10/2026): uma linha por job, com a última execução concluída, a "gravando" parada,
 * as contagens principais e o estado, e a última execução de cada workflow no GitHub. Recebe a leitura pronta
 * (`rodadas.server.ts`); aqui só se apresenta.
 *
 * O estado vai com marca e palavra (`Tag`), como a decisão do fiscal: a cor sozinha não basta (WCAG 1.4.1). A marca
 * fica fora da leitura em voz alta; a palavra é lida. Nenhum nome de pessoa e nenhuma mensagem de erro dos jobs:
 * só datas, contagens e nomes de fonte.
 *
 * A coluna "Dado até" (10/10/2026, onda 11, B): a data do dado da última concluída, quanto ela ficou para trás da
 * rodada e o esperado. Passou do esperado com a rodada em dia, a linha fica "dado velho".
 *
 * Os municípios (12/10/2026, onda 12, C): o mês do Caged, com as outras fontes como detalhe. O link do GitHub só é
 * desenhado se for do próprio GitHub (`urlDoGithub`).
 */
import { WORKFLOWS } from "@/lib/oportunidades/agendamento";
import {
  ESTADOS,
  FOLGA_PADRAO_H,
  JOBS_RODADAS,
  LIMITE_GRAVANDO_H,
  MARCA_ESTADO,
  ROTULO_CADENCIA,
  ROTULO_ESTADO,
  TOM_ESTADO,
  WORKFLOWS_DAS_RODADAS,
  contarEstados,
  cronDoWorkflow,
  dataHoraBrasilia,
  descreverCron,
  githubPedeAtencao,
  haQuanto,
  rotuloEvento,
  rotuloGithub,
  textoDefasagem,
  textoDiaDoDado,
  textoEsperado,
  textoPrazo,
  textoUnidade,
  urlDoGithub,
  type EstadoRodada,
  type LinhaRodada,
  type RodadaGithub,
} from "@/lib/oportunidades/rodadas";
import type { PainelRodadas } from "@/lib/oportunidades/rodadas.server";
import { Tag } from "../../../_design/primitivos";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";
import { Urgente } from "../Pecas";

const n = (x: number) => x.toLocaleString("pt-BR");

const NOTA_ESTADO: Record<EstadoRodada, string> = {
  atrasada: "passaram da cadência mais a folga",
  dado_velho: "no prazo, mas com o dado mais velho que o esperado",
  com_aviso: "no prazo, mas pararam, falharam ou deixaram parte para depois",
  nao_lido: "a tabela não existe no banco ou não respondeu",
  em_dia: "no prazo e sem aviso",
};

/** O esperado de cada fonte, sem repetir (o radar e o painel leem o mesmo arquivo), para o "Como ler". */
const ESPERADOS: readonly (readonly [string, string])[] = [
  ...new Map(
    JOBS_RODADAS.flatMap((j) => (j.dado && j.dado.limite !== null ? [[j.dado.rotulo, `até ${textoUnidade(j.dado.limite, j.dado.unidade)}`] as const] : [])),
  ),
];

export function RodadasConteudo({ painel }: { painel: PainelRodadas }) {
  const conta = contarEstados(painel.linhas);
  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · saúde das rodadas</p>
        <h1 className="pa-titulo">As rodadas dos jobs</h1>
        <p className="pa-sub">
          Lido em <strong>{dataHoraBrasilia(painel.lidoEm)}</strong> (Brasília). Uma linha por job: a última execução concluída e há quanto
          tempo, a data do dado que ela trouxe, se alguma ficou gravando parada, as contagens que o próprio job gravou e se a rodada está em
          dia com a cadência dos workflows.
        </p>
        <p className="mp-fiscal-aviso">
          Uso interno da PONTE. Aqui só há datas, contagens e nomes de fonte: nenhum nome de pessoa e nenhuma mensagem de erro dos jobs.
        </p>
        <p className="pa-linha">
          <LinkMapa href="/mapa/painel" className="pa-btn pa-btn-pequeno">
            Voltar ao painel de execução
          </LinkMapa>
        </p>
      </div>

      {/* Cinco estados (onda 11, B): três por linha, os que pedem ação na primeira. */}
      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        {ESTADOS.map((e) => (
          <article key={e} className="pa-cartao">
            <h2 className="pa-mono">
              <span aria-hidden="true">{MARCA_ESTADO[e]} </span>
              {ROTULO_ESTADO[e]}
            </h2>
            <p className="pa-numero">{n(conta[e])}</p>
            <p className="pa-nota">
              {conta[e] === 1 ? "job" : "jobs"} {NOTA_ESTADO[e]}
            </p>
          </article>
        ))}
      </div>

      <section aria-labelledby="rodadas-jobs" className="mp-radar-secao">
        <h2 id="rodadas-jobs" className="mp-radar-h2">
          As rodadas, job a job
        </h2>
        <TabelaRolagem rotuloId="rodadas-jobs">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Estado</th>
                <th scope="col">Última concluída</th>
                <th scope="col">Dado até</th>
                <th scope="col">Cadência</th>
                <th scope="col">Linhas</th>
                <th scope="col" className="mp-num">
                  Falhas
                </th>
                <th scope="col">Gravando</th>
                <th scope="col">Avisos</th>
              </tr>
            </thead>
            <tbody>
              {painel.linhas.map((l) => (
                <LinhaJob key={l.job.id} l={l} />
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      </section>

      <SecaoGithub github={painel.github} />

      <section aria-labelledby="rodadas-como-ler" className="mp-radar-secao">
        <h2 id="rodadas-como-ler" className="mp-radar-h2">
          Como ler
        </h2>
        <p className="pa-nota">
          <strong>Atrasada</strong>: a última execução concluída tem mais que o intervalo da cadência (24 horas, 7 dias ou 31 dias) mais a
          folga do job. A folga é de {FOLGA_PADRAO_H} h nos agendados: o agendador do GitHub sai de 4 a 5 h depois do cron desde 29/08/2026,
          e o job ainda leva até o tempo-limite do workflow. Nas organizações da sociedade civil, mais 8 dias: o job só grava quando o Ipea
          publica arquivo novo, e o dia 28 existe para pegar o arquivo atrasado.
        </p>
        <p className="pa-nota">
          <strong>Dado velho</strong>: rodou no prazo, mas a data do dado que a rodada trouxe ficou mais para trás do que o esperado para aquela
          fonte. Rodar em dia não é ter dado novo: em 09/10/2026 o fiscal rodou no prazo com o CAUC de 02/10, cinco dias úteis para trás. A
          coluna <strong>Dado até</strong> diz o dia do dado, quanto ele ficou para trás do dia da rodada e o esperado. A idade da rodada é a
          regra de atrasada; a do dado é medida no dia da rodada, e as duas não se misturam. No CAUC, vale a idade que o próprio fiscal
          contou, com os feriados nacionais; nas rodadas antigas, que não a gravavam, a conta é de segunda a sexta. O esperado de cada fonte:
        </p>
        <ul className="pa-nota">
          {ESPERADOS.map(([rotulo, ate]) => (
            <li key={rotulo}>
              {rotulo}: {ate}
            </li>
          ))}
        </ul>
        <p className="pa-nota">
          Na coluna Dado até, <strong>não lido</strong> quer dizer que a data não respondeu, que a rodada não a gravou ou que gravou uma data
          depois do dia da rodada, que só pode estar errada: a linha segue e o estado não muda por isso. As coletas assistidas mostram a data
          sem esperado.
        </p>
        {/* Onda 12, C (12/10/2026): os municípios passam a ter data do dado, a do Caged. */}
        <p className="pa-nota">
          Nos <strong>indicadores dos municípios</strong>, cada fonte tem o seu período, e a data do dado é a do Caged: a única fonte de
          cadência conhecida e curta (o Ministério do Trabalho publica o mês no fim do mês seguinte, e a rodada do dia 5 lê o de dois meses
          antes). As outras fontes são anuais ou censitárias, com defasagem natural de anos (o IDHM é do Censo de 2010): aparecem como detalhe,
          da mais antiga à mais nova, e nunca deixam a linha com dado velho. Rodada de antes de o job gravar o período de cada fonte fica sem
          data, como antes.
        </p>
        <p className="pa-nota">
          <strong>Com aviso</strong>: rodou no prazo, mas uma execução está gravando há mais de {LIMITE_GRAVANDO_H} h (o job morreu sem marcar
          erro), a tentativa mais nova terminou em erro, ou o próprio job contou falhas ou deixou parte para a próxima rodada. Um erro anterior
          à última concluída é história e não conta.
        </p>
        <p className="pa-nota">
          <strong>Não lido</strong>: a tabela do job não existe no banco (migração não aplicada) ou não respondeu. As outras linhas não
          dependem dela.
        </p>
        <p className="pa-nota">
          As coletas do Acesso Livre (prestação de contas, obras e exigências) são assistidas, conduzidas no navegador: não têm agendamento e
          não ficam atrasadas. A idade delas está na coluna da última concluída.
        </p>
      </section>
    </div>
  );
}

function SeloEstado({ estado }: { estado: EstadoRodada }) {
  return (
    <Tag tom={TOM_ESTADO[estado]}>
      <span aria-hidden="true">{MARCA_ESTADO[estado]} </span>
      {ROTULO_ESTADO[estado]}
    </Tag>
  );
}

function UltimaConcluida({ l }: { l: LinhaRodada }) {
  if (l.estado === "nao_lido") {
    return <span className="mp-tabela-secundario">{l.motivoNaoLido === "ausente" ? "a tabela não existe no banco" : "a leitura não respondeu"}</span>;
  }
  if (!l.concluidaEm) return <>nenhuma</>;
  return (
    <>
      <span className="mp-tabela-principal">{dataHoraBrasilia(l.concluidaEm)}</span>
      {l.idadeH !== null && <span className="mp-tabela-secundario">{haQuanto(l.idadeH)}</span>}
    </>
  );
}

/**
 * A coluna "Dado até" (10/10/2026, onda 11, B): o dia do dado, o que ele é, quanto ficou para trás da rodada e o
 * esperado. A data que não pôde ser lida diz "não lido", e o resto da linha segue.
 */
function DadoAte({ l }: { l: LinhaRodada }) {
  const { dado } = l;
  if (l.estado === "nao_lido" || dado.situacao === "sem_execucao") return <>—</>;
  if (dado.situacao === "nao_grava") {
    // Com regra, é a execução de antes de o job gravar a data (os municípios antes de 12/10/2026, onda 12, C).
    return (
      <>
        <span className="mp-tabela-principal">—</span>
        <span className="mp-tabela-secundario">
          {dado.regra ? "a rodada é de antes de o job gravar a data do dado" : "o job não grava uma data do dado da rodada"}
        </span>
      </>
    );
  }
  if (dado.situacao === "nao_lido") {
    return (
      <>
        <span className="mp-tabela-principal">
          <span aria-hidden="true">{MARCA_ESTADO.nao_lido} </span>
          não lido
        </span>
        {/* "sem_data" cobre também a data depois do dia da rodada (onda 12, C, M3 da revisão D). */}
        <span className="mp-tabela-secundario">{dado.motivo === "falha" ? "a data do dado não respondeu" : "a rodada não gravou uma data do dado válida"}</span>
        {dado.detalhe && <span className="mp-tabela-secundario">{dado.detalhe}</span>}
      </>
    );
  }
  const velho = dado.situacao === "velho";
  return (
    <>
      <span className="mp-tabela-principal">{textoDiaDoDado(dado.dia, dado.regra?.precisao)}</span>
      {dado.regra && <span className="mp-tabela-secundario">{dado.regra.rotulo}</span>}
      <span className={velho ? "mp-tabela-principal" : "mp-tabela-secundario"}>
        {velho && <span aria-hidden="true">{MARCA_ESTADO.dado_velho} </span>}
        {textoDefasagem(dado)}
        {velho ? ", acima do esperado" : ""}
      </span>
      <span className="mp-tabela-secundario">{dado.situacao === "sem_prazo" ? "coleta assistida: sem esperado" : textoEsperado(dado.regra)}</span>
      {/* As outras fontes dos municípios (onda 12, C): detalhe, sem mudar o estado. */}
      {dado.detalhe && <span className="mp-tabela-secundario">{dado.detalhe}</span>}
    </>
  );
}

function Gravando({ l }: { l: LinhaRodada }) {
  if (l.estado === "nao_lido") return <>—</>;
  if (!l.gravando) return <>não</>;
  if (!l.gravando.parada) {
    return (
      <>
        <span className="mp-tabela-principal">em curso</span>
        <span className="mp-tabela-secundario">começou {haQuanto(l.gravando.idadeH)}</span>
      </>
    );
  }
  return (
    <>
      <span className="mp-tabela-principal mp-painel-urgente">
        <Urgente palavra="parada" />
      </span>
      <span className="mp-tabela-secundario">
        desde {dataHoraBrasilia(l.gravando.iniciadaEm)} ({haQuanto(l.gravando.idadeH)})
      </span>
    </>
  );
}

function LinhaJob({ l }: { l: LinhaRodada }) {
  const { job } = l;
  return (
    <tr>
      <th scope="row">
        <span className="mp-tabela-principal">{job.nome}</span>
        <span className="mp-tabela-secundario">
          {job.tabela}
          {job.recorte ? ` · recorte ${job.recorte}` : ""}
        </span>
      </th>
      <td>
        <SeloEstado estado={l.estado} />
      </td>
      <td>
        <UltimaConcluida l={l} />
      </td>
      <td>
        <DadoAte l={l} />
      </td>
      <td>
        <span className="mp-tabela-principal">{ROTULO_CADENCIA[job.cadencia]}</span>
        <span className="mp-tabela-secundario">
          {job.cron && job.workflow ? `${descreverCron(job.cron)} · ${job.workflow}` : "coleta no navegador, sem agendamento"}
        </span>
        {l.prazoH !== null && <span className="mp-tabela-secundario">atrasa depois de {textoPrazo(l.prazoH)}</span>}
      </td>
      <td>
        {l.linhas !== null ? (
          <>
            <span className="mp-tabela-principal">{n(l.linhas)}</span>
            <span className="mp-tabela-secundario">{job.rotuloLinhas}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="mp-num">{l.falhas !== null ? n(l.falhas) : "—"}</td>
      <td>
        <Gravando l={l} />
      </td>
      <td>
        {l.avisos.length ? (
          <ul>
            {l.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

function SecaoGithub({ github }: { github: RodadaGithub[] | null }) {
  return (
    <section aria-labelledby="rodadas-github" className="mp-radar-secao">
      <h2 id="rodadas-github" className="mp-radar-h2">
        Os workflows no GitHub
      </h2>
      <p className="pa-nota">
        {github
          ? "A última execução de cada workflow do monorepo, de qualquer origem. Nos dois do disparo diário, a execução do agendamento do GitHub que encontra a rodada do dia já feita termina com sucesso sem rodar de novo (a trava do dia)."
          : "O token do agendador (GITHUB_DISPARO_TOKEN) não está configurado neste ambiente, e a última execução no GitHub fica de fora. As rodadas acima não dependem dele."}
      </p>
      <TabelaRolagem rotuloId="rodadas-github">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Workflow</th>
              <th scope="col">Agendamento</th>
              <th scope="col">Jobs</th>
              <th scope="col">Última execução no GitHub</th>
            </tr>
          </thead>
          <tbody>
            {WORKFLOWS_DAS_RODADAS.map((w) => {
              const cron = cronDoWorkflow(w);
              const doAgendador = (WORKFLOWS as readonly string[]).includes(w);
              return (
                <tr key={w}>
                  <th scope="row">{w}</th>
                  <td>
                    <span className="mp-tabela-principal">{cron ? descreverCron(cron) : "—"}</span>
                    {doAgendador && <span className="mp-tabela-secundario">disparo diário pela Vercel às 11h30 UTC; o cron é a reserva</span>}
                  </td>
                  <td>
                    {JOBS_RODADAS.filter((j) => j.workflow === w)
                      .map((j) => j.nome)
                      .join(", ")}
                  </td>
                  <td>{github === null ? "não configurado" : <ExecucaoGithub workflow={w} r={github.find((x) => x.workflow === w) ?? null} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TabelaRolagem>
    </section>
  );
}

function ExecucaoGithub({ workflow, r }: { workflow: string; r: RodadaGithub | null }) {
  if (!r) return <>—</>;
  const { marca, texto } = rotuloGithub(r);
  // Só o endereço do próprio GitHub vira link (onda 12, C, M6 da revisão da onda 11), ainda que `ultimaNoGithub` já
  // tenha conferido: a tela não confia no que recebe.
  const url = urlDoGithub(r.url);
  return (
    <>
      <span className={`mp-tabela-principal${githubPedeAtencao(r) ? " mp-painel-urgente" : ""}`}>
        <span aria-hidden="true">{marca} </span>
        {texto}
      </span>
      {r.criadaEm && (
        <span className="mp-tabela-secundario">
          {dataHoraBrasilia(r.criadaEm)} · {rotuloEvento(r.evento)}
        </span>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          abrir no GitHub
          <span className="pa-sr"> (a execução de {workflow}, em nova aba)</span>
        </a>
      )}
    </>
  );
}
