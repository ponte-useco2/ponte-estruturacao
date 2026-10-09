import { ABAS_BRASIL } from "@/lib/oportunidades/pagina-brasil";
import { Esqueleto, EsqueletoCartoes, EsqueletoFigura } from "../_componentes/Esqueleto";

/**
 * Enquanto o Brasil carrega (B10): a trilha, as abas, os cartões do resumo e o mapa das 27 UFs.
 * Onda 8, C (09/10/2026; N13): as abas da página, com o nível de cada uma; o público vê 3 das 5.
 */
export default function BrasilCarregando() {
  return (
    <Esqueleto texto="Carregando a página do Brasil…" trilha={1} acoes={2} abas={ABAS_BRASIL}>
      <EsqueletoCartoes />
      <EsqueletoFigura />
    </Esqueleto>
  );
}
