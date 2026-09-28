/**
 * O laudo de qualquer instrumento (onda 12): onde está, quanto tempo contra o típico, o dinheiro, os
 * riscos, a estratégia, o custo de não agir, o programa, o proponente, a emenda de origem e a próxima
 * porta aberta. Recebe a leitura pronta (lib/oportunidades/diagnostico.ts); aqui só se apresenta.
 *
 * Dois usos: a página inteira (`DiagnosticoConteudo`), para quem não tem dossiê da suspensiva; e o
 * complemento (`DiagnosticoComplemento`), que entra no fim do laudo da suspensiva quando há dossiê.
 */
import Link from "next/link";
import { rotuloModalidade, urlInstrumento, urlInvestimentos } from "@/lib/oportunidades/busca";
import { formatarData } from "@/lib/oportunidades/central";
import {
  ROTULO_ETAPA_LAUDO,
  ROTULO_TIPO_EMENDA,
  cnpjLegivel,
  nivelMaisAlto,
  nomeProponente,
  type Diagnostico,
  type InstrumentoLaudo,
  type Vizinhanca,
} from "@/lib/oportunidades/diagnostico";
import { NOME_VERIFICACAO, ROTULO_DECISAO, urlMunicipioFiscal } from "@/lib/oportunidades/fiscal";
import type { Nivel, Passo, Risco } from "@/lib/oportunidades/laudo";
import { DIAS_JANELA_TEMPO, percentual } from "@/lib/oportunidades/painel";
import { tituloOrgao } from "@/lib/oportunidades/padroes";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";

const AVISO =
  "Leitura automática dos dados abertos do Transferegov e do painel fiscal. Não substitui o termo, o parecer do concedente nem " +
  "orientação jurídica: confira no Transferegov a situação, a vigência e as condições do instrumento antes de agir.";

const ROTULO_NIVEL: Record<Nivel, string> = { critico: "crítico", alto: "alto", moderado: "moderado", informativo: "informativo" };

const n = (x: number) => x.toLocaleString("pt-BR");
const dias = (x: number) => `${n(x)} ${Math.abs(x) === 1 ? "dia" : "dias"}`;
const data = (iso: string | null | undefined) => (iso ? formatarData(iso) : "—");
const diasArredondados = (x: number) => dias(Math.round(x));

