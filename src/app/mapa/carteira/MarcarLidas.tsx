"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarItensLidos } from "../acoes";

/** Marca como lidas as mudanças mostradas. A carteira recarrega e elas saem de "O que mudou". */
export function MarcarLidas({ ids, rotulo = "Marcar como lidas" }: { ids: string[]; rotulo?: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  if (!ids.length) return null;
  return (
    <span className="mp-cart-marcar">
      <button
        type="button"
        className="pa-btn pa-btn-pequeno"
        disabled={salvando}
        onClick={() =>
          iniciar(async () => {
            const r = await marcarItensLidos(ids);
            if (!r.ok) setErro(r.erro ?? "Não foi possível marcar.");
            else router.refresh();
          })
        }
      >
        {salvando ? "Marcando…" : rotulo}
      </button>
      {erro && <span className="pa-nota" role="status">{erro}</span>}
    </span>
  );
}
