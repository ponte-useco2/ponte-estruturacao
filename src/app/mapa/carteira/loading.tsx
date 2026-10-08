import { Esqueleto, EsqueletoCartoes, EsqueletoLista, EsqueletoTabela } from "../_componentes/Esqueleto";

/** Enquanto a carteira carrega (B10): o que mudou, os cartões dos municípios e entidades seguidos e os convênios. */
export default function CarteiraCarregando() {
  return (
    <Esqueleto texto="Carregando a sua carteira…" acoes={1}>
      <EsqueletoLista n={3} />
      <EsqueletoCartoes n={3} />
      <EsqueletoTabela linhas={4} />
    </Esqueleto>
  );
}
