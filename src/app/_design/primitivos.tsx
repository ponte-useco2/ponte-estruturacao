/**
 * Primitivos do design system — as peças pequenas que só embrulham as classes
 * `pa-*` de `componentes.css`. Sem estado: servem a Server e a Client Component.
 *
 * Moram aqui, e não dentro do protótipo, pela mesma razão que os CSS mudaram-se
 * para `_design/` em 12/09/2026: são vocabulário compartilhado, não peça
 * privada de `/plataforma/app`. O Mapa de Oportunidades os usa como produto, o
 * protótipo como protótipo.
 *
 * O que depende do domínio do protótipo — `Eixos` e `Ciclo`, que falam de eixos
 * de transformação e do ciclo problema → resultado — ficou onde estava.
 */

import type { ReactNode } from "react";

/**
 * Os três eixos aparecem como literais e não importados de `_lib/tipos`: um
 * primitivo de design system não pode depender do domínio de uma tela. O
 * `EixoTransformacao` do protótipo é exatamente esta união, então continua
 * atribuível sem conversão.
 */
type TomTag =
  | "neutro"
  | "urgente"
  | "aderente"
  | "nova"
  | "proto"
  | "forte"
  | "ambiental"
  | "economico"
  | "social";

const CLASSE_TAG: Record<TomTag, string> = {
  neutro: "",
  urgente: " pa-tag-urgente",
  aderente: " pa-tag-aderente",
  nova: " pa-tag-nova",
  proto: " pa-tag-proto",
  forte: " pa-tag-forte",
  ambiental: " pa-tag-ambiental",
  economico: " pa-tag-economico",
  social: " pa-tag-social",
};

export function Tag({ tom = "neutro", children }: { tom?: TomTag; children: ReactNode }) {
  return <span className={`pa-tag${CLASSE_TAG[tom]}`}>{children}</span>;
}

/** Barra de progresso com semântica de progressbar para leitor de tela. */
export function Barra({
  valor,
  rotulo,
  max = 100,
}: {
  valor: number;
  rotulo: string;
  max?: number;
}) {
  const pct = Math.max(0, Math.min(100, (valor / max) * 100));
  return (
    <div
      className="pa-barra"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={rotulo}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <span className="pa-mono">{children}</span>;
}

export function Nota({ children }: { children: ReactNode }) {
  return <p className="pa-nota">{children}</p>;
}
