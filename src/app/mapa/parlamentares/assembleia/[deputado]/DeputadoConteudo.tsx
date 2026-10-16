/**
 * A ficha de um deputado estadual (E2, 16/10/2026). Recebe o retrato e a pessoa; aqui só se apresenta.
 *
 *   · ano a ano, sempre ao lado da Assembleia inteira na mesma safra: a única comparação justa (a safra nova ainda está
 *     pagando, e a diferença pode ser da secretaria, da SEFAZ, do município ou da entidade);
 *   · cada emenda com o passo do caminho e os dias nele, levando à página da emenda (com os pareceres);
 *   · o destino pelo empenho: os municípios atendidos (transferência a municípios) e os credores pessoa jurídica com a
 *     modalidade. A pessoa física é só somada.
 */
import type { ReactNode } from "react";
import {
  COLUNAS_ANOS_DEPUTADO,
  COLUNAS_CREDORES,
  COLUNAS_EMENDAS,
  COLUNAS_MUNICIPIOS,
  TABELA_ANOS_DEPUTADO,
  TABELA_CREDORES_DEPUTADO,
  TABELA_EMENDAS_DEPUTADO,
  TABELA_MUNICIPIOS_DEPUTADO,
  porcento,
  resumir,
  valoresDaEmenda,
  valoresDoAno,
  valoresDoCredor,
  valoresDoMunicipio,
  vezDaEmenda,
} from "@/lib/oportunidades/assembleia-tela";
import {
  ROTULO_MODALIDADE,
  ROTULO_PASSO,
  URL_ASSEMBLEIA,
  URL_FILA_EPB,
  anosDoDeputado,
  deputadosDoRetrato,
  destinoDe,
  diasEntre,
  emendasDoRetrato,
  pct,
  urlEmendaEpb,
  type RetratoEpb,
} from "@/lib/oportunidades/emendas-pb";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../../../_design/primitivos";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../../_componentes/TabelaFiltravel";
import { CartaoNumero, CasasParlamentares, dinheiro, n } from "../../PecasParlamentares";
import { AVISO_ASSEMBLEIA, CarimboEpb, NotaDeMetodoEpb } from "../PecasAssembleia";

const TOTAL_MUNICIPIOS_PB = 223;

