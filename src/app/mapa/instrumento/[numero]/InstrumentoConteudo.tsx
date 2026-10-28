/**
 * A página de um convênio: valores, prazos e, na PB, a linha do tempo. Recebe os dados já lidos.
 *
 * C4a (09/10/2026; achado 4.1 da auditoria R1): `publico`, o nível 0 da versão aberta. A página da proposta e a busca
 * pedem cadastro: o link da proposta diz "(pede cadastro)" e leva à entrada; as etiquetas de tema ficam sem link.
 *
 * Onda 16, M2 (27/10/2026): a página virou três abas (`?aba=`), com movimento do Framer Motion dentro delas:
 * - **Visão geral:** os três cartões em cascata e os prazos;
 * - **Fase:** a sequência de situações acendendo uma a uma, e a linha do tempo completa;
 * - **Execução:** as barras com mola, os pagamentos mês a mês e, a partir do cadastro, os fornecedores (somados para o
 *   cadastrado e o cliente; com o nome da empresa só para o administrador, D1). Da empresa se desce ao fornecedor.
 * No celular, deslizar o conteúdo para o lado troca de aba.
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
import type { LeituraEmpresasDaExecucao, LeituraInstrumento } from "@/lib/oportunidades/busca.server";
import { cnpjLegivel, urlFornecedor } from "@/lib/oportunidades/fornecedores";
import {
  ABAS_INSTRUMENTO,
  abasVizinhas,
  barrasDaExecucao,
  fasesDoInstrumento,
  janelaDoPagamento,
  pagamentosPorMes,
  resumoFornecedores,
  urlInstrumentoNaAba,
  type AbaInstrumento,
  type ValoresExecucao,
} from "@/lib/oportunidades/pagina-instrumento";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { ROTULO_MOTIVO_ADITIVO, percentual } from "@/lib/oportunidades/painel";
import { documentoLegivel, listaCompleta, pagamentosPorEmpresa, posicaoNaJanela, type PagamentoEmpresa } from "@/lib/oportunidades/pagamentos-empresa";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";
import { eloInstrumento, trilha } from "@/lib/oportunidades/trilha";
import { EstrelaSeguir } from "../../_componentes/EstrelaSeguir";
import { CopiarNumero } from "../../painel/CopiarNumero";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { Termo } from "../../_componentes/Termo";
import { Trilha } from "../../_componentes/Trilha";
import { AbasAnimadas } from "../../_movimento/AbasAnimadas";
import { BarraMola } from "../../_movimento/BarraMola";
import { Cascata, ItemCascata } from "../../_movimento/Cascata";
import { DeslizarAbas } from "../../_movimento/DeslizarAbas";
import { EmpresasDaExecucao } from "../../_movimento/EmpresasDaExecucao";
import { FasesAnimadas } from "../../_movimento/FasesAnimadas";
import { GraficoPagamentos } from "../../_movimento/GraficoPagamentos";

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
  aba = "geral",
  administrador = false,
  empresas = null,
  pagamentos = null,
}: {
  leitura: LeituraOk;
  seguindo?: boolean | null;
  laudo?: boolean;
  /** C4a: o nível 0 (versão pública). */
  publico?: boolean;
  /** Onda 16, M2: a aba aberta. */
  aba?: AbaInstrumento;
  /** D1: só o administrador vê a empresa com nome. */
  administrador?: boolean;
  /** As empresas da execução, lidas só para o administrador e só na aba Execução. */
  empresas?: LeituraEmpresasDaExecucao | null;
  /** Onda 19: os pagamentos um a um às empresas (oport_52), com a mesma regra das empresas. */
  pagamentos?: PagamentoEmpresa[] | null;
}) {
  const i = leitura.instrumento;
  const proposta = i.id_proposta ? linkNoPublico(urlProposta(i.id_proposta), publico) : null;
  const r = resumoEventos(leitura.eventos);
  const anos = porAno(leitura.eventos);
  const temas = i.temas.filter((t) => ROTULO_TEMA[t]);
  const viz = abasVizinhas(aba);
  const anterior = viz.anterior ? urlInstrumentoNaAba(i.nr_convenio, viz.anterior) : null;
  const proxima = viz.proxima ? urlInstrumentoNaAba(i.nr_convenio, viz.proxima) : null;

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

      <AbasAnimadas
        rotulo="Partes do convênio"
        grupo="instrumento"
        atual={aba}
        abas={ABAS_INSTRUMENTO.map((a) => ({ id: a.id, nome: a.nome, href: urlInstrumentoNaAba(i.nr_convenio, a.id) }))}
      />
      <DeslizarAbas anterior={anterior} proxima={proxima}>
        {aba === "geral" && (
          <>
            <Cascata className="pa-grade pa-grade-3 mp-painel-cartoes">
              <ItemCascata como="article" className="pa-cartao" indice={0}>
                <h2 className="pa-mono">Repasse federal</h2>
                <p className="pa-numero">{moedaCurta(i.vl_repasse)}</p>
                <p className="pa-nota">
                  <Termo slug="valor-global">Valor global</Termo> {moedaCurta(i.vl_global)} · <Termo slug="contrapartida">contrapartida</Termo>{" "}
                  {moedaCurta(i.vl_contrapartida)}
                </p>
              </ItemCascata>
              <ItemCascata como="article" className="pa-cartao" indice={1}>
                <h2 className="pa-mono">Desembolsado</h2>
                <p className="pa-numero">{moedaCurta(i.vl_desembolsado)}</p>
                <p className="pa-nota">
                  {/* Calculado aqui: até a onda 12 o job gravava 999% em `pct_desembolsado` quando não havia desembolso. */}
                  {percentual(i.vl_repasse ? (i.vl_desembolsado ?? 0) / i.vl_repasse : null)} do repasse · <Termo slug="empenho">empenhado</Termo>{" "}
                  {moedaCurta(i.vl_empenhado)}
                </p>
              </ItemCascata>
              <ItemCascata como="article" className="pa-cartao" indice={2}>
                <h2 className="pa-mono">
                  Pago pelo <Termo slug="convenente">convenente</Termo>
                </h2>
                <p className="pa-numero">{moedaCurta(i.vl_pago)}</p>
                <p className="pa-nota">
                  Saldo em conta {moedaCurta(i.vl_saldo_conta)}
                  {i.pct_fisico !== null ? ` · execução física aferida ${percentual(i.pct_fisico)}` : ""}
                </p>
              </ItemCascata>
            </Cascata>

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
          </>
        )}
        {aba === "fase" && (
          <>
            <Fases leitura={leitura} />
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
          </>
        )}
        {aba === "execucao" && <Execucao leitura={leitura} publico={publico} administrador={administrador} empresas={empresas} pagamentos={pagamentos} />}
      </DeslizarAbas>
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

// ================================================================ onda 16, M2: as abas Fase e Execução

/** A sequência de situações acendendo uma a uma. Sem linha do tempo (fora da PB), fica só a situação de agora. */
function Fases({ leitura }: { leitura: LeituraOk }) {
  const fases = fasesDoInstrumento(leitura.eventos).map((f) => ({ rotulo: rotuloSituacaoHistorico(f.codigo), desde: data(f.desde) }));
  return (
    <section aria-labelledby="instrumento-fases" className="mp-radar-secao">
      <h2 id="instrumento-fases" className="mp-radar-h2">
        Por onde o convênio passou
      </h2>
      {fases.length ? (
        <FasesAnimadas fases={fases} />
      ) : (
        <p className="pa-cartao pa-cartao-plano">
          Situação de agora: <strong>{leitura.instrumento.situacao ?? "não informada"}</strong>. A sequência das fases sai do
          histórico do Transferegov, que o Mapa lê para os convênios de proponente da Paraíba.
        </p>
      )}
    </section>
  );
}

/**
 * A execução: as barras, os pagamentos mês a mês e os fornecedores no nível de quem vê (D1). O público não vê
 * fornecedor; o cadastrado e o cliente veem só as somas; o administrador vê as empresas com nome.
 */
function Execucao({
  leitura,
  publico,
  administrador,
  empresas,
  pagamentos,
}: {
  leitura: LeituraOk;
  publico: boolean;
  administrador: boolean;
  empresas: LeituraEmpresasDaExecucao | null;
  pagamentos: PagamentoEmpresa[] | null;
}) {
  const i = leitura.instrumento as LeituraOk["instrumento"] & ValoresExecucao;
  const barras = barrasDaExecucao(i);
  const meses = i.detalhe ? pagamentosPorMes(leitura.eventos) : [];
  return (
    <>
      <section aria-labelledby="instrumento-execucao" className="mp-radar-secao">
        <h2 id="instrumento-execucao" className="mp-radar-h2">
          Quanto já andou
        </h2>
        <ul className="mp-mola-lista">
          {barras.map((b, k) => (
            <li key={b.id} className="mp-mola-linha">
              <span className="mp-mola-rotulo">
                <strong>{b.rotulo}</strong>
                <span className="mp-mola-explica">{b.explicacao}</span>
              </span>
              <BarraMola fracao={b.fracao} atraso={k * 0.08} tom={b.id === "fisica" ? "claro" : "marca"} />
              <span className="mp-num mp-mola-valor">{b.fracao === null ? "sem dado" : percentual(b.fracao)}</span>
            </li>
          ))}
        </ul>
        {meses.length > 0 ? (
          <GraficoPagamentos meses={meses} titulo="Pagamentos do convenente, mês a mês" />
        ) : (
          <p className="pa-nota">
            {i.detalhe ? "Nenhum pagamento registrado na linha do tempo até agora." : "Os pagamentos mês a mês existem para os convênios de proponente da Paraíba."}
          </p>
        )}
      </section>
      <section aria-labelledby="instrumento-fornecedores" className="mp-radar-secao">
        <h2 id="instrumento-fornecedores" className="mp-radar-h2">
          Para quem foi o dinheiro
        </h2>
        {publico ? (
          <p className="pa-cartao pa-cartao-plano">Os fornecedores do convênio aparecem a partir do cadastro, somados por tipo de quem recebeu.</p>
        ) : (
          <Fornecedores i={i} administrador={administrador} empresas={empresas} pagamentos={pagamentos} />
        )}
      </section>
    </>
  );
}

function Fornecedores({
  i,
  administrador,
  empresas,
  pagamentos,
}: {
  i: LeituraOk["instrumento"] & ValoresExecucao;
  administrador: boolean;
  empresas: LeituraEmpresasDaExecucao | null;
  pagamentos: PagamentoEmpresa[] | null;
}) {
  const r = resumoFornecedores(i);
  if (r.total === null || r.total <= 0) {
    return <p className="pa-cartao pa-cartao-plano">Nenhum pagamento a fornecedor registrado para este convênio até agora.</p>;
  }
  const partes = [
    { id: "pj", rotulo: "Empresas (pessoa jurídica)", valor: r.pj, nota: r.nPj !== null ? contagem(r.nPj, "empresa", "empresas") : null },
    { id: "pf", rotulo: "Pessoas físicas, somadas", valor: r.pf, nota: r.nPagamentosPf !== null ? contagem(r.nPagamentosPf, "pagamento", "pagamentos") : null },
    { id: "convenente", rotulo: "O próprio convenente", valor: r.convenente, nota: null },
  ].filter((p) => p.valor !== null && p.valor > 0);
  const lista = administrador && empresas?.estado === "ok" ? empresas.empresas : null;
  const inicio = lista?.reduce<string | null>((m, e) => (e.primeiro_pagamento && (!m || e.primeiro_pagamento < m) ? e.primeiro_pagamento : m), null) ?? null;
  const fim = lista?.reduce<string | null>((m, e) => (e.ultimo_pagamento && (!m || e.ultimo_pagamento > m) ? e.ultimo_pagamento : m), null) ?? null;
  const porEmpresa = pagamentos ? pagamentosPorEmpresa(pagamentos) : null;
  const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <>
      <ul className="mp-mola-lista">
        {partes.map((p, k) => (
          <li key={p.id} className="mp-mola-linha">
            <span className="mp-mola-rotulo">
              <strong>{p.rotulo}</strong>
              {p.nota && <span className="mp-mola-explica">{p.nota}</span>}
            </span>
            <BarraMola fracao={(p.valor as number) / (r.total as number)} atraso={k * 0.08} tom="neutro" />
            <span className="mp-num mp-mola-valor">{moedaCurta(p.valor)}</span>
          </li>
        ))}
      </ul>
      {!administrador && <p className="pa-nota">Somados por tipo de quem recebeu. O nome das empresas fica com a equipe da PONTE.</p>}
      {administrador && empresas && empresas.estado !== "ok" && <p className="pa-nota">A lista das empresas não pôde ser lida agora.</p>}
      {lista && lista.length > 0 && (
        <>
          <h3 className="mp-radar-h3">Empresas, da que recebeu mais para a que recebeu menos</h3>
          <EmpresasDaExecucao
            empresas={lista.map((e) => ({
              cnpj: e.cnpj,
              cnpjLegivel: cnpjLegivel(e.cnpj) ?? e.cnpj,
              nome: e.nome ?? "Nome não informado",
              href: urlFornecedor(e.cnpj),
              pago: moedaCurta(e.pago),
              fatia: e.fatia,
              nPagamentos: e.n_pagamentos,
              primeiro: e.primeiro_pagamento ? data(e.primeiro_pagamento) : null,
              ultimo: e.ultimo_pagamento ? data(e.ultimo_pagamento) : null,
              janela: janelaDoPagamento(e.primeiro_pagamento, e.ultimo_pagamento, inicio, fim),
              contratado: e.contratado > 0 ? moedaCurta(e.contratado) : null,
              nContratos: e.n_contratos,
              pagamentos: (() => {
                const linhas = porEmpresa?.get(e.cnpj);
                if (!linhas) return null;
                return {
                  completa: listaCompleta(linhas.length, e.n_pagamentos),
                  linhas: linhas.map((p) => ({
                    chave: p.nr_mov_fin ?? `${p.data}-${p.valor}`,
                    data: p.data ? data(p.data) : "sem data",
                    valor: reais(p.valor),
                    documento: documentoLegivel(p.documento, p.nr_documento),
                    posicao: posicaoNaJanela(p.data, inicio, fim),
                  })),
                };
              })(),
            }))}
          />
          <p className="pa-nota">Pessoa física nunca aparece com nome, nem para a equipe: só a soma, acima.</p>
        </>
      )}
    </>
  );
}
