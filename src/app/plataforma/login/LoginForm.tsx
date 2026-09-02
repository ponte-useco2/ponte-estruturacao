"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginPlataforma } from "./actions";

export function LoginForm() {
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const params = useSearchParams();
  const proximo = params.get("next") || "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    setErro("");
    setEnviando(true);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await loginPlataforma(fd);
      if (!r.success) {
        setErro(r.error || "Não foi possível entrar.");
        setEnviando(false);
      }
      // Sucesso: o redirect do server action assume daqui
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pl-card" noValidate>
      {erro && (
        <div role="alert" aria-live="polite" className="pl-erro">
          {erro}
        </div>
      )}

      <input type="hidden" name="next" value={proximo} />

      {/*
        Honeypot. Fora da ordem de tabulação e escondido do leitor de tela,
        para não confundir quem navega por teclado ou por voz — só um bot que
        varre o DOM preenche isto.
      */}
      <div className="pl-armadilha" aria-hidden="true">
        <label htmlFor="pl-empresa">Empresa</label>
        <input id="pl-empresa" name="empresa" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="pl-label" htmlFor="pl-usuario">
        Usuário
      </label>
      <input
        id="pl-usuario"
        name="usuario"
        type="text"
        required
        autoFocus
        autoComplete="username"
        className="pl-input"
      />

      <label className="pl-label" htmlFor="pl-senha">
        Senha
      </label>
      <input
        id="pl-senha"
        name="senha"
        type="password"
        required
        autoComplete="current-password"
        className="pl-input"
      />

      <button type="submit" disabled={enviando} className="pl-btn">
        {enviando ? "Entrando…" : "Entrar na plataforma"}
      </button>

      <p className="pl-nota">
        Área reservada à diretoria da PONTE. O protótipo trabalha com dados
        ilustrativos — nada aqui é decisão registrada.
      </p>
    </form>
  );
}
