/**
 * A página de uma proposta: onde ela está, de quem é a vez e quanto o órgão costuma levar.
 */
import Link from "next/link";
import { parametrosBusca, urlBusca, urlInstrumento, urlInvestimentos } from "@/lib/oportunidades/busca";
import type { LeituraProposta } from "@/lib/oportunidades/busca.server";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import {
  MINIMO_MEDICOES,
  ROTULO_DESFECHO,
  ROTULO_ETAPA,
  diasPorExtenso,
  vezDaProposta,
  type LinhaEtapa,
} from "@/lib/oportunidades/painel";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { ROTULO_TEMA } from "@/lib/oportunidades/temas";
import { CopiarNumero } from "../../painel/CopiarNumero";

type LeituraOk = Extract<LeituraProposta, { estado: "ok" }>;

const data = (iso: string | null) => (iso ? formatarData(iso) : "—");
const ETAPAS_DA_PROPOSTA = ["envio_aprovacao", "aprovacao_assinatura", "envio_assinatura", "assinatura_desembolso"] as const;

function diasEntre(de: string | null, ate: string | null): number | null {
  if (!de || !ate) return null;
  return Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86_400_000);
}

function mediana(linhas: LinhaEtapa[], etapa: string): string {
  const l = linhas.find((x) => x.etapa === etapa);
  if (!l || l.mediana === null || l.n < MINIMO_MEDICOES) return "—";
  return diasPorExtenso(l.mediana);
}

export function PropostaConteudo({ leitura }: { leitura: LeituraOk }) {
  const p = leitura.proposta;
  const vez = vezDaProposta(p.desfecho);
  const temas = (p.temas ?? []).filter((t) => ROTULO_TEMA[t]);
  const ateAssinatura = diasEntre(p.dt_envio, p.dt_assinatura);
  const emAberto = vez !== null ? diasEntre(p.dt_envio, leitura.execucao.referencia) : null;

  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">
          Proposta nº {p.nr_proposta ?? p.id_proposta} <CopiarNumero numero={p.nr_proposta ?? p.id_proposta} de="proposta" />
        </p>
        <h1 className="pa-titulo">{p.programa ?? "Programa não informado"}</h1>
        {p.objeto && <p className="pa-sub">{p.objeto}</p>}
        <p className="pa-sub">
          <strong>{p.proponente ?? "Proponente não informado"}</strong>
          {p.cod_ibge ? (
            <>
              {" · "}
              <Link href={urlInvestimentos(p.cod_ibge)}>
                {p.municipio ?? `IBGE ${p.cod_ibge}`}/{p.uf}
              </Link>
            </>
          ) : null}
          {p.orgao_sup ? ` · ${p.orgao_sup}` : ""}
        </p>
        <p className="pa-chips">
          <span className="pa-tag">{ROTULO_DESFECHO[p.desfecho] ?? p.desfecho}</span>
          {p.com_emenda && <span className="pa-tag">com emenda parlamentar</span>}
          {temas.map((t) => (
            <Link key={t} href={urlBusca(parametrosBusca({ aba: "propostas" }), { tema: t, uf: p.uf })} className="pa-tag">
              {ROTULO_TEMA[t]}
            </Link>
          ))}
        </p>
      </div>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        <article className="pa-cartao">
          <h2 className="pa-mono">Repasse pedido</h2>
          <p className="pa-numero">{moedaCurta(p.valor_repasse)}</p>
          <p className="pa-nota">Enviada em {data(p.dt_envio)}</p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">De quem é a vez</h2>
          <p className="pa-numero">{vez === "concedente" ? "Do órgão" : vez === "proponente" ? "Do proponente" : "—"}</p>
          <p className="pa-nota">
            {vez
              ? `Sem desfecho há ${emAberto !== null ? diasPorExtenso(emAberto) : "—"} desde o envio.`
              : `Desfecho: ${(ROTULO_DESFECHO[p.desfecho] ?? p.desfecho).toLowerCase()}.`}
            {p.limbo ? " Sem nenhum evento há mais de um ano." : ""}
          </p>
        </article>
        <article className="pa-cartao">
          <h2 className="pa-mono">Último movimento</h2>
          <p className="pa-numero">{data(p.dt_ultimo_evento)}</p>
          <p className="pa-nota">{p.situacao ?? "Situação não informada"}</p>
        </article>
      </div>

      {p.em_lote && (
        <p className="pa-nota">
          Esta reprovação ou impedimento veio num encerramento em lote do órgão (100 ou mais no mesmo dia), não numa análise da
          proposta.
        </p>
      )}

      <section aria-labelledby="proposta-tempos" className="mp-radar-secao">
        <h2 id="proposta-tempos" className="mp-radar-h2">
          Quanto o órgão costuma levar
        </h2>
        <p className="pa-nota">
          Medianas do {p.orgao_sup ?? "órgão"} nas etapas que terminaram nos últimos três anos. Com menos de {MINIMO_MEDICOES}{" "}
          medições, a mediana não aparece.
        </p>
        <div className="mp-tabela-rolagem">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Etapa</th>
                <th scope="col" className="mp-num">Esta proposta</th>
                <th scope="col" className="mp-num">Mediana em {p.uf ?? "UF"}</th>
                <th scope="col" className="mp-num">Mediana no Brasil</th>
              </tr>
            </thead>
            <tbody>
              {ETAPAS_DA_PROPOSTA.map((etapa) => (
                <tr key={etapa}>
                  <th scope="row">{ROTULO_ETAPA[etapa]}</th>
                  <td className="mp-num">
                    {etapa === "envio_assinatura"
                      ? ateAssinatura !== null
                        ? diasPorExtenso(ateAssinatura)
                        : emAberto !== null
                          ? `em aberto há ${diasPorExtenso(emAberto)}`
                          : "—"
                      : "—"}
                  </td>
                  <td className="mp-num">{mediana(leitura.etapasUf, etapa)}</td>
                  <td className="mp-num">{mediana(leitura.etapasBr, etapa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {p.nr_convenio && (
        <p className="pa-nota">
          Virou o convênio nº {p.nr_convenio}
          {leitura.convenioNaBusca ? (
            <>
              {" · "}
              <Link href={urlInstrumento(p.nr_convenio)}>ver o convênio</Link>
            </>
          ) : (
            ", que não está na busca (fora da PB, só entram os convênios em execução ou em prestação de contas)"
          )}
          .
        </p>
      )}
      <p className="pa-nota">Fonte: Transferegov (SICONV), dado até {formatarPublicacao(leitura.execucao.dado_ate)}.</p>
    </div>
  );
}
