/**
 * A sala do Observatório de Mobilidade Urbana de João Pessoa (16/11/2026): proposta de pesquisa aplicada elaborada pela
 * PONTE, para apreciação. Entidade executora prevista: Associação Ilha Tech. É apresentação, não processo de aprovação:
 * a sala não atribui aprovação nem endosso a ninguém (correção estratégica do titular, 16/11/2026).
 *
 * A página organiza o interesse em três pontos: o problema público; o que os R$ 200 mil permitem desenvolver e
 * investigar; e as capacidades que esta etapa pode deixar para um programa maior — a carteira "Um observatório,
 * múltiplas capacidades", seis hipóteses de expansão, cada uma com o valor indicativo e os módulos (estimativa interna
 * da coordenação, 16/11/2026: nunca cotação nem compromisso). Dois acessos na abertura levam ao demonstrador e ao programa; a
 * rolagem suave é a do site (desligada para quem pede menos movimento). As ressalvas técnicas ficam no fim, discretas.
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
  AVISO_CARTEIRA,
  AVISO_ENVELOPES,
  AVISO_MODULOS,
  AVISO_VALORES,
  DEFINICAO_AUTONOMIA,
  ROTULO_AUTONOMIA,
  ROTULO_NATUREZA,
  avisoDaEntrada,
  condicoesDeReaproveitamento,
  emSequencia,
  entradaDaCarteira,
  fontesDosValores,
  lerEnvelopes,
  lerModulos,
  lerValoresDoPrograma,
  quantidadePorExtenso,
  RESSALVA_PROVA_PRELIMINAR,
  ROTULO_GRAU,
  TIPOS_DE_ATIVO,
  centavosEmEscala,
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
  emVoltaDoValor,
} from "@/lib/oportunidades/proposta-observatorio";
import { APRESENTACAO, PROPOSTA } from "./dados";
import { Esquema } from "./Esquema";
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

/**
 * A distribuição inicial em envelopes (coordenação, 16/11/2026): estimativa interna, referência para a pesquisa de
 * preços. Não é a composição, que segue em elaboração logo abaixo. A barra é proporcional ao maior envelope.
 */
