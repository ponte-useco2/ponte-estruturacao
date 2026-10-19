/**
 * A ficha de um vereador (ou colegiado) da Câmara de João Pessoa (J2, 16/10/2026): cada ano, com a fonte dele, e as
 * emendas, cada uma com a página própria. Vereador é agente público; as grafias publicadas aparecem para conferir a
 * tabela curada.
 */
import type { ReactNode } from "react";
import { resumir } from "@/lib/oportunidades/assembleia-tela";
import {
  COLUNAS_EMENDAS_VEREADOR_JP,
  TABELA_EMENDAS_VEREADOR_JP,
  porcento,
  valoresDaEmendaDoVereadorJp,
} from "@/lib/oportunidades/camara-jp-tela";
import { URL_CAMARA_JP, anosDaCamara, fonteDoAno, urlEmendaJp, type EmendaJp, type RetratoEjp, type VereadorJp } from "@/lib/oportunidades/emendas-jp";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../../../_componentes/TabelaRolagem";
import { CartaoNumero, CasasParlamentares, n } from "../../PecasParlamentares";
import { AVISO_CAMARA_JP, CarimboEjp, NotaDeMetodoEjp, Secao, reais } from "../PecasCamaraJp";

export function VereadorJpConteudo({ retrato, vereador, emendas }: { retrato: RetratoEjp; vereador: VereadorJp; emendas: EmendaJp[] }) {
  const anos = anosDaCamara(emendas.filter((e) => e.etapa !== "sem_valor"));
  const doRetrato = retrato.vereadores.find((v) => v.pessoa === vereador.pessoa);
  // A mesma grafia pode vir com espaço a mais (invisível na tela): uma vez só.
  const unicas = (xs: string[]) => [...new Set(xs.map((x) => x.replace(/\s+/g, " ").trim()))];
  const grafias = doRetrato ? { grafias_painel: unicas(doRetrato.grafias_painel), grafias_loa: unicas(doRetrato.grafias_loa) } : null;
  const linhas: LinhaTabela[] = emendas.map((e) => {
    const valores = valoresDaEmendaDoVereadorJp(e);
    const celulas: Record<string, ReactNode> = {
      ano: String(e.ano),
      emenda: (
        <LinkMapa href={urlEmendaJp(e.ano, e.codigo)} className="mp-tabela-principal">
          {e.codigo}
        </LinkMapa>
      ),
      objeto: resumir(e.objeto),
      original: reais(e.original),
      atual: reais(e.atual),
      empenhado: reais(e.empenhado),
      pago: reais(e.pago),
    };
    return { chave: e.chave, valores, celulas };
  });

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <CasasParlamentares atual="camara-jp" />
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Câmara de João Pessoa · {vereador.tipo === "colegiado" ? "colegiado" : "vereador"}</p>
        <h1 className="pa-titulo">{vereador.pessoa}</h1>
        <p className="pa-sub mp-parl-chips">
          <span>
            {n(vereador.emendas)} emendas de {vereador.anoMin} a {vereador.anoMax}
          </span>
          {grafias && grafias.grafias_painel.length > 0 && <span>No painel: {grafias.grafias_painel.join("; ")}</span>}
          {grafias && grafias.grafias_loa.length > 0 && <span>Na lista da LOA: {grafias.grafias_loa.join("; ")}</span>}
        </p>
        <p className="mp-fiscal-aviso">{AVISO_CAMARA_JP}</p>
        <CarimboEjp execucao={retrato.execucao} />
        <p className="pa-linha mp-nao-imprimir">
          <LinkMapa href={URL_CAMARA_JP} className="pa-btn pa-btn-pequeno">
            Ver a lista dos vereadores
          </LinkMapa>
        </p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <CartaoNumero titulo="Emendas" numero={n(vereador.emendas)} nota={`${reais(vereador.atual)} no valor atual, todos os anos`} />
        <CartaoNumero titulo="Pago" numero={reais(vereador.pago)} nota="todos os anos; compare só no mesmo ano" />
        <CartaoNumero
          titulo={`No exercício`}
          numero={n(vereador.exercicioEmendas)}
          nota={`${reais(vereador.exercicioAtual)} no valor atual · ${reais(vereador.exercicioPago)} pagos`}
        />
        <CartaoNumero titulo="Sem empenho no exercício" numero={n(vereador.exercicioSemEmpenho)} nota="pelo painel da Prefeitura, no dia da leitura" />
      </div>

      <Secao id="cjp-ver-anos" titulo="Cada ano" nota="Execução só se compara no mesmo ano: o ano corrente ainda está pagando.">
        <TabelaRolagem rotulo={`As emendas de ${vereador.pessoa} por ano`}>
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Ano</th>
                <th scope="col">Emendas</th>
                <th scope="col">Valor original</th>
                <th scope="col">Valor atual</th>
                <th scope="col">Empenhado</th>
                <th scope="col">Pago</th>
                <th scope="col">Pago ÷ atual</th>
                <th scope="col">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {anos.map((a) => (
                <tr key={a.ano}>
                  <th scope="row" className="mp-th-celula">
                    {a.ano}
                  </th>
                  <td className="mp-rel-num">{n(a.emendas)}</td>
                  <td className="mp-rel-num">{reais(a.original)}</td>
                  <td className="mp-rel-num">{reais(a.atual)}</td>
                  <td className="mp-rel-num">{reais(a.empenhado)}</td>
                  <td className="mp-rel-num">{reais(a.pago)}</td>
                  <td className="mp-rel-num">{porcento(a.pctPago)}</td>
                  <td>{fonteDoAno(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      </Secao>

      <Secao id="cjp-ver-emendas" titulo="As emendas">
        <TabelaFiltravel
          id={TABELA_EMENDAS_VEREADOR_JP}
          rotulo={`Emendas de ${vereador.pessoa}`}
          colunas={COLUNAS_EMENDAS_VEREADOR_JP}
          linhas={linhas}
          descricaoOrdemPadrao="do ano mais recente, pelo número"
          csv={{ nome: `camara-joao-pessoa-${vereador.slug}` }}
        />
      </Secao>
      <NotaDeMetodoEjp id="cjp-ver-como-ler" />
    </div>
  );
}
