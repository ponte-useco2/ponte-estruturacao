/**
 * A lista das emendas da Assembleia da PB (emendas estaduais, E2, 16/10/2026). Recebe o retrato pronto
 * (`lerAssembleia`); aqui só se apresenta.
 *
 * O desenho é o da lista federal, com o que o dado estadual tem de próprio:
 *   · a lista abre por nome; não há posição, medalha, nota única nem cor de "bom" ou "ruim". É tela de administrador:
 *     toda coluna filtra e ordena, e ordenar por valor é leitura, não posição;
 *   · as colunas de valor são do catálogo (valor, empenhado e pago); o destino (municípios atendidos e entidades
 *     credoras) vem do empenho, pela modalidade. Os dois nunca se somam;
 *   · a safra de cada ano (Assembleia inteira) fica acima da lista: execução só se compara no mesmo ano;
 *   · o que ainda não está pago leva à fila do caminho, com os dias em cada passo.
 */
import type { ReactNode } from "react";
import {
  COLUNAS_DEPUTADOS,
  TABELA_DEPUTADOS,
  porcento,
  valoresDoDeputado,
} from "@/lib/oportunidades/assembleia-tela";
import {
  URL_FILA_EPB,
  anosDaAssembleia,
  deputadosDoRetrato,
  emendasDoRetrato,
  pct,
  urlDeputado,
  type DeputadoEpb,
  type RetratoEpb,
} from "@/lib/oportunidades/emendas-pb";
import type { LinhaTabela, ValorCelula } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../../_design/primitivos";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";
import { CartaoNumero, CasasParlamentares, dinheiro, n } from "../PecasParlamentares";
import { AVISO_ASSEMBLEIA, CarimboEpb, NotaDeMetodoEpb } from "./PecasAssembleia";

const COLUNAS_EM_REAIS = ["valor", "empenhado", "pago", "para-municipios", "para-entidades", "aplicacao-direta"] as const;

