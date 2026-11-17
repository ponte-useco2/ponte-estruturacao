import type { Metadata } from "next";
import Link from "next/link";
import { ITENS_DO_MENU } from "../_componentes/menu";
import { Cabeca } from "../_componentes/Pecas";

export const metadata: Metadata = {
  title: "Mapa do site",
  description: "Todas as páginas e arquivos do portal das emendas federais na Paraíba.",
};

const ELOS = [{ rotulo: "Mapa do site" }] as const;

const DESCRICAO: Readonly<Record<string, string>> = {
  "/emendas": "o seletor de município e de período (ano da emenda), o mapa e os três números da Paraíba",
  "/emendas/registros": "os registros de um recorte (município, período e filtros no endereço), com os totais, a cobertura de cada medida e o arquivo do recorte; cada emenda abre a própria ficha",
  "/emendas/parlamentares": "os autores em ordem alfabética, com a autoria coletiva à parte; cada um abre a própria ficha",
  "/emendas/municipios": "os 223 municípios em ordem alfabética, e o estado à parte; cada um abre a própria ficha",
  "/emendas/dados": "os arquivos em CSV e JSON, o dicionário de dados, a licença e como citar",
  "/emendas/metodo": "as fontes, as definições, as limitações e a autoavaliação pela matriz do PNTP",
  "/emendas/perguntas": "as perguntas mais comuns sobre o portal e o dado",
};

/** O mapa do site (13.5; 17/11/2026): as páginas do menu, as fichas e os arquivos. */
export default function MapaDoSite() {
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={ELOS} kicker="Emendas federais na Paraíba" titulo="Mapa do site" />
      <div className="em-texto">
        <section className="em-secao" aria-labelledby="em-m-paginas">
          <h2 id="em-m-paginas">Páginas</h2>
          <ul>
            {ITENS_DO_MENU.map((i) => (
              <li key={i.href}>
                <Link href={i.href}>{i.rotulo}</Link>
                {DESCRICAO[i.href] ? ` — ${DESCRICAO[i.href]}.` : ""}
              </li>
            ))}
            <li>
              <Link href="/emendas/acessibilidade">Acessibilidade</Link> — os recursos e como usar.
            </li>
            <li>
              <Link href="/emendas/mapa-do-site">Mapa do site</Link> — esta página.
            </li>
          </ul>
        </section>
        <section className="em-secao" aria-labelledby="em-m-fichas">
          <h2 id="em-m-fichas">Fichas</h2>
          <ul>
            <li>Ficha da emenda: /emendas/emenda/ seguido do código de 12 dígitos (por exemplo, a partir da lista).</li>
            <li>Ficha do autor: /emendas/parlamentares/ seguido do código de 4 dígitos.</li>
            <li>Ficha do município: /emendas/municipios/ seguido do código IBGE.</li>
          </ul>
        </section>
        <section className="em-secao" aria-labelledby="em-m-arquivos">
          <h2 id="em-m-arquivos">Arquivos</h2>
          <ul>
            <li>
              Por ano da emenda: /emendas/dados/linhas-AAAA.csv e .json (por exemplo,{" "}
              <a href="/emendas/dados/linhas-2025.csv">linhas-2025.csv</a>); a lista dos anos está em{" "}
              <Link href="/emendas/dados">Dados abertos</Link>.
            </li>
            <li>
              <a href="/emendas/dados/linhas.csv">linhas.csv</a> e <a href="/emendas/dados/linhas.json">linhas.json</a> — todas as linhas
              (arquivo grande: se falhar, use os arquivos por ano).
            </li>
            <li>
              <a href="/emendas/dados/execucao-orcamentaria.csv">execucao-orcamentaria.csv</a> e{" "}
              <a href="/emendas/dados/execucao-orcamentaria.json">execucao-orcamentaria.json</a> — a execução orçamentária na Paraíba.
            </li>
            <li>
              <a href="/emendas/dados/pessoa-fisica.csv">pessoa-fisica.csv</a> e <a href="/emendas/dados/pessoa-fisica.json">pessoa-fisica.json</a>{" "}
              — a pessoa física somada.
            </li>
          </ul>
        </section>
        <section className="em-secao" aria-labelledby="em-m-site">
          <h2 id="em-m-site">No site da PONTE</h2>
          <ul>
            <li>
              <Link href="/">Página inicial da PONTE</Link>
            </li>
            <li>
              <Link href="/privacidade">Política de privacidade</Link> e <Link href="/termos">termos de uso</Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
