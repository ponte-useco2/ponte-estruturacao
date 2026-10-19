/**
 * A fila da execução das emendas de João Pessoa (J2, 16/10/2026): as emendas do exercício que ainda não estão pagas
 * por inteiro, da etapa mais atrás (sem empenho) para a mais à frente (paga em parte). O painel não traz data; o
 * primeiro empenho vem do TCE-PB, quando o histórico do empenho cita a emenda. A partir da segunda rodada, a página de
 * cada emenda mostra o que mudou dia a dia.
 */
import type { ReactNode } from "react";
import { COLUNAS_FILA_JP, TABELA_FILA_JP, valoresDaFilaJp } from "@/lib/oportunidades/camara-jp-tela";
import { resumir } from "@/lib/oportunidades/assembleia-tela";
import { URL_CAMARA_JP, emendasDoRetrato, filaDaExecucao, urlEmendaJp, urlVereadorJp, type RetratoEjp } from "@/lib/oportunidades/emendas-jp";
import { formatarDataBr, type LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../../_componentes/TabelaFiltravel";
import { CasasParlamentares, n } from "../../PecasParlamentares";
import { AVISO_CAMARA_JP, CarimboEjp, NotaDeMetodoEjp, reais } from "../PecasCamaraJp";

export function FilaJpConteudo({ retrato }: { retrato: RetratoEjp }) {
  const exercicio = retrato.execucao.exercicio;
  const fila = filaDaExecucao(emendasDoRetrato(retrato), exercicio);
  const valor = fila.reduce((s, e) => s + e.atual - e.pago, 0);
  const linhas: LinhaTabela[] = fila.map((e) => {
    const valores = valoresDaFilaJp(e);
    const celulas: Record<string, ReactNode> = {
      emenda: (
        <LinkMapa href={urlEmendaJp(e.ano, e.codigo)} className="mp-tabela-principal">
          {e.codigo}
        </LinkMapa>
      ),
      vereador: e.pessoa ? <LinkMapa href={urlVereadorJp(e.pessoa)}>{e.pessoa}</LinkMapa> : (e.autorPublicado ?? "—"),
      objeto: resumir(e.objeto),
      atual: reais(e.atual),
      empenhado: reais(e.empenhado),
      liquidado: reais(e.liquidado),
      pago: reais(e.pago),
      "primeiro-empenho": e.primeiroEmpenho ? formatarDataBr(e.primeiroEmpenho) : "—",
    };
    return { chave: e.chave, valores, celulas };
  });

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <CasasParlamentares atual="camara-jp" />
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Câmara de João Pessoa · fila da execução</p>
        <h1 className="pa-titulo">As emendas de {exercicio ?? "—"} que ainda não estão pagas</h1>
        <p className="pa-sub">
          {n(fila.length)} emendas, com {reais(valor)} do valor atual ainda por pagar. Da etapa mais atrás (sem empenho) para a mais à frente;
          dentro da etapa, do maior valor para o menor.
        </p>
        <p className="mp-fiscal-aviso">{AVISO_CAMARA_JP}</p>
        <CarimboEjp execucao={retrato.execucao} />
        <p className="pa-linha mp-nao-imprimir">
          <LinkMapa href={URL_CAMARA_JP} className="pa-btn pa-btn-pequeno">
            Ver a lista dos vereadores
          </LinkMapa>
        </p>
      </div>
      <section aria-labelledby="cjp-fila" className="mp-radar-secao">
        <h2 id="cjp-fila" className="mp-radar-h2">
          A fila
        </h2>
        <TabelaFiltravel
          id={TABELA_FILA_JP}
          rotulo={`Emendas de ${exercicio ?? "—"} ainda não pagas`}
          colunas={COLUNAS_FILA_JP}
          linhas={linhas}
          descricaoOrdemPadrao="pela etapa, da mais atrás, e pelo valor"
          csv={{ nome: `camara-joao-pessoa-fila-${exercicio ?? "exercicio"}` }}
        />
      </section>
      <NotaDeMetodoEjp id="cjp-fila-como-ler" />
    </div>
  );
}
