/**
 * A fila do caminho das emendas estaduais (E2, 16/10/2026): o "onde está travado". Cada emenda com ficha que ainda não
 * está paga, com o último passo datado, há quantos dias e de quem é a vez (só quando o dado diz). O resumo por passo
 * fica acima; a tabela filtra e ordena por qualquer coluna (tela de administrador).
 *
 * A fila junta safras: a emenda de 2021 ainda empenhada e não paga aparece ao lado da de 2026 que acabou de ser
 * enviada. A coluna "Ano" separa; o resumo por ano está na lista da Assembleia.
 */
import type { ReactNode } from "react";
import { COLUNAS_FILA, TABELA_FILA, resumir, valoresDaFila } from "@/lib/oportunidades/assembleia-tela";
import {
  ROTULO_PASSO,
  URL_ASSEMBLEIA,
  VEZ_DEPOIS,
  filaDoCiclo,
  resumoDaFila,
  urlDeputado,
  urlEmendaEpb,
  type ItemFila,
  type RetratoEpb,
} from "@/lib/oportunidades/emendas-pb";
import { formatarDataBr, type LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../../../_design/primitivos";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../../../_componentes/TabelaRolagem";
import { CasasParlamentares, dinheiro, n } from "../../PecasParlamentares";
import { AVISO_ASSEMBLEIA, CarimboEpb, NotaDeMetodoEpb } from "../PecasAssembleia";

export function FilaConteudo({ retrato, hoje }: { retrato: RetratoEpb; hoje: string }) {
  const itens = filaDoCiclo(retrato, hoje);
  const resumo = resumoDaFila(itens);
  const linhas: LinhaTabela[] = itens.map((i) => ({ chave: i.emenda, valores: valoresDaFila(i), celulas: celulasDaFila(i) }));

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <CasasParlamentares atual="assembleia" />
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Assembleia (PB) · fila do caminho</p>
        <h1 className="pa-titulo">Onde estão as emendas que ainda não foram pagas</h1>
        <p className="pa-sub">
          {n(itens.length)} emendas com ficha e sem o pagamento inteiro, com o último passo do caminho, há quantos dias (contados hoje) e de
          quem é a vez. Cada número abre a emenda, com os pareceres de cada passo.
        </p>
        <p className="mp-fiscal-aviso">{AVISO_ASSEMBLEIA}</p>
        <CarimboEpb execucao={retrato.execucao} />
        <p className="pa-linha mp-nao-imprimir">
          <LinkMapa href={URL_ASSEMBLEIA} className="pa-btn pa-btn-pequeno">
            Ver a lista dos deputados
          </LinkMapa>
        </p>
      </div>

      <section aria-labelledby="alpb-fila-passos" className="mp-radar-secao">
        <h2 id="alpb-fila-passos" className="mp-radar-h2">
          Por passo do caminho
        </h2>
        <TabelaRolagem rotulo="A fila por passo do caminho">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Onde está</th>
                <th scope="col">Vez de</th>
                <th scope="col">Emendas</th>
                <th scope="col">Valor</th>
                <th scope="col">Mediana de dias no passo</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => (
                <tr key={r.passo}>
                  <th scope="row" className="mp-th-celula">
                    {ROTULO_PASSO[r.passo]}
                  </th>
                  <td>{VEZ_DEPOIS[r.passo] ?? "—"}</td>
                  <td className="mp-rel-num">{n(r.emendas)}</td>
                  <td className="mp-rel-num">{dinheiro(r.valor)}</td>
                  <td className="mp-rel-num">{r.medianaDias === null ? "—" : n(r.medianaDias)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      </section>

      <section aria-labelledby="alpb-fila-lista" className="mp-radar-secao">
        <h2 id="alpb-fila-lista" className="mp-radar-h2">
          As {n(itens.length)} emendas
        </h2>
        <p className="pa-nota mp-parl-grupo-nota">
          Na ordem padrão, do ano mais novo ao mais velho; dentro de cada ano, na ordem do caminho e das mais paradas para as menos. Filtre
          por ano, deputado, passo ou secretaria; o CSV sai só com o que está filtrado.
        </p>
        <TabelaFiltravel
          id={TABELA_FILA}
          rotulo="Emendas estaduais ainda não pagas"
          colunas={COLUNAS_FILA}
          linhas={linhas}
          descricaoOrdemPadrao="por ano, passo e dias parados"
          csv={{ nome: "assembleia-pb-fila" }}
        />
      </section>

      <NotaDeMetodoEpb id="alpb-fila-como-ler" />
    </div>
  );
}

function celulasDaFila(i: ItemFila): Record<string, ReactNode> {
  return {
    emenda: (
      <LinkMapa href={urlEmendaEpb(i.emenda)} className="mp-tabela-principal">
        {i.emenda}
      </LinkMapa>
    ),
    ano: String(i.ano),
    deputado: i.pessoa ? <LinkMapa href={urlDeputado(i.pessoa)}>{i.pessoa}</LinkMapa> : "—",
    objeto: <span title={i.objeto ?? undefined}>{resumir(i.objeto)}</span>,
    secretaria: i.secretaria ?? "—",
    passo: (
      <>
        {ROTULO_PASSO[i.passo]}
        {i.devolvida && <Tag>com devolução</Tag>}
      </>
    ),
    desde: i.passoEm ? formatarDataBr(i.passoEm) : "—",
    dias: i.dias === null ? "—" : n(i.dias),
    vez: i.vez ?? "—",
    valor: dinheiro(i.valor),
    empenhado: dinheiro(i.empenhado),
    "falta-pagar": dinheiro(i.faltaPagar),
    devolvida: i.devolvida ? "Sim" : "Não",
  };
}
