/**
 * As emendas da Câmara de João Pessoa na página do município (só João Pessoa) e na da entidade (J2, 16/10/2026): só
 * para o administrador, na aba do dinheiro, como as federais e as estaduais. A leitura é a das telas da Câmara
 * (`lerCamaraJp`, memória de 10 minutos); `sem_dado` e `falha` dão uma linha discreta e nunca derrubam a página.
 *
 * Federal, estadual e municipal são dinheiros diferentes: cada um com a sua fonte, nunca somados.
 *
 *   · no município: cada ano (com a fonte dele) e as etapas do exercício;
 *   · na entidade: as emendas cujo objeto cita o CNPJ dela ou que a têm como credora de empenho. Sem nenhuma, o bloco
 *     não aparece (a maioria das entidades não é de João Pessoa).
 */
import type { ReactNode } from "react";
import { COLUNAS_ENTIDADE_JP, TABELA_ENTIDADE_JP, porcento, valoresDaEntidadeJp } from "@/lib/oportunidades/camara-jp-tela";
import { resumir } from "@/lib/oportunidades/assembleia-tela";
import {
  ROTULO_ETAPA,
  URL_CAMARA_JP,
  URL_FILA_EJP,
  anosDaCamara,
  emendasDoRetrato,
  emendasJpDaEntidade,
  fonteDoAno,
  resumoDasEtapas,
  urlEmendaJp,
  urlVereadorJp,
  type LeituraCamaraJp,
} from "@/lib/oportunidades/emendas-jp";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";
import { n } from "../PecasParlamentares";
import { reais } from "./PecasCamaraJp";

function Bloco({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Indisponivel({ leitura }: { leitura: Exclude<LeituraCamaraJp, { estado: "ok" }> }) {
  return (
    <p className="pa-nota">
      {leitura.estado === "sem_dado"
        ? "As emendas da Câmara de João Pessoa ainda não foram publicadas."
        : "As emendas da Câmara de João Pessoa estão indisponíveis agora."}
    </p>
  );
}

/** Na página de João Pessoa: cada ano e as etapas do exercício. */
export function EmendasDaCamaraNoMunicipio({ leitura }: { leitura: LeituraCamaraJp }) {
  if (leitura.estado !== "ok") {
    return (
      <Bloco id="mun-cjp" titulo="Emendas da Câmara Municipal">
        <Indisponivel leitura={leitura} />
      </Bloco>
    );
  }
  const { retrato } = leitura;
  const emendas = emendasDoRetrato(retrato);
  const anos = anosDaCamara(emendas);
  const exercicio = retrato.execucao.exercicio;
  const etapas = resumoDasEtapas(emendas, exercicio);
  return (
    <Bloco id="mun-cjp" titulo="Emendas da Câmara Municipal (impositivas dos vereadores)">
      <p className="pa-nota">
        Dinheiro do orçamento do próprio município indicado pelos vereadores — à parte das emendas federais e estaduais, que têm outra fonte e
        nunca se somam a ele. Painel da Prefeitura lido em {dataBrasilia(retrato.execucao.dadoAte ?? retrato.execucao.concluidaEm)}.{" "}
        <LinkMapa href={URL_CAMARA_JP}>Ver os vereadores</LinkMapa> · <LinkMapa href={URL_FILA_EJP}>ver a fila da execução</LinkMapa>
      </p>
      <TabelaRolagem rotulo="Emendas da Câmara de João Pessoa por ano">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col">Emendas</th>
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
      {etapas.length > 0 && (
        <p className="pa-nota">
          Em {exercicio}: {etapas.map((e) => `${ROTULO_ETAPA[e.etapa].toLowerCase()} ${n(e.emendas)} (${reais(e.atual)})`).join("; ")}.
        </p>
      )}
    </Bloco>
  );
}

/** Na página da entidade: as emendas que a citam no objeto ou a têm como credora. Sem nenhuma, nada aparece. */
export function EmendasDaCamaraNaEntidade({ leitura, cnpj, nome }: { leitura: LeituraCamaraJp; cnpj: string; nome: string }) {
  if (leitura.estado !== "ok") return null;
  const emendas = emendasDoRetrato(leitura.retrato);
  const daEntidade = emendasJpDaEntidade(leitura.retrato, emendas, cnpj);
  if (!daEntidade.length) return null;
  const linhas: LinhaTabela[] = daEntidade.map((x) => ({
    chave: x.emenda.chave,
    valores: valoresDaEntidadeJp(x),
    celulas: {
      ano: String(x.emenda.ano),
      emenda: <LinkMapa href={urlEmendaJp(x.emenda.ano, x.emenda.codigo)}>{x.emenda.codigo}</LinkMapa>,
      vereador: x.emenda.pessoa ? <LinkMapa href={urlVereadorJp(x.emenda.pessoa)}>{x.emenda.pessoa}</LinkMapa> : (x.emenda.autorPublicado ?? "—"),
      objeto: resumir(x.emenda.objeto),
      atual: reais(x.emenda.atual),
      pago: reais(x.emenda.pago),
      "empenhado-tce": reais(x.empenhadoTce),
    },
  }));
  const atual = daEntidade.reduce((s, x) => s + x.emenda.atual, 0);
  return (
    <Bloco id="ent-cjp" titulo="Emendas da Câmara de João Pessoa">
      <p className="pa-nota">
        {n(daEntidade.length)} {daEntidade.length === 1 ? "emenda cita" : "emendas citam"} {nome} pelo CNPJ no objeto ou a têm como credora de
        empenho, com {reais(atual)} de valor atual (o da emenda inteira, que pode ter outros credores). Dinheiro do orçamento de João Pessoa,
        à parte das emendas federais e estaduais.
      </p>
      <TabelaFiltravel
        id={TABELA_ENTIDADE_JP}
        rotulo={`Emendas da Câmara de João Pessoa para ${nome}`}
        colunas={COLUNAS_ENTIDADE_JP}
        linhas={linhas}
        descricaoOrdemPadrao="do ano mais recente, pelo número"
        csv={{ nome: `camara-joao-pessoa-entidade-${cnpj}` }}
      />
    </Bloco>
  );
}
