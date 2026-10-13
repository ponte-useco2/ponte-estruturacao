/**
 * "De onde vêm as emendas" (onda 14, parte 2, C, 13/10/2026): na aba do dinheiro federal da página do município, os
 * autores que mandaram recurso à prefeitura ou ao fundo municipal, por canal (convênio, Pix, saúde fundo a fundo e o
 * pago ao favorecido), com o válido e o pago. Cada autor leva à ficha dele (`/mapa/parlamentar/[código]`).
 *
 * Só para o administrador, até a revisão jurídica: a página só lê (`leEmendasDoMunicipio`) e o `MunicipioConteudo` só
 * desenha no nível 3. A leitura (`lerEmendasDoMunicipio`) é de administrador e fica na memória da instância, fora do
 * cache comum.
 *
 * As regras do contrato (`emendas.ts`) que valem aqui:
 *   · só o destino municipal (`separarDestino`): o governo do estado e o fundo estadual não têm IBGE e não entram; o
 *     pago a entidade com sede no município fica numa linha à parte, só somado e sem nome;
 *   · a proposta do FNS ainda sem o detalhe conta no município, não no autor: aparece como "ainda sem o autor";
 *   · sem ranking: a ordem é por tipo de autor e nome (`destinoPorAutor`), nunca por valor;
 *   · os canais somam entre si (o banco já tirou o que um canal cobre do outro); a execução orçamentária do Portal fica
 *     fora;
 *   · `sem_dado` e `falha` dão uma linha discreta e nunca derrubam a página.
 *
 * Onda 15, fase 2, lote A (13/10/2026): a tabela por autor virou tabela filtrável (`TabelaFiltravel`). É tela de
 * administrador: toda coluna filtra e ordena. A ordem padrão continua a de tipo e nome; ordenar por valor é leitura,
 * não posição. O válido e o pago de cada canal, que dividiam uma célula, viraram duas colunas (os ids da lista dos
 * autores), para cada número filtrar, ordenar e ir ao CSV; o código do autor vai oculto.
 */
import type { ReactNode } from "react";
import {
  FRASE_AGENTE_PUBLICO,
  FRASE_AUTORIA_COLETIVA,
  avisoFnsPendente,
  datasDaExecucao,
  rotuloCanal,
  rotuloTipoAutor,
  type LeituraEmendasMunicipio,
} from "@/lib/oportunidades/emendas";
import { emendasNoMunicipio, type AutorNoMunicipio } from "@/lib/oportunidades/pagina-municipio";
import {
  SEM_AUTOR_FNS,
  TABELA_EMENDAS_MUNICIPIO,
  colunasEmendasDoMunicipio,
  urlParlamentar,
  valoresDoAutorNoMunicipio,
} from "@/lib/oportunidades/parlamentares-tela";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";
import { Secao } from "./relatorio/RelatorioConteudo";

const TITULO = "De onde vêm as emendas";
const n = (x: number) => x.toLocaleString("pt-BR");

function Autor({ a }: { a: AutorNoMunicipio }) {
  if (a.codigo === null) return <>{SEM_AUTOR_FNS}</>;
  return <LinkMapa href={urlParlamentar(a.codigo)}>{a.autor?.nome ?? `Autor ${a.codigo}`}</LinkMapa>;
}

function tipoDe(a: AutorNoMunicipio): string {
  if (a.codigo === null) return "—";
  const tipo = rotuloTipoAutor(a.autor?.tipo ?? "outro");
  return a.autor?.coletivo ? `${tipo} (autoria coletiva)` : tipo;
}

