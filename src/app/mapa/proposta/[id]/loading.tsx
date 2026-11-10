import { Esqueleto, EsqueletoCartoes, EsqueletoChips, EsqueletoSecoes } from "../../_componentes/Esqueleto";

/**
 * Enquanto a proposta carrega (D1 A16, 09/11/2026): o rótulo com a estrela, o programa como título, as etiquetas de
 * desfecho e tema, os três cartões (repasse pedido, de quem é a vez, último movimento) e as seções de tempos e plano
 * de trabalho. A navegação da busca à proposta não tinha estado de carregamento desenhado.
 */
export default function PropostaCarregando() {
  return (
    <Esqueleto texto="Carregando a proposta…" linhas={1} acoes={1}>
      <EsqueletoChips n={3} />
      <EsqueletoCartoes n={3} />
      <EsqueletoSecoes n={2} />
    </Esqueleto>
  );
}
