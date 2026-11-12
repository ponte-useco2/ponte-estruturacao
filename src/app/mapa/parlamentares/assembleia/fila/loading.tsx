import { Esqueleto, EsqueletoTabela } from "../../../_componentes/Esqueleto";

/** Enquanto a fila das emendas estaduais carrega (D1 A69, 12/11/2026): os passos e a lista. */
export default function FilaAssembleiaCarregando() {
  return (
    <Esqueleto texto="Carregando a fila das emendas estaduais…" linhas={2} acoes={1} aviso>
      <EsqueletoTabela linhas={4} />
      <EsqueletoTabela linhas={8} />
    </Esqueleto>
  );
}
