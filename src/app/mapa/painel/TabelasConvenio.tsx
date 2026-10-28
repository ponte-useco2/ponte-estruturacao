/**
 * As listas do painel como tabelas com filtro e ordem em cada coluna (onda 15, fase 3, F3.1a, 20/10/2026): as seis
 * visões de convênio, as mudanças e as propostas. As colunas e os valores crus moram em `painel-tabelas.ts`; aqui ficam
 * as células, com o mesmo desenho das peças de antes (`Pecas.tsx`): a nota que junta proponente, lugar, número e laudo,
 * as etiquetas e a marca ▲ de urgência.
 *
 * Por enquanto só a ficha do município as usa, com todas as linhas na página. O painel troca as peças antigas por
 * estas na F3.2, quando o filtro for à consulta.
 */
import type { ReactNode } from "react";
import { urlLaudo } from "@/lib/oportunidades/busca";
import { formatarData } from "@/lib/oportunidades/central";
import {
  ROTULO_DESFECHO,
  ROTULO_EXIGENCIA,
  ROTULO_FONTE_MOVIMENTACAO,
  ROTULO_MOTIVO_ADITIVO,
  definicaoMudanca,
  descreverMudanca,
  diaDoDado,
  exigenciasDe,
  idadePorExtenso,
  percentual,
  prazoPorExtenso,
  urlFicha,
  vezDaProposta,
  type MudancaPainel,
  type PropostaPainel,
} from "@/lib/oportunidades/painel";
import type { ConvenioPainel } from "@/lib/oportunidades/painel.server";
import {
  colunasDaVisao,
  colunasNoBanco,
  colunasMudancas,
  colunasMudancasNoBanco,
  colunasPropostas,
  ondeParou,
  valoresDaMudanca,
  valoresDaProposta,
  valoresDoConvenioPainel,
  type VisaoConvenio,
} from "@/lib/oportunidades/painel-tabelas";
import { moedaCurta } from "@/lib/oportunidades/radar";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../_design/primitivos";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaFiltravel, type ModoServidor } from "../_componentes/TabelaFiltravel";
import { CopiarNumero } from "./CopiarNumero";
import { Urgente, palavraDoPrazo } from "./Pecas";

/** A nota "Proponente e convênio": na ficha, o município é o da página e não vira link. */
function NotaConvenio({ c, naFicha }: { c: ConvenioPainel; naFicha?: boolean }) {
  const lugar = `${c.municipio ?? "—"}/${c.uf ?? "—"}`;
  return (
    <>
      <span className="mp-tabela-principal">{c.proponente ?? "—"}</span>
      <span className="mp-tabela-secundario">
        {!naFicha && c.cod_ibge ? <LinkMapa href={urlFicha({ ibge: c.cod_ibge })}>{lugar}</LinkMapa> : lugar} · nº {c.nr_convenio}{" "}
        <CopiarNumero numero={c.nr_convenio} />
        {" · "}
        <LinkMapa href={urlLaudo(c.nr_convenio)}>ver o laudo</LinkMapa>
      </span>
      {c.dias_sem_movimentacao !== null && c.dias_sem_movimentacao !== undefined && (
        <span className={`mp-tabela-secundario${c.dias_sem_movimentacao > 365 ? " mp-painel-urgente" : ""}`}>
          {c.dias_sem_movimentacao > 365 && (
            <>
              <Urgente palavra="parado" />
              {" · "}
            </>
          )}
          último movimento há {idadePorExtenso(c.dias_sem_movimentacao)}
          {c.ultima_movimentacao_tipo ? ` (${ROTULO_FONTE_MOVIMENTACAO[c.ultima_movimentacao_tipo] ?? c.ultima_movimentacao_tipo})` : ""}
        </span>
      )}
    </>
  );
}

/** A nota "Programa e órgão", com o objeto embaixo. */
function NotaPrograma({ programa, orgao, objeto, codigo }: { programa: string | null; orgao: string | null; objeto?: string | null; codigo?: ReactNode }) {
  return (
    <>
      <span className="mp-tabela-principal mp-painel-programa">{programa ?? "—"}</span>
      <span className="mp-tabela-secundario">
        {codigo}
        {orgao ?? "—"}
      </span>
      {objeto && <span className="mp-tabela-secundario mp-painel-objeto">{objeto}</span>}
    </>
  );
}

