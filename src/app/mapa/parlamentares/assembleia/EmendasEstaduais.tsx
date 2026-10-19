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
import { anosNoTce, temAlgoNoTce, type AnoNoTce, type LeituraTceEstadoMunicipio } from "@/lib/oportunidades/tce-estado";
import {
  ladoALado3,
  type EstadualAno,
  type LeituraFederalPorAno,
  type LinhaLadoALado3,
  type MunicipalAno,
} from "@/lib/oportunidades/lado-a-lado";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";
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

/** O municipal no lado a lado da página de João Pessoa (J3, 19/10/2026). */
export const NOTA_MUNICIPAL_JP =
  "A municipal é a das emendas impositivas da Câmara de João Pessoa: o orçamento do próprio município indicado pelos vereadores, " +
  "com o valor atual e o pago, cada ano com a sua fonte (painel da Prefeitura no exercício; portal de 2021 a 2025, e 2023 só com a " +
  "posição de agosto). Não é dinheiro que chega de fora.";

/**
 * Federal e estadual lado a lado, por ano da emenda (E3, 16/10/2026), e o municipal ao lado quando houver (J3,
 * 19/10/2026): dinheiros diferentes, que nunca se somam. Sem a leitura federal, a tabela não aparece; com ela vazia de
 * 2021 em diante, também não.
 */
function LadoALado({
  federal,
  estadual,
  municipal,
  notaMunicipal,
  quem,
}: {
  federal: LeituraFederalPorAno | undefined;
  estadual: EstadualAno[];
  municipal?: readonly MunicipalAno[];
  notaMunicipal?: string;
  quem: string;
}) {
  if (federal?.estado === "falha") return <p className="pa-nota">As emendas federais por ano não puderam ser lidas agora.</p>;
  if (federal?.estado !== "ok") return null;
  return (
    <TabelaLadoALado
      linhas={ladoALado3(federal.anos, estadual, municipal ?? [])}
      quem={quem}
      notaMunicipal={municipal?.length ? (notaMunicipal ?? NOTA_MUNICIPAL_JP) : null}
    />
  );
}

/**
 * A tabela das esferas lado a lado. Com `notaMunicipal`, entram as duas colunas da Câmara de João Pessoa (o valor atual
 * e o pago) e a nota que diz de onde vêm; sem ela, só a federal e a estadual. Também na página da emenda municipal.
 */
