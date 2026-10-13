import { Esqueleto, EsqueletoCartoes, EsqueletoChips, EsqueletoTabela } from "../_componentes/Esqueleto";

/**
 * Enquanto a lista dos autores carrega (onda 14, parte 2, B, 13/10/2026): o cabeçalho com o aviso, os quatro cartões
 * dos grupos, o filtro por tipo e a primeira tabela.
 */
export default function ParlamentaresCarregando() {
  return (
    <Esqueleto texto="Carregando a lista dos autores de emendas…" linhas={2} acoes={1} aviso>
      <EsqueletoCartoes n={4} />
      <EsqueletoChips n={6} />
      <EsqueletoTabela linhas={8} />
    </Esqueleto>
  );
}
