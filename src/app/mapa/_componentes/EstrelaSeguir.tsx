"use client";

/**
 * A estrela de seguir uma janela, um convênio ou uma proposta.
 *
 * Muda na hora e volta se o servidor recusar, dizendo por quê: fingir que seguiu
 * sem ter gravado deixaria a pessoa esperando um aviso que nunca viria.
 */
import { useState, useTransition } from "react";
import type { TipoItem } from "@/lib/oportunidades/favoritos";
import { deixarDeSeguir, seguir } from "../acoes";

export function EstrelaSeguir({
  tipo,
  chave,
  nome,
  seguindo: inicial,
  compacta = false,
}: {
  tipo: TipoItem;
  chave: string;
  /** Como o leitor de tela diz o item: "o convênio nº 956541". */
  nome: string;
  seguindo: boolean;
  /** Só a estrela, para linhas de tabela. */
  compacta?: boolean;
}) {
  const [seguindo, setSeguindo] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function alternar() {
    if (salvando) return;
    const proximo = !seguindo;
    setSeguindo(proximo);
    setErro(null);
    iniciar(async () => {
      const r = proximo ? await seguir(tipo, chave) : await deixarDeSeguir(tipo, chave);
      if (!r.ok) {
        setSeguindo(!proximo);
        setErro(r.erro ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <span className="mp-estrela-caixa">
      <button
        type="button"
        className={`mp-estrela${seguindo ? " mp-estrela-ativa" : ""}${compacta ? " mp-estrela-compacta" : ""}`}
        aria-pressed={seguindo}
        aria-disabled={salvando}
        // Nome fixo com estado em aria-pressed: trocar o nome junto com o estado faz o
        // leitor de tela anunciar "Seguindo, pressionado", que diz a mesma coisa duas vezes.
        aria-label={`Seguir ${nome}`}
        title={seguindo ? "Você segue este item e recebe os avisos dele. Clique para deixar de seguir." : "Seguir e receber avisos quando mudar"}
        onClick={alternar}
      >
        <span aria-hidden="true">{seguindo ? "★" : "☆"}</span>
        {!compacta && <span aria-hidden="true">{seguindo ? "Seguindo" : "Seguir"}</span>}
      </button>
      <span className="pa-sr" role="status">
        {erro ?? ""}
      </span>
      {erro && (
        <span className="mp-estrela-erro" aria-hidden="true">
          {erro}
        </span>
      )}
    </span>
  );
}
