import { Esqueleto, EsqueletoCartoes, EsqueletoLista, EsqueletoSecoes } from "../../../_componentes/Esqueleto";

/** Enquanto o laudo carrega (B10): o cabeçalho com o aviso, a frase do prazo, os quatro números e as seções. */
export default function LaudoCarregando() {
  return (
    <Esqueleto texto="Carregando o laudo…" linhas={3} acoes={3} aviso>
      <EsqueletoLista n={1} />
      <EsqueletoCartoes />
      <EsqueletoSecoes n={3} />
    </Esqueleto>
  );
}
