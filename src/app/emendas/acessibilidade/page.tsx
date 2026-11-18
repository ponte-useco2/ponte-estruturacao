import type { Metadata } from "next";
import Link from "next/link";
import { Cabeca } from "../_componentes/Pecas";

export const metadata: Metadata = {
  title: "Acessibilidade",
  description:
    "Os recursos de acessibilidade do portal das emendas federais na Paraíba: tema e alto contraste, tamanho do texto, movimento reduzido, títulos em fonte simples, teclado, leitor de tela e mapa do site.",
};

const ELOS = [{ rotulo: "Acessibilidade" }] as const;

/** Os recursos de acessibilidade (13.1) e como usar cada um: o painel da versão 2 (17/11/2026; texto revisto em 18/11). */
export default function Acessibilidade() {
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={ELOS} kicker="Emendas federais na Paraíba" titulo="Acessibilidade">
        <p className="pa-sub">
          O portal segue as recomendações de acessibilidade para a web (WCAG 2.1, nível AA, e o eMAG) e os itens de acessibilidade da matriz
          do PNTP. O botão “Acessibilidade”, com o símbolo, fica no topo de todas as páginas e abre o painel com as opções abaixo.
        </p>
      </Cabeca>
      <div className="em-texto">
        <section className="em-secao" aria-labelledby="em-a-contraste">
          <h2 id="em-a-contraste">Tema e alto contraste</h2>
          <p>
            Em “Tema”, escolha entre Automático (segue o claro ou o escuro do seu aparelho), Claro, Escuro e Alto contraste. O alto
            contraste troca as cores por fundo preto, texto branco e links amarelos. A escolha fica guardada neste navegador para a próxima
            visita.
          </p>
        </section>
        <section className="em-secao" aria-labelledby="em-a-texto">
          <h2 id="em-a-texto">Tamanho do texto</h2>
          <p>
            Em “Texto”, “A+” aumenta e “A−” diminui, de 10 em 10%, entre 80% e 160%; o número entre os dois mostra o tamanho atual e,
            ao ser escolhido, volta a 100%. O zoom do navegador (Ctrl e + no teclado, ou o gesto de pinça no celular) também funciona, sem
            cortar o conteúdo.
          </p>
        </section>
        <section className="em-secao" aria-labelledby="em-a-movimento">
          <h2 id="em-a-movimento">Movimento e títulos</h2>
          <ul>
            <li>“Movimento: Reduzido” desliga animações, transições e a rolagem suave.</li>
            <li>“Títulos em fonte simples” troca a fonte dos títulos pela mesma do texto, mais fácil para quem tem baixa visão ou dislexia.</li>
            <li>“Restaurar padrão” desfaz todas as escolhas do painel de uma vez.</li>
          </ul>
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
            A leitura, a busca, a paginação e todas as opções do painel de acessibilidade funcionam sem JavaScript. O painel de filtro de
            cada coluna precisa dele; sem ele, um endereço já filtrado continua valendo.
          </p>
        </section>
        <section className="em-secao" aria-labelledby="em-a-cookie">
          <h2 id="em-a-cookie">O que fica guardado</h2>
          <p>
            Só as escolhas do painel (tema, tamanho do texto, movimento e títulos), em até quatro cookies deste navegador, por um ano e só
            para as páginas do portal. Eles são gravados apenas quando você muda uma opção, e “Restaurar padrão” apaga todos. O portal não pede
            cadastro e não guarda dado de quem visita. Ver a <Link href="/privacidade">política de privacidade</Link> do site.
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
