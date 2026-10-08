import { Esqueleto, EsqueletoCartoes, EsqueletoChips, EsqueletoSecoes } from "../../_componentes/Esqueleto";

/** Enquanto o convênio carrega (B10): programa e objeto, as etiquetas, os três valores, os prazos e a linha do tempo. */
export default function InstrumentoCarregando() {
  return (
    <Esqueleto texto="Carregando o convênio…" linhas={3} acoes={1}>
      <EsqueletoChips n={3} />
      <EsqueletoCartoes n={3} />
      <EsqueletoSecoes n={2} />
    </Esqueleto>
  );
}
