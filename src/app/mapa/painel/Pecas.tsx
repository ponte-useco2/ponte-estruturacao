/**
 * Peças do painel usadas pelas visões e pela ficha do município: cartão, lista e as
 * tabelas de convênio de cada visão. Só desenham o que recebem.
 */
import type { ReactNode } from "react";
import { urlLaudo } from "@/lib/oportunidades/busca";
import { formatarData } from "@/lib/oportunidades/central";
import {
  ROTULO_ETAPA_LICITACAO,
  ROTULO_EXIGENCIA,
  ROTULO_FONTE_MOVIMENTACAO,
  ROTULO_GRUPO_SUSPENSIVA,
  ROTULO_MOTIVO_ADITIVO,
  definicaoMudanca,
  descreverMudanca,
  diaDoDado,
  exigenciasDe,
  idadePorExtenso,
  percentual,
  prazoPorExtenso,
  urlFicha,
  type MudancaPainel,
} from "@/lib/oportunidades/painel";
import type { ConvenioPainel } from "@/lib/oportunidades/painel.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Tag } from "../../_design/primitivos";
import { CopiarNumero } from "./CopiarNumero";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";

export const n = (x: number) => x.toLocaleString("pt-BR");

export function Cartao({
  rotulo,
  quantidade,
  valor,
  legenda,
  nota,
  tom,
}: {
  rotulo: string;
  quantidade: number;
  valor?: number | null;
  legenda?: string;
  nota?: ReactNode;
  tom?: "urgente";
}) {
  return (
    <article className={`pa-cartao mp-painel-cartao${tom === "urgente" ? " mp-painel-cartao-urgente" : ""}`}>
      <h3 className="pa-mono">{rotulo}</h3>
      <p className="pa-numero">{n(quantidade)}</p>
      {valor !== undefined && (
        <p className="mp-painel-valor">
          {moedaCurta(valor)}
          {legenda ? ` ${legenda}` : ""}
        </p>
      )}
      {nota && <p className="pa-nota">{nota}</p>}
    </article>
  );
}

export function Lista({
  titulo,
  vazio,
  children,
  csv,
}: {
  titulo: string;
  /**
   * O que aparece quando a lista não tem linha. B14b (08/10/2026): pode levar links (`Saidas`), para dizer o
   * recorte e como mudá-lo; o texto vai dentro de um parágrafo, então só cabe conteúdo em linha.
   */
  vazio: ReactNode;
  children: ReactNode;
  /** Endereço do CSV com todos os convênios da lista, não só os mostrados. */
  csv?: string;
}) {
  return (
    <div className="mp-radar-recorte">
      <div className="mp-painel-lista-cabeca">
        <h3 className="mp-radar-h3">{titulo}</h3>
        {csv && children ? <BotaoCsv href={csv} /> : null}
      </div>
      {children ? <TabelaRolagem rotulo={titulo}>{children}</TabelaRolagem> : <p className="pa-cartao pa-cartao-plano">{vazio}</p>}
    </div>
  );
}

/** Uma saída de estado vazio: o link que muda o recorte, com verbo no rótulo ("Ver o Brasil inteiro"). */
export interface Saida {
  rotulo: string;
  href: string;
}

/**
 * As saídas de um estado vazio das telas do administrador, em linha e separadas por " · " (B14b, 08/10/2026).
 * Antes o vazio dizia "Nenhum … neste recorte" sem dizer qual nem como mudar (B12, seção 5). Vai no fim do
 * parágrafo do vazio; sem saída, não desenha nada. Links repetidos (mesmo destino) aparecem uma vez.
 */
export function Saidas({ saidas }: { saidas: Saida[] }) {
  const unicas = saidas.filter((s, k) => saidas.findIndex((x) => x.href === s.href) === k);
  if (!unicas.length) return null;
  return (
    <>
      {" "}
      {unicas.map((s, k) => (
        <span key={s.href}>
          {k > 0 && " · "}
          <LinkMapa href={s.href}>{s.rotulo}</LinkMapa>
        </span>
      ))}
    </>
  );
}

/** Link comum para a rota de exportação: o navegador baixa o arquivo. */
// B14b (08/10/2026): o rótulo padrão diz o que baixa; o CSV traz todos os convênios da lista, não só os mostrados.
export function BotaoCsv({ href, rotulo = "Baixar todos os convênios (CSV)" }: { href: string; rotulo?: string }) {
  return (
    <a href={href} className="pa-btn pa-btn-pequeno mp-painel-csv" download>
      {rotulo}
    </a>
  );
}

