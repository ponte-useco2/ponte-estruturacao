import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../_componentes/Esqueleto";

/**
 * Enquanto a ficha do autor carrega (onda 14, parte 2, B, 13/10/2026): o cabeçalho com o aviso, as quatro abas (a de
 * entrada, Acesso, marcada), os cartões dos canais e a tabela por ano.
 */
export default function ParlamentarCarregando() {
  return (
    <Esqueleto texto="Carregando a ficha do autor…" linhas={1} acoes={1} aviso abas={4}>
      <EsqueletoCartoes n={4} />
      <EsqueletoTabela linhas={6} />
    </Esqueleto>
  );
}
