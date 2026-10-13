/**
 * Contas e obras dos convênios da PB: as Tomadas de Contas Especiais no e-TCE do TCU (onda 13C.1), as
 * impugnações na prestação de contas (13C.2) e as obras paradas no acompanhamento (13C.3). Cada parte vem
 * de uma leitura própria e some sozinha quando falta. Recebe as leituras prontas; aqui só se apresenta.
 *
 * Onda 15, fase 2, lote C (13/10/2026): as quatro listas são a `TabelaFiltravel`, com filtro e ordem em cada coluna (a
 * regra do titular; tela de administrador, toda coluna ordena). As células são as de antes; as colunas ocultas levam o
 * que a célula junta (a situação do convênio, o município, o órgão, o submotivo, a situação no TCU, a data do parecer,
 * a obra paralisada ou atrasada). A ordem padrão de cada uma é a de antes.
 */
import type { ReactNode } from "react";
import { urlInstrumento } from "@/lib/oportunidades/busca";
import { formatarData } from "@/lib/oportunidades/central";
import { moedaContas, obrasParadas, DIAS_SEM_MEDICAO_MODERADO, type LinhaImpugnacao, type LinhaObraParada } from "@/lib/oportunidades/contas-obras";
import type { PainelContasObras } from "@/lib/oportunidades/contas-obras.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { ColunaTabela, LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { moedaExata, porMunicipio, type LinhaTcePainel, type MunicipioTce } from "@/lib/oportunidades/tce-tcu";
import type { LeituraContas } from "@/lib/oportunidades/tce-tcu.server";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaFiltravel } from "../../_componentes/TabelaFiltravel";
import { Termo } from "../../_componentes/Termo";

