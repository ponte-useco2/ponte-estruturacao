/**
 * O relatório crítico do município (onda 14, camadas 1 e 2): o diagnóstico de Patos de 30/09/2026 para qualquer
 * município da PB, com os indicadores de social, economia, território e governança. Recebe a leitura pronta
 * (lib/oportunidades/relatorio-municipio.ts); aqui só se apresenta.
 *
 * Desde a F1 (06/10/2026) cada seção é um bloco exportado: o relatório para imprimir junta todos, e a página do
 * município em abas (`/mapa/municipio/[ibge]`) usa os mesmos blocos em cada aba. `destino` diz para onde vai o
 * número de cada convênio: o laudo, para quem pode; a página do instrumento, para os outros. Quem não é
 * administrador recebe o relatório já sem nomes de fornecedor (`relatorioSemNomes`).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { formatarData } from "@/lib/oportunidades/central";
import { rotuloRegic, type BlocoIndicadores, type IndicadorLido, type LeituraIndicadores } from "@/lib/oportunidades/indicadores-municipio";
import { urlMunicipioFiscal } from "@/lib/oportunidades/fiscal";
import { PODE, destinoConvenio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { moedaCurta } from "@/lib/oportunidades/radar";
import {
  ROTULO_DIMENSAO,
  ROTULO_NIVEL_ACHADO,
  rotuloPeriodo,
  type Achado,
  type LinhaConvenio,
  type NivelAchado,
  type Relatorio,
} from "@/lib/oportunidades/relatorio-municipio";
import { EstrelaSeguir } from "../../../_componentes/EstrelaSeguir";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";
import { GraficoPessoal } from "./GraficoPessoal";

const AVISO_INTERNO =
  "Uso interno da PONTE. Leitura automática de fontes públicas, cada uma com a sua data (ver o fim). «A conferir» é ponto para olhar, " +
  "nunca irregularidade; não substitui certidão, parecer do concedente, decisão do Tribunal de Contas nem orientação jurídica.";
const AVISO =
  "Leitura automática de fontes públicas pela PONTE, cada uma com a sua data (ver o fim). «A conferir» é ponto para olhar, nunca " +
  "irregularidade; não substitui certidão, parecer do concedente, decisão do Tribunal de Contas nem orientação jurídica.";

/** Para onde vai o número de um convênio. */
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

