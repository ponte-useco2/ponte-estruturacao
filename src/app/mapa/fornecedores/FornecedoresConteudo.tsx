/**
 * A lista dos fornecedores dos convênios da PB e o quadro de concentração nas prefeituras.
 * Recebe a leitura pronta (lib/oportunidades/fornecedores.server.ts); aqui só se apresenta.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { formatarData } from "@/lib/oportunidades/central";
import {
  FATIA_ALTA,
  PAGO_MINIMO_CONCENTRACAO,
  ROTULO_FAIXA,
  cnpjLegivel,
  faixaConcentracao,
  nomeFornecedor,
  urlFornecedor,
  type ConcentracaoMunicipio,
} from "@/lib/oportunidades/fornecedores";
import { POR_PAGINA, type FiltroFornecedores, type LeituraPainelFornecedores, type LinhaPainel } from "@/lib/oportunidades/fornecedores.server";
import { moedaCurta } from "@/lib/oportunidades/radar";

type LeituraOk = Extract<LeituraPainelFornecedores, { estado: "ok" }>;

const AVISO =
  "Uso interno da PONTE. Nomes de empresas como registrados nos pagamentos e contratos do SICONV, inclusive de MEI e empresário individual " +
  "(com qualquer CPF da razão social mascarado). Pessoa física não aparece. Concentração é indicador para olhar, não irregularidade.";

const n = (x: number) => x.toLocaleString("pt-BR");
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);

function url(f: FiltroFornecedores, troca: Partial<FiltroFornecedores>): string {
  const alvo = { ...f, ...troca };
  const p = new URLSearchParams();
  if (alvo.q) p.set("q", alvo.q);
  if (alvo.municipio) p.set("municipio", alvo.municipio);
  if (alvo.ordem !== "municipios") p.set("ordem", alvo.ordem);
  if (alvo.marca) p.set("marca", alvo.marca);
  const q = p.toString();
  return `/mapa/fornecedores${q ? `?${q}` : ""}`;
}

export function FornecedoresConteudo({ leitura, filtro }: { leitura: LeituraOk; filtro: FiltroFornecedores }) {
  const { linhas, total, totais, municipios } = leitura;
  const porNome = [...municipios].sort((a, b) => (a.municipio ?? "").localeCompare(b.municipio ?? "", "pt-BR"));
  const escolhido = filtro.municipio ? municipios.find((m) => m.cod_ibge === filtro.municipio) : undefined;
  const concentrados = municipios
    .map((m) => ({ ...m, faixa: faixaConcentracao(m) }))
    .filter((m) => m.faixa === "alta" || m.faixa === "moderada")
    .sort((a, b) => (b.maior_fatia ?? 0) - (a.maior_fatia ?? 0) || b.pago_pj - a.pago_pj);
  const altos = concentrados.filter((m) => m.faixa === "alta").length;
  const referencia = leitura.execucao.referencia ?? leitura.execucao.dado_ate;

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Fornecedores · Paraíba</p>
        <h1 className="pa-titulo">Quem recebeu o dinheiro dos convênios</h1>
        <p className="pa-sub">
          As empresas pagas ou contratadas nos convênios de proponente da Paraíba, em quantos municípios atuam, com que contratos e onde um só
          fornecedor concentra as compras da prefeitura. Cada empresa abre um dossiê.
        </p>
        <p className="mp-fiscal-aviso">{AVISO}</p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <Cartao titulo="Empresas" numero={n(totais.fornecedores)} nota="pagas ou contratadas em convênios da PB" />
        <Cartao
          titulo="Inidôneas pelo TCU"
          numero={totais.naoVerificados === totais.fornecedores && totais.fornecedores > 0 ? "—" : n(totais.inidoneos)}
          nota={
            totais.naoVerificados > 0
              ? `${n(totais.naoVerificados)} sem verificação: a lista do TCU não foi lida nesta execução`
              : "na lista de licitantes inidôneos hoje"
          }
        />
        <Cartao titulo="Prefeituras concentradas" numero={n(altos)} nota={`um fornecedor com mais de ${pct(FATIA_ALTA)} do pago a empresas`} />
        <Cartao titulo="MEI" numero={n(totais.mei)} nota="razão social com CPF ou com a raiz do CNPJ na frente" />
      </div>

      <form method="get" action="/mapa/fornecedores" className="mp-filtros mp-busca-form mp-nao-imprimir" role="search">
        <div className="mp-busca-termo">
          <label htmlFor="forn-q" className="pa-campo-rotulo">
            Buscar
          </label>
          <input
            id="forn-q"
            name="q"
            type="search"
            defaultValue={filtro.q ?? ""}
            className="pa-input"
            placeholder="nome da empresa ou CNPJ"
            autoComplete="off"
          />
        </div>
        <div className="pa-linha mp-painel-filtros">
          <Campo id="forn-municipio" rotulo="Município">
            <select id="forn-municipio" name="municipio" defaultValue={filtro.municipio ?? ""} className="pa-select mp-painel-municipio">
              <option value="">Toda a PB</option>
              {porNome.map((m) => (
                <option key={m.cod_ibge} value={m.cod_ibge}>
                  {m.municipio ?? `IBGE ${m.cod_ibge}`}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="forn-ordem" rotulo="Ordem">
            <select id="forn-ordem" name="ordem" defaultValue={filtro.ordem} className="pa-select">
              <option value="municipios">Mais municípios</option>
              <option value="valor">Mais recebido</option>
            </select>
          </Campo>
          <Campo id="forn-marca" rotulo="Só">
            <select id="forn-marca" name="marca" defaultValue={filtro.marca ?? ""} className="pa-select">
              <option value="">Todas</option>
              <option value="inidoneos">Inidôneas (TCU)</option>
              <option value="mei">MEI</option>
            </select>
          </Campo>
          <button type="submit" className="pa-btn pa-btn-pequeno">
            Filtrar
          </button>
        </div>
      </form>

      <section aria-labelledby="forn-lista" className="mp-radar-secao">
        <h2 id="forn-lista" className="mp-radar-h2" aria-live="polite">
          {escolhido ? `Fornecedores nos convênios de ${escolhido.municipio ?? "o município"}` : "Fornecedores"}: {n(total)}
          {total > linhas.length ? ` (os ${n(linhas.length)} primeiros)` : ""}
        </h2>
        {linhas.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhuma empresa neste filtro. <Link href="/mapa/fornecedores">Ver todas</Link>
          </p>
        ) : (
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col" className="mp-num">
                    Municípios
                  </th>
                  <th scope="col" className="mp-num">
                    {escolhido ? `Recebeu em ${escolhido.municipio ?? "lá"}` : "Recebeu na PB"}
                  </th>
                  <th scope="col" className="mp-num">
                    Contratos
                  </th>
                  <th scope="col" className="mp-num">
                    No Brasil
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <Linha key={l.cnpj} l={l} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > POR_PAGINA && <p className="pa-nota">Refine pela busca ou pelo município para ver as demais.</p>}
      </section>

      <section aria-labelledby="forn-concentracao" className="mp-radar-secao">
        <h2 id="forn-concentracao" className="mp-radar-h2">
          Concentração nas prefeituras
        </h2>
        <p className="pa-nota">
          Nos convênios em que a prefeitura é a proponente, quanto o maior fornecedor levou do que foi pago a empresas. Entram as prefeituras com
          pelo menos {moedaCurta(PAGO_MINIMO_CONCENTRACAO)} pagos a empresas e compra {ROTULO_FAIXA.moderada} ou com {ROTULO_FAIXA.alta}.
        </p>
        {concentrados.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma prefeitura com compra concentrada nesta execução.</p>
        ) : (
          <TabelaConcentracao linhas={concentrados} filtro={filtro} />
        )}
      </section>

      <section aria-labelledby="forn-fonte" className="mp-radar-secao">
        <h2 id="forn-fonte" className="mp-radar-h2">
          Fonte e método
        </h2>
        <ul className="mp-laudo-causas mp-laudo-miudo">
          <li>
            Pagamentos e contratos: dados abertos do Transferegov (SICONV), painel de {formatarData(referencia)}. O contrato liga ao convênio pela
            licitação.
          </li>
          <li>
            Fornecedor é quem tem CNPJ. O que vai para a conta do próprio convenente ou do órgão executor (OBTV para o convenente ou para o
            executor) não conta. Pagamento a pessoa física só entra somado, no laudo de cada convênio.
          </li>
          <li>
            Municípios e convênios contam onde a empresa recebeu; “no Brasil” conta os convênios de qualquer UF em que ela recebeu. Contrato sem
            pagamento conta nos contratos, não nos municípios.
          </li>
          <li>
            Concentração: fatia do maior fornecedor e índice de concentração (soma dos quadrados das fatias; 1 é um fornecedor só), nos convênios da
            prefeitura. O Estado e as entidades ficam fora, porque trazem o IBGE do município-sede.
          </li>
          <li>
            Inidôneos: lista de licitantes inidôneos do TCU, lida no dia do painel. O início da sanção é o trânsito em julgado do acórdão. CEIS e
            CNEP, da CGU, ainda não entram.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Cartao({ titulo, numero, nota }: { titulo: string; numero: string; nota: string }) {
  return (
    <article className="pa-cartao">
      <h2 className="pa-mono">{titulo}</h2>
      <p className="pa-numero">{numero}</p>
      <p className="pa-nota">{nota}</p>
    </article>
  );
}

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: ReactNode }) {
  return (
    <span className="mp-busca-campo">
      <label htmlFor={id} className="pa-campo-rotulo">
        {rotulo}
      </label>
      {children}
    </span>
  );
}

function Linha({ l }: { l: LinhaPainel }) {
  return (
    <tr>
      <th scope="row">
        <Link href={urlFornecedor(l.cnpj)} className="mp-tabela-principal">
          {nomeFornecedor(l)}
        </Link>
        <span className="mp-tabela-secundario">
          CNPJ {cnpjLegivel(l.cnpj)}
          {l.mei ? " · MEI" : ""}
        </span>
        {l.inidoneo_tcu && <span className="pa-tag mp-laudo-nivel mp-laudo-critico">inidôneo (TCU)</span>}
      </th>
      <td className="mp-num">
        {n(l.pb_municipios)}
        <span className="mp-tabela-secundario">
          {n(l.pb_convenios)} {l.pb_convenios === 1 ? "convênio" : "convênios"}
        </span>
      </td>
      <td className="mp-num">
        {moedaCurta(l.noMunicipio ? l.noMunicipio.pago : l.pb_pago)}
        {l.noMunicipio && <span className="mp-tabela-secundario">{moedaCurta(l.pb_pago)} na PB</span>}
      </td>
      <td className="mp-num">
        {l.pb_contratos > 0 ? moedaCurta(l.pb_contratado) : "—"}
        {l.pb_contratos > 0 && (
          <span className="mp-tabela-secundario">
            {n(l.pb_contratos)} {l.pb_contratos === 1 ? "contrato" : "contratos"}
          </span>
        )}
      </td>
      <td className="mp-num">
        {moedaCurta(l.br_pago)}
        <span className="mp-tabela-secundario">
          {n(l.br_ufs)} {l.br_ufs === 1 ? "UF" : "UFs"} · {n(l.br_convenios)} {l.br_convenios === 1 ? "convênio" : "convênios"}
        </span>
      </td>
    </tr>
  );
}

function TabelaConcentracao({ linhas, filtro }: { linhas: (ConcentracaoMunicipio & { faixa: string })[]; filtro: FiltroFornecedores }) {
  return (
    <div className="mp-tabela-rolagem">
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">Prefeitura</th>
            <th scope="col">Maior fornecedor</th>
            <th scope="col" className="mp-num">
              Fatia dele
            </th>
            <th scope="col" className="mp-num">
              Pago a empresas
            </th>
            <th scope="col" className="mp-num">
              Índice
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((m) => (
            <tr key={m.cod_ibge}>
              <th scope="row">
                <Link href={url(filtro, { municipio: m.cod_ibge, q: null, marca: null })} className="mp-tabela-principal">
                  {m.municipio ?? `IBGE ${m.cod_ibge}`}
                </Link>
                <span className="mp-tabela-secundario">
                  {n(m.n_fornecedores)} fornecedores · {n(m.convenios)} {m.convenios === 1 ? "convênio" : "convênios"}
                </span>
              </th>
              <td>
                {m.maior_cnpj ? (
                  <Link href={urlFornecedor(m.maior_cnpj)}>{nomeFornecedor({ nome: m.maior_nome, cnpj: m.maior_cnpj })}</Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="mp-num">
                <span className={m.faixa === "alta" ? "mp-laudo-marca mp-laudo-informativo" : undefined}>{pct(m.maior_fatia)}</span>
                <span className="mp-tabela-secundario">{moedaCurta(m.maior_pago)}</span>
              </td>
              <td className="mp-num">{moedaCurta(m.pago_pj)}</td>
              <td className="mp-num">{m.hhi !== null ? m.hhi.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
