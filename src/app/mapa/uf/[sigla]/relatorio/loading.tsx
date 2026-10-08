import { Esqueleto, EsqueletoCartoes, EsqueletoFigura, EsqueletoSecoes, EsqueletoTabela } from "../../../_componentes/Esqueleto";

/**
 * Enquanto o relatório da UF carrega (C1a, 08/10/2026): a trilha de 3 elos (Brasil › UF › Relatório), as três ações
 * (imprimir, CSV, página do estado), o aviso, os cartões de "Em números", quem recebe, o mapa e as regiões, e as seções.
 */
export default function RelatorioUfCarregando() {
  return (
    <Esqueleto texto="Carregando o relatório do estado…" trilha={3} acoes={3} aviso>
      <EsqueletoCartoes />
      <EsqueletoTabela linhas={4} />
      <EsqueletoFigura />
      <EsqueletoTabela linhas={8} />
      <EsqueletoSecoes n={3} />
    </Esqueleto>
  );
}
