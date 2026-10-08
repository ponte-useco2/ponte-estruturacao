import { Esqueleto, EsqueletoCartoes, EsqueletoFigura } from "../_componentes/Esqueleto";

/** Enquanto o Brasil carrega (B10): a trilha, as abas, os cartões do resumo e o mapa das 27 UFs. */
export default function BrasilCarregando() {
  return (
    <Esqueleto texto="Carregando a página do Brasil…" trilha={1} acoes={2} abas={5}>
      <EsqueletoCartoes />
      <EsqueletoFigura />
    </Esqueleto>
  );
}
