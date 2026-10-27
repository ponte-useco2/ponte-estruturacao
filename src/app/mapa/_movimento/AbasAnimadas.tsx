"use client";

/**
 * As abas de uma página de nível com o sublinhado que desliza de uma aba para a outra (onda 16, M2, 27/10/2026;
 * `layoutId`). O sublinhado é um elemento só: o Framer Motion mede onde ele estava e anima até a aba nova, com a mola
 * `firme`. A aba aberta continua sendo a do servidor (`atual`), então o sublinhado só anda quando a página chega.
 *
 * Mesmo desenho e mesmas regras das abas de antes (`mp-mun-abas`, `LinkMapa`, `scroll={false}`, `aria-current`). Sem
 * JavaScript, ou com movimento reduzido, o sublinhado aparece direto na aba aberta.
 */
import { m } from "framer-motion";
import { MOLA } from "@/lib/oportunidades/molas";
import { LinkMapa } from "../_componentes/LinkMapa";
import { Movimento } from "./Movimento";

export interface AbaAnimada {
  id: string;
  nome: string;
  href: string;
}

export function AbasAnimadas({ abas, atual, rotulo, grupo }: { abas: readonly AbaAnimada[]; atual: string; rotulo: string; grupo: string }) {
  return (
    <Movimento recursos="completo">
      <nav aria-label={rotulo} className="mp-mun-abas mp-abas-mola mp-nao-imprimir">
        {abas.map((a) => (
          <LinkMapa key={a.id} href={a.href} aria-current={a.id === atual ? "page" : undefined} scroll={false}>
            {a.nome}
            {a.id === atual && <m.span layoutId={`mp-aba-sob-${grupo}`} className="mp-aba-sob" transition={MOLA.firme} aria-hidden="true" />}
          </LinkMapa>
        ))}
      </nav>
    </Movimento>
  );
}
