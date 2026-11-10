import { Esqueleto, EsqueletoCartoes, EsqueletoLista, EsqueletoSecoes } from "../../../_componentes/Esqueleto";

/**
 * Enquanto o laudo do Pix carrega (D1 A26, 09/11/2026): a mesma forma do laudo do instrumento — o cabeçalho com o
 * aviso, a frase do pior ponto, os números do plano e as seções de itens.
 */
export default function LaudoPixCarregando() {
  return (
    <Esqueleto texto="Carregando o laudo do Pix…" linhas={2} acoes={2} aviso>
      <EsqueletoLista n={1} />
      <EsqueletoCartoes />
      <EsqueletoSecoes n={3} />
    </Esqueleto>
  );
}
