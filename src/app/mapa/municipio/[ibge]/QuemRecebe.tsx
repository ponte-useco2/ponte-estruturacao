/**
 * "Quem recebe no município" (E1, 07/10/2026): a descida do município para as entidades. Os instrumentos do
 * município agrupados por CNPJ em lentes (poder público municipal, estado no município, sociedade civil), cada
 * entidade levando à sua página. Só a lente municipal forma a fila do município; as outras são listadas, não somadas.
 */
import Link from "next/link";
import { EXPLICA_LENTE, ROTULO_ESPECIE, ROTULO_LENTE, urlEntidade, type EntidadeNoMunicipio, type LenteEntidade } from "@/lib/oportunidades/pagina-entidade";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Carregando } from "../../_componentes/Carregando";
import { Secao } from "./relatorio/RelatorioConteudo";

const n = (x: number) => x.toLocaleString("pt-BR");

export function QuemRecebe({ grupos, municipio }: { grupos: { lente: LenteEntidade; entidades: EntidadeNoMunicipio[] }[] | null; municipio: string }) {
  if (!grupos) return <p className="pa-nota">A lista de quem recebe no município não pôde ser lida agora.</p>;
  if (!grupos.length) return null;
  return (
    <Secao
      id="mun-quem-recebe"
      titulo="Quem recebe no município"
      nota={`Os proponentes com instrumento e sede em ${municipio}, cada um com a sua página: carteira, fila e dinheiro.`}
    >
      {grupos.map((g) => (
        <details key={g.lente} className="mp-ent-grupo" open={g.lente === "municipal"}>
          <summary>
            <strong>{ROTULO_LENTE[g.lente]}</strong> · {n(g.entidades.length)} {g.entidades.length === 1 ? "entidade" : "entidades"}
          </summary>
          <p className="pa-nota">{EXPLICA_LENTE[g.lente]}</p>
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Entidade</th>
                  <th scope="col">Espécie</th>
                  <th scope="col">Instrumentos</th>
                  <th scope="col">Em execução</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Mais recente</th>
                </tr>
              </thead>
              <tbody>
                {g.entidades.map((e) => (
                  <tr key={e.cnpj}>
                    <td>
                      <Link href={urlEntidade(e.cnpj)} prefetch={false}>
                        {e.nome}
                        <Carregando />
                      </Link>
                    </td>
                    <td>{ROTULO_ESPECIE[e.especie]}</td>
                    <td className="mp-rel-num">{n(e.instrumentos)}</td>
                    <td className="mp-rel-num">{e.emExecucao ? n(e.emExecucao) : "—"}</td>
                    <td className="mp-rel-num">{moedaCurta(e.valor)}</td>
                    <td>{e.ultimoAno ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </Secao>
  );
}
