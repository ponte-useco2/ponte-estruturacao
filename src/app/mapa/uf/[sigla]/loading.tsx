import { ABAS_UF } from "@/lib/oportunidades/pagina-uf";
import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../_componentes/Esqueleto";

/**
 * Enquanto a UF carrega (B10): a trilha, as abas, os cartões de "Em números" e a tabela de quem recebe no estado.
 * Onda 8, C (09/10/2026; N13): as abas da página, com o nível de cada uma; o público vê 4 das 6.
 */
export default function UfCarregando() {
  return (
    <Esqueleto texto="Carregando a página do estado…" trilha={2} acoes={2} abas={ABAS_UF}>
      <EsqueletoCartoes />
      <EsqueletoTabela linhas={6} />
    </Esqueleto>
  );
}
