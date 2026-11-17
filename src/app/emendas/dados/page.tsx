import type { Metadata } from "next";
import Link from "next/link";
import {
  DICIONARIO_CATALOGO,
  DICIONARIO_LINHAS,
  DICIONARIO_PF,
  FONTES_DO_PORTAL,
  LICENCA,
  LICENCA_URL,
  anoDeBrasilia,
  anosDosArquivos,
  comoCitar,
  inteiro,
  urlDoArquivoDoAno,
  type CampoDicionario,
} from "@/lib/oportunidades/emendas-publico";
import { lerInicio } from "@/lib/oportunidades/emendas-publico.server";
import { LinkFora } from "../../mapa/_componentes/LinkFora";
import { TabelaRolagem } from "../../mapa/_componentes/TabelaRolagem";
import { Cabeca } from "../_componentes/Pecas";

export const metadata: Metadata = {
  title: "Dados abertos",
  description:
    "Arquivos em CSV e JSON das emendas parlamentares federais com destino à Paraíba, sem cadastro, com dicionário de dados, licença CC BY 4.0 e como citar.",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br";
const ELOS = [{ rotulo: "Dados abertos" }] as const;

function Dicionario<T>({ id, titulo, campos }: { id: string; titulo: string; campos: readonly CampoDicionario<T>[] }) {
  return (
    <section className="em-secao" aria-labelledby={id}>
      <h3 id={id} className="em-sub-h">
        {titulo}
      </h3>
      <TabelaRolagem rotuloId={id}>
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Campo</th>
              <th scope="col">Tipo</th>
              <th scope="col">O que é</th>
              <th scope="col">Fonte</th>
            </tr>
          </thead>
          <tbody>
            {campos.map((c) => (
              <tr key={c.campo}>
                <th scope="row" className="mp-th-celula em-codigo">
                  {c.campo}
                </th>
                <td>{c.tipo}</td>
                <td>{c.descricao}</td>
                <td>{c.fonte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
    </section>
  );
}

const OUTROS_ARQUIVOS: readonly { titulo: string; base: string; descricao: string }[] = [
  {
    titulo: "Execução orçamentária (17.3)",
    base: "execucao-orcamentaria",
    descricao: "Empenhado, liquidado, pago e restos a pagar de cada emenda, só nas linhas do Portal com a Paraíba na localidade. Não se soma às linhas.",
  },
  {
    titulo: "Pessoa física, somada",
    base: "pessoa-fisica",
    descricao: "A soma dos pagamentos a pessoas físicas na Paraíba, por emenda e ano, sem nome e sem documento.",
  },
];

/**
 * Os dados abertos (15.4; 17/11/2026): os arquivos POR ANO DA EMENDA (o caminho principal: cada um bem abaixo do limite
 * de 4,5 MB da resposta de uma função da Vercel), o arquivo completo (grande, com o aviso de usar os por ano se falhar),
 * a execução orçamentária, a pessoa física somada, o recorte de qualquer filtro da lista, o dicionário de cada arquivo,
 * a data, a licença (CC BY 4.0, citando a PONTE e as fontes oficiais), as regras de uso e como citar. Sem cadastro
 * (decisão 3 do plano). A página abre mesmo sem o banco: sem o agregado, a lista dos anos sai sem o número de registros.
 */
export default async function DadosAbertos() {
  const l = await lerInicio();
  const execucao = l.estado === "ok" ? l.execucao : null;
  const dadoAte = execucao?.dadoAte ?? null;
  const hoje = new Date().toISOString();
  const anos = anosDosArquivos(l.estado === "ok" ? l.agregado : null, anoDeBrasilia(hoje));
  return (
    <div className="pa-pilha-larga">
      <Cabeca elos={ELOS} kicker="Emendas federais na Paraíba" titulo="Dados abertos" execucao={execucao}>
        <p className="pa-sub">
          Os mesmos dados do portal, para baixar e reusar, sem cadastro. CSV para planilha (separado por ponto e vírgula, vírgula decimal,
          datas DD/MM/AAAA, códigos protegidos para o Excel) e JSON para programas (os nomes dos campos em <span className="em-codigo">campos</span>{" "}
          e cada linha como uma lista de valores na mesma ordem, sem formatação).
        </p>
      </Cabeca>

      <section className="em-secao" aria-labelledby="em-por-ano">
        <h2 id="em-por-ano">Arquivos por ano da emenda</h2>
        <p className="pa-nota">
          O caminho recomendado: um arquivo por ano da emenda (o ano do código), com as linhas daquele ano (emenda × forma de repasse ×
          instrumento) e os mesmos campos do arquivo completo. Cada ano tem até uns 3 mil registros e fica com cerca de 2 MB.
        </p>
        <TabelaRolagem rotuloId="em-por-ano">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Ano da emenda</th>
                <th scope="col" className="mp-num">
                  Registros
                </th>
                <th scope="col">Arquivos</th>
              </tr>
            </thead>
            <tbody>
              {anos.map((a) => (
                <tr key={a.ano}>
                  <th scope="row" className="mp-th-celula">
                    {a.ano}
                  </th>
                  <td className="mp-num">{a.linhas === null ? "—" : inteiro(a.linhas)}</td>
                  <td>
                    <span className="em-baixar">
                      <a className="pa-btn pa-btn-pequeno" href={urlDoArquivoDoAno(a.ano, "csv")} download>
                        CSV<span className="pa-sr"> de {a.ano}</span>
                      </a>
                      <a className="pa-btn pa-btn-pequeno" href={urlDoArquivoDoAno(a.ano, "json")}>
                        JSON<span className="pa-sr"> de {a.ano}</span>
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
        <p className="em-data">
          Endereço de cada ano: {`${SITE_URL}/emendas/dados/linhas-AAAA.csv`} (ou .json), com o ano no lugar de AAAA.
        </p>
      </section>

      <section className="em-secao" aria-labelledby="em-arquivos">
        <h2 id="em-arquivos">Outros arquivos</h2>
        <ul className="pa-pilha">
          <li className="pa-cartao pa-pilha">
            <p>
              <strong>Todas as linhas, todos os anos (17.1).</strong> O mesmo conteúdo dos arquivos por ano, num arquivo só.{" "}
              <strong>Arquivo grande: se falhar, use os arquivos por ano.</strong>
            </p>
            <p className="em-baixar">
              <a className="pa-btn pa-btn-pequeno" href="/emendas/dados/linhas.csv" download>
                CSV
              </a>
              <a className="pa-btn pa-btn-pequeno" href="/emendas/dados/linhas.json">
                JSON
              </a>
              <span className="em-data">endereço: {`${SITE_URL}/emendas/dados/linhas.csv`} (ou .json)</span>
            </p>
          </li>
          {OUTROS_ARQUIVOS.map((a) => (
            <li key={a.base} className="pa-cartao pa-pilha">
              <p>
                <strong>{a.titulo}.</strong> {a.descricao}
              </p>
              <p className="em-baixar">
                <a className="pa-btn pa-btn-pequeno" href={`/emendas/dados/${a.base}.csv`} download>
                  CSV
                </a>
                <a className="pa-btn pa-btn-pequeno" href={`/emendas/dados/${a.base}.json`}>
                  JSON
                </a>
                <span className="em-data">endereço: {`${SITE_URL}/emendas/dados/${a.base}.csv`} (ou .json)</span>
              </p>
            </li>
          ))}
          <li className="pa-cartao pa-pilha">
            <p>
              <strong>Recorte filtrado.</strong> Na tela de <Link href="/emendas/registros">registros</Link>, os botões CSV e JSON levam o
              recorte inteiro (todas as páginas, na ordem da tabela), com os mesmos parâmetros do endereço da tela, em{" "}
              <span className="em-codigo">/emendas/dados/recorte.csv</span> ou <span className="em-codigo">.json</span>: as mesmas colunas da
              tabela, a coluna <span className="em-codigo">ausencias</span> (o campo sem dado e o motivo) e, no JSON, os totais com a
              cobertura. O período é o ano da emenda; os valores vão até a data de referência. A Paraíba inteira num período de quatro anos
              passa de 4 MB: se falhar, use os arquivos por ano.
            </p>
          </li>
        </ul>
      </section>

      <section className="em-secao" aria-labelledby="em-uso">
        <h2 id="em-uso">Data, licença e regras de uso</h2>
        <div className="em-texto">
          <ul>
            <li>
              <strong>Datas:</strong> a do arquivo de emendas do Portal da Transparência está no topo desta página e no nome de cada
              arquivo (<span className="em-codigo">-dado-AAAA-MM-DD</span>); no JSON, os metadados trazem também quando a PONTE leu as
              fontes e a data de cada fonte. A base é atualizada toda semana.
            </li>
            <li>
              <strong>Fontes:</strong> {FONTES_DO_PORTAL.join("; ")}.
            </li>
            <li>
              <strong>Licença:</strong> <LinkFora href={LICENCA_URL}>{LICENCA}</LinkFora>. Pode copiar, reusar e adaptar, inclusive para fim
              comercial, citando a PONTE e as fontes oficiais.
            </li>
            <li>
              <strong>Regras de uso:</strong> o dado é público e oficial, organizado pela PONTE; não substitui as fontes. Confira na fonte
              antes de qualquer decisão. Pessoa física aparece só somada; o nome do microempreendedor individual é omitido (a razão social
              traz o nome da pessoa). Não use o dado para identificar pessoas.
            </li>
            <li>
              <strong>Como citar:</strong> {comoCitar(dadoAte, SITE_URL, hoje, execucao?.concluidaEm ?? null)}
            </li>
          </ul>
        </div>
      </section>

      <section className="em-secao" aria-labelledby="dicionario">
        <h2 id="dicionario">Dicionário de dados</h2>
        <p className="pa-nota">
          Valores em reais. No CSV, os códigos (emenda, autor, instrumento, CNPJ, IBGE) vêm como <span className="em-codigo">{'="…"'}</span>{" "}
          para o Excel não os transformar em número; no JSON vêm puros. Vazio quer dizer que a fonte não traz a informação.
        </p>
        <Dicionario id="em-dic-linhas" titulo="Linhas (linhas.csv, linhas.json e os recortes)" campos={DICIONARIO_LINHAS} />
        <Dicionario id="em-dic-catalogo" titulo="Execução orçamentária (execucao-orcamentaria.csv e .json)" campos={DICIONARIO_CATALOGO} />
        <Dicionario id="em-dic-pf" titulo="Pessoa física somada (pessoa-fisica.csv e .json)" campos={DICIONARIO_PF} />
      </section>
    </div>
  );
}
