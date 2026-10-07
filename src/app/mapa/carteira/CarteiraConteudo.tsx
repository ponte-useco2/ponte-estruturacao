/**
 * A carteira: os itens que a pessoa segue, o que mudou desde a última leitura e a próxima ação de cada um, com
 * o fato que a sustenta. Recebe a carteira montada (lib/oportunidades/carteira.ts); aqui só se apresenta.
 * Impressa, é o relatório da carteira.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { formatarData } from "@/lib/oportunidades/central";
import { ROTULO_TIPO_ITEM } from "@/lib/oportunidades/favoritos";
import { ROTULO_CLASSE } from "@/lib/oportunidades/fila";
import type { Carteira, Consequencia, ItemCarteira, MudancaCarteira, Recomendacao } from "@/lib/oportunidades/carteira";
import { EstrelaSeguir } from "../_componentes/EstrelaSeguir";
import { BotaoImprimir } from "../fiscal/[ibge]/simular/BotaoImprimir";
import { MarcarLidas } from "./MarcarLidas";

const ROTULO: Record<Consequencia, string> = { alto: "alto", moderado: "moderado", informativo: "informação" };

function Nivel({ nivel, melhora }: { nivel: Consequencia; melhora?: boolean | null }) {
  if (melhora === true) return <span className="pa-tag mp-laudo-nivel mp-laudo-atendido">melhorou</span>;
  return <span className={`pa-tag mp-laudo-nivel mp-laudo-${nivel}`}>{ROTULO[nivel]}</span>;
}

function Secao({ id, titulo, nota, children }: { id: string; titulo: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      {nota && <p className="pa-nota">{nota}</p>}
      {children}
    </section>
  );
}

function nomeDoItem(i: ItemCarteira): string {
  if (i.tipo === "municipio") return `o município ${i.titulo}`;
  if (i.tipo === "instrumento") return `o convênio nº ${i.chave}`;
  if (i.tipo === "proposta") return `a proposta ${i.chave}`;
  return `a janela ${i.titulo}`;
}

function quantasNaoLidas(i: ItemCarteira): string {
  const n = i.mudancas.filter((m) => !m.lida).length;
  return n === 1 ? "1 mudança não lida" : `${n} mudanças não lidas`;
}

function Recomendacoes({ r }: { r: Recomendacao[] }) {
  if (!r.length) return <p className="mp-cart-mudo">Nada a apontar no último retrato.</p>;
  return (
    <ul className="mp-cart-recs">
      {r.map((x) => (
        <li key={x.acao}>
          <Nivel nivel={x.nivel} /> {x.classe && <span className="pa-mono mp-rel-dimensao">{ROTULO_CLASSE[x.classe]}</span>} <strong>{x.acao}.</strong>{" "}
          <span className="mp-cart-fato">{x.fato}</span>
        </li>
      ))}
    </ul>
  );
}

function Mudancas({ m }: { m: MudancaCarteira[] }) {
  return (
    <ul className="mp-cart-mudancas">
      {m.map((x) => (
        <li key={x.id}>
          <Nivel nivel={x.consequencia} melhora={x.melhora} /> <strong>{x.rotulo}</strong>: {x.detalhe}{" "}
          <span className="mp-cart-mudo">({formatarData(x.criado_em.slice(0, 10))})</span>
        </li>
      ))}
    </ul>
  );
}

function Cabeca({ i }: { i: ItemCarteira }) {
  return (
    <p className="mp-cart-cabeca">
      <span className="pa-tag">{ROTULO_TIPO_ITEM[i.tipo]}</span> <Link href={i.url}>{i.titulo}</Link>
      {i.ausente && <span className="mp-cart-mudo"> · saiu das fontes; mostra o último retrato</span>}
      {i.dadoDe && <span className="mp-cart-mudo"> · dado de {formatarData(i.dadoDe)}</span>}{" "}
      <span className="mp-nao-imprimir">
        <EstrelaSeguir tipo={i.tipo} chave={i.chave} nome={nomeDoItem(i)} seguindo compacta />
      </span>
    </p>
  );
}

export function CarteiraConteudo({ c, hoje, truncada }: { c: Carteira; hoje: string; truncada: boolean }) {
  const naoLidas = c.comMudanca.flatMap((i) => i.mudancas.filter((m) => !m.lida).map((m) => m.id));
  return (
    <div className="pa-pagina mp-radar mp-cart">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Carteira · acompanhar, entender o que mudou, agir</p>
        <h1 className="pa-titulo">Sua carteira</h1>
        <p className="pa-sub">
          {c.vazia ? (
            "Nenhum item seguido ainda"
          ) : (
            <>
              {c.itens.length} {c.itens.length === 1 ? "item seguido" : "itens seguidos"} ·{" "}
              {c.naoLidas === 0 ? "nenhuma mudança não lida" : c.naoLidas === 1 ? "1 mudança não lida" : `${c.naoLidas} mudanças não lidas`}
            </>
          )}{" "}
          · posição de {formatarData(hoje)}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          {!c.vazia && <BotaoImprimir />}
          <MarcarLidas ids={naoLidas} rotulo="Marcar tudo como lido" />
          <Link href="/mapa/avisos" className="pa-btn pa-btn-pequeno">
            Todos os avisos
          </Link>
        </p>
      </div>

      {c.vazia && (
        <Secao id="cart-vazia" titulo="Comece a sua carteira">
          <p>
            Siga com a estrela <strong>☆ Seguir</strong> os municípios, convênios, propostas e janelas que você acompanha. A carteira junta tudo
            aqui, avisa o que mudou a cada rodada do painel e diz a próxima ação de cada um, com o fato que a sustenta.
          </p>
          <ul className="mp-cart-lista mp-cart-passos">
            <li>
              Município: na página do município (procure pelo nome na <Link href="/mapa/busca">Busca</Link>).
            </li>
            <li>
              Convênio e proposta: na <Link href="/mapa/busca">Busca</Link>, pelo número ou pelo programa.
            </li>
            <li>
              Janela: nas <Link href="/mapa">Janelas</Link> abertas.
            </li>
          </ul>
        </Secao>
      )}

      {c.comMudanca.length > 0 && (
        <Secao id="cart-mudou" titulo="O que mudou" nota="Desde a última leitura, do que pesa mais para o que pesa menos. Melhora também aparece.">
          <ul className="mp-laudo-lista">
            {c.comMudanca.map((i) => (
              <li key={`${i.tipo}:${i.chave}`} className={`pa-cartao mp-laudo-risco mp-laudo-${i.pior}`}>
                <Cabeca i={i} />
                <Mudancas m={i.mudancas.filter((m) => !m.lida)} />
                {i.recomendacoes[0] && (
                  <p className="mp-cart-proxima">
                    <strong>Próxima ação ›</strong> {i.recomendacoes[0].acao}. <span className="mp-cart-fato">{i.recomendacoes[0].fato}</span>
                  </p>
                )}
                <p className="mp-nao-imprimir">
                  <MarcarLidas ids={i.mudancas.filter((m) => !m.lida).map((m) => m.id)} />
                </p>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {c.porTipo.municipio.length > 0 && (
        <Secao id="cart-municipios" titulo="Municípios" nota="Do retrato que o painel comparou na última rodada: convênios, painel fiscal (só PB) e TCE no TCU.">
          <div className="mp-cart-grade">
            {c.porTipo.municipio.map((i) => (
              <article key={i.chave} className="pa-cartao mp-cart-cartao">
                <Cabeca i={i} />
                <div className="mp-cart-numeros">
                  {i.numeros.map((n) => (
                    <span key={n.rotulo} className={`mp-cart-numero${n.nivel ? ` mp-cart-${n.nivel}` : ""}`}>
                      <span className="pa-mono">{n.rotulo}</span>
                      <b>{n.valor}</b>
                    </span>
                  ))}
                </div>
                <Recomendacoes r={i.recomendacoes} />
                {i.restantes > 0 && (
                  <p className="mp-cart-mudo">
                    {i.restantes === 1 ? "Mais 1 ponto a olhar" : `Mais ${i.restantes} pontos a olhar`} na <Link href={i.url}>página do município</Link>.
                  </p>
                )}
              </article>
            ))}
          </div>
        </Secao>
      )}

      {c.porTipo.instrumento.length > 0 && (
        <Secao id="cart-convenios" titulo="Convênios">
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela mp-cart-tabela">
              <thead>
                <tr>
                  <th scope="col">Convênio</th>
                  <th scope="col">Situação e vigência</th>
                  <th scope="col">Próxima ação</th>
                  <th scope="col" className="mp-num">Mudanças</th>
                </tr>
              </thead>
              <tbody>
                {c.porTipo.instrumento.map((i) => (
                  <tr key={i.chave}>
                    <td>
                      <Link href={i.url}>{i.chave}</Link>
                      <span className="mp-tabela-secundario">{i.titulo}</span>
                    </td>
                    <td data-rotulo="Situação e vigência">
                      {i.numeros.map((n) => (
                        <span key={n.rotulo} className={`mp-tabela-secundario${n.nivel === "alto" ? " mp-painel-urgente" : ""}`}>
                          {n.rotulo}: {n.valor}
                        </span>
                      ))}
                    </td>
                    <td data-rotulo="Próxima ação">
                      {i.recomendacoes[0] ? (
                        <>
                          <Nivel nivel={i.recomendacoes[0].nivel} /> {i.recomendacoes[0].acao}
                          <span className="mp-tabela-secundario">{i.recomendacoes[0].fato}</span>
                        </>
                      ) : (
                        <span className="mp-cart-mudo">nada a apontar</span>
                      )}
                    </td>
                    <td className="mp-num" data-rotulo="Mudanças não lidas">{i.mudancas.filter((m) => !m.lida).length || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}

      {c.porTipo.proposta.length > 0 && (
        <Secao id="cart-propostas" titulo="Propostas">
          <ul className="mp-cart-lista">
            {c.porTipo.proposta.map((i) => (
              <li key={i.chave}>
                <Link href={i.url}>{i.titulo}</Link> <span className="mp-cart-mudo">· proposta {i.chave}</span>
                {i.mudancas.some((m) => !m.lida) && <span className="mp-cart-mudo"> · {quantasNaoLidas(i)}</span>}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {c.porTipo.janela.length > 0 && (
        <Secao id="cart-janelas" titulo="Janelas">
          <ul className="mp-cart-lista">
            {c.porTipo.janela.map((i) => (
              <li key={i.chave}>
                <Link href={i.url}>{i.titulo}</Link>
                {i.recomendacoes[0] ? (
                  <span>
                    {" "}
                    · <Nivel nivel={i.recomendacoes[0].nivel} /> {i.recomendacoes[0].acao} <span className="mp-cart-mudo">({i.recomendacoes[0].fato})</span>
                  </span>
                ) : (
                  <span className="mp-cart-mudo"> · fechada ou sem prazo informado</span>
                )}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao id="cart-metodo" titulo="De onde vem cada coisa">
        <p className="pa-nota">
          Os números são do último retrato que o job do painel comparou para cada item (a data aparece ao lado do nome). As mudanças são os avisos
          gerados a cada rodada; ficam aqui até serem lidas. As próximas ações são pontos para olhar, cada uma com o fato e a data que a sustentam;
          a análise completa está no relatório do município e no laudo do convênio. «A conferir» nunca quer dizer irregularidade.
          {truncada ? " Há mais avisos do que a carteira mostra: os mais antigos estão em Avisos." : ""} Carteira preparada por PONTE Estruturação de
          Projetos de Impacto.
        </p>
      </Secao>
    </div>
  );
}
