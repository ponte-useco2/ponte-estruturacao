import { Esqueleto, EsqueletoChips, EsqueletoFormulario, EsqueletoTabela } from "../_componentes/Esqueleto";

/** Enquanto a busca carrega (B10): o que buscar, o formulário com os filtros e a tabela de resultados. */
export default function BuscaCarregando() {
  return (
    <Esqueleto texto="Carregando a busca…" linhas={2}>
      <EsqueletoChips n={3} />
      <EsqueletoFormulario filtros={4} />
      <EsqueletoTabela linhas={8} />
    </Esqueleto>
  );
}