export function TabelaLadoALado({ linhas, quem, notaMunicipal }: { linhas: LinhaLadoALado3[]; quem: string; notaMunicipal: string | null }) {
  if (!linhas.length) return null;
  const comMunicipal = notaMunicipal !== null;
  const esferas = comMunicipal ? "federais, estaduais e municipais" : "federais e estaduais";
  const v = (x: number) => (x ? moedaCurta(x) : "—");
  return (
    <>
      <h3 className="mp-radar-h3">{comMunicipal ? "Federal, estadual e municipal, lado a lado" : "Federal e estadual, lado a lado"}</h3>
      <p className="pa-nota">
        Por ano da emenda, de 2021 em diante, para {quem}. A federal é a dos canais com destino (convênio, Pix, saúde fundo a fundo e pago ao
        favorecido): o valor em instrumento válido e o pago. A estadual é a da Assembleia pelo empenho. {comMunicipal ? `${notaMunicipal} ` : ""}
        São dinheiros diferentes, com fontes, regras e definições diferentes: ficam lado a lado e nunca se somam.
      </p>
      <TabelaRolagem rotulo={`Emendas ${esferas}, lado a lado, para ${quem}`}>
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Ano da emenda</th>
              <th scope="col">Federal: válido</th>
              <th scope="col">Federal: pago</th>
              <th scope="col">Estadual: empenhado</th>
              <th scope="col">Estadual: pago</th>
              {comMunicipal && <th scope="col">Municipal: valor atual</th>}
              {comMunicipal && <th scope="col">Municipal: pago</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.ano}>
                <th scope="row" className="mp-th-celula">
                  {l.ano}
                </th>
                <td className="mp-rel-num">{v(l.federalValido)}</td>
                <td className="mp-rel-num">{v(l.federalPago)}</td>
                <td className="mp-rel-num">{v(l.estadualEmpenhado)}</td>
                <td className="mp-rel-num">{v(l.estadualPago)}</td>
                {comMunicipal && <td className="mp-rel-num">{v(l.municipalAtual)}</td>}
                {comMunicipal && <td className="mp-rel-num">{v(l.municipalPago)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
    </>
  );
}

/** O empenhado e o pago das emendas de um lugar, por ano da emenda. */
function estadualPorAno(l: EmendasPbDoLugar): EstadualAno[] {
  const m = new Map<number, EstadualAno>();
  for (const e of l.emendas) {
    const a = m.get(e.ano) ?? { ano: e.ano, empenhado: 0, pago: 0 };
    a.empenhado += e.empenhadoAqui;
    a.pago += e.pagoAqui;
    m.set(e.ano, a);
  }
  return [...m.values()];
}

/** O valor do quadro do TCE-PB: null é "não verificado" (o arquivo não foi lido), nunca zero. */
const doTce = (v: number | null) => (v === null ? "não verificado" : moedaCurta(v));

/**
 * O que o município registrou no TCE-PB (E3, 16/10/2026), ao lado do que o Estado diz ter pago. O pago pelo Estado vai
 * pelo ano da emenda e o recebido pelo ano do caixa: a emenda paga no fim do ano entra como receita do seguinte. Por
 * isso os dois ficam lado a lado e nunca se subtraem.
 */
function NoTce({ anos, municipio, dadoAte }: { anos: AnoNoTce[]; municipio: string; dadoAte: string | null }) {
  return (
    <>
      <h3 className="mp-radar-h3">No TCE-PB: o que {municipio} registrou</h3>
      <p className="pa-nota">
        O recebido do Estado e o gasto com fonte estadual, pelas receitas e despesas que o município envia ao Tribunal de Contas (arquivos
        do TCE-PB até {dataBrasilia(dadoAte)}). O CO 3210 marca a emenda individual estadual; a fonte 710 é a transferência especial dos
        Estados (o “Pix estadual”) e a 701, o convênio estadual. O pago pelo Estado conta pelo ano da emenda, e o recebido, pelo ano do
        caixa: a emenda paga em dezembro pode entrar como receita de janeiro. O rendimento da conta fica à parte.
      </p>
      <TabelaRolagem rotulo={`No TCE-PB: o que ${municipio} registrou do dinheiro do Estado`}>
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col">Pago pelo Estado (emendas do ano)</th>
              <th scope="col">Recebido como emenda (CO 3210)</th>
              <th scope="col">Recebido na fonte 710</th>
              <th scope="col">Gasto na fonte 710</th>
              <th scope="col">Capital no gasto 710</th>
              <th scope="col">Convênio estadual (701): recebido</th>
              <th scope="col">Convênio estadual (701): gasto</th>
            </tr>
          </thead>
          <tbody>
            {anos.map((a) => (
              <tr key={a.ano}>
                <th scope="row" className="mp-th-celula">
                  {a.ano}
                  {a.motivo && <span className="mp-tabela-secundario">{a.motivo}</span>}
                </th>
                <td className="mp-rel-num">{a.pagoPeloEstado ? moedaCurta(a.pagoPeloEstado) : "—"}</td>
                <td className="mp-rel-num">{doTce(a.recebidoEmenda)}</td>
                <td className="mp-rel-num">
                  {doTce(a.recebidoPix)}
                  {a.rendimentoPix ? <span className="mp-tabela-secundario">+ {moedaCurta(a.rendimentoPix)} de rendimento</span> : null}
                </td>
                <td className="mp-rel-num">{doTce(a.gastoPix)}</td>
                <td className="mp-rel-num">{a.pctCapitalPix === null ? "—" : `${a.pctCapitalPix.toLocaleString("pt-BR")}%`}</td>
                <td className="mp-rel-num">{doTce(a.recebidoConvenio)}</td>
                <td className="mp-rel-num">{doTce(a.gastoConvenio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
    </>
  );
}

/** O bloco da página do município (aba do dinheiro). */
export function EmendasEstaduaisDoMunicipio({
  leitura,
  ibge,
  municipio,
  tce,
  federal,
  municipal,
}: {
  leitura: LeituraAssembleia;
  ibge: string;
  municipio: string;
  /** O que o município registrou no TCE-PB (E3); ausente, o quadro não aparece. */
  tce?: LeituraTceEstadoMunicipio;
  /** As emendas federais por ano, da prefeitura e dos fundos (E3); ausente, a tabela lado a lado não aparece. */
  federal?: LeituraFederalPorAno;
  /** As emendas da Câmara Municipal por ano (J3; só João Pessoa); ausente, a coluna municipal não aparece. */
  municipal?: readonly MunicipalAno[];
}) {
  if (leitura.estado !== "ok") return <Indisponivel leitura={leitura} />;
  const { retrato } = leitura;
  const { publico, entidades } = emendasPbDoMunicipio(retrato, ibge);
  const credores = destinoDe(retrato, entidades.emendas).credores.filter((c) => c.ibge === ibge && c.modalidade === "entidades");
  const deputados = new Set([...publico.porDeputado, ...entidades.porDeputado].map((d) => d.pessoa)).size;
  const pagoPorAno = new Map<number, number>();
  for (const e of publico.emendas) pagoPorAno.set(e.ano, (pagoPorAno.get(e.ano) ?? 0) + e.pagoAqui);
  const anosTce = tce?.estado === "ok" ? anosNoTce(tce, pagoPorAno) : null;
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
      <LadoALado federal={federal} estadual={estadualPorAno(publico)} municipal={municipal} quem={`a prefeitura e os fundos de ${municipio}`} />
      {anosTce && temAlgoNoTce(anosTce) && tce?.estado === "ok" && <NoTce anos={anosTce} municipio={municipio} dadoAte={tce.dadoAte} />}
      {tce?.estado === "falha" && <p className="pa-nota">No TCE-PB: o recebido e o gasto do dinheiro do Estado não puderam ser lidos agora.</p>}
      <p className="pa-linha mp-nao-imprimir">
        <LinkMapa href={URL_ASSEMBLEIA} className="pa-btn pa-btn-pequeno">
          Ver as emendas da Assembleia
        </LinkMapa>
      </p>
    </Secao>
  );
}

/** O bloco da página da entidade (aba do dinheiro): o que ela recebeu como credora do empenho. */
export function EmendasEstaduaisDaEntidade({
  leitura,
  cnpj,
  nome,
  federal,
  municipal,
}: {
  leitura: LeituraAssembleia;
  cnpj: string;
  nome: string;
  /** As emendas federais da entidade por ano (E3); ausente, a tabela lado a lado não aparece. */
  federal?: LeituraFederalPorAno;
  /** As emendas da Câmara de João Pessoa que citam a entidade ou a têm como credora (J3); ausente, sem a coluna municipal. */
  municipal?: readonly MunicipalAno[];
}) {
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
      <LadoALado
        federal={federal}
        estadual={estadualPorAno(l)}
        municipal={municipal}
        notaMunicipal={notaMunicipalDaEntidade(nome)}
        quem={nome}
      />
      <p className="pa-linha mp-nao-imprimir">
        <LinkMapa href={URL_ASSEMBLEIA} className="pa-btn pa-btn-pequeno">
          Ver as emendas da Assembleia
        </LinkMapa>
      </p>
    </Secao>
  );
}

/** O municipal da entidade: a emenda inteira, que pode ter outros credores. */
export function notaMunicipalDaEntidade(nome: string): string {
  return (
    `A municipal é o valor atual e o pago das emendas da Câmara de João Pessoa que citam ${nome} pelo CNPJ no objeto ou a têm como ` +
    "credora de empenho (a emenda inteira, que pode ter outros credores): orçamento do próprio município, não dinheiro que chega de fora."
  );
}
