/**
 * Lista dos convênios em cláusula suspensiva da última coleta, do mais urgente ao menos.
 * O prazo da suspensiva manda na ordem (é ele que extingue o instrumento); o tempo parado desempata.
 *
 * Onda 15, fase 2, lote C (13/10/2026): a lista é a `TabelaFiltravel`, com filtro e ordem em cada coluna (a regra do
 * titular; tela de administrador, toda coluna ordena). Os chips de prazo e de órgão (GET) só filtravam colunas desta
 * lista: o filtro da tabela os substitui. O prazo virou a coluna oculta "Urgência do prazo", com as mesmas faixas da cor
 * da data, e o órgão é a coluna "Órgão". O link antigo (`?prazo=`, `?orgao=`) redireciona para a forma nova
 * (`urlSuspensivasDoFiltroAntigo`, em `padroes.ts`, com as colunas e os valores crus). Os cartões contam a fila
 * inteira: o filtro mora na tabela, que diz quantos mostra.
 *
 * Diagnóstico externo de 17/11/2026 (A06): duas fontes com datas diferentes. O andamento, a vez e o "parado desde" são
 * da coleta do Acesso Livre; o prazo, a retirada, o repasse e a situação, do painel diário. A tela diz as três datas, e
 * quem o painel já dá como fora da suspensiva (`separarSuspensivas`) sai dos cartões, da tabela, da mediana e do CSV e
 * vai para uma seção própria, sem "parado há".
 */
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ORIGEM_SUSPENSIVAS } from "@/lib/oportunidades/abas";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import { compararUrgencia, diaBrasilia, diasEntre, nivelPrazo } from "@/lib/oportunidades/laudo";
import type { LeituraSuspensivas, LinhaSuspensiva } from "@/lib/oportunidades/laudo.server";
import {
  COLUNAS_SUSPENSIVAS,
  COLUNAS_SUSPENSIVAS_SAIDAS,
  TABELA_SUSPENSIVAS,
  TABELA_SUSPENSIVAS_SAIDAS,
  separarSuspensivas,
  tituloOrgao,
  urlSuspensivasDoFiltroAntigo,
  valoresDaSaida,
  valoresDaSuspensiva,
  type SaidaSuspensiva,
} from "@/lib/oportunidades/padroes";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaFiltravel } from "../_componentes/TabelaFiltravel";
import { Termo } from "../_componentes/Termo";

type LeituraOk = Extract<LeituraSuspensivas, { estado: "ok" }>;
interface Filtro {
  prazo: string | null;
  orgao: string | null;
}

const n = (x: number) => x.toLocaleString("pt-BR");
const dias = (x: number) => `${n(x)} ${Math.abs(x) === 1 ? "dia" : "dias"}`;
// `de`: a origem mantém a aba Suspensivas acesa no laudo (lib/oportunidades/abas.ts).
const urlLaudo = (nr: string) => `/mapa/instrumento/${encodeURIComponent(nr)}/laudo?de=${ORIGEM_SUSPENSIVAS}`;

