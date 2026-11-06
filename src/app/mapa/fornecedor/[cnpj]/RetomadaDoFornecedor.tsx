/**
 * As obras do Pacto de Retomada em que a empresa é a contratada (R2, 05/11/2026). Só no dossiê do fornecedor, que é do
 * administrador (decisão do titular de 01/11/2026: empresa com nome só para a casa). O Brasil inteiro, não só a PB.
 */
import { lerRetomadaDoFornecedor } from "@/lib/oportunidades/retomada.server";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";

const dia = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

export async function RetomadaDoFornecedor({ cnpj }: { cnpj: string }) {
  const l = await lerRetomadaDoFornecedor(cnpj);
  if (l.estado === "sem_dado" || (l.estado === "ok" && !l.obras.length)) return null;
  return (
    <section aria-labelledby="forn-retomada" className="mp-radar-secao">
      <h2 id="forn-retomada" className="mp-radar-h2">
        Obras do Pacto de Retomada (FNDE)
      </h2>
      {l.estado === "falha" ? (
        <p className="pa-nota">A leitura do Pacto de Retomada falhou agora.</p>
      ) : (
        <>
          <p className="pa-nota">
            Obras da educação em que a empresa é a contratada, no Brasil inteiro, pela Plataforma Antonieta de Barros (rodada de {dia(l.referencia)}). Sanções
            e inidoneidade seguem as marcas acima, pela mesma regra de alcance.
          </p>
          <TabelaRolagem rotulo="Obras do Pacto de Retomada da empresa">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Obra</th>
                  <th scope="col">Município</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Executado</th>
                  <th scope="col">Contrato</th>
                  <th scope="col">Fim do contrato</th>
                </tr>
              </thead>
              <tbody>
                {l.obras.map((o) => (
                  <tr key={o.obrid}>
                    <td>{o.nome}</td>
                    <td>{o.uf === "PB" && o.ibge ? <LinkMapa href={urlMunicipio(o.ibge, "controle")}>{o.municipio} (PB)</LinkMapa> : `${o.municipio} (${o.uf})`}</td>
                    <td>{o.situacao_obra ?? "—"}</td>
                    <td className="mp-rel-num">{o.pct_executado !== null ? `${o.pct_executado.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</td>
                    <td className="mp-rel-num">{o.valor_contrato !== null ? moedaCurta(o.valor_contrato) : "—"}</td>
                    <td className="mp-rel-num">{dia(o.dt_fim_contrato)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </>
      )}
    </section>
  );
}
