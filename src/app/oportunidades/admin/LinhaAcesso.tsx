"use client";

import { useState, useTransition } from "react";
import { decidirAcesso } from "./acoes";

export function LinhaAcesso({
  id,
  email,
  nome,
  quando,
  status,
}: {
  id: string;
  email: string;
  nome: string | null;
  quando: string;
  status: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  function decidir(novo: "aprovado" | "bloqueado" | "pendente") {
    setErro("");
    iniciar(async () => {
      const r = await decidirAcesso(id, novo);
      if (!r.ok) setErro(r.erro || "Não consegui salvar.");
    });
  }

  return (
    <tr>
      <td className="op-adm-email">
        {email}
        {nome && <span className="op-adm-nome">{nome}</span>}
        {erro && (
          <span className="op-adm-nome" style={{ color: "#A44C2E" }} role="alert">
            {erro}
          </span>
        )}
      </td>
      <td className="op-adm-num">{quando}</td>
      <td className="op-adm-acoes">
        {status !== "aprovado" && (
          <button
            type="button"
            className="op-adm-btn sim"
            disabled={pendente}
            onClick={() => decidir("aprovado")}
          >
            {pendente ? "…" : "Liberar"}
          </button>
        )}
        {status !== "bloqueado" && (
          <button
            type="button"
            className="op-adm-btn nao"
            disabled={pendente}
            onClick={() => decidir("bloqueado")}
          >
            {status === "aprovado" ? "Revogar" : "Recusar"}
          </button>
        )}
        {status === "bloqueado" && (
          <button
            type="button"
            className="op-adm-btn"
            disabled={pendente}
            onClick={() => decidir("pendente")}
          >
            Reabrir
          </button>
        )}
      </td>
    </tr>
  );
}
