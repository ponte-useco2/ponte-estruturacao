/**
 * Investimentos federais num município: convênios por tema, situação e modalidade, e os planos de
 * transferências especiais e de fundo a fundo do ente. Recebe os dados já lidos.
 *
 * C4a (09/10/2026; item 8 da revisão R3 e 4.1 da auditoria R1): `publico`, o nível 0 da versão aberta, que vê esta
 * página (D1: a situação dos instrumentos). A busca pede cadastro: os links para ela dizem "(pede cadastro)" e levam à
 * entrada, e as linhas das barras ficam sem link. A estrela some porque a página não passa `seguindo`.
 */
import { EstrelaSeguir } from "../../../_componentes/EstrelaSeguir";
import { MARCA_PEDE_CADASTRO, linkNoPublico } from "@/lib/oportunidades/publico";
import {
  ROTULO_GRUPO_INVESTIMENTO,
  ROTULO_TIPO_INVESTIMENTO,
  contagem,
  ehMunicipioPb,
  fracoesDaMaior,
  linhasDe,
  parametrosBusca,
  rotuloModalidade,
  urlBusca,
  type LinhaInvestimento,
} from "@/lib/oportunidades/busca";
import type { LeituraInvestimentos } from "@/lib/oportunidades/busca.server";
import { formatarPublicacao } from "@/lib/oportunidades/central";
import { UF_DETALHE } from "@/lib/oportunidades/instrumentos-escopo";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { NOME_UF, urlUf } from "@/lib/oportunidades/pagina-uf";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";
import { trilha } from "@/lib/oportunidades/trilha";
import { recorteDaBase } from "@/lib/oportunidades/vazios";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { Trilha } from "../../../_componentes/Trilha";
import { TabelaRolagem } from "../../../_componentes/TabelaRolagem";

type LeituraOk = Extract<LeituraInvestimentos, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");

export function InvestimentosConteudo({
  ibge,
  uf,
  leitura,
  seguindo,
  publico = false,
}: {
  ibge: string;
  uf: string;
  leitura: LeituraOk;
  seguindo?: boolean;
  /** C4a: o nível 0 (versão pública). */
  publico?: boolean;
}) {
  const nome = leitura.municipio ?? `IBGE ${ibge}`;
  const tipos = linhasDe(leitura.linhas, "tipo");
  const temas = linhasDe(leitura.linhas, "tema");
  const situacoes = linhasDe(leitura.linhas, "situacao");
  const modalidades = linhasDe(leitura.linhas, "modalidade");
  const completo = uf === UF_DETALHE;
  const busca = linkNoPublico(urlBusca(parametrosBusca({}), { uf, municipio: ibge }), publico);
  // C4a: a linha da barra que levaria a rota fechada fica sem link no nível 0 (uma marca por linha poluiria a tabela).
  const aberto = (href: string | null) => (href && !linkNoPublico(href, publico).pedeCadastro ? href : null);
  const vazio = tipos.every((t) => t.n === 0);

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        {/*
          B11: na PB, o município volta à aba de onde esta página se abre ("Dinheiro federal"). Fora da PB, esta é a
          única página do município: o elo dele fica sem link, para a trilha não levar à própria página.
        */}
        <Trilha elos={trilha({ uf, municipio: { ibge: ehMunicipioPb(ibge) ? ibge : null, nome, aba: "dinheiro" } }, "Investimentos federais")} />
        <p className="pa-kicker">Investimentos federais</p>
        <h1 className="pa-titulo">
          {nome}/{uf}
        </h1>
        {seguindo !== undefined && (
          <p className="mp-nao-imprimir">
            <EstrelaSeguir tipo="municipio" chave={ibge} nome={`o município ${nome}`} seguindo={seguindo} />
          </p>
        )}
        <p className="pa-sub">
          {completo
            ? "Todos os convênios e contratos de repasse de proponentes do município desde 2008, e os planos de transferências especiais e de fundo a fundo da prefeitura."
            : "Fora da Paraíba, a busca só tem os convênios em execução ou em prestação de contas: os totais abaixo não contam os concluídos."}{" "}
          Proponente estadual fica de fora. Dado até {formatarPublicacao(leitura.execucao.dado_ate)}.
        </p>
        <p className="pa-nota">
          {ehMunicipioPb(ibge) && (
            <>
              <LinkMapa href={urlMunicipio(ibge, "dinheiro")}>Página do município</LinkMapa> ·{" "}
            </>
          )}
          <LinkMapa href={busca.href}>
            Ver os convênios do município na busca{busca.pedeCadastro && ` ${MARCA_PEDE_CADASTRO}`}
          </LinkMapa>
        </p>
      </div>

      {vazio ? (
        <SemInvestimento ibge={ibge} uf={uf} nome={leitura.municipio} completo={completo} publico={publico} />
      ) : (
        <>
          <div className="pa-grade pa-grade-3 mp-painel-cartoes">
            {(["convenio", "especial", "fundo"] as const).map((chave) => {
              const l = tipos.find((t) => t.chave === chave);
              return (
                <article key={chave} className="pa-cartao">
                  <h2 className="pa-mono">{ROTULO_TIPO_INVESTIMENTO[chave]}</h2>
                  <p className="pa-numero">{moedaCurta(l?.valor ?? 0)}</p>
                  <p className="pa-nota">
                    {chave === "convenio" ? contagem(l?.n ?? 0, "instrumento", "instrumentos") : contagem(l?.n ?? 0, "plano", "planos")} ·{" "}
                    {chave === "convenio" ? "desembolsado" : chave === "especial" ? "pago" : "creditado na conta"}{" "}
                    {moedaCurta(l?.executado ?? 0)}
                  </p>
                </article>
              );
            })}
          </div>
          {!completo && (
            <p className="pa-nota">Especiais e fundo a fundo plano a plano existem só para a Paraíba.</p>
          )}

          <Barras
            titulo="Convênios por tema"
            nota="Pelo nome do programa. Um convênio pode ter mais de um tema, então a soma das barras passa do total."
            linhas={temas}
            rotulo={(l) => (l.chave ? (ROTULO_TEMA[l.chave] ?? l.chave) : "Sem tema identificado")}
            link={(l) => aberto(l.chave ? urlBusca(parametrosBusca({}), { uf, municipio: ibge, tema: l.chave }) : null)}
          />
          <Barras
            titulo="Convênios por situação"
            linhas={situacoes}
            rotulo={(l) => ROTULO_GRUPO_INVESTIMENTO[l.chave] ?? l.chave}
            link={(l) =>
              aberto(
                ["execucao", "contas", "concluido", "encerrado"].includes(l.chave)
                  ? urlBusca(parametrosBusca({}), { uf, municipio: ibge, grupo: l.chave })
                  : null,
              )
            }
          />
          <Barras
            titulo="Convênios por modalidade"
            linhas={modalidades}
            rotulo={(l) => {
              const r = rotuloModalidade(l.chave);
              return r ? r.charAt(0).toUpperCase() + r.slice(1) : "Não informada";
            }}
            link={() => null}
          />
        </>
      )}
    </div>
  );
}

