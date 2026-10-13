/**
 * Padrões das cláusulas suspensivas da PB: o destino de quem entrou (histórico), as condições que
 * travam hoje, quem analisa e os documentos que voltam. Recebe as leituras prontas de padroes.ts.
 *
 * Onda 15, fase 2, lote C (13/10/2026): as quatro listas são a `TabelaFiltravel`, com filtro e ordem em cada coluna (a
 * regra do titular; tela de administrador, toda coluna ordena). As células são as de antes; as colunas e os valores crus
 * estão em `padroes.ts`. Os documentos perderam o corte nos 20 primeiros: a tabela mostra todos, e o filtro resolve. A
 * lista de quem analisa não tem CSV: são nomes de servidores, e a lista de nomes não sai do painel.
 */
import type { ReactNode } from "react";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import {
  COLUNAS_PADROES_ANALISTAS,
  COLUNAS_PADROES_CONDICOES,
  COLUNAS_PADROES_DOCUMENTOS,
  COLUNAS_PADROES_ORGAOS,
  COORTE_DESDE,
  MINIMO_PADRAO,
  TABELA_PADROES_ANALISTAS,
  TABELA_PADROES_CONDICOES,
  TABELA_PADROES_DOCUMENTOS,
  TABELA_PADROES_ORGAOS,
  lerHistorico,
  perfilAnalistas,
  perfilDecisao,
  porCondicao,
  porRequisito,
  tituloOrgao,
  valoresDaCondicao,
  valoresDoAnalista,
  valoresDoOrgaoHistorico,
  valoresDoRequisito,
  type LinhaCondicao,
  type LinhaHistorico,
  type LinhaRequisito,
  type PerfilAnalista,
} from "@/lib/oportunidades/padroes";
import type { LeituraPadroes } from "@/lib/oportunidades/padroes.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";
import { Termo } from "../../_componentes/Termo";

type LeituraOk = Extract<LeituraPadroes, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const dias = (x: number | null) => (x === null ? "—" : `${n(Math.round(x))} ${Math.round(x) === 1 ? "dia" : "dias"}`);
const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const urlChecklist = (orgao: string) => `/mapa/suspensivas/checklist?orgao=${encodeURIComponent(orgao)}`;

