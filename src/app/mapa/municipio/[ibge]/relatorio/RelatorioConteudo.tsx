/**
 * O relatório crítico do município (onda 14, camadas 1 e 2): o diagnóstico de Patos de 30/09/2026 para qualquer
 * município da PB, com os indicadores de social, economia, território e governança. Recebe a leitura pronta
 * (lib/oportunidades/relatorio-municipio.ts); aqui só se apresenta.
 *
 * Desde a F1 (06/10/2026) cada seção é um bloco exportado: o relatório para imprimir junta todos, e a página do
 * município em abas (`/mapa/municipio/[ibge]`) usa os mesmos blocos em cada aba. `destino` diz para onde vai o
 * número de cada convênio: o laudo, para quem pode; a página do instrumento, para os outros. Quem não é
 * administrador recebe o relatório já sem nomes de fornecedor (`relatorioSemNomes`).
 *
 * Onda 15, fase 2, lote B (13/10/2026): as listas (os seis recortes dos convênios, as tomadas de contas especiais e as
 * emendas) são tabelas com filtro e ordem em cada coluna (`TabelaFiltravel`); as colunas, os valores crus e a ordem
 * padrão moram em `relatorio-municipio.ts`. As tabelas que o público vê (os em execução e as emendas) filtram, mas não
 * ordenam por valor nem por contagem, e começam em ordem alfabética. No papel sai só o filtrado, com a linha "Filtro
 * aplicado". O CSV filtrado é do cadastro (D1). Os resumos (por situação, por desfecho, as decisões fiscais e os
 * indicadores) ficam sem filtro. Os links são `LinkMapa`.
 */
