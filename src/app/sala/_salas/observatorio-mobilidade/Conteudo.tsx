/**
 * A sala do Observatório de Mobilidade Urbana de João Pessoa (16/11/2026): proposta de pesquisa aplicada elaborada pela
 * PONTE, para apreciação. Entidade executora prevista: Associação Ilha Tech. É apresentação, não processo de aprovação:
 * a sala não atribui aprovação nem endosso a ninguém (correção estratégica do titular, 16/11/2026).
 *
 * A página organiza o interesse em três pontos: o problema público; o que os R$ 200 mil permitem desenvolver e
 * investigar; e as capacidades que esta etapa pode deixar para um programa maior. As ressalvas técnicas ficam no fim,
 * discretas, sem dominar.
 *
 * IDENTIDADE: a da Ilha Tech, aplicada só nesta sala, em `observatorio.css` — preto, grafite, branco e o laranja como
 * destaque; Unbounded nos títulos e Montserrat no texto, servidas pelo `next/font` do próprio domínio. A moldura da sala
 * ("PONTE · Sala de trabalho") é compartilhada e não muda.
 *
 * LOGOTIPO: não há arquivo adequado (o único ativo original é a faixa de 727 × 26 px do timbrado). A executora aparece
 * em texto comum, sem imitar o logotipo, até chegar o arquivo vetorial.
 *
 * CONTEÚDO: tudo vem de `dados.ts`. Nada de conteúdo é escrito aqui. A folha de uma página (`Folha.tsx`) recebe os
 * mesmos objetos.
 */
