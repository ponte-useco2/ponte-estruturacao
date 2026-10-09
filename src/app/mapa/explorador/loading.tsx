import { Esqueleto, EsqueletoFigura, EsqueletoLista } from "../_componentes/Esqueleto";

/**
 * Enquanto o explorador abre (C3a, 09/10/2026): o rótulo do protótipo, o título, a trilha, a barra (voltar e vista), o
 * mapa e a lista da camada. Só na primeira abertura: nas trocas de camada a página é a mesma (mudam só os parâmetros) e
 * a camada de cima fica na tela até a nova chegar.
 */
export default function ExploradorCarregando() {
  return (
    <Esqueleto texto="Carregando o explorador…" trilha={3} acoes={2}>
      <EsqueletoFigura />
      <EsqueletoLista n={4} />
    </Esqueleto>
  );
}
