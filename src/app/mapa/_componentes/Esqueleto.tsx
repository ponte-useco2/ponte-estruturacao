/**
 * Esqueleto de página do Mapa (B10, 08/10/2026): o que aparece no lugar da página enquanto o servidor lê o banco.
 * As páginas do `/mapa` são dinâmicas e os links saem sem pré-carga; no teste de 08/10/2026 as telas levaram de
 * 5 a 15 s sem retorno visual nenhum. Cada `loading.tsx` monta um esqueleto parecido com a sua página: o
 * `Esqueleto` desenha o cabeçalho (trilha ou rótulo, título, subtítulo, ações, aviso) e as abas; o corpo vem como
 * filhos, com as peças abaixo (`EsqueletoCartoes`, `EsqueletoTabela`…), na ordem em que a página real os mostra.
 *
 * É componente de SERVIDOR e não lê nada: o `loading.tsx` precisa sair na hora. O texto ("Carregando a página do
 * município…", vindo de cada `loading.tsx`) fica visível e numa região de status (WCAG 4.1.3: quem usa leitor de
 * tela também fica sabendo que a página está a caminho); os blocos ficam fora do leitor de tela.
 *
 * Onda 7, C (09/10/2026; N13 da auditoria R1): a região de status nascia já com o texto e podia não ser lida. Agora é o
 * `AvisoDeEspera` (`Carregando.tsx`, de cliente), que nasce vazio e escreve o texto logo depois; o texto à vista fica
 * fora do leitor de tela, para não ser dito duas vezes.
 *
 * Não aparece quando só muda o `?aba=`: a página do mesmo endereço continua montada e o roteador segura a tela
 * velha até a nova chegar. Ali o retorno é o `Carregando` dentro da aba clicada.
 */
import type { ReactNode } from "react";
import { AvisoDeEspera } from "./Carregando";
import "./esqueleto.css";

/** Larguras que se revezam, para as linhas não saírem todas iguais. */
const LARGURAS = ["92%", "76%", "84%", "64%", "70%"];
const largura = (i: number) => LARGURAS[i % LARGURAS.length];
const repete = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

type TipoOsso = "texto" | "rotulo" | "titulo" | "secao" | "numero" | "botao" | "chip" | "campo" | "figura";

/** Um bloco no lugar de um texto, número, botão ou campo. */
function Osso({ tipo = "texto", largura: l }: { tipo?: TipoOsso; largura?: string }) {
  return <span className={tipo === "texto" ? "mp-esq-osso" : `mp-esq-osso mp-esq-${tipo}`} style={l ? { width: l } : undefined} />;
}

/** Uma seção da página: o título, na largura dada, e o que vem embaixo. */
function Secao({ larguraTitulo, children }: { larguraTitulo: string; children: ReactNode }) {
  return (
    <div className="mp-radar-secao">
      <Osso tipo="secao" largura={larguraTitulo} />
      {children}
    </div>
  );
}

