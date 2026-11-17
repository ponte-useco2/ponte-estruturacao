"use client";

/**
 * As peças do portal que precisam do navegador (versão 2, 17/11/2026). Tudo tem um caminho sem JavaScript: o menu e o
 * conteúdo saem prontos do servidor (o `usePathname` roda também lá); o "Copiar link" tem o endereço visível ao lado; o
 * foco na linha é só um conforto da volta da ficha.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ITENS_DO_MENU, ehPercurso, itemAtual } from "./menu";

/** O menu principal, com `aria-current` na seção aberta. */
export function NavPortal() {
  const caminho = usePathname() ?? "";
  return (
    <nav aria-label="Principal" className="nav-principal t16">
      <ul>
        {ITENS_DO_MENU.filter((i) => i.noMenu).map((i) => (
          <li key={i.href}>
            <Link prefetch={false} href={i.href} aria-current={itemAtual(caminho, i.href) ? "page" : undefined}>
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * O conteúdo de cada página: as telas do percurso usam a identidade da v2 direto; as páginas de apoio da v1 (dados,
 * método, perguntas…) ficam no design system do Mapa, dentro de `.pa-root.mp-root.em-apoio`.
 */
export function ConteudoDoPortal({ children }: { children: ReactNode }) {
  const caminho = usePathname() ?? "";
  return <div className={ehPercurso(caminho) ? "conteudo-percurso" : "pa-root mp-root em-apoio"}>{children}</div>;
}

/** "Copiar link": copia o endereço do recorte (o mesmo da linha visível ao lado) e avisa no status. */
export function CopiarLink({ caminho, rotulo = "Copiar link" }: { caminho: string; rotulo?: string }) {
  const [retorno, setRetorno] = useState("");
  const copiar = async () => {
    const link = `${window.location.origin}${caminho}`;
    try {
      await navigator.clipboard.writeText(link);
      setRetorno("Link copiado.");
    } catch {
      setRetorno("Não foi possível copiar; o endereço está logo abaixo.");
    }
  };
  return (
    <>
      <button className="btn t14" type="button" onClick={copiar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
        {rotulo}
      </button>
      <span className="t14" role="status" aria-live="polite" style={{ fontWeight: 600 }}>
        {retorno}
      </span>
    </>
  );
}

/**
 * A volta da ficha chega com `#linha-N`: o foco vai para o código da emenda daquela linha, que fica marcada por 3 s (sem
 * animação com movimento reduzido), e o fragmento sai do endereço, que volta a ser exatamente o do recorte.
 */
export function FocoNaLinha() {
  useEffect(() => {
    const m = /^#linha-(\d{1,9})$/.exec(window.location.hash);
    if (!m) return;
    const linha = document.getElementById(`linha-${m[1]}`);
    const alvo = document.getElementById(`abrir-${m[1]}`) ?? linha;
    if (!linha || !alvo) return;
    linha.classList.add("marcada");
    alvo.focus({ preventScroll: false });
    linha.scrollIntoView({ block: "center" });
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    const t = window.setTimeout(() => linha.classList.remove("marcada"), 3000);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

/**
 * O índice "Nesta ficha" leva a cada seção por âncora (funciona sem JavaScript); aqui o foco vai para o título da seção
 * (`tabIndex={-1}`), para o leitor de tela e o teclado continuarem dali.
 */
export function FocoNoFragmento() {
  useEffect(() => {
    const focar = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const alvo = id ? document.getElementById(id) : null;
      if (alvo && alvo.getAttribute("tabindex") === "-1") alvo.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", focar);
    return () => window.removeEventListener("hashchange", focar);
  }, []);
  return null;
}
