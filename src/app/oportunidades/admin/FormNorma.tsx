"use client";

/**
 * Publicar e apagar normas do mural de avisos (onda 7). A validação que vale é a da ação;
 * a tela só mostra a frase que ela devolve.
 */
import { useRef, useState, useTransition } from "react";
import { TEMAS_RAIZ } from "@/lib/oportunidades/temas";
import { apagarNorma, cadastrarNorma } from "./acoes";

export function FormNorma() {
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);

  function publicar(dados: FormData) {
    setMensagem(null);
    iniciar(async () => {
      const r = await cadastrarNorma({
        titulo: dados.get("titulo"),
        orgao: dados.get("orgao"),
        publicada_em: dados.get("publicada_em"),
        link: dados.get("link"),
        resumo: dados.get("resumo"),
        temas: dados.getAll("temas"),
      });
      if (!r.ok) {
        setMensagem({ ok: false, texto: r.erro || "Não consegui publicar." });
        return;
      }
      form.current?.reset();
      setMensagem({ ok: true, texto: "Norma publicada no mural." });
    });
  }

  return (
    <form ref={form} action={publicar} className="op-adm-norma">
      <label>
        Título
        <input name="titulo" required minLength={3} maxLength={300} placeholder="Portaria Conjunta MGI/MF/CGU nº 33, de 2026" />
      </label>
      <div className="op-adm-norma-linha">
        <label>
          Órgão
          <input name="orgao" maxLength={200} placeholder="MGI" />
        </label>
        <label>
          Publicada em
          <input name="publicada_em" type="date" required />
        </label>
      </div>
      <label>
        Link do texto oficial
        <input name="link" type="url" required pattern="https://.*" maxLength={500} placeholder="https://www.in.gov.br/..." />
      </label>
      <label>
        Resumo
        <textarea name="resumo" maxLength={1000} rows={3} placeholder="O que muda para quem capta recursos, em uma ou duas frases." />
      </label>
      <fieldset>
        <legend>Temas (opcional)</legend>
        <div className="op-adm-norma-temas">
          {TEMAS_RAIZ.map((t) => (
            <label key={t.id}>
              <input type="checkbox" name="temas" value={t.id} /> {t.rotulo}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <button type="submit" className="op-adm-btn sim" disabled={pendente}>
          {pendente ? "Publicando…" : "Publicar no mural"}
        </button>
        <span role="status" className="op-adm-nome" style={{ display: "inline", marginLeft: 10, color: mensagem?.ok === false ? "#A44C2E" : undefined }}>
          {mensagem?.texto ?? ""}
        </span>
      </div>
    </form>
  );
}

export function LinhaNorma({ id, titulo, detalhe }: { id: string; titulo: string; detalhe: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  return (
    <tr>
      <td className="op-adm-email">
        {titulo}
        <span className="op-adm-nome">{detalhe}</span>
        {erro && (
          <span className="op-adm-nome" style={{ color: "#A44C2E" }} role="alert">
            {erro}
          </span>
        )}
      </td>
      <td className="op-adm-acoes">
        <button
          type="button"
          className="op-adm-btn nao"
          disabled={pendente}
          onClick={() => {
            if (!window.confirm(`Apagar do mural a norma “${titulo}”?`)) return;
            setErro("");
            iniciar(async () => {
              const r = await apagarNorma(id);
              if (!r.ok) setErro(r.erro || "Não consegui apagar.");
            });
          }}
        >
          {pendente ? "…" : "Apagar"}
        </button>
      </td>
    </tr>
  );
}
