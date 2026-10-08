/**
 * Contas e obras dos convênios da PB: as Tomadas de Contas Especiais no e-TCE do TCU (onda 13C.1), as
 * impugnações na prestação de contas (13C.2) e as obras paradas no acompanhamento (13C.3). Cada parte vem
 * de uma leitura própria e some sozinha quando falta. Recebe as leituras prontas; aqui só se apresenta.
 */
import { urlInstrumento } from "@/lib/oportunidades/busca";
import { formatarData } from "@/lib/oportunidades/central";
import { moedaContas, obrasParadas, DIAS_SEM_MEDICAO_MODERADO } from "@/lib/oportunidades/contas-obras";
import type { PainelContasObras } from "@/lib/oportunidades/contas-obras.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { moedaExata, porMunicipio } from "@/lib/oportunidades/tce-tcu";
import type { LeituraContas } from "@/lib/oportunidades/tce-tcu.server";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

type LeituraOk = Extract<LeituraContas, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

export function ContasConteudo({ leitura, coletas }: { leitura: LeituraOk | null; coletas: PainelContasObras | null }) {
  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · contas e obras</p>
        <h1 className="pa-titulo">Contas e obras dos convênios da PB</h1>
        <p className="pa-sub">
          O que os dados abertos não mostram: as Tomadas de Contas Especiais no e-TCE do Tribunal de Contas da União, o valor impugnado na
          prestação de contas e as obras paradas no acompanhamento do Transferegov.
        </p>
        <p className="mp-fiscal-aviso">
          Uso interno da PONTE. TCE instaurada é o órgão apurando dano ao erário; quem julga é o TCU, e &quot;processo autuado&quot; não é
          condenação. Impugnação é o concedente recusando parte da comprovação. Nenhum nome de responsável aparece aqui.
        </p>
      </div>

      {leitura ? <SecaoTce leitura={leitura} /> : <p className="pa-cartao pa-cartao-plano">O e-TCE do TCU ainda não foi consultado.</p>}
      {coletas?.impugnacoes && <SecaoImpugnacoes linhas={coletas.impugnacoes} referencia={coletas.referenciaPrestacao} />}
      {coletas?.obras && <SecaoObras linhas={coletas.obras} referencia={coletas.referenciaObras} />}
    </div>
  );
}

