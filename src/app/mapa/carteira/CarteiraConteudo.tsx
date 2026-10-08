/**
 * A carteira: os itens que a pessoa segue, o que mudou desde a última leitura e a próxima ação de cada um, com
 * o fato que a sustenta. Recebe a carteira montada (lib/oportunidades/carteira.ts); aqui só se apresenta.
 * Impressa, é o relatório da carteira.
 */
import type { ReactNode } from "react";
import { formatarData } from "@/lib/oportunidades/central";
import { ROTULO_TIPO_ITEM, nomeDoItemSeguido, situacaoDaJanela, type SituacaoJanela } from "@/lib/oportunidades/favoritos";
import { ROTULO_CLASSE } from "@/lib/oportunidades/fila";
import type { Carteira, Consequencia, ItemCarteira, MudancaCarteira, Recomendacao } from "@/lib/oportunidades/carteira";
import { AvisoSeguir, EstrelaSeguir } from "../_componentes/EstrelaSeguir";
import { BotaoImprimir } from "../fiscal/[ibge]/simular/BotaoImprimir";
import { MarcarLidas } from "./MarcarLidas";
import { LinkMapa } from "../_componentes/LinkMapa";

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

/**
 * A janela não tem página: o link é a âncora do cartão no catálogo, que só lista as abertas (`situacaoDaJanela`).
 * O retrato vem em `i.aberta` (aberta com prazo à frente ou sem prazo). As mudanças vêm da pior para a mais
 * branda; a situação lê as frases da mais nova para a mais velha.
 */
function situacao(i: ItemCarteira): SituacaoJanela {
  if (i.tipo !== "janela") return "aberta";
  const rotulos = [...i.mudancas].sort((a, b) => b.criado_em.localeCompare(a.criado_em)).map((m) => m.rotulo);
  return situacaoDaJanela(rotulos, i.aberta === true);
}

/**
 * O nome do item com a estrela DELE colada na frente, na mesma linha (B8: a estrela compacta solta no fim da linha
 * foi confundida com a do item vizinho). Estrela com texto ("★ Seguindo"): o que ela é não fica só na dica, que o
 * toque não mostra. Uma estrela por item: no bloco do tipo; "O que mudou" repete o item sem ela (`estrela={false}`),
 * para a tela não mostrar ★ numa linha e ☆ na outra. Janela fechada fica sem link, com "(fechada)": o link levava
 * ao topo do catálogo, e a estrela à mão lá era a de outra janela.
 */
function NomeComEstrela({ i, etiqueta, texto, estrela = true }: { i: ItemCarteira; etiqueta?: ReactNode; texto?: ReactNode; estrela?: boolean }) {
  const s = situacao(i);
  const nome = texto ?? i.titulo;
  return (
    <span className="mp-estrela-item">
      {estrela && (
        <span className="mp-nao-imprimir">
          <EstrelaSeguir tipo={i.tipo} chave={i.chave} nome={nomeDoItemSeguido(i.tipo, i.chave, i.titulo)} seguindo />
        </span>
      )}
      {etiqueta}
      <span className="mp-estrela-item-nome">
        {s === "aberta" ? (
          <LinkMapa href={i.url}>
            {nome}
          </LinkMapa>
        ) : (
          nome
        )}
        {s === "fechada" && <span className="mp-estrela-fechada"> (fechada)</span>}
        {s === "incerta" && <span className="mp-estrela-fechada"> (fechada ou sem prazo informado)</span>}
      </span>
    </span>
  );
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

function Cabeca({ i, estrela = true }: { i: ItemCarteira; estrela?: boolean }) {
  return (
    <p className="mp-cart-cabeca">
      <NomeComEstrela i={i} estrela={estrela} etiqueta={<span className="pa-tag">{ROTULO_TIPO_ITEM[i.tipo]}</span>} />
      {i.ausente && <span className="mp-cart-mudo"> · saiu das fontes; mostra o último retrato</span>}
      {i.dadoDe && <span className="mp-cart-mudo"> · dado de {formatarData(i.dadoDe)}</span>}
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
          <LinkMapa href="/mapa/avisos" className="pa-btn pa-btn-pequeno">
            Todos os avisos
          </LinkMapa>
        </p>
      </div>

      {/* Deixar de seguir tira o item da carteira na hora: o aviso com "Desfazer" fica aqui, fora da lista. */}
      <AvisoSeguir />

      {c.vazia && (
        <Secao id="cart-vazia" titulo="Comece a sua carteira">
          <p>
            Siga com a estrela <strong>☆ Seguir</strong> os municípios, entidades, convênios, propostas e janelas que você acompanha. A carteira junta tudo
            aqui, avisa o que mudou a cada rodada do painel e diz a próxima ação de cada um, com o fato que a sustenta.
          </p>
          <ul className="mp-cart-lista mp-cart-passos">
            <li>
              Município: na página do município (procure pelo nome na <LinkMapa href="/mapa/busca">Busca</LinkMapa>).
            </li>
            <li>
              Entidade (prefeitura, fundo, organização da sociedade civil, órgão estadual): na página dela, aberta pelo nome do proponente.
            </li>
            <li>
              Convênio e proposta: na <LinkMapa href="/mapa/busca">Busca</LinkMapa>, pelo número ou pelo programa.
            </li>
            <li>
              Janela: nas <LinkMapa href="/mapa">Janelas</LinkMapa> abertas.
            </li>
          </ul>
        </Secao>
      )}

      {c.comMudanca.length > 0 && (
        <Secao id="cart-mudou" titulo="O que mudou" nota="Desde a última leitura, do que pesa mais para o que pesa menos. Melhora também aparece.">
          <ul className="mp-laudo-lista">
            {c.comMudanca.map((i) => (
              <li key={`${i.tipo}:${i.chave}`} className={`pa-cartao mp-laudo-risco mp-laudo-${i.pior}`}>
                <Cabeca i={i} estrela={false} />
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
                    {i.restantes === 1 ? "Mais 1 ponto a olhar" : `Mais ${i.restantes} pontos a olhar`} na <LinkMapa href={i.url}>página do município</LinkMapa>.
                  </p>
                )}
              </article>
            ))}
          </div>
        </Secao>
      )}

      {c.porTipo.entidade.length > 0 && (
        <Secao id="cart-entidades" titulo="Entidades" nota="Do retrato por CNPJ que o painel comparou na última rodada: convênios, sinais e TCE no TCU. O fiscal é do município.">
          <div className="mp-cart-grade">
            {c.porTipo.entidade.map((i) => (
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
                    {i.restantes === 1 ? "Mais 1 ponto a olhar" : `Mais ${i.restantes} pontos a olhar`} na <LinkMapa href={i.url}>página da entidade</LinkMapa>.
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
                      <NomeComEstrela i={i} texto={i.chave} />
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
                <NomeComEstrela i={i} /> <span className="mp-cart-mudo">· proposta {i.chave}</span>
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
                {/* a janela fechada some do catálogo: aqui é o único lugar à mão para deixar de segui-la */}
                <NomeComEstrela i={i} />
                {i.recomendacoes[0] && (
                  <span>
                    {" "}
                    · <Nivel nivel={i.recomendacoes[0].nivel} /> {i.recomendacoes[0].acao} <span className="mp-cart-mudo">({i.recomendacoes[0].fato})</span>
                  </span>
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
