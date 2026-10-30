import {
  FONTES_CQ,
  FONTES_DO_BLOCO,
  cnpjLegivelCq,
  rotuloSituacao,
  urlCnpjCadeia,
  urlSituacao,
  type BlocoCq,
  type BlocoId,
  type CasoCq,
} from "@/lib/oportunidades/cadeia-quebrada";
import { formatarData } from "@/lib/oportunidades/central";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { LinkMapa } from "../_componentes/LinkMapa";

export const n = (x: number) => x.toLocaleString("pt-BR");
export const pct = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const num = (v: number | string | null) => (v === null ? null : Number(v));

/** O bloco da página de cada `teste` dos casos. */
export const BLOCO_DO_TESTE: Record<string, BlocoId> = { notas_empenho: "notas", emendas: "emendas", sancoes: "sancoes" };

/** Link para fora do portal: abre em outra aba, sem levar o endereço de quem clicou. */
export function LinkFora({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** As fontes de origem de um bloco, cada uma com o endereço público onde o dado nasce. */
export function FontesDoBloco({ bloco }: { bloco: BlocoId }) {
  return (
    <p className="pa-nota">
      Origem:{" "}
      {FONTES_DO_BLOCO[bloco].map((f, k) => (
        <span key={f}>
          {k > 0 ? " · " : ""}
          <LinkFora href={FONTES_CQ[f].url}>{FONTES_CQ[f].nome}</LinkFora>
        </span>
      ))}
      .
    </p>
  );
}

/** A tabela de situações de um bloco: cada situação leva à página dela (órgãos ou motivos, e os casos). */
export function TabelaSituacao({ id, bloco, titulo, dados, nota, valor = false }: { id: string; bloco: BlocoId; titulo: string; dados: BlocoCq; nota: string; valor?: boolean }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">Situação</th>
            <th scope="col" className="mp-num">
              Pares
            </th>
            <th scope="col" className="mp-num">
              Fatia
            </th>
            {valor && (
              <th scope="col" className="mp-num">
                Pago
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {dados.linhas.map((l) => {
            const href = urlSituacao(bloco, l.situacao);
            return (
              <tr key={l.situacao}>
                <th scope="row">
                  <LinkMapa href={href}>
                    {rotuloSituacao(l.situacao)}
                    {l.fecha ? " ✓" : ""}
                  </LinkMapa>
                </th>
                <td className="mp-num">
                  <LinkMapa href={href}>{n(l.pares)}</LinkMapa>
                </td>
                <td className="mp-num">{pct(l.fatia)}</td>
                {valor && <td className="mp-num">{l.pago === null ? "—" : <LinkMapa href={href}>{moedaCurta(l.pago)}</LinkMapa>}</td>}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="mp-num">{n(dados.pares)}</td>
            <td className="mp-num">100%</td>
            {valor && <td className="mp-num">{moedaCurta(dados.pago)}</td>}
          </tr>
        </tfoot>
      </table>
      <p className="pa-nota">{nota}</p>
      <FontesDoBloco bloco={bloco} />
    </section>
  );
}

/**
 * Os casos por CNPJ: cada CNPJ leva à página dele, cada órgão ao recorte da situação, e o ato à página do Diário
 * Oficial. Sem razão social (o pacote marca exibir por CNPJ).
 */
export function TabelaCasos({ casos, bloco, situacao }: { casos: CasoCq[]; bloco: BlocoId | null; situacao: string | null }) {
  if (casos.length === 0) return null;
  return (
    <div className="mp-tabela-rolagem">
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">CNPJ</th>
            <th scope="col">Órgão pagador</th>
            {!situacao && <th scope="col">Situação</th>}
            <th scope="col" className="mp-num">
              Pago
            </th>
            <th scope="col" className="mp-num">
              Notas
            </th>
            <th scope="col">Anos</th>
            <th scope="col">No Diário</th>
          </tr>
        </thead>
        <tbody>
          {casos.map((c) => {
            const pago = num(c.pago);
            return (
              <tr key={`${c.ordem}`}>
                <th scope="row">
                  <LinkMapa href={urlCnpjCadeia(c.cnpj)} className="pa-mono">
                    {cnpjLegivelCq(c.cnpj)}
                  </LinkMapa>
                </th>
                <td>{c.orgao ? bloco && situacao ? <LinkMapa href={urlSituacao(bloco, situacao, c.orgao)}>{c.orgao}</LinkMapa> : c.orgao : "—"}</td>
                {!situacao && (
                  <td>
                    {BLOCO_DO_TESTE[c.teste] ? (
                      <LinkMapa href={urlSituacao(BLOCO_DO_TESTE[c.teste], c.teste === "sancoes" ? c.situacao.replace(/^sanção /, "") : c.situacao)}>
                        {rotuloSituacao(c.situacao)}
                      </LinkMapa>
                    ) : (
                      rotuloSituacao(c.situacao)
                    )}
                  </td>
                )}
                <td className="mp-num">{pago === null ? "—" : moedaCurta(pago)}</td>
                <td className="mp-num">{c.notas ?? "—"}</td>
                <td>{(c.anos ?? []).join(", ") || "—"}</td>
                <td>
                  {c.link_diario ? (
                    <LinkFora href={c.link_diario}>
                      {c.tipo_ato ?? "ato"}
                      {c.data_ato ? ` de ${formatarData(c.data_ato)}` : ""}
                    </LinkFora>
                  ) : (
                    "nenhum ato do órgão"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
