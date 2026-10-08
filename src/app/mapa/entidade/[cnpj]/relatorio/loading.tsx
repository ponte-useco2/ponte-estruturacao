import { Esqueleto, EsqueletoCartoes, EsqueletoLista, EsqueletoSecoes, EsqueletoTabela } from "../../../_componentes/Esqueleto";

/**
 * Enquanto o relatório da entidade carrega (C1c): a trilha até o relatório (6 elos na PB, com a região imediata), as
 * ações e o aviso, "Em uma página" (cartões e achados), as seções e a carteira.
 */
export default function RelatorioEntidadeCarregando() {
  return (
    <Esqueleto texto="Carregando o relatório da entidade…" trilha={6} acoes={5} aviso>
      <EsqueletoCartoes />
      <EsqueletoLista n={3} />
      <EsqueletoSecoes n={2} />
      <EsqueletoTabela linhas={5} />
    </Esqueleto>
  );
}
