"use client";

/**
 * O Framer Motion do Mapa (onda 16, 27/10/2026): a porta única por onde a biblioteca entra nas páginas.
 *
 * - **Peso:** `LazyMotion` com `strict`. Os componentes usam `m.div` (o núcleo, poucos KB) e os recursos chegam depois,
 *   num pedaço à parte, só nas páginas que têm uma ilha com movimento. Usar `motion.div` aqui dentro quebra de
 *   propósito (`strict`), para ninguém trazer a biblioteca inteira sem perceber.
 * - **Recursos:** `animacao` (padrão) traz animação, variantes, saída e os gestos de passar, tocar e focar. `completo`
 *   acrescenta arrastar e as animações de layout (`layout`, `layoutId`); só as ilhas que precisam pedem.
 * - **Movimento reduzido:** `reducedMotion="user"` segue o sistema: sem deslocamento nem escala, fica a opacidade.
 */
import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

const animacao = () => import("./recursos-animacao").then((m) => m.default);
const completo = () => import("./recursos-completo").then((m) => m.default);

export function Movimento({ recursos = "animacao", children }: { recursos?: "animacao" | "completo"; children: ReactNode }) {
  return (
    <LazyMotion features={recursos === "completo" ? completo : animacao} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
