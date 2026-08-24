import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Acesso reservado — Plataforma PONTE",
  robots: { index: false, follow: false },
};

/**
 * Login da área reservada da Plataforma.
 *
 * Os tokens vêm de globals.css (--color-pl-*), os mesmos de
 * public/plataforma.html — com literais como fallback, porque esta página
 * não carrega o estilos.css do app logado e não pode depender dele.
 */
export default function PlataformaLoginPage() {
  return (
    <div className="pl-root">
      <div className="pl-wrap">
        <div className="pl-marca">PONTE ESTRUTURAÇÃO DE PROJETOS</div>
        <h1 className="pl-titulo">Plataforma</h1>
        <p className="pl-sub">
          Descobrir capital, apresentar capacidade, compor coalizão e construir
          com evidência.
        </p>

        {/*
          useSearchParams() obriga a Suspense no App Router: sem isso o build
          falha ao pré-renderizar. Já quebrou o deploy do checkout antes.
        */}
        <Suspense fallback={<div className="pl-card pl-card-vazio" />}>
          <LoginForm />
        </Suspense>

        <a className="pl-voltar" href="/plataforma">
          ← Voltar à apresentação
        </a>
      </div>

      <style>{`
        .pl-root {
          min-height: 100dvh;
          background: var(--color-pl-bg, #f7f8f5);
          color: var(--color-pl-text, #13201d);
          font-family: var(--font-pl-body, Inter), -apple-system, "Segoe UI", sans-serif;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 20px;
        }
        .pl-wrap { width: 100%; max-width: 420px; }
        .pl-marca {
          font-family: var(--font-pl-mono, ui-monospace), monospace;
          font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase;
          color: var(--color-pl-brand-2, #1e5446); margin-bottom: 14px;
        }
        .pl-titulo {
          font-family: var(--font-pl-display, "Plus Jakarta Sans"), sans-serif;
          font-weight: 700; font-size: 34px; line-height: 1.15;
          letter-spacing: -.02em; margin: 0 0 8px;
          color: var(--color-pl-brand, #0f2d26);
        }
        .pl-sub {
          font-size: 14.5px; color: var(--color-pl-muted, #576561);
          margin: 0 0 28px; line-height: 1.55;
        }
        .pl-card {
          background: var(--color-pl-surface, #fff);
          border: 1px solid var(--color-pl-border, #d4ded9);
          border-radius: 1.1rem;
          padding: 26px 24px;
        }
        .pl-card-vazio { min-height: 316px; }
        .pl-label {
          display: block; font-size: 11.5px; font-weight: 600;
          letter-spacing: .06em; text-transform: uppercase;
          color: var(--color-pl-muted, #576561); margin-bottom: 6px;
        }
        .pl-input {
          width: 100%; box-sizing: border-box;
          padding: 11px 14px; margin-bottom: 18px;
          background: var(--color-pl-bg, #f7f8f5);
          color: var(--color-pl-text, #13201d);
          border: 1px solid var(--color-pl-border, #d4ded9);
          border-radius: .6rem;
          font: inherit; font-size: 15px;
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }
        .pl-input:focus {
          outline: none;
          border-color: var(--color-pl-brand-2, #1e5446);
          box-shadow: 0 0 0 3px rgba(30,84,70,.15);
        }
        .pl-btn {
          width: 100%; padding: 12px 20px;
          background: var(--color-pl-brand, #0f2d26); color: #fff;
          border: none; border-radius: .6rem;
          font: inherit; font-size: 15px; font-weight: 600;
          cursor: pointer; transition: background 140ms ease;
        }
        .pl-btn:hover:not(:disabled) { background: var(--color-pl-brand-2, #1e5446); }
        .pl-btn:disabled { opacity: .55; cursor: not-allowed; }
        .pl-btn:focus-visible {
          outline: 2px solid var(--color-pl-brand-2, #1e5446); outline-offset: 2px;
        }
        .pl-erro {
          background: rgba(138,75,66,.09);
          border: 1px solid var(--color-pl-danger, #8a4b42);
          color: var(--color-pl-danger, #8a4b42);
          border-radius: .6rem; padding: 10px 14px;
          font-size: 13.5px; margin-bottom: 18px; line-height: 1.5;
        }
        .pl-nota {
          font-size: 12.5px; color: var(--color-pl-muted, #576561);
          margin: 18px 0 0; line-height: 1.55;
        }
        .pl-voltar {
          display: inline-block; margin-top: 22px;
          font-size: 13px; color: var(--color-pl-muted, #576561);
          text-decoration: none;
        }
        .pl-voltar:hover { color: var(--color-pl-brand, #0f2d26); }
        /* Honeypot: fora da tela, nunca display:none — há bots que ignoram
           campos ocultos, e leitores de tela já estão cobertos pelo aria-hidden. */
        .pl-armadilha {
          position: absolute; left: -9999px;
          width: 1px; height: 1px; overflow: hidden;
        }
      `}</style>
    </div>
  );
}
