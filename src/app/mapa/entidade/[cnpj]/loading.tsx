import { Esqueleto, EsqueletoLista, EsqueletoSecoes } from "../../_componentes/Esqueleto";

/** Enquanto a entidade carrega (B10): a trilha até o CNPJ, as abas e a fila de "O que trava e o que destrava". */
export default function EntidadeCarregando() {
  return (
    <Esqueleto texto="Carregando a página da entidade…" trilha={4} acoes={3} abas={6}>
      <EsqueletoLista n={3} />
      <EsqueletoSecoes n={1} />
    </Esqueleto>
  );
}
