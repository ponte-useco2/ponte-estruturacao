import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../_componentes/Esqueleto";

/** Enquanto as emendas da Assembleia carregam (E2, 16/10/2026): o cabeçalho com o aviso, os cartões e a tabela. */
export default function AssembleiaCarregando() {
  return (
    <Esqueleto texto="Carregando as emendas da Assembleia…" linhas={2} acoes={2} aviso>
      <EsqueletoCartoes n={4} />
      <EsqueletoTabela linhas={8} />
    </Esqueleto>
  );
}
