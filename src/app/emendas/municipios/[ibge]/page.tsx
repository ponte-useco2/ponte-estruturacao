import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import malha from "@/lib/oportunidades/malhas/pb-municipios.json";
import { ibgeDaUrl, parametrosDoEndereco } from "@/lib/oportunidades/emendas-publico";
import { lerMunicipioV2, lerNomesDosMunicipios } from "@/lib/oportunidades/emendas-publico.server";
import {
  CANAL,
  NOME_DESTINATARIO,
  anoAtualBrasilia,
  blocosDoRecorte,
  caixaDoContorno,
  comp,
  coberturas,
  emendasDoPeriodo,
  fraseSemCatalogo,
  inteiroPt,
  lerPeriodo,
  mudar,
  periodoDoEndereco,
  plural,
  recorteVazio,
  temPeriodoDoFormulario,
  textoPeriodo,
  urlInicio,
  urlMunicipio,
  urlRegistros,
  type Recorte,
  type Soma,
} from "@/lib/oportunidades/emendas-recorte";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { BarraRecorte, SeletorPeriodo } from "../../_componentes/BarraRecorte";
import { Ajuda, BarraLink, BarraVazia, COR_DO_CANAL, Datas, EtiquetaCanal, Indisponivel, PADRAO_DO_CANAL, SemDado, Trilha } from "../../_componentes/Percurso";