/** Data com a frase do prazo embaixo, e a marca ▲ quando o prazo é curto ou venceu. */
function DataComPrazo({ data, dias, limite, frase }: { data: string | null; dias: number | null; limite: number; frase: string }) {
  const urgente = (dias ?? 999) <= limite;
  return (
    <span className="mp-nowrap">
      <span className="mp-tabela-principal">{data ? formatarData(data) : "—"}</span>
      <span className={`mp-tabela-secundario${urgente ? " mp-painel-urgente" : ""}`}>
        {urgente && (
          <>
            <Urgente palavra={palavraDoPrazo(dias)} />
            {" · "}
          </>
        )}
        {frase}
      </span>
    </span>
  );
}

/** As células que precisam de desenho em cada visão; o resto sai do valor cru. */
function celulasDaVisao(c: ConvenioPainel, v: VisaoConvenio, naFicha?: boolean): Record<string, ReactNode> {
  const base: Record<string, ReactNode> = {
    proponente: <NotaConvenio c={c} naFicha={naFicha} />,
    programa: <NotaPrograma programa={c.programa} orgao={c.orgao_sup} objeto={c.objeto} />,
    repasse: moedaCurta(c.repasse),
  };
  switch (v) {
    case "suspensiva": {
      const ex = exigenciasDe(c);
      return {
        ...base,
        prazo: (
          <DataComPrazo
            data={c.suspensiva_prazo}
            dias={c.suspensiva_dias}
            limite={30}
            frase={(c.suspensiva_dias ?? 0) < -60 ? `venceu há ${idadePorExtenso(-(c.suspensiva_dias ?? 0))}` : prazoPorExtenso(c.suspensiva_dias)}
          />
        ),
        exigencias: (
          <span className="mp-painel-tags">
            {ex.map((e) => (
              <Tag key={e}>{ROTULO_EXIGENCIA[e]}</Tag>
            ))}
            {ex.length === 0 && "—"}
          </span>
        ),
      };
    }
    case "nunca":
      return {
        ...base,
        assinatura: <span className="mp-nowrap">{c.dt_assinatura ? formatarData(c.dt_assinatura) : "—"}</span>,
        "onde-parou": (
          <>
            <span className="mp-tabela-principal">{ondeParou(c) ?? "—"}</span>
            {c.dt_aceite && (
              <span className={`mp-tabela-secundario${c.aceite_parado ? " mp-painel-urgente" : ""}`}>
                {c.aceite_parado && (
                  <>
                    <Urgente palavra="parado" />
                    {" · "}
                  </>
                )}
                aceite em {formatarData(c.dt_aceite)}
              </span>
            )}
          </>
        ),
        empenhado: moedaCurta(c.empenhado),
      };
    case "vigencia":
      return {
        ...base,
        "fim-vigencia": (
          <DataComPrazo
            data={c.dt_fim_vigencia}
            dias={c.dias_para_fim}
            limite={90}
            frase={prazoPorExtenso(c.dias_para_fim, { futuro: "termina", passado: "terminou" })}
          />
        ),
        "desembolsado-pct": percentual(c.pct_desembolsado),
        extensoes: (
          <>
            {c.n_extensoes ?? 0}
            {c.motivo_aditivo && (
              <span className="mp-tabela-secundario mp-painel-motivo">{ROTULO_MOTIVO_ADITIVO[c.motivo_aditivo] ?? c.motivo_aditivo}</span>
            )}
          </>
        ),
        "a-desembolsar": moedaCurta(Math.max((c.repasse ?? 0) - (c.desembolsado ?? 0), 0)),
      };
    case "contas":
      return {
        ...base,
        situacao: (
          <>
            <span className="mp-tabela-principal">{c.situacao ?? "—"}</span>
            {c.contas_lado === "concedente" && c.dias_com_concedente !== null && (
              <span className="mp-tabela-secundario">com o concedente há {idadePorExtenso(c.dias_com_concedente)}</span>
            )}
          </>
        ),
        "prazo-contas": (
          <span className="mp-nowrap">
            {c.dias_apos_limite === null
              ? "—"
              : c.dias_apos_limite > 0
                ? `venceu há ${idadePorExtenso(c.dias_apos_limite)}`
                : prazoPorExtenso(-c.dias_apos_limite)}
          </span>
        ),
      };
    case "saldo":
      return {
        ...base,
        "ultimo-pagamento": <span className="mp-nowrap">{c.dt_ultimo_pagamento ? formatarData(c.dt_ultimo_pagamento) : "nunca pagou"}</span>,
        parado: <span className="mp-nowrap">{idadePorExtenso(c.dias_sem_movimento)}</span>,
        saldo: moedaCurta(c.saldo_conta),
        rendimento: moedaCurta(c.rendimento_implicito),
      };
    case "fisico":
      return {
        ...base,
        "desembolsado-pct": percentual(c.pct_desembolsado),
        "fisico-pct": (
          <span className={(c.pct_fisico ?? 1) === 0 ? "mp-painel-urgente" : undefined}>
            {percentual(c.pct_fisico)}
            {(c.pct_fisico ?? 1) === 0 && <Urgente palavra="zerado" />}
          </span>
        ),
        "fim-vigencia": (
          <span className="mp-nowrap">
            <span className="mp-tabela-principal">{c.dt_fim_vigencia ? formatarData(c.dt_fim_vigencia) : "—"}</span>
            <span className="mp-tabela-secundario">{prazoPorExtenso(c.dias_para_fim, { futuro: "termina", passado: "terminou" })}</span>
          </span>
        ),
        desembolsado: moedaCurta(c.desembolsado),
      };
  }
}