export function DeputadoConteudo({ retrato, pessoa, hoje }: { retrato: RetratoEpb; pessoa: string; hoje: string }) {
  const todas = emendasDoRetrato(retrato);
  const dele = todas.filter((e) => e.pessoa === pessoa);
  const dep = deputadosDoRetrato(retrato).find((d) => d.pessoa === pessoa);
  const anos = anosDoDeputado(todas, pessoa);
  const destino = destinoDe(retrato, dele);
  const naoPagas = dele.filter((e) => e.temFicha && e.passo !== "paga");
  const valor = dele.reduce((s, e) => s + e.valor, 0);
  const pago = dele.reduce((s, e) => s + e.pago, 0);
  const slug = dep?.slug ?? pessoa;

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <CasasParlamentares atual="assembleia" />
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Assembleia (PB) · deputado estadual</p>
        <h1 className="pa-titulo">{pessoa}</h1>
        <p className="pa-sub mp-parl-chips">
          <span>
            {n(dele.length)} {dele.length === 1 ? "emenda" : "emendas"}
          </span>
          {dep?.anoMin != null && (
            <span>{dep.anoMin === dep.anoMax ? `ano ${dep.anoMin}` : `anos ${dep.anoMin} a ${dep.anoMax}`}</span>
          )}
          {dep && dep.divergentes > 0 && <span>{n(dep.divergentes)} com autoria divergente</span>}
        </p>
        {dep?.fonte ? (
          <p>
            Grafias publicadas — no catálogo: <strong>{dep.grafiasCatalogo.join(", ") || "—"}</strong>; na ficha:{" "}
            <strong>{dep.grafiasFicha.join(", ") || "—"}</strong>. Ligadas a uma pessoa pela tabela curada da PONTE ({dep.fonte}).
          </p>
        ) : (
          <p>
            <Tag>fora da tabela curada</Tag> A grafia publicada ainda não está ligada a uma pessoa: entra na tabela na revisão seguinte.
          </p>
        )}
        <p className="mp-fiscal-aviso">{AVISO_ASSEMBLEIA}</p>
        <CarimboEpb execucao={retrato.execucao} />
        <p className="pa-linha mp-nao-imprimir">
          <LinkMapa href={URL_ASSEMBLEIA} className="pa-btn pa-btn-pequeno">
            Ver a lista dos deputados
          </LinkMapa>
          <LinkMapa href={URL_FILA_EPB} className="pa-btn pa-btn-pequeno">
            Ver a fila do caminho
          </LinkMapa>
        </p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <CartaoNumero titulo="Valor das emendas" numero={dinheiro(valor)} nota={`${n(dele.length)} emendas, todas as safras`} />
        <CartaoNumero titulo="Pago" numero={dinheiro(pago)} nota={`${porcento(pct(pago, valor))} do valor; compare na mesma safra, abaixo`} />
        <CartaoNumero
          titulo="Ainda não pagas"
          numero={n(naoPagas.length)}
          nota={`${dinheiro(naoPagas.reduce((s, e) => s + Math.max(0, e.valor - e.pago), 0))} por pagar`}
        />
        <CartaoNumero
          titulo="Municípios atendidos"
          numero={`${n(destino.municipios.length)} de ${TOTAL_MUNICIPIOS_PB}`}
          nota="prefeitura ou fundo credor, nas transferências a municípios"
        />
      </div>

      <section aria-labelledby="alpb-dep-anos" className="mp-radar-secao">
        <h2 id="alpb-dep-anos" className="mp-radar-h2">
          Ano a ano, ao lado da Assembleia na mesma safra
        </h2>
        <p className="pa-nota">
          Pago ÷ valor do deputado e da Assembleia inteira no mesmo ano da emenda. A safra corrente ainda está pagando, e a diferença pode
          ser da secretaria, da SEFAZ, do município ou da entidade: é ponto para olhar, não nota.
        </p>
        <TabelaFiltravel
          id={TABELA_ANOS_DEPUTADO}
          rotulo="Ano a ano, ao lado da Assembleia na mesma safra"
          colunas={COLUNAS_ANOS_DEPUTADO}
          linhas={anos.map(
            (a): LinhaTabela => ({
              chave: String(a.ano),
              valores: valoresDoAno(a),
              celulas: {
                ano: String(a.ano),
                emendas: n(a.emendas),
                valor: dinheiro(a.valor),
                empenhado: dinheiro(a.empenhado),
                pago: dinheiro(a.pago),
                pct: porcento(a.pctPago),
                "pct-assembleia": porcento(a.pctPagoAssembleia),
                "no-caminho": a.noCaminho ? n(a.noCaminho) : "—",
              },
            }),
          )}
          ordemPadrao={{ coluna: "ano", sentido: "desc" }}
          csv={{ nome: `assembleia-${slug}-por-ano` }}
        />
      </section>

      <section aria-labelledby="alpb-dep-emendas" className="mp-radar-secao">
        <h2 id="alpb-dep-emendas" className="mp-radar-h2">
          As {n(dele.length)} emendas
        </h2>
        <p className="pa-nota">
          Cada número abre a emenda, com o catálogo, o caminho com os pareceres e o destino. “Onde está” é o último passo com data; os dias
          são contados hoje.
        </p>
        <TabelaFiltravel
          id={TABELA_EMENDAS_DEPUTADO}
          rotulo={`As emendas de ${pessoa}`}
          colunas={COLUNAS_EMENDAS}
          linhas={dele.map((e): LinhaTabela => {
            const valores = valoresDaEmenda(e, hoje);
            const vez = vezDaEmenda(e);
            const dias = e.temFicha && e.passo !== "paga" ? diasEntre(e.passoEm, hoje) : null;
            return {
              chave: e.emenda,
              valores,
              celulas: {
                emenda: (
                  <LinkMapa href={urlEmendaEpb(e.emenda)} className="mp-tabela-principal">
                    {e.emenda}
                  </LinkMapa>
                ),
                ano: String(e.ano),
                objeto: <span title={e.objeto ?? undefined}>{resumir(e.objeto)}</span>,
                secretaria: e.secretaria ?? "—",
                valor: dinheiro(e.valor),
                empenhado: dinheiro(e.empenhado),
                pago: dinheiro(e.pago),
                passo: celulaPasso(e.temFicha ? ROTULO_PASSO[e.passo] : "Sem ficha", vez, e.devolvida),
                dias: dias === null ? "—" : n(dias),
              },
            };
          })}
          ordemPadrao={{ coluna: "ano", sentido: "desc" }}
          csv={{ nome: `assembleia-${slug}-emendas` }}
        />
      </section>

      <section aria-labelledby="alpb-dep-municipios" className="mp-radar-secao">
        <h2 id="alpb-dep-municipios" className="mp-radar-h2">
          Municípios atendidos
        </h2>
        <p className="pa-nota">
          Pelo empenho, nas transferências a municípios: o município da prefeitura ou do fundo credor. O empenhado e o pago são o que foi
          empenhado e pago a esse credor.
        </p>
        {destino.municipios.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma transferência a município com empenho.</p>
        ) : (
          <TabelaFiltravel
            id={TABELA_MUNICIPIOS_DEPUTADO}
            rotulo="Municípios atendidos"
            colunas={COLUNAS_MUNICIPIOS}
            linhas={destino.municipios.map(
              (m): LinhaTabela => ({
                chave: m.ibge,
                valores: valoresDoMunicipio(m),
                celulas: {
                  municipio: <LinkMapa href={`/mapa/municipio/${m.ibge}`}>{m.municipio}</LinkMapa>,
                  emendas: n(m.emendas),
                  empenhado: dinheiro(m.empenhado),
                  pago: dinheiro(m.pago),
                },
              }),
            )}
            descricaoOrdemPadrao="por nome do município"
            csv={{ nome: `assembleia-${slug}-municipios` }}
          />
        )}
      </section>

      <section aria-labelledby="alpb-dep-credores" className="mp-radar-secao">
        <h2 id="alpb-dep-credores" className="mp-radar-h2">
          Credores (pessoa jurídica)
        </h2>
        <p className="pa-nota">
          Todos os credores do empenho, com a modalidade da emenda. Na entidade sem fins lucrativos, o município é a sede dela; na aplicação
          direta, o credor é fornecedor do Estado. Nome de pessoa jurídica só nesta tela de administrador.
          {destino.pf.emendas > 0 &&
            ` Pessoa física, só somada: ${n(destino.pf.emendas)} ${destino.pf.emendas === 1 ? "emenda" : "emendas"}, ${dinheiro(destino.pf.empenhado)} empenhados e ${dinheiro(destino.pf.pago)} pagos.`}
        </p>
        {destino.credores.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum credor pessoa jurídica com empenho.</p>
        ) : (
          <TabelaFiltravel
            id={TABELA_CREDORES_DEPUTADO}
            rotulo="Credores pessoa jurídica"
            colunas={COLUNAS_CREDORES}
            linhas={destino.credores.map(
              (c): LinhaTabela => ({
                chave: `${c.cnpj}-${c.modalidade}`,
                valores: valoresDoCredor(c),
                celulas: {
                  credor: c.nome ?? c.cnpj,
                  municipio: c.municipio ?? "—",
                  modalidade: ROTULO_MODALIDADE[c.modalidade],
                  emendas: n(c.emendas),
                  empenhado: dinheiro(c.empenhado),
                  pago: dinheiro(c.pago),
                },
              }),
            )}
            descricaoOrdemPadrao="por nome do credor"
            csv={{ nome: `assembleia-${slug}-credores` }}
          />
        )}
      </section>

      <NotaDeMetodoEpb id="alpb-dep-como-ler" />
    </div>
  );
}

function celulaPasso(rotulo: string, vez: string | null, devolvida: boolean): ReactNode {
  return (
    <>
      {rotulo}
      {vez && <span className="mp-tabela-secundario">vez de {vez}</span>}
      {devolvida && <Tag>com devolução</Tag>}
    </>
  );
}
