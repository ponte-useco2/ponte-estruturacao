/**
 * O laudo de um convênio em cláusula suspensiva: situação em uma frase, riscos, estratégia, custo da
 * inação, causas, linha do tempo com o texto do concedente, quem analisou e os documentos.
 * Recebe a leitura pronta (lib/oportunidades/laudo.ts); aqui só se apresenta.
 */
import Link from "next/link";
import { rotuloModalidade, urlInstrumento, urlInvestimentos } from "@/lib/oportunidades/busca";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { agruparLinha, diasEntre as diasEntreDias, type BlocoLinha, type Dossie, type Laudo, type Lado, type LinhaDoTempo, type Nivel } from "@/lib/oportunidades/laudo";
import type { ContextoPainel } from "@/lib/oportunidades/laudo.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";

const AVISO =
  "Leitura automática de registros públicos do Transferegov (Acesso Livre e dados abertos). Não substitui o termo assinado, " +
  "o parecer do concedente nem orientação jurídica: confira no termo o prazo da cláusula suspensiva e a regra de extinção aplicável.";

const ROTULO_NIVEL: Record<Nivel, string> = { critico: "crítico", alto: "alto", moderado: "moderado", informativo: "informativo" };
const NOME_LADO: Record<Lado, string> = { concedente: "concedente", proponente: "município" };

const n = (x: number) => x.toLocaleString("pt-BR");
const dias = (x: number) => `${n(x)} ${Math.abs(x) === 1 ? "dia" : "dias"}`;
const data = (iso: string | null) => (iso ? formatarData(iso) : "—");

