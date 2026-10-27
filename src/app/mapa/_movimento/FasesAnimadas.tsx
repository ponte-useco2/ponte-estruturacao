"use client";

/**
 * As fases do instrumento como uma trilha que acende etapa por etapa (onda 16, M2; orquestração com
 * `staggerChildren`): cada situação por que o convênio passou aparece em ordem, e a atual chega por último, com o ponto
 * da mola `pin`. Lista ordenada de verdade (`<ol>`): o leitor de tela diz "lista, N itens" e a posição de cada fase.
 */
import { m, type Variants } from "framer-motion";
import { MOLA, PASSO_DA_CASCATA } from "@/lib/oportunidades/molas";
import { Movimento } from "./Movimento";

export interface FaseVista {
  rotulo: string;
  /** A data já escrita para ler ("12/03/2024"). */
  desde: string;
}

const LISTA: Variants = { oculto: {}, visivel: { transition: { staggerChildren: PASSO_DA_CASCATA * 2, delayChildren: 0.05 } } };
const ETAPA: Variants = { oculto: { opacity: 0, x: -10 }, visivel: { opacity: 1, x: 0, transition: MOLA.suave } };
const PONTO: Variants = { oculto: { scale: 0 }, visivel: { scale: 1, transition: MOLA.pin } };

export function FasesAnimadas({ fases }: { fases: readonly FaseVista[] }) {
  const ultima = fases.length - 1;
  return (
    <Movimento>
      <m.ol className="mp-fases" variants={LISTA} initial="oculto" animate="visivel">
        {fases.map((f, i) => (
          <m.li key={`${i}-${f.rotulo}`} className={i === ultima ? "mp-fase mp-fase-atual" : "mp-fase"} variants={ETAPA} data-mp-mov="">
            <m.span className="mp-fase-ponto" variants={PONTO} data-mp-mov="" aria-hidden="true" />
            <span className="mp-fase-texto">
              <strong>{f.rotulo}</strong>
              <span className="pa-mono mp-fase-desde">
                {i === ultima ? "fase atual, desde " : "desde "}
                {f.desde}
              </span>
            </span>
          </m.li>
        ))}
      </m.ol>
    </Movimento>
  );
}
