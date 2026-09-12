"use client";

/**
 * Menu de conta do Mapa — sessão REAL.
 *
 * Substitui o `MenuPerfil` do protótipo, que lia um perfil fictício de
 * `_lib/fixtures` e cujo "sair" apenas limpava estado local em memória. Aqui o
 * que aparece vem do Supabase e o que sai, sai de verdade: `signOut` derruba o
 * cookie de sessão antes de navegar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function inicial(nome: string | null, email: string): string {
  const base = (nome ?? email).trim();
  return (base[0] ?? "?").toUpperCase();
}

export function ContaMenu({ email, nome }: { email: string; nome: string | null }) {
  const pathname = usePathname() ?? "/mapa";

  // Guarda em QUAL rota o menu foi aberto: navegar muda o pathname e o menu
  // fecha sozinho, sem efeito que sincronize estado depois da renderização.
  // Padrão herdado do MenuPerfil do protótipo, que resolveu bem o problema.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === pathname;

  const [saindo, setSaindo] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const onClique = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAbertoEm(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertoEm(null);
    };
    document.addEventListener("mousedown", onClique);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClique);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  const sair = useCallback(async () => {
    if (saindo) return;
    setSaindo(true);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anon) {
      await createBrowserClient(url, anon).auth.signOut();
    }

    // `window.location` e não `router.push`: a sessão vive em cookie lido pelo
    // servidor, e só uma navegação de documento inteiro garante que a próxima
    // resposta já venha sem ela. Com navegação de cliente, o cache do roteador
    // poderia servir uma tela ainda logada. Mesmo critério do `SairBotao` da
    // sala de espera, que já saía assim.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- sair precisa descartar o cache do roteador, não só navegar
    window.location.href = "/oportunidades/entrar";
  }, [saindo]);

  return (
    <div className="pa-menu-wrap pa-perfil-wrap" ref={wrapRef}>
      <button
        type="button"
        className="pa-perfil-chip"
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => setAbertoEm(aberto ? null : pathname)}
        title={email}
      >
        <span aria-hidden="true">{inicial(nome, email)}</span>
        <span className="pa-esconde-mobile mp-conta-nome">{nome ?? email}</span>
      </button>

      {aberto && (
        <div className="pa-menu">
          <p className="pa-mono pa-menu-grupo">Conta</p>
          <p className="mp-conta-email">{email}</p>

          <div className="pa-menu-sep" />
          <Link href="/privacidade">Aviso de privacidade</Link>
          <Link href="/termos">Termos de uso</Link>

          <div className="pa-menu-sep" />
          <button type="button" className="pa-menu-sair" onClick={sair} disabled={saindo}>
            {saindo ? "Saindo…" : "Sair"}
          </button>
        </div>
      )}
    </div>
  );
}
