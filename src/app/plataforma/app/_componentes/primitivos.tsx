/**
 * Peças pequenas repetidas em várias telas. Sem estado — podem ser usadas
 * tanto por Server quanto por Client Component.
 */

import type { ReactNode } from "react";
import type { EixoTransformacao } from "../_lib/tipos";

type TomTag =
  | "neutro"
  | "urgente"
  | "aderente"
  | "nova"
  | "proto"
  | "forte"
  | EixoTransformacao;

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
