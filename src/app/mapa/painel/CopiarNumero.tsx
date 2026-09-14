"use client";

/**
 * Copia o número do convênio. É o que se digita na consulta pública do
 * Transferegov, que não tem endereço por convênio.
 */
import { useState } from "react";
import { copiarTexto } from "@/lib/area-de-transferencia";

export function CopiarNumero({ numero }: { numero: string }) {
  const [estado, setEstado] = useState<"copiado" | "falhou" | null>(null);
  return (
    <button
      type="button"
      className="mp-painel-copiar"
      onClick={async () => setEstado((await copiarTexto(numero)) ? "copiado" : "falhou")}
      aria-label={`Copiar o número do convênio ${numero}`}
    >
      {estado === "copiado" ? "copiado ✓" : estado === "falhou" ? "não copiou" : "copiar nº"}
      <span className="pa-sr" role="status">
        {estado === "copiado" ? `Número ${numero} copiado.` : estado === "falhou" ? "O navegador bloqueou a cópia." : ""}
      </span>
    </button>
  );
}