export function PadroesConteudo({ leitura, hoje }: { leitura: LeituraOk; hoje: string }) {
  const referencia = diaBrasilia(leitura.referencia ?? leitura.coletadoEm);
  const historico = lerHistorico(leitura.historico);
  const t = historico.total;
  const terminados = t.destinos.saiu.n + t.destinos.morreu.n + t.destinos.encerrou.n;
  const condicoes = porCondicao(leitura.atuais, hoje);
  const contexto = new Map(leitura.atuais.map((a) => [a.numero, a]));
  const analistas = perfilAnalistas(leitura.eventos, leitura.detalhes, contexto, referencia);
  const comPadrao = analistas.filter((a) => a.atos >= MINIMO_PADRAO);
  // Onda 15, fase 2, lote C (13/10/2026): sem o corte nos 20 primeiros (`slice(0, 20)`); o filtro da tabela resolve.
  const requisitos = porRequisito(leitura.documentos, hoje);
  const orgaosAtuais = [...new Set(leitura.atuais.map((a) => a.orgao_sup).filter((o): o is string => !!o))];

  return (
    <div className="pa-pagina mp-radar mp-padroes">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Cláusulas suspensivas · Paraíba</p>
        <h1 className="pa-titulo">O que acontece com quem entra em suspensiva</h1>
        <p className="pa-sub">
          {/* B14b (08/10/2026): "preso" e "morreu" eram gíria da equipe (como o LAU-2 da B14): agora "ainda em suspensiva" e "extinto". */}
          O destino e o tempo vêm do histórico dos dados abertos: todo convênio da PB que já teve suspensiva. As condições, os analistas e os
          documentos vêm da coleta no Acesso Livre, que só tem quem ainda está em suspensiva — por isso ela não mede tempo até a saída.
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <LinkMapa href="/mapa/suspensivas" className="pa-btn pa-btn-pequeno">
            Ver a lista das suspensivas
          </LinkMapa>
          <LinkMapa href="/mapa/suspensivas/checklist" className="pa-btn pa-btn-pequeno">
            Abrir o checklist preventivo
          </LinkMapa>
        </p>
      </div>

      <section aria-labelledby="padroes-destino" className="mp-radar-secao">
        <h2 id="padroes-destino" className="mp-radar-h2">
          O destino de quem entrou em suspensiva
        </h2>
        <p className="pa-nota">
          Convênios da PB assinados desde {formatarData(COORTE_DESDE)} que tiveram{" "}
          <Termo slug="condicao-suspensiva">cláusula suspensiva</Termo>.
        </p>
        <div className="pa-grade pa-grade-3 mp-painel-cartoes">
          <article className="pa-cartao">
            <h3 className="pa-mono">Saíram</h3>
            <p className="pa-numero">{n(t.destinos.saiu.n)}</p>
            <p className="pa-nota">
              {pct(terminados ? t.destinos.saiu.n / terminados : null)} dos que terminaram · mediana de {dias(t.mediana)} da assinatura à retirada
              (em 1 de cada 4, mais de {dias(t.p75)})
            </p>
          </article>
          <article className="pa-cartao mp-laudo-risco mp-laudo-critico">
            <h3 className="pa-mono">Extintos na suspensiva</h3>
            <p className="pa-numero">{n(t.destinos.morreu.n + t.destinos.encerrou.n)}</p>
            <p className="pa-nota">
              {moedaCurta(t.destinos.morreu.valor + t.destinos.encerrou.valor)} que nunca saíram: {n(t.destinos.morreu.n)} anulados ou rescindidos e{" "}
              {n(t.destinos.encerrou.n)} encerrados sem retirada
            </p>
          </article>
          <article className="pa-cartao">
            <h3 className="pa-mono">Ainda em suspensiva</h3>
            <p className="pa-numero">{n(t.destinos.segue.n)}</p>
            <p className="pa-nota">{moedaCurta(t.destinos.segue.valor)} em execução, ainda em suspensiva</p>
          </article>
        </div>
        {/* A classe de antes, num invólucro: a largura de `mp-padroes-tabela` (mapa.css) vale para a tabela de dentro. */}
        <div className="mp-padroes-tabela">
          <TabelaFiltravel
            id={TABELA_PADROES_ORGAOS}
            rotulo="O destino de quem entrou em suspensiva, por órgão"
            colunas={COLUNAS_PADROES_ORGAOS}
            linhas={historico.orgaos.map((o) => linhaOrgao(o, orgaosAtuais.includes(o.orgao)))}
            ordemPadrao={{ coluna: "convenios", sentido: "desc" }}
            csv={{ nome: "suspensivas-destino-por-orgao" }}
          />
        </div>
        <p className="pa-nota">
          “Extintos”: anulados, rescindidos ou cancelados com a suspensiva pendente, ou encerrados sem a retirada — nenhum real desembolsado. O
          SICONV apaga o prazo na retirada, e é assim que se sabe quem saiu. Com menos de {MINIMO_PADRAO} convênios, o órgão aparece, mas a{" "}
          <Termo slug="mediana">mediana</Termo> não diz muito.
        </p>
      </section>

      <section aria-labelledby="padroes-condicoes" className="mp-radar-secao">
        <h2 id="padroes-condicoes" className="mp-radar-h2">
          As condições que travam hoje
        </h2>
        <p className="pa-nota">
          Entre os {n(leitura.atuais.length)} convênios em execução que seguem em suspensiva. Um convênio conta em cada condição do termo.
        </p>
        <TabelaFiltravel
          id={TABELA_PADROES_CONDICOES}
          rotulo="As condições que travam hoje"
          colunas={COLUNAS_PADROES_CONDICOES}
          linhas={condicoes.map(linhaCondicao)}
          ordemPadrao={{ coluna: "convenios", sentido: "desc" }}
          csv={{ nome: "suspensivas-condicoes" }}
        />
      </section>

      <section aria-labelledby="padroes-analistas" className="mp-radar-secao">
        <h2 id="padroes-analistas" className="mp-radar-h2">
          Quem analisa
        </h2>
        <p className="pa-nota">
          Pessoas do lado do concedente com {MINIMO_PADRAO} atos ou mais ({n(comPadrao.length)} de {n(analistas.length)}). “Onde mais atua” é o
          órgão e o programa em que a pessoa mais atua, com a fatia dos convênios dela. “Última palavra” são os convênios em que o evento mais
          recente é dela, e há quanto tempo, até a coleta.
        </p>
        {/* B14b (08/10/2026): "Carteira" é o nome da página dos itens seguidos; aqui a coluna diz o que mostra. A tabela
            vazia passa a dizer que está vazia. */}
        {comPadrao.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhuma pessoa com {MINIMO_PADRAO} atos ou mais na coleta de {formatarPublicacao(leitura.coletadoEm)}.
          </p>
        ) : (
        <div className="mp-padroes-tabela">
          {/* Sem CSV: são nomes de servidores; a lista de nomes não sai do painel (onda 15, fase 2, lote C, 13/10/2026). */}
          <TabelaFiltravel
            id={TABELA_PADROES_ANALISTAS}
            rotulo="Quem analisa"
            colunas={COLUNAS_PADROES_ANALISTAS}
            linhas={comPadrao.map(linhaAnalista)}
            descricaoOrdemPadrao="dos com mais convênios aos com menos e, no empate, mais atos"
          />
        </div>
        )}
        <p className="pa-nota">
          Quem só exige e quem só atende pode ser divisão de trabalho — uma pessoa faz a triagem, outra homologa —, e não um traço pessoal. A atribuição
          ao lado do nome ajuda a separar uma coisa da outra.
        </p>
      </section>

      <section aria-labelledby="padroes-documentos" className="mp-radar-secao">
        <h2 id="padroes-documentos" className="mp-radar-h2">
          Os documentos que mais aparecem
        </h2>
        <p className="pa-nota">
          Os {n(requisitos.length)} requisitos anexados, dos que aparecem em mais convênios aos que aparecem em menos, e quantos dos que têm
          validade já estão vencidos em {formatarData(hoje)}.
        </p>
        <TabelaFiltravel
          id={TABELA_PADROES_DOCUMENTOS}
          rotulo="Os documentos que mais aparecem"
          colunas={COLUNAS_PADROES_DOCUMENTOS}
          linhas={requisitos.map(linhaRequisito)}
          ordemPadrao={{ coluna: "convenios", sentido: "desc" }}
          csv={{ nome: "suspensivas-documentos" }}
        />
      </section>

      <p className="pa-nota">
        Histórico: dados abertos do Transferegov, atualizados todo dia. Andamento, analistas e documentos: coleta no Acesso Livre de{" "}
        {formatarPublicacao(leitura.coletadoEm)}. Nomes e atribuições como registrados no Transferegov; contatos pessoais não são coletados.
      </p>
    </div>
  );
}

