import { Esqueleto, EsqueletoChips, EsqueletoFormulario, EsqueletoLista } from "../_componentes/Esqueleto";

/**
 * Enquanto a busca carrega (B10): o que buscar, o formulário e os resultados. Desde a C2 (08/10/2026) a entrada é a
 * unificada — quatro chips, um filtro (a UF) e grupos em lista —, e o esqueleto segue a ela. Nas abas, que têm
 * quatro filtros e tabela, a diferença dura o tempo da leitura.
 */
export default function BuscaCarregando() {
  return (
    <Esqueleto texto="Carregando a busca…" linhas={1}>
      <EsqueletoChips n={4} />
      <EsqueletoFormulario filtros={1} />
      <EsqueletoLista n={3} />
    </Esqueleto>
  );
}