/** Uma visão de convênio como tabela com filtro. As linhas chegam na ordem da consulta, que é a ordem padrão. */
export function TabelaDaVisao({
  id,
  rotulo,
  visao,
  linhas,
  naFicha,
  descricaoOrdemPadrao,
  csv,
  servidor,
}: {
  id: string;
  rotulo: string;
  visao: VisaoConvenio;
  linhas: ConvenioPainel[];
  naFicha?: boolean;
  descricaoOrdemPadrao: string;
  csv?: { nome: string };
  /** No painel (F3.2): as linhas já vêm filtradas e ordenadas pelo banco. */
  servidor?: ModoServidor;
}) {
  const tabela: LinhaTabela[] = linhas.map((c) => ({
    chave: c.nr_convenio,
    valores: valoresDoConvenioPainel(c, visao),
    celulas: celulasDaVisao(c, visao, naFicha),
  }));
  return (
    <TabelaFiltravel
      id={id}
      rotulo={rotulo}
      colunas={servidor ? colunasNoBanco(visao) : colunasDaVisao(visao, { comMunicipio: !naFicha })}
      linhas={tabela}
      descricaoOrdemPadrao={descricaoOrdemPadrao}
      csv={csv}
      servidor={servidor}
    />
  );
}

const TOM_GRUPO = { avanco: "aderente", alerta: "urgente", registro: "neutro" } as const;

/** O que mudou, uma linha por evento. Com `comData`, a coluna do dia (períodos de mais de um dia). */
export function TabelaDasMudancas({
  id,
  rotulo,
  linhas,
  naFicha,
  comData,
  csv,
  servidor,
}: {
  id: string;
  rotulo: string;
  linhas: MudancaPainel[];
  naFicha?: boolean;
  comData?: boolean;
  csv?: { nome: string };
  /** No painel (F3.5a): as linhas já vêm filtradas e ordenadas pelo banco. */
  servidor?: ModoServidor;
}) {
  const tabela: LinhaTabela[] = linhas.map((m) => {
    const def = definicaoMudanca(m.tipo);
    const lugar = `${m.municipio ?? "—"}/${m.uf ?? "—"}`;
    const frase = descreverMudanca(m);
    return {
      chave: `${m.dado_ate}-${m.tipo}-${m.chave}`,
      valores: valoresDaMudanca(m),
      celulas: {
        quem: (
          <>
            <span className="mp-tabela-principal">{m.proponente ?? "—"}</span>
            <span className="mp-tabela-secundario">
              {!naFicha && m.cod_ibge ? <LinkMapa href={urlFicha({ ibge: m.cod_ibge })}>{lugar}</LinkMapa> : lugar} ·{" "}
              {m.alvo === "proposta" ? "proposta" : "convênio"} nº {m.numero ?? m.chave} {m.numero && <CopiarNumero numero={m.numero} />}
            </span>
          </>
        ),
        mudanca: (
          <>
            <Tag tom={TOM_GRUPO[def.grupo]}>{def.rotulo}</Tag>
            {frase && <span className="mp-tabela-secundario">{frase}</span>}
          </>
        ),
        programa: <NotaPrograma programa={m.programa} orgao={m.orgao_sup} objeto={m.objeto} />,
        valor: moedaCurta(m.valor),
        dia: diaDoDado(m.dado_ate),
      },
    };
  });
  return (
    <TabelaFiltravel
      id={id}
      rotulo={rotulo}
      colunas={servidor ? colunasMudancasNoBanco(comData ?? false) : colunasMudancas({ comMunicipio: !naFicha, comData })}
      linhas={tabela}
      descricaoOrdemPadrao={servidor ? "do dado mais recente para o mais antigo e, no mesmo dia, pelo valor" : "das mais recentes para as mais antigas"}
      csv={csv}
      servidor={servidor}
    />
  );
}

