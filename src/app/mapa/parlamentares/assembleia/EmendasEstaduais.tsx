/**
 * As emendas estaduais na página do município e na da entidade (E2, 16/10/2026): só para o administrador, até a
 * revisão jurídica, na aba do dinheiro. A leitura é a mesma das telas da Assembleia (`lerAssembleia`, memória de 10
 * minutos na instância); `sem_dado` e `falha` dão uma linha discreta e nunca derrubam a página.
 *
 * Federal e estadual são dinheiros diferentes: ficam lado a lado, cada um com a sua fonte, e nunca se somam.
 *
 *   · no município: as transferências a municípios com a prefeitura ou o fundo como credor e, à parte, as entidades sem
 *     fins lucrativos com sede nele. A aplicação direta fica fora (o credor é fornecedor do Estado);
 *   · na entidade: o que ela recebeu como credora do empenho, em qualquer modalidade.
 */
import {
  COLUNAS_CREDORES,
  COLUNAS_EMENDAS_DO_LUGAR,
  TABELA_EPB_ENTIDADE,
  TABELA_EPB_ENTIDADES_MUNICIPIO,
  TABELA_EPB_MUNICIPIO,
  resumir,
  valoresDaEmendaNoLugar,
  valoresDoCredor,
} from "@/lib/oportunidades/assembleia-tela";
import {
  ROTULO_MODALIDADE,
  ROTULO_PASSO,
  URL_ASSEMBLEIA,
  destinoDe,
  emendasPbDaEntidade,
  emendasPbDoMunicipio,
  urlDeputado,
  urlEmendaEpb,
  type EmendasPbDoLugar,
  type LeituraAssembleia,
} from "@/lib/oportunidades/emendas-pb";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import type { ReactNode } from "react";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";

const TITULO = "Emendas estaduais (Assembleia da PB)";

/**
 * A seção, com o mesmo desenho do `Secao` do relatório do município. Não o importa: o relatório importa este bloco, e a
 * importação de volta faria um ciclo.
 */
function Secao({ id, titulo, nota, children }: { id: string; titulo: string; nota: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      <p className="pa-nota">{nota}</p>
      {children}
    </section>
  );
}
const n = (x: number) => x.toLocaleString("pt-BR");

function Indisponivel({ leitura }: { leitura: Exclude<LeituraAssembleia, { estado: "ok" }> }) {
  return (
    <p className="pa-nota">
      {TITULO}:{" "}
      {leitura.estado === "sem_dado"
        ? "as emendas estaduais ainda não foram carregadas."
        : "as emendas estaduais não puderam ser lidas agora. Tente de novo em alguns minutos."}
    </p>
  );
}

function linhasDoLugar(l: EmendasPbDoLugar): LinhaTabela[] {
  return l.emendas.map((e) => ({
    chave: e.emenda,
    valores: valoresDaEmendaNoLugar(e),
    celulas: {
      emenda: (
        <LinkMapa href={urlEmendaEpb(e.emenda)} className="mp-tabela-principal">
          {e.emenda}
        </LinkMapa>
      ),
      ano: String(e.ano),
      deputado: e.pessoa ? <LinkMapa href={urlDeputado(e.pessoa)}>{e.pessoa}</LinkMapa> : "—",
      objeto: <span title={e.objeto ?? undefined}>{resumir(e.objeto)}</span>,
      empenhado: moedaCurta(e.empenhadoAqui),
      pago: moedaCurta(e.pagoAqui),
      passo: e.temFicha ? ROTULO_PASSO[e.passo] : "Sem ficha",
    },
  }));
}

