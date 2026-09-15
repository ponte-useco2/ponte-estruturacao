"use client";

import { useState, useTransition } from "react";
import { decidirVinculo } from "./acoes";

export function LinhaVinculo({
  id,
  organizacao,
  municipio,
  membros,
  situacao,
  confirmado,
  podeConfirmar,
}: {
  id: string;
  organizacao: string;
  municipio: string;
  membros: string;
  situacao: string;
  confirmado: boolean;
  podeConfirmar: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  function decidir(confirmar: boolean) {
    setErro("");
    iniciar(async () => {
      const r = await decidirVinculo(id, confirmar);
      if (!r.ok) setErro(r.erro || "Não consegui salvar.");
    });
  }

  return (
    <tr>
      <td className="op-adm-email">
        {organizacao}
        <span className="op-adm-nome">{membros}</span>
        {erro && (
          <span className="op-adm-nome" style={{ color: "#A44C2E" }} role="alert">
            {erro}
          </span>
        )}
      </td>
      <td className="op-adm-num">
        {municipio}
        <span className="op-adm-nome">{situacao}</span>
      </td>
      <td className="op-adm-acoes">
        {podeConfirmar && !confirmado && (
          <button type="button" className="op-adm-btn sim" disabled={pendente} onClick={() => decidir(true)}>
            {pendente ? "…" : "Confirmar"}
          </button>
        )}
        {confirmado && (
          <button type="button" className="op-adm-btn nao" disabled={pendente} onClick={() => decidir(false)}>
            {pendente ? "…" : "Desfazer"}
          </button>
        )}
      </td>
    </tr>
  );
}
