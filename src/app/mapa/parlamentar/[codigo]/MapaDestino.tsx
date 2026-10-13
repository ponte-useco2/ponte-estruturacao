/**
 * O mapa dos 223 municípios no destino de um autor (onda 14, parte 2, B, 13/10/2026): a mesma malha do IBGE e a mesma
 * moldura (`mp-mapa`) do mapa da PB na página da UF (`MapaDaUf`), com outra pintura. O `MapaTerritorio` pinta só pela
 * região (a decisão do titular para o mapa de navegação), e aqui a pergunta é outra: onde o dinheiro deste autor chegou.
 *
 * - **Faixas de pago por habitante**, nos quartis dos atendidos (`cortesDasFaixas`), em tons do azul petróleo, do claro
 *   ao escuro. Faixa de quartil, e não de valor fixo, para o município pequeno com uma obra só não apagar o resto.
 * - **O não atendido fica à vista**, hachurado, e não some no fundo: o estudo pede que se veja quem ficou de fora.
 * - **Sem cor sozinha** (WCAG 1.4.1): a legenda diz a faixa, cada área tem o nome e o valor no `title`, e a tabela logo
 *   abaixo traz todos os números. O SVG é uma imagem com nome (`role="img"`), sem links: os links estão na tabela, e
 *   223 paradas de Tab sem ordem não seriam caminho (a mesma razão do modo decorativo do `MapaTerritorio`).
 */
import malhaPb from "@/lib/oportunidades/malhas/pb-municipios.json";
import type { Malha } from "@/lib/oportunidades/pagina-brasil";
import { faixaDe, reaisPorHabitante, rotulosDasFaixas, type LinhaMunicipio } from "@/lib/oportunidades/parlamentares-tela";
import { moedaCurta } from "@/lib/oportunidades/radar";

const MALHA = malhaPb as Malha;

export function MapaDestino({
  linhas,
  nomes,
  cortes,
  titulo,
}: {
  /** O destino municipal por município (`linhasPorMunicipio`). */
  linhas: LinhaMunicipio[];
  /** O nome de cada um dos 223, para o `title` dos não atendidos. */
  nomes: ReadonlyMap<string, string>;
  /** Os cortes das faixas (`cortesDasFaixas`). */
  cortes: number[];
  /** O nome do mapa, lido pelo leitor de tela. */
  titulo: string;
}) {
  const porIbge = new Map(linhas.map((l) => [l.ibge, l]));
  const rotulos = rotulosDasFaixas(cortes, reaisPorHabitante);
  const textoDa = (ibge: string) => {
    const l = porIbge.get(ibge);
    const nome = l?.nome ?? nomes.get(ibge) ?? `IBGE ${ibge}`;
    if (!l || !l.atendido) return `${nome}: sem destino deste autor`;
    return `${nome}: pago ${moedaCurta(l.pago)}${l.pagoPorHabitante !== null ? `, ${reaisPorHabitante(l.pagoPorHabitante)} por habitante` : ""}`;
  };
  // O tom de cada faixa (1 a 4). Com uma faixa só (menos de 4 atendidos), o tom do meio, que se vê bem contra o hachurado.
  const tom = (faixa: number) => (faixa === 0 ? 0 : cortes.length === 0 ? 3 : Math.min(4, faixa));
  const faixaDa = (ibge: string) => {
    const l = porIbge.get(ibge);
    if (!l || !l.atendido) return 0;
    // Atendido sem população na base (ou só com válido, sem pagamento): a faixa mais clara, nunca o hachurado.
    return tom(Math.max(1, faixaDe(l.pagoPorHabitante, cortes)));
  };

  return (
    <figure className="mp-mapa mp-parl-mapa">
      <svg viewBox={MALHA.viewBox} role="img" aria-label={titulo}>
        <defs>
          <pattern id="mp-parl-hachura" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <rect width="5" height="5" className="mp-parl-hachura-fundo" />
            <line x1="0" y1="0" x2="0" y2="5" className="mp-parl-hachura-traco" />
          </pattern>
        </defs>
        {MALHA.areas.map((a) => (
          <path key={a.id} d={a.d} className={`mp-parl-f${faixaDa(a.id)}`}>
            <title>{textoDa(a.id)}</title>
          </path>
        ))}
      </svg>
      <figcaption>
        <ul className="mp-mapa-legenda">
          <li>
            <span className="mp-parl-amostra mp-parl-a0" aria-hidden="true" />
            sem destino deste autor
          </li>
          {rotulos.map((r, i) => (
            <li key={r}>
              <span className={`mp-parl-amostra mp-parl-a${tom(i + 1)}`} aria-hidden="true" />
              {r}
            </li>
          ))}
        </ul>
        <span className="pa-nota">
          Pago por habitante em cada município atendido (pago ÷ população), em faixas pelos quartis dos atendidos. Malha: {MALHA.fonte}.
          <span className="mp-nao-imprimir"> Passe o mouse numa área para ver o nome e o valor; a tabela abaixo tem todos os números.</span>
        </span>
      </figcaption>
    </figure>
  );
}
