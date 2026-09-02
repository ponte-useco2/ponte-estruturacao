"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/** Encerra a sessão e volta à tela de entrada, permitindo trocar de conta. */
export function SairBotao() {
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anon) {
      const supabase = createBrowserClient(url, anon);
      await supabase.auth.signOut();
    }
    window.location.href = "/oportunidades/entrar";
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      className="op-entrar-voltar"
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        font: "inherit",
        fontSize: 13,
        textDecoration: "underline",
        display: "block",
      }}
    >
      {saindo ? "Saindo…" : "Sair e entrar com outra conta"}
    </button>
  );
}
