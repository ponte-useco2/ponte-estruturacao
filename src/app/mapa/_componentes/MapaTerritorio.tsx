/**
 * Mapa 2D de navegação (U2, 08/10/2026): a malha do IBGE em SVG, cada área um link para a página dela (UF ou
 * município). Cor só por região (decisão do titular: nunca cor de problema). Server Component, sem JavaScript: o
 * nome aparece no `title` (dica do navegador e leitor de tela), e a tabela ao lado continua sendo a forma completa
 * de navegar. Links simples (`<a>`): nada de pré-carga.
 */
import type { AreaMapa, Malha } from "@/lib/oportunidades/pagina-brasil";

export function MapaTerritorio({
  malha,
  areas,
  legenda,
  titulo,
  rotulos = false,
}: {
  malha: Malha;
  areas: ReadonlyMap<string, AreaMapa>;
  legenda: { grupo: number; rotulo: string }[];
  titulo: string;
  /** Escreve o id da área no centro dela (as siglas no mapa do Brasil). */
  rotulos?: boolean;
}) {
  return (
    <figure className="mp-mapa">
      <svg viewBox={malha.viewBox} role="img" aria-label={titulo}>
        {malha.areas.map((a) => {
          const info = areas.get(a.id);
          const forma = <path d={a.d} className={`mp-mapa-g${info?.grupo ?? 0}`} />;
          return info?.href ? (
            <a key={a.id} href={info.href} aria-label={info.nome}>
              <title>{info.nome}</title>
              {forma}
            </a>
          ) : (
            <g key={a.id}>
              <title>{info?.nome ?? a.id}</title>
              {forma}
            </g>
          );
        })}
        {rotulos &&
          malha.areas.map((a) => (
            <text key={`r-${a.id}`} x={a.x} y={a.y} className="mp-mapa-rotulo" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
              {a.id}
            </text>
          ))}
      </svg>
      <figcaption>
        <ul className="mp-mapa-legenda">
          {legenda.map((l) => (
            <li key={l.rotulo}>
              <span className={`mp-mapa-amostra mp-mapa-g${l.grupo}`} aria-hidden="true" />
              {l.rotulo}
            </li>
          ))}
        </ul>
        <span className="pa-nota">Malha: {malha.fonte}. Toque ou clique numa área para abrir a página dela.</span>
      </figcaption>
    </figure>
  );
}