/** O bloco da página do município (aba do dinheiro). */
export function EmendasEstaduaisDoMunicipio({ leitura, ibge, municipio }: { leitura: LeituraAssembleia; ibge: string; municipio: string }) {
  if (leitura.estado !== "ok") return <Indisponivel leitura={leitura} />;
  const { retrato } = leitura;
  const { publico, entidades } = emendasPbDoMunicipio(retrato, ibge);
  const credores = destinoDe(retrato, entidades.emendas).credores.filter((c) => c.ibge === ibge && c.modalidade === "entidades");
  const deputados = new Set([...publico.porDeputado, ...entidades.porDeputado].map((d) => d.pessoa)).size;
  return (
    <Secao
      id="mun-emendas-estaduais"
      titulo={TITULO}
      nota={
        <>
          Só para administrador. As emendas impositivas dos deputados estaduais que chegaram a {municipio} pelo empenho: as transferências a
          municípios com a prefeitura ou o fundo como credor e, à parte, as entidades sem fins lucrativos com sede no município. A aplicação
          direta do Estado fica fora (o credor é fornecedor). É dinheiro do Estado, à parte das emendas federais acima: os dois nunca se
          somam. API de dados abertos da PB lida em {dataBrasilia(retrato.execucao.dadoAte ?? retrato.execucao.concluidaEm)}.
        </>
      }
    >
      {publico.emendas.length === 0 && entidades.emendas.length === 0 ? (
        <p>Nenhum empenho de emenda estadual para a prefeitura, os fundos ou as entidades com sede em {municipio}.</p>
      ) : (
        <>
          <p>
            {n(deputados)} {deputados === 1 ? "deputado estadual" : "deputados estaduais"}. Prefeitura e fundos: {n(publico.emendas.length)}{" "}
            {publico.emendas.length === 1 ? "emenda" : "emendas"}, {moedaCurta(publico.empenhado)} empenhados e {moedaCurta(publico.pago)}{" "}
            pagos. Entidades com sede no município: {n(entidades.emendas.length)} {entidades.emendas.length === 1 ? "emenda" : "emendas"},{" "}
            {moedaCurta(entidades.empenhado)} empenhados e {moedaCurta(entidades.pago)} pagos.
          </p>
          {publico.emendas.length > 0 && (
            <TabelaFiltravel
              id={TABELA_EPB_MUNICIPIO}
              rotulo={`${TITULO}: prefeitura e fundos`}
              colunas={COLUNAS_EMENDAS_DO_LUGAR}
              linhas={linhasDoLugar(publico)}
              descricaoOrdemPadrao="por ano e número da emenda"
              csv={{ nome: `emendas-estaduais-${ibge}-prefeitura-e-fundos` }}
            />
          )}
          {credores.length > 0 && (
            <>
              <h3 className="mp-radar-h3">Entidades sem fins lucrativos com sede em {municipio}</h3>
              <TabelaFiltravel
                id={TABELA_EPB_ENTIDADES_MUNICIPIO}
                rotulo={`${TITULO}: entidades com sede no município`}
                colunas={COLUNAS_CREDORES}
                linhas={credores.map(
                  (c): LinhaTabela => ({
                    chave: c.cnpj,
                    valores: valoresDoCredor(c),
                    celulas: {
                      credor: c.nome ?? c.cnpj,
                      municipio: c.municipio ?? "—",
                      modalidade: ROTULO_MODALIDADE[c.modalidade],
                      emendas: n(c.emendas),
                      empenhado: moedaCurta(c.empenhado),
                      pago: moedaCurta(c.pago),
                    },
                  }),
                )}
                descricaoOrdemPadrao="por nome da entidade"
                csv={{ nome: `emendas-estaduais-${ibge}-entidades` }}
              />
            </>
          )}
        </>
      )}
      <p className="pa-linha mp-nao-imprimir">
        <LinkMapa href={URL_ASSEMBLEIA} className="pa-btn pa-btn-pequeno">
          Ver as emendas da Assembleia
        </LinkMapa>
      </p>
    </Secao>
  );
}

/** O bloco da página da entidade (aba do dinheiro): o que ela recebeu como credora do empenho. */
export function EmendasEstaduaisDaEntidade({ leitura, cnpj, nome }: { leitura: LeituraAssembleia; cnpj: string; nome: string }) {
  if (leitura.estado !== "ok") return <Indisponivel leitura={leitura} />;
  const { retrato } = leitura;
  const l = emendasPbDaEntidade(retrato, cnpj);
  return (
    <Secao
      id="ent-emendas-estaduais"
      titulo={TITULO}
      nota={
        <>
          Só para administrador. As emendas impositivas dos deputados estaduais com {nome} como credora do empenho, em qualquer modalidade.
          É dinheiro do Estado, à parte das emendas federais: os dois nunca se somam. API de dados abertos da PB lida em{" "}
          {dataBrasilia(retrato.execucao.dadoAte ?? retrato.execucao.concluidaEm)}.
        </>
      }
    >
      {l.emendas.length === 0 ? (
        <p>Nenhum empenho de emenda estadual com esta entidade como credora (emendas de 2021 em diante).</p>
      ) : (
        <>
          <p>
            {n(l.emendas.length)} {l.emendas.length === 1 ? "emenda" : "emendas"} de {n(l.porDeputado.length)}{" "}
            {l.porDeputado.length === 1 ? "deputado" : "deputados"}: {moedaCurta(l.empenhado)} empenhados e {moedaCurta(l.pago)} pagos.
          </p>
          <TabelaFiltravel
            id={TABELA_EPB_ENTIDADE}
            rotulo={`${TITULO} com esta entidade como credora`}
            colunas={COLUNAS_EMENDAS_DO_LUGAR}
            linhas={linhasDoLugar(l)}
            descricaoOrdemPadrao="por ano e número da emenda"
            csv={{ nome: `emendas-estaduais-${cnpj}` }}
          />
        </>
      )}
      <p className="pa-linha mp-nao-imprimir">
        <LinkMapa href={URL_ASSEMBLEIA} className="pa-btn pa-btn-pequeno">
          Ver as emendas da Assembleia
        </LinkMapa>
      </p>
    </Secao>
  );
}
