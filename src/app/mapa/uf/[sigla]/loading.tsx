import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../_componentes/Esqueleto";

/** Enquanto a UF carrega (B10): a trilha, as abas, os cartões de "Em números" e a tabela de quem recebe no estado. */
export default function UfCarregando() {
  return (
    <Esqueleto texto="Carregando a página do estado…" trilha={2} acoes={2} abas={6}>
      <EsqueletoCartoes />
      <EsqueletoTabela linhas={6} />
    </Esqueleto>
  );
}