export function AssembleiaConteudo({ retrato }: { retrato: RetratoEpb }) {
  const emendas = emendasDoRetrato(retrato);
  const deputados = deputadosDoRetrato(retrato);
  const anos = anosDaAssembleia(emendas);
  const valor = emendas.reduce((s, e) => s + e.valor, 0);
  const pago = emendas.reduce((s, e) => s + e.pago, 0);
  const naoPagas = anos.reduce((s, a) => s + a.naoPagas, 0);
  const valorNaoPago = anos.reduce((s, a) => s + a.valorNaoPago, 0);
  const foraDaSemente = deputados.filter((d) => !d.fonte).length;
  const semPessoa = emendas.filter((e) => !e.pessoa).length;
  const linhas: LinhaTabela[] = deputados.map((d) => {
    const valores = valoresDoDeputado(d);
    return { chave: d.slug, valores, celulas: celulasDoDeputado(d, valores) };
  });

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <CasasParlamentares atual="assembleia" />
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · parlamentares · Assembleia (PB)</p>
        <h1 className="pa-titulo">Emendas impositivas da Assembleia Legislativa da Paraíba</h1>
        <p className="pa-sub">
          {n(emendas.length)} emendas de {n(deputados.length)} deputados estaduais, com o valor, o empenhado e o pago de cada um, o
          destino pelo empenho (municípios atendidos e entidades credoras) e o que ainda não está pago. Cada nome abre a ficha do
          deputado; a fila mostra onde cada emenda está no caminho e há quantos dias.
        </p>
        <p className="mp-fiscal-aviso">{AVISO_ASSEMBLEIA}</p>
        <CarimboEpb execucao={retrato.execucao} />
        <p className="pa-linha mp-nao-imprimir">
          <LinkMapa href={URL_FILA_EPB} className="pa-btn pa-btn-pequeno">
            Ver a fila do caminho
          </LinkMapa>
          <LinkMapa href="/mapa/painel" className="pa-btn pa-btn-pequeno">
            Voltar ao painel de execução
          </LinkMapa>
        </p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <CartaoNumero titulo="Emendas" numero={n(emendas.length)} nota={`${dinheiro(valor)} no valor das emendas`} />
        <CartaoNumero titulo="Pago" numero={dinheiro(pago)} nota={`${porcento(pct(pago, valor))} do valor, todas as safras`} />
        <CartaoNumero
          titulo="Ainda não pagas"
          numero={n(naoPagas)}
          nota={
            <>
              {dinheiro(valorNaoPago)} por pagar · <LinkMapa href={URL_FILA_EPB}>ver a fila</LinkMapa>
            </>
          }
        />
        <CartaoNumero
          titulo="Deputados"
          numero={n(deputados.length)}
          nota={foraDaSemente ? `${n(foraDaSemente)} com grafia fora da tabela curada` : "todos ligados pela tabela curada"}
        />
      </div>

      <section aria-labelledby="alpb-safras" className="mp-radar-secao">
        <h2 id="alpb-safras" className="mp-radar-h2">
          A safra de cada ano
        </h2>
        <p className="pa-nota">
          A Assembleia inteira, pelo ano da emenda. A safra corrente ainda está pagando; as antigas mostram o que ficou para trás. É a
          base para comparar cada deputado (na ficha dele, sempre na mesma safra).
        </p>
        <TabelaRolagem rotulo="A safra de cada ano">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Ano da emenda</th>
                <th scope="col">Emendas</th>
                <th scope="col">Valor</th>
                <th scope="col">Empenhado</th>
                <th scope="col">Pago</th>
                <th scope="col">Pago ÷ valor</th>
                <th scope="col">Ainda não pagas</th>
                <th scope="col">Valor por pagar</th>
              </tr>
            </thead>
            <tbody>
              {anos.map((a) => (
                <tr key={a.ano}>
                  <th scope="row" className="mp-th-celula">
                    {a.ano}
                  </th>
                  <td className="mp-rel-num">{n(a.emendas)}</td>
                  <td className="mp-rel-num">{dinheiro(a.valor)}</td>
                  <td className="mp-rel-num">{dinheiro(a.empenhado)}</td>
                  <td className="mp-rel-num">{dinheiro(a.pago)}</td>
                  <td className="mp-rel-num">{porcento(a.pctPago)}</td>
                  <td className="mp-rel-num">{a.naoPagas ? n(a.naoPagas) : "—"}</td>
                  <td className="mp-rel-num">{dinheiro(a.valorNaoPago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      </section>

      <section aria-labelledby="alpb-lista" className="mp-radar-secao">
        <h2 id="alpb-lista" className="mp-radar-h2">
          Os {n(deputados.length)} deputados
        </h2>
        <p className="pa-nota mp-parl-grupo-nota">
          Em ordem de nome. “Filtrar e ordenar” filtra e ordena por qualquer coluna; o CSV sai só com o que está filtrado. Ordenar por valor é
          leitura, não posição: o total junta safras diferentes.
          {semPessoa > 0 && ` ${n(semPessoa)} emendas sem deputado na publicação ficam fora da lista e aparecem na fila.`}
        </p>
        <TabelaFiltravel
          id={TABELA_DEPUTADOS}
          rotulo="Deputados estaduais com emendas impositivas"
          colunas={COLUNAS_DEPUTADOS}
          linhas={linhas}
          descricaoOrdemPadrao="por nome"
          csv={{ nome: "assembleia-pb-deputados" }}
        />
      </section>

      <NotaDeMetodoEpb id="alpb-como-ler" />
      <section aria-labelledby="alpb-colunas" className="mp-radar-secao">
        <h2 id="alpb-colunas" className="mp-radar-h2">
          O que cada coluna diz
        </h2>
        <ul className="pa-nota mp-parl-lista">
          <li>
            <strong>Na tabela curada</strong>: se a grafia publicada está ligada a uma pessoa na tabela da PONTE (pelo código da emenda,
            entre o catálogo e a ficha). “Não” quer dizer grafia nova, que entra na tabela na revisão seguinte.
          </li>
          <li>
            <strong>Valor das emendas</strong>: o valor da ficha da emenda (o do catálogo, quando não há ficha). <strong>Empenhado</strong>{" "}
            e <strong>pago</strong>: o catálogo, somadas as classificações da emenda.
          </li>
          <li>
            <strong>A municípios</strong>, <strong>a entidades</strong> e <strong>aplicação direta</strong>: o valor do catálogo pela
            modalidade da emenda.
          </li>
          <li>
            <strong>Municípios atendidos</strong>: municípios com a prefeitura ou o fundo como credor, nas transferências a municípios.{" "}
            <strong>Entidades credoras</strong>: entidades sem fins lucrativos credoras do empenho.
          </li>
          <li>
            <strong>Ainda não pagas</strong>: emendas com ficha e sem o pagamento inteiro, em qualquer passo do caminho (a fila).{" "}
            <strong>Com devolução</strong>: um parecer do caminho fala em devolver. <strong>Autoria divergente</strong>: o catálogo e a
            ficha dão deputados diferentes para a mesma emenda.
          </li>
        </ul>
      </section>
    </div>
  );
}

function celulasDoDeputado(d: DeputadoEpb, valores: Record<string, ValorCelula>): Record<string, ReactNode> {
  const celulas: Record<string, ReactNode> = {};
  for (const id of COLUNAS_EM_REAIS) {
    const v = valores[id];
    celulas[id] = typeof v === "number" ? dinheiro(v) : "—";
  }
  celulas.deputado = (
    <>
      <LinkMapa href={urlDeputado(d.pessoa)} className="mp-tabela-principal">
        {d.pessoa}
      </LinkMapa>
      {!d.fonte && <Tag>fora da tabela curada</Tag>}
    </>
  );
  celulas["pct-pago"] = porcento(typeof valores["pct-pago"] === "number" ? valores["pct-pago"] : null);
  for (const id of ["municipios", "entidades", "no-caminho", "devolvidas", "divergentes", "emendas"] as const) {
    const v = valores[id];
    celulas[id] = typeof v === "number" && v > 0 ? n(v) : "—";
  }
  celulas["ano-inicial"] = d.anoMin === null ? "—" : String(d.anoMin);
  celulas["ano-final"] = d.anoMax === null ? "—" : String(d.anoMax);
  return celulas;
}
