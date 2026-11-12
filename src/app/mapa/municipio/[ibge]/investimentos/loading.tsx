import { Esqueleto, EsqueletoCartoes, EsqueletoTabela } from "../../../_componentes/Esqueleto";

/**
 * Enquanto os investimentos do município carregam (D1 A36 e A69, 12/11/2026): até aqui a página herdava o esqueleto
 * do município em abas, com abas que ela não tem (fora da PB, uma estrutura que nunca chega). O desenho é o da
 * página: a trilha, o título, o subtítulo, o link da busca, os três cartões e as tabelas por tema e por situação.
 */
export default function InvestimentosCarregando() {
  return (
    <Esqueleto texto="Carregando os investimentos do município…" trilha={3} linhas={2} acoes={1}>
      <EsqueletoCartoes n={3} />
      <EsqueletoTabela linhas={8} />
      <EsqueletoTabela linhas={4} />
    </Esqueleto>
  );
}
