"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Botão de entrada com Google.
 *
 * Roda no cliente porque o OAuth precisa navegar o navegador até o Google. A
 * chave usada é a ANÔNIMA — a única que pode aparecer aqui. Ela não concede
 * nada por si: quem decide o que a pessoa vê são as políticas de RLS e a
 * verificação de status no servidor.
 */
export function BotaoGoogle({ proximo }: { proximo?: string }) {
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar() {
    if (indo) return;
    setIndo(true);
    setErro("");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      setErro("Entrada indisponível: o servidor ainda não foi configurado.");
      setIndo(false);
      return;
    }

    const supabase = createBrowserClient(url, anon);
    const destino = new URL("/auth/callback", window.location.origin);
    if (proximo) destino.searchParams.set("next", proximo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: destino.toString(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setErro("Não consegui abrir a entrada do Google. Tente novamente.");
      setIndo(false);
    }
  }

  return (
    <>
      {erro && (
        <div role="alert" className="op-entrar-erro">
          {erro}
        </div>
      )}
      <button type="button" onClick={entrar} disabled={indo} className="op-entrar-btn">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/>
          <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z"/>
          <path fill="#FBBC05" d="M11.7 28.1c-.5-1.4-.8-2.9-.8-4.1s.3-2.7.8-4.1V14H4.4C2.9 17 2 20.4 2 24s.9 7 2.4 10l7.3-5.9z"/>
          <path fill="#EA4335" d="M24 10.9c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.3 29.9 2 24 2 15.4 2 8 6.9 4.4 14l7.3 5.7c1.7-5.2 6.6-8.8 12.3-8.8z"/>
        </svg>
        {indo ? "Abrindo o Google…" : "Entrar com Google"}
      </button>
    </>
  );
}