export function SuspensivasConteudo({ leitura, hoje, filtro }: { leitura: LeituraOk; hoje: string; filtro: Filtro }) {
  const referencia = diaBrasilia(leitura.referencia ?? leitura.coletadoEm ?? hoje);
  const todas = leitura.linhas;

  // O link de antes (`?prazo=urgente&orgao=…`) vira o filtro da tabela (onda 15, fase 2, lote C, 13/10/2026). Como
  // antes, valor desconhecido não filtra: o órgão só vale se estiver na coleta.
  const orgaosDaColeta = [...new Set(todas.map((l) => l.contexto?.orgao_sup).filter((o): o is string => !!o))];
  const novo = urlSuspensivasDoFiltroAntigo(filtro, orgaosDaColeta);
  if (novo) redirect(novo);

  // A06 (17/11/2026): só a fila conta nos cartões, na tabela, na mediana e no CSV; quem o painel já dá como fora vai abaixo.
  const { fila, saidas } = separarSuspensivas(todas);
  const linhas = [...fila].sort((a, b) => compararUrgencia(urgencia(a), urgencia(b), hoje));
  const painelEm = leitura.painelReferencia ? formatarData(leitura.painelReferencia) : null;

  const parado = linhas.reduce((s, l) => s + Math.max(0, (l.contexto?.vl_repasse ?? 0) - (l.contexto?.vl_desembolsado ?? 0)), 0);
  const vencidos = linhas.filter((l) => l.contexto?.dt_suspensiva && !l.contexto.dt_retirada_suspensiva && l.contexto.dt_suspensiva < hoje).length;
  const esperas = linhas.filter((l) => l.parado_desde).map((l) => diasEntre(l.parado_desde as string, referencia)).sort((a, b) => a - b);
  const mediana = esperas.length ? esperas[Math.floor(esperas.length / 2)] : null;

  return (
    <div className="pa-pagina mp-radar mp-suspensivas">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Cláusulas suspensivas · Paraíba</p>
        <h1 className="pa-titulo">Convênios esperando a retirada da suspensiva</h1>
        <p className="pa-sub">
          Convênios assinados com <Termo slug="condicao-suspensiva">condição suspensiva</Termo>, do prazo mais apertado ao mais
          folgado; no mesmo prazo, quem está parado há mais tempo vem antes. Cada linha abre o laudo do convênio.
        </p>
        <p className="pa-nota">
          Estado conhecido em {formatarData(referencia)} (Acesso Livre)
          {painelEm ? ` · Última confirmação pelo painel diário em ${painelEm}` : ""} · Prazos contados até {formatarData(hoje)}
        </p>
        <p className="mp-nao-imprimir mp-laudo-acoes">
          <LinkMapa href="/mapa/suspensivas/padroes" className="pa-btn pa-btn-pequeno">
            Ver os padrões: destino, tempo e quem analisa
          </LinkMapa>
          <LinkMapa href="/mapa/suspensivas/checklist" className="pa-btn pa-btn-pequeno">
            Abrir o checklist preventivo
          </LinkMapa>
        </p>
      </div>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">Convênios</h2>
          <p className="pa-numero">{n(linhas.length)}</p>
          <p className="pa-nota">
            na coleta, sem saída registrada no painel diário
            {saidas.length > 0 ? ` · ${n(saidas.length)} já fora da suspensiva (abaixo)` : ""}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Repasse sem desembolso</h2>
          <p className="pa-numero">{moedaCurta(parado)}</p>
          <p className="pa-nota">{n(vencidos)} com o prazo da suspensiva já vencido</p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Parados há</h2>
          <p className="pa-numero">{mediana !== null ? dias(mediana) : "—"}</p>
          <p className="pa-nota">mediana, contada até a coleta de {formatarData(referencia)}</p>
        </article>
      </div>

      <section aria-labelledby="suspensivas-lista" className="mp-radar-secao">
        <h2 id="suspensivas-lista" className="mp-radar-h2">
          Todos os convênios
        </h2>
        {linhas.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum convênio em suspensiva na coleta.</p>
        ) : (
          <>
            <p className="pa-nota">
              “Filtrar e ordenar” filtra por qualquer coluna, também pela urgência do prazo (vencido ou em até 30 dias, em 31 a 90 dias,
              mais de 90 dias), pelo município, pelo programa e pelos dias parado; o CSV sai só com o que está filtrado.
            </p>
            {/* A classe de antes, num invólucro: as larguras de `mp-suspensivas-tabela` (mapa.css) valem para a tabela de dentro. */}
            <div className="mp-suspensivas-tabela">
              <TabelaFiltravel
                id={TABELA_SUSPENSIVAS}
                rotulo="Convênios em suspensiva"
                colunas={COLUNAS_SUSPENSIVAS}
                linhas={linhas.map((l) => linhaSuspensiva(l, hoje, referencia))}
                descricaoOrdemPadrao="do prazo mais apertado ao mais folgado; no mesmo prazo, parado há mais tempo antes"
                csv={{ nome: "suspensivas-pb" }}
              />
            </div>
          </>
        )}
        <p className="pa-nota">
          Andamento: Acesso Livre do Transferegov, coleta de {leitura.coletadoEm ? formatarPublicacao(leitura.coletadoEm) : "data desconhecida"}. Valores,
          prazos e situação: dados abertos do Transferegov{painelEm ? `, painel diário com dados até ${painelEm}` : ""}; prazos contados até{" "}
          {formatarData(hoje)}. Os pedidos de complementação são os registrados pelo concedente.
        </p>
      </section>

      {saidas.length > 0 && (
        <section aria-labelledby="suspensivas-saidas" className="mp-radar-secao">
          <h2 id="suspensivas-saidas" className="mp-radar-h2">
            Já fora da suspensiva segundo o painel diário
          </h2>
          <p className="pa-nota">
            Estavam na coleta de {formatarData(referencia)}, mas o painel diário{painelEm ? ` (dados até ${painelEm})` : ""} registra a retirada da
            suspensiva ou outra situação. Não entram nos cartões, na mediana nem no CSV da lista acima.
          </p>
          <div className="mp-suspensivas-tabela">
            <TabelaFiltravel
              id={TABELA_SUSPENSIVAS_SAIDAS}
              rotulo="Convênios já fora da suspensiva"
              colunas={COLUNAS_SUSPENSIVAS_SAIDAS}
              linhas={[...saidas].sort(porRetirada).map(linhaSaida)}
              descricaoOrdemPadrao="a retirada mais recente primeiro; sem retirada, no fim"
              csv={{ nome: "suspensivas-pb-ja-fora" }}
            />
          </div>
        </section>
      )}
    </div>
  );
}

