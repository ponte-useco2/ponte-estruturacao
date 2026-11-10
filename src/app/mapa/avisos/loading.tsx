import { Esqueleto, EsqueletoChips, EsqueletoLista } from "../_componentes/Esqueleto";

/**
 * Enquanto a central de avisos carrega (D1 A21, 09/11/2026): a página faz seis leituras em paralelo e uma escrita
 * antes de responder, e não tinha esqueleto. O desenho segue o mural: as três partes como abas, os chips de filtro e
 * os grupos de avisos em lista.
 */
export default function AvisosCarregando() {
  return (
    <Esqueleto texto="Carregando os avisos…" linhas={1} abas={3}>
      <EsqueletoChips n={5} />
      <EsqueletoLista n={4} />
    </Esqueleto>
  );
}
