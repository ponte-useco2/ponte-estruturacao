/**
 * Ficha do município: tudo o que trava num lugar, para a conversa com a prefeitura.
 * Recebe os dados já lidos e só desenha, como o PainelConteudo.
 *
 * Onda 15, fase 3, F3.1a (20/10/2026): as listas (mudanças, as seis visões de convênio e as propostas) são tabelas com
 * filtro e ordem em cada coluna, com todas as linhas na página (limites de 300). O resumo por ano fica como está.
 */
import type { ReactNode } from "react";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import {
  DESCRICAO_SINAL,
  MOVIMENTOS,
  ROTULO_MOVIMENTO,
  ROTULO_SINAL,
  anosAssinatura,
  urlExportarFicha,
  fracao,
  parametrosPainel,
  percentual,
  periodoPorExtenso,
  resumoDe,
  urlFicha,
  urlPainel,
  type ParametrosFicha,
  type Sinal,
  type Visao,
} from "@/lib/oportunidades/painel";
import {
  DIAS_FICHA_MUDANCAS,
  LIMITE_FICHA_CONVENIOS,
  LIMITE_FICHA_MUDANCAS,
  LIMITE_FICHA_PROPOSTAS,
  LIMITE_FICHA_RECENTES,
  type FichaMunicipio,
  type MunicipioPainel,
} from "@/lib/oportunidades/painel.server";
import { TABELA_FICHA, TABELA_FICHA_MUDANCAS, TABELA_FICHA_PROPOSTAS, type VisaoConvenio } from "@/lib/oportunidades/painel-tabelas";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { urlEntePix } from "@/lib/oportunidades/pix-laudo";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { BotaoCsv, Cartao, Lista, Saidas, n, type Saida } from "./Pecas";
import { TabelaDaVisao, TabelaDasMudancas, TabelaDasPropostas } from "./TabelasConvenio";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";
import { Termo } from "../_componentes/Termo";

/**
 * A ficha do município no painel, só do administrador. Desde a F1c (07/10/2026) a prefeitura vai para a página do
 * município em abas (`/mapa/meu-municipio` redireciona), e a ficha deixou de ter o modo cliente.
 */
