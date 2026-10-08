/**
 * O ciclo em curso do Pix no painel (oport_30): os planos da UF do exercício com o plano de trabalho pendente, da
 * vez do município primeiro e do prazo mais próximo. É a lista de quem procurar antes que o plano fique impedido.
 */
import { formatarData } from "@/lib/oportunidades/central";
import { diasAte, ordenarCiclo } from "@/lib/oportunidades/pix-ciclo";
import type { LeituraCicloPix } from "@/lib/oportunidades/pix-ciclo.server";
import { urlLaudoPix } from "@/lib/oportunidades/pix-laudo";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

const VEZ: Record<string, string> = { ente: "município", orgao: "órgão federal", a_conferir: "a conferir" };

export function CicloPix({ leitura, hoje }: { leitura: LeituraCicloPix | null; hoje: string }) {
  return (
    <section aria-labelledby="pix-ciclo" className="mp-radar-secao">
      <h2 id="pix-ciclo" className="mp-radar-h2">
        Ciclo em curso
      </h2>
      <Conteudo leitura={leitura} hoje={hoje} />
    </section>
  );
}

function Conteudo({ leitura, hoje }: { leitura: LeituraCicloPix | null; hoje: string }) {
  if (!leitura || leitura.estado === "nao_ativado" || leitura.estado === "sem_execucao") {
    return <p className="pa-nota">A coleta diária do ciclo ainda não foi feita: a lista aparece depois da primeira.</p>;
  }
  if (leitura.estado === "erro") {
    return <p className="pa-nota">O ciclo em curso não pôde ser lido agora. Costuma ser passageiro: recarregue a página em alguns minutos.</p>;
  }
  const c = leitura.contagens;
  const planos = ordenarCiclo(leitura.planos);
  const ente = planos.filter((p) => p.vez === "ente");
  const anos = Array.isArray(c.ciclo_anos) ? (c.ciclo_anos as number[]).join(" e ") : "do exercício";
  return (
    <>
      <p className="pa-nota">
        Coleta diária de {leitura.dado_ate ? formatarData(leitura.dado_ate.slice(0, 10)) : "—"}: {String(c.ciclo_planos_uf ?? "—")} planos de {anos}{" "}
        na UF; {planos.length === 0 ? "nenhum com o plano de trabalho pendente." : `${planos.length} pendentes, ${ente.length} com a vez do município.`}{" "}
        {Number(c.ciclo_prazos_cadastrados ?? 0) === 0
          ? "Nenhum prazo de comunicado cadastrado: os prazos aparecem quando o comunicado do ciclo for cadastrado."
          : `${String(c.ciclo_prazos_cadastrados)} prazos de comunicado cadastrados.`}
      </p>
      {planos.length > 0 && (
        <TabelaRolagem rotuloId="pix-ciclo">
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Ente</th>
                <th scope="col">Plano</th>
                <th scope="col">Vez</th>
                <th scope="col">Etapa</th>
                <th scope="col">Desde</th>
                <th scope="col">Prazo</th>
                <th scope="col">Última análise</th>
                <th scope="col" className="mp-num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => {
                const d = diasAte(p.prazo, hoje);
                return (
                  <tr key={p.id_plano_acao}>
                    <td>{p.beneficiario ?? "—"}</td>
                    <td>
                      <LinkMapa href={urlLaudoPix(p.id_plano_acao)}>
                        {p.codigo_plano_acao ?? p.id_plano_acao}
                      </LinkMapa>
                      {p.autor ? <span className="mp-laudo-miudo"> · {p.autor}</span> : null}
                    </td>
                    <td>{VEZ[p.vez] ?? p.vez}</td>
                    <td>{p.etapa ?? "—"}</td>
                    <td>{p.desde ? formatarData(p.desde) : "—"}</td>
                    <td>
                      {p.prazo ? formatarData(p.prazo) : "não cadastrado"}
                      {d !== null && <span className="mp-laudo-miudo">{d < 0 ? ` · venceu há ${-d} d` : ` · ${d} d`}</span>}
                    </td>
                    <td>
                      {p.ultima_analise
                        ? `${p.ultima_analise.orgao ?? "órgão"}${p.ultima_analise.parecer ? ` · ${p.ultima_analise.parecer.toLowerCase()}` : ""}`
                        : "—"}
                    </td>
                    <td className="mp-num">{moedaCurta(p.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabelaRolagem>
      )}
    </>
  );
}
