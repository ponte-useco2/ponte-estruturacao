import { Esqueleto, EsqueletoLista, EsqueletoSecoes } from "../../_componentes/Esqueleto";

/**
 * Enquanto o município carrega (B10): a trilha, as abas e a fila de "O que trava e o que destrava", que é a aba
 * de entrada. Vale também para as páginas abaixo dele que não têm esqueleto próprio (investimentos).
 */
export default function MunicipioCarregando() {
  return (
    <Esqueleto texto="Carregando a página do município…" trilha={4} acoes={3} abas={7}>
      <EsqueletoLista n={4} />
      <EsqueletoSecoes n={1} />
    </Esqueleto>
  );
}