export function FichaConteudo({ f, ficha }: { f: ParametrosFicha; ficha: FichaMunicipio }) {
  const nome = ficha.nome ?? `IBGE ${f.ibge}`;
  const r = (v: Visao) => resumoDe(ficha.resumo, v);
  const contas = r("contas");
  const periodo = periodoPorExtenso(f.assinadoDe, f.assinadoAte);
  const anoMinimoPropostas = Number(ficha.execucao.referencia.slice(0, 4)) - 2;
  // Link para a mesma visão no painel, já filtrada por este município e período.
  const noPainel = (visao: Visao) =>
    urlPainel(parametrosPainel({ visao, municipio: f.ibge }), {
      assinadoDe: f.assinadoDe,
      assinadoAte: f.assinadoAte,
      movimento: f.movimento,
    });
  const semConvenio = [ficha.suspensiva, ficha.nunca, ficha.vigencia, ficha.contas, ficha.saldo, ficha.fisico].every(
    (l) => l.length === 0,
  );
  // B14b (08/10/2026): os vazios da ficha dizem de quem e de quando, e dão a saída. Na prefeitura, ver todos os
  // proponentes do município; com filtro de assinatura ou de movimentação, tirá-lo.
  const daPrefeitura = f.quem === "prefeitura" ? "da prefeitura " : "";
  const verTodos: Saida[] = f.quem === "prefeitura" ? [{ rotulo: "Ver todos os proponentes no município", href: urlFicha(f, { quem: "todos" }) }] : [];
  const tirarFiltros: Saida[] = [
    ...(periodo ? [{ rotulo: "Ver todos os anos de assinatura", href: urlFicha(f, { assinadoDe: null, assinadoAte: null }) }] : []),
    ...(f.movimento ? [{ rotulo: "Tirar o filtro de movimentação", href: urlFicha(f, { movimento: null }) }] : []),
  ];

  return (
    <div className="pa-pagina mp-radar mp-painel">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          <LinkMapa href={urlPainel(parametrosPainel({ uf: f.uf }), {})}>Painel da PONTE · {f.uf}</LinkMapa> · ficha do município
        </p>
        <h1 className="pa-titulo">
          {nome}/{f.uf}
        </h1>
        <p className="pa-sub">
          IBGE {f.ibge}. Dado até <strong>{formatarPublicacao(ficha.execucao.dado_ate)}</strong>: o arquivo do Transferegov traz a
          situação de {formatarData(ficha.execucao.referencia)}. Prazos contados até hoje, {formatarData(diaBrasilia(new Date().toISOString()))}.
        </p>
        {/* A página do município em abas (F1) e o painel fiscal (onda 8) cobrem só a PB. */}
        {f.uf === "PB" && (
          <p className="pa-nota">
            <LinkMapa href={urlMunicipio(f.ibge)}>Abrir a página do município: o que trava, dinheiro, contas, controle e indicadores →</LinkMapa>
          </p>
        )}
        {f.uf === "PB" && (
          <p className="pa-nota">
            <LinkMapa href={`/mapa/fiscal/${f.ibge}`}>Ver a capacidade fiscal e a elegibilidade deste município →</LinkMapa>
          </p>
        )}
        {f.uf === "PB" && (
          <p className="pa-nota">
            <LinkMapa href={urlEntePix(f.ibge)}>Abrir o laudo do Pix do município, plano a plano →</LinkMapa>
          </p>
        )}
      </div>

      <nav aria-label="Quais proponentes" className="pa-chips mp-painel-lados mp-painel-quem">
        {(["prefeitura", "todos"] as const).map((q) => (
          <LinkMapa
            key={q}
            href={urlFicha(f, { quem: q })}
            className={`pa-chip${f.quem === q ? " pa-ativo" : ""}`}
            aria-current={f.quem === q ? "true" : undefined}
          >
            {q === "prefeitura" ? "Prefeitura" : "Todos os proponentes no município"}
          </LinkMapa>
        ))}
      </nav>

      <div className="mp-filtros mp-radar-filtros">
        <form
          method="get"
          action={`/mapa/painel/municipio/${f.ibge}`}
          className="pa-linha mp-radar-uf mp-painel-filtros"
        >
          {f.quem !== "prefeitura" && <input type="hidden" name="quem" value={f.quem} />}
          <label htmlFor="ficha-movimento" className="pa-campo-rotulo">
            Movimentação
          </label>
          <select id="ficha-movimento" name="movimento" defaultValue={f.movimento ?? ""} className="pa-select">
            <option value="">qualquer</option>
            {MOVIMENTOS.map((m) => (
              <option key={m} value={m}>
                {ROTULO_MOVIMENTO[m]}
              </option>
            ))}
          </select>
          <fieldset className="mp-painel-periodo">
            <legend className="pa-campo-rotulo">Convênios assinados</legend>
            <label htmlFor="ficha-assinado-de" className="pa-sr">
              Assinado a partir de
            </label>
            <select id="ficha-assinado-de" name="assinado_de" defaultValue={f.assinadoDe ?? ""} className="pa-select">
              <option value="">desde sempre</option>
              {[...anosAssinatura(ficha.execucao.referencia)].reverse().map((a) => (
                <option key={a} value={a}>
                  de {a}
                </option>
              ))}
            </select>
            <label htmlFor="ficha-assinado-ate" className="pa-sr">
              Assinado até
            </label>
            <select id="ficha-assinado-ate" name="assinado_ate" defaultValue={f.assinadoAte ?? ""} className="pa-select">
              <option value="">até hoje</option>
              {anosAssinatura(ficha.execucao.referencia).map((a) => (
                <option key={a} value={a}>
                  até {a}
                </option>
              ))}
            </select>
          </fieldset>
          <button type="submit" className="pa-btn pa-btn-pequeno">
            Aplicar os filtros
          </button>
        </form>
      </div>

      {f.quem === "prefeitura" && <Sinais sinais={ficha.sinais} uf={f.uf} />}

      <section aria-labelledby="ficha-mudancas" className="mp-radar-secao">
        <h2 id="ficha-mudancas" className="mp-radar-h2">
          O que mudou nos últimos {DIAS_FICHA_MUDANCAS} dias
          {ficha.mudancas.length >= LIMITE_FICHA_MUDANCAS ? ` · as ${n(ficha.mudancas.length)} mais recentes` : ""}
        </h2>
        {ficha.mudancas.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhuma mudança {daPrefeitura}nos convênios e propostas de {nome} nos últimos {DIAS_FICHA_MUDANCAS} dias.
            <Saidas
              saidas={[
                ...verTodos,
                {
                  rotulo: `Ver as mudanças de toda a UF (${f.uf}) no painel`,
                  href: urlPainel(parametrosPainel({ visao: "mudancas", uf: f.uf }), { dias: 30 }),
                },
              ]}
            />
          </p>
        ) : (
          <>
            <p className="pa-nota">
              <LinkMapa href={urlPainel(parametrosPainel({ visao: "mudancas", municipio: f.ibge }), { dias: 7 })}>
                Ver no painel, com a contagem por tipo
              </LinkMapa>
            </p>
            <TabelaDasMudancas
              id={TABELA_FICHA_MUDANCAS}
              rotulo={`O que mudou nos convênios e propostas de ${nome}`}
              linhas={ficha.mudancas}
              naFicha
              comData
              csv={{ nome: `ficha-${f.ibge}-mudancas` }}
            />
          </>
        )}
      </section>

      <section aria-labelledby="ficha-convenios" className="mp-radar-secao">
        <div className="mp-painel-lista-cabeca">
          <h2 id="ficha-convenios" className="mp-radar-h2">
            Convênios que travam{periodo ? ` · ${periodo}` : ""}
            {f.movimento ? ` · ${ROTULO_MOVIMENTO[f.movimento]}` : ""}
          </h2>
          {!semConvenio && <BotaoCsv href={urlExportarFicha(f)} rotulo="Baixar os convênios (CSV)" />}
        </div>
        <div className="pa-grade pa-grade-3 mp-painel-cartoes">
          <Cartao rotulo="Suspensiva pendente" quantidade={r("suspensiva")("total").n} valor={r("suspensiva")("total").valor} legenda="de repasse" />
          <Cartao rotulo="Nunca desembolsado" quantidade={r("nunca")("total").n} valor={r("nunca")("total").valor} legenda="de repasse" tom="urgente" />
          <Cartao rotulo="Vigência em risco" quantidade={r("vigencia")("total").n} valor={r("vigencia")("total").valor} legenda="a desembolsar" />
          <Cartao
            rotulo="Contas atrasadas ou negativas"
            quantidade={contas("atrasada").n + contas("negativo").n}
            nota={
              <>
                Em <Termo slug="tomada-de-contas-especial">tomada de contas especial</Termo>: {n(contas("tce").n)} · esperando o
                concedente: {n(contas("concedente").n)}
              </>
            }
            tom={contas("negativo").n > 0 ? "urgente" : undefined}
          />
          <Cartao rotulo="Saldo parado há +1 ano" quantidade={r("saldo")("parado").n} valor={r("saldo")("parado").valor} legenda="em conta" />
          <Cartao
            rotulo="Desembolso alto, físico baixo"
            quantidade={r("fisico")("total").n}
            valor={r("fisico")("total").valor}
            legenda="desembolsados"
          />
        </div>

        {semConvenio && (
          <p className="pa-cartao pa-cartao-plano">
            Nenhum convênio {daPrefeitura}aparece nas seis visões do painel
            {periodo ? `, entre os ${periodo}` : ""}
            {f.movimento ? `, ${ROTULO_MOVIMENTO[f.movimento]}` : ""}.
            <Saidas saidas={[...tirarFiltros, ...verTodos]} />
          </p>
        )}
        {VISOES_DA_FICHA.map(({ visao, titulo, ordem, total }) => (
          <Bloco key={visao} titulo={titulo} linhas={ficha[visao].length} total={total ? r(visao)(total).n : undefined} href={noPainel(visao)}>
            <TabelaDaVisao
              id={TABELA_FICHA[visao]}
              rotulo={`${titulo}: ${nome}`}
              visao={visao}
              linhas={ficha[visao]}
              naFicha
              descricaoOrdemPadrao={ordem}
              csv={{ nome: `ficha-${f.ibge}-${visao}` }}
            />
          </Bloco>
        ))}
      </section>

      <section aria-labelledby="ficha-propostas" className="mp-radar-secao">
        <div className="mp-painel-lista-cabeca">
          <h2 id="ficha-propostas" className="mp-radar-h2">Propostas</h2>
          {ficha.porAno.length > 0 && <BotaoCsv href={urlExportarFicha(f, "propostas")} rotulo="Baixar as propostas (CSV)" />}
        </div>
        <p className="pa-sub">
          Enviadas desde {anoMinimoPropostas}, e as mais antigas ainda sem desfecho que se mexeram no último ano. O filtro
          de assinatura acima vale só para os convênios.
        </p>
        {ficha.porAno.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhuma proposta {f.quem === "prefeitura" ? "da prefeitura" : "no município"} enviada desde {anoMinimoPropostas}.
            <Saidas saidas={verTodos} />
          </p>
        ) : (
          <>
            <TabelaRolagem rotuloId="ficha-propostas">
              <table className="mp-tabela mp-painel-anos-propostas">
                <thead>
                  <tr>
                    <th scope="col">Ano do envio</th>
                    <th scope="col" className="mp-num">Enviadas</th>
                    <th scope="col" className="mp-num">Assinadas</th>
                    <th scope="col" className="mp-num">Reprovadas</th>
                    <th scope="col" className="mp-num">Impedimento</th>
                    <th scope="col" className="mp-num">Sem desfecho</th>
                    <th scope="col" className="mp-num">Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.porAno.map((a) => (
                    <tr key={a.ano_envio}>
                      <th scope="row">{a.ano_envio}</th>
                      <td className="mp-num">{n(a.enviadas)}</td>
                      <td className="mp-num">
                        {n(a.assinadas)} <span className="mp-painel-taxa">{percentual(fracao(a.assinadas, a.enviadas))}</span>
                      </td>
                      <td className="mp-num">
                        {n(a.reprovadas)}
                        {a.reprovadas_lote > 0 && <span className="mp-painel-taxa"> · {n(a.reprovadas_lote)} em lote</span>}
                      </td>
                      <td className="mp-num">
                        {n(a.impedimento)}
                        {a.impedimento_lote > 0 && <span className="mp-painel-taxa"> · {n(a.impedimento_lote)} em lote</span>}
                      </td>
                      <td className="mp-num">{n(a.sem_desfecho)}</td>
                      <td className="mp-num">{moedaCurta(a.valor_pedido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaRolagem>

            <Lista
              titulo={`Sem desfecho, das mais paradas para as menos${corte(ficha.semDesfecho.length, LIMITE_FICHA_PROPOSTAS)}`}
              vazio={`Nenhuma proposta ${daPrefeitura}esperando desfecho.`}
              semRolagem
            >
              {ficha.semDesfecho.length > 0 && (
                <TabelaDasPropostas
                  id={TABELA_FICHA_PROPOSTAS["sem-desfecho"]}
                  rotulo={`Propostas sem desfecho: ${nome}`}
                  linhas={ficha.semDesfecho}
                  quando="movimento"
                  descricaoOrdemPadrao="das mais paradas para as menos"
                  csv={{ nome: `ficha-${f.ibge}-propostas-sem-desfecho` }}
                />
              )}
            </Lista>
            <Lista
              titulo={`Reprovadas, impedidas e eliminadas, as mais recentes${corte(ficha.negadas.length, LIMITE_FICHA_RECENTES)}`}
              vazio={`Nenhuma proposta ${daPrefeitura}reprovada, impedida ou eliminada desde ${anoMinimoPropostas}.`}
              semRolagem
            >
              {ficha.negadas.length > 0 && (
                <TabelaDasPropostas
                  id={TABELA_FICHA_PROPOSTAS.negadas}
                  rotulo={`Propostas reprovadas, impedidas e eliminadas: ${nome}`}
                  linhas={ficha.negadas}
                  quando="movimento"
                  descricaoOrdemPadrao="das mais recentes para as mais antigas"
                  csv={{ nome: `ficha-${f.ibge}-propostas-negadas` }}
                />
              )}
            </Lista>
            <Lista
              titulo={`Assinadas, as mais recentes${corte(ficha.assinadas.length, LIMITE_FICHA_RECENTES)}`}
              vazio={`Nenhuma proposta ${daPrefeitura}assinada desde ${anoMinimoPropostas}.`}
              semRolagem
            >
              {ficha.assinadas.length > 0 && (
                <TabelaDasPropostas
                  id={TABELA_FICHA_PROPOSTAS.assinadas}
                  rotulo={`Propostas assinadas: ${nome}`}
                  linhas={ficha.assinadas}
                  quando="assinatura"
                  descricaoOrdemPadrao="das assinadas mais recentes para as mais antigas"
                  csv={{ nome: `ficha-${f.ibge}-propostas-assinadas` }}
                />
              )}
            </Lista>
            <p className="pa-nota">
              <strong>Em lote</strong> são 100 ou mais reprovações no mesmo dia pelo mesmo órgão: encerramento de edital, não
              análise de mérito. &ldquo;Nunca analisada&rdquo; é a proposta no <Termo slug="limbo">limbo</Termo>. Os números
              copiados são os que se digitam na consulta de propostas e de programas do Transferegov.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// ============================================================================ peças da ficha

/** As seis visões na ordem da ficha, com o título, a ordem da consulta e a chave do total no resumo. */
const VISOES_DA_FICHA: { visao: VisaoConvenio; titulo: string; ordem: string; total?: string }[] = [
  { visao: "suspensiva", titulo: "Cláusula suspensiva, pelo prazo", ordem: "pelo prazo, do mais próximo", total: "total" },
  { visao: "nunca", titulo: "Nunca desembolsados", ordem: "aceite parado primeiro, depois pela data do aceite e da assinatura", total: "total" },
  { visao: "vigencia", titulo: "Vigência acabando com execução baixa", ordem: "pelo fim da vigência, do mais próximo", total: "total" },
  { visao: "contas", titulo: "Prestação de contas, pelo valor", ordem: "pelo repasse, do maior" },
  { visao: "saldo", titulo: "Saldo parado, pelo valor", ordem: "pelo saldo, do maior", total: "parado" },
  { visao: "fisico", titulo: "Desembolso alto com físico baixo, pelo valor", ordem: "pelo valor desembolsado, do maior", total: "total" },
];

/** "· as N primeiras" quando a lista bateu no limite da leitura (o resto está no CSV do servidor). */
const corte = (linhas: number, limite: number) => (linhas >= limite ? ` · as ${n(linhas)} primeiras` : "");

const SINAIS_DA_FICHA: { sinal: Sinal; marca: (m: MunicipioPainel) => boolean; resumo: (m: MunicipioPainel) => string }[] = [
  { sinal: "saldo", marca: (m) => m.sinal_saldo, resumo: (m) => `${n(m.n_saldo)} · ${moedaCurta(m.valor_saldo)}` },
  { sinal: "suspensiva", marca: (m) => m.sinal_suspensiva, resumo: (m) => `${n(m.n_suspensiva)} · ${moedaCurta(m.valor_suspensiva)}` },
  { sinal: "contas_atrasadas", marca: (m) => m.sinal_contas_atrasadas, resumo: (m) => n(m.n_contas_atrasadas) },
  { sinal: "contas_negativas", marca: (m) => m.sinal_contas_negativas, resumo: (m) => n(m.n_contas_negativas) },
  {
    sinal: "sem_desembolso",
    marca: (m) => m.sinal_sem_desembolso,
    resumo: (m) => `${n(m.n_sem_desembolso)} · ${moedaCurta(m.valor_sem_desembolso)}`,
  },
];

function Sinais({ sinais, uf }: { sinais: MunicipioPainel | null; uf: string }) {
  return (
    <section aria-labelledby="ficha-sinais" className="mp-radar-secao">
      <h2 id="ficha-sinais" className="mp-radar-h2">
        Sinais da prefeitura{sinais ? ` · ${sinais.n_sinais} de 5` : ""}
      </h2>
      {!sinais ? (
        <p className="pa-cartao pa-cartao-plano">
          Nenhum dos cinco sinais aceso para a prefeitura.
          {/* B14b (08/10/2026): a saída para comparar com os vizinhos. */}
          <Saidas
            saidas={[{ rotulo: `Ver os municípios com mais sinais (${uf})`, href: urlPainel(parametrosPainel({ visao: "municipios", uf }), {}) }]}
          />
        </p>
      ) : (
        <ul className="mp-painel-sinais">
          {SINAIS_DA_FICHA.map(({ sinal, marca, resumo }) => (
            <li key={sinal} className={marca(sinais) ? "mp-painel-sinal-aceso" : undefined}>
              <span className="mp-painel-sinal-marca" aria-hidden="true">
                {marca(sinais) ? "●" : "○"}
              </span>
              <span>
                <strong>{ROTULO_SINAL[sinal]}</strong>
                <span className="pa-sr">{marca(sinais) ? " — aceso" : " — apagado"}</span>
                <span className="mp-tabela-secundario">
                  {marca(sinais) ? resumo(sinais) : DESCRICAO_SINAL[sinal]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="pa-nota">Os sinais olham todos os convênios da prefeitura, de qualquer ano de assinatura.</p>
    </section>
  );
}

function Bloco({
  titulo,
  linhas,
  total,
  href,
  children,
}: {
  titulo: string;
  linhas: number;
  total?: number;
  /** Sem href, sem o link para o painel. */
  href?: string;
  children: ReactNode;
}) {
  if (linhas === 0) return null;
  return (
    <div className="mp-radar-recorte">
      <h3 className="mp-radar-h3">
        {titulo}
        {total !== undefined
          ? total > linhas
            ? ` · ${n(linhas)} de ${n(total)}`
            : ""
          : linhas >= LIMITE_FICHA_CONVENIOS
            ? ` · os ${n(linhas)} primeiros`
            : ""}
      </h3>
      {href && (
        <p className="pa-nota">
          <LinkMapa href={href}>Ver no painel, com os números por órgão</LinkMapa>
        </p>
      )}
      {/* A tabela com filtro traz a própria caixa que rola (F3.1a). */}
      {children}
    </div>
  );
}