/** A retirada mais recente primeiro; quem saiu sem retirada (encerrou ou foi anulado) vai para o fim, pelo número. */
function porRetirada(a: SaidaSuspensiva<LinhaSuspensiva>, b: SaidaSuspensiva<LinhaSuspensiva>): number {
  const ra = a.linha.contexto?.dt_retirada_suspensiva ?? "";
  const rb = b.linha.contexto?.dt_retirada_suspensiva ?? "";
  return rb.localeCompare(ra) || a.linha.numero.localeCompare(b.linha.numero);
}

/** Uma linha de quem já saiu: o convênio, o órgão, o repasse e o que o painel diz (a retirada ou a situação). */
function linhaSaida(s: SaidaSuspensiva<LinhaSuspensiva>): LinhaTabela {
  const l = s.linha;
  const c = l.contexto;
  return {
    chave: l.numero,
    valores: valoresDaSaida(s),
    celulas: {
      convenio: (
        <>
          <LinkMapa href={urlLaudo(l.numero)} className="mp-tabela-principal">
            {c?.municipio ?? "Município não informado"} · nº {l.numero}
          </LinkMapa>
          <span className="mp-tabela-secundario">{c?.programa ?? "Programa não informado"}</span>
        </>
      ),
      orgao: c?.orgao_sup ? tituloOrgao(c.orgao_sup) : "—",
      repasse: moedaCurta(c?.vl_repasse),
      saida: c?.dt_retirada_suspensiva ? (
        <>retirada em {formatarData(c.dt_retirada_suspensiva)}</>
      ) : (
        (c?.situacao ?? "—")
      ),
    },
  };
}

/** Uma linha da lista: os valores crus de `padroes.ts` e as células de antes (onda 15, fase 2, lote C, 13/10/2026). */
function linhaSuspensiva(l: LinhaSuspensiva, hoje: string, referencia: string): LinhaTabela {
  const c = l.contexto;
  const nivel = nivelPrazo(urgencia(l), hoje);
  const prazoDias = c?.dt_suspensiva ? diasEntre(hoje, c.dt_suspensiva) : null;
  const parado = l.parado_desde ? diasEntre(l.parado_desde, referencia) : null;
  const celulas: Record<string, ReactNode> = {
    convenio: (
      <>
        <LinkMapa href={urlLaudo(l.numero)} className="mp-tabela-principal">
          {c?.municipio ?? "Município não informado"} · nº {l.numero}
        </LinkMapa>
        <span className="mp-tabela-secundario">{c?.programa ?? "Programa não informado"}</span>
      </>
    ),
    orgao: c?.orgao_sup ? tituloOrgao(c.orgao_sup) : "—",
    repasse: moedaCurta(c?.vl_repasse),
    prazo: c?.dt_retirada_suspensiva ? (
      <>retirada em {formatarData(c.dt_retirada_suspensiva)}</>
    ) : c?.dt_suspensiva ? (
      <>
        <span className={`mp-laudo-marca mp-laudo-${nivel}`}>{formatarData(c.dt_suspensiva)}</span>
        <span className="mp-tabela-secundario">
          {prazoDias === null ? "" : prazoDias < 0 ? `vencido há ${dias(-prazoDias)}` : prazoDias === 0 ? "vence hoje" : `faltam ${dias(prazoDias)}`}
        </span>
      </>
    ) : (
      "sem prazo informado"
    ),
    vez: (
      <>
        {l.vez_de === "concedente" ? "concedente" : l.vez_de === "proponente" ? "município" : "—"}
        {parado !== null && <span className="mp-tabela-secundario">há {dias(parado)}</span>}
      </>
    ),
    pedidos: n(l.rodadas_de_exigencia),
  };
  return { chave: l.numero, valores: valoresDaSuspensiva(l, hoje, referencia), celulas };
}

function urgencia(l: LinhaSuspensiva) {
  return {
    dt_suspensiva: l.contexto?.dt_suspensiva ?? null,
    dt_retirada_suspensiva: l.contexto?.dt_retirada_suspensiva ?? null,
    parado_desde: l.parado_desde,
  };
}