export function Esqueleto({
  texto = "Carregando a página…",
  trilha = 0,
  linhas = 1,
  acoes = 0,
  aviso = false,
  abas = 0,
  children,
}: {
  /** O que a região de status diz, com o nome da página: "Carregando a página do município…". */
  texto?: string;
  /** Elos da trilha "Onde você está" acima do título. Sem trilha, a página abre com o rótulo miúdo (a busca, o laudo). */
  trilha?: number;
  /** Linhas de subtítulo sob o título. */
  linhas?: number;
  /** Botões pequenos da linha de ações (seguir, imprimir, atalhos). */
  acoes?: number;
  /** A faixa de aviso sob o cabeçalho (laudo, relatório). */
  aviso?: boolean;
  /** Abas da página (Brasil, UF, município, entidade); a primeira aparece marcada, como a aba de entrada. */
  abas?: number;
  /** O corpo, com as peças `Esqueleto*` deste arquivo. */
  children?: ReactNode;
}) {
  return (
    <div className="pa-pagina mp-radar mp-esq">
      <p aria-hidden="true" className="pa-mono mp-esq-status">
        {texto}
      </p>
      <AvisoDeEspera texto={texto} />
      <div aria-hidden="true">
        <div className="pa-pilha mp-radar-cabeca">
          {trilha > 0 ? (
            <div className="mp-esq-trilha">{repete(trilha, (i) => <Osso key={i} largura={i === trilha - 1 ? "9rem" : "4.5rem"} />)}</div>
          ) : (
            <Osso tipo="rotulo" largura="14rem" />
          )}
          <Osso tipo="titulo" largura="min(28rem, 75%)" />
          {repete(linhas, (i) => (
            <Osso key={i} largura={i === 0 ? "min(34rem, 90%)" : "min(24rem, 70%)"} />
          ))}
          {acoes > 0 && <div className="mp-laudo-acoes">{repete(acoes, (i) => <Osso key={i} tipo="botao" largura={i === 0 ? "6.5rem" : "5.5rem"} />)}</div>}
          {aviso && (
            <div className="mp-fiscal-aviso">
              <Osso largura="96%" />
              <Osso largura="58%" />
            </div>
          )}
        </div>
        {abas > 0 && (
          <div className="mp-mun-abas">
            {repete(abas, (i) => (
              <span key={i} className={i === 0 ? "mp-esq-aba mp-esq-aba-atual" : "mp-esq-aba"}>
                <Osso largura={i === 0 ? "9rem" : i % 2 ? "5rem" : "6.5rem"} />
              </span>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Chips de filtro (o que buscar, área de atuação) ou as etiquetas do convênio. */
export function EsqueletoChips({ n }: { n: number }) {
  return <div className="pa-chips mp-radar-filtros">{repete(n, (i) => <Osso key={i} tipo="chip" largura={i % 3 ? "6rem" : "8.5rem"} />)}</div>;
}

/** O formulário de busca: o campo do termo e, ao lado, os filtros e o botão. */
export function EsqueletoFormulario({ filtros = 0 }: { filtros?: number }) {
  return (
    <div className="mp-busca-form">
      <div className="mp-busca-termo">
        <Osso tipo="rotulo" largura="9rem" />
        <Osso tipo="campo" />
      </div>
      <div className="pa-linha mp-painel-filtros">
        {repete(filtros, (i) => (
          <Osso key={i} tipo="campo" largura="11rem" />
        ))}
        <Osso tipo="botao" largura="5.5rem" />
      </div>
    </div>
  );
}

/** Cartões de número ("Em números", "Em uma página"), em grade de 3 ou de 4. */
export function EsqueletoCartoes({ n = 4 }: { n?: 3 | 4 }) {
  return (
    <Secao larguraTitulo="9rem">
      <div className={`pa-grade pa-grade-${n} mp-painel-cartoes`}>
        {repete(n, (i) => (
          <div key={i} className="pa-cartao mp-rel-cartao">
            <Osso tipo="rotulo" largura="60%" />
            <Osso tipo="numero" largura="45%" />
            <Osso largura="85%" />
          </div>
        ))}
      </div>
    </Secao>
  );
}

/** Cartões empilhados: a fila do município, o que mudou na carteira, a frase do laudo. */
export function EsqueletoLista({ n }: { n: number }) {
  return (
    <Secao larguraTitulo="16rem">
      <div className="mp-laudo-lista">
        {repete(n, (i) => (
          <div key={i} className="pa-cartao">
            <Osso largura={i % 2 ? "48%" : "62%"} />
            <Osso largura={largura(i)} />
          </div>
        ))}
      </div>
    </Secao>
  );
}

/** Um bloco de figura: o mapa das UFs, um gráfico. */
export function EsqueletoFigura() {
  return (
    <Secao larguraTitulo="8rem">
      <Osso tipo="figura" />
    </Secao>
  );
}

/** Tabela na caixa que rola, com o cabeçalho e as linhas; a primeira coluna é a do nome, as outras são números. */
export function EsqueletoTabela({ linhas }: { linhas: number }) {
  return (
    <Secao larguraTitulo="12rem">
      <div className="mp-tabela-rolagem">
        <div className="mp-esq-linha mp-esq-linha-cabeca">
          {repete(4, (i) => (
            <Osso key={i} largura={i === 0 ? "30%" : "55%"} />
          ))}
        </div>
        {repete(linhas, (i) => (
          <div key={i} className="mp-esq-linha">
            <Osso largura={largura(i)} />
            <Osso largura="50%" />
            <Osso largura="40%" />
            <Osso largura="60%" />
          </div>
        ))}
      </div>
    </Secao>
  );
}

/** Seções de texto corrido: título e três linhas cada. */
export function EsqueletoSecoes({ n }: { n: number }) {
  return repete(n, (s) => (
    <Secao key={s} larguraTitulo={s % 2 ? "11rem" : "14rem"}>
      {repete(3, (i) => (
        <Osso key={i} largura={largura(s + i)} />
      ))}
    </Secao>
  ));
}
