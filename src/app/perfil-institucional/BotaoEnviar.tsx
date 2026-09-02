"use client";

import { useState, useTransition } from "react";
import { enviarPerfil } from "./enviar";
import type { Respostas } from "./rascunho";

/**
 * Envio do perfil à Ponte.
 *
 * Componente próprio, e não mais um botão dentro do FormularioPerfil, por um
 * motivo prático: assim o arquivo do formulário — que tem quatrocentas linhas
 * de estrutura de campos — não precisa carregar estado de envio, erro e
 * confirmação. Quem mexer nos campos amanhã não esbarra nisto.
 *
 * O botão "Copiar respostas" continua existindo ao lado. É a rede: se o envio
 * falhar, a instituição ainda consegue mandar o conteúdo por e-mail em vez de
 * perder o preenchimento.
 */
export function BotaoEnviar({ respostas }: { respostas: Respostas }) {
  const [enviando, iniciar] = useTransition();
  const [estado, setEstado] = useState<"parado" | "enviado">("parado");
  const [erro, setErro] = useState("");

  function enviar() {
    setErro("");
    iniciar(async () => {
      const r = await enviarPerfil(respostas);
      if (r.ok) {
        setEstado("enviado");
      } else {
        setErro(r.erro || "Não foi possível enviar.");
      }
    });
  }

  return (
    <div className="pfi-envio pfi-noprint">
      {/* Estilos locais: evita mexer no estilos.ts, que é o arquivo do design
          do formulário e não deveria mudar por causa de um botão novo. */}
      <style>{`
        .pfi-envio { margin-top: 14px; }
        .pfi-envio-erro {
          background: rgba(180, 60, 40, .07);
          border: 1px solid #b43c28; color: #8e2f1f;
          border-radius: 8px; padding: 10px 14px;
          font-size: 14px; line-height: 1.5; margin-bottom: 12px;
        }
        .pfi-envio-ok {
          background: rgba(60, 120, 80, .08);
          border: 1px solid #3c7850; color: #2c5a3c;
          border-radius: 8px; padding: 14px 16px;
          font-size: 14.5px; line-height: 1.55; margin-top: 14px;
        }
      `}</style>

      {estado === "enviado" ? (
        <div className="pfi-envio-ok" role="status">
          <strong>Perfil enviado.</strong> A Ponte recebeu suas respostas e entra em
          contato. As informações continuam salvas neste navegador, caso queira
          revisar ou completar depois.
        </div>
      ) : (
        <>
          {erro && (
            <div className="pfi-envio-erro" role="alert">
              {erro}
            </div>
          )}
          <button
            type="button"
            className="pfi-btn"
            onClick={enviar}
            disabled={enviando}
          >
            {enviando ? "Enviando…" : "Enviar para a Ponte"}
          </button>
        </>
      )}
    </div>
  );
}
