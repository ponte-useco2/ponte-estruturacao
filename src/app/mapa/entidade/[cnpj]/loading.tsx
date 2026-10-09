import { ABAS_ENTIDADE } from "@/lib/oportunidades/pagina-entidade";
import { Esqueleto, EsqueletoLista, EsqueletoSecoes } from "../../_componentes/Esqueleto";

/**
 * Enquanto a entidade carrega (B10): a trilha até o CNPJ, as abas e a fila de "O que trava e o que destrava". Na PB a
 * trilha tem 5 elos desde a C1c (Brasil › Paraíba › região imediata › município › entidade).
 * Onda 8, C (09/10/2026; N13): as abas da página, com o nível de cada uma; o público vê 3 das 6, com o resumo aceso.
 */
export default function EntidadeCarregando() {
  return (
    <Esqueleto texto="Carregando a página da entidade…" trilha={5} acoes={3} abas={ABAS_ENTIDADE}>
      <EsqueletoLista n={3} />
      <EsqueletoSecoes n={1} />
    </Esqueleto>
  );
}
