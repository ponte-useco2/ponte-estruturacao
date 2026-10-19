/**
 * Uma emenda da Câmara de João Pessoa (J2, 16/10/2026).
 *
 *   · no exercício (painel): as linhas por unidade gestora, a dotação original e a atual, os empenhos do TCE-PB (número,
 *     data, credor, licitação), os credores que o painel lista, a pessoa física só somada e a série (o que mudou a cada
 *     rodada diária);
 *   · nos anos do portal (2021 a 2025): a execução por unidade e as linhas da lista da LOA (funcional, natureza, fonte).
 *
 * Credor pessoa jurídica com nome só aqui, em tela de administrador.
 */
import type { ReactNode } from "react";
import { resumir } from "@/lib/oportunidades/assembleia-tela";
import {
  COLUNAS_CREDORES_JP,
  COLUNAS_EMPENHOS_JP,
  COLUNAS_SERIE_JP,
  TABELA_CREDORES_JP,
  TABELA_EMPENHOS_JP,
  TABELA_SERIE_JP,
  porcento,
  valoresDaSerieJp,
  valoresDoCredorJp,
  valoresDoEmpenhoJp,
} from "@/lib/oportunidades/camara-jp-tela";
import {
  ROTULO_ETAPA,
  URL_CAMARA_JP,
  URL_FILA_EJP,
  URL_SAPL_MATERIA,
  emendasDoRetrato,
  empenhosDaEmenda,
  pct,
  urlVereadorJp,
  type LeituraEmendaJp,
} from "@/lib/oportunidades/emendas-jp";
import { formatarDataBr, type LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../../../../_design/primitivos";
import { LinkMapa } from "../../../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../../../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../../../../_componentes/TabelaRolagem";
import { CartaoNumero, CasasParlamentares, n } from "../../../PecasParlamentares";
import { AVISO_CAMARA_JP, CarimboEjp, NotaDeMetodoEjp, Secao, reais } from "../../PecasCamaraJp";

type LeituraOk = Extract<LeituraEmendaJp, { estado: "ok" }>;

const data = (iso: string | null) => (iso ? formatarDataBr(iso) : "—");
/** Contagens (empenhos e pagamentos listados, a linha) não são dinheiro. */
const ehContagem = (campo: string) => campo.endsWith("_n") || campo === "linha";

export function EmendaJpConteudo({ leitura }: { leitura: LeituraOk }) {
  const { retrato, ano, codigo, materia, movimentos } = leitura;
  const e = emendasDoRetrato(retrato).find((x) => x.ano === ano && x.codigo === codigo);
  if (!e) return null;
  const linhas = retrato.linhas.filter((l) => l.ano === ano && l.codigo === codigo);
  const dotacoes = retrato.dotacoes.filter((d) => d.ano === ano && d.codigo === codigo);
  const credores = retrato.credores.filter((c) => c.ano === ano && c.codigo === codigo);
  const empenhos = empenhosDaEmenda(retrato.empenhos, ano, codigo);
  const pf = retrato.pf.find((p) => p.ano === ano && p.codigo === codigo);
  const hist = retrato.hist.filter((h) => h.ano === ano && h.codigo === codigo);
  const loa = retrato.loa.filter((l) => l.ano === ano && l.codigo === codigo);
  const tabelaEmpenhos: LinhaTabela[] = empenhos.map((x) => ({
    chave: `${x.ug_codigo}-${x.numero_empenho}-${x.seq}`,
    valores: valoresDoEmpenhoJp(x),
    celulas: {
      data: data(x.data_empenho),
      empenhado: reais(x.empenhado),
      liquidado: reais(x.liquidado),
      pago: reais(x.pago),
    } satisfies Record<string, ReactNode>,
  }));
  const tabelaCredores: LinhaTabela[] = credores.map((c) => ({
    chave: `${c.ug}-${c.seq}`,
    valores: valoresDoCredorJp(c),
    celulas: {
      credor: <LinkMapa href={`/mapa/entidade/${c.credor_cnpj}`}>{c.credor_nome ?? c.credor_cnpj}</LinkMapa>,
      historico: resumir(c.historico),
    },
  }));
  const tabelaSerie: LinhaTabela[] = movimentos.map((m, i) => ({
    chave: `${m.referencia}-${m.ug}-${m.campo}-${i}`,
    valores: valoresDaSerieJp(m),
    celulas: {
      dia: data(m.referencia),
      antes: ehContagem(m.campo) ? (m.antes === null ? "—" : n(m.antes)) : reais(m.antes),
      depois: ehContagem(m.campo) ? (m.depois === null ? "—" : n(m.depois)) : reais(m.depois),
    },
  }));

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <CasasParlamentares atual="camara-jp" />
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Câmara de João Pessoa · emenda impositiva de {ano}</p>
        <h1 className="pa-titulo">
          Emenda {codigo}/{ano}
        </h1>
        <p className="pa-sub mp-parl-chips">
          {e.pessoa ? (
            <span>
              Vereador: <LinkMapa href={urlVereadorJp(e.pessoa)}>{e.pessoa}</LinkMapa>
            </span>
          ) : (
            <span>{e.origem === "portal" ? "Autor não publicado na lista da LOA" : "Vereador fora da tabela curada"}</span>
          )}
          <span>{ROTULO_ETAPA[e.etapa]}</span>
          {e.unidades.map((u) => (
            <span key={u}>{u}</span>
          ))}
          {e.remanejada && <Tag>remanejada de unidade</Tag>}
        </p>
        {e.objeto && (
          <p>
            <strong>Objeto:</strong> {e.objeto}
          </p>
        )}
        <p className="mp-fiscal-aviso">{AVISO_CAMARA_JP}</p>
        <CarimboEjp execucao={retrato.execucao} />
        <p className="pa-linha mp-nao-imprimir">
          {e.pessoa && (
            <LinkMapa href={urlVereadorJp(e.pessoa)} className="pa-btn pa-btn-pequeno">
              Ver a ficha do vereador
            </LinkMapa>
          )}
          {e.cnpj && (
            <LinkMapa href={`/mapa/entidade/${e.cnpj}`} className="pa-btn pa-btn-pequeno">
              Abrir a entidade citada no objeto
            </LinkMapa>
          )}
          {materia && (
            <a href={`${URL_SAPL_MATERIA}${materia.sapl_id}`} className="pa-btn pa-btn-pequeno" rel="noreferrer">
              Abrir a matéria no SAPL
            </a>
          )}
          <LinkMapa href={e.origem === "painel" ? URL_FILA_EJP : URL_CAMARA_JP} className="pa-btn pa-btn-pequeno">
            {e.origem === "painel" ? "Ver a fila da execução" : "Ver a lista dos vereadores"}
          </LinkMapa>
        </p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <CartaoNumero titulo="Valor original" numero={reais(e.original)} nota={e.origem === "painel" ? "da tabela de dotação do painel" : "do arquivo de execução do portal"} />
        <CartaoNumero titulo="Valor atual" numero={reais(e.atual)} nota="depois de remanejamentos e cortes" />
        <CartaoNumero titulo="Empenhado" numero={reais(e.empenhado)} nota={`${porcento(pct(e.empenhado, e.atual))} do valor atual`} />
        <CartaoNumero titulo="Pago" numero={reais(e.pago)} nota={`${porcento(pct(e.pago, e.atual))} do valor atual`} />
      </div>

      {materia && (
        <Secao id="cjp-em-materia" titulo="A matéria no SAPL da Câmara">
          <p>
            Emenda ao PL Orçamentário Anual nº {materia.numero}/{materia.ano}, apresentada em {data(materia.data_apresentacao)}
            {materia.em_tramitacao === false ? " (tramitação encerrada no SAPL)" : " (em tramitação no SAPL)"}. {materia.ementa ? `Ementa: ${materia.ementa}` : ""}
          </p>
        </Secao>
      )}

      {linhas.length > 0 && (
        <Secao id="cjp-em-linhas" titulo="No painel da Prefeitura, por unidade gestora" nota="A linha com valor zero é a da unidade de onde a emenda saiu (remanejada).">
          <TabelaRolagem rotulo="As linhas da emenda no painel">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Unidade gestora</th>
                  <th scope="col">Valor atual</th>
                  <th scope="col">Empenhado</th>
                  <th scope="col">Liquidado</th>
                  <th scope="col">Pago</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Empenhos e pagamentos listados</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.ug}>
                    <th scope="row" className="mp-th-celula">
                      {l.ug}
                      {l.remanejada && <Tag>remanejada</Tag>}
                    </th>
                    <td className="mp-rel-num">{reais(l.dotacao)}</td>
                    <td className="mp-rel-num">{reais(l.empenhado)}</td>
                    <td className="mp-rel-num">{reais(l.liquidado)}</td>
                    <td className="mp-rel-num">{reais(l.pago)}</td>
                    <td>{l.situacao ?? "—"}</td>
                    <td className="mp-rel-num">
                      {n(l.empenhos_n)} · {n(l.pagamentos_n)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
          {dotacoes.length > 0 && (
            <p className="pa-nota">
              Dotação:{" "}
              {dotacoes.map((d) => `${reais(d.valor_original)} → ${reais(d.valor_atual)}${d.data ? ` (${data(d.data)})` : ""}`).join("; ")}.
            </p>
          )}
        </Secao>
      )}

      {e.origem === "painel" && (
        <Secao
          id="cjp-em-empenhos"
          titulo="Os empenhos no TCE-PB"
          nota="A despesa de João Pessoa no TCE-PB com o código de acompanhamento 3310 (emendas de vereador), ligada a esta emenda pelo número citado no histórico do empenho."
        >
          {tabelaEmpenhos.length ? (
            <TabelaFiltravel
              id={TABELA_EMPENHOS_JP}
              rotulo={`Empenhos da emenda ${codigo}/${ano}`}
              colunas={COLUNAS_EMPENHOS_JP}
              linhas={tabelaEmpenhos}
              descricaoOrdemPadrao="pela unidade e pelo número do empenho"
              csv={{ nome: `camara-joao-pessoa-emenda-${ano}-${codigo}-empenhos` }}
            />
          ) : (
            <p className="pa-nota">
              Nenhum empenho do TCE-PB cita esta emenda no histórico. {e.empenhado > 0 ? "O painel mostra empenho: pode estar num empenho sem a citação." : ""}
            </p>
          )}
          {pf && pf.notas > 0 && (
            <p className="pa-nota">
              Pessoa física (só somada): {n(pf.notas)} {pf.notas === 1 ? "nota" : "notas"}, {reais(pf.empenhado)} empenhados e {reais(pf.pago)} pagos.
            </p>
          )}
        </Secao>
      )}

      {credores.length > 0 && (
        <Secao id="cjp-em-credores" titulo="Os credores que o painel lista" nota="Pessoa jurídica; o painel não traz número nem valor do empenho, só o credor e a forma de contratação.">
          <TabelaFiltravel
            id={TABELA_CREDORES_JP}
            rotulo={`Credores listados no painel na emenda ${codigo}/${ano}`}
            colunas={COLUNAS_CREDORES_JP}
            linhas={tabelaCredores}
            descricaoOrdemPadrao="pela unidade"
            csv={{ nome: `camara-joao-pessoa-emenda-${ano}-${codigo}-credores` }}
          />
        </Secao>
      )}

      {e.origem === "painel" && (
        <Secao
          id="cjp-em-serie"
          titulo="O que mudou, rodada a rodada"
          nota="O painel só mostra o dia. A PONTE guarda, a cada leitura diária, o que mudou em cada linha desde a anterior."
        >
          {movimentos.length ? (
            <TabelaFiltravel
              id={TABELA_SERIE_JP}
              rotulo={`O que mudou na emenda ${codigo}/${ano}`}
              colunas={COLUNAS_SERIE_JP}
              linhas={tabelaSerie}
              descricaoOrdemPadrao="pela rodada, da mais antiga"
              csv={{ nome: `camara-joao-pessoa-emenda-${ano}-${codigo}-serie` }}
            />
          ) : (
            <p className="pa-nota">Nada mudou desde a primeira leitura (a série começa no dia seguinte à primeira rodada).</p>
          )}
        </Secao>
      )}

      {hist.length > 0 && (
        <Secao id="cjp-em-hist" titulo="Na execução do portal da Prefeitura" nota={`Posição de ${(hist[0].mes_referencia ?? "—").toLowerCase()} de ${ano}.`}>
          <TabelaRolagem rotulo="A execução da emenda no portal">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Unidade gestora</th>
                  <th scope="col">Valor original</th>
                  <th scope="col">Valor atual</th>
                  <th scope="col">Empenhado</th>
                  <th scope="col">Liquidado</th>
                  <th scope="col">Pago</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h) => (
                  <tr key={h.ug_codigo}>
                    <th scope="row" className="mp-th-celula">
                      {h.ug_nome ?? h.ug_codigo}
                    </th>
                    <td className="mp-rel-num">{reais(h.original)}</td>
                    <td className="mp-rel-num">{reais(h.atual)}</td>
                    <td className="mp-rel-num">{reais(h.empenhado)}</td>
                    <td className="mp-rel-num">{reais(h.liquidado)}</td>
                    <td className="mp-rel-num">{reais(h.pago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </Secao>
      )}

      {loa.length > 0 && (
        <Secao id="cjp-em-loa" titulo="Na lista da LOA" nota="As linhas da emenda no demonstrativo das emendas parlamentares da LOA, publicado no portal.">
          <TabelaRolagem rotulo="As linhas da emenda na lista da LOA">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Autor (como publicado)</th>
                  <th scope="col">Funcional programática</th>
                  <th scope="col">Natureza</th>
                  <th scope="col">Fonte</th>
                  <th scope="col">Valor</th>
                </tr>
              </thead>
              <tbody>
                {loa.map((l) => (
                  <tr key={l.seq}>
                    <th scope="row" className="mp-th-celula">
                      {l.autor_publicado ?? "—"}
                    </th>
                    <td>{l.funcional ?? "—"}</td>
                    <td>{l.natureza ?? "—"}</td>
                    <td>{l.fonte ?? "—"}</td>
                    <td className="mp-rel-num">{reais(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </Secao>
      )}
      <NotaDeMetodoEjp id="cjp-em-como-ler" />
    </div>
  );
}