function SecaoTce({ leitura }: { leitura: LeituraOk }) {
  const { linhas, execucao } = leitura;
  const c = execucao.contagens ?? {};
  const municipios = porMunicipio(linhas);
  const convenios = new Set(linhas.map((l) => l.nr_convenio)).size;
  const original = linhas.reduce((s, l) => s + (l.debito_original ?? 0), 0);
  const comJuros = linhas.reduce((s, l) => s + (l.debito_com_juros ?? 0), 0);
  const semOriginal = linhas.filter((l) => l.debito_original === null).length;
  const ordenadas = [...linhas].sort((a, b) => (b.dt_instauracao ?? "").localeCompare(a.dt_instauracao ?? "") || a.nr_convenio.localeCompare(b.nr_convenio));

  return (
    <>
      <section aria-labelledby="contas-tce" className="mp-radar-secao">
        <h2 id="contas-tce" className="mp-radar-h2">
          Tomadas de Contas Especiais no TCU
        </h2>
        <p className="pa-nota">
          Consulta de {execucao.referencia ? formatarData(execucao.referencia) : "—"}: {n(num(c.tcu_consultados))} convênios consultados
          {num(c.tcu_erros) > 0 ? `, ${n(num(c.tcu_erros))} sem resposta` : ""}
          {num(c.tcu_nao_consultados) > 0 ? `, ${n(num(c.tcu_nao_consultados))} para a próxima rodada` : ""}. A aba &quot;TCE&quot; do convênio no
          Transferegov fica vazia mesmo quando há TCE, porque ela hoje corre no e-TCE.
        </p>
        <div className="pa-grade pa-grade-4 mp-painel-cartoes">
          <Cartao titulo="Convênios com TCE" numero={n(convenios)} nota={`${n(linhas.length)} TCE no total`} />
          <Cartao titulo="Municípios" numero={n(municipios.length)} nota="com ao menos um convênio em TCE" />
          <Cartao
            titulo="Débito original"
            numero={moedaCurta(original)}
            nota={`soma do valor apurado na instauração${semOriginal ? ` (${n(semOriginal)} TCE sem o original informado)` : ""}`}
          />
          <Cartao titulo="Débito com juros" numero={moedaCurta(comJuros)} nota="atualizado pelo TCU, na data de cada TCE" />
        </div>
        {municipios.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma TCE nos convênios consultados.</p>
        ) : (
          <TabelaRolagem rotuloId="contas-tce">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Município</th>
                  <th scope="col" className="mp-num">
                    Convênios
                  </th>
                  <th scope="col" className="mp-num">
                    TCE
                  </th>
                  <th scope="col" className="mp-num">
                    Débito original
                  </th>
                  <th scope="col" className="mp-num">
                    Com juros
                  </th>
                </tr>
              </thead>
              <tbody>
                {municipios.map((m) => (
                  <tr key={m.municipio}>
                    <td>{m.municipio}</td>
                    <td className="mp-num">{n(m.convenios)}</td>
                    <td className="mp-num">{n(m.tces)}</td>
                    <td className="mp-num">{m.temOriginal ? moedaCurta(m.debitoOriginal) : "—"}</td>
                    <td className="mp-num">{moedaCurta(m.debitoComJuros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        )}
      </section>

      {ordenadas.length > 0 && (
        <section aria-labelledby="contas-lista" className="mp-radar-secao">
          <h2 id="contas-lista" className="mp-radar-h2">
            As TCE, uma a uma
          </h2>
          <TabelaRolagem rotuloId="contas-lista">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Convênio</th>
                  <th scope="col">Proponente</th>
                  <th scope="col">Instaurada</th>
                  <th scope="col">Motivo</th>
                  <th scope="col" className="mp-num">
                    Débito original
                  </th>
                  <th scope="col" className="mp-num">
                    Com juros
                  </th>
                  <th scope="col">Processo</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((t, k) => (
                  <tr key={`${t.nr_convenio}-${t.codigo ?? k}`}>
                    <td>
                      <LinkMapa href={`${urlInstrumento(t.nr_convenio)}/laudo`}>{t.nr_convenio}</LinkMapa>
                      <br />
                      <span className="mp-laudo-miudo">{t.situacao_convenio ?? ""}</span>
                    </td>
                    <td>
                      {t.proponente ?? "—"}
                      <br />
                      <span className="mp-laudo-miudo">{[t.municipio, t.orgao_sup].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td>{t.dt_instauracao ? formatarData(t.dt_instauracao) : (t.ano ?? "—")}</td>
                    <td>
                      {t.motivo ?? "—"}
                      {t.submotivo ? <span className="mp-laudo-miudo"> · {t.submotivo}</span> : null}
                    </td>
                    <td className="mp-num">{t.debito_original !== null ? moedaExata(t.debito_original) : "—"}</td>
                    <td className="mp-num">
                      {t.debito_com_juros !== null ? moedaExata(t.debito_com_juros) : "—"}
                      {t.dt_atualizacao_debito ? <span className="mp-laudo-miudo"> em {formatarData(t.dt_atualizacao_debito)}</span> : null}
                    </td>
                    <td>
                      {t.numero_processo ? (
                        t.url_processo ? (
                          <a href={t.url_processo} target="_blank" rel="noopener noreferrer">
                            TC {t.numero_processo}
                          </a>
                        ) : (
                          `TC ${t.numero_processo}`
                        )
                      ) : (
                        "—"
                      )}
                      <br />
                      <span className="mp-laudo-miudo">{t.situacao ?? ""}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
          <p className="pa-nota">
            Fonte: API pública do e-TCE do TCU (tce.apps.tcu.gov.br), uma consulta por convênio, toda semana. Entram os convênios assinados da PB
            na última execução do painel, menos os anulados e cancelados. TCE com situação &quot;Excluída&quot; não aparece.
          </p>
        </section>
      )}
    </>
  );
}

function SecaoImpugnacoes({ linhas, referencia }: { linhas: PainelContasObras["impugnacoes"] & object; referencia: string | null }) {
  const total = linhas.reduce((s, l) => s + (l.valor_impugnado ?? 0), 0);
  return (
    <section aria-labelledby="contas-impugnacao" className="mp-radar-secao">
      <h2 id="contas-impugnacao" className="mp-radar-h2">
        Impugnações na prestação de contas
      </h2>
      <p className="pa-nota">
        {n(linhas.length)} convênios em prestação de contas com valor impugnado no SIAFI, somando {moedaCurta(total)} (coleta do Acesso Livre
        {referencia ? ` de ${formatarData(referencia)}` : ""}).
      </p>
      {linhas.length > 0 && (
        <TabelaRolagem rotuloId="contas-impugnacao">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Convênio</th>
                <th scope="col">Proponente</th>
                <th scope="col" className="mp-num">
                  Comprovado
                </th>
                <th scope="col" className="mp-num">
                  Aprovado
                </th>
                <th scope="col" className="mp-num">
                  Impugnado
                </th>
                <th scope="col">Último parecer</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nr_convenio}>
                  <td>
                    <LinkMapa href={`${urlInstrumento(l.nr_convenio)}/laudo`}>{l.nr_convenio}</LinkMapa>
                    <br />
                    <span className="mp-laudo-miudo">{l.situacao_convenio ?? ""}</span>
                  </td>
                  <td>
                    {l.proponente ?? "—"}
                    <br />
                    <span className="mp-laudo-miudo">{l.municipio ?? ""}</span>
                  </td>
                  <td className="mp-num">{l.valor_comprovado !== null ? moedaContas(l.valor_comprovado) : "—"}</td>
                  <td className="mp-num">{l.valor_aprovado !== null ? moedaContas(l.valor_aprovado) : "—"}</td>
                  <td className="mp-num">{l.valor_impugnado !== null ? moedaContas(l.valor_impugnado) : "—"}</td>
                  <td>{l.parecer_situacao ? `${l.parecer_situacao}${l.parecer_data ? ` (${formatarData(l.parecer_data)})` : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      )}
    </section>
  );
}

function SecaoObras({ linhas, referencia }: { linhas: PainelContasObras["obras"] & object; referencia: string | null }) {
  const paradas = obrasParadas(linhas);
  return (
    <section aria-labelledby="contas-obras" className="mp-radar-secao">
      <h2 id="contas-obras" className="mp-radar-h2">
        Obras paradas no acompanhamento
      </h2>
      <p className="pa-nota">
        {n(paradas.length)} obras em execução paralisadas ou atrasadas há {DIAS_SEM_MEDICAO_MODERADO} dias ou mais sem medição, pelo módulo de
        acompanhamento de obras do Transferegov (coleta{referencia ? ` de ${formatarData(referencia)}` : ""}).
      </p>
      {paradas.length > 0 && (
        <TabelaRolagem rotuloId="contas-obras">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Convênio</th>
                <th scope="col">Proponente</th>
                <th scope="col" className="mp-num">
                  Sem medição
                </th>
                <th scope="col" className="mp-num">
                  Medições
                </th>
                <th scope="col" className="mp-num">
                  Atestado convenente
                </th>
                <th scope="col" className="mp-num">
                  Atestado concedente
                </th>
              </tr>
            </thead>
            <tbody>
              {paradas.map((o) => (
                <tr key={o.nr_convenio}>
                  <td>
                    <LinkMapa href={`${urlInstrumento(o.nr_convenio)}/laudo`}>{o.nr_convenio}</LinkMapa>
                    {o.paralisado ? (
                      <>
                        <br />
                        <span className="mp-laudo-miudo">paralisada</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {o.proponente ?? "—"}
                    <br />
                    <span className="mp-laudo-miudo">{o.municipio ?? ""}</span>
                  </td>
                  <td className="mp-num">{o.dias_sem_medicao !== null ? `${n(o.dias_sem_medicao)} dias` : "—"}</td>
                  <td className="mp-num">{o.ultima_medicao ?? "—"}</td>
                  <td className="mp-num">{pct(o.pct_convenente)}</td>
                  <td className="mp-num">{pct(o.pct_concedente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      )}
    </section>
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
