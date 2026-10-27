"use client";

/**
 * Uma barra que cresce com mola até a fração (onda 16, M2). A largura final vem do servidor, no estilo; o movimento é
 * só `scaleX` de 0 a 1, a partir da esquerda, com a mola `barra`. Assim o navegador não refaz o layout a cada quadro, e
 * no papel ou sem JavaScript (transform desligado em `transicoes.css`) a barra aparece parada na fração certa. Sem dado
 * (`null`), a trilha fica vazia e quem chama escreve "sem dado".
 */
import { m } from "framer-motion";
import { MOLA } from "@/lib/oportunidades/molas";
import { Movimento } from "./Movimento";

export function BarraMola({ fracao, atraso = 0, tom = "marca" }: { fracao: number | null; atraso?: number; tom?: "marca" | "claro" | "neutro" }) {
  const alvo = fracao === null ? 0 : Math.max(0, Math.min(1, fracao));
  return (
    <Movimento>
      <span className={`mp-mola-trilha mp-mola-${tom}`} aria-hidden="true">
        <m.span
          className="mp-mola-cheia"
          data-mp-mov=""
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ ...MOLA.barra, delay: atraso }}
          style={{ originX: 0, width: `${alvo * 100}%` }}
        />
      </span>
    </Movimento>
  );
}
