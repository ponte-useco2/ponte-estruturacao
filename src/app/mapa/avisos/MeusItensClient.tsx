"use client";

/**
 * Meus itens: os avisos sobre as janelas, convênios e propostas que a pessoa segue, e a
 * lista do que ela segue.
 *
 * As frases chegam prontas do servidor (`fraseDoAviso`). Aqui ficam só as abas, marcar
 * como lido, arquivar e desfazer — com as mesmas regras da central do catálogo: a
 * ação vale para o que está na tela, e o aviso de desfazer não some sozinho.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ROTULO_TIPO_ITEM,
  filtrarAvisos,
  nomeDoItemSeguido,
  situacaoDaJanela,
  type AbaItens,
  type TipoItem,
} from "@/lib/oportunidades/favoritos";
import { Tag } from "../../_design/primitivos";
import { AvisoSeguir, EstrelaSeguir } from "../_componentes/EstrelaSeguir";
import { arquivarItens, desarquivarItens, marcarItensLidos, marcarItensNaoLidos, type ResultadoAcao } from "../acoes";
import { LinkMapa } from "../_componentes/LinkMapa";

export interface AvisoVista {
  id: string;
  tipoRotulo: string;
  titulo: string;
  url: string;
  rotulo: string;
  detalhe: string;
  quando: string;
  lida_em: string | null;
  arquivada_em: string | null;
}

export interface SeguidoVista {
  tipo: TipoItem;
  chave: string;
  tipoRotulo: string;
  titulo: string;
  url: string;
  ausente: boolean;
}

type Acao = "lida" | "naoLida" | "arquivar" | "desarquivar";

const EXECUTAR: Record<Acao, (ids: string[]) => Promise<ResultadoAcao>> = {
  lida: marcarItensLidos,
  naoLida: marcarItensNaoLidos,
  arquivar: arquivarItens,
  desarquivar: desarquivarItens,
};

const INVERSA: Record<Acao, Acao> = { lida: "naoLida", naoLida: "lida", arquivar: "desarquivar", desarquivar: "arquivar" };

function textoFeito(acao: Acao, n: number): string {
  const avisos = n === 1 ? "1 aviso" : `${n} avisos`;
  const verbo = {
    lida: n === 1 ? "marcado como lido" : "marcados como lidos",
    naoLida: n === 1 ? "marcado como não lido" : "marcados como não lidos",
    arquivar: n === 1 ? "arquivado" : "arquivados",
    desarquivar: n === 1 ? "desarquivado" : "desarquivados",
  }[acao];
  return `${avisos} ${verbo}.`;
}

/**
 * As janelas que fecharam, pelo endereço. A janela não tem página: o link é a âncora do cartão no catálogo, que só
 * lista as abertas — fechada, o link caía no topo do catálogo e a estrela à mão era a de outra janela (B8, teste de
 * 08/10/2026). Esta tela não tem o retrato, só os avisos: chegam do servidor do mais novo para o mais velho, e o
 * último "fechou"/"abriu de novo" de cada janela decide (`situacaoDaJanela`).
 */
function janelasFechadas(avisos: readonly AvisoVista[]): Set<string> {
  const rotulos = new Map<string, string[]>();
  for (const a of avisos) {
    if (a.tipoRotulo === ROTULO_TIPO_ITEM.janela) rotulos.set(a.url, [...(rotulos.get(a.url) ?? []), a.rotulo]);
  }
  return new Set([...rotulos].filter(([, r]) => situacaoDaJanela(r) === "fechada").map(([url]) => url));
}

/** O nome do item: link para a página dele, ou só o nome com "(fechada)" quando a janela saiu do catálogo. */
function NomeDoItem({ titulo, url, fechada }: { titulo: string; url: string; fechada: boolean }) {
  if (!fechada) return <LinkMapa href={url}>{titulo}</LinkMapa>;
  return (
    <>
      {titulo}
      <span className="mp-estrela-fechada"> (fechada)</span>
    </>
  );
}

const ABAS: readonly { id: AbaItens; rotulo: string }[] = [
  { id: "nao_lidas", rotulo: "Não lidos" },
  { id: "todas", rotulo: "Todos" },
  { id: "arquivadas", rotulo: "Arquivados" },
];