// ================================================================ as linhas (onda 15, fase 2, lote C, 13/10/2026)

/**
 * O destino de um órgão. Com poucos casos, a linha toda ficava cinza (`mp-padroes-poucos` no `<tr>`); a tabela filtrável
 * não marca a linha, e o cinza passa para cada célula.
 */
function linhaOrgao(o: LinhaHistorico, temChecklist: boolean): LinhaTabela {
  const poucos = o.total < MINIMO_PADRAO;
  const tom = (x: ReactNode): ReactNode => (poucos ? <span className="mp-padroes-poucos">{x}</span> : x);
  return {
    chave: o.orgao,
    valores: valoresDoOrgaoHistorico(o),
    celulas: {
      orgao: (
        <>
          <span className={`mp-tabela-principal${poucos ? " mp-padroes-poucos" : ""}`}>{tituloOrgao(o.orgao)}</span>
          {temChecklist && (
            <LinkMapa href={urlChecklist(o.orgao)} className="mp-tabela-secundario mp-nao-imprimir">
              checklist preventivo
            </LinkMapa>
          )}
        </>
      ),
      convenios: tom(n(o.total)),
      sairam: tom(n(o.destinos.saiu.n)),
      mediana: tom(poucos ? "poucos casos" : dias(o.mediana)),
      extintos: tom(n(o.destinos.morreu.n + o.destinos.encerrou.n)),
      perda: tom(pct(o.pctPerdido)),
      seguem: tom(n(o.destinos.segue.n)),
    },
  };
}

function linhaCondicao(c: LinhaCondicao): LinhaTabela {
  return {
    chave: c.condicao,
    valores: valoresDaCondicao(c),
    celulas: {
      convenios: n(c.convenios),
      repasse: moedaCurta(c.valor),
      "em-suspensiva": dias(c.medianaEmSuspensiva),
      "prazo-apertado": n(c.prazoApertado),
    },
  };
}

function linhaAnalista(a: PerfilAnalista): LinhaTabela {
  return {
    chave: a.nome,
    valores: valoresDoAnalista(a),
    celulas: {
      pessoa: (
        <>
          <span className="mp-tabela-principal">{a.nome}</span>
          {a.atribuicao && <span className="mp-tabela-secundario">{a.atribuicao}</span>}
        </>
      ),
      orgao: (
        <>
          <span className="mp-tabela-principal">
            {a.orgao.valor ? tituloOrgao(a.orgao.valor) : "—"} · {pct(a.orgao.fatia)}
          </span>
          {a.programa.valor && (
            <span className="mp-tabela-secundario">
              {a.programa.valor} · {pct(a.programa.fatia)}
            </span>
          )}
        </>
      ),
      convenios: `${n(a.convenios)} (${n(a.atos)})`,
      decide: perfilDecisao(a.exigencias, a.atendimentos, a.recusas),
      "maior-lote": a.maiorLote && a.maiorLote.convenios > 1 ? `${n(a.maiorLote.convenios)} em ${formatarData(a.maiorLote.dia)}` : "—",
      "ultima-palavra": a.ultimaPalavra.convenios ? (
        <>
          <span className="mp-tabela-principal">
            {n(a.ultimaPalavra.convenios)} · há {dias(a.ultimaPalavra.medianaDias)}
          </span>
          <span className="mp-tabela-secundario">{moedaCurta(a.ultimaPalavra.valor)} de repasse</span>
        </>
      ) : (
        "—"
      ),
    },
  };
}

function linhaRequisito(r: LinhaRequisito): LinhaTabela {
  return {
    chave: r.requisito,
    valores: valoresDoRequisito(r),
    celulas: {
      convenios: n(r.convenios),
      "com-validade": n(r.comValidade),
      vencidos: r.comValidade ? `${n(r.vencidos)} (${pct(r.vencidos / r.comValidade)})` : "—",
    },
  };
}
