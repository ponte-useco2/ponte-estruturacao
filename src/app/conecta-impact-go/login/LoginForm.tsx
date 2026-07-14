"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle, LogIn } from "lucide-react";
import { loginConectaImpact } from "./actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/conecta-impact-go";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const result = await loginConectaImpact(fd);
    if (!result.success) {
      setError(result.error || "Falha ao entrar.");
      setPending(false);
    }
    // Se sucesso, o redirect() do server action já leva embora
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E3E0D5",
        borderRadius: 12,
        padding: 28,
        fontFamily: "'Instrument Sans', sans-serif",
      }}
    >
      <input type="hidden" name="next" value={next} />

      {error && (
        <div
          role="alert"
          style={{
            background: "#FBF2EA",
            border: "1px solid #EBCDB2",
            color: "#8F430E",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="usuario"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "#3B4640",
            marginBottom: 6,
            letterSpacing: "0.02em",
          }}
        >
          Usuário
        </label>
        <input
          id="usuario"
          name="usuario"
          type="text"
          required
          autoComplete="username"
          autoFocus
          style={{
            width: "100%",
            padding: "10px 14px",
            border: "1px solid #D4D1C6",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "'Instrument Sans', sans-serif",
            outline: "none",
            background: "#F6F5F0",
          }}
        />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label
          htmlFor="senha"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "#3B4640",
            marginBottom: 6,
            letterSpacing: "0.02em",
          }}
        >
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoComplete="current-password"
          style={{
            width: "100%",
            padding: "10px 14px",
            border: "1px solid #D4D1C6",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "'Instrument Sans', sans-serif",
            outline: "none",
            background: "#F6F5F0",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%",
          padding: "12px 20px",
          background: pending ? "#5A9385" : "#0E7A5F",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: pending ? "not-allowed" : "pointer",
          fontFamily: "'Instrument Sans', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "background 0.15s",
        }}
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            <LogIn size={16} />
            Entrar
          </>
        )}
      </button>

      <p
        style={{
          marginTop: 20,
          fontSize: 12,
          color: "#7A8177",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        Área privada operacional. Acesso apenas à coordenação do projeto.
      </p>
    </form>
  );
}