export function LaudoConteudo({ laudo, dossie, contexto, hoje }: { laudo: Laudo; dossie: Dossie; contexto: ContextoPainel; hoje: string }) {
  const numero = contexto.nr_convenio;
  const inst = dossie.instrumento;
  const t = laudo.tempoPorLado;
  const to = laudo.tempoOrgao;
  const pctConcedente = t.total ? Math.round((t.concedente / t.total) * 100) : 0;

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          Laudo da cláusula suspensiva · {rotuloModalidade(contexto.modalidade) ?? "convênio"} nº {numero}
        </p>
        <h1 className="pa-titulo">
          {contexto.municipio ?? "Município não informado"}
          {contexto.uf ? `/${contexto.uf}` : ""}
        </h1>
        <p className="pa-sub">{contexto.programa ?? "Programa não informado"}</p>
        {contexto.objeto && <p className="pa-sub">{contexto.objeto}</p>}
        <p className="pa-sub">
          {contexto.orgao_sup ?? "Órgão não informado"}
          {inst?.proposta ? ` · proposta ${inst.proposta}` : ""}
          {contexto.dt_assinatura ? ` · assinado em ${data(contexto.dt_assinatura)}` : ""}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <Link href={urlInstrumento(numero)} className="pa-btn pa-btn-pequeno">
            Ver o convênio
          </Link>
          <Link href="/mapa/suspensivas" className="pa-btn pa-btn-pequeno">
            Todas as suspensivas
          </Link>
          {contexto.orgao_sup && (
            <Link href={`/mapa/suspensivas/checklist?orgao=${encodeURIComponent(contexto.orgao_sup)}`} className="pa-btn pa-btn-pequeno">
              Checklist deste órgão
            </Link>
          )}
        </p>
        <p className="mp-fiscal-aviso">{AVISO}</p>
      </div>

      <section aria-labelledby="laudo-frase" className="mp-radar-secao">
        <h2 id="laudo-frase" className="mp-radar-h2">
          Onde está o processo
        </h2>
        <div className={`pa-cartao mp-laudo-frase mp-laudo-${laudo.prazo.nivel}`}>
          <p>{laudo.vez.frase}</p>
          <p>{laudo.prazo.frase}</p>
        </div>
      </section>

      <div className={`pa-grade ${laudo.tempoOrgao ? "pa-grade-4" : "pa-grade-3"} mp-painel-cartoes`}>
        <article className="pa-cartao">
          <h2 className="pa-mono">Repasse sem desembolso</h2>
          <p className="pa-numero">{moedaCurta(laudo.dinheiro.parado)}</p>
          <p className="pa-nota">
            de {moedaCurta(laudo.dinheiro.repasse)} de repasse · desembolsado {moedaCurta(laudo.dinheiro.desembolsado ?? 0)}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">A vez é do</h2>
          <p className="pa-numero">{laudo.vez.lado ? NOME_LADO[laudo.vez.lado] : "—"}</p>
          <p className="pa-nota">{laudo.vez.dias !== null ? `há ${dias(laudo.vez.dias)}, desde ${data(laudo.vez.desde)}` : "sem evento registrado"}</p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Prazo da suspensiva</h2>
          <p className="pa-numero">{laudo.retirada ? "retirada" : data(laudo.prazo.data)}</p>
          <p className="pa-nota">
            {laudo.retirada
              ? `em ${data(laudo.retirada)}`
              : laudo.prazo.dias === null
                ? "sem prazo informado"
                : laudo.prazo.dias < 0
                  ? `vencido há ${dias(-laudo.prazo.dias)}`
                  : laudo.prazo.dias === 0
                    ? "vence hoje"
                    : `faltam ${dias(laudo.prazo.dias)}`}
            {laudo.vigencia.data ? ` · vigência até ${data(laudo.vigencia.data)}` : ""}
          </p>
        </article>
        {to && (
          <article className="pa-cartao">
            <h2 className="pa-mono">Desde a assinatura</h2>
            <p className="pa-numero">{dias(to.dias)}</p>
            <p className="pa-nota">
              {to.posicao === null || to.mediana === null || to.p75 === null
                ? `poucos casos no órgão para comparar: ${to.sairam === 0 ? "nenhum saiu" : to.sairam === 1 ? "1 saiu" : `${n(to.sairam)} saíram`} da suspensiva desde ${to.desde.slice(0, 4)}`
                : `no órgão, metade saiu da suspensiva em até ${dias(Math.round(to.mediana))}; 3 em cada 4, em até ${dias(Math.round(to.p75))}`}
            </p>
          </article>
        )}
      </div>

      {!laudo.retirada && (
        <section aria-labelledby="laudo-condicoes" className="mp-radar-secao">
          <h2 id="laudo-condicoes" className="mp-radar-h2">
            O que o termo exige
          </h2>
          {laudo.condicoes.length === 0 ? (
            <p className="pa-cartao pa-cartao-plano">Os dados abertos do Transferegov não informam o motivo da cláusula suspensiva deste convênio.</p>
          ) : (
            <>
              <ul className="mp-laudo-condicoes">
                {laudo.condicoes.map((c) => (
                  <li key={c.texto} className={`pa-cartao mp-laudo-condicao${c.mencionada ? "" : " mp-laudo-sem-mencao"}`}>
                    <strong>{c.texto}</strong>
                    {c.livre && <span className="mp-laudo-miudo">texto livre do termo</span>}
                    <span className="mp-laudo-miudo">
                      {c.mencionada ? "aparece nos textos do concedente" : "nenhum texto do concedente na aba de requisitos menciona"}
                    </span>
                  </li>
                ))}
              </ul>
              {contexto.motivo_suspensao && (
                <p className="pa-nota mp-laudo-original">
                  Como está no termo: «{contexto.motivo_suspensao}»
                </p>
              )}
              <p className="pa-nota">
                Motivo da cláusula suspensiva registrado no Transferegov (dados abertos). “Aparece” quer dizer só que a palavra está em algum texto
                do concedente — não que a condição foi cumprida.
              </p>
            </>
          )}
        </section>
      )}


      {laudo.riscos.length > 0 && (
        <section aria-labelledby="laudo-riscos" className="mp-radar-secao">
          <h2 id="laudo-riscos" className="mp-radar-h2">
            Riscos
          </h2>
          <ul className="mp-laudo-lista">
            {laudo.riscos.map((r) => (
              <li key={r.titulo} className={`pa-cartao mp-laudo-risco mp-laudo-${r.nivel}`}>
                <p>
                  <span className={`pa-tag mp-laudo-nivel mp-laudo-${r.nivel}`}>{ROTULO_NIVEL[r.nivel]}</span> <strong>{r.titulo}</strong>
                </p>
                <p>{r.fato}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="laudo-estrategia" className="mp-radar-secao">
        <h2 id="laudo-estrategia" className="mp-radar-h2">
          Estratégia de ação
        </h2>
        <p className="pa-nota">Na ordem em que convém fazer. Cada passo diz o porquê, com a data e o registro que o sustentam.</p>
        <ol className="mp-simulador-caminho">
          {laudo.estrategia.map((p) => (
            <li key={p.titulo} className="pa-cartao mp-simulador-passo">
              <p>
                <strong>{p.titulo}</strong>
              </p>
              <p>{p.porque}</p>
            </li>
          ))}
        </ol>
      </section>

      {laudo.inacao.length > 0 && (
        <section aria-labelledby="laudo-inacao" className="mp-radar-secao">
          <h2 id="laudo-inacao" className="mp-radar-h2">
            Se nada for feito
          </h2>
          <ul className="pa-cartao pa-cartao-plano mp-laudo-inacao">
            {laudo.inacao.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="laudo-causas" className="mp-radar-secao">
        <h2 id="laudo-causas" className="mp-radar-h2">
          O que os registros mostram
        </h2>
        {t.total > 0 && (
          <figure className="mp-laudo-tempo" aria-label={`Tempo com cada lado: concedente ${dias(t.concedente)}, município ${dias(t.proponente)}`}>
            <div className="mp-laudo-barra">
              <span className="mp-laudo-barra-concedente" style={{ width: `${pctConcedente}%` }} />
              <span className="mp-laudo-barra-proponente" style={{ width: `${100 - pctConcedente}%` }} />
            </div>
            <figcaption className="mp-laudo-miudo">
              <span className="mp-laudo-legenda mp-laudo-legenda-concedente">concedente {dias(t.concedente)}</span>
              <span className="mp-laudo-legenda mp-laudo-legenda-proponente">município {dias(t.proponente)}</span>
            </figcaption>
          </figure>
        )}
        {laudo.causas.length ? (
          <ul className="mp-laudo-causas">
            {laudo.causas.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <p className="pa-nota">Não há eventos suficientes para medir tempos.</p>
        )}
      </section>

      <section aria-labelledby="laudo-linha" className="mp-radar-secao">
        <h2 id="laudo-linha" className="mp-radar-h2">
          Linha do tempo
        </h2>
        {laudo.linha.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">O Acesso Livre não registra nenhum evento de análise para este convênio.</p>
        ) : (
          <ol className="mp-laudo-linha">
            {agruparLinha(laudo.linha).map((b, k) =>
              b.itens.length === 1 ? (
                <EventoLaudo key={`${b.itens[0].quando}-${k}`} l={b.itens[0]} ultimo={b.ultimo} />
              ) : (
                <GrupoLaudo key={`${b.itens[0].quando}-${k}`} b={b} />
              ),
            )}
          </ol>
        )}
      </section>

      {laudo.analistas.length > 0 && (
        <section aria-labelledby="laudo-analistas" className="mp-radar-secao">
          <h2 id="laudo-analistas" className="mp-radar-h2">
            Quem analisou
          </h2>
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Atribuição</th>
                  <th scope="col" className="mp-num">
                    Atos
                  </th>
                  <th scope="col" className="mp-num">
                    Pediu complementação
                  </th>
                  <th scope="col" className="mp-num">
                    Deu por atendido
                  </th>
                  <th scope="col">Período</th>
                </tr>
              </thead>
              <tbody>
                {laudo.analistas.map((a) => (
                  <tr key={a.nome}>
                    <th scope="row">{a.nome}</th>
                    <td>{a.atribuicao ?? "—"}</td>
                    <td className="mp-num">{n(a.atos)}</td>
                    <td className="mp-num">{n(a.exigencias)}</td>
                    <td className="mp-num">{n(a.atendimentos)}</td>
                    <td>{a.primeiro === a.ultimo ? data(a.primeiro) : `${data(a.primeiro)} a ${data(a.ultimo)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pa-nota">Nomes e atribuições como registrados no Transferegov. Contatos pessoais não são coletados.</p>
        </section>
      )}

      <section aria-labelledby="laudo-documentos" className="mp-radar-secao">
        <h2 id="laudo-documentos" className="mp-radar-h2">
          Documentos anexados
        </h2>
        {laudo.documentos.total === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum documento anexado na aba de requisitos.</p>
        ) : (
          <>
            <p className="pa-nota">
              {n(laudo.documentos.total)} {laudo.documentos.total === 1 ? "documento" : "documentos"} (
              {laudo.documentos.porGrupo.map((g) => `${g.grupo.toLowerCase()}: ${n(g.n)}`).join(" · ")})
              {laudo.documentos.comValidade > 0
                ? ` · ${n(laudo.documentos.vencidos.length)} de ${n(laudo.documentos.comValidade)} com validade já vencidos em ${data(hoje)}`
                : ""}
              .
            </p>
            <details className="mp-fiscal-detalhe">
              <summary>Ver a lista, do envio mais recente ao mais antigo</summary>
              <div className="mp-tabela-rolagem">
                <table className="mp-tabela">
                  <thead>
                    <tr>
                      <th scope="col">Documento</th>
                      <th scope="col">Grupo</th>
                      <th scope="col">Enviado em</th>
                      <th scope="col">Validade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossie.documentos.map((d) => {
                      const vencido = !!d.validade && d.validade < hoje;
                      return (
                        <tr key={d.ordem} className={vencido ? "mp-laudo-vencido" : undefined}>
                          <th scope="row">
                            <span className="mp-tabela-principal">{d.descricao ?? d.arquivo}</span>
                            <span className="mp-tabela-secundario">{d.arquivo}</span>
                          </th>
                          <td>{d.grupo ?? "—"}</td>
                          <td>{d.enviado_em ? formatarPublicacao(d.enviado_em) : "—"}</td>
                          <td>{d.validade ? `${data(d.validade)}${vencido ? " · vencido" : ""}` : "sem validade"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      <section aria-labelledby="laudo-fonte" className="mp-radar-secao">
        <h2 id="laudo-fonte" className="mp-radar-h2">
          Fonte e método
        </h2>
        <ul className="mp-laudo-causas mp-laudo-miudo">
          <li>
            Histórico, documentos e textos: tela “Requisitos para Celebração” do Acesso Livre do Transferegov, colhida em{" "}
            {dossie.coletado_em ? formatarPublicacao(dossie.coletado_em) : "data desconhecida"}. O tempo parado conta até essa coleta — o que aconteceu
            depois dela não está aqui.
          </li>
          <li>Valores, prazo da cláusula suspensiva e vigência: dados abertos do Transferegov (SICONV), atualizados todo dia; prazos contados até {data(hoje)}.</li>
          {laudo.textos.comDetalhe > 0 && (
            <li>
              {laudo.textos.colhidos >= laudo.textos.comDetalhe
                ? laudo.textos.comDetalhe === 1
                  ? "O texto do concedente vem do painel de detalhe do evento: o único deste convênio foi colhido."
                  : `O texto do concedente vem do painel de detalhe de cada evento: os ${n(laudo.textos.comDetalhe)} deste convênio foram colhidos.`
                : `O texto do concedente vem do painel de detalhe de cada evento: foram colhidos ${n(laudo.textos.colhidos)} dos ${n(laudo.textos.comDetalhe)} deste convênio. ` +
                  "Nos demais, a linha do tempo mostra quem agiu e quando; “texto não colhido” quer dizer que o texto existe no Transferegov, não que veio em branco."}
            </li>
          )}
          {to && (
            <li>
              Tempo no órgão: convênios da PB do mesmo órgão assinados desde {data(to.desde)} que tiveram cláusula suspensiva, nos dados
              abertos. A metade e o “3 em cada 4” contam só os que saíram dela: quem segue
              preso ou morreu nela não entra nessa conta, então a espera típica de verdade é maior.
            </li>
          )}
          <li>
            A vez é lida pelo último evento: pedido de complementação ou análise não atendida deixam a vez com o município; envio de documentação ou
            análise atendida, com o concedente.
          </li>
          <li>
            “Atendido” é o rótulo que o concedente registrou, não uma conclusão deste laudo. Onde há observação, ela aparece entre aspas, como foi escrita.
          </li>
        </ul>
        {contexto.cod_ibge && (
          <p className="pa-nota mp-nao-imprimir">
            <Link href={urlInvestimentos(contexto.cod_ibge)}>Outros investimentos em {contexto.municipio ?? "neste município"}</Link>
          </p>
        )}
      </section>
    </div>
  );
}

function EventoLaudo({ l, ultimo }: { l: LinhaDoTempo; ultimo: boolean }) {
  const lado = l.lado === "indefinido" ? "indefinido" : NOME_LADO[l.lado];
  return (
    <li className={`mp-laudo-evento mp-laudo-evento-${l.lado}`}>
      <p className="mp-laudo-evento-cabeca">
        <span className="pa-mono">{data(l.dia)}</span> <strong>{l.evento}</strong>
      </p>
      <p className="mp-laudo-miudo">
        {lado}
        {l.responsavel ? ` · ${l.responsavel}` : ""}
        {l.atribuicao ? ` · ${l.atribuicao}` : ""}
        {l.analisadaEm ? ` · análise datada de ${data(l.analisadaEm)}${l.atrasoRegistro ? `, registrada ${dias(l.atrasoRegistro)} depois` : ""}` : ""}
        {l.temDetalhe && !l.texto ? " · texto não colhido" : ""}
      </p>
      {l.texto && (
        <blockquote className="mp-laudo-texto">
          <p>{l.texto}</p>
          <footer className="mp-laudo-miudo">{l.tipoTexto === "solicitacao" ? "Solicitação de complementação" : "Observação"}, como registrada</footer>
        </blockquote>
      )}
      {l.vezDepois && (
        <p className={`mp-laudo-miudo mp-laudo-espera mp-laudo-espera-${l.vezDepois}`}>
          {ultimo
            ? `Desde então, a vez é do ${NOME_LADO[l.vezDepois]}: ${dias(l.diasAteProximo)} até a coleta.`
            : `Vez do ${NOME_LADO[l.vezDepois]} por ${dias(l.diasAteProximo)}.`}
        </p>
      )}
    </li>
  );
}

/** Pedidos seguidos do mesmo ato, pela mesma pessoa e sem texto colhido: uma linha só. */
function GrupoLaudo({ b }: { b: BlocoLinha }) {
  const primeiro = b.itens[0];
  const ultimoItem = b.itens[b.itens.length - 1];
  const lado = primeiro.lado === "indefinido" ? "indefinido" : NOME_LADO[primeiro.lado];
  const periodo = diasEntreDias(primeiro.dia, ultimoItem.dia);
  return (
    <li className={`mp-laudo-evento mp-laudo-evento-${primeiro.lado}`}>
      <p className="mp-laudo-evento-cabeca">
        <span className="pa-mono">
          {data(primeiro.dia)} a {data(ultimoItem.dia)}
        </span>{" "}
        <strong>
          {n(b.itens.length)} × {primeiro.evento}
        </strong>
      </p>
      <p className="mp-laudo-miudo">
        {lado}
        {primeiro.responsavel ? ` · ${primeiro.responsavel}` : ""} · {n(b.itens.length)} registros em {dias(periodo)}
        {primeiro.temDetalhe ? " · texto não colhido" : ""}
      </p>
      {ultimoItem.vezDepois && (
        <p className={`mp-laudo-miudo mp-laudo-espera mp-laudo-espera-${ultimoItem.vezDepois}`}>
          {b.ultimo
            ? `Desde então, a vez é do ${NOME_LADO[ultimoItem.vezDepois]}: ${dias(ultimoItem.diasAteProximo)} até a coleta.`
            : `Depois do último, vez do ${NOME_LADO[ultimoItem.vezDepois]} por ${dias(ultimoItem.diasAteProximo)}.`}
        </p>
      )}
    </li>
  );
}
