import { LoginForm } from "./LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso reservado — Workspace do Instituidor | HUB Bananeiras",
  robots: { index: false, follow: false },
};

export default function HubBananeirasLoginPage() {
  return (
    <>
      {/* Tipografia do HUB: Newsreader no display, Plus Jakarta no corpo */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@1,6..72,500;1,6..72,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div className="hb-root">
        <div className="hb-wrap">
          <div className="hb-marca">PONTE × HUB BANANEIRAS</div>
          <h1 className="hb-titulo">Workspace do Instituidor</h1>
          <p className="hb-sub">
            Governance Graph &amp; Decision Ledger — Brejo Paraibano
          </p>

          <LoginForm />

          <a className="hb-voltar" href="/hub-bananeiras">
            ← Voltar à apresentação do HUB
          </a>
        </div>
      </div>

      <style>{`
        .hb-root {
          min-height: 100vh;
          background: #070a0d;
          color: #eceff2;
          font-family: "Plus Jakarta Sans", -apple-system, sans-serif;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 20px;
        }
        .hb-wrap { width: 100%; max-width: 420px; }
        .hb-marca {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
          color: #c59b27; margin-bottom: 14px;
        }
        .hb-titulo {
          font-family: "Newsreader", Georgia, serif;
          font-style: italic; font-weight: 600;
          font-size: 34px; line-height: 1.15; letter-spacing: -.01em;
          margin: 0 0 8px; color: #ffffff;
        }
        .hb-sub {
          font-size: 14px; color: #87a0b4; margin: 0 0 30px; line-height: 1.5;
        }
        .hb-card {
          background: #0f151b;
          border: 1px solid #3a4a59;
          border-radius: 10px;
          padding: 26px 24px;
        }
        .hb-label {
          display: block; font-size: 12px; font-weight: 600;
          letter-spacing: .04em; text-transform: uppercase;
          color: #87a0b4; margin-bottom: 6px;
        }
        .hb-input {
          width: 100%; box-sizing: border-box;
          padding: 11px 14px; margin-bottom: 18px;
          background: #070a0d; color: #eceff2;
          border: 1px solid #43586b; border-radius: 7px;
          font: inherit; font-size: 15px;
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }
        .hb-input:focus {
          outline: none; border-color: #c59b27;
          box-shadow: 0 0 0 3px rgba(197,155,39,.16);
        }
        .hb-btn {
          width: 100%; padding: 12px 20px;
          background: #c59b27; color: #070a0d;
          border: none; border-radius: 7px;
          font: inherit; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: background 140ms ease;
        }
        .hb-btn:hover:not(:disabled) { background: #e4be57; }
        .hb-btn:disabled { opacity: .6; cursor: not-allowed; }
        .hb-btn:focus-visible { outline: 2px solid #e4be57; outline-offset: 2px; }
        .hb-erro {
          background: rgba(217,119,6,.12);
          border: 1px solid #d97706; color: #e4be57;
          border-radius: 7px; padding: 10px 14px;
          font-size: 13.5px; margin-bottom: 18px; line-height: 1.5;
        }
        .hb-nota {
          font-size: 12.5px; color: #67849d;
          margin: 18px 0 0; line-height: 1.55;
        }
        .hb-voltar {
          display: inline-block; margin-top: 24px;
          font-size: 13px; color: #87a0b4; text-decoration: none;
        }
        .hb-voltar:hover { color: #c59b27; }
      `}</style>
    </>
  );
}
