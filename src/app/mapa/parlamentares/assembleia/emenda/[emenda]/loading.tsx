import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../../../_componentes/Esqueleto";

/** Enquanto a emenda estadual carrega (D1 A69, 12/11/2026): os cartões, o caminho, o catálogo e o destino. */
export default function EmendaAssembleiaCarregando() {
  return (
    <Esqueleto texto="Carregando a emenda estadual…" linhas={2} acoes={3} aviso>
      <EsqueletoCartoes n={4} />
      <EsqueletoTabela linhas={4} />
      <EsqueletoTabela linhas={6} />
    </Esqueleto>
  );
}
