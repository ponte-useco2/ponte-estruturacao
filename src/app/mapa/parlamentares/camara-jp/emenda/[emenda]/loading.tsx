import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../../../_componentes/Esqueleto";

/** Enquanto a emenda da Câmara de João Pessoa carrega (D1 A69, 12/11/2026): os cartões e as tabelas da execução. */
export default function EmendaJpCarregando() {
  return (
    <Esqueleto texto="Carregando a emenda da Câmara…" linhas={2} acoes={3} aviso>
      <EsqueletoCartoes n={4} />
      <EsqueletoTabela linhas={4} />
      <EsqueletoTabela linhas={5} />
    </Esqueleto>
  );
}
