/**
 * O contorno da área no alto da página dela (onda 16, M1, 27/10/2026, no município; onda 18, 28/10/2026, também na
 * UF): a linha se desenha ao abrir e o preenchimento aparece depois, só com CSS (`stroke-dashoffset` sobre
 * `pathLength="1"`; `movimento.css`). Selo pequeno ao lado do nome: diz onde se está na descida sem ocupar a página.
 * Decorativo para o leitor de tela (o nome já está no título). Só as áreas das malhas: as 27 UFs e os municípios da PB.
 *
 * Onda 18: o contorno é também o destino do morph. Quem desce pelo mapa vê a área clicada voar até aqui; o nome da
 * transição só se acende pelo tipo da navegação e pelo nível (`data-mp-contorno`, em `transicoes.css`), porque a página
 * da UF tem o próprio contorno e o mapa dos municípios ao mesmo tempo.
 */
import malhaBrasil from "@/lib/oportunidades/malhas/brasil-uf.json";
import malhaPb from "@/lib/oportunidades/malhas/pb-municipios.json";
import { caixaDoCaminho, type NivelDoMorph } from "@/lib/oportunidades/mapa-vivo";
import type { Malha } from "@/lib/oportunidades/pagina-brasil";

function Contorno({ malha, id, nivel }: { malha: Malha; id: string; nivel: NivelDoMorph }) {
  const area = malha.areas.find((a) => a.id === id);
  const caixa = area ? caixaDoCaminho(area.d) : null;
  if (!area || !caixa) return null;
  return (
    <svg className="mp-contorno" data-mp-contorno={nivel} viewBox={caixa} aria-hidden="true" focusable="false">
      <path d={area.d} pathLength={1} className="mp-contorno-linha" />
    </svg>
  );
}

export function ContornoDoMunicipio({ ibge }: { ibge: string }) {
  return <Contorno malha={malhaPb as Malha} id={ibge} nivel="municipio" />;
}

export function ContornoDaUf({ sigla }: { sigla: string }) {
  return <Contorno malha={malhaBrasil as Malha} id={sigla.toUpperCase()} nivel="uf" />;
}
