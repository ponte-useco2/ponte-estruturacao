/**
 * A página de um convênio: valores, prazos e, na PB, a linha do tempo. Recebe os dados já lidos.
 */
import Link from "next/link";
import {
  ROTULO_TIPO_EVENTO,
  contagem,
  porAno,
  resumoEventos,
  rotuloModalidade,
  rotuloSituacaoHistorico,
  urlBusca,
  urlInvestimentos,
  urlProposta,
  parametrosBusca,
  type EventoInstrumento,
} from "@/lib/oportunidades/busca";
import type { LeituraInstrumento } from "@/lib/oportunidades/busca.server";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { ROTULO_MOTIVO_ADITIVO, percentual } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";
import { EstrelaSeguir } from "../../_componentes/EstrelaSeguir";
import { CopiarNumero } from "../../painel/CopiarNumero";

type LeituraOk = Extract<LeituraInstrumento, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const data = (iso: string | null) => (iso ? formatarData(iso) : "—");

/**
 * `seguindo`: null quando não dá para saber (sem a oport_15): a estrela não aparece.
 * `laudo`: mostra o atalho para o laudo da cláusula suspensiva (a página decide quem vê).
 */
export function InstrumentoConteudo({
  leitura,
  seguindo = null,
  laudo = false,
}: {
  leitura: LeituraOk;
  seguindo?: boolean | null;
  laudo?: boolean;
}) {
  const i = leitura.instrumento;
  const r = resumoEventos(leitura.eventos);
  const anos = porAno(leitura.eventos);
  const temas = i.temas.filter((t) => ROTULO_TEMA[t]);

  return (
    <div className="pa-pagina mp-radar mp-instrumento">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          {rotuloModalidade(i.modalidade) ?? "convênio"} nº {i.nr_convenio} <CopiarNumero numero={i.nr_convenio} de="convênio" />
          {seguindo !== null && (
            <EstrelaSeguir tipo="instrumento" chave={i.nr_convenio} nome={`o convênio nº ${i.nr_convenio}`} seguindo={seguindo} />
          )}
        </p>
        <h1 className="pa-titulo">{i.programa ?? "Programa não informado"}</h1>
        {i.objeto && <p className="pa-sub">{i.objeto}</p>}
        <p className="pa-sub">
          <strong>{i.proponente ?? "Proponente não informado"}</strong>
          {i.cod_ibge ? (
            <>
              {" · "}
              <Link href={urlInvestimentos(i.cod_ibge)}>
                {i.municipio ?? `IBGE ${i.cod_ibge}`}/{i.uf}
              </Link>
            </>
          ) : null}
          {i.orgao_sup ? ` · ${i.orgao_sup}` : ""}
          {i.orgao && i.orgao !== i.orgao_sup ? ` · ${i.orgao}` : ""}
        </p>
        <p className="pa-chips">
          <span className="pa-tag">{i.situacao ?? "Situação não informada"}</span>
          {i.subsituacao && <span className="pa-tag">{i.subsituacao}</span>}
          {i.com_emenda && <span className="pa-tag">com emenda parlamentar</span>}
          {temas.map((t) => (
            <Link key={t} href={urlBusca(parametrosBusca({}), { tema: t, uf: i.uf })} className="pa-tag">
              {ROTULO_TEMA[t]}
            </Link>
          ))}
        </p>
      </div>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">Repasse federal</h2>
          <p className="pa-numero">{moedaCurta(i.vl_repasse)}</p>
          <p className="pa-nota">
            Valor global {moedaCurta(i.vl_global)} · contrapartida {moedaCurta(i.vl_contrapartida)}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Desembolsado</h2>
          <p className="pa-numero">{moedaCurta(i.vl_desembolsado)}</p>
          <p className="pa-nota">
            {percentual(i.pct_desembolsado)} do repasse · empenhado {moedaCurta(i.vl_empenhado)}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Pago pelo convenente</h2>
          <p className="pa-numero">{moedaCurta(i.vl_pago)}</p>
          <p className="pa-nota">
            Saldo em conta {moedaCurta(i.vl_saldo_conta)}
            {i.pct_fisico !== null ? ` · execução física aferida ${percentual(i.pct_fisico)}` : ""}
          </p>
        </article>
      </div>

      <section aria-labelledby="instrumento-prazos" className="mp-radar-secao">
        <h2 id="instrumento-prazos" className="mp-radar-h2">
          Prazos
        </h2>
        <dl className="mp-instrumento-prazos">
          <Prazo rotulo="Assinatura" valor={data(i.dt_assinatura)} />
          <Prazo rotulo="Vigência" valor={`${data(i.dt_inicio_vigencia)} a ${data(i.dt_fim_vigencia)}`} />
          <Prazo rotulo="Limite para prestar contas" valor={data(i.dt_limite_contas)} />
          {(i.dt_suspensiva || i.dt_retirada_suspensiva) && (
            <Prazo
              rotulo="Cláusula suspensiva"
              valor={i.dt_retirada_suspensiva ? `retirada em ${data(i.dt_retirada_suspensiva)}` : `prazo até ${data(i.dt_suspensiva)}`}
            />
          )}
          {i.motivo_suspensao && <Prazo rotulo="O termo exige, para retirar a suspensiva" valor={i.motivo_suspensao} />}
          <Prazo rotulo="Termos aditivos e prorrogações de ofício" valor={`${n(i.n_aditivos)} e ${n(i.n_prorrogas)}`} />
          <Prazo rotulo="Desembolsos" valor={i.dt_primeiro_desembolso ? `${data(i.dt_primeiro_desembolso)} a ${data(i.dt_ultimo_desembolso)}` : "nenhum"} />
          <Prazo rotulo="Último pagamento" valor={data(i.dt_ultimo_pagamento)} />
        </dl>
        {laudo && (
          <p className="pa-nota">
            <Link href={`/mapa/instrumento/${encodeURIComponent(i.nr_convenio)}/laudo`}>
              Ver o laudo da cláusula suspensiva: o que falta, desde quando e de quem é a vez
            </Link>
          </p>
        )}
        {i.id_proposta && (
          <p className="pa-nota">
            <Link href={urlProposta(i.id_proposta)}>Ver a proposta que originou o convênio</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="instrumento-linha" className="mp-radar-secao">
        <h2 id="instrumento-linha" className="mp-radar-h2">
          Linha do tempo
        </h2>
        {!i.detalhe ? (
          <p className="pa-cartao pa-cartao-plano">
            A linha do tempo existe para os convênios de proponente da Paraíba. Os demais aparecem aqui só com valores e prazos.
          </p>
        ) : leitura.eventos.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum evento registrado no Transferegov para este convênio.</p>
        ) : (
          <>
            <p className="pa-nota">
              {contagem(r.desembolso.n, "desembolso", "desembolsos")} ({moedaCurta(r.desembolso.valor)}) ·{" "}
              {contagem(r.pagamento.n, "pagamento", "pagamentos")} ({moedaCurta(r.pagamento.valor)}) ·{" "}
              {contagem(r.aditivo.n, "aditivo", "aditivos")} · {contagem(r.licitacao.n, "licitação", "licitações")}. Pagamentos
              somados por dia e tipo de documento, sem o
              favorecido.
              {leitura.eventosTruncados ? " A lista mostra os primeiros 5.000 eventos." : ""}
            </p>
            {anos.map((grupo, indice) => (
              <details key={grupo.ano} className="mp-linha-ano" open={indice === 0}>
                <summary>
                  <strong>{grupo.ano}</strong> · {contagem(grupo.eventos.length, "evento", "eventos")}
                </summary>
                <ol className="mp-linha">
                  {grupo.eventos.map((e, k) => (
                    <li key={`${e.data}-${e.tipo}-${k}`} className={`mp-linha-evento mp-linha-${e.tipo}`}>
                      <span className="pa-mono mp-linha-data">{data(e.data)}</span>
                      <span className="mp-linha-texto">
                        <span className="mp-tabela-principal">{tituloEvento(e)}</span>
                        {detalheEvento(e) && <span className="mp-tabela-secundario">{detalheEvento(e)}</span>}
                      </span>
                      <span className="mp-num mp-linha-valor">{e.valor !== null ? moedaCurta(e.valor) : ""}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </>
        )}
        <p className="pa-nota">
          Fonte: Transferegov (SICONV), dado até {formatarPublicacao(leitura.execucao.dado_ate)}.
        </p>
      </section>
    </div>
  );
}

function Prazo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="pa-mono">{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

function tituloEvento(e: EventoInstrumento): string {
  switch (e.tipo) {
    case "situacao":
      return rotuloSituacaoHistorico(e.descricao);
    case "pagamento":
      return `Pagamento${e.descricao ? ` · ${e.descricao.toLowerCase()}` : ""}`;
    case "aditivo":
      return `Termo aditivo${e.descricao ? ` · ${e.descricao}` : ""}`;
    case "licitacao":
      return `Licitação${e.descricao ? ` · ${e.descricao}` : ""}`;
    default:
      return ROTULO_TIPO_EVENTO[e.tipo];
  }
}

function detalheEvento(e: EventoInstrumento): string | null {
  switch (e.tipo) {
    case "pagamento":
    case "desembolso":
    case "tributo":
      return e.quantidade && e.quantidade > 1 ? `${e.quantidade.toLocaleString("pt-BR")} lançamentos no dia` : null;
    case "aditivo": {
      const partes = [
        e.categoria ? `motivo: ${(ROTULO_MOTIVO_ADITIVO[e.categoria] ?? e.categoria).toLowerCase()}` : null,
        e.data_fim ? `vigência até ${formatarData(e.data_fim)}` : null,
      ].filter(Boolean);
      return partes.length ? partes.join(" · ") : null;
    }
    case "prorrogacao":
      return [e.quantidade ? `${e.quantidade.toLocaleString("pt-BR")} dias` : null, e.data_fim ? `até ${formatarData(e.data_fim)}` : null]
        .filter(Boolean)
        .join(" · ") || null;
    case "licitacao":
      return e.categoria;
    default:
      return null;
  }
}