export function DiagnosticoConteudo({ d, i, referencia, hoje }: { d: Diagnostico; i: InstrumentoLaudo; referencia: string; hoje: string }) {
  const municipio = i.municipio ? `${i.municipio}${i.uf ? `/${i.uf}` : ""}` : null;
  const titulo = i.tipo_agente === "municipio" || !i.proponente ? (municipio ?? "Proponente não informado") : nomeProponente(i);
  const t = d.tempo;

  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          Laudo do instrumento · {rotuloModalidade(i.modalidade) ?? "instrumento"} nº {i.nr_convenio}
        </p>
        <h1 className="pa-titulo">{titulo}</h1>
        {titulo !== municipio && municipio && <p className="pa-sub">{municipio}</p>}
        <p className="pa-sub">{i.programa ?? "Programa não informado"}</p>
        {i.objeto && <p className="pa-sub">{i.objeto}</p>}
        <p className="pa-sub">
          {i.orgao_sup ? tituloOrgao(i.orgao_sup) : "Órgão não informado"}
          {i.nr_proposta ? ` · proposta ${i.nr_proposta}` : ""}
          {` · situação: ${i.situacao ?? "sem situação registrada"}`}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <BotaoImprimir />
          <Link href={urlInstrumento(i.nr_convenio)} className="pa-btn pa-btn-pequeno">
            Ver o instrumento
          </Link>
          {d.fiscal && (
            <Link href={urlMunicipioFiscal(d.fiscal.ibge)} className="pa-btn pa-btn-pequeno">
              Painel fiscal do município
            </Link>
          )}
        </p>
        <p className="mp-fiscal-aviso">{AVISO}</p>
      </div>

      <section aria-labelledby="diag-frase" className="mp-radar-secao">
        <h2 id="diag-frase" className="mp-radar-h2">
          Onde está
        </h2>
        <div className={`pa-cartao mp-laudo-frase mp-laudo-${nivelMaisAlto(d.riscos)}`}>
          <p>
            <strong>{d.rotuloEtapa}</strong>
            {d.vez ? ` · a vez é do ${d.vez === "concedente" ? "concedente" : "proponente"}` : ""}
          </p>
          <p>{d.frase}</p>
        </div>
      </section>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">{t ? "Nesta etapa há" : "Assinado em"}</h2>
          <p className="pa-numero">{t ? (t.dias !== null ? dias(t.dias) : "—") : data(i.dt_assinatura)}</p>
          <p className="pa-nota">
            {!t
              ? ROTULO_ETAPA_LAUDO[d.etapa].toLowerCase()
              : t.dias === null
                ? `o histórico não registra ${t.marco}`
                : t.base
                  ? `desde ${t.marco} (${data(t.desde)}) · ${t.base.rotulo}: metade em até ${diasArredondados(t.base.mediana)}; 9 em cada 10, em até ${diasArredondados(t.base.p90)}`
                  : `desde ${t.marco} (${data(t.desde)}) · poucos casos para comparar`}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Repasse</h2>
          <p className="pa-numero">{moedaCurta(d.dinheiro.repasse)}</p>
          <p className="pa-nota">
            {d.dinheiro.desembolsado
              ? `desembolsado ${moedaCurta(d.dinheiro.desembolsado)} (${percentual(d.dinheiro.pctDesembolsado)})` +
                (d.dinheiro.saldoConta ? ` · em conta ${moedaCurta(d.dinheiro.saldoConta)}` : "")
              : `nada desembolsado${d.dinheiro.empenhado ? ` · empenhado ${moedaCurta(d.dinheiro.empenhado)}` : ""}`}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Vigência</h2>
          <p className="pa-numero">{data(d.vigencia.data)}</p>
          <p className="pa-nota">
            {d.vigencia.dias === null
              ? "sem vigência informada"
              : d.vigencia.dias < 0
                ? `vencida há ${dias(-d.vigencia.dias)}`
                : d.vigencia.dias === 0
                  ? "vence hoje"
                  : `faltam ${dias(d.vigencia.dias)}`}
            {d.vigencia.original ? ` · a original era ${data(d.vigencia.original)}` : ""}
          </p>
        </article>
        <CartaoQuarto d={d} />
      </div>

      {t && t.comparacoes.length > 0 && (
        <section aria-labelledby="diag-tempo" className="mp-radar-secao">
          <h2 id="diag-tempo" className="mp-radar-h2">
            O tempo nesta etapa, contra quem já passou por ela
          </h2>
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Comparado com</th>
                  <th scope="col" className="mp-num">
                    Metade leva até
                  </th>
                  <th scope="col" className="mp-num">
                    9 em cada 10, até
                  </th>
                  <th scope="col" className="mp-num">
                    Medições
                  </th>
                  <th scope="col" className="mp-num">
                    Nesta etapa agora
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.comparacoes.map((c) => (
                  <tr key={c.rotulo}>
                    <th scope="row">{c.rotulo}</th>
                    <td className="mp-num">{diasArredondados(c.mediana)}</td>
                    <td className="mp-num">{diasArredondados(c.p90)}</td>
                    <td className="mp-num">{n(c.n)}</td>
                    <td className="mp-num">
                      {n(c.emAberto)}
                      {c.idadeAberto !== null && c.emAberto > 0 && <span className="mp-tabela-secundario">há {diasArredondados(c.idadeAberto)} (mediana)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pa-nota">
            Etapa «{t.rotulo}». Este instrumento: {t.dias !== null ? `${dias(t.dias)} desde ${t.marco}, contados até ${data(hoje)}` : "sem data de início"}. A metade e o “9 em
            cada 10” vêm das etapas que terminaram nos últimos {Math.round(DIAS_JANELA_TEMPO / 365)} anos; “nesta etapa agora” conta quem ainda não saiu dela.
          </p>
        </section>
      )}

      <Riscos riscos={d.riscos} titulo="Riscos" id="diag-riscos" />
      <Passos passos={d.estrategia} titulo="Estratégia de ação" id="diag-estrategia" />

      {d.inacao.length > 0 && (
        <section aria-labelledby="diag-inacao" className="mp-radar-secao">
          <h2 id="diag-inacao" className="mp-radar-h2">
            Se nada for feito
          </h2>
          <ul className="pa-cartao pa-cartao-plano mp-laudo-inacao">
            {d.inacao.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      <Cruzamentos d={d} i={i} />

      <section aria-labelledby="diag-fonte" className="mp-radar-secao">
        <h2 id="diag-fonte" className="mp-radar-h2">
          Fonte e método
        </h2>
        <ul className="mp-laudo-causas mp-laudo-miudo">
          <FontesDiagnostico d={d} referencia={referencia} hoje={hoje} />
        </ul>
        {i.cod_ibge && (
          <p className="pa-nota mp-nao-imprimir">
            <Link href={urlInvestimentos(i.cod_ibge)}>Outros investimentos em {i.municipio ?? "neste município"}</Link>
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * O que o diagnóstico acrescenta ao laudo da suspensiva: outros riscos e frentes (liminar, fiscal,
 * carteira, emenda), o programa, o proponente e as janelas abertas. Entra antes da "Fonte e método" de lá.
 */
export function DiagnosticoComplemento({ d, i }: { d: Diagnostico; i: InstrumentoLaudo }) {
  return (
    <>
      <Riscos riscos={d.riscos} titulo="Outros riscos do instrumento" id="diag-outros-riscos" />
      <Passos
        passos={d.estrategia}
        titulo="Outras frentes"
        id="diag-outras-frentes"
        nota="Frentes que andam junto com a retirada da suspensiva, tiradas do programa, do proponente e da origem do dinheiro."
      />
      <Cruzamentos d={d} i={i} />
    </>
  );
}

/** As linhas de método do diagnóstico, para a lista da "Fonte e método" (de cá ou do laudo da suspensiva). */
export function FontesDiagnostico({ d, referencia, hoje }: { d: Diagnostico; referencia: string; hoje: string }) {
  return (
    <>
      <li>
        Instrumento, valores, datas e situação: dados abertos do Transferegov (SICONV), painel de {data(referencia)}; prazos contados até {data(hoje)}.
      </li>
      <li>
        Tempo na etapa: marcos do histórico da proposta (envio, aprovação do plano de trabalho, assinatura, 1º desembolso), comparados com as
        etapas que terminaram nos últimos {Math.round(DIAS_JANELA_TEMPO / 365)} anos no mesmo programa e no mesmo órgão, na UF e no Brasil. Com
        menos de 10 medições, a comparação não é feita.
      </li>
      <li>
        Programa: na UF, todos os instrumentos da busca (na PB, a busca tem todos); no Brasil, as propostas enviadas desde 2019 — fora da PB a busca só
        tem os instrumentos vivos, e contá-los esconderia os que ficaram pelo caminho.
      </li>
      {d.proponente && <li>Proponente: os instrumentos do mesmo CNPJ na busca (todos, se o proponente é da PB; fora dela, só os vivos).</li>}
      <li>Emenda de origem: arquivo de emendas do SICONV, ligado pela proposta. O autor é agente público e aparece como registrado.</li>
      {d.fiscal && <li>Situação fiscal: painel de capacidade fiscal, decisão “receber transferência voluntária”, de {data(d.fiscal.referencia)}.</li>}
      <li>Janelas abertas: catálogo de oportunidades, filtrado pelo tipo de proponente e pela UF; entram as do mesmo programa ou do mesmo órgão concedente.</li>
      {d.faltas.length > 0 && <li>Não vieram nesta leitura: {d.faltas.join(", ")}. O laudo saiu sem esses cruzamentos.</li>}
    </>
  );
}

function CartaoQuarto({ d }: { d: Diagnostico }) {
  if (d.fiscal?.conclusao) {
    const c = d.fiscal.conclusao;
    return (
      <article className="pa-cartao">
        <h2 className="pa-mono">Transferência voluntária</h2>
        <p className="pa-numero">{ROTULO_DECISAO[c.estado]}</p>
        <p className="pa-nota">
          {c.bloqueantes.length ? `bloqueia: ${c.bloqueantes.map((g) => NOME_VERIFICACAO[g] ?? g).join(", ")} · ` : ""}
          painel fiscal de {data(d.fiscal.referencia)}
        </p>
      </article>
    );
  }
  if (d.emendas.length) {
    const total = d.emendas.reduce((s, e) => s + (e.valor ?? 0), 0);
    const autores = [...new Set(d.emendas.map((e) => e.parlamentar).filter((x): x is string => !!x))];
    return (
      <article className="pa-cartao">
        <h2 className="pa-mono">Emenda de origem</h2>
        <p className="pa-numero">{moedaCurta(total)}</p>
        <p className="pa-nota">{autores.length ? autores.join(", ") : `${n(d.emendas.length)} emenda(s) sem autor informado`}</p>
      </article>
    );
  }
  return (
    <article className="pa-cartao">
      <h2 className="pa-mono">Contrapartida</h2>
      <p className="pa-numero">{moedaCurta(d.dinheiro.contrapartida ?? 0)}</p>
      <p className="pa-nota">
        {d.dinheiro.pctContrapartida !== null
          ? `ingressada ${moedaCurta(d.dinheiro.contrapartidaIngressada)} (${percentual(d.dinheiro.pctContrapartida)})`
          : d.dinheiro.contrapartida
            ? "ingresso não informado"
            : "sem contrapartida financeira"}
      </p>
    </article>
  );
}

function Riscos({ riscos, titulo, id }: { riscos: Risco[]; titulo: string; id: string }) {
  if (!riscos.length) return null;
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      <ul className="mp-laudo-lista">
        {riscos.map((r) => (
          <li key={r.titulo} className={`pa-cartao mp-laudo-risco mp-laudo-${r.nivel}`}>
            <p>
              <span className={`pa-tag mp-laudo-nivel mp-laudo-${r.nivel}`}>{ROTULO_NIVEL[r.nivel]}</span> <strong>{r.titulo}</strong>
            </p>
            <p>{r.fato}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Passos({
  passos,
  titulo,
  id,
  nota = "Na ordem em que convém fazer. Cada passo diz o porquê, com a data e o registro que o sustentam.",
}: {
  passos: Passo[];
  titulo: string;
  id: string;
  nota?: string;
}) {
  if (!passos.length) return null;
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      <p className="pa-nota">{nota}</p>
      <ol className="mp-simulador-caminho">
        {passos.map((p) => (
          <li key={p.titulo} className="pa-cartao mp-simulador-passo">
            <p>
              <strong>{p.titulo}</strong>
            </p>
            <p>{p.porque}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Programa, proponente, emenda de origem e janelas abertas: o que cerca o instrumento. */
function Cruzamentos({ d, i }: { d: Diagnostico; i: InstrumentoLaudo }) {
  const pr = d.programa;
  const brasil = pr?.funis.find((f) => f.recorte === "BR");
  return (
    <>
      {pr && (pr.naUf || pr.funis.length > 0) && (
        <section aria-labelledby="diag-programa" className="mp-radar-secao">
          <h2 id="diag-programa" className="mp-radar-h2">
            O programa
          </h2>
          <p className="pa-nota">
            {pr.nome ?? "Programa sem nome"}
            {pr.codigo ? ` · código ${pr.codigo}` : ""}
          </p>
          {pr.naUf && <Distribuicao v={pr.naUf} rotulo={`Na ${pr.uf}`} etapa={d.etapa} />}
          {pr.funis.length > 0 && (
            <div className="mp-tabela-rolagem">
              <table className="mp-tabela">
                <caption className="mp-laudo-legenda-tabela">Propostas enviadas desde 2019 e o que aconteceu com elas</caption>
                <thead>
                  <tr>
                    <th scope="col">Onde</th>
                    <th scope="col" className="mp-num">
                      Enviadas
                    </th>
                    <th scope="col" className="mp-num">
                      Assinadas
                    </th>
                    <th scope="col" className="mp-num">
                      Esperando assinatura
                    </th>
                    <th scope="col" className="mp-num">
                      Em análise
                    </th>
                    <th scope="col" className="mp-num">
                      Negadas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pr.funis.map((f) => (
                    <tr key={f.recorte}>
                      <th scope="row">{f.recorte === "BR" ? "Brasil" : f.recorte}</th>
                      <td className="mp-num">{n(f.enviadas)}</td>
                      <td className="mp-num">{n(f.assinadas)}</td>
                      <td className="mp-num">{n(f.aguardando)}</td>
                      <td className="mp-num">{n(f.abertas)}</td>
                      <td className="mp-num">{n(f.negadas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {brasil && brasil.enviadas > 0 && (
            <p className="pa-nota">
              No Brasil, {percentual(brasil.assinadas / brasil.enviadas)} das propostas do programa enviadas desde 2019 já foram assinadas.
            </p>
          )}
        </section>
      )}

      {d.proponente && d.proponente.carteira.total > 1 && (
        <section aria-labelledby="diag-proponente" className="mp-radar-secao">
          <h2 id="diag-proponente" className="mp-radar-h2">
            O proponente
          </h2>
          <p className="pa-nota">
            {nomeProponente(i)}
            {d.proponente.cnpj ? ` · CNPJ ${cnpjLegivel(d.proponente.cnpj)}` : ""}
          </p>
          <Distribuicao v={d.proponente.carteira} rotulo="Instrumentos do proponente" etapa={d.etapa} />
        </section>
      )}

      {d.emendas.length > 0 && (
        <section aria-labelledby="diag-emenda" className="mp-radar-secao">
          <h2 id="diag-emenda" className="mp-radar-h2">
            De onde veio o dinheiro
          </h2>
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Emenda</th>
                  <th scope="col">Autor</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="mp-num">
                    Valor indicado
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.emendas.map((e) => (
                  <tr key={e.nr_emenda}>
                    <th scope="row">{e.nr_emenda}</th>
                    <td>{e.parlamentar ?? "—"}</td>
                    <td>
                      {e.tipo_parlamentar ? (ROTULO_TIPO_EMENDA[e.tipo_parlamentar] ?? e.tipo_parlamentar.toLowerCase()) : "—"}
                      {e.impositiva ? " · impositiva" : ""}
                    </td>
                    <td className="mp-num">{moedaCurta(e.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pa-nota">Emendas parlamentares ligadas à proposta, como registradas no SICONV.</p>
        </section>
      )}

      {!d.fiscal && d.fiscalMotivo && (
        <section aria-labelledby="diag-fiscal" className="mp-radar-secao">
          <h2 id="diag-fiscal" className="mp-radar-h2">
            Situação fiscal
          </h2>
          <p className="pa-cartao pa-cartao-plano">{d.fiscalMotivo}</p>
        </section>
      )}

      {d.portas.length > 0 && (
        <section aria-labelledby="diag-portas" className="mp-radar-secao">
          <h2 id="diag-portas" className="mp-radar-h2">
            Janelas abertas para este proponente
          </h2>
          <ul className="mp-laudo-lista">
            {d.portas.map((p) => (
              <li key={p.id} className="pa-cartao">
                <p>
                  <span className="pa-tag">{p.mesmoPrograma ? "mesmo programa" : "mesmo órgão"}</span> <strong>{p.titulo}</strong>
                </p>
                <p className="mp-laudo-miudo">
                  {tituloOrgao(p.financiador)} ·{" "}
                  {p.prazo
                    ? `até ${data(p.prazo)}${p.diasRestantes === 0 ? " (fecha hoje)" : p.diasRestantes !== null ? ` (faltam ${dias(p.diasRestantes)})` : ""}`
                    : "sem prazo informado"}
                  {p.codigos.length ? ` · código ${p.codigos.join(", ")}` : ""} ·{" "}
                  <a href={p.fonteUrl} target="_blank" rel="noopener noreferrer">
                    {p.fonteNome}
                  </a>
                </p>
              </li>
            ))}
          </ul>
          <p className="pa-nota">
            Do catálogo de janelas, filtradas pelo tipo de proponente e pela UF; entram as do mesmo programa e as do mesmo órgão concedente.
          </p>
        </section>
      )}
    </>
  );
}

/** Quantos instrumentos em cada etapa, e os outros na mesma etapa deste, com o número. */
function Distribuicao({ v, rotulo, etapa }: { v: Vizinhanca; rotulo: string; etapa: Diagnostico["etapa"] }) {
  const mostrados = v.mesmaEtapa.numeros.slice(0, 12);
  return (
    <>
      <div className="mp-tabela-rolagem">
        <table className="mp-tabela">
          <caption className="mp-laudo-legenda-tabela">
            {rotulo}: {n(v.total)} ({moedaCurta(v.valor)} de repasse)
          </caption>
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col" className="mp-num">
                Instrumentos
              </th>
              <th scope="col" className="mp-num">
                Repasse
              </th>
            </tr>
          </thead>
          <tbody>
            {v.porEtapa.map((c) => (
              <tr key={c.etapa}>
                <th scope="row">
                  {ROTULO_ETAPA_LAUDO[c.etapa]}
                  {c.etapa === etapa ? " · a deste" : ""}
                </th>
                <td className="mp-num">{n(c.n)}</td>
                <td className="mp-num">{moedaCurta(c.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mostrados.length > 0 && (
        <p className="pa-nota">
          Na mesma etapa: {mostrados.map((nr, k) => (
            <span key={nr}>
              {k > 0 ? ", " : ""}
              <Link href={urlInstrumento(nr)}>nº {nr}</Link>
            </span>
          ))}
          {v.mesmaEtapa.numeros.length > mostrados.length ? ` e mais ${n(v.mesmaEtapa.numeros.length - mostrados.length)}` : ""}.
        </p>
      )}
    </>
  );
}
