/**
 * Tomadas de Contas Especiais dos convênios da PB no e-TCE do TCU: por município e uma a uma.
 * Recebe a leitura pronta (lib/oportunidades/tce-tcu.server.ts); aqui só se apresenta.
 */
import Link from "next/link";
import { urlInstrumento } from "@/lib/oportunidades/busca";
import { formatarData } from "@/lib/oportunidades/central";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { moedaExata, porMunicipio } from "@/lib/oportunidades/tce-tcu";
import type { LeituraContas } from "@/lib/oportunidades/tce-tcu.server";

type LeituraOk = Extract<LeituraContas, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

export function ContasConteudo({ leitura }: { leitura: LeituraOk }) {
  const { linhas, execucao } = leitura;
  const c = execucao.contagens ?? {};
  const municipios = porMunicipio(linhas);
  const convenios = new Set(linhas.map((l) => l.nr_convenio)).size;
  const original = linhas.reduce((s, l) => s + (l.debito_original ?? 0), 0);
  const comJuros = linhas.reduce((s, l) => s + (l.debito_com_juros ?? 0), 0);
  const semOriginal = linhas.filter((l) => l.debito_original === null).length;
  const ordenadas = [...linhas].sort((a, b) => (b.dt_instauracao ?? "").localeCompare(a.dt_instauracao ?? "") || a.nr_convenio.localeCompare(b.nr_convenio));

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · TCE no TCU</p>
        <h1 className="pa-titulo">Tomadas de Contas Especiais dos convênios da PB</h1>
        <p className="pa-sub">
          O que o e-TCE do Tribunal de Contas da União registra para os convênios assinados da PB: motivo, débito e processo. A aba &quot;TCE&quot;
          do convênio no Transferegov fica vazia mesmo quando há TCE, porque ela hoje corre no e-TCE.
        </p>
        <p className="mp-fiscal-aviso">
          Uso interno da PONTE. TCE instaurada é o órgão apurando dano ao erário; quem julga é o TCU, e &quot;processo autuado&quot; não é
          condenação. A API do TCU não traz o nome dos responsáveis, e esta página também não.
        </p>
        <p className="pa-nota">
          Consulta de {execucao.referencia ? formatarData(execucao.referencia) : "—"}: {n(num(c.tcu_consultados))} convênios consultados
          {num(c.tcu_erros) > 0 ? `, ${n(num(c.tcu_erros))} sem resposta` : ""}
          {num(c.tcu_nao_consultados) > 0 ? `, ${n(num(c.tcu_nao_consultados))} para a próxima rodada` : ""}.
        </p>
      </div>

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

      <section aria-labelledby="contas-municipio" className="mp-radar-secao">
        <h2 id="contas-municipio" className="mp-radar-h2">
          Por município
        </h2>
        {municipios.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma TCE nos convênios consultados.</p>
        ) : (
          <div className="mp-tabela-rolagem">
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
          </div>
        )}
      </section>

      <section aria-labelledby="contas-lista" className="mp-radar-secao">
        <h2 id="contas-lista" className="mp-radar-h2">
          Uma a uma
        </h2>
        {ordenadas.length > 0 && (
          <div className="mp-tabela-rolagem">
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
                      <Link href={`${urlInstrumento(t.nr_convenio)}/laudo`}>{t.nr_convenio}</Link>
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
          </div>
        )}
        <p className="pa-nota">
          Fonte: API pública do e-TCE do TCU (tce.apps.tcu.gov.br), uma consulta por convênio, toda semana. Entram os convênios assinados da PB na
          última execução do painel, menos os anulados e cancelados. TCE com situação &quot;Excluída&quot; não aparece.
        </p>
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
