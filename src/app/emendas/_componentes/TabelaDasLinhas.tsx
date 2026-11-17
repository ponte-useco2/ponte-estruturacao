/**
 * A tabela das linhas (critério 17.1) do portal das emendas (17/11/2026): a `TabelaFiltravel` do Mapa no modo servidor —
 * a regra do titular de 13/10/2026 (filtro editável e ordem em cada coluna, estado no endereço, arquivo do recorte). A
 * página leu o estado do endereço e mandou ao banco (`emd_pub_linhas`); aqui só se desenham as células, a paginação (links
 * comuns, que funcionam sem JavaScript) e os links do CSV e do JSON do recorte inteiro (todas as páginas).
 *
 * Usada na lista, na ficha do parlamentar e na do município (com o recorte fixo: autor ou IBGE). Na tela pública do Mapa
 * as colunas de valor não ordenam; aqui ordenam (decisão 5 do plano, aprovada em 17/11/2026), e a ordem padrão é a
 * alfabética.
 */
import Link from "next/link";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import {
  COLUNAS_LISTA,
  DESCRICAO_ORDEM_PADRAO,
  ROTULO_FONTE_OBJETO,
  TABELA_EMENDAS,
  chaveDaLinha,
  codigoLegivel,
  inteiro,
  moeda,
  opcoesDaLista,
  rotuloEnte,
  rotuloEtapa,
  rotuloForma,
  rotuloTipo,
  situacaoDaFonte,
  totalDePaginas,
  urlComConsulta,
  urlDoRecorte,
  urlEmenda,
  urlMunicipioPublico,
  urlParlamentarPublico,
  valoresDaLinha,
  type ConsultaLista,
  type LinhaPublica,
  type RecorteFixo,
} from "@/lib/oportunidades/emendas-publico";
import { TabelaFiltravel } from "../../mapa/_componentes/TabelaFiltravel";
import { Objeto } from "../../mapa/parlamentares/Objeto";
import { Paginacao } from "./Pecas";

/** As células desenhadas de uma linha (os valores crus vão em `valoresDaLinha`). */
export function celulasDaLinha(l: LinhaPublica) {
  return {
    ano: l.ano ?? "—",
    emenda: l.codigo ? (
      <>
        <Link prefetch={false} href={urlEmenda(l.codigo)} className="mp-tabela-principal em-codigo">
          {codigoLegivel(l.codigo)}
        </Link>
        <span className="em-secundario">nº {l.numero ?? "—"}</span>
      </>
    ) : (
      <span className="em-secundario">Proposta do FNS ainda sem o detalhe da emenda</span>
    ),
    tipo: (
      <>
        {rotuloTipo(l.tipo)}
        {!l.no_catalogo && l.codigo && <span className="em-secundario">sem linha no arquivo do Portal; tipo pelo autor</span>}
      </>
    ),
    autor: l.autor_codigo ? (
      <>
        <Link prefetch={false} href={urlParlamentarPublico(l.autor_codigo)} className="mp-tabela-principal">
          {l.autor_nome ?? `Autor ${l.autor_codigo}`}
        </Link>
        {l.coletivo && <span className="em-secundario">autoria coletiva</span>}
      </>
    ) : (
      "Não identificado"
    ),
    forma: (
      <>
        {rotuloForma(l.canal)}
        <span className="em-secundario em-codigo">{l.instrumento}</span>
      </>
    ),
    destino: (
      <>
        <span className="mp-tabela-principal">{l.ente_nome ?? "Não consta registro"}</span>
        <span className="em-secundario">{rotuloEnte(l.ente_tipo)}</span>
      </>
    ),
    municipio: l.ibge && l.municipio ? (
      <Link prefetch={false} href={urlMunicipioPublico(l.ibge)}>
        {l.municipio}
      </Link>
    ) : l.ente_tipo === "estado" || l.ente_tipo === "fundo_estadual" ? (
      "Estado (sem município)"
    ) : (
      "—"
    ),
    objeto: l.objeto ? (
      <>
        <Objeto texto={l.objeto} />
        {l.objeto_fonte === "acao_orcamentaria" && <span className="em-secundario">{ROTULO_FONTE_OBJETO.acao_orcamentaria}</span>}
      </>
    ) : (
      "Não consta registro"
    ),
    funcao: l.funcao ?? "Não consta",
    previsto: l.previsto === null ? <span title="O pagamento direto ao favorecido só traz o pago">—</span> : moeda(l.previsto),
    pago: moeda(l.pago),
    situacao: (
      <>
        {rotuloEtapa(l.etapa, l.ano)}
        {situacaoDaFonte(l) && <span className="em-secundario">{situacaoDaFonte(l)}</span>}
      </>
    ),
  };
}

export function linhasDaTabela(linhas: readonly LinhaPublica[]): LinhaTabela[] {
  return linhas.map((l) => ({ chave: chaveDaLinha(l), valores: valoresDaLinha(l), celulas: celulasDaLinha(l) }));
}

export function TabelaDasLinhas({
  caminho,
  consulta,
  fixo = {},
  linhas,
  total,
  funcoes,
  rotulo,
}: {
  /** O caminho da página (a lista, a ficha do parlamentar ou a do município), para a paginação. */
  caminho: string;
  consulta: ConsultaLista;
  fixo?: RecorteFixo;
  linhas: readonly LinhaPublica[];
  total: number;
  funcoes: readonly (string | null)[];
  rotulo: string;
}) {
  const paginas = totalDePaginas(total);
  return (
    <div className="pa-pilha">
      <div className="em-baixar">
        <span>
          {inteiro(total)} {total === 1 ? "registro" : "registros"} neste recorte. Baixar o recorte inteiro (todas as páginas):
        </span>
        <a className="pa-btn pa-btn-pequeno" href={urlDoRecorte("csv", consulta, fixo)} download>
          CSV
        </a>
        <a className="pa-btn pa-btn-pequeno" href={urlDoRecorte("json", consulta, fixo)}>
          JSON
        </a>
        <Link prefetch={false} className="pa-btn pa-btn-pequeno" href="/emendas/dados#dicionario">
          Dicionário de dados
        </Link>
      </div>
      <div className="em-tabela-linhas">
        <TabelaFiltravel
          id={TABELA_EMENDAS}
          rotulo={rotulo}
          colunas={COLUNAS_LISTA}
          linhas={linhasDaTabela(linhas)}
          descricaoOrdemPadrao={DESCRICAO_ORDEM_PADRAO}
          empilhar
          servidor={{ total, opcoes: opcoesDaLista(funcoes), soltar: ["pagina"] }}
        />
      </div>
      <Paginacao pagina={consulta.pagina} paginas={paginas} url={(p) => urlComConsulta(caminho, { ...consulta, pagina: p })} />
    </div>
  );
}