type Props = { params: Promise<{ ibge: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ibge = ibgeDaUrl((await params).ibge);
  const nome = ibge ? (await lerNomesDosMunicipios()).find((m) => m.ibge === ibge)?.nome : null;
  return { title: nome ?? "Município" };
}

/**
 * O município (versão 2): a RESPOSTA primeiro — "Emendas de 2023 a 2026: R$ 44,13 mi pagos a destinatários em Patos
 * até 13/11/2026" (ajuste B), com previsto e empenhado e a cobertura de cada um (ajuste A) —, depois os blocos (quem
 * recebeu, por onde chegou, para quê, quando, autoria), todos do mesmo conjunto de registros. Cada valor abre a tela de
 * registros com o filtro correspondente, e o total de lá é o valor clicado.
 */
export default async function MunicipioPage({ params, searchParams }: Props) {
  const { ibge: bruto } = await params;
  const ibge = ibgeDaUrl(bruto);
  if (!ibge) notFound();
  const sp = parametrosDoEndereco(await searchParams);
  const anoMax = anoAtualBrasilia();
  const periodo = lerPeriodo(periodoDoEndereco(sp), anoMax);
  if (temPeriodoDoFormulario(sp)) redirect(urlMunicipio(ibge, periodo));
  const l = await lerMunicipioV2(ibge, periodo);
  if (l.estado === "nao_encontrado") notFound();
  if (l.estado === "sem_dado") return <SemDado />;
  if (l.estado !== "ok") return <Indisponivel endereco={urlMunicipio(ibge, periodo)} />;

  const nome = l.nome;
  const base: Recorte = recorteVazio(periodo, ibge);
  const reg = (m: Partial<Recorte>) => urlRegistros(mudar(base, m));
  const t = l.soma;
  const b = blocosDoRecorte(l.linhas, periodo, false);
  const cob = coberturas(t);
  const perTxt = emendasDoPeriodo(periodo).toLowerCase();
  const ate = dataBrasilia(l.execucao.dadoAte, "");
  const contorno = malha.areas.find((a) => a.id === ibge)?.d ?? null;
  const cx = contorno ? caixaDoContorno(contorno) : null;
  const pad = cx ? Math.max(Math.max(cx.x1 - cx.x0, cx.y1 - cx.y0) * 0.06, 2) : 0;
  const maior = (xs: Soma[], comPrev = false) => xs.reduce((m, x) => Math.max(m, x.realizado, comPrev ? x.previsto : 0), 0);
  const nTxt = (s: Soma) => plural(s.registros, "registro", "registros");
  const aria = (rot: string, s: Soma) => `${rot}: ${comp(s.realizado)} realizados em ${nTxt(s)}. Abrir esses registros.`;
  const mG = maior(b.destinatarios.map((x) => x.soma));
  const mC = maior(b.canais.map((x) => x.soma), true);
  const mF = maior(b.funcoes.map((x) => x.soma));
  const mA = maior(b.anos.map((x) => x.soma));
  const mAu = maior(b.autorias.map((x) => x.soma));
  const individuais = b.autorias.filter((a) => !a.coletiva);
  const coletivas = b.autorias.filter((a) => a.coletiva);
  const semCatalogo = fraseSemCatalogo(b.semCatalogo);

  return (
    <>
      <Trilha elos={[{ nome: "Início", href: urlInicio(periodo, ibge) }, { nome }]} />
      <BarraRecorte municipio={{ ibge, nome }} trocarHref={urlInicio(periodo)}>
        <SeletorPeriodo periodo={periodo} anoMax={anoMax} urlDoPeriodo={(p) => urlMunicipio(ibge, p)} acao={`/emendas/municipios/${ibge}`} ocultos={[]} />
      </BarraRecorte>

      <section aria-labelledby="titulo-tela" className="envolve pilha" style={{ paddingTop: 16, paddingBottom: 32, gap: 28 }}>
        <div className="colunas col-8-4" style={{ alignItems: "end", borderBottom: "2px solid var(--linha)", paddingBottom: 24 }}>
          <div className="pilha" style={{ gap: 12 }}>
            <p className="t14 rotulo tinta-2">
              Município da Paraíba · IBGE{" "}
              <span className="mono" style={{ letterSpacing: 0 }}>
                {ibge}
              </span>
            </p>
            <h1 id="titulo-tela" className="disp titulo-abertura cinetico">
              <span>{nome}</span>
            </h1>
          </div>
          {contorno && cx ? (
            <svg
              className="so-largo"
              viewBox={`${(cx.x0 - pad).toFixed(1)} ${(cx.y0 - pad).toFixed(1)} ${(cx.x1 - cx.x0 + 2 * pad).toFixed(1)} ${(cx.y1 - cx.y0 + 2 * pad).toFixed(1)}`}
              role="img"
              aria-label={`Contorno do município de ${nome} (malha municipal do IBGE)`}
              style={{ width: "100%", maxHeight: 220, overflow: "visible" }}
            >
              <path d={contorno} style={{ fill: "var(--sol)", stroke: "var(--linha)", strokeWidth: (Math.max(cx.x1 - cx.x0, cx.y1 - cx.y0) / 160).toFixed(2), strokeLinejoin: "round" }} />
            </svg>
          ) : null}
        </div>

        {t.registros === 0 ? (
          <div className="painel pilha" role="status" style={{ padding: 24, gap: 12 }}>
            <p className="disp t28" style={{ fontWeight: 720 }}>
              {emendasDoPeriodo(periodo)}: nenhum registro de emenda federal com destino a {nome}.
            </p>
            <div>
              <Link prefetch={false} className="btn t14" href={urlMunicipio(ibge, { de: 2019, ate: anoMax })}>
                Ver toda a série (2019–{anoMax})
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="painel sombra resposta">
              <div className="disp frase-resposta">
                <span className="t28">{emendasDoPeriodo(periodo)}:</span> <span className="num valor-heroi">{comp(t.realizado)}</span>{" "}
                <span className="t28">
                  pagos a destinatários em {nome}
                  {ate ? ` até ${ate}` : ""}.
                </span>{" "}
                <Ajuda chave="realizado" territorio={nome} periodo={`${perTxt}; valores até ${ate}`} />
              </div>
              <dl className="medidas-resposta num">
                <div>
                  <dt className="t14">
                    Previsto <Ajuda chave="previsto" territorio={nome} periodo={perTxt} pequena />
                  </dt>
                  <dd className="t22" style={{ fontWeight: 700 }}>
                    {cob.previsto.valor}
                    {cob.previsto.cobertura ? <span className="sub t14">{cob.previsto.cobertura}</span> : null}
                    {cob.previsto.porque ? <span className="sub t12">{cob.previsto.porque}</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="t14">
                    Empenhado <Ajuda chave="empenhado" territorio={nome} periodo={perTxt} pequena />
                  </dt>
                  <dd className="t22" style={{ fontWeight: 700 }}>
                    {cob.empenhado.valor}
                    {cob.empenhado.cobertura ? <span className="sub t14">{cob.empenhado.cobertura}</span> : null}
                    {cob.empenhado.porque ? <span className="sub t12">{cob.empenhado.porque}</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="t14">
                    Registros <Ajuda chave="registros" territorio={nome} periodo={perTxt} pequena />
                  </dt>
                  <dd className="t22" style={{ fontWeight: 700 }}>
                    {inteiroPt(t.registros)}
                    <span className="sub t14">{plural(t.emendas, "emenda", "emendas")}</span>
                  </dd>
                </div>
              </dl>
              <div>
                <Link prefetch={false} className="btn btn-pri t16" href={urlRegistros(base)}>
                  Abrir os {inteiroPt(t.registros)} registros
                </Link>
              </div>
            </div>

            <div className="colunas col-2" style={{ alignItems: "start" }}>
              <section className="painel bloco" aria-labelledby="b-quem">
                <h2 id="b-quem" className="disp t28">
                  Quem recebeu
                </h2>
                <ul className="lista-barras">
                  {b.destinatarios.map((g) => (
                    <li key={g.id}>
                      {g.soma.registros ? (
                        <BarraLink
                          href={reg({ destinatario: [g.id] })}
                          nome={NOME_DESTINATARIO[g.id]}
                          sub={`${g.entes.slice(0, 2).join(", ")}${g.entes.length > 2 ? " e outros" : ""}`}
                          valor={comp(g.soma.realizado)}
                          nTxt={nTxt(g.soma)}
                          fracao={mG ? g.soma.realizado / mG : 0}
                          zero={g.soma.realizado === 0}
                          aria={aria(NOME_DESTINATARIO[g.id], g.soma)}
                        />
                      ) : (
                        <BarraVazia nome={NOME_DESTINATARIO[g.id]} />
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="painel bloco" aria-labelledby="b-canal">
                <h2 id="b-canal" className="disp t28">
                  Por onde chegou
                </h2>
                <ul className="lista-barras">
                  {b.canais.map((c) => {
                    const s = c.soma;
                    const nomeC = CANAL[c.id].nome;
                    const prevTxt = s.comPrevisto === 0 ? "previsto não informado pela fonte" : `de ${comp(s.previsto)} previstos${s.comPrevisto < s.registros ? ` em ${s.comPrevisto} dos ${s.registros}` : ""}`;
                    return (
                      <li key={c.id}>
                        {s.registros ? (
                          <BarraLink
                            href={reg({ canal: [c.id] })}
                            nome={nomeC}
                            nomeNode={<EtiquetaCanal canal={c.id}>{nomeC}</EtiquetaCanal>}
                            sub={prevTxt}
                            valor={comp(s.realizado)}
                            nTxt={nTxt(s)}
                            fracao={mC ? s.realizado / mC : 0}
                            zero={s.realizado === 0}
                            cor={COR_DO_CANAL[c.id]}
                            padrao={PADRAO_DO_CANAL[c.id]}
                            aria={`Por onde chegou: ${aria(nomeC, s)}`}
                            extraTrilho={
                              s.comPrevisto > 0 ? (
                                <span className="prev-tracejado" style={{ width: `${((s.previsto / mC) * 100).toFixed(2)}%`, borderColor: COR_DO_CANAL[c.id] }} />
                              ) : null
                            }
                          />
                        ) : (
                          <BarraVazia nome={nomeC} nomeNode={<EtiquetaCanal canal={c.id}>{nomeC}</EtiquetaCanal>} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="painel bloco" aria-labelledby="b-para">
                <h2 id="b-para" className="disp t28">
                  Para quê <span className="t14 tinta-2">função de governo</span>
                </h2>
                <ul className="lista-barras">
                  {b.funcoes.map((f) => (
                    <li key={f.slug}>
                      <BarraLink
                        href={reg({ funcao: [f.slug] })}
                        nome={f.nome}
                        valor={comp(f.soma.realizado)}
                        nTxt={nTxt(f.soma)}
                        fracao={mF ? f.soma.realizado / mF : 0}
                        zero={f.soma.realizado === 0}
                        aria={aria(f.nome, f.soma)}
                      />
                    </li>
                  ))}
                </ul>
                {semCatalogo ? <p className="t12 nota">{semCatalogo}</p> : null}
              </section>

              <section className="painel bloco" aria-labelledby="b-quando">
                <h2 id="b-quando" className="disp t28">
                  Quando <span className="t14 tinta-2">ano da emenda</span>
                </h2>
                <ul className="lista-barras">
                  {b.anos.map((y) => (
                    <li key={y.ano}>
                      {y.soma.registros ? (
                        <BarraLink
                          href={reg({ ano: [y.ano] })}
                          nome={String(y.ano)}
                          valor={comp(y.soma.realizado)}
                          nTxt={nTxt(y.soma)}
                          fracao={mA ? y.soma.realizado / mA : 0}
                          zero={y.soma.realizado === 0}
                          aria={aria(`Emendas de ${y.ano}`, y.soma)}
                        />
                      ) : (
                        <BarraVazia nome={String(y.ano)} />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="painel bloco" aria-labelledby="b-autoria" style={{ gap: 12 }}>
              <h2 id="b-autoria" className="disp t28">
                Autoria <span className="t14 tinta-2">em ordem alfabética</span>
              </h2>
              <div className="colunas col-2">
                <div className="pilha" style={{ gap: 8 }}>
                  <h3 className="t18" style={{ fontWeight: 700 }}>
                    Individual <span className="t14 tinta-2" style={{ fontWeight: 400 }}>deputados e senadores</span>
                  </h3>
                  {individuais.length ? (
                    <ul className="lista-barras">
                      {individuais.map((a) => (
                        <li key={a.codigo}>
                          <BarraLink
                            href={reg({ autoria: [a.codigo] })}
                            nome={a.nome}
                            valor={comp(a.soma.realizado)}
                            nTxt={nTxt(a.soma)}
                            fracao={mAu ? a.soma.realizado / mAu : 0}
                            zero={a.soma.realizado === 0}
                            aria={aria(a.nome, a.soma)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="t14 tinta-2">nenhum registro</p>
                  )}
                </div>
                <div className="pilha" style={{ gap: 8 }}>
                  <h3 className="t18" style={{ fontWeight: 700 }}>
                    Coletiva <span className="t14 tinta-2" style={{ fontWeight: 400 }}>bancada, comissões e relator</span>
                  </h3>
                  {coletivas.length ? (
                    <ul className="lista-barras">
                      {coletivas.map((a) => (
                        <li key={a.codigo}>
                          <BarraLink
                            href={reg({ autoria: [a.codigo] })}
                            nome={a.nome}
                            sub={<span className="selo-col">Autoria coletiva</span>}
                            valor={comp(a.soma.realizado)}
                            nTxt={nTxt(a.soma)}
                            fracao={mAu ? a.soma.realizado / mAu : 0}
                            zero={a.soma.realizado === 0}
                            aria={aria(a.nome, a.soma)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="t14 tinta-2">nenhum registro</p>
                  )}
                </div>
              </div>
            </section>
            <p className="t14 nota">
              Período: {textoPeriodo(periodo)}, pelo ano da emenda; o realizado é acumulado até {ate || "a data de referência"}.
            </p>
          </>
        )}
      </section>
      <Datas execucao={l.execucao} />
    </>
  );
}