/**
 * O sinal de urgência do painel: a marca ▲ e a palavra, dentro do `mp-painel-urgente` (onda 8, C, 09/10/2026; N09 da
 * auditoria R1, WCAG 1.4.1 e 1.3.1). Antes, "mais lento que o Brasil", "parado há mais de um ano", o prazo curto e o
 * físico zerado eram só o vermelho e o negrito: quem não distingue a cor, o papel em preto e branco e o leitor de tela
 * perdiam o destaque. A marca fica fora da leitura em voz alta; a palavra é lida. Na célula de número, a palavra desce
 * para a linha de baixo (mapa.css), e o número continua alinhado com os outros.
 */
export function Urgente({ palavra }: { palavra: string }) {
  return (
    <span className="mp-urgente-marca">
      <span aria-hidden="true">▲ </span>
      {palavra}
    </span>
  );
}

/** A palavra do sinal de prazo (suspensiva e vigência): "vencido" depois do dia, "prazo curto" até ele. */
export function palavraDoPrazo(dias: number | null | undefined): string {
  return (dias ?? 0) < 0 ? "vencido" : "prazo curto";
}

/** Na ficha, o município é o da página: sem link para ele mesmo. */
export function CelulaConvenio({ c, naFicha }: { c: ConvenioPainel; naFicha?: boolean }) {
  const lugar = `${c.municipio ?? "—"}/${c.uf ?? "—"}`;
  return (
    <th scope="row">
      <span className="mp-tabela-principal">{c.proponente ?? "—"}</span>
      <span className="mp-tabela-secundario">
        {!naFicha && c.cod_ibge ? <LinkMapa href={urlFicha({ ibge: c.cod_ibge })}>{lugar}</LinkMapa> : lugar} · nº {c.nr_convenio}{" "}
        <CopiarNumero numero={c.nr_convenio} />
        {/* Na ficha da prefeitura, todo convênio é do próprio município: o cliente também abre o laudo. */}
        {" · "}
        <LinkMapa href={urlLaudo(c.nr_convenio)}>ver o laudo</LinkMapa>
      </span>
      {c.dias_sem_movimentacao !== null && c.dias_sem_movimentacao !== undefined && (
        <span className={`mp-tabela-secundario${c.dias_sem_movimentacao > 365 ? " mp-painel-urgente" : ""}`}>
          {/* N09 (onda 8, C): mais de um ano sem movimento leva "▲ parado", e não só o vermelho. */}
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
    </th>
  );
}

export function CelulaPrograma({ c }: { c: ConvenioPainel }) {
  return (
    <td>
      <span className="mp-tabela-principal mp-painel-programa">{c.programa ?? "—"}</span>
      <span className="mp-tabela-secundario">{c.orgao_sup ?? "—"}</span>
      {c.objeto && <span className="mp-tabela-secundario mp-painel-objeto">{c.objeto}</span>}
    </td>
  );
}

type TabelaProps = { linhas: ConvenioPainel[]; naFicha?: boolean };

export function TabelaSuspensiva({ linhas, naFicha }: TabelaProps) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Proponente e convênio</th>
          <th scope="col">Prazo</th>
          <th scope="col">Programa e órgão</th>
          <th scope="col">Exigências</th>
          <th scope="col" className="mp-num">Repasse</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((c) => (
          <tr key={c.nr_convenio}>
            <CelulaConvenio c={c} naFicha={naFicha} />
            <td className="mp-nowrap">
              <span className="mp-tabela-principal">{c.suspensiva_prazo ? formatarData(c.suspensiva_prazo) : "—"}</span>
              <span className={`mp-tabela-secundario${(c.suspensiva_dias ?? 999) <= 30 ? " mp-painel-urgente" : ""}`}>
                {/* N09 (onda 8, C): o prazo de 30 dias ou menos leva "▲ prazo curto" (ou "▲ vencido"). */}
                {(c.suspensiva_dias ?? 999) <= 30 && (
                  <>
                    <Urgente palavra={palavraDoPrazo(c.suspensiva_dias)} />
                    {" · "}
                  </>
                )}
                {(c.suspensiva_dias ?? 0) < -60
                  ? `venceu há ${idadePorExtenso(-(c.suspensiva_dias ?? 0))}`
                  : prazoPorExtenso(c.suspensiva_dias)}
              </span>
            </td>
            <CelulaPrograma c={c} />
            <td>
              <span className="mp-painel-tags">
                {exigenciasDe(c).map((e) => (
                  <Tag key={e}>{ROTULO_EXIGENCIA[e]}</Tag>
                ))}
                {exigenciasDe(c).length === 0 && "—"}
              </span>
            </td>
            <td className="mp-num">{moedaCurta(c.repasse)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaNunca({ linhas, naFicha }: TabelaProps) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Proponente e convênio</th>
          <th scope="col">Programa e órgão</th>
          <th scope="col">Assinado</th>
          <th scope="col">Onde parou</th>
          <th scope="col" className="mp-num">Repasse</th>
          <th scope="col" className="mp-num">Empenhado</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((c) => (
          <tr key={c.nr_convenio}>
            <CelulaConvenio c={c} naFicha={naFicha} />
            <CelulaPrograma c={c} />
            <td className="mp-nowrap">{c.dt_assinatura ? formatarData(c.dt_assinatura) : "—"}</td>
            <td>
              <span className="mp-tabela-principal">
                {c.etapa_licitacao
                  ? ROTULO_ETAPA_LICITACAO[c.etapa_licitacao]
                  : ROTULO_GRUPO_SUSPENSIVA[c.grupo_suspensiva ?? ""] ?? "—"}
              </span>
              {c.dt_aceite && (
                <span className={`mp-tabela-secundario${c.aceite_parado ? " mp-painel-urgente" : ""}`}>
                  {/* N09 (onda 8, C): o aceite antigo sem desembolso leva "▲ parado". */}
                  {c.aceite_parado && (
                    <>
                      <Urgente palavra="parado" />
                      {" · "}
                    </>
                  )}
                  aceite em {formatarData(c.dt_aceite)}
                </span>
              )}
            </td>
            <td className="mp-num">{moedaCurta(c.repasse)}</td>
            <td className="mp-num">{moedaCurta(c.empenhado)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaVigencia({ linhas, naFicha }: TabelaProps) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Proponente e convênio</th>
          <th scope="col">Fim da vigência</th>
          <th scope="col">Programa e órgão</th>
          <th scope="col" className="mp-num">Desembolsado</th>
          <th scope="col" className="mp-num">Extensões</th>
          <th scope="col" className="mp-num">A desembolsar</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((c) => (
          <tr key={c.nr_convenio}>
            <CelulaConvenio c={c} naFicha={naFicha} />
            <td className="mp-nowrap">
              <span className="mp-tabela-principal">{c.dt_fim_vigencia ? formatarData(c.dt_fim_vigencia) : "—"}</span>
              <span className={`mp-tabela-secundario${(c.dias_para_fim ?? 999) <= 90 ? " mp-painel-urgente" : ""}`}>
                {/* N09 (onda 8, C): a vigência que acaba em 90 dias ou menos leva "▲ prazo curto" (ou "▲ vencido"). */}
                {(c.dias_para_fim ?? 999) <= 90 && (
                  <>
                    <Urgente palavra={palavraDoPrazo(c.dias_para_fim)} />
                    {" · "}
                  </>
                )}
                {prazoPorExtenso(c.dias_para_fim, { futuro: "termina", passado: "terminou" })}
              </span>
            </td>
            <CelulaPrograma c={c} />
            <td className="mp-num">{percentual(c.pct_desembolsado)}</td>
            <td className="mp-num">
              {c.n_extensoes ?? 0}
              {c.motivo_aditivo && (
                <span className="mp-tabela-secundario mp-painel-motivo">{ROTULO_MOTIVO_ADITIVO[c.motivo_aditivo] ?? c.motivo_aditivo}</span>
              )}
            </td>
            <td className="mp-num">{moedaCurta(Math.max((c.repasse ?? 0) - (c.desembolsado ?? 0), 0))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaFisico({ linhas, naFicha }: TabelaProps) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Proponente e convênio</th>
          <th scope="col">Programa e órgão</th>
          <th scope="col" className="mp-num">Desembolsado</th>
          <th scope="col" className="mp-num">Físico aferido</th>
          <th scope="col">Fim da vigência</th>
          <th scope="col" className="mp-num">Valor desembolsado</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((c) => (
          <tr key={c.nr_convenio}>
            <CelulaConvenio c={c} naFicha={naFicha} />
            <CelulaPrograma c={c} />
            <td className="mp-num">{percentual(c.pct_desembolsado)}</td>
            <td className="mp-num">
              {/* N09 (onda 8, C): o físico zerado leva "▲ zerado" sob o número. */}
              <span className={(c.pct_fisico ?? 1) === 0 ? "mp-painel-urgente" : undefined}>
                {percentual(c.pct_fisico)}
                {(c.pct_fisico ?? 1) === 0 && <Urgente palavra="zerado" />}
              </span>
            </td>
            <td className="mp-nowrap">
              <span className="mp-tabela-principal">{c.dt_fim_vigencia ? formatarData(c.dt_fim_vigencia) : "—"}</span>
              <span className="mp-tabela-secundario">
                {prazoPorExtenso(c.dias_para_fim, { futuro: "termina", passado: "terminou" })}
              </span>
            </td>
            <td className="mp-num">{moedaCurta(c.desembolsado)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaContas({ linhas, naFicha }: TabelaProps) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Proponente e convênio</th>
          <th scope="col">Programa e órgão</th>
          <th scope="col">Situação</th>
          <th scope="col">Prazo das contas</th>
          <th scope="col" className="mp-num">Repasse</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((c) => (
          <tr key={c.nr_convenio}>
            <CelulaConvenio c={c} naFicha={naFicha} />
            <CelulaPrograma c={c} />
            <td>
              <span className="mp-tabela-principal">{c.situacao ?? "—"}</span>
              {c.contas_lado === "concedente" && c.dias_com_concedente !== null && (
                <span className="mp-tabela-secundario">com o concedente há {idadePorExtenso(c.dias_com_concedente)}</span>
              )}
            </td>
            <td className="mp-nowrap">
              {c.dias_apos_limite === null
                ? "—"
                : c.dias_apos_limite > 0
                  ? `venceu há ${idadePorExtenso(c.dias_apos_limite)}`
                  : prazoPorExtenso(-c.dias_apos_limite)}
            </td>
            <td className="mp-num">{moedaCurta(c.repasse)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaSaldo({ linhas, naFicha }: TabelaProps) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Proponente e convênio</th>
          <th scope="col">Programa e órgão</th>
          <th scope="col">Último pagamento</th>
          <th scope="col">Parado há</th>
          <th scope="col" className="mp-num">Saldo</th>
          <th scope="col" className="mp-num">Rendimento</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((c) => (
          <tr key={c.nr_convenio}>
            <CelulaConvenio c={c} naFicha={naFicha} />
            <CelulaPrograma c={c} />
            <td className="mp-nowrap">{c.dt_ultimo_pagamento ? formatarData(c.dt_ultimo_pagamento) : "nunca pagou"}</td>
            <td className="mp-nowrap">{idadePorExtenso(c.dias_sem_movimento)}</td>
            <td className="mp-num">{moedaCurta(c.saldo_conta)}</td>
            <td className="mp-num">{moedaCurta(c.rendimento_implicito)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TOM_GRUPO = { avanco: "aderente", alerta: "urgente", registro: "neutro" } as const;

/** O que mudou, uma linha por evento. Com `comData`, a coluna do dia (períodos de mais de um dia). */
export function TabelaMudancas({ linhas, naFicha, comData }: { linhas: MudancaPainel[]; naFicha?: boolean; comData?: boolean }) {
  return (
    <table className="mp-tabela mp-painel-mudancas">
      <thead>
        <tr>
          <th scope="col">Quem</th>
          <th scope="col">O que mudou</th>
          <th scope="col">Programa e objeto</th>
          <th scope="col" className="mp-num">Valor</th>
          {comData && <th scope="col">Dado de</th>}
        </tr>
      </thead>
      <tbody>
        {linhas.map((m) => {
          const def = definicaoMudanca(m.tipo);
          const lugar = `${m.municipio ?? "—"}/${m.uf ?? "—"}`;
          const frase = descreverMudanca(m);
          return (
            <tr key={`${m.dado_ate}-${m.tipo}-${m.chave}`}>
              <th scope="row">
                <span className="mp-tabela-principal">{m.proponente ?? "—"}</span>
                <span className="mp-tabela-secundario">
                  {!naFicha && m.cod_ibge ? <LinkMapa href={urlFicha({ ibge: m.cod_ibge })}>{lugar}</LinkMapa> : lugar} ·{" "}
                  {m.alvo === "proposta" ? "proposta" : "convênio"} nº {m.numero ?? m.chave}{" "}
                  {m.numero && <CopiarNumero numero={m.numero} />}
                </span>
              </th>
              <td>
                <Tag tom={TOM_GRUPO[def.grupo]}>{def.rotulo}</Tag>
                {frase && <span className="mp-tabela-secundario">{frase}</span>}
              </td>
              <td>
                <span className="mp-tabela-principal mp-painel-programa">{m.programa ?? "—"}</span>
                <span className="mp-tabela-secundario">{m.orgao_sup ?? "—"}</span>
                {m.objeto && <span className="mp-tabela-secundario mp-painel-objeto">{m.objeto}</span>}
              </td>
              <td className="mp-num">{moedaCurta(m.valor)}</td>
              {comData && <td>{diaDoDado(m.dado_ate)}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