export function ListaAchados({ achados, destino }: { achados: Achado[]; destino: Destino }) {
  if (!achados.length) return null;
  return (
    <ul className="mp-laudo-lista">
      {achados.map((a) => (
        <li key={`${a.dimensao}-${a.titulo}`} className={`pa-cartao mp-laudo-risco mp-laudo-${classe(a.nivel)}`}>
          <p>
            <Selo nivel={a.nivel} /> <strong>{a.titulo}</strong> <span className="pa-mono mp-rel-dimensao">{ROTULO_DIMENSAO[a.dimensao]}</span>
          </p>
          <p>{a.fato}</p>
          {a.numeros && a.numeros.length > 0 && a.numeros.length <= 12 && (
            <p className="pa-nota mp-nao-imprimir">
              Convênios:{" "}
              {a.numeros.map((nr, k) => (
                <span key={nr}>
                  {k > 0 && " · "}
                  <Link href={destino(nr)}>{nr}</Link>
                </span>
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function TabelaConvenios({ linhas, destino, nota = "Situação" }: { linhas: LinhaConvenio[]; destino: Destino; nota?: string }) {
  if (!linhas.length) return null;
  return (
    <div className="mp-tabela-rolagem">
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">Convênio</th>
            <th scope="col">Órgão</th>
            <th scope="col">Objeto</th>
            <th scope="col">Valor</th>
            <th scope="col">Desembolsado</th>
            <th scope="col">{nota}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nr_convenio}>
              <td>
                <Link href={destino(l.nr_convenio)}>{l.nr_convenio}</Link>
              </td>
              <td>{l.orgao ? tituloOrgao(l.orgao) : "—"}</td>
              <td>{l.objeto ?? "—"}</td>
              <td className="mp-rel-num">{moedaCurta(l.valor ?? 0)}</td>
              <td className="mp-rel-num">{l.desembolsado ? moedaCurta(l.desembolsado) : "—"}</td>
              <td>{l.nota}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROTULO_NIVEL_INDICADOR = { alto: "alto", moderado: "moderado", em_dia: "em dia" } as const;

function TabelaIndicadores({ itens }: { itens: IndicadorLido[] }) {
  if (!itens.length) return null;
  return (
    <div className="mp-tabela-rolagem">
      <table className="mp-tabela mp-rel-indicadores">
        <thead>
          <tr>
            <th scope="col">Indicador</th>
            <th scope="col">Valor</th>
            <th scope="col">PB</th>
            <th scope="col">Brasil</th>
            <th scope="col">Mediana PB</th>
            <th scope="col">Mediana porte · região</th>
            <th scope="col">Posição PB</th>
            <th scope="col">Nível</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((x) => (
            <tr key={x.id}>
              <td>
                {x.nome}
                <span className="mp-rel-fonte">
                  {" "}
                  {x.url ? (
                    <a href={x.url} rel="noreferrer" target="_blank">
                      {x.fonte}
                    </a>
                  ) : (
                    x.fonte
                  )}
                  , {x.ano}.{x.nota ? ` ${x.nota}` : ""}
                </span>
              </td>
              <td className="mp-rel-num">{x.texto}</td>
              <td className="mp-rel-num">{x.pb ?? "—"}</td>
              <td className="mp-rel-num">{x.br ?? "—"}</td>
              <td className="mp-rel-num">{x.mediana ?? "—"}</td>
              <td className="mp-rel-num">{x.porte || x.regiao ? `${x.porte ?? "—"} · ${x.regiao ?? "—"}` : "—"}</td>
              <td className="mp-rel-num">{x.posicao ?? "—"}</td>
              <td>
                {x.nivel ? (
                  <span className={`pa-tag mp-laudo-nivel mp-laudo-${x.nivel === "em_dia" ? "atendido" : x.nivel}`} title={x.porque ?? undefined}>
                    {ROTULO_NIVEL_INDICADOR[x.nivel]}
                  </span>
                ) : (
                  <span className="mp-rel-contexto">{x.chave ? "? não verificado" : "contexto"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlocosIndicadores({ blocos }: { blocos: (BlocoIndicadores | null)[] }) {
  const validos = blocos.filter((b): b is BlocoIndicadores => b !== null);
  // Seção de um bloco só (economia, território, governança): o título da seção já diz o que é.
  if (validos.length === 1) return <TabelaIndicadores itens={validos[0].itens} />;
  return (
    <>
      {validos.map((b) => (
        <Sub key={b.dimensao} titulo={b.titulo}>
          <TabelaIndicadores itens={b.itens} />
        </Sub>
      ))}
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
          Comparado com os municípios de porte <strong>{g.porte ?? "—"}</strong> (tercil da população da PB) e com os da região imediata de{" "}
          <strong>{g.regiao_imediata ?? "—"}</strong>
          {g.regiao_intermediaria ? ` (região intermediária de ${g.regiao_intermediaria})` : ""}.{regic ? ` Na hierarquia urbana do IBGE (REGIC 2018): ${regic}.` : ""}
        </p>
      )}
    </>
  );
}

function Sub({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mp-rel-sub">
      <h3 className="mp-rel-h3">{titulo}</h3>
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
          <h3 className="pa-mono">{k.rotulo}</h3>
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
    <Secao id="rel-passos" titulo="O que fazer primeiro" nota="Do que destrava mais para o que destrava menos. Só o que depende do município.">
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

export function BlocoMunicipio({ r }: { r: Relatorio }) {
  const ind = r.indicadores;
  if (!ind || !ind.municipio.length) return null;
  return (
    <Secao id="rel-municipio" titulo="O município" nota={ind.coletadoEm ? `Fontes oficiais em lote, lidas em ${data(ind.coletadoEm)}; cada indicador traz o seu ano.` : undefined}>
      <OMunicipio l={ind} />
    </Secao>
  );
}

export function BlocoFiscal({ r, destino }: { r: Relatorio; destino: Destino }) {
  const f = r.fiscal;
  if (!f) return null;
  return (
    <Secao id="rel-fiscal" titulo="Capacidade fiscal" nota={`Painel fiscal da PONTE, execução de ${data(f.referencia)}.`}>
      <div className="mp-tabela-rolagem">
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
                <td>
                  {d.decisao} · {d.nome}
                </td>
                <td>{ROTULO_ESTADO[d.estado] ?? d.estado}</td>
                <td>{d.bloqueantes.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

export function BlocoConvenios({ r, destino }: { r: Relatorio; destino: Destino }) {
  const c = r.convenios;
  if (!c) return null;
  return (
    <Secao id="rel-convenios" titulo="Convênios e contratos de repasse" nota={`Da prefeitura e dos fundos municipais, no arquivo aberto do SICONV de ${data(c.referencia)}.`}>
      <div className="mp-tabela-rolagem">
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
                <td>{g.rotulo}</td>
                <td className="mp-rel-num">{n(g.n)}</td>
                <td className="mp-rel-num">{moedaCurta(g.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {c.emExecucao.length > 0 && (
        <Sub titulo={`Os ${n(c.emExecucao.length)} em execução`}>
          <TabelaConvenios linhas={c.emExecucao} destino={destino} nota="Vigência e físico" />
        </Sub>
      )}
      {c.vigenciaVencida.length > 0 && (
        <Sub titulo="Vigência vencida ainda em execução">
          <TabelaConvenios linhas={c.vigenciaVencida} destino={destino} />
        </Sub>
      )}
      {c.contasAtrasadas.length + c.contasNegativas.length > 0 && (
        <Sub titulo="Prestação de contas pendente">
          <TabelaConvenios linhas={[...c.contasAtrasadas, ...c.contasNegativas]} destino={destino} />
        </Sub>
      )}
      {c.liminar.length > 0 && (
        <Sub titulo="Assinados por liminar">
          <TabelaConvenios linhas={c.liminar} destino={destino} />
        </Sub>
      )}
      {c.nuncaAssinados.length + c.nuncaAssinadosVencidos > 0 && (
        <Sub titulo="Aprovados e nunca assinados">
          <TabelaConvenios linhas={c.nuncaAssinados} destino={destino} nota="Vigência" />
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
        <Sub titulo="Pontos a conferir na norma de convênios (PC 33/2023 e anteriores)">
          <TabelaConvenios linhas={c.pc33} destino={destino} nota="Pontos" />
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
    <Secao id="rel-controle" titulo="Controle e prestação de contas" nota={ct.referenciaTcu ? `e-TCE do TCU consultado em ${data(ct.referenciaTcu)}.` : undefined}>
      {ct.tces.length > 0 && (
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Convênio</th>
                <th scope="col">Processo no TCU</th>
                <th scope="col">Situação</th>
                <th scope="col">Débito original</th>
                <th scope="col">Com juros</th>
              </tr>
            </thead>
            <tbody>
              {ct.tces.map((t) => (
                <tr key={`${t.nr_convenio}-${t.numero_processo}`}>
                  <td>
                    <Link href={destino(t.nr_convenio)}>{t.nr_convenio}</Link>
                  </td>
                  <td>{t.numero_processo ?? "—"}</td>
                  <td>{t.situacao ?? "—"}</td>
                  <td className="mp-rel-num">{t.debito_original !== null ? moedaCurta(t.debito_original) : "—"}</td>
                  <td className="mp-rel-num">{t.debito_com_juros !== null ? moedaCurta(t.debito_com_juros) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <div className="mp-tabela-rolagem">
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
                <td>{d.rotulo}</td>
                <td className="mp-rel-num">{n(d.n)}</td>
                <td className="mp-rel-num">{moedaCurta(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListaAchados achados={dimensao(r, "propostas")} destino={destino} />
    </Secao>
  );
}

export function BlocoEmendas({ r }: { r: Relatorio }) {
  if (!r.emendas || !r.emendas.length) return null;
  return (
    <Secao id="rel-emendas" titulo="De onde vieram as emendas dos convênios" nota="Parlamentares como agentes públicos; valor indicado nas emendas ligadas aos convênios do município.">
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Parlamentar</th>
              <th scope="col">Convênios</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {r.emendas.slice(0, 15).map((e) => (
              <tr key={e.parlamentar}>
                <td>
                  {e.parlamentar}
                  {e.tipo ? ` (${e.tipo})` : ""}
                </td>
                <td className="mp-rel-num">{n(e.convenios)}</td>
                <td className="mp-rel-num">{moedaCurta(e.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <ListaAchados achados={dimensao(r, "pix")} destino={destino} />
    </Secao>
  );
}

export function BlocoTcePb({ r }: { r: Relatorio }) {
  if (!r.tcePb) return null;
  return (
    <Secao id="rel-tce" titulo="O dinheiro federal nas despesas do TCE-PB" nota={`Anos ${r.tcePb.anos.join(", ")}.`}>
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
      {!achados.length && <p>Sem fornecedor inidôneo no TCU e sem concentração a apontar.</p>}
    </Secao>
  );
}

export function BlocosIndicadoresMunicipio({ r, destino }: { r: Relatorio; destino: Destino }) {
  const ind = r.indicadores;
  if (!ind) return null;
  return (
    <>
      {ind.social.length > 0 && (
        <Secao id="rel-social" titulo="Social" nota="Saúde, educação, assistência social e segurança. PB e Brasil são os valores das fontes; «mediana PB» é a dos 223 municípios; porte e região comparam com os parecidos. Na posição, 1º é o melhor. «Contexto» não tem nível.">
          <BlocosIndicadores blocos={ind.social} />
          <ListaAchados achados={dimensao(r, "social")} destino={destino} />
        </Secao>
      )}
      {ind.economia && (
        <Secao id="rel-economia" titulo="Economia">
          <BlocosIndicadores blocos={[ind.economia]} />
          <ListaAchados achados={dimensao(r, "economia")} destino={destino} />
        </Secao>
      )}
      {ind.territorio && (
        <Secao id="rel-territorio" titulo="Território" nota="Saneamento, água, desastres, conectividade e frota.">
          <BlocosIndicadores blocos={[ind.territorio]} />
          <ListaAchados achados={dimensao(r, "territorio")} destino={destino} />
        </Secao>
      )}
      {ind.governanca && (
        <Secao id="rel-governanca" titulo="Governança" nota="Transparência e contratações. Contratação direta é ponto para olhar, não irregularidade.">
          <BlocosIndicadores blocos={[ind.governanca]} />
          <ListaAchados achados={dimensao(r, "governanca")} destino={destino} />
        </Secao>
      )}
    </>
  );
}

export function BlocoTramita() {
  return (
    <Secao id="rel-tramita" titulo="Processos e sanções no TCE-PB">
      <p>
        Entram quando a coleta do TRAMITA cobrir os 223 municípios (os processos de contas detalhados ainda não cobrem todos). Até lá, nenhuma
        ausência de sanção aqui é afirmação.
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
        {r.fontes.map((x) => (
          <li key={x.fonte}>
            <strong>{x.fonte}</strong>
            {x.data ? ` (${data(x.data)})` : ""}: {x.nota}
          </li>
        ))}
      </ul>
      {r.faltas.length > 0 && <p className="pa-nota">Não lido nesta página (a leitura falhou ou a fonte ainda não está publicada): {r.faltas.join(", ")}.</p>}
      <p className="pa-nota">
        Regras do relatório na versão {r.versao}. Crítico só para bloqueio legal ou financeiro e para apontamento de órgão de controle. Relatório
        preparado por PONTE Estruturação de Projetos de Impacto.
      </p>
    </Secao>
  );
}

// ================================================================ o relatório inteiro, para imprimir

export function RelatorioConteudo({ r, seguindo, nivel = 3 }: { r: Relatorio; seguindo?: boolean; nivel?: NivelAcesso }) {
  const ind = r.indicadores;
  const destino = destinoConvenio(nivel);
  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Município em análise · relatório crítico · PB · IBGE {r.ibge}</p>
        <h1 className="pa-titulo">{r.nome}</h1>
        <p className="pa-sub">
          Captação federal, contas, capacidade fiscal{ind ? ", social, economia, território e governança" : ""} · posição de {data(r.hoje)}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          {seguindo !== undefined && <EstrelaSeguir tipo="municipio" chave={r.ibge} nome={`o município ${r.nome}`} seguindo={seguindo} />}
          <BotaoImprimir />
          <a href={`/mapa/municipio/${r.ibge}/relatorio/csv`} className="pa-btn pa-btn-pequeno">
            Achados em CSV
          </a>
          <Link href={`/mapa/municipio/${r.ibge}`} className="pa-btn pa-btn-pequeno">
            Página do município
          </Link>
          {PODE.interno(nivel) && (
            <>
              <Link href={urlMunicipioFiscal(r.ibge)} className="pa-btn pa-btn-pequeno">
                Painel fiscal
              </Link>
              <Link href={`/mapa/painel/municipio/${r.ibge}`} className="pa-btn pa-btn-pequeno">
                Ficha no painel
              </Link>
              <Link href={`/mapa/painel/tce/${r.ibge}`} className="pa-btn pa-btn-pequeno">
                TCE-PB
              </Link>
            </>
          )}
          {PODE.laudo(nivel) && (
            <Link href={`/mapa/pix/ente/${r.ibge}`} className="pa-btn pa-btn-pequeno">
              Laudo do Pix
            </Link>
          )}
        </p>
        <p className="mp-fiscal-aviso">{PODE.interno(nivel) ? AVISO_INTERNO : AVISO}</p>
      </div>

      <Secao id="rel-pagina" titulo="Em uma página">
        <Cartoes r={r} />
        <ListaAchados achados={r.destaques} destino={destino} />
        <EmOrdem r={r} />
      </Secao>
      <BlocoPassos r={r} />
      <BlocoMunicipio r={r} />
      <BlocoFiscal r={r} destino={destino} />
      <BlocoConvenios r={r} destino={destino} />
      <BlocoControle r={r} destino={destino} />
      <BlocoPropostas r={r} destino={destino} />
      <BlocoEmendas r={r} />
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