import type { ReactNode } from "react";
import { formatarData } from "@/lib/oportunidades/central";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { EXPLICA_CLASSE, ROTULO_CLASSE, ROTULO_QUEM } from "@/lib/oportunidades/fila";
import { citacoesDosBlocos, rotuloRegic, type BlocoIndicadores, type IndicadorLido, type LeituraIndicadores } from "@/lib/oportunidades/indicadores-municipio";
import { ROTULO_DECISAO, urlMunicipioFiscal } from "@/lib/oportunidades/fiscal";
import type { SlugTermo } from "@/lib/oportunidades/glossario";
import { PODE, destinoConvenio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import type { LeituraAssembleia } from "@/lib/oportunidades/emendas-pb";
import { EmendasEstaduaisDoMunicipio } from "../../../parlamentares/assembleia/EmendasEstaduais";
import type { ImpedidosDoAno } from "@/lib/oportunidades/pix-laudo";
import { moedaCurta } from "@/lib/oportunidades/radar";
import {
  COLUNAS_EMENDAS,
  COLUNAS_TCE,
  ORDEM_EMENDAS,
  ORDEM_TCE,
  ROTULO_DIMENSAO,
  ROTULO_NIVEL_ACHADO,
  TABELA_CONVENIOS,
  TABELA_EMENDAS,
  TABELA_TCE,
  colunasConvenios,
  conveniosNaOrdem,
  emendasNaOrdem,
  filaDoMunicipio,
  ordemPadraoConvenios,
  rotuloPeriodo,
  trechoDoArquivo,
  valoresDaEmenda,
  valoresDaTce,
  valoresDoConvenio,
  type Achado,
  type LinhaDoRecorte,
  type NivelAchado,
  type RecorteConvenios,
  type Relatorio,
} from "@/lib/oportunidades/relatorio-municipio";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { trilha } from "@/lib/oportunidades/trilha";
import { EstrelaSeguir } from "../../../_componentes/EstrelaSeguir";
import { TabelaFiltravel } from "../../../_componentes/TabelaFiltravel";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";
import { GraficoPessoal } from "./GraficoPessoal";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { Termo } from "../../../_componentes/Termo";
import { Trilha } from "../../../_componentes/Trilha";
import { TabelaRolagem } from "../../../_componentes/TabelaRolagem";

const AVISO_INTERNO =
  "Uso interno da PONTE. Leitura automática de fontes públicas, cada uma com a sua data (ver o fim). «A conferir» é ponto para olhar, " +
  "nunca irregularidade; não substitui certidão, parecer do concedente, decisão do Tribunal de Contas nem orientação jurídica.";
const AVISO =
  "Leitura automática de fontes públicas pela PONTE, cada uma com a sua data (ver o fim). «A conferir» é ponto para olhar, nunca " +
  "irregularidade; não substitui certidão, parecer do concedente, decisão do Tribunal de Contas nem orientação jurídica.";

/** Para onde vai o número de um convênio. */
/**
 * Para onde vai cada número de convênio. Os links de convênio saem com `prefetch={false}` (teste de 06/10/2026):
 * a página de Patos tem 30 ou mais deles, e a pré-carga de cada um renderizava um laudo inteiro no servidor ao
 * mesmo tempo; parte voltava com 503 e o clique às vezes não levava a lugar nenhum.
 */
export type Destino = (nr: string) => string;

const n = (x: number) => x.toLocaleString("pt-BR");
const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");
const classe = (nivel: NivelAchado) => (nivel === "em_dia" ? "atendido" : nivel);
const ROTULO_ESTADO: Record<string, string> = {
  atendido: "atendido",
  nao_atendido: "não atendido",
  atencao: "atenção",
  nao_verificavel: "não verificável",
  desatualizado: "desatualizado",
};
const dimensao = (r: Relatorio, d: Achado["dimensao"]) => r.achados.filter((a) => a.dimensao === d && a.nivel !== "em_dia");

/** Os cartões do topo cujo rótulo é sigla ou termo técnico: ligados ao verbete do glossário (B14, achado H05). */
const TERMO_DO_CARTAO: Record<string, SlugTermo> = {
  "Pessoal / RCL ajustada": "rcl",
  CAUC: "cauc",
  "Tomadas de contas especiais (TCU)": "tomada-de-contas-especial",
};

export function Secao({ id, titulo, nota, children }: { id: string; titulo: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      {nota && <p className="pa-nota">{nota}</p>}
      {children}
    </section>
  );
}

function Selo({ nivel }: { nivel: NivelAchado }) {
  return <span className={`pa-tag mp-laudo-nivel mp-laudo-${classe(nivel)}`}>{ROTULO_NIVEL_ACHADO[nivel]}</span>;
}

/**
 * Quem resolve, o prazo e o que fazer (F1b). Com `comClasse` (fora dos grupos), diz a classe da fila e deixa a ação
 * para o "O que fazer primeiro", que vem logo depois.
 */
function LinhaFila({ a, hoje, comClasse }: { a: Achado; hoje: string; comClasse: boolean }) {
  const partes: ReactNode[] = [];
  if (comClasse && a.classe) partes.push(<strong key="c">{ROTULO_CLASSE[a.classe]}</strong>);
  if (a.quem) partes.push(<span key="q">Quem resolve: {ROTULO_QUEM[a.quem]}</span>);
  if (a.prazo) partes.push(<span key="p">{a.prazo < hoje.slice(0, 10) ? `Prazo vencido em ${data(a.prazo)}` : `Prazo: ${data(a.prazo)}`}</span>);
  const acao = comClasse ? null : a.acao;
  if (!partes.length && !acao) return null;
  return (
    <>
      {partes.length > 0 && (
        <p className="mp-fila-quem">
          {partes.map((x, k) => (
            <span key={k}>
              {k > 0 && " · "}
              {x}
            </span>
          ))}
        </p>
      )}
      {acao && (
        <p className="mp-fila-acao">
          <span className="pa-kicker">O que fazer</span> {acao}
        </p>
      )}
    </>
  );
}

/**
 * Os achados em cartões. `fila` (F1b) acrescenta a cada um quem resolve, o prazo e o que fazer; `"com_classe"`
 * diz também a classe, para listas que não vêm agrupadas (o "Em uma página").
 */
export function ListaAchados({ achados, destino, fila, hoje = "" }: { achados: Achado[]; destino: Destino; fila?: "agrupada" | "com_classe"; hoje?: string }) {
  if (!achados.length) return null;
  return (
    <ul className="mp-laudo-lista">
      {achados.map((a) => (
        <li key={`${a.dimensao}-${a.titulo}`} className={`pa-cartao mp-laudo-risco mp-laudo-${classe(a.nivel)}`}>
          <p>
            <Selo nivel={a.nivel} /> <strong>{a.titulo}</strong> <span className="pa-mono mp-rel-dimensao">{ROTULO_DIMENSAO[a.dimensao]}</span>
          </p>
          <p>{a.fato}</p>
          {fila && <LinhaFila a={a} hoje={hoje} comClasse={fila === "com_classe"} />}
          {a.numeros && a.numeros.length > 0 && a.numeros.length <= 12 && (
            <p className="pa-nota mp-nao-imprimir">
              Convênios:{" "}
              {a.numeros.map((nr, k) => (
                <span key={nr}>
                  {k > 0 && " · "}
                  {/* Onda 15, fase 2, lote B (13/10/2026): `LinkMapa`, o mesmo `Link` sem pré-carga e com o `Carregando`. */}
                  <LinkMapa href={destino(nr)}>{nr}</LinkMapa>
                </span>
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Um recorte dos convênios (onda 15, fase 2, lote B, 13/10/2026): filtro e ordem em cada coluna (`TabelaFiltravel`).
 * As colunas, os valores crus e a ordem padrão de cada recorte moram em `relatorio-municipio.ts` (`colunasConvenios`);
 * aqui ficam as células. A nota que junta dois dados ("vigência até … · físico …") continua desenhada como era, e a
 * vigência, o físico, o saldo, a situação e o prazo filtram e ordenam nas colunas ocultas.
 *
 * O recorte "em execução" é o que o público vê: valor e desembolsado filtram, mas não ordenam, e a ordem padrão é pelo
 * número (antes, do maior valor para o menor). `rotulo` é o subtítulo do grupo ("Os 12 em execução"), que nomeia a
 * tabela (N04 da auditoria R1). `csv`: o nome do arquivo, só para o cadastro (D1); sem ele, o botão não aparece.
 */
function TabelaConvenios({ linhas, destino, recorte, rotulo, csv }: { linhas: LinhaDoRecorte[]; destino: Destino; recorte: RecorteConvenios; rotulo: string; csv?: string }) {
  if (!linhas.length) return null;
  const { ordem, descricao } = ordemPadraoConvenios(recorte);
  const dados: LinhaTabela[] = conveniosNaOrdem(linhas, recorte).map((l) => ({
    chave: l.nr_convenio,
    valores: valoresDoConvenio(l, recorte),
    celulas: {
      // A09 (onda 7, C): o número é o cabeçalho da linha (o componente faz da primeira coluna o `<th scope="row">`).
      convenio: <LinkMapa href={destino(l.nr_convenio)}>{l.nr_convenio}</LinkMapa>,
      valor: moedaCurta(l.valor ?? 0),
      desembolsado: l.desembolsado ? moedaCurta(l.desembolsado) : "—",
      // Nos nunca assinados a coluna é a data da vigência, desenhada como a nota de antes ("vigência até …").
      ...(recorte === "nunca" ? { vigencia: l.nota } : {}),
    },
  }));
  return (
    <TabelaFiltravel
      id={TABELA_CONVENIOS[recorte]}
      rotulo={rotulo}
      colunas={colunasConvenios(recorte)}
      linhas={dados}
      ordemPadrao={ordem}
      descricaoOrdemPadrao={descricao}
      csv={csv ? { nome: csv } : undefined}
      empilhar
    />
  );
}

/** O nome do CSV de uma tabela do relatório, só para o cadastro (D1: no nível 0 o botão não aparece). */
function csvDoNivel(nivel: NivelAcesso, parte: string, r: Pick<Relatorio, "nome">): string | undefined {
  return PODE.cadastro(nivel) ? `${parte}-${trechoDoArquivo(r.nome)}` : undefined;
}

const ROTULO_NIVEL_INDICADOR = { alto: "alto", moderado: "moderado", em_dia: "em dia" } as const;

/** `rotuloId` (onda 7, C; N04): o id do título do bloco ou da seção; sem ele, todas se chamavam "Indicadores do município". */
function TabelaIndicadores({ itens, rotuloId }: { itens: IndicadorLido[]; rotuloId?: string }) {
  if (!itens.length) return null;
  return (
    <TabelaRolagem {...(rotuloId ? { rotuloId } : { rotulo: "Indicadores do município" })}>
      <table className="mp-tabela mp-rel-indicadores mp-tabela-empilha">
        <thead>
          <tr>
            <th scope="col">Indicador</th>
            <th scope="col">Valor</th>
            <th scope="col">PB</th>
            <th scope="col">Brasil</th>
            <th scope="col">Mediana PB</th>
            <th scope="col">Mediana do porte · da região</th>
            <th scope="col">Posição na PB</th>
            <th scope="col">Nível</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((x) => (
            <tr key={x.id}>
              <th scope="row" className="mp-th-celula">
                {x.nome}
                <span className="mp-rel-fonte">
                  {" "}
                  {x.url ? (
                    <a href={x.url} rel="noreferrer" target="_blank">
                      {x.fonte}
                      <span className="pa-sr"> (abre em nova aba)</span>
                    </a>
                  ) : (
                    x.fonte
                  )}
                  , {x.ano}.{x.nota ? ` ${x.nota}` : ""}
                </span>
              </th>
              <td data-rotulo="Valor" className="mp-rel-num">{x.texto}</td>
              <td data-rotulo="PB" className="mp-rel-num">{x.pb ?? "—"}</td>
              <td data-rotulo="Brasil" className="mp-rel-num">{x.br ?? "—"}</td>
              <td data-rotulo="Mediana PB" className="mp-rel-num">{x.mediana ?? "—"}</td>
              <td data-rotulo="Mediana do porte · da região" className="mp-rel-num">{x.porte || x.regiao ? `${x.porte ?? "—"} · ${x.regiao ?? "—"}` : "—"}</td>
              <td data-rotulo="Posição na PB" className="mp-rel-num">{x.posicao ?? "—"}</td>
              <td data-rotulo="Nível">
                {/* H11 (onda 7, C, 09/10/2026; auditoria R1): o porquê do nível estava só no `title`, que o toque, o teclado e
                    a impressão não mostram. Agora vem à vista, logo abaixo do selo; a aba Indicadores é aberta ao público. */}
                {x.nivel ? (
                  <>
                    <span className={`pa-tag mp-laudo-nivel mp-laudo-${x.nivel === "em_dia" ? "atendido" : x.nivel}`}>
                      {ROTULO_NIVEL_INDICADOR[x.nivel]}
                    </span>
                    {x.porque && <span className="mp-rel-porque">{x.porque}</span>}
                  </>
                ) : (
                  <span className="mp-rel-contexto">{x.chave ? "não verificado" : "contexto"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelaRolagem>
  );
}

/**
 * `secao`: o id do título da seção, que nomeia a tabela quando ela é a única; com vários blocos, cada subtítulo nomeia a sua.
 * Onda 9, D (09/10/2026): a citação que a fonte exige (a do MapBiomas, no Território) fecha a tabela uma vez, como nota
 * de fonte, em vez de se repetir em letra miúda sob o nome da linha. Vale na aba "Indicadores", que não tem o bloco
 * "Fontes, datas e limites", e no relatório para imprimir.
 */
function BlocosIndicadores({ blocos, secao }: { blocos: (BlocoIndicadores | null)[]; secao: string }) {
  const validos = blocos.filter((b): b is BlocoIndicadores => b !== null);
  const rodape = citacoesDosBlocos(validos).map((c) => (
    <p key={c} className="pa-nota">
      Fonte: {c}
    </p>
  ));
  // Seção de um bloco só (economia, território, governança): o título da seção já diz o que é.
  if (validos.length === 1)
    return (
      <>
        <TabelaIndicadores itens={validos[0].itens} rotuloId={secao} />
        {rodape}
      </>
    );
  return (
    <>
      {validos.map((b) => (
        <Sub key={b.dimensao} titulo={b.titulo} id={`${secao}-${b.dimensao}`}>
          <TabelaIndicadores itens={b.itens} rotuloId={`${secao}-${b.dimensao}`} />
        </Sub>
      ))}
      {rodape}
    </>
  );
}

function OMunicipio({ l }: { l: LeituraIndicadores }) {
  const g = l.grupo;
  const regic = g?.regic ? `${rotuloRegic(g.regic)}${g.polo ? ", cidade-polo" : ""}${g.arranjo ? `, no ${g.arranjo}` : ""}` : null;
  return (
    <>
      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        {l.municipio.map((x) => (
          <article key={x.id} className="pa-cartao mp-rel-cartao">
            <h3 className="pa-mono">{x.nome}</h3>
            <p className="pa-numero">{x.texto}</p>
            <p className="pa-nota">
              {x.ano} · {x.fonte}
              {x.mediana ? ` · mediana da PB ${x.mediana}` : ""}
            </p>
          </article>
        ))}
      </div>
      {g && (
        <p>
          Comparado com os municípios de porte <strong>{g.porte ?? "—"}</strong> na PB (os 223 divididos em três faixas de população) e com os da{" "}
          <Termo slug="regiao-imediata">região imediata</Termo> de <strong>{g.regiao_imediata ?? "—"}</strong>
          {g.regiao_intermediaria ? ` (região intermediária de ${g.regiao_intermediaria})` : ""}.
          {regic && (
            <>
              {" "}
              Na <Termo slug="regic">hierarquia urbana do IBGE (REGIC 2018)</Termo>: {regic}.
            </>
          )}
        </p>
      )}
    </>
  );
}

/** `id` (onda 7, C; N04): o do subtítulo, para a tabela do grupo levar o nome dele. */
function Sub({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div className="mp-rel-sub">
      <h3 id={id} className="mp-rel-h3">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

// ================================================================ blocos (cada um vira uma seção do relatório e entra numa aba)

export function Cartoes({ r }: { r: Relatorio }) {
  return (
    <div className="pa-grade pa-grade-4 mp-painel-cartoes">
      {r.cartoes.map((k) => (
        <article key={k.rotulo} className={`pa-cartao mp-rel-cartao${k.nivel ? ` mp-laudo-risco mp-laudo-${classe(k.nivel)}` : ""}`}>
          <h3 className="pa-mono">{TERMO_DO_CARTAO[k.rotulo] ? <Termo slug={TERMO_DO_CARTAO[k.rotulo]}>{k.rotulo}</Termo> : k.rotulo}</h3>
          <p className="pa-numero">{k.valor}</p>
          <p className="pa-nota">{k.nota}</p>
        </article>
      ))}
    </div>
  );
}

export function EmOrdem({ r }: { r: Relatorio }) {
  if (!r.emDia.length) return null;
  return (
    <div className="pa-cartao mp-laudo-risco mp-laudo-atendido mp-rel-emdia">
      <p>
        <Selo nivel="em_dia" /> <strong>O que está em ordem</strong>
      </p>
      <ul>
        {r.emDia.map((a) => (
          <li key={a.titulo}>
            <strong>{a.titulo}.</strong> {a.fato}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BlocoPassos({ r }: { r: Relatorio }) {
  if (!r.passos.length) return null;
  return (
    <Secao
      id="rel-passos"
      titulo="O que fazer primeiro"
      nota={`Do que destrava mais para o que destrava menos. Só o que depende ${r.escopo === "entidade" ? "da entidade" : "do município"}.`}
    >
      <ol className="mp-simulador-caminho">
        {r.passos.map((s) => (
          <li key={s.titulo} className="pa-cartao mp-simulador-passo">
            <p>
              <strong>{s.titulo}</strong>
            </p>
            <p className="pa-nota">{s.porque}</p>
          </li>
        ))}
      </ol>
    </Secao>
  );
}

/**
 * A aba "o que trava e o que destrava" (F1b): a fila do município em classes, na mesma ordem do "Em uma página" e
 * da carteira (`fila.ts`). O que é só informação e os indicadores ficam nas abas deles, com a contagem aqui.
 */
export function BlocoFila({ r, destino, linkIndicadores }: { r: Relatorio; destino: Destino; linkIndicadores?: string }) {
  const f = filaDoMunicipio(r);
  return (
    <>
      {f.grupos.length > 0 && (
        <p className="pa-nota">
          Cada ponto traz o <Termo slug="nivel-do-ponto">nível</Termo>, quem resolve e o que fazer. É ponto <Termo slug="ponto-a-conferir">a conferir</Termo>: para
          olhar, nunca irregularidade.
        </p>
      )}
      {!f.grupos.length && (
        <Secao id="mun-fila" titulo="Nada travando nas fontes lidas">
          <p>Nenhum ponto trava dinheiro novo, pode virar cobrança, tem prazo ou pede atenção. A aba «Resumo» diz o que foi conferido.</p>
        </Secao>
      )}
      {f.grupos.map((g) => (
        <Secao key={g.classe} id={`mun-fila-${g.classe}`} titulo={`${ROTULO_CLASSE[g.classe]} (${n(g.itens.length)})`} nota={EXPLICA_CLASSE[g.classe]}>
          <ListaAchados achados={g.itens} destino={destino} fila="agrupada" hoje={r.hoje} />
        </Secao>
      ))}
      {(f.informativos > 0 || f.indicadores > 0) && (
        <p className="pa-nota">
          Fora desta lista:{" "}
          {f.informativos > 0 && `${n(f.informativos)} ${f.informativos === 1 ? "ponto só de informação" : "pontos só de informação"}, nas abas de cada assunto`}
          {f.informativos > 0 && f.indicadores > 0 && "; "}
          {f.indicadores > 0 &&
            (linkIndicadores ? (
              <LinkMapa href={linkIndicadores}>
                {n(f.indicadores)} {f.indicadores === 1 ? "indicador pior que a PB" : "indicadores piores que a PB"}
              </LinkMapa>
            ) : (
              `${n(f.indicadores)} ${f.indicadores === 1 ? "indicador pior que a PB" : "indicadores piores que a PB"}`
            ))}
          .
        </p>
      )}
    </>
  );
}

export function BlocoMunicipio({ r }: { r: Relatorio }) {
  const ind = r.indicadores;
  if (!ind || !ind.municipio.length) return null;
  // A4x (08/10/2026): `coletadoEm` é o fim da rodada (carimbo com hora); o dia é o de Brasília, e não o de UTC.
  return (
    <Secao id="rel-municipio" titulo="O município" nota={ind.coletadoEm ? `Fontes oficiais em lote, lidas em ${dataBrasilia(ind.coletadoEm)}; cada indicador traz o seu ano.` : undefined}>
      <OMunicipio l={ind} />
    </Secao>
  );
}

export function BlocoFiscal({ r, destino }: { r: Relatorio; destino: Destino }) {
  const f = r.fiscal;
  if (!f) return null;
  return (
    <Secao
      id="rel-fiscal"
      titulo="Capacidade fiscal"
      nota={
        <>
          As três <Termo slug="decisoes-fiscais">decisões do painel fiscal</Termo> da PONTE, com dados de {data(f.referencia)}.
        </>
      }
    >
      <TabelaRolagem rotulo="Capacidade fiscal">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Decisão</th>
              <th scope="col">Situação</th>
              <th scope="col">O que bloqueia</th>
            </tr>
          </thead>
          <tbody>
            {f.decisoes.map((d) => (
              <tr key={d.decisao}>
                <th scope="row" className="mp-th-celula">
                  {d.nome}
                </th>
                <td>{ROTULO_DECISAO[d.estado as keyof typeof ROTULO_DECISAO] ?? d.estado}</td>
                <td>{d.bloqueantes.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
      {f.serie.length > 1 && (
        <Sub titulo={`A despesa com pessoal desde ${f.serie[0].exercicio}`}>
          <GraficoPessoal serie={f.serie} />
          {f.acimaSeguidos > 0 && f.acimaDesde && (
            <p>
              Acima do limite máximo desde o {rotuloPeriodo(f.acimaDesde)}: {n(f.acimaSeguidos)} {f.serie.at(-1)?.periodicidade === "S" ? "semestres" : "quadrimestres"}{" "}
              seguidos.
            </p>
          )}
        </Sub>
      )}
      <Sub titulo="As verificações">
        <ul className="mp-rel-verificacoes">
          {f.verificacoes.map((v) => (
            <li key={v.codigo}>
              <span className="pa-mono">{ROTULO_ESTADO[v.estado] ?? v.estado}</span> <strong>{v.nome}.</strong> {v.resumo}
            </li>
          ))}
        </ul>
      </Sub>
      <ListaAchados achados={dimensao(r, "fiscal")} destino={destino} />
    </Secao>
  );
}

/**
 * `nivel` (onda 15, fase 2, lote B, 13/10/2026): só para o CSV filtrado de cada tabela, que é do cadastro (D1). O que
 * cada nível vê continua no dado (`relatorioDoNivel`): no nível 0, só a tabela por situação e a dos em execução.
 */
export function BlocoConvenios({ r, destino, nivel }: { r: Relatorio; destino: Destino; nivel: NivelAcesso }) {
  const c = r.convenios;
  if (!c) return null;
  const csv = (parte: string) => csvDoNivel(nivel, parte, r);
  return (
    <Secao id="rel-convenios" titulo="Convênios e contratos de repasse" nota={`${r.escopo === "entidade" ? "Desta entidade" : "Da prefeitura e dos fundos municipais"}, nos dados abertos do Transferegov de ${data(c.referencia)}.`}>
      <TabelaRolagem rotulo="Convênios e contratos de repasse">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Situação</th>
              <th scope="col">Instrumentos</th>
              <th scope="col">Valor global</th>
            </tr>
          </thead>
          <tbody>
            {c.porGrupo.map((g) => (
              <tr key={g.id}>
                <th scope="row" className="mp-th-celula">
                  {g.rotulo}
                </th>
                <td className="mp-rel-num">{n(g.n)}</td>
                <td className="mp-rel-num">{moedaCurta(g.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
      {c.emExecucao.length > 0 && (
        <Sub titulo={`Os ${n(c.emExecucao.length)} em execução`} id="rel-convenios-execucao">
          <TabelaConvenios
            recorte="execucao"
            rotulo={`Os ${n(c.emExecucao.length)} em execução`}
            linhas={c.emExecucao}
            destino={destino}
            csv={csv("convenios-em-execucao")}
          />
        </Sub>
      )}
      {c.vigenciaVencida.length > 0 && (
        <Sub titulo="Vigência vencida ainda em execução" id="rel-convenios-vencida">
          <TabelaConvenios
            recorte="vencida"
            rotulo="Vigência vencida ainda em execução"
            linhas={c.vigenciaVencida}
            destino={destino}
            csv={csv("convenios-vigencia-vencida")}
          />
        </Sub>
      )}
      {c.contasAtrasadas.length + c.contasNegativas.length > 0 && (
        <Sub titulo="Prestação de contas pendente" id="rel-convenios-contas">
          <TabelaConvenios
            recorte="contas"
            rotulo="Prestação de contas pendente"
            linhas={[...c.contasAtrasadas, ...c.contasNegativas]}
            destino={destino}
            csv={csv("convenios-contas-pendentes")}
          />
        </Sub>
      )}
      {c.liminar.length > 0 && (
        <Sub titulo="Assinados por liminar" id="rel-convenios-liminar">
          <TabelaConvenios recorte="liminar" rotulo="Assinados por liminar" linhas={c.liminar} destino={destino} csv={csv("convenios-liminar")} />
        </Sub>
      )}
      {c.nuncaAssinados.length + c.nuncaAssinadosVencidos > 0 && (
        <Sub titulo="Aprovados e nunca assinados" id="rel-convenios-nunca">
          <TabelaConvenios
            recorte="nunca"
            rotulo="Aprovados e nunca assinados"
            linhas={c.nuncaAssinados}
            destino={destino}
            csv={csv("convenios-nunca-assinados")}
          />
          {c.nuncaAssinadosVencidos > 0 && (
            <p className="pa-nota">
              {c.nuncaAssinados.length ? "Fora da lista, " : ""}
              {n(c.nuncaAssinadosVencidos)} {c.nuncaAssinadosVencidos === 1 ? "aprovado" : "aprovados"} com a vigência já vencida, sem assinatura: não há mais o que
              assinar neles.
            </p>
          )}
        </Sub>
      )}
      {c.pc33.length > 0 && (
        <Sub titulo="Pontos a conferir na norma de convênios (PC 33/2023 e anteriores)" id="rel-convenios-pc33">
          <TabelaConvenios
            recorte="pc33"
            rotulo="Pontos a conferir na norma de convênios (PC 33/2023 e anteriores)"
            linhas={c.pc33}
            destino={destino}
            csv={csv("convenios-pontos-pc33")}
          />
        </Sub>
      )}
      <ListaAchados achados={dimensao(r, "convenios")} destino={destino} />
    </Secao>
  );
}

export function BlocoControle({ r, destino }: { r: Relatorio; destino: Destino }) {
  const ct = r.controle;
  if (!ct) return null;
  const achados = dimensao(r, "controle");
  return (
    <Secao
      id="rel-controle"
      titulo="Controle e prestação de contas"
      nota={
        ct.referenciaTcu ? (
          <>
            <Termo slug="tomada-de-contas-especial">Tomadas de contas especiais</Termo> consultadas no sistema e-TCE do Tribunal de Contas da União (TCU) em{" "}
            {data(ct.referenciaTcu)}.
          </>
        ) : undefined
      }
    >
      {/*
        Onda 15, fase 2, lote B (13/10/2026): as tomadas de contas especiais filtram e ordenam por qualquer coluna (o
        bloco é do cadastro: o recorte do público tira o controle). Padrão: pelo número do convênio.
      */}
      {ct.tces.length > 0 && (
        <TabelaFiltravel
          id={TABELA_TCE}
          rotulo="Tomadas de contas especiais no TCU"
          colunas={COLUNAS_TCE}
          linhas={ct.tces.map(
            (t, k): LinhaTabela => ({
              chave: `${t.nr_convenio}-${t.numero_processo ?? ""}-${k}`,
              valores: valoresDaTce(t),
              celulas: {
                convenio: <LinkMapa href={destino(t.nr_convenio)}>{t.nr_convenio}</LinkMapa>,
                debito: t.debito_original !== null ? moedaCurta(t.debito_original) : "—",
                "com-juros": t.debito_com_juros !== null ? moedaCurta(t.debito_com_juros) : "—",
              },
            }),
          )}
          ordemPadrao={ORDEM_TCE}
          csv={{ nome: `tce-tcu-${trechoDoArquivo(r.nome)}` }}
          empilhar
        />
      )}
      <ListaAchados achados={achados} destino={destino} />
      {!ct.tces.length && !achados.length && <p>Nada a apontar nas fontes de controle lidas.</p>}
    </Secao>
  );
}

export function BlocoPropostas({ r, destino }: { r: Relatorio; destino: Destino }) {
  const p = r.propostas;
  if (!p) return null;
  return (
    <Secao id="rel-propostas" titulo={`Propostas enviadas desde ${p.desde}`}>
      <p>
        {n(p.enviadas)} propostas: {n(p.assinadas)} assinadas, {n(p.reprovadas)} reprovadas e {n(p.abertas)} sem desfecho.
      </p>
      <TabelaRolagem rotulo={`Propostas enviadas desde ${p.desde}`}>
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Desfecho</th>
              <th scope="col">Propostas</th>
              <th scope="col">Repasse pedido</th>
            </tr>
          </thead>
          <tbody>
            {p.porDesfecho.map((d) => (
              <tr key={d.desfecho}>
                <th scope="row" className="mp-th-celula">
                  {d.rotulo}
                </th>
                <td className="mp-rel-num">{n(d.n)}</td>
                <td className="mp-rel-num">{moedaCurta(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRolagem>
      <ListaAchados achados={dimensao(r, "propostas")} destino={destino} />
    </Secao>
  );
}

/**
 * "De onde vieram as emendas" (aberto ao público no município e na entidade). Onda 15, fase 2, lote B (13/10/2026):
 * saiu o corte nos 15 de maior valor e a ordem por valor (um ranking de parlamentares à vista do público). Agora vêm
 * todos, em ordem alfabética; o parlamentar e o tipo (antes entre parênteses, agora coluna) filtram e ordenam; os
 * convênios e o valor filtram, mas não ordenam. `nivel`: só para o CSV filtrado, que é do cadastro (D1).
 */
export function BlocoEmendas({ r, nivel }: { r: Relatorio; nivel: NivelAcesso }) {
  if (!r.emendas || !r.emendas.length) return null;
  const linhas: LinhaTabela[] = emendasNaOrdem(r.emendas).map((e) => ({
    chave: e.parlamentar,
    valores: valoresDaEmenda(e),
    celulas: { valor: moedaCurta(e.valor) },
  }));
  const nomeCsv = csvDoNivel(nivel, "emendas", r);
  return (
    <Secao
      id="rel-emendas"
      titulo="De onde vieram as emendas dos convênios"
      nota={`Parlamentares como agentes públicos; valor indicado nas emendas ligadas aos convênios ${r.escopo === "entidade" ? "da entidade" : "do município"}. Todos, em ordem alfabética: o valor filtra, mas não ordena, porque a lista não é ranking.`}
    >
      <TabelaFiltravel
        id={TABELA_EMENDAS}
        rotulo="De onde vieram as emendas dos convênios"
        colunas={COLUNAS_EMENDAS}
        linhas={linhas}
        ordemPadrao={ORDEM_EMENDAS}
        csv={nomeCsv ? { nome: nomeCsv } : undefined}
      />
    </Secao>
  );
}

export function BlocoPix({ r, destino }: { r: Relatorio; destino: Destino }) {
  const px = r.pix;
  if (!px) return null;
  return (
    <Secao id="rel-pix" titulo="Transferências especiais (Pix) e fundo a fundo">
      <p>
        {n(px.planos)} planos do Pix, com {moedaCurta(px.pago)} pagos.{" "}
        {px.fundo ? `${n(px.fundo.planos)} planos do fundo a fundo, com ${moedaCurta(px.fundo.repasse)} de repasse.` : ""}
      </p>
      {px.impedidos.length > 0 && <ResumoImpedidos imp={px.impedidos} />}
      <ListaAchados achados={dimensao(r, "pix")} destino={destino} />
    </Secao>
  );
}

/** Impedidos dos dois últimos exercícios numa linha: o valor bruto, o que voltou no mesmo ano e a perda líquida. */
function ResumoImpedidos({ imp }: { imp: ImpedidosDoAno[] }) {
  const anos = [...new Set(imp.map((i) => i.ano))].sort();
  const planos = imp.reduce((t, i) => t + i.planos, 0);
  const valor = imp.reduce((t, i) => t + i.valor, 0);
  const recuperado = imp.reduce((t, i) => t + i.valorRecuperado, 0);
  return (
    <p>
      Impedidos em {anos.join(" e ")}: {n(planos)} {planos === 1 ? "plano" : "planos"}, {moedaCurta(valor)}.{" "}
      {recuperado > 0 ? `${moedaCurta(recuperado)} voltaram no mesmo ano por reapresentação; ` : ""}perda líquida de {moedaCurta(valor - recuperado)}.
    </p>
  );
}

export function BlocoTcePb({ r }: { r: Relatorio }) {
  if (!r.tcePb) return null;
  return (
    <Secao id="rel-tce" titulo="O dinheiro federal nas despesas registradas no Tribunal de Contas do Estado (TCE-PB)" nota={`Anos ${r.tcePb.anos.join(", ")}.`}>
      <p>
        Do pago a empresas no SICONV ({moedaCurta(r.tcePb.siconv)}), {moedaCurta(r.tcePb.casado)} aparecem nas despesas do município no TCE-PB
        {r.tcePb.taxa !== null ? ` (${Math.round(r.tcePb.taxa * 100)}% do verificado)` : ""}. Pago com fonte federal sem par no SICONV:{" "}
        {moedaCurta(r.tcePb.soTce)} (a conferir).
      </p>
    </Secao>
  );
}

export function BlocoFornecedores({ r, destino }: { r: Relatorio; destino: Destino }) {
  if (!r.fornecedores) return null;
  const achados = dimensao(r, "fornecedores");
  return (
    <Secao id="rel-fornecedores" titulo="Fornecedores">
      <ListaAchados achados={achados} destino={destino} />
      {!achados.length && <p>Nenhum fornecedor na lista de inidôneos do TCU e nenhuma concentração a apontar.</p>}
    </Secao>
  );
}

export function BlocosIndicadoresMunicipio({ r, destino }: { r: Relatorio; destino: Destino }) {
  const ind = r.indicadores;
  if (!ind) return null;
  return (
    <>
      {ind.social.length > 0 && (
        <Secao
          id="rel-social"
          titulo="Social"
          nota={
            <>
              Saúde, educação, assistência social e segurança. PB e Brasil são os valores das fontes; a <Termo slug="mediana">mediana</Termo> PB é a dos 223
              municípios; porte e região comparam com os municípios do mesmo <Termo slug="tercil">porte</Termo> e da mesma região imediata. Na posição, 1º é
              o melhor. «Contexto» não tem nível.
            </>
          }
        >
          <BlocosIndicadores blocos={ind.social} secao="rel-social" />
          <ListaAchados achados={dimensao(r, "social")} destino={destino} />
        </Secao>
      )}
      {ind.economia && (
        <Secao id="rel-economia" titulo="Economia">
          <BlocosIndicadores blocos={[ind.economia]} secao="rel-economia" />
          <ListaAchados achados={dimensao(r, "economia")} destino={destino} />
        </Secao>
      )}
      {ind.territorio && (
        <Secao
          id="rel-territorio"
          titulo="Território"
          nota="Saneamento, água, desastres, conectividade, frota e cobertura da terra (MapBiomas). «Contexto» não tem nível."
        >
          {/* Onda 9, D (09/10/2026): a nota cita a cobertura da terra, que entrou na onda 8; a citação do MapBiomas fecha a tabela. */}
          <BlocosIndicadores blocos={[ind.territorio]} secao="rel-territorio" />
          <ListaAchados achados={dimensao(r, "territorio")} destino={destino} />
        </Secao>
      )}
      {ind.governanca && (
        <Secao id="rel-governanca" titulo="Governança" nota="Transparência e contratações. Contratação direta é ponto para olhar, não irregularidade.">
          <BlocosIndicadores blocos={[ind.governanca]} secao="rel-governanca" />
          <ListaAchados achados={dimensao(r, "governanca")} destino={destino} />
        </Secao>
      )}
    </>
  );
}

export function BlocoTramita() {
  return (
    <Secao id="rel-tramita" titulo="Processos e sanções no Tribunal de Contas do Estado (TCE-PB)">
      <p>
        Esta parte entra quando a leitura dos processos do <Termo slug="tce-pb">TCE-PB</Termo> (sistema TRAMITA) cobrir os 223 municípios. Até lá, não
        ver sanção aqui não quer dizer que não haja.
      </p>
    </Secao>
  );
}

export function BlocoJanelas({ r }: { r: Relatorio }) {
  if (!r.janelas) return null;
  return (
    <Secao id="rel-janelas" titulo="Janelas abertas hoje" nota="Programas abertos em que um município da PB pode entrar, pelo catálogo do Mapa.">
      <p>
        {n(r.janelas.elegiveis)} janelas abertas{r.janelas.urgentes.length ? `; ${n(r.janelas.urgentes.length)} fecham em breve:` : "."}
      </p>
      {r.janelas.urgentes.length > 0 && (
        <ul>
          {r.janelas.urgentes.map((j) => (
            <li key={j.titulo}>
              {j.titulo} · {j.orgao ?? "—"} · até {data(j.fim)}
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

export function BlocoFontes({ r }: { r: Relatorio }) {
  return (
    <Secao id="rel-fontes" titulo="Fontes, datas e limites">
      <ul>
        {/* A4x (08/10/2026): a data dos indicadores é carimbo com hora; pelo dia de Brasília, e não pelo de UTC. */}
        {r.fontes.map((x) => (
          <li key={x.fonte}>
            <strong>{x.fonte}</strong>
            {x.data ? ` (${dataBrasilia(x.data)})` : ""}: {x.nota}
          </li>
        ))}
      </ul>
      {r.faltas.length > 0 && <p className="pa-nota">Não lido nesta página (a leitura falhou ou a fonte ainda não está publicada): {r.faltas.join(", ")}.</p>}
      <p className="pa-nota">
        Regras do relatório na versão {r.versao}. O <Termo slug="nivel-do-ponto">nível crítico</Termo> fica só para bloqueio legal ou financeiro e para
        apontamento de órgão de controle. Relatório preparado por PONTE Estruturação de Projetos de Impacto.
      </p>
    </Secao>
  );
}

// ================================================================ o relatório inteiro, para imprimir

export function RelatorioConteudo({
  r,
  seguindo,
  nivel = 3,
  assembleia,
}: {
  r: Relatorio;
  seguindo?: boolean;
  nivel?: NivelAcesso;
  /** As emendas estaduais (E2, 16/10/2026): lidas só para o administrador; ausente para os outros. */
  assembleia?: LeituraAssembleia;
}) {
  const ind = r.indicadores;
  const destino = destinoConvenio(nivel);
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel">
      <div className="pa-pilha mp-radar-cabeca">
        {/* B11: o município volta à aba de onde o relatório se abre ("Relatório e dados"). */}
        <Trilha
          elos={trilha(
            { uf: "PB", regiaoImediata: ind?.grupo?.regiao_imediata, municipio: { ibge: r.ibge, nome: r.nome, aba: "relatorio" } },
            "Relatório completo",
          )}
        />
        <p className="pa-kicker">Relatório completo do município · PB · IBGE {r.ibge}</p>
        <h1 className="pa-titulo">{r.nome}</h1>
        <p className="pa-sub">
          Captação federal, contas, capacidade fiscal{ind ? ", social, economia, território e governança" : ""} · dados lidos em {data(r.hoje)}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          {seguindo !== undefined && <EstrelaSeguir tipo="municipio" chave={r.ibge} nome={`o município ${r.nome}`} seguindo={seguindo} />}
          <BotaoImprimir />
          <a href={`/mapa/municipio/${r.ibge}/relatorio/csv`} className="pa-btn pa-btn-pequeno">
            Baixar os pontos do relatório (CSV)
          </a>
          <LinkMapa href={`/mapa/municipio/${r.ibge}`} className="pa-btn pa-btn-pequeno">
            Abrir a página do município
          </LinkMapa>
          {PODE.interno(nivel) && (
            <>
              <LinkMapa href={urlMunicipioFiscal(r.ibge)} className="pa-btn pa-btn-pequeno">
                Abrir o painel fiscal
              </LinkMapa>
              <LinkMapa href={`/mapa/painel/municipio/${r.ibge}`} className="pa-btn pa-btn-pequeno">
                Abrir a ficha no painel
              </LinkMapa>
              <LinkMapa href={`/mapa/painel/tce/${r.ibge}`} className="pa-btn pa-btn-pequeno">
                Despesas no TCE-PB
              </LinkMapa>
            </>
          )}
          {PODE.laudo(nivel) && (
            <LinkMapa href={`/mapa/pix/ente/${r.ibge}`} className="pa-btn pa-btn-pequeno">
              Abrir o laudo do Pix
            </LinkMapa>
          )}
        </p>
        <p className="mp-fiscal-aviso">{PODE.interno(nivel) ? AVISO_INTERNO : AVISO}</p>
      </div>

      <Secao id="rel-pagina" titulo="Em uma página">
        <Cartoes r={r} />
        <ListaAchados achados={r.destaques} destino={destino} fila="com_classe" hoje={r.hoje} />
        <EmOrdem r={r} />
      </Secao>
      <BlocoPassos r={r} />
      <BlocoMunicipio r={r} />
      <BlocoFiscal r={r} destino={destino} />
      <BlocoConvenios r={r} destino={destino} nivel={nivel} />
      <BlocoControle r={r} destino={destino} />
      <BlocoPropostas r={r} destino={destino} />
      <BlocoEmendas r={r} nivel={nivel} />
      {PODE.interno(nivel) && assembleia !== undefined && <EmendasEstaduaisDoMunicipio leitura={assembleia} ibge={r.ibge} municipio={r.nome} />}
      <BlocoPix r={r} destino={destino} />
      <BlocoTcePb r={r} />
      <BlocoFornecedores r={r} destino={destino} />
      <BlocosIndicadoresMunicipio r={r} destino={destino} />
      <BlocoTramita />
      <BlocoJanelas r={r} />
      <BlocoFontes r={r} />
    </div>
  );
}
