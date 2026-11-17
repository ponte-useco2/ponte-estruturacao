/**
 * As peças comuns das páginas do portal das emendas (17/11/2026): a trilha (13.2), o cabeçalho da página com a data do
 * dado, os cartões de número, a série anual com barras, a paginação e as telas de "sem dado" e "indisponível". Só
 * servidor; sem estado. O desenho é o do Mapa (`.pa-*`, `.mp-*`) mais o `emendas.css`.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import {
  fraseDasDatas,
  inteiro,
  largura,
  moedaCurta,
  type AnoDaSerie,
  type ExecucaoPublica,
  type Soma,
} from "@/lib/oportunidades/emendas-publico";
import { LinkFora } from "../../mapa/_componentes/LinkFora";
import { TabelaRolagem } from "../../mapa/_componentes/TabelaRolagem";

export interface Elo {
  rotulo: string;
  href?: string;
}

/**
 * A trilha (13.2), no desenho da v2 (a mesma das telas do percurso): Início › … › a página aberta, com `aria-current`.
 */
export function Trilha({ elos }: { elos: readonly Elo[] }) {
  const todos: Elo[] = [{ rotulo: "Início", href: "/emendas" }, ...elos];
  const ultimo = todos.length - 1;
  return (
    <nav aria-label="Trilha" className="trilha t14">
      <ol>
        {todos.map((e, i) => (
          <li key={`${i}-${e.rotulo}`}>
            {i === ultimo ? (
              <span aria-current="page" style={{ fontWeight: 700 }}>
                {e.rotulo}
              </span>
            ) : e.href ? (
              <Link prefetch={false} href={e.href}>
                {e.rotulo}
              </Link>
            ) : (
              <span>{e.rotulo}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** As datas, uma vez por tela e sempre dizendo de quê (referência e coleta). */
export function DataDoDado({ execucao }: { execucao: Pick<ExecucaoPublica, "dadoAte" | "concluidaEm"> }) {
  return <p className="em-data t14 tinta-2">{fraseDasDatas(execucao)} Atualização semanal, às terças.</p>;
}

/** O topo de cada página de apoio, no desenho da v2: a trilha, o rótulo, o título, o texto e as datas. */
export function Cabeca({
  elos,
  kicker,
  titulo,
  children,
  execucao,
}: {
  elos: readonly Elo[];
  kicker: string;
  titulo: ReactNode;
  children?: ReactNode;
  execucao?: Pick<ExecucaoPublica, "dadoAte" | "concluidaEm"> | null;
}) {
  return (
    <div className="em-cabeca pilha" style={{ gap: 12 }}>
      <Trilha elos={elos} />
      <p className="t14 rotulo tinta-2">{kicker}</p>
      <h1 className="disp titulo-tela">{titulo}</h1>
      {children}
      {execucao && <DataDoDado execucao={execucao} />}
    </div>
  );
}

/** Um número em destaque. */
export function Cartao({ titulo, numero, nota }: { titulo: string; numero: string; nota?: ReactNode }) {
  return (
    <div className="pa-cartao em-cartao">
      <p className="em-cartao-titulo">{titulo}</p>
      <p className="em-cartao-numero">{numero}</p>
      {nota && <p className="em-cartao-nota">{nota}</p>}
    </div>
  );
}

/** Os quatro números de um recorte: emendas, registros, previsto e realizado. */
export function CartoesDaSoma({ soma, notaPrevisto }: { soma: Soma; notaPrevisto?: string }) {
  return (
    <div className="em-cartoes">
      <Cartao titulo="Emendas" numero={inteiro(soma.emendas)} nota="códigos distintos com registro na Paraíba" />
      <Cartao titulo="Registros" numero={inteiro(soma.linhas)} nota="emenda × forma de repasse × instrumento" />
      <Cartao titulo="Previsto" numero={moedaCurta(soma.previsto)} nota={notaPrevisto ?? "indicado pelo autor (o pagamento direto não tem)"} />
      <Cartao titulo="Realizado (pago)" numero={moedaCurta(soma.pago)} nota="pago pelos canais, cada real uma vez" />
    </div>
  );
}

/**
 * A série por ano (17.1, série histórica): uma linha por ano, com a barra do pago (desenho) e os números escritos. As
 * colunas por chave (tipo ou forma de repasse) vêm depois, com o pago de cada uma. É tabela de resumo: sem filtro.
 */
export function SerieAnual({
  id,
  titulo,
  anos,
  chaves,
  rotulo,
  semAno,
}: {
  id: string;
  titulo: string;
  anos: readonly AnoDaSerie[];
  chaves: readonly string[];
  rotulo: (chave: string) => string;
  semAno?: Soma | null;
}) {
  const maximo = Math.max(0, ...anos.map((a) => a.total.pago));
  return (
    <TabelaRolagem rotuloId={id}>
      <table className="mp-tabela em-serie">
        <caption className="pa-sr">{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Ano</th>
            <th scope="col" className="mp-num">
              Emendas
            </th>
            <th scope="col" className="mp-num">
              Previsto
            </th>
            <th scope="col" className="mp-num">
              Realizado (pago)
            </th>
            <th scope="col">
              <span className="pa-sr">Barra do realizado (desenho)</span>
            </th>
            {chaves.map((k) => (
              <th key={k} scope="col" className="mp-num">
                {rotulo(k)} (pago)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {anos.map((a) => (
            <tr key={a.ano}>
              <th scope="row" className="mp-th-celula">
                {a.ano}
              </th>
              <td className="mp-num">{inteiro(a.total.emendas)}</td>
              <td className="mp-num">{moedaCurta(a.total.previsto)}</td>
              <td className="mp-num">{moedaCurta(a.total.pago)}</td>
              <td className="em-serie-barra" aria-hidden="true">
                <span className="em-barra-fundo">
                  <span className="em-barra-valor" style={{ width: `${largura(a.total.pago, maximo)}%` }} />
                </span>
              </td>
              {chaves.map((k) => (
                <td key={k} className="mp-num">
                  {a.porChave[k] ? moedaCurta(a.porChave[k].pago) : "—"}
                </td>
              ))}
            </tr>
          ))}
          {semAno && semAno.linhas > 0 && (
            <tr>
              <th scope="row" className="mp-th-celula">
                Ano não identificado
              </th>
              <td className="mp-num">{inteiro(semAno.emendas)}</td>
              <td className="mp-num">{moedaCurta(semAno.previsto)}</td>
              <td className="mp-num">{moedaCurta(semAno.pago)}</td>
              <td aria-hidden="true" />
              {chaves.map((k) => (
                <td key={k} className="mp-num">
                  —
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </TabelaRolagem>
  );
}

/** Uma tabela de resumo simples (até umas dezenas de linhas fixas): rótulo e as quatro medidas. Sem filtro. */
export function TabelaDeSoma({
  rotuloId,
  cabeca,
  linhas,
}: {
  rotuloId: string;
  cabeca: string;
  /** `semPrevisto`: a linha do pagamento direto, que não tem previsto (sai "—", e não "R$ 0"). */
  linhas: readonly { rotulo: ReactNode; chave: string; soma: Soma; semPrevisto?: boolean }[];
}) {
  return (
    <TabelaRolagem rotuloId={rotuloId}>
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">{cabeca}</th>
            <th scope="col" className="mp-num">
              Emendas
            </th>
            <th scope="col" className="mp-num">
              Registros
            </th>
            <th scope="col" className="mp-num">
              Previsto
            </th>
            <th scope="col" className="mp-num">
              Realizado (pago)
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave}>
              <th scope="row">{l.rotulo}</th>
              <td className="mp-num">{inteiro(l.soma.emendas)}</td>
              <td className="mp-num">{inteiro(l.soma.linhas)}</td>
              <td className="mp-num">{l.semPrevisto ? "—" : moedaCurta(l.soma.previsto)}</td>
              <td className="mp-num">{moedaCurta(l.soma.pago)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelaRolagem>
  );
}

/** A paginação: links comuns (funcionam sem JavaScript), com a página atual dita. */
export function Paginacao({ pagina, paginas, url }: { pagina: number; paginas: number; url: (p: number) => string }) {
  if (paginas <= 1) return null;
  return (
    <nav aria-label="Páginas da lista" className="em-paginacao">
      {pagina > 1 ? (
        <Link prefetch={false} className="pa-btn pa-btn-pequeno" href={url(1)}>
          « Primeira
        </Link>
      ) : null}
      {pagina > 1 ? (
        <Link prefetch={false} className="pa-btn pa-btn-pequeno" href={url(pagina - 1)} rel="prev">
          ‹ Anterior
        </Link>
      ) : null}
      <span aria-current="page">
        Página {inteiro(pagina)} de {inteiro(paginas)}
      </span>
      {pagina < paginas ? (
        <Link prefetch={false} className="pa-btn pa-btn-pequeno" href={url(pagina + 1)} rel="next">
          Próxima ›
        </Link>
      ) : null}
      {pagina < paginas ? (
        <Link prefetch={false} className="pa-btn pa-btn-pequeno" href={url(paginas)}>
          Última »
        </Link>
      ) : null}
    </nav>
  );
}

/** O banco ainda não tem o dado publicado (migração não aplicada, ou sem execução): tela neutra. */
export function SemDadoPublicado({ elos, titulo }: { elos: readonly Elo[]; titulo: string }) {
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={elos} kicker="Emendas federais na Paraíba" titulo={titulo} />
      <div className="pa-cartao">
        <p>
          O dado ainda não está publicado. A base é atualizada toda semana a partir do Portal da Transparência; enquanto isso, as emendas
          podem ser consultadas direto na fonte oficial:{" "}
          <LinkFora href="https://portaldatransparencia.gov.br/emendas">Portal da Transparência, emendas parlamentares</LinkFora>.
        </p>
      </div>
    </div>
  );
}

/** A leitura falhou (banco lento ou fora do ar): tela neutra, com "Tentar de novo" (link: funciona sem JavaScript). */
export function Indisponivel({ elos, titulo, endereco }: { elos: readonly Elo[]; titulo: string; endereco: string }) {
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={elos} kicker="Emendas federais na Paraíba" titulo={titulo} />
      <div className="pa-cartao pa-pilha">
        <p>A consulta não respondeu agora. Tente de novo em alguns minutos.</p>
        <p className="pa-linha">
          <Link prefetch={false} className="pa-btn" href={endereco}>
            Tentar de novo
          </Link>
          <LinkFora className="pa-btn" href="https://portaldatransparencia.gov.br/emendas">
            Consultar no Portal da Transparência
          </LinkFora>
        </p>
      </div>
    </div>
  );
}
