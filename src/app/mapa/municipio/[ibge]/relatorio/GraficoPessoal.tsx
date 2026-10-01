/**
 * A despesa com pessoal sobre a RCL ajustada, RGF a RGF, com o limite máximo e o prudencial (onda 14).
 * SVG puro, uma escala só para pontos, linhas e rótulos; as cores vêm dos tokens do site (CSS do mapa).
 */
import { rotuloPeriodo, type PontoSerie } from "@/lib/oportunidades/relatorio-municipio";

const L = 720;
const A = 240;
const M = { esq: 44, dir: 118, topo: 16, base: 30 };

const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function GraficoPessoal({ serie }: { serie: PontoSerie[] }) {
  const pontos = serie.filter((p): p is PontoSerie & { dtp_pct: number } => p.dtp_pct !== null);
  if (pontos.length < 2) return null;
  const maximo = pontos.at(-1)?.limite_maximo_pct ?? 54;
  const prudencial = pontos.at(-1)?.limite_prudencial_pct ?? 51.3;
  const valores = pontos.map((p) => p.dtp_pct);
  const yMin = Math.floor(Math.min(...valores, prudencial) - 2);
  const yMax = Math.ceil(Math.max(...valores, maximo) + 2);
  const x = (k: number) => M.esq + (k * (L - M.esq - M.dir)) / (pontos.length - 1);
  const y = (v: number) => M.topo + ((yMax - v) * (A - M.topo - M.base)) / (yMax - yMin);
  const passo = yMax - yMin > 16 ? 5 : 2;
  const marcas: number[] = [];
  for (let v = Math.ceil(yMin / passo) * passo; v <= yMax; v += passo) marcas.push(v);
  const anos = pontos.map((p, k) => ({ p, k })).filter(({ p, k }) => k === 0 || pontos[k - 1].exercicio !== p.exercicio);
  const ultimo = pontos.at(-1) as PontoSerie & { dtp_pct: number };
  const descricao =
    `Despesa com pessoal sobre a RCL ajustada de ${rotuloPeriodo(pontos[0])} (${pct(pontos[0].dtp_pct)}) a ` +
    `${rotuloPeriodo(ultimo)} (${pct(ultimo.dtp_pct)}); limite máximo de ${pct(maximo)} e prudencial de ${pct(prudencial)}.`;

  return (
    <figure className="mp-rel-grafico">
      <div className="mp-rel-grafico-rolagem">
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={descricao}>
          {marcas.map((v) => (
            <g key={v}>
              <line x1={M.esq} x2={L - M.dir} y1={y(v)} y2={y(v)} className="mp-rel-grade" />
              <text x={M.esq - 6} y={y(v) + 4} textAnchor="end" className="mp-rel-eixo">
                {v}%
              </text>
            </g>
          ))}
          {anos.map(({ p, k }) => (
            <text key={p.exercicio} x={x(k)} y={A - 8} textAnchor="start" className="mp-rel-eixo">
              {p.exercicio}
            </text>
          ))}
          <line x1={M.esq} x2={L - M.dir} y1={y(maximo)} y2={y(maximo)} className="mp-rel-limite" />
          <text x={L - M.dir + 6} y={y(maximo) + 4} className="mp-rel-limite-rotulo">
            máximo {pct(maximo)}
          </text>
          <line x1={M.esq} x2={L - M.dir} y1={y(prudencial)} y2={y(prudencial)} className="mp-rel-prudencial" />
          <text x={L - M.dir + 6} y={y(prudencial) + 4} className="mp-rel-eixo">
            prud. {pct(prudencial)}
          </text>
          <polyline points={pontos.map((p, k) => `${x(k)},${y(p.dtp_pct)}`).join(" ")} className="mp-rel-linha" />
          {pontos.map((p, k) => (
            <circle key={`${p.exercicio}-${p.periodo}`} cx={x(k)} cy={y(p.dtp_pct)} r={3.5} className={p.dtp_pct > maximo ? "mp-rel-ponto-acima" : "mp-rel-ponto"}>
              <title>{`${rotuloPeriodo(p)}: ${pct(p.dtp_pct)}`}</title>
            </circle>
          ))}
          <text x={x(pontos.length - 1)} y={y(ultimo.dtp_pct) - 9} textAnchor="end" className="mp-rel-valor">
            {pct(ultimo.dtp_pct)}
          </text>
        </svg>
      </div>
      <figcaption className="pa-nota">
        Despesa total com pessoal do Executivo ÷ RCL ajustada, em %, por {ultimo.periodicidade === "S" ? "semestre" : "quadrimestre"}. Fonte: RGF
        (Anexo 1) no Siconfi. Pontos escuros: acima do limite máximo.
      </figcaption>
    </figure>
  );
}