// B14b (08/10/2026): nesta página "TCE" era sempre a tomada de contas especial. Ela passa a ser escrita por extenso,
// como no resto do Mapa: a sigla fica só para o TCE-PB e para o nome do sistema e-TCE (H06).

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
          O que os dados abertos não mostram: as <Termo slug="tomada-de-contas-especial">tomadas de contas especiais</Termo> no sistema
          e-TCE do Tribunal de Contas da União, o valor impugnado na <Termo slug="prestacao-de-contas">prestação de contas</Termo> e as
          obras paradas no acompanhamento do Transferegov.
        </p>
        <p className="mp-fiscal-aviso">
          Uso interno da PONTE. Tomada de contas especial instaurada é o órgão apurando dano ao erário; quem julga é o TCU, e
          &quot;processo autuado&quot; não é condenação. Impugnação é o concedente recusando parte da comprovação. Nenhum nome de
          responsável aparece aqui.
        </p>
      </div>

      {leitura ? (
        <SecaoTce leitura={leitura} />
      ) : (
        <p className="pa-cartao pa-cartao-plano">
          O sistema e-TCE do TCU ainda não foi consultado: as tomadas de contas especiais aparecem depois da primeira consulta semanal.
        </p>
      )}
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
          Tomadas de contas especiais no TCU
        </h2>
        <p className="pa-nota">
          Consulta de {execucao.referencia ? formatarData(execucao.referencia) : "—"}: {n(num(c.tcu_consultados))} convênios consultados
          {num(c.tcu_erros) > 0 ? `, ${n(num(c.tcu_erros))} sem resposta` : ""}
          {num(c.tcu_nao_consultados) > 0 ? `, ${n(num(c.tcu_nao_consultados))} para a próxima consulta semanal` : ""}. A aba &quot;TCE&quot; do
          convênio no Transferegov fica vazia mesmo quando há tomada de contas especial, porque o processo hoje corre no e-TCE.
        </p>
        <div className="pa-grade pa-grade-4 mp-painel-cartoes">
          <Cartao
            titulo="Convênios com tomada de contas especial"
            numero={n(convenios)}
            nota={`${n(linhas.length)} ${linhas.length === 1 ? "tomada de contas especial" : "tomadas de contas especiais"} no total`}
          />
          <Cartao titulo="Municípios" numero={n(municipios.length)} nota="com ao menos um convênio em tomada de contas especial" />
          <Cartao
            titulo="Débito original"
            numero={moedaCurta(original)}
            nota={`soma do valor apurado na instauração${semOriginal ? ` (${n(semOriginal)} sem o original informado)` : ""}`}
          />
          <Cartao titulo="Débito com juros" numero={moedaCurta(comJuros)} nota="atualizado pelo TCU, na data de cada processo" />
        </div>
        {municipios.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhuma tomada de contas especial nos {n(num(c.tcu_consultados))} convênios da PB consultados em{" "}
            {execucao.referencia ? formatarData(execucao.referencia) : "—"}.
          </p>
        ) : (
          <TabelaFiltravel
            id="tce-municipios"
            rotulo="Municípios com tomada de contas especial"
            colunas={COLUNAS_MUNICIPIOS}
            linhas={municipios.map(linhaMunicipio)}
            ordemPadrao={{ coluna: "com-juros", sentido: "desc" }}
            csv={{ nome: "contas-tce-municipios" }}
          />
        )}
      </section>

      {ordenadas.length > 0 && (
        <section aria-labelledby="contas-lista" className="mp-radar-secao">
          <h2 id="contas-lista" className="mp-radar-h2">
            As tomadas de contas especiais, uma a uma
          </h2>
          <TabelaFiltravel
            id="tce-lista"
            rotulo="As tomadas de contas especiais, uma a uma"
            colunas={COLUNAS_TCE}
            linhas={ordenadas.map(linhaTce)}
            ordemPadrao={{ coluna: "instaurada", sentido: "desc" }}
            csv={{ nome: "contas-tomadas-de-contas-especiais" }}
          />
          <p className="pa-nota">
            Fonte: API pública do sistema e-TCE do TCU (tce.apps.tcu.gov.br), uma consulta por convênio, toda semana. Entram os convênios
            assinados da PB na última atualização diária do painel, menos os anulados e cancelados. Tomada de contas especial com situação
            &quot;Excluída&quot; não aparece.
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
        {linhas.length === 0
          ? "Nenhum convênio da PB em prestação de contas com valor impugnado no SIAFI (sistema financeiro da União)"
          : `${n(linhas.length)} convênios em prestação de contas com valor impugnado no SIAFI (sistema financeiro da União), somando ${moedaCurta(total)}`}{" "}
        (coleta do Acesso Livre{referencia ? ` de ${formatarData(referencia)}` : ""}).
      </p>
      {linhas.length > 0 && (
        <TabelaFiltravel
          id="impugnacoes"
          rotulo="Impugnações na prestação de contas"
          colunas={COLUNAS_IMPUGNACOES}
          linhas={linhas.map(linhaImpugnacao)}
          ordemPadrao={{ coluna: "impugnado", sentido: "desc" }}
          csv={{ nome: "contas-impugnacoes" }}
        />
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
        {paradas.length === 0
          ? "Nenhuma obra em execução paralisada ou atrasada"
          : `${n(paradas.length)} obras em execução paralisadas ou atrasadas`}{" "}
        há {DIAS_SEM_MEDICAO_MODERADO} dias ou mais sem medição, pelo módulo de acompanhamento de obras do Transferegov (coleta
        {referencia ? ` de ${formatarData(referencia)}` : ""}).
      </p>
      {paradas.length > 0 && (
        <TabelaFiltravel
          id="obras"
          rotulo="Obras paradas no acompanhamento"
          colunas={COLUNAS_OBRAS}
          linhas={paradas.map(linhaObra)}
          descricaoOrdemPadrao="as paralisadas primeiro, depois as há mais tempo sem medição"
          csv={{ nome: "contas-obras-paradas" }}
        />
      )}
    </section>
  );
}

// ================================================================ as tabelas (onda 15, fase 2, lote C, 13/10/2026)

/** O convênio com o link do laudo e uma linha miúda embaixo, como as quatro listas sempre desenharam. */
function celulaConvenio(nr: string, miudo: ReactNode): ReactNode {
  return (
    <>
      <LinkMapa href={`${urlInstrumento(nr)}/laudo`}>{nr}</LinkMapa>
      {miudo ? (
        <>
          <br />
          <span className="mp-laudo-miudo">{miudo}</span>
        </>
      ) : null}
    </>
  );
}

/** O proponente e, embaixo, o município (e o que mais a lista juntar). */
function celulaProponente(proponente: string | null, miudo: string): ReactNode {
  return (
    <>
      {proponente ?? "—"}
      <br />
      <span className="mp-laudo-miudo">{miudo}</span>
    </>
  );
}

const COLUNAS_MUNICIPIOS: ColunaTabela[] = [
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "convenios", titulo: "Convênios", tipo: "numero", alinhar: "direita" },
  { id: "tces", titulo: "Tomadas de contas especiais", tipo: "numero", alinhar: "direita" },
  { id: "debito-original", titulo: "Débito original", tipo: "numero", alinhar: "direita" },
  { id: "com-juros", titulo: "Com juros", tipo: "numero", alinhar: "direita" },
];

function linhaMunicipio(m: MunicipioTce): LinhaTabela {
  return {
    chave: m.municipio,
    valores: {
      municipio: m.municipio,
      convenios: m.convenios,
      tces: m.tces,
      // Sem nenhum débito original informado no município, vazio, como a célula ("—").
      "debito-original": m.temOriginal ? m.debitoOriginal : null,
      "com-juros": m.debitoComJuros,
    },
    celulas: {
      "debito-original": m.temOriginal ? moedaCurta(m.debitoOriginal) : "—",
      "com-juros": moedaCurta(m.debitoComJuros),
    },
  };
}

const COLUNAS_TCE: ColunaTabela[] = [
  { id: "convenio", titulo: "Convênio", tipo: "texto", textoNoCsv: true },
  { id: "situacao-convenio", titulo: "Situação do convênio", tipo: "categoria", oculta: true },
  { id: "proponente", titulo: "Proponente", tipo: "texto" },
  { id: "municipio", titulo: "Município", tipo: "texto", oculta: true },
  { id: "orgao", titulo: "Órgão superior", tipo: "categoria", oculta: true },
  { id: "instaurada", titulo: "Instaurada", tipo: "data" },
  { id: "ano", titulo: "Ano da tomada de contas", tipo: "numero", oculta: true },
  { id: "motivo", titulo: "Motivo", tipo: "categoria" },
  { id: "submotivo", titulo: "Submotivo", tipo: "texto", oculta: true },
  { id: "debito-original", titulo: "Débito original", tipo: "numero", alinhar: "direita" },
  { id: "com-juros", titulo: "Com juros", tipo: "numero", alinhar: "direita" },
  { id: "atualizado", titulo: "Débito atualizado em", tipo: "data", oculta: true },
  { id: "processo", titulo: "Processo", tipo: "texto", textoNoCsv: true },
  { id: "situacao", titulo: "Situação no TCU", tipo: "categoria", oculta: true },
];

function linhaTce(t: LinhaTcePainel, k: number): LinhaTabela {
  return {
    chave: `${t.nr_convenio}-${t.codigo ?? k}`,
    valores: {
      convenio: t.nr_convenio,
      "situacao-convenio": t.situacao_convenio,
      proponente: t.proponente,
      municipio: t.municipio,
      orgao: t.orgao_sup,
      instaurada: t.dt_instauracao,
      ano: t.ano,
      motivo: t.motivo,
      submotivo: t.submotivo,
      "debito-original": t.debito_original,
      "com-juros": t.debito_com_juros,
      atualizado: t.dt_atualizacao_debito,
      processo: t.numero_processo ? `TC ${t.numero_processo}` : null,
      situacao: t.situacao,
    },
    celulas: {
      convenio: celulaConvenio(t.nr_convenio, t.situacao_convenio ?? ""),
      proponente: celulaProponente(t.proponente, [t.municipio, t.orgao_sup].filter(Boolean).join(" · ")),
      // Sem a data, o ano da tomada (célula própria: o ano não leva ponto de milhar).
      instaurada: t.dt_instauracao ? formatarData(t.dt_instauracao) : t.ano !== null ? String(t.ano) : "—",
      motivo: (
        <>
          {t.motivo ?? "—"}
          {t.submotivo ? <span className="mp-laudo-miudo"> · {t.submotivo}</span> : null}
        </>
      ),
      "debito-original": t.debito_original !== null ? moedaExata(t.debito_original) : "—",
      "com-juros": (
        <>
          {t.debito_com_juros !== null ? moedaExata(t.debito_com_juros) : "—"}
          {t.dt_atualizacao_debito ? <span className="mp-laudo-miudo"> em {formatarData(t.dt_atualizacao_debito)}</span> : null}
        </>
      ),
      processo: (
        <>
          {t.numero_processo ? (
            t.url_processo ? (
              <a href={t.url_processo} target="_blank" rel="noopener noreferrer">
                TC {t.numero_processo}
                <span className="pa-sr"> (abre o processo no TCU em nova aba)</span>
              </a>
            ) : (
              `TC ${t.numero_processo}`
            )
          ) : (
            "—"
          )}
          <br />
          <span className="mp-laudo-miudo">{t.situacao ?? ""}</span>
        </>
      ),
    },
  };
}

const COLUNAS_IMPUGNACOES: ColunaTabela[] = [
  { id: "convenio", titulo: "Convênio", tipo: "texto", textoNoCsv: true },
  { id: "situacao-convenio", titulo: "Situação do convênio", tipo: "categoria", oculta: true },
  { id: "proponente", titulo: "Proponente", tipo: "texto" },
  { id: "municipio", titulo: "Município", tipo: "texto", oculta: true },
  { id: "comprovado", titulo: "Comprovado", tipo: "numero", alinhar: "direita" },
  { id: "aprovado", titulo: "Aprovado", tipo: "numero", alinhar: "direita" },
  { id: "impugnado", titulo: "Impugnado", tipo: "numero", alinhar: "direita" },
  { id: "parecer", titulo: "Último parecer", tipo: "texto" },
  { id: "parecer-data", titulo: "Data do último parecer", tipo: "data", oculta: true },
];

function linhaImpugnacao(l: LinhaImpugnacao): LinhaTabela {
  const moeda = (v: number | null) => (v !== null ? moedaContas(v) : "—");
  return {
    chave: l.nr_convenio,
    valores: {
      convenio: l.nr_convenio,
      "situacao-convenio": l.situacao_convenio,
      proponente: l.proponente,
      municipio: l.municipio,
      comprovado: l.valor_comprovado,
      aprovado: l.valor_aprovado,
      impugnado: l.valor_impugnado,
      parecer: l.parecer_situacao,
      "parecer-data": l.parecer_data,
    },
    celulas: {
      convenio: celulaConvenio(l.nr_convenio, l.situacao_convenio ?? ""),
      proponente: celulaProponente(l.proponente, l.municipio ?? ""),
      comprovado: moeda(l.valor_comprovado),
      aprovado: moeda(l.valor_aprovado),
      impugnado: moeda(l.valor_impugnado),
      parecer: l.parecer_situacao ? `${l.parecer_situacao}${l.parecer_data ? ` (${formatarData(l.parecer_data)})` : ""}` : "—",
    },
  };
}

const COLUNAS_OBRAS: ColunaTabela[] = [
  { id: "convenio", titulo: "Convênio", tipo: "texto", textoNoCsv: true },
  { id: "situacao-obra", titulo: "Situação da obra", tipo: "categoria", oculta: true },
  { id: "proponente", titulo: "Proponente", tipo: "texto" },
  { id: "municipio", titulo: "Município", tipo: "texto", oculta: true },
  { id: "sem-medicao", titulo: "Sem medição (dias)", tipo: "numero", alinhar: "direita" },
  { id: "medicoes", titulo: "Medições", tipo: "numero", alinhar: "direita" },
  { id: "convenente", titulo: "Atestado convenente (%)", tipo: "numero", alinhar: "direita" },
  { id: "concedente", titulo: "Atestado concedente (%)", tipo: "numero", alinhar: "direita" },
];

function linhaObra(o: LinhaObraParada): LinhaTabela {
  return {
    chave: o.nr_convenio,
    valores: {
      convenio: o.nr_convenio,
      // A lista só tem obra paralisada ou atrasada (`obrasParadas`).
      "situacao-obra": o.paralisado ? "paralisada" : "atrasada",
      proponente: o.proponente,
      municipio: o.municipio,
      "sem-medicao": o.dias_sem_medicao,
      medicoes: o.ultima_medicao,
      convenente: o.pct_convenente,
      concedente: o.pct_concedente,
    },
    celulas: {
      convenio: celulaConvenio(o.nr_convenio, o.paralisado ? "paralisada" : null),
      proponente: celulaProponente(o.proponente, o.municipio ?? ""),
      "sem-medicao": o.dias_sem_medicao !== null ? `${n(o.dias_sem_medicao)} dias` : "—",
      medicoes: o.ultima_medicao ?? "—",
      convenente: pct(o.pct_convenente),
      concedente: pct(o.pct_concedente),
    },
  };
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