function Envelopes({ proposta }: { proposta: Proposta }) {
  const { estimativa, itens } = proposta.envelopes;
  if (itens.length === 0) return null;
  const leitura = lerEnvelopes(proposta);
  const maior = Math.max(...itens.map((x) => x.centavos));
  return (
    <div className="ob-envelopes">
      <div className="ob-envelopes-topo">
        <p className="ob-envelopes-titulo">Distribuição inicial em envelopes</p>
        <p className="ob-natureza">{ROTULO_NATUREZA[estimativa.natureza]}</p>
      </div>
      <p className="ob-envelopes-aviso">{AVISO_ENVELOPES}</p>
      <div className="ob-rolagem">
        <table className="ob-tabela ob-envelopes-tabela">
          <caption className="pa-sr">
            Distribuição inicial do investimento em envelopes, {ROTULO_NATUREZA[estimativa.natureza].toLowerCase()}
          </caption>
          <thead>
            <tr>
              <th scope="col">Envelope</th>
              <th scope="col" className="ob-num">
                Valor
              </th>
              <th scope="col" className="ob-envelope-col-barra">
                <span className="pa-sr">Proporção</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {itens.map((x) => (
              <tr key={x.rotulo}>
                <th scope="row">{x.rotulo}</th>
                <td className="ob-num">{centavosResumidos(x.centavos)}</td>
                <td className="ob-envelope-col-barra" aria-hidden="true">
                  <span className="ob-envelope-barra" style={{ width: `${(x.centavos / maior) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                Soma{" "}
                {leitura.confere ? (
                  "· fecha com o investimento proposto"
                ) : (
                  <span className="ob-invalido">· não fecha com o investimento proposto</span>
                )}
              </th>
              <td className="ob-num">{centavosResumidos(leitura.somaCentavos)}</td>
              <td className="ob-envelope-col-barra" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** A composição do orçamento. Enquanto a equipe não preencher, diz "em elaboração" — sem rubrica, sem percentual. */
function Composicao({ proposta }: { proposta: Proposta }) {
  if (proposta.composicao.length === 0) {
    return (
      <div className="ob-pendente">
        <p className="ob-pendente-titulo">Composição financeira em elaboração</p>
        <p>
          A composição detalhada ainda não foi definida. Cada linha vai trazer a atividade, a unidade de medida, a
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
  const valores = lerValoresDoPrograma(proposta, apresentacao);
  const entrada = entradaDaCarteira(apresentacao);

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
              <nav className="ob-acessos" aria-label="Percursos da proposta">
                <a className="ob-acesso ob-acesso-primario" href="#ob-demonstrador">
                  Conhecer o demonstrador de <span className="ob-sem-quebra">{investimento}</span>
                </a>
                <a className="ob-acesso" href="#ob-programa">
                  Explorar o programa completo
                </a>
              </nav>
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
                <p>
                  Cada entrega da pesquisa, e como a conclusão será comprovada, está em{" "}
                  <a href="#ob-produtos">Os quatro produtos</a>.
                </p>
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
                <p>
                  {apresentacao.expansao} <a href="#ob-programa">Ver a carteira de capacidades</a>.
                </p>
                {hipotese.length > 0 && (
                  <ul>
                    {hipotese.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </li>
            </ul>
            {demonstrado.length === 0 && (
              <p className="ob-nota-estado" role="note">
                Nenhum resultado aparece como comprovado nesta versão: o que esta página descreve é o que a pesquisa vai
                fazer e verificar.
              </p>
            )}
          </div>
        </section>

        {/* ------------------------------------------------ 02 solução */}
        <section id="ob-demonstrador" className="ob-secao ob-grafite" aria-labelledby="ob-solucao">
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
            <h3 className="ob-esq-titulo">Como o núcleo relaciona territórios, caminhos, serviços e barreiras</h3>
            <Esquema camadas={apresentacao.esquema.camadas} ressalva={apresentacao.esquema.ressalva} />
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
            <Envelopes proposta={proposta} />
            <Composicao proposta={proposta} />
          </div>
        </section>

        {/* ------------------------------------------------ 05 continuidade */}
        <section className="ob-secao ob-clara" aria-labelledby="ob-continuidade">
          <div className="ob-dentro">
            <Cabeca
              id="ob-continuidade"
              numero="05"
              nome="A base"
              titulo="O que o projeto pretende deixar como base para o Observatório"
            />
            <ol className="ob-camadas">
              <li className="ob-camada ob-camada-demonstrador">
                <p className="ob-camada-quando">Esta proposta</p>
                <h3>
                  O demonstrador: <span className="ob-sem-quebra">{investimento}</span> em {proposta.prazoMeses} meses
                </h3>
              </li>
              <li className="ob-camada ob-camada-infra">
                <ArrowDown aria-hidden="true" className="ob-camada-seta" strokeWidth={1.5} />
                <p className="ob-camada-quando">A base · entregas previstas nos produtos</p>
                <h3>O que o Observatório poderá reaproveitar</h3>
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
                <h3>O que essa base pode sustentar</h3>
                <p>{apresentacao.novosProjetos}</p>
                <p>
                  <a href="#ob-programa">Explorar o programa completo</a>
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------ 06 carteira macro */}
        <section id="ob-programa" className="ob-secao ob-preta ob-carteira" aria-labelledby="ob-carteira-titulo">
          <div className="ob-dentro">
            <Cabeca
              id="ob-carteira-titulo"
              numero="06"
              nome="O programa completo"
              titulo="Um observatório, múltiplas capacidades"
            />
            <p className="ob-carteira-abertura">{apresentacao.carteira.abertura}</p>
            <div className="ob-carteira-base">
              <p className="ob-camada-quando">A base comum · o demonstrador de <span className="ob-sem-quebra">{investimento}</span></p>
              <p>
                Os seis projetos aproveitam o que o demonstrador pretende deixar: {apresentacao.reuso.map((r) => r.ativo).join(", ")}.
              </p>
            </div>
            {/* A abertura da carteira em números: projetos, módulos e o investimento modular mínimo, que é o menor
                módulo potencialmente autônomo. Os valores levam sempre a natureza: estimativa interna. */}
            <dl className="ob-carteira-numeros">
              <div>
                <dt>Projetos</dt>
                <dd className="ob-cn-valor">{entrada.projetos}</dd>
                <dd className="ob-cn-nota">hipóteses de expansão</dd>
              </div>
              <div>
                <dt>Módulos</dt>
                <dd className="ob-cn-valor">{entrada.modulos}</dd>
                <dd className="ob-cn-nota">
                  {quantidadePorExtenso(entrada.autonomos, "potencialmente autônomo", "potencialmente autônomos")}
                </dd>
              </div>
              {entrada.aPartirDeCentavos !== null && (
                <div className="ob-cn-destaque">
                  <dt>Investimento modular</dt>
                  <dd className="ob-cn-valor">
                    <span className="ob-cn-prefixo">a partir de</span>{" "}
                    <span className="ob-sem-quebra">{centavosResumidos(entrada.aPartirDeCentavos)}</span>
                  </dd>
                  <dd className="ob-cn-nota">estimativa interna, para a expansão modular sobre a base técnica do demonstrador</dd>
                </div>
              )}
            </dl>
            <p className="ob-cn-definicao">{DEFINICAO_AUTONOMIA}</p>
            <p className="ob-cn-definicao">
              {emVoltaDoValor(avisoDaEntrada(investimento), investimento).map((x, i) =>
                x.valor ? <span key={i} className="ob-sem-quebra">{x.trecho}</span> : x.trecho,
              )}
            </p>
            <dl className="ob-programa-totais">
              <div>
                <dt>O demonstrador</dt>
                <dd className="ob-programa-valor">{investimento}</dd>
                <dd className="ob-programa-nota">investimento proposto nesta etapa</dd>
              </div>
              <div>
                <dt>Carteira complementar</dt>
                <dd className="ob-programa-valor">{centavosEmEscala(valores.carteiraCentavos)}</dd>
                <dd className="ob-programa-nota">
                  estimativa interna, em {quantidadePorExtenso(apresentacao.carteira.projetos.length, "projeto", "projetos")}
                </dd>
              </div>
              <div className="ob-programa-destaque">
                <dt>Programa completo</dt>
                <dd className="ob-programa-valor">{centavosEmEscala(valores.programaCentavos)}</dd>
                <dd className="ob-programa-nota">estimativa interna, com o demonstrador</dd>
              </div>
            </dl>
            <p className="ob-valores-aviso">{AVISO_VALORES}</p>
            {/* Cada card mostra só o essencial; módulos, componentes e dependências abrem por clique ou teclado
                (details nativo, fechado por padrão). Nada do conteúdo some: só muda de lugar. */}
            <ol className="ob-carteira-grade">
              {apresentacao.carteira.projetos.map((pr, i) => {
                const modulos = lerModulos(pr);
                return (
                  <li key={pr.nome} className="ob-projeto">
                    <p className="ob-projeto-topo">
                      <span className="ob-projeto-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="ob-projeto-tag">Hipótese de expansão</span>
                    </p>
                    <h3>{pr.nome}</h3>
                    <dl>
                      <div>
                        <dt>Problema público</dt>
                        <dd>{pr.problema}</dd>
                      </div>
                      <div>
                        <dt>Capacidade proposta</dt>
                        <dd>{pr.capacidade}</dd>
                      </div>
                    </dl>
                    <dl className="ob-projeto-valor">
                      <div className="ob-projeto-investimento">
                        <dt>Investimento indicativo · {ROTULO_NATUREZA[pr.estimativa.natureza].toLowerCase()}</dt>
                        <dd className="ob-projeto-total">{centavosResumidos(pr.totalIndicativoCentavos)}</dd>
                      </div>
                      <div>
                        <dt>Módulos</dt>
                        <dd className="ob-projeto-fato">{modulos.quantidade}</dd>
                      </div>
                      {modulos.menorCentavos !== null && (
                        <div>
                          <dt>Menor módulo</dt>
                          <dd className="ob-projeto-fato">
                            <span className="ob-sem-quebra">{centavosResumidos(modulos.menorCentavos)}</span>
                          </dd>
                        </div>
                      )}
                    </dl>
                    <div className="ob-projeto-detalhes">
                      <details className="ob-projeto-detalhe">
                        <summary>
                          Módulos e entregas<span className="ob-sr">: {pr.nome}</span>
                        </summary>
                        <ol className="ob-modulos">
                          {pr.modulos.map((m, j) => (
                            <li key={m.titulo}>
                              <p className="ob-modulo-topo">
                                <span className="ob-modulo-num">Módulo {j + 1}</span>
                                <span className="ob-modulo-valor">{centavosResumidos(m.centavos)}</span>
                              </p>
                              <p className="ob-modulo-titulo">{m.titulo}</p>
                              <p className="ob-modulo-autonomia">
                                <span className={`ob-modulo-selo ob-modulo-${m.autonomia}`}>{ROTULO_AUTONOMIA[m.autonomia]}</span>
                                {m.autonomia === "dependente" && <> · exige antes: {emSequencia(m.dependeDe)}</>}
                              </p>
                              <ul className="ob-modulo-entregas">
                                {m.entregas.map((e) => (
                                  <li key={e}>{e}</li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ol>
                        <p className="ob-modulos-nota">{AVISO_MODULOS}</p>
                      </details>
                      <details className="ob-projeto-detalhe">
                        <summary>
                          Componentes reutilizáveis<span className="ob-sr">: {pr.nome}</span>
                        </summary>
                        {condicoesDeReaproveitamento(pr, apresentacao.reuso).map((g) => (
                          <div key={g.titulo} className="ob-detalhe-grupo">
                            <p className="ob-detalhe-sub">{g.titulo}</p>
                            <ul className="ob-projeto-componentes">
                              {g.ativos.map((x) => (
                                <li key={x.ativo}>
                                  {x.ativo} <span className="ob-componente-produto">{x.produto}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="ob-detalhe-condicao">{g.condicao}</p>
                          </div>
                        ))}
                        <p className="ob-modulos-nota">{AVISO_ATIVOS}</p>
                      </details>
                      <details className="ob-projeto-detalhe">
                        <summary>
                          Dependências<span className="ob-sr">: {pr.nome}</span>
                        </summary>
                        <p className="ob-detalhe-sub">Dependências técnicas</p>
                        <ul>
                          {pr.dependencias.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                        <p className="ob-detalhe-sub">Ordem entre os módulos</p>
                        <ul>
                          {pr.modulos.map((m, j) => (
                            <li key={m.titulo}>
                              Módulo {j + 1}, {m.titulo}:{" "}
                              {m.autonomia === "dependente" ? `depende de ${emSequencia(m.dependeDe)}` : "potencialmente autônomo"}.
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="ob-carteira-aviso">{AVISO_CARTEIRA}</p>
          </div>
        </section>

        {/* ------------------------------------------------ 07 próxima decisão */}
        <section className="ob-secao ob-clara ob-decisao" aria-labelledby="ob-decisao-titulo">
          <div className="ob-dentro">
            <Cabeca id="ob-decisao-titulo" numero="07" nome="Próxima decisão" titulo="A próxima decisão possível" />
            <p className="ob-lead">{apresentacao.proximaDecisao.texto}</p>
            <ul className="ob-decisao-temas">
              {apresentacao.proximaDecisao.temas.map((t) => (
                <li key={t.rotulo}>
                  <span className="ob-decisao-rotulo">{t.rotulo}</span>
                  {emVoltaDoValor(t.texto, investimento).map((x, i) =>
                    x.valor ? <span key={i} className="ob-sem-quebra">{x.trecho}</span> : x.trecho,
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------ 08 fontes e ressalvas */}
        <section id="ob-fontes" className="ob-secao ob-grafite ob-fontes" aria-labelledby="ob-fontes-titulo">
          <div className="ob-dentro">
            <Cabeca
              id="ob-fontes-titulo"
              numero="08"
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
                  {[...apresentacao.fontes, apresentacao.carteira.fonte, ...fontesDosValores(proposta, apresentacao)].map((f) => (
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
