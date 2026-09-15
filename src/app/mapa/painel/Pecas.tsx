/**
 * Peças do painel usadas pelas visões e pela ficha do município: cartão, lista e as
 * tabelas de convênio de cada visão. Só desenham o que recebem.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { formatarData } from "@/lib/oportunidades/central";
import {
  ROTULO_ETAPA_LICITACAO,
  ROTULO_EXIGENCIA,
  ROTULO_FONTE_MOVIMENTACAO,
  ROTULO_GRUPO_SUSPENSIVA,
  ROTULO_MOTIVO_ADITIVO,
  exigenciasDe,
  idadePorExtenso,
  percentual,
  prazoPorExtenso,
  urlFicha,
} from "@/lib/oportunidades/painel";
import type { ConvenioPainel } from "@/lib/oportunidades/painel.server";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Tag } from "../../_design/primitivos";
import { CopiarNumero } from "./CopiarNumero";

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
  vazio: string;
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
      {children ? <div className="mp-tabela-rolagem">{children}</div> : <p className="pa-cartao pa-cartao-plano">{vazio}</p>}
    </div>
  );
}

/** Link comum para a rota de exportação: o navegador baixa o arquivo. */
export function BotaoCsv({ href, rotulo = "Baixar CSV" }: { href: string; rotulo?: string }) {
  return (
    <a href={href} className="pa-btn pa-btn-pequeno mp-painel-csv" download>
      {rotulo}
    </a>
  );
}

/** Na ficha, o município é o da página: sem link para ele mesmo. */
export function CelulaConvenio({ c, naFicha }: { c: ConvenioPainel; naFicha?: boolean }) {
  const lugar = `${c.municipio ?? "—"}/${c.uf ?? "—"}`;
  return (
    <th scope="row">
      <span className="mp-tabela-principal">{c.proponente ?? "—"}</span>
      <span className="mp-tabela-secundario">
        {!naFicha && c.cod_ibge ? <Link href={urlFicha({ ibge: c.cod_ibge })}>{lugar}</Link> : lugar} · nº {c.nr_convenio}{" "}
        <CopiarNumero numero={c.nr_convenio} />
      </span>
      {c.dias_sem_movimentacao !== null && c.dias_sem_movimentacao !== undefined && (
        <span className={`mp-tabela-secundario${c.dias_sem_movimentacao > 365 ? " mp-painel-urgente" : ""}`}>
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
              <span className={(c.pct_fisico ?? 1) === 0 ? "mp-painel-urgente" : undefined}>{percentual(c.pct_fisico)}</span>
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
