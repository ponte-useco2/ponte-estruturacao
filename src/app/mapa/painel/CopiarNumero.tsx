"use client";

/**
 * Copia o número do convênio ou o código do programa. É o que se digita na
 * consulta pública do Transferegov, que não tem endereço por convênio.
 *
 * Onda 7, C (09/10/2026; N05 da auditoria R1, WCAG 4.1.3 e 2.5.3):
 * - a região viva ("Número … copiado.") saiu de dentro do botão: o conteúdo de um `<button>` é apresentacional, e o
 *   aviso podia não chegar ao leitor de tela. Agora fica ao lado, sempre no DOM, vazia até a cópia;
 * - o nome do botão começa pelo texto à vista ("copiar nº", e o item em texto oculto), para quem comanda por voz; o
 *   `aria-label` "Copiar o número do convênio …" não continha "copiar nº";
 * - o alvo tem 44 px na página do convênio e na da proposta (mapa.css, `.pa-kicker .mp-painel-copiar`).
 */
import { useState } from "react";
import { copiarTexto } from "@/lib/area-de-transferencia";

export function CopiarNumero({ numero, de = "convênio" }: { numero: string; de?: "convênio" | "programa" | "proposta" }) {
  const [estado, setEstado] = useState<"copiado" | "falhou" | null>(null);
  return (
    <>
      <button
        type="button"
        className="mp-painel-copiar"
        onClick={async () => setEstado((await copiarTexto(numero)) ? "copiado" : "falhou")}
      >
        {estado === "copiado" ? (
          <>
            copiado<span aria-hidden="true"> ✓</span>
          </>
        ) : estado === "falhou" ? (
          "não copiou"
        ) : (
          <>
            copiar nº
            <span className="pa-sr">
              {" "}
              {de === "proposta" ? "da" : "do"} {de} {numero}
            </span>
          </>
        )}
      </button>
      <span className="pa-sr" role="status">
        {estado === "copiado" ? `Número ${numero} copiado.` : estado === "falhou" ? "O navegador bloqueou a cópia." : ""}
      </span>
    </>
  );
}