/** As propostas da ficha: sem desfecho e negadas pelo último movimento; assinadas pela assinatura. */
export function TabelaDasPropostas({
  id,
  rotulo,
  linhas,
  quando,
  descricaoOrdemPadrao,
  csv,
}: {
  id: string;
  rotulo: string;
  linhas: PropostaPainel[];
  quando: "movimento" | "assinatura";
  descricaoOrdemPadrao: string;
  csv?: { nome: string };
}) {
  const tabela: LinhaTabela[] = linhas.map((p) => {
    const vez = vezDaProposta(p.desfecho);
    const comPrograma = p.cod_programa && p.cod_programa !== "(sem programa)";
    return {
      chave: p.id_proposta,
      valores: valoresDaProposta(p, quando),
      celulas: {
        proponente: (
          <>
            <span className="mp-tabela-principal">{p.proponente ?? "—"}</span>
            <span className="mp-tabela-secundario">
              {p.nr_proposta ? (
                <>
                  nº {p.nr_proposta} <CopiarNumero numero={p.nr_proposta} de="proposta" />
                </>
              ) : (
                `id ${p.id_proposta}`
              )}
              {p.dt_envio ? ` · enviada em ${formatarData(p.dt_envio)}` : ""}
            </span>
            {p.objeto && <span className="mp-tabela-secundario mp-painel-objeto">{p.objeto}</span>}
          </>
        ),
        programa: (
          <NotaPrograma
            programa={p.programa}
            orgao={p.orgao_sup}
            codigo={
              comPrograma ? (
                <>
                  cód. {p.cod_programa} <CopiarNumero numero={p.cod_programa as string} de="programa" /> ·{" "}
                </>
              ) : null
            }
          />
        ),
        situacao: (
          <>
            <span className="mp-painel-tags">
              <span className="mp-tabela-principal">{ROTULO_DESFECHO[p.desfecho] ?? p.desfecho}</span>
              {p.em_lote && <Tag>em lote</Tag>}
              {p.com_emenda && <Tag>emenda</Tag>}
              {vez && <Tag tom="proto">vez do {vez}</Tag>}
            </span>
            {p.limbo && (
              <span className="mp-tabela-secundario mp-painel-urgente">
                <Urgente palavra="nunca analisada" />
              </span>
            )}
          </>
        ),
        ...(quando === "assinatura"
          ? {
              assinatura: (
                <span className="mp-nowrap">
                  {p.dt_assinatura ? formatarData(p.dt_assinatura) : "—"}
                  {p.nr_convenio && <span className="mp-tabela-secundario">convênio {p.nr_convenio}</span>}
                </span>
              ),
            }
          : {
              movimento: (
                <span className="mp-nowrap">
                  {p.dt_ultimo_evento ? formatarData(p.dt_ultimo_evento) : "—"}
                  {p.dias_sem_evento !== null && (
                    <span className={`mp-tabela-secundario${vez && p.dias_sem_evento > 90 ? " mp-painel-urgente" : ""}`}>
                      {vez && p.dias_sem_evento > 90 && (
                        <>
                          <Urgente palavra="parada" />
                          {" · "}
                        </>
                      )}
                      há {idadePorExtenso(p.dias_sem_evento)}
                    </span>
                  )}
                </span>
              ),
            }),
        repasse: moedaCurta(p.valor_repasse),
      },
    };
  });
  return (
    <TabelaFiltravel
      id={id}
      rotulo={rotulo}
      colunas={colunasPropostas(quando)}
      linhas={tabela}
      descricaoOrdemPadrao={descricaoOrdemPadrao}
      csv={csv}
    />
  );
}
