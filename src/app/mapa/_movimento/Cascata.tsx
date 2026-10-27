"use client";

/**
 * A cascata (onda 16, M2; `staggerChildren`): os filhos entram um depois do outro, subindo 12 px com a mola `suave`. Do
 * 12º em diante entram juntos (`TETO_DA_CASCATA`), para lista longa não demorar.
 *
 * `Cascata` é o contêiner (qualquer classe de grade ou lista); cada filho que deve entrar em sequência vai num
 * `ItemCascata`. Os itens nascem invisíveis no HTML do servidor (estilo do Framer Motion); por isso `data-mp-mov`: no
 * papel e sem JavaScript, o CSS (`transicoes.css` e o `<noscript>` da moldura) mostra tudo parado no lugar.
 */
import { m, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { MOLA, PASSO_DA_CASCATA, TETO_DA_CASCATA } from "@/lib/oportunidades/molas";
import { Movimento } from "./Movimento";

const CONTEINER: Variants = {
  oculto: {},
  visivel: { transition: { staggerChildren: PASSO_DA_CASCATA, delayChildren: 0.04 } },
};

const ITEM: Variants = {
  oculto: { opacity: 0, y: 12 },
  visivel: { opacity: 1, y: 0, transition: MOLA.suave },
};

/** Variante com teto: o item `i` além do teto entra junto com o do teto. */
const itemComTeto = (i: number): Variants =>
  i < TETO_DA_CASCATA ? ITEM : { oculto: ITEM.oculto, visivel: { opacity: 1, y: 0, transition: { ...MOLA.suave, delay: 0 } } };

export function Cascata({ className, children, como = "div" }: { className?: string; children: ReactNode; como?: "div" | "ol" | "ul" }) {
  const C = como === "ol" ? m.ol : como === "ul" ? m.ul : m.div;
  return (
    <Movimento>
      <C className={className} variants={CONTEINER} initial="oculto" animate="visivel">
        {children}
      </C>
    </Movimento>
  );
}

export function ItemCascata({ children, className, indice = 0, como = "div" }: { children: ReactNode; className?: string; indice?: number; como?: "div" | "li" | "article" }) {
  const C = como === "li" ? m.li : como === "article" ? m.article : m.div;
  return (
    <C className={className} variants={itemComTeto(indice)} data-mp-mov="">
      {children}
    </C>
  );
}
