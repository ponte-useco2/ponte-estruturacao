/**
 * A página de um convênio: valores, prazos e, na PB, a linha do tempo. Recebe os dados já lidos.
 *
 * C4a (09/10/2026; achado 4.1 da auditoria R1): `publico`, o nível 0 da versão aberta. A página da proposta e a busca
 * pedem cadastro: o link da proposta diz "(pede cadastro)" e leva à entrada; as etiquetas de tema ficam sem link.
 */
import type { ReactNode } from "react";
import { urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { MARCA_PEDE_CADASTRO, linkNoPublico } from "@/lib/oportunidades/publico";
import {
  ROTULO_TIPO_EVENTO,
  contagem,
  porAno,
  resumoEventos,
  rotuloModalidade,
  rotuloSituacaoHistorico,
  urlBusca,
  urlDoMunicipio,
  urlProposta,
  parametrosBusca,
  type EventoInstrumento,
} from "@/lib/oportunidades/busca";
import type { LeituraInstrumento } from "@/lib/oportunidades/busca.server";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { ROTULO_MOTIVO_ADITIVO, percentual } from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";
import { eloInstrumento, trilha } from "@/lib/oportunidades/trilha";
import { EstrelaSeguir } from "../../_componentes/EstrelaSeguir";
import { CopiarNumero } from "../../painel/CopiarNumero";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { Termo } from "../../_componentes/Termo";
import { Trilha } from "../../_componentes/Trilha";

type LeituraOk = Extract<LeituraInstrumento, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const data = (iso: string | null) => (iso ? formatarData(iso) : "—");

/**
 * `seguindo`: null quando não dá para saber (sem a oport_15): a estrela não aparece.
 * `laudo`: mostra o botão do laudo do instrumento (a página decide quem vê).
 */
export function InstrumentoConteudo({
  leitura,
  seguindo = null,
  laudo = false,
  publico = false,
}: {
  leitura: LeituraOk;
  seguindo?: boolean | null;
  laudo?: boolean;
  /** C4a: o nível 0 (versão pública). */
  publico?: boolean;
}) {
  const i = leitura.instrumento;
  const proposta = i.id_proposta ? linkNoPublico(urlProposta(i.id_proposta), publico) : null;
  const r = resumoEventos(leitura.eventos);
  const anos = porAno(leitura.eventos);
  const temas = i.temas.filter((t) => ROTULO_TEMA[t]);

  return (
    <div className="pa-pagina mp-radar mp-instrumento">
      <div className="pa-pilha mp-radar-cabeca">
        <Trilha
          elos={trilha(
            {
              uf: i.uf,
              municipio: i.cod_ibge || i.municipio ? { ibge: i.cod_ibge, nome: i.municipio } : null,
              entidade: { cnpj: i.cnpj, nome: i.proponente },
            },
            eloInstrumento(i.nr_convenio, i.modalidade),
          )}
        />
        <p className="pa-kicker">
          {rotuloModalidade(i.modalidade) ?? "convênio"} nº {i.nr_convenio} <CopiarNumero numero={i.nr_convenio} de="convênio" />
          {seguindo !== null && (
            <EstrelaSeguir tipo="instrumento" chave={i.nr_convenio} nome={`o convênio nº ${i.nr_convenio}`} seguindo={seguindo} />
          )}
        </p>
        <h1 className="pa-titulo">{i.programa ?? "Programa não informado"}</h1>
        {i.objeto && <p className="pa-sub">{i.objeto}</p>}
        <p className="pa-sub">
          {i.cnpj ? (
            <LinkMapa href={urlEntidade(i.cnpj)}>
              <strong>{i.proponente ?? "Proponente não informado"}</strong>
            </LinkMapa>
          ) : (
            <strong>{i.proponente ?? "Proponente não informado"}</strong>
          )}
          {i.cod_ibge ? (
            <>
              {" · "}
              <LinkMapa href={urlDoMunicipio(i.cod_ibge)}>
                {i.municipio ?? `IBGE ${i.cod_ibge}`}/{i.uf}
              </LinkMapa>
            </>
          ) : null}
          {i.orgao_sup ? ` · ${i.orgao_sup}` : ""}
          {i.orgao && i.orgao !== i.orgao_sup ? ` · ${i.orgao}` : ""}
        </p>
        <p className="pa-chips">
          <span className="pa-tag">{i.situacao ?? "Situação não informada"}</span>
          {i.subsituacao && <span className="pa-tag">{i.subsituacao}</span>}
          {i.com_emenda && <span className="pa-tag">com emenda parlamentar</span>}
          {/* C4a: a etiqueta do tema leva à busca, que pede cadastro; no nível 0 ela fica sem link (só a etiqueta). */}
          {temas.map((t) =>
            publico ? (
              <span key={t} className="pa-tag">
                {ROTULO_TEMA[t]}
              </span>
            ) : (
              <LinkMapa key={t} href={urlBusca(parametrosBusca({}), { tema: t, uf: i.uf })} className="pa-tag">
                {ROTULO_TEMA[t]}
              </LinkMapa>
            ),
          )}
        </p>
        {laudo && (
          <p className="mp-nao-imprimir mp-laudo-acoes">
            <LinkMapa href={`/mapa/instrumento/${encodeURIComponent(i.nr_convenio)}/laudo`} className="pa-btn pa-btn-pequeno">
              Abrir o laudo do convênio
            </LinkMapa>
            <span className="pa-nota">onde está, quanto tempo contra o típico, riscos e o que fazer</span>
          </p>
        )}
      </div>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">Repasse federal</h2>
          <p className="pa-numero">{moedaCurta(i.vl_repasse)}</p>
          <p className="pa-nota">
            <Termo slug="valor-global">Valor global</Termo> {moedaCurta(i.vl_global)} · <Termo slug="contrapartida">contrapartida</Termo>{" "}
            {moedaCurta(i.vl_contrapartida)}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Desembolsado</h2>
          <p className="pa-numero">{moedaCurta(i.vl_desembolsado)}</p>
          <p className="pa-nota">
            {/* Calculado aqui: até a onda 12 o job gravava 999% em `pct_desembolsado` quando não havia desembolso. */}
            {percentual(i.vl_repasse ? (i.vl_desembolsado ?? 0) / i.vl_repasse : null)} do repasse · <Termo slug="empenho">empenhado</Termo>{" "}
            {moedaCurta(i.vl_empenhado)}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">
            Pago pelo <Termo slug="convenente">convenente</Termo>
          </h2>
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
          <Prazo rotulo={<Termo slug="vigencia">Vigência</Termo>} valor={`${data(i.dt_inicio_vigencia)} a ${data(i.dt_fim_vigencia)}`} />
          <Prazo rotulo="Limite para prestar contas" valor={data(i.dt_limite_contas)} />
          {(i.dt_suspensiva || i.dt_retirada_suspensiva) && (
            <Prazo
              rotulo={<Termo slug="condicao-suspensiva">Condição suspensiva</Termo>}
              valor={i.dt_retirada_suspensiva ? `retirada em ${data(i.dt_retirada_suspensiva)}` : `prazo até ${data(i.dt_suspensiva)}`}
            />
          )}
          {i.motivo_suspensao && <Prazo rotulo="Motivo da suspensiva, como registrado no termo" valor={i.motivo_suspensao} />}
          <Prazo rotulo="Termos aditivos e prorrogações feitas pelo concedente" valor={`${n(i.n_aditivos)} e ${n(i.n_prorrogas)}`} />
          <Prazo rotulo="Desembolsos" valor={i.dt_primeiro_desembolso ? `${data(i.dt_primeiro_desembolso)} a ${data(i.dt_ultimo_desembolso)}` : "nenhum"} />
          <Prazo rotulo="Último pagamento" valor={data(i.dt_ultimo_pagamento)} />
        </dl>
        {proposta && (
          <p className="pa-nota">
            <LinkMapa href={proposta.href}>
              Ver a proposta que originou o convênio{proposta.pedeCadastro && ` ${MARCA_PEDE_CADASTRO}`}
            </LinkMapa>
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
          // B12b (onda 3 de UX, 08/10/2026): dizia só que não havia evento. Agora diz até quando se leu, o caso comum
          // (convênio recém-assinado ou ainda sem movimento) e o que fazer para saber do primeiro.
          <div className="pa-cartao pa-cartao-plano pa-pilha">
            <p>Nenhum evento registrado no Transferegov para este convênio até {formatarPublicacao(leitura.execucao.dado_ate)}.</p>
            <p>
              É o caso de convênio recém-assinado ou ainda sem movimento. A linha do tempo junta mudança de situação, desembolso,
              pagamento, termo aditivo, prorrogação e licitação, e a base é relida uma vez por dia.
              {seguindo === false && <> Siga o convênio (“☆ Seguir”, no alto da página) para ser avisado quando ele mudar.</>}
              {seguindo === true && (
                <>
                  {" "}
                  Você segue este convênio: quando ele mudar, o aviso aparece em <LinkMapa href="/mapa/avisos?mural=itens">Meus itens</LinkMapa>.
                </>
              )}
            </p>
          </div>
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

function Prazo({ rotulo, valor }: { rotulo: ReactNode; valor: string }) {
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