export function EmendasDoMunicipio({ leitura, municipio }: { leitura: LeituraEmendasMunicipio; municipio: string }) {
  if (leitura.estado === "sem_dado") {
    return <p className="pa-nota">{TITULO}: as emendas por autor ainda não foram carregadas.</p>;
  }
  if (leitura.estado !== "ok") {
    return <p className="pa-nota">{TITULO}: as emendas por autor não puderam ser lidas agora. Tente de novo em alguns minutos.</p>;
  }
  const e = emendasNoMunicipio(leitura.destino, leitura.autores);
  const datas = datasDaExecucao(leitura.execucao);
  const aviso = avisoFnsPendente(leitura.execucao);
  const comAutor = e.autores.filter((a) => a.codigo !== null).length;
  const semAutor = e.autores.some((a) => a.codigo === null);
  const coletiva = e.autores.some((a) => a.autor?.coletivo);
  const canais = e.porCanal.map((c) => c.canal);
  const colunas = colunasEmendasDoMunicipio(canais);
  const linhas: LinhaTabela[] = e.autores.map((a) => {
    const valores = valoresDoAutorNoMunicipio(a, canais);
    const celulas: Record<string, ReactNode> = { autor: <Autor a={a} />, tipo: tipoDe(a) };
    for (const c of colunas) {
      if (c.tipo !== "numero") continue;
      const v = valores[c.id];
      celulas[c.id] = typeof v === "number" ? moedaCurta(v) : "—";
    }
    return { chave: a.codigo ?? "sem-autor", valores, celulas };
  });
  return (
    <Secao
      id="mun-emendas-autores"
      titulo={TITULO}
      nota={
        <>
          Só para administrador. Quem indicou emenda com destino à prefeitura ou ao fundo municipal de {municipio}, por canal: o válido é o
          indicado em instrumento válido, e o pago é o que já saiu. Cada real conta uma vez entre os canais; a execução orçamentária do Portal
          da Transparência fica fora. O governo do estado e o fundo estadual não entram, porque não têm município. Na ordem padrão, por tipo de
          autor e nome; cada coluna filtra e ordena, e ordenar por valor é leitura, não posição. Dado do Portal de {datas.dadoAte}, rodada de{" "}
          {datas.rodouEm}.
        </>
      }
    >
      {e.autores.length === 0 ? (
        <p>Nenhuma emenda com valor válido ou pago para a prefeitura ou o fundo municipal de {municipio} nos canais lidos.</p>
      ) : (
        <>
          <p>
            {comAutor === 1 ? "1 autor mandou" : `${n(comAutor)} autores mandaram`} recurso a {municipio}
            {semAutor ? ", mais a saúde fundo a fundo ainda sem o autor" : ""}.
          </p>
          <TabelaRolagem rotulo={`${TITULO}: por canal`}>
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Canal</th>
                  <th scope="col">Autores</th>
                  <th scope="col">Válido</th>
                  <th scope="col">Pago</th>
                </tr>
              </thead>
              <tbody>
                {e.porCanal.map((c) => (
                  <tr key={c.canal}>
                    <th scope="row" className="mp-th-celula">
                      {rotuloCanal(c.canal)}
                    </th>
                    <td className="mp-rel-num">{n(c.autores)}</td>
                    <td className="mp-rel-num">{c.valido === null ? "—" : moedaCurta(c.valido)}</td>
                    <td className="mp-rel-num">{moedaCurta(c.pago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
          <TabelaFiltravel
            id={TABELA_EMENDAS_MUNICIPIO}
            rotulo={`${TITULO}: por autor`}
            colunas={colunas}
            linhas={linhas}
            descricaoOrdemPadrao="por tipo de autor e nome"
            csv={{ nome: `emendas-por-autor-${municipio}` }}
          />
        </>
      )}
      {aviso && <p className="pa-nota">{aviso}</p>}
      {e.soIndicado > 0 && (
        <p className="pa-nota">
          {e.soIndicado === 1 ? "1 autor tem" : `${n(e.soIndicado)} autores têm`} indicação para {municipio} ainda sem nada válido nem pago
          (proposta não assinada ou que caducou) e {e.soIndicado === 1 ? "fica" : "ficam"} fora da tabela.
        </p>
      )}
      {e.entidadeComSede > 0 && (
        <p className="pa-nota">
          À parte, {moedaCurta(e.entidadeComSede)} pagos a entidade com sede em {municipio} (empresa, OSC, consórcio ou órgão federal): não é
          destino municipal e não entra na tabela.
        </p>
      )}
      <p className="pa-nota">
        {FRASE_AGENTE_PUBLICO}
        {coletiva ? ` ${FRASE_AUTORIA_COLETIVA}` : ""}
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        <LinkMapa href="/mapa/parlamentares" className="pa-btn pa-btn-pequeno">
          Ver todos os autores de emendas
        </LinkMapa>
      </p>
    </Secao>
  );
}
