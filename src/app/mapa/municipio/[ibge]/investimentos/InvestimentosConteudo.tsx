/**
 * Investimentos federais num município: convênios por tema, situação e modalidade, e os planos de
 * transferências especiais e de fundo a fundo do ente. Recebe os dados já lidos.
 */
import Link from "next/link";
import {
  ROTULO_GRUPO_INVESTIMENTO,
  ROTULO_TIPO_INVESTIMENTO,
  contagem,
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
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";

type LeituraOk = Extract<LeituraInvestimentos, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");

export function InvestimentosConteudo({ ibge, uf, leitura }: { ibge: string; uf: string; leitura: LeituraOk }) {
  const nome = leitura.municipio ?? `IBGE ${ibge}`;
  const tipos = linhasDe(leitura.linhas, "tipo");
  const temas = linhasDe(leitura.linhas, "tema");
  const situacoes = linhasDe(leitura.linhas, "situacao");
  const modalidades = linhasDe(leitura.linhas, "modalidade");
  const completo = uf === UF_DETALHE;
  const busca = urlBusca(parametrosBusca({}), { uf, municipio: ibge });
  const vazio = tipos.every((t) => t.n === 0);

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Investimentos federais</p>
        <h1 className="pa-titulo">
          {nome}/{uf}
        </h1>
        <p className="pa-sub">
          {completo
            ? "Todos os convênios e contratos de repasse de proponentes do município desde 2008, e os planos de transferências especiais e de fundo a fundo da prefeitura."
            : "Fora da Paraíba, a busca só tem os convênios em execução ou em prestação de contas: os totais abaixo não contam os concluídos."}{" "}
          Proponente estadual fica de fora. Dado até {formatarPublicacao(leitura.execucao.dado_ate)}.
        </p>
        <p className="pa-nota">
          <Link href={busca}>Ver os convênios do município na busca</Link>
        </p>
      </div>

      {vazio ? (
        <p className="pa-cartao pa-cartao-plano">Nenhum investimento federal registrado para este município no recorte da busca.</p>
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
            link={(l) => (l.chave ? urlBusca(parametrosBusca({}), { uf, municipio: ibge, tema: l.chave }) : null)}
          />
          <Barras
            titulo="Convênios por situação"
            linhas={situacoes}
            rotulo={(l) => ROTULO_GRUPO_INVESTIMENTO[l.chave] ?? l.chave}
            link={(l) =>
              ["execucao", "contas", "concluido", "encerrado"].includes(l.chave)
                ? urlBusca(parametrosBusca({}), { uf, municipio: ibge, grupo: l.chave })
                : null
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
      <div className="mp-tabela-rolagem">
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
                    {href ? <Link href={href}>{rotulo(l)}</Link> : rotulo(l)}
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
      </div>
    </section>
  );
}