export function MeusItensClient({
  avisos,
  seguidos,
  truncada,
  limite,
}: {
  avisos: AvisoVista[];
  seguidos: SeguidoVista[];
  truncada: boolean;
  limite: number;
}) {
  const [aba, setAba] = useState<AbaItens>("nao_lidas");
  const [desfazer, setDesfazer] = useState<{ acao: Acao; ids: string[]; texto: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [salvando, iniciar] = useTransition();
  const refDesfazer = useRef<HTMLButtonElement>(null);
  const refTitulo = useRef<HTMLHeadingElement>(null);

  const visiveis = filtrarAvisos(avisos, aba);
  const porAba: Record<AbaItens, number> = {
    nao_lidas: filtrarAvisos(avisos, "nao_lidas").length,
    todas: filtrarAvisos(avisos, "todas").length,
    arquivadas: filtrarAvisos(avisos, "arquivadas").length,
  };

  // Depois de uma ação, o foco vai para "Desfazer": o item some da aba e o foco cairia no <body>.
  useEffect(() => {
    if (desfazer) refDesfazer.current?.focus();
  }, [desfazer]);

  function aplicar(acao: Acao, ids: string[], desfazendo: boolean) {
    if (salvando || ids.length === 0) return;
    setErro(null);
    iniciar(async () => {
      const r = await EXECUTAR[acao](ids);
      if (!r.ok) {
        const mensagem = r.erro ?? "Não foi possível salvar.";
        setErro(mensagem);
        setAnuncio(mensagem);
        return;
      }
      const texto = textoFeito(acao, ids.length);
      if (desfazendo) {
        setDesfazer(null);
        setAnuncio(`Desfeito. ${texto}`);
        refTitulo.current?.focus();
      } else {
        setDesfazer({ acao, ids, texto });
        setAnuncio(texto);
      }
    });
  }

  const naoLidosVisiveis = visiveis.filter((a) => !a.lida_em).map((a) => a.id);
  const fechadas = janelasFechadas(avisos);

  return (
    <div className="pa-pagina pa-mapa">
      <p className="pa-sr" role="status" aria-atomic="true">
        {anuncio}
      </p>
      {/* Deixar de seguir tira o item da lista na hora: o aviso com "Desfazer" fica aqui, fora dela. */}
      <AvisoSeguir />

      <div className="pa-pagina-cabeca">
        <div className="pa-pilha">
          <p className="pa-kicker">Mural de avisos</p>
          <h1 className="pa-titulo" ref={refTitulo} tabIndex={-1}>
            O que mudou nos itens que você segue
          </h1>
          <p className="pa-sub">
            {seguidos.length === 0
              ? "Você ainda não segue nenhum item."
              : `${seguidos.length === 1 ? "1 item seguido" : `${seguidos.length} itens seguidos`} · ${
                  porAba.nao_lidas === 1 ? "1 aviso não lido" : `${porAba.nao_lidas} avisos não lidos`
                }`}
          </p>
        </div>
      </div>

      <p className="pa-nota mp-itens-nota">
        Convênios e propostas são comparados uma vez por dia, quando o dado novo do Transferegov chega. As janelas, na
        sincronização diária do catálogo. Os avisos ficam só aqui no Mapa: nada vai por e-mail.
      </p>

      {truncada && <p className="pa-nota">Mostrando os 500 avisos mais recentes.</p>}

      {erro && (
        <p className="pa-origem" role="alert">
          <Tag tom="proto">Não salvou</Tag>
          <span>{erro}</span>
        </p>
      )}

      {seguidos.length === 0 && avisos.length === 0 ? (
        <div className="pa-cartao pa-pilha">
          <h2 className="pa-mapa-vazio-titulo">Comece seguindo um item</h2>
          <p>
            Clique em <strong>☆ Seguir</strong> numa janela do catálogo, num convênio ou numa proposta. Quando ele mudar de
            situação, receber desembolso, ganhar aditivo ou tiver o prazo alterado, o aviso aparece aqui.
          </p>
          <div className="pa-linha">
            <LinkMapa href="/mapa" className="pa-btn pa-btn-pequeno">
              Ver as janelas
            </LinkMapa>
            <LinkMapa href="/mapa/busca" className="pa-btn pa-btn-pequeno">
              Buscar convênios e propostas
            </LinkMapa>
          </div>
        </div>
      ) : (
        <>
          <div className="pa-mapa-controles">
            <fieldset className="pa-fieldset">
              <legend className="pa-mono">Mostrar</legend>
              <div className="pa-chips">
                {ABAS.map((a) => (
                  <label key={a.id} className={`pa-chip${aba === a.id ? " pa-ativo" : ""}`}>
                    <input
                      type="radio"
                      name="itens-aba"
                      value={a.id}
                      className="pa-sr"
                      checked={aba === a.id}
                      onChange={() => setAba(a.id)}
                    />
                    {a.rotulo}
                    <span className="pa-chip-contagem">
                      <span className="pa-sr">, </span>
                      {porAba[a.id]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {naoLidosVisiveis.length > 1 && aba !== "arquivadas" && (
              <button
                type="button"
                className="pa-btn pa-btn-pequeno"
                aria-disabled={salvando}
                onClick={() => aplicar("lida", naoLidosVisiveis, false)}
              >
                Marcar os {naoLidosVisiveis.length} como lidos
              </button>
            )}
          </div>

          {desfazer && (
            <div className="pa-escuro pa-mapa-desfazer">
              <span>{desfazer.texto}</span>
              <span className="pa-espaco" />
              <button
                ref={refDesfazer}
                type="button"
                className="pa-btn pa-btn-pequeno"
                aria-disabled={salvando}
                onClick={() => aplicar(INVERSA[desfazer.acao], desfazer.ids, true)}
              >
                Desfazer
              </button>
              <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => setDesfazer(null)}>
                Fechar aviso
              </button>
            </div>
          )}

          {visiveis.length === 0 ? (
            <div className="pa-cartao pa-cartao-plano">
              <p>
                {aba === "nao_lidas"
                  ? "Nenhum aviso sem ler. Quando um item seguido mudar, ele aparece aqui."
                  : aba === "arquivadas"
                    ? "Nenhum aviso arquivado."
                    : "Nenhum aviso ainda. O primeiro chega quando um item seguido mudar."}
              </p>
            </div>
          ) : (
            <ul className="pa-pilha" aria-label="Avisos dos itens seguidos">
              {visiveis.map((a) => {
                const naoLida = !a.lida_em;
                const principal: Acao = aba === "arquivadas" ? "desarquivar" : naoLida ? "lida" : "naoLida";
                const rotuloPrincipal =
                  principal === "desarquivar" ? "Desarquivar" : principal === "lida" ? "Marcar como lido" : "Marcar como não lido";
                return (
                  <li key={a.id}>
                    <article className={`pa-cartao pa-mapa-item mp-aviso-item${naoLida ? " pa-mapa-nao-lida" : ""}`}>
                      <div className="pa-mapa-item-corpo">
                        <div className="pa-linha">
                          <Tag>{a.tipoRotulo}</Tag>
                          {naoLida && (
                            <span className="pa-linha pa-mapa-nao-lida-rotulo">
                              <span className="pa-mapa-marca-nao-lida" />
                              <span className="pa-mono">não lido</span>
                            </span>
                          )}
                          <span className="pa-mono">{a.quando}</span>
                        </div>
                        <h2 className="pa-oportunidade-titulo">{a.rotulo}</h2>
                        <p className="pa-mapa-descricao">{a.detalhe}</p>
                        <p className="mp-aviso-item-titulo">
                          <NomeDoItem titulo={a.titulo} url={a.url} fechada={a.tipoRotulo === ROTULO_TIPO_ITEM.janela && fechadas.has(a.url)} />
                        </p>
                      </div>
                      <div className="pa-oportunidade-lado">
                        <div className="pa-linha">
                          <button
                            type="button"
                            className="pa-btn pa-btn-pequeno"
                            aria-disabled={salvando}
                            aria-label={`${rotuloPrincipal}: ${a.rotulo}, ${a.titulo}`}
                            onClick={() => aplicar(principal, [a.id], false)}
                          >
                            {rotuloPrincipal}
                          </button>
                          {aba !== "arquivadas" && (
                            <button
                              type="button"
                              className="pa-btn pa-btn-pequeno"
                              aria-disabled={salvando}
                              aria-label={`Arquivar: ${a.rotulo}, ${a.titulo}`}
                              onClick={() => aplicar("arquivar", [a.id], false)}
                            >
                              Arquivar
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {seguidos.length > 0 && (
        <section className="pa-pilha mp-seguidos" aria-labelledby="itens-seguidos">
          <h2 id="itens-seguidos" className="pa-mapa-grupo-titulo">
            O que você segue · {seguidos.length} de {limite}
          </h2>
          <ul className="pa-pilha">
            {seguidos.map((s) => (
              // A estrela na frente do nome do próprio item, na mesma linha: no fim da linha, longe do nome, foi
              // confundida com a do item vizinho (B8).
              <li key={`${s.tipo}:${s.chave}`} className="pa-cartao-plano pa-linha mp-seguido">
                <EstrelaSeguir tipo={s.tipo} chave={s.chave} nome={nomeDoItemSeguido(s.tipo, s.chave, s.titulo)} seguindo />
                <Tag>{s.tipoRotulo}</Tag>
                <span className="mp-seguido-titulo">
                  <NomeDoItem titulo={s.titulo} url={s.url} fechada={s.tipo === "janela" && fechadas.has(s.url)} />
                  {s.ausente && <span className="pa-mono"> · saiu da busca</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
