"use client";

import { useState } from "react";
import { loginHubBananeiras } from "./actions";

export function LoginForm() {
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    setErro("");
    setEnviando(true);
    const fd = new FormData(e.currentTarget);
    const r = await loginHubBananeiras(fd);
    if (!r.success) {
      setErro(r.error || "Falha ao entrar.");
      setEnviando(false);
    }
    // Em caso de sucesso o redirect do server action assume
  }

  return (
    <form onSubmit={handleSubmit} className="hb-card">
      {erro && (
        <div role="alert" className="hb-erro">
          {erro}
        </div>
      )}

      <label className="hb-label" htmlFor="hb-usuario">
        Usuário
      </label>
      <input
        id="hb-usuario"
        name="usuario"
        type="text"
        required
        autoFocus
        autoComplete="username"
        className="hb-input"
      />

      <label className="hb-label" htmlFor="hb-senha">
        Senha
      </label>
      <input
        id="hb-senha"
        name="senha"
        type="password"
        required
        autoComplete="current-password"
        className="hb-input"
      />

      <button type="submit" disabled={enviando} className="hb-btn">
        {enviando ? "Entrando…" : "Acessar o Workspace"}
      </button>

      <p className="hb-nota">
        Ambiente reservado aos instituidores do HUB. As deliberações registradas
        aqui compõem o Decision Ledger da fundação.
      </p>
    </form>
  );
}
