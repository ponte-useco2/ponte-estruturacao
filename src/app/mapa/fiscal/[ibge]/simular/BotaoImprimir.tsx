"use client";

/** O relatório é a própria página: a impressão esconde a navegação e o formulário (mapa.css). */
export function BotaoImprimir() {
  return (
    <button type="button" className="pa-btn" onClick={() => window.print()}>
      Imprimir ou salvar em PDF
    </button>
  );
}
