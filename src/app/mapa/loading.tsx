import { Esqueleto, EsqueletoChips, EsqueletoLista } from "./_componentes/Esqueleto";

/**
 * Enquanto o catálogo de janelas (`/mapa`) carrega (D1 A01, 09/11/2026): a entrada do Mapa lia catálogo, contexto,
 * preferências e seguidas sem retorno visual nenhum, enquanto as outras páginas de nível já tinham esqueleto. O
 * desenho segue o catálogo: rótulo, título, o campo de busca como chip largo, os chips de filtro e os cartões.
 *
 * Por ser o `loading.tsx` do segmento, também cobre as rotas debaixo de `/mapa` que não têm esqueleto próprio
 * (o painel das rodadas, a cadeia do gasto, o "Meu município"…): melhor um esqueleto genérico do que tela em branco.
 */
export default function MapaCarregando() {
  return (
    <Esqueleto texto="Carregando o Mapa de Oportunidades…" linhas={2} acoes={1}>
      <EsqueletoChips n={6} />
      <EsqueletoLista n={4} />
    </Esqueleto>
  );
}