import {
  ArrowDown,
  ArrowRight,
  CircleCheck,
  ClipboardList,
  Database,
  FileCheck,
  Footprints,
  Network,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { Montserrat, Unbounded } from "next/font/google";
import { BotaoImprimir } from "@/app/mapa/fiscal/[ibge]/simular/BotaoImprimir";
import {
  AVISO_ATIVOS,
  RESSALVA_PROVA_PRELIMINAR,
  ROTULO_GRAU,
  TIPOS_DE_ATIVO,
  centavosEmReais,
  centavosResumidos,
  dataBr,
  evidenciasDe,
  lerComposicao,
  naturezaDaProposta,
  seloDeEstado,
  totalDoItem,
  type CodigoProduto,
  type ItemDeComposicao,
  type Proposta,
} from "@/lib/oportunidades/proposta-observatorio";
import { APRESENTACAO, PROPOSTA } from "./dados";
import { Folha } from "./Folha";
import "./observatorio.css";

// Fontes variáveis: um arquivo por família cobre todos os pesos. `latin` inclui os acentos do português.
const fonteTitulo = Unbounded({ subsets: ["latin"], variable: "--ob-fonte-titulo", display: "swap" });
const fonteTexto = Montserrat({ subsets: ["latin"], variable: "--ob-fonte-texto", display: "swap" });

/** Ícone de cada etapa, todos da mesma biblioteca de traço único (lucide), já usada no site. */
const ICONE_DA_ETAPA: Record<CodigoProduto, LucideIcon> = {
  P1: Database,
  P2: Network,
  P3: Footprints,
  P4: FileCheck,
};

const comMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + ".";

/** O selo com a versão inteira numa linha só: o navegador quebraria "2026-11-16.5" no hífen. */
function Selo({ proposta }: { proposta: Proposta }) {
  const [antes, ...resto] = seloDeEstado(proposta).split(proposta.versao);
  if (resto.length === 0) return <>{antes}.</>;
  return (
    <>
      {antes}
      <span className="ob-inteiro">{proposta.versao}</span>
      {resto.join(proposta.versao)}.
    </>
  );
}

const quantidade = (q: ItemDeComposicao["quantidade"]) =>
  q.estado === "definida" ? q.valor.toString().replace(".", ",") : "em elaboração";
const valorUnitario = (v: ItemDeComposicao["valorUnitario"]) =>
  v.estado === "definido" ? centavosEmReais(v.centavos) : "em elaboração";

function TotalDaLinha({ item }: { item: ItemDeComposicao }) {
  const t = totalDoItem(item);
  if (t.estado === "definido") return <>{centavosEmReais(t.centavos)}</>;
  if (t.estado === "em-elaboracao") return <>em elaboração</>;
  return <span className="ob-invalido">inválido</span>;
}

/** A composição do orçamento. Enquanto a equipe não preencher, diz "em elaboração" — sem rubrica, sem percentual. */
function Composicao({ proposta }: { proposta: Proposta }) {
  if (proposta.composicao.length === 0) {
    return (
      <div className="ob-pendente">
        <p className="ob-pendente-titulo">Composição financeira em elaboração</p>
        <p>
          A distribuição do investimento ainda não foi definida. Cada linha vai trazer a atividade, a unidade de medida, a
          quantidade, o valor unitário e os produtos a que serve, e a soma terá de fechar com o investimento proposto.
        </p>
      </div>
    );
  }
  const c = lerComposicao(proposta.composicao);
  return (
    <div className="ob-rolagem">
      <table className="ob-tabela">
        <caption className="pa-sr">Composição do orçamento por atividade</caption>
        <thead>
          <tr>
            <th scope="col">Atividade</th>
            <th scope="col">Unidade</th>
            <th scope="col" className="ob-num">Quantidade</th>
            <th scope="col" className="ob-num">Valor unitário</th>
            <th scope="col" className="ob-num">Total</th>
            <th scope="col">Produtos</th>
          </tr>
        </thead>
        <tbody>
          {proposta.composicao.map((item, i) => (
            <tr key={`${i}-${item.atividade}`}>
              <td>{item.atividade}</td>
              <td>{item.unidade}</td>
              <td className="ob-num">{quantidade(item.quantidade)}</td>
              <td className="ob-num">{valorUnitario(item.valorUnitario)}</td>
              <td className="ob-num">
                <TotalDaLinha item={item} />
              </td>
              <td>{item.produtos.join(", ")}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={4}>
              Soma das linhas definidas{c.emElaboracao > 0 ? ` (${c.emElaboracao} em elaboração, fora da soma)` : ""}
            </th>
            <td className="ob-num">{centavosEmReais(c.definidoCentavos)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Cabeçalho de seção: número, nome e título. O número organiza a leitura; não é ranking. */
function Cabeca({ id, numero, nome, titulo }: { id: string; numero: string; nome: string; titulo: string }) {
  return (
    <header className="ob-cabeca">
      <p className="ob-kicker">
        <span className="ob-kicker-num">{numero}</span> {nome}
      </p>
      <h2 id={id} className="ob-h2">
        {titulo}
      </h2>
    </header>
  );
}

export function ConteudoObservatorio() {
  const proposta = PROPOSTA;
  const apresentacao = APRESENTACAO;
  const demonstrado = evidenciasDe(proposta, "demonstrado");
  const previsto = evidenciasDe(proposta, "previsto");
  const hipotese = evidenciasDe(proposta, "hipotese");
  const etapaDe = (codigo: CodigoProduto) => apresentacao.etapas.find((e) => e.produto === codigo);
  const investimento = centavosResumidos(proposta.investimentoPretendidoCentavos);
  const prova = apresentacao.provaPreliminar;

  return (
    <div className={`ob-raiz ${fonteTitulo.variable} ${fonteTexto.variable}`}>
      <div className="ob-tela">
        {/* ------------------------------------------------ abertura */}
        <section className="ob-secao ob-preta ob-abertura" aria-labelledby="ob-titulo">
          <div className="ob-dentro ob-abertura-grade">
            <div className="ob-abertura-texto">
              <p className="ob-identificacao">
                <span className="ob-identificacao-item">
                  <span className="ob-rotulo">Proposta</span>
                  <strong>{proposta.autoria}</strong>
                </span>
                <span className="ob-identificacao-item">
                  <span className="ob-rotulo">Entidade executora prevista</span>
                  <span>{proposta.executoraPrevista}</span>
                </span>
              </p>
              <p className="ob-kicker ob-kicker-abertura">Proposta de pesquisa aplicada · para apreciação</p>
              <h1 id="ob-titulo" className="ob-h1">
                {proposta.titulo}
              </h1>
              <p className="ob-valor">{proposta.objetoCurto}</p>
            </div>
            <dl className="ob-numeros">
              <div className="ob-numero ob-numero-destaque">
                <dt>Investimento proposto</dt>
                <dd>{investimento}</dd>
              </div>
              <div className="ob-numero">
                <dt>Prazo de trabalho</dt>
                <dd>{proposta.prazoMeses} meses</dd>
              </div>
              <div className="ob-numero">
                <dt>Produtos verificáveis</dt>
                <dd>{proposta.produtos.length}</dd>
              </div>
            </dl>
          </div>
          <div className="ob-dentro ob-sintese-bloco">
            <h2 className="ob-sintese-titulo">O que se propõe fazer com {investimento}</h2>
            <ol className="ob-sintese">
              {apresentacao.sintese.map((x) => (
                <li key={x.verbo} className="ob-sintese-item">
                  <p className="ob-sintese-verbo">{x.verbo}</p>
                  <p className="ob-sintese-texto">{x.texto}</p>
                  <p className="ob-sintese-produtos">{x.produtos.join(" · ")}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="ob-dentro">
            <p className="ob-natureza">
              <span>
                <Selo proposta={proposta} />
              </span>
              <a href="#ob-fontes">Fontes e ressalvas</a>
            </p>
          </div>
        </section>

        {/* ------------------------------------------------ 01 problema */}
        <section className="ob-secao ob-clara" aria-labelledby="ob-problema">
          <div className="ob-dentro">
            <Cabeca id="ob-problema" numero="01" nome="O problema público" titulo={apresentacao.problema.pergunta} />
            <p className="ob-lead">{apresentacao.problema.necessidade}</p>
            {demonstrado.length === 0 && (
              <p className="ob-nota-estado" role="note">
                Nenhum resultado aparece como comprovado nesta versão. Tudo o que segue é o que a pesquisa vai fazer e
                verificar.
              </p>
            )}
            <ul
              className={`ob-estados${demonstrado.length === 0 ? " ob-estados-dois" : ""}`}
              aria-label="O que a pesquisa vai verificar e o que é hipótese"
            >
              {demonstrado.length > 0 && (
                <li className="ob-estado ob-estado-demonstrado">
                  <CircleCheck aria-hidden="true" className="ob-icone" strokeWidth={1.75} />
                  <h3>{ROTULO_GRAU.demonstrado}</h3>
                  <ul>
                    {demonstrado.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <p className="ob-estado-fonte">{RESSALVA_PROVA_PRELIMINAR}</p>
                </li>
              )}
              <li className="ob-estado ob-estado-previsto">
                <ClipboardList aria-hidden="true" className="ob-icone" strokeWidth={1.75} />
                <h3>{ROTULO_GRAU.previsto}</h3>
                <ul className="ob-estado-lista">
                  {apresentacao.etapas.map((e) => (
                    <li key={e.produto}>
                      <strong>{e.produto}</strong> {e.entrega}
                    </li>
                  ))}
                </ul>
                {previsto.length > 0 && (
                  <ul>
                    {previsto.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </li>
              <li className="ob-estado ob-estado-hipotese">
                <Telescope aria-hidden="true" className="ob-icone" strokeWidth={1.75} />
                <h3>{ROTULO_GRAU.hipotese}</h3>
                <p>{apresentacao.expansao}</p>
                <p>{apresentacao.novosProjetos}</p>
                {hipotese.length > 0 && (
                  <ul>
                    {hipotese.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------ 02 solução */}
        <section className="ob-secao ob-grafite" aria-labelledby="ob-solucao">
          <div className="ob-dentro">
            <Cabeca id="ob-solucao" numero="02" nome="A solução proposta" titulo="A primeira etapa do Observatório" />
            <p className="ob-lead">{apresentacao.solucao}</p>
            <ol className="ob-fluxo">
              {apresentacao.etapas.map((e, i) => {
                const Icone = ICONE_DA_ETAPA[e.produto];
                const produto = proposta.produtos.find((p) => p.codigo === e.produto);
                return (
                  <li key={e.produto} className="ob-passo">
                    <Icone aria-hidden="true" className="ob-icone ob-passo-icone" strokeWidth={1.5} />
                    <p className="ob-passo-rotulo">{e.rotulo}</p>
                    <p className="ob-passo-produto">
                      <span className="ob-passo-codigo">{e.produto}</span> {produto?.nome}
                    </p>
                    {i < apresentacao.etapas.length - 1 && (
                      <ArrowRight aria-hidden="true" className="ob-passo-seta" strokeWidth={1.5} />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------ 03 produtos */}
        <section className="ob-secao ob-clara" aria-labelledby="ob-produtos">
          <div className="ob-dentro">
            <Cabeca
              id="ob-produtos"
              numero="03"
              nome="Os quatro produtos"
              titulo="O que o projeto entrega, e como se comprova"
            />
            <ol className="ob-produtos">
              {proposta.produtos.map((p) => {
                const etapa = etapaDe(p.codigo);
                return (
                  <li key={p.codigo} className="ob-produto">
                    <p className="ob-produto-codigo">{p.codigo}</p>
                    <h3>{p.nome}</h3>
                    <dl>
                      {etapa && (
                        <div className="ob-campo-entrega">
                          <dt>Entrega</dt>
                          <dd>{etapa.entrega}</dd>
                        </div>
                      )}
                      {etapa && (
                        <div>
                          <dt>Atividade ou metodologia</dt>
                          <dd>{comMaiuscula(etapa.trecho)}</dd>
                        </div>
                      )}
                      <div className="ob-campo-aceite">
                        <dt>Como a conclusão será comprovada</dt>
                        <dd>{p.evidencia}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------ 04 investimento */}
        <section className="ob-secao ob-preta" aria-labelledby="ob-investimento">
          <div className="ob-dentro">
            <Cabeca id="ob-investimento" numero="04" nome="Investimento e prazo" titulo="O que se pede, e por quanto tempo" />
            <dl className="ob-grandes">
              <div>
                <dt>Investimento proposto</dt>
                <dd className="ob-grande ob-grande-laranja">{investimento}</dd>
                <dd className="ob-grande-nota">{centavosEmReais(proposta.investimentoPretendidoCentavos)}</dd>
              </div>
              <div>
                <dt>Prazo de trabalho</dt>
                <dd className="ob-grande">{proposta.prazoMeses} meses</dd>
                <dd className="ob-grande-nota">para os {proposta.produtos.length} produtos</dd>
              </div>
            </dl>
            <Composicao proposta={proposta} />
          </div>
        </section>

        {/* ------------------------------------------------ 05 continuidade */}
        <section className="ob-secao ob-clara" aria-labelledby="ob-continuidade">
          <div className="ob-dentro">
            <Cabeca
              id="ob-continuidade"
              numero="05"
              nome="Próxima capacidade"
              titulo="O que fica para o Observatório"
            />
            <ol className="ob-camadas">
              <li className="ob-camada ob-camada-demonstrador">
                <p className="ob-camada-quando">Esta proposta</p>
                <h3>
                  O demonstrador: {investimento} em {proposta.prazoMeses} meses
                </h3>
                <ul className="ob-chips">
                  {proposta.produtos.map((p) => (
                    <li key={p.codigo} className="ob-chip">
                      <strong>{p.codigo}</strong> {p.nome}
                    </li>
                  ))}
                </ul>
              </li>
              <li className="ob-camada ob-camada-infra">
                <ArrowDown aria-hidden="true" className="ob-camada-seta" strokeWidth={1.5} />
                <p className="ob-camada-quando">O que fica · entregas previstas nos produtos</p>
                <h3>O que o projeto entrega e o Observatório pode reaproveitar</h3>
                <div className="ob-ativos-grade">
                  {TIPOS_DE_ATIVO.map((t) => (
                    <div key={t.tipo} className={`ob-ativos-grupo ob-ativos-${t.tipo}`}>
                      <p className="ob-ativos-produto">{t.titulo}</p>
                      <p className="ob-ativos-condicao">{t.condicao}</p>
                      <ul>
                        {apresentacao.reuso
                          .filter((r) => r.tipo === t.tipo)
                          .map((r) => (
                            <li key={r.ativo}>
                              <strong>
                                <span className="ob-ativo-codigo">{r.produto}</span> {r.ativo}
                              </strong>
                              <span>{r.uso}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="ob-ativos-aviso">{AVISO_ATIVOS}</p>
              </li>
              <li className="ob-camada ob-camada-hipotese">
                <ArrowDown aria-hidden="true" className="ob-camada-seta" strokeWidth={1.5} />
                <p className="ob-camada-quando">Depois · {ROTULO_GRAU.hipotese.toLowerCase()}</p>
                <h3>O programa maior</h3>
                <p>{apresentacao.novosProjetos}</p>
                <p>{apresentacao.expansao}</p>
              </li>
            </ol>
            <div className="ob-conversa">
              <h3>Para a próxima conversa</h3>
              <ul>
                {apresentacao.conversa.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ 06 fontes e ressalvas */}
        <section id="ob-fontes" className="ob-secao ob-grafite ob-fontes" aria-labelledby="ob-fontes-titulo">
          <div className="ob-dentro">
            <Cabeca
              id="ob-fontes-titulo"
              numero="06"
              nome="Fontes e ressalvas"
              titulo="De onde vem cada informação"
            />
            <div className="ob-fontes-grade">
              <div>
                <h3>Sobre esta proposta</h3>
                <p>{naturezaDaProposta(proposta)}</p>
                <p>
                  <Selo proposta={proposta} />
                </p>
              </div>
              <div>
                <h3>Fontes</h3>
                <ul>
                  {apresentacao.fontes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Ressalvas técnicas</h3>
                <ul>
                  <li>{RESSALVA_PROVA_PRELIMINAR}</li>
                  <li>
                    {prova.descricao} {prova.conferencia}
                  </li>
                  <li>Nenhum indicador ou estatística aparece nesta sala sem fonte conferida.</li>
                </ul>
                <div className="ob-imprimir mp-nao-imprimir">
                  <p>A folha de uma página, em A4, sai com os mesmos dados desta sala.</p>
                  <BotaoImprimir />
                </div>
              </div>
            </div>
            <p className="ob-versao">
              Proposta elaborada pela {proposta.autoria} em {dataBr(proposta.preparadaEm)}, para apreciação.
            </p>
          </div>
        </section>
      </div>
      <Folha proposta={proposta} apresentacao={apresentacao} />
    </div>
  );
}
