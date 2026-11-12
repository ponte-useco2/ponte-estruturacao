import { Esqueleto, EsqueletoTabela } from "../../../_componentes/Esqueleto";

/** Enquanto a fila das emendas da Câmara de João Pessoa carrega (D1 A69, 12/11/2026). */
export default function FilaJpCarregando() {
  return (
    <Esqueleto texto="Carregando a fila das emendas da Câmara…" linhas={2} acoes={1} aviso>
      <EsqueletoTabela linhas={8} />
    </Esqueleto>
  );
}
