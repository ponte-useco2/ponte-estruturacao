"use client";

import { useEffect } from "react";

/**
 * Os grupos que o papel abre: os mesmos das regras `::details-content` de impressão do mapa.css (a lista recolhida do
 * laudo e do fiscal, os grupos da carteira da entidade, da UF e do explorador, e os anos da linha do tempo do convênio).
 * Quem acrescentar um grupo aqui acrescenta lá também, e vice-versa.
 */
const ABRE_NO_PAPEL = ".mp-root details:is(.mp-fiscal-detalhe, .mp-ent-grupo, .mp-linha-ano):not([open])";

/**
 * Abre os grupos fechados antes de imprimir e fecha de novo depois (onda 8, C, 09/10/2026; N21 da auditoria R1).
 *
 * O mapa.css já abria esses grupos no papel por `::details-content`, que só o Chromium conhece. No Firefox e no Safari o
 * relatório da entidade saía sem os grupos fechados da carteira, e os anos fechados da linha do tempo do convênio não
 * tinham regra nenhuma. O evento `beforeprint` vale nos três: os grupos abrem de verdade (o ▾ do resumo acompanha), e o
 * `afterprint` fecha só os que este componente abriu, para a tela voltar como estava.
 *
 * Mora na moldura (`MapaFrame`), uma vez só, e não desenha nada.
 */
export function AbrirAoImprimir() {
  useEffect(() => {
    let abertos: HTMLDetailsElement[] = [];
    const antes = () => {
      abertos = Array.from(document.querySelectorAll<HTMLDetailsElement>(ABRE_NO_PAPEL));
      for (const d of abertos) d.open = true;
    };
    const depois = () => {
      for (const d of abertos) if (d.isConnected) d.open = false;
      abertos = [];
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
    };
  }, []);
  return null;
}
