import { Esqueleto, EsqueletoLista, EsqueletoSecoes } from "../../_componentes/Esqueleto";

/**
 * Enquanto a entidade carrega (B10): a trilha até o CNPJ, as abas e a fila de "O que trava e o que destrava". Na PB a
 * trilha tem 5 elos desde a C1c (Brasil › Paraíba › região imediata › município › entidade).
 */
export default function EntidadeCarregando() {
  return (
    <Esqueleto texto="Carregando a página da entidade…" trilha={5} acoes={3} abas={6}>
      <EsqueletoLista n={3} />
      <EsqueletoSecoes n={1} />
    </Esqueleto>
  );
}
