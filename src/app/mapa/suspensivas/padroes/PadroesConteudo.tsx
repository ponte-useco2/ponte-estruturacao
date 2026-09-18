/**
 * Padrões das cláusulas suspensivas da PB: o destino de quem entrou (histórico), as condições que
 * travam hoje, quem analisa e os documentos que voltam. Recebe as leituras prontas de padroes.ts.
 */
import Link from "next/link";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import {
  COORTE_DESDE,
  MINIMO_PADRAO,
  lerHistorico,
  perfilAnalistas,
  porCondicao,
  porRequisito,
  tituloOrgao,
  type LinhaHistorico,
} from "@/lib/oportunidades/padroes";
import type { LeituraPadroes } from "@/lib/oportunidades/padroes.server";
import { moedaCurta } from "@/lib/oportunidades/radar";

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
  const requisitos = porRequisito(leitura.documentos, hoje).slice(0, 20);
  const orgaosAtuais = [...new Set(leitura.atuais.map((a) => a.orgao_sup).filter((o): o is string => !!o))];

  return (
    <div className="pa-pagina mp-radar mp-padroes">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Cláusulas suspensivas · Paraíba</p>
        <h1 className="pa-titulo">O que acontece com quem entra em suspensiva</h1>
        <p className="pa-sub">
          O destino e o tempo vêm do histórico dos dados abertos: todo convênio da PB que já teve suspensiva. As condições, os analistas e os
          documentos vêm da coleta no Acesso Livre, que só tem quem ainda está preso — por isso ela não mede tempo até a saída.
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <Link href="/mapa/suspensivas" className="pa-btn pa-btn-pequeno">
            Lista das suspensivas
          </Link>
          <Link href="/mapa/suspensivas/checklist" className="pa-btn pa-btn-pequeno">
            Checklist preventivo
          </Link>
        </p>
      </div>

      <section aria-labelledby="padroes-destino" className="mp-radar-secao">
        <h2 id="padroes-destino" className="mp-radar-h2">
          O destino de quem entrou em suspensiva
        </h2>
        <p className="pa-nota">Convênios da PB assinados desde {formatarData(COORTE_DESDE)} que tiveram cláusula suspensiva.</p>
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
            <h3 className="pa-mono">Morreram na suspensiva</h3>
            <p className="pa-numero">{n(t.destinos.morreu.n + t.destinos.encerrou.n)}</p>
            <p className="pa-nota">
              {moedaCurta(t.destinos.morreu.valor + t.destinos.encerrou.valor)} que nunca saíram: {n(t.destinos.morreu.n)} anulados ou rescindidos e{" "}
              {n(t.destinos.encerrou.n)} encerrados sem retirada
            </p>
          </article>
          <article className="pa-cartao">
            <h3 className="pa-mono">Seguem presos</h3>
            <p className="pa-numero">{n(t.destinos.segue.n)}</p>
            <p className="pa-nota">{moedaCurta(t.destinos.segue.valor)} em execução, ainda em suspensiva</p>
          </article>
        </div>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela mp-padroes-tabela">
            <thead>
              <tr>
                <th scope="col">Órgão</th>
                <th scope="col" className="mp-num">
                  Convênios
                </th>
                <th scope="col" className="mp-num">
                  Saíram
                </th>
                <th scope="col" className="mp-num">
                  Tempo até sair (mediana)
                </th>
                <th scope="col" className="mp-num">
                  Morreram
                </th>
                <th scope="col" className="mp-num">
                  Perda entre os que terminaram
                </th>
                <th scope="col" className="mp-num">
                  Seguem
                </th>
              </tr>
            </thead>
            <tbody>
              {historico.orgaos.map((o) => (
                <LinhaOrgao key={o.orgao} o={o} temChecklist={orgaosAtuais.includes(o.orgao)} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="pa-nota">
          “Morreram”: anulados, rescindidos ou cancelados com a suspensiva pendente, ou encerrados sem a retirada — nenhum real desembolsado. O SICONV
          apaga o prazo na retirada, e é assim que se sabe quem saiu. Com menos de {MINIMO_PADRAO} convênios, o órgão aparece, mas a mediana não diz
          muito.
        </p>
      </section>

      <section aria-labelledby="padroes-condicoes" className="mp-radar-secao">
        <h2 id="padroes-condicoes" className="mp-radar-h2">
          As condições que travam hoje
        </h2>
        <p className="pa-nota">
          Entre os {n(leitura.atuais.length)} convênios em execução que seguem em suspensiva. Um convênio conta em cada condição do termo.
        </p>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Condição do termo</th>
                <th scope="col" className="mp-num">
                  Convênios
                </th>
                <th scope="col" className="mp-num">
                  Repasse
                </th>
                <th scope="col" className="mp-num">
                  Em suspensiva há (mediana)
                </th>
                <th scope="col" className="mp-num">
                  Prazo vencido ou em até 30 dias
                </th>
              </tr>
            </thead>
            <tbody>
              {condicoes.map((c) => (
                <tr key={c.condicao}>
                  <th scope="row">{c.condicao}</th>
                  <td className="mp-num">{n(c.convenios)}</td>
                  <td className="mp-num">{moedaCurta(c.valor)}</td>
                  <td className="mp-num">{dias(c.medianaEmSuspensiva)}</td>
                  <td className="mp-num">{n(c.prazoApertado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="padroes-analistas" className="mp-radar-secao">
        <h2 id="padroes-analistas" className="mp-radar-h2">
          Quem analisa
        </h2>
        <p className="pa-nota">
          Pessoas do lado do concedente com {MINIMO_PADRAO} atos ou mais ({n(comPadrao.length)} de {n(analistas.length)}). “Carteira” é o órgão e o
          programa em que a pessoa mais atua, com a fatia dos convênios dela. “Última palavra” são os convênios em que o evento mais recente é dela, e há
          quanto tempo, até a coleta.
        </p>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela mp-padroes-tabela">
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Carteira</th>
                <th scope="col" className="mp-num">
                  Convênios (atos)
                </th>
                <th scope="col">O que decide</th>
                <th scope="col">Maior lote</th>
                <th scope="col">Última palavra</th>
              </tr>
            </thead>
            <tbody>
              {comPadrao.map((a) => (
                <tr key={a.nome}>
                  <th scope="row">
                    <span className="mp-tabela-principal">{a.nome}</span>
                    {a.atribuicao && <span className="mp-tabela-secundario">{a.atribuicao}</span>}
                  </th>
                  <td>
                    <span className="mp-tabela-principal">
                      {a.orgao.valor ? tituloOrgao(a.orgao.valor) : "—"} · {pct(a.orgao.fatia)}
                    </span>
                    {a.programa.valor && (
                      <span className="mp-tabela-secundario">
                        {a.programa.valor} · {pct(a.programa.fatia)}
                      </span>
                    )}
                  </td>
                  <td className="mp-num">
                    {n(a.convenios)} ({n(a.atos)})
                  </td>
                  <td>{perfil(a.exigencias, a.atendimentos, a.recusas)}</td>
                  <td>{a.maiorLote && a.maiorLote.convenios > 1 ? `${n(a.maiorLote.convenios)} em ${formatarData(a.maiorLote.dia)}` : "—"}</td>
                  <td>
                    {a.ultimaPalavra.convenios ? (
                      <>
                        <span className="mp-tabela-principal">
                          {n(a.ultimaPalavra.convenios)} · há {dias(a.ultimaPalavra.medianaDias)}
                        </span>
                        <span className="mp-tabela-secundario">{moedaCurta(a.ultimaPalavra.valor)} de repasse</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pa-nota">
          Quem só exige e quem só atende pode ser divisão de trabalho — uma pessoa faz a triagem, outra homologa —, e não um traço pessoal. A atribuição
          ao lado do nome ajuda a separar uma coisa da outra.
        </p>
      </section>

      <section aria-labelledby="padroes-documentos" className="mp-radar-secao">
        <h2 id="padroes-documentos" className="mp-radar-h2">
          Os documentos que mais aparecem
        </h2>
        <p className="pa-nota">Os 20 requisitos anexados em mais convênios, e quantos dos que têm validade já estão vencidos em {formatarData(hoje)}.</p>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Documento</th>
                <th scope="col" className="mp-num">
                  Convênios
                </th>
                <th scope="col" className="mp-num">
                  Com validade
                </th>
                <th scope="col" className="mp-num">
                  Vencidos
                </th>
              </tr>
            </thead>
            <tbody>
              {requisitos.map((r) => (
                <tr key={r.requisito}>
                  <th scope="row">{r.requisito}</th>
                  <td className="mp-num">{n(r.convenios)}</td>
                  <td className="mp-num">{n(r.comValidade)}</td>
                  <td className="mp-num">{r.comValidade ? `${n(r.vencidos)} (${pct(r.vencidos / r.comValidade)})` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="pa-nota">
        Histórico: dados abertos do Transferegov, atualizados todo dia. Andamento, analistas e documentos: coleta no Acesso Livre de{" "}
        {formatarPublicacao(leitura.coletadoEm)}. Nomes e atribuições como registrados no Transferegov; contatos pessoais não são coletados.
      </p>
    </div>
  );
}

function LinhaOrgao({ o, temChecklist }: { o: LinhaHistorico; temChecklist: boolean }) {
  const poucos = o.total < MINIMO_PADRAO;
  return (
    <tr className={poucos ? "mp-padroes-poucos" : undefined}>
      <th scope="row">
        <span className="mp-tabela-principal">{tituloOrgao(o.orgao)}</span>
        {temChecklist && (
          <Link href={urlChecklist(o.orgao)} className="mp-tabela-secundario mp-nao-imprimir">
            checklist preventivo
          </Link>
        )}
      </th>
      <td className="mp-num">{n(o.total)}</td>
      <td className="mp-num">{n(o.destinos.saiu.n)}</td>
      <td className="mp-num">{poucos ? "poucos casos" : dias(o.mediana)}</td>
      <td className="mp-num">{n(o.destinos.morreu.n + o.destinos.encerrou.n)}</td>
      <td className="mp-num">{pct(o.pctPerdido)}</td>
      <td className="mp-num">{n(o.destinos.segue.n)}</td>
    </tr>
  );
}

function perfil(exige: number, atende: number, recusa: number): string {
  const total = exige + atende + recusa;
  if (!total) return "—";
  if (!atende && !recusa) return `só pede complementação (${exige})`;
  if (!exige && !recusa) return `só dá por atendido (${atende})`;
  return `pede complementação em ${Math.round((exige / total) * 100)}% (${exige} de ${total})`;
}
