import { Esqueleto, EsqueletoCartoes, EsqueletoLista, EsqueletoSecoes } from "../../../_componentes/Esqueleto";

/** Enquanto o relatório carrega (B10): o cabeçalho com o aviso, "Em uma página" (cartões e achados) e as seções. */
export default function RelatorioCarregando() {
  return (
    <Esqueleto texto="Carregando o relatório do município…" trilha={5} acoes={4} aviso>
      <EsqueletoCartoes />
      <EsqueletoLista n={3} />
      <EsqueletoSecoes n={3} />
    </Esqueleto>
  );
}