/**
 * Nada no recorte (B12b, onda 3 de UX, 08/10/2026; antes, "no recorte da busca", sem dizer qual). Fora da PB o
 * município sem nenhum convênio vivo fica vazio mesmo tendo recebido no passado, e as propostas recentes podem estar lá:
 * as saídas são elas, na busca, e a página da UF. Na PB, só as propostas (a página do município já está no topo).
 */
function SemInvestimento({ ibge, uf, nome, completo, publico }: { ibge: string; uf: string; nome: string | null; completo: boolean; publico: boolean }) {
  const recorte = recorteDaBase(uf);
  const propostas = linkNoPublico(urlBusca(parametrosBusca({}), { aba: "propostas", uf, municipio: ibge }), publico);
  // Sem nenhuma linha, o nome pode não ter vindo de lugar nenhum: "de IBGE 2408102" não se lê.
  const de = nome ? `de ${nome}` : "deste município";
  return (
    <div className="pa-cartao pa-cartao-plano pa-pilha">
      <p>
        {completo
          ? `Nenhum convênio, transferência especial ou fundo a fundo ${de} na base do Mapa.`
          : `Nenhum convênio de proponente ${de} na base do Mapa.`}
      </p>
      <p>
        {completo
          ? `A base tem ${recorte.convenios}; proponente estadual fica de fora.`
          : `Fora da Paraíba, a base tem ${recorte.convenios}: o município sem nenhum deles aparece vazio, mesmo que já tenha recebido.`}
      </p>
      <p className="pa-linha">
        <LinkMapa href={propostas.href} className="pa-btn pa-btn-pequeno">
          Ver as propostas do município{propostas.pedeCadastro && ` ${MARCA_PEDE_CADASTRO}`}
        </LinkMapa>
        {!completo && (
          <LinkMapa href={urlUf(uf)} className="pa-btn pa-btn-pequeno">
            Ver a página da UF ({NOME_UF[uf] ?? uf})
          </LinkMapa>
        )}
      </p>
      <p className="pa-nota">A busca das propostas traz {recorte.propostas}.</p>
    </div>
  );
}

function Barras({
  titulo,
  nota,
  linhas,
  rotulo,
  link,
}: {
  titulo: string;
  nota?: string;
  linhas: LinhaInvestimento[];
  rotulo: (l: LinhaInvestimento) => string;
  link: (l: LinhaInvestimento) => string | null;
}) {
  if (linhas.length === 0) return null;
  return (
    <section className="mp-radar-recorte">
      <h2 className="mp-radar-h3">{titulo}</h2>
      {nota && <p className="pa-nota">{nota}</p>}
      <TabelaRolagem rotulo={titulo}>
        <table className="mp-tabela mp-barras">
          <thead>
            <tr>
              <th scope="col">{titulo.replace("Convênios por ", "").replace(/^./, (c) => c.toUpperCase())}</th>
              <th scope="col" className="mp-num">Instrumentos</th>
              <th scope="col" className="mp-num">Repasse</th>
              <th scope="col" className="mp-num">Desembolsado</th>
            </tr>
          </thead>
          <tbody>
            {fracoesDaMaior(linhas, (l) => l.valor ?? 0).map(({ item: l, fracao }) => {
              const href = link(l);
              return (
                <tr key={l.chave}>
                  <th scope="row">
                    {href ? <LinkMapa href={href}>{rotulo(l)}</LinkMapa> : rotulo(l)}
                    {/* A barra é decoração: o número está na coluna ao lado. */}
                    <span className="mp-barra" aria-hidden="true">
                      <span className="mp-barra-cheia" style={{ width: `${Math.max(fracao * 100, 0.5)}%` }} />
                    </span>
                  </th>
                  <td className="mp-num">{n(l.n)}</td>
                  <td className="mp-num">{moedaCurta(l.valor)}</td>
                  <td className="mp-num">{moedaCurta(l.executado)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TabelaRolagem>
    </section>
  );
}
