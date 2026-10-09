import { ABAS_MUNICIPIO } from "@/lib/oportunidades/pagina-municipio";
import { Esqueleto, EsqueletoLista, EsqueletoSecoes } from "../../_componentes/Esqueleto";

/**
 * Enquanto o município carrega (B10): a trilha, as abas e a fila de "O que trava e o que destrava", que é a aba
 * de entrada. Vale também para as páginas abaixo dele que não têm esqueleto próprio (investimentos).
 *
 * Onda 8, C (09/10/2026; N13 da auditoria R1): as abas são as da página, com o nível de cada uma. Quem tem cadastro vê
 * as 7; o público, as 3 dele (resumo, dinheiro e indicadores), com o resumo aceso, pelo `data-publico` da moldura.
 */
export default function MunicipioCarregando() {
  return (
    <Esqueleto texto="Carregando a página do município…" trilha={4} acoes={3} abas={ABAS_MUNICIPIO}>
      <EsqueletoLista n={4} />
      <EsqueletoSecoes n={1} />
    </Esqueleto>
  );
}
