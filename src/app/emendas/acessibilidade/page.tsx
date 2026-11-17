import type { Metadata } from "next";
import Link from "next/link";
import { Cabeca } from "../_componentes/Pecas";

export const metadata: Metadata = {
  title: "Acessibilidade",
  description: "Os recursos de acessibilidade do portal das emendas federais na Paraíba: alto contraste, tamanho do texto, teclado, leitor de tela e mapa do site.",
};

const ELOS = [{ rotulo: "Acessibilidade" }] as const;

/** Os recursos de acessibilidade (13.1) e como usar cada um (17/11/2026). */
export default function Acessibilidade() {
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={ELOS} kicker="Emendas federais na Paraíba" titulo="Acessibilidade">
        <p className="pa-sub">
          O portal segue as recomendações de acessibilidade para a web (WCAG 2.1, nível AA, e o eMAG) e os itens de acessibilidade da matriz
          do PNTP. Os controles ficam na barra do topo de todas as páginas, ao lado do símbolo de acessibilidade.
        </p>
      </Cabeca>
      <div className="em-texto">
        <section className="em-secao" aria-labelledby="em-a-contraste">
          <h2 id="em-a-contraste">Alto contraste</h2>
          <p>
            O botão “Alto contraste” troca as cores por fundo preto, texto branco e links amarelos. O mesmo botão volta ao contraste normal.
            A escolha fica guardada neste navegador para a próxima visita.
          </p>
        </section>
        <section className="em-secao" aria-labelledby="em-a-texto">
          <h2 id="em-a-texto">Tamanho do texto</h2>
          <p>
            “A+” aumenta o texto (até 150%), “A−” diminui e “A” volta ao tamanho padrão. O zoom do navegador (Ctrl e + no teclado, ou o
            gesto de pinça no celular) também funciona, sem cortar o conteúdo.
          </p>
        </section>
        <section className="em-secao" aria-labelledby="em-a-teclado">
          <h2 id="em-a-teclado">Teclado e leitor de tela</h2>
          <ul>
            <li>O primeiro Tab leva ao link “Pular para o conteúdo”.</li>
            <li>Todo link, botão e campo é alcançado com Tab, e o foco fica visível.</li>
            <li>
              As tabelas têm cabeçalho; as largas rolam de lado dentro da própria caixa (com as setas, depois de Tab), e no celular cada linha
              vira um bloco com o nome de cada campo.
            </li>
            <li>A trilha “Onde você está”, no topo de cada página, diz o caminho até ela.</li>
            <li>“Filtrar e ordenar” abre um painel com um campo por coluna; Esc fecha o painel e devolve o foco ao botão.</li>
          </ul>
        </section>
        <section className="em-secao" aria-labelledby="em-a-sem-js">
          <h2 id="em-a-sem-js">Sem JavaScript</h2>
          <p>
            A leitura, a busca, a paginação, o alto contraste e o tamanho do texto funcionam sem JavaScript. O painel de filtro de cada coluna
            precisa dele; sem ele, um endereço já filtrado continua valendo.
          </p>
        </section>
        <section className="em-secao" aria-labelledby="em-a-cookie">
          <h2 id="em-a-cookie">O que fica guardado</h2>
          <p>
            Só as duas escolhas acima, em dois cookies deste navegador (um ano, só para as páginas do portal). O portal não pede cadastro e não
            guarda dado de quem visita. Ver a <Link href="/privacidade">política de privacidade</Link> do site.
          </p>
        </section>
        <section className="em-secao" aria-labelledby="em-a-mapa">
          <h2 id="em-a-mapa">Mapa do site e contato</h2>
          <p>
            O <Link href="/emendas/mapa-do-site">mapa do site</Link> lista todas as páginas e arquivos. Se algo não funcionar com a sua forma de
            navegar, escreva para diretoria.ponte.projetos@gmail.com.
          </p>
        </section>
      </div>
    </div>
  );
}
