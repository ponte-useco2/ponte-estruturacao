/**
 * O contorno do município no alto da página dele (onda 16, M1, 27/10/2026): a linha se desenha ao abrir e o
 * preenchimento aparece depois, só com CSS (`stroke-dashoffset` sobre `pathLength="1"`; `movimento.css`). Selo
 * pequeno ao lado do nome: diz onde se está na descida sem ocupar a página. Decorativo para o leitor de tela (o nome
 * já está no título). Só os municípios da malha (a PB); fora dela, nada.
 */
import malhaPb from "@/lib/oportunidades/malhas/pb-municipios.json";
import { caixaDoCaminho } from "@/lib/oportunidades/mapa-vivo";
import type { Malha } from "@/lib/oportunidades/pagina-brasil";

export function ContornoDoMunicipio({ ibge }: { ibge: string }) {
  const area = (malhaPb as Malha).areas.find((a) => a.id === ibge);
  const caixa = area ? caixaDoCaminho(area.d) : null;
  if (!area || !caixa) return null;
  return (
    <svg className="mp-contorno" viewBox={caixa} aria-hidden="true" focusable="false">
      <path d={area.d} pathLength={1} className="mp-contorno-linha" />
    </svg>
  );
}
