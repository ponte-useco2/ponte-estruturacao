import { Esqueleto, EsqueletoCartoes, EsqueletoFigura, EsqueletoSecoes, EsqueletoTabela } from "../../_componentes/Esqueleto";

/**
 * Enquanto o relatório do Brasil carrega (C1b, 08/10/2026): a trilha de dois elos, as três ações e o aviso; depois os
 * números, o mapa, a tabela das 27 UFs e as seções do dinheiro, dos tempos e das fontes.
 */
export default function RelatorioBrasilCarregando() {
  return (
    <Esqueleto texto="Carregando o relatório do Brasil…" trilha={2} acoes={3} aviso>
      <EsqueletoCartoes />
      <EsqueletoFigura />
      <EsqueletoTabela linhas={8} />
      <EsqueletoSecoes n={3} />
    </Esqueleto>
  );
}
