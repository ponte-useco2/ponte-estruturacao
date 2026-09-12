/**
 * Primitivos do protótipo.
 *
 * O que é vocabulário compartilhado — `Tag`, `Barra`, `Rotulo`, `Nota` —
 * mudou-se para `_design/primitivos` em 12/09/2026, quando o Mapa de
 * Oportunidades saiu de dentro do protótipo e passou a precisar das mesmas
 * peças sem herdar o resto. Continuam reexportados daqui para que as oito telas
 * que já os importavam não mudem uma linha.
 *
 * Fica aqui o que depende do DOMÍNIO do protótipo: eixos de transformação e o
 * ciclo problema → resultado.
 */

import { Tag } from "../../../_design/primitivos";
import type { EixoTransformacao } from "../_lib/tipos";

export { Tag, Barra, Rotulo, Nota } from "../../../_design/primitivos";

const NOME_EIXO: Record<EixoTransformacao, string> = {
  ambiental: "Ambiental",
  economico: "Econômico",
  social: "Social",
};

export function Eixos({ eixos }: { eixos: EixoTransformacao[] }) {
  return (
    <span className="pa-linha" style={{ gap: "0.35rem" }}>
      {eixos.map((e) => (
        <Tag key={e} tom={e}>
          {NOME_EIXO[e]}
        </Tag>
      ))}
    </span>
  );
}

/**
 * Ciclo problema → transformação. `ate` marca quantas etapas já foram vencidas;
 * a página pública usa o mesmo vocabulário.
 */
const ETAPAS = [
  "Problema",
  "Projeto",
  "Financiamento",
  "Execução",
  "Evidência",
  "Resultado",
] as const;

export function Ciclo({ ate }: { ate: number }) {
  return (
    <div className="pa-ciclo">
      {ETAPAS.map((e, i) => (
        <span key={e} className="pa-linha" style={{ gap: "0.35rem" }}>
          <Tag tom={i <= ate ? "forte" : "neutro"}>{e}</Tag>
          {i < ETAPAS.length - 1 && (
            <span className="pa-mono" aria-hidden="true">
              →
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
