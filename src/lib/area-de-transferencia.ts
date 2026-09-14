/**
 * Copiar texto para a área de transferência — só no navegador, dentro de um clique.
 *
 * `navigator.clipboard.writeText` sozinho não basta. Em 14/09/2026 o titular
 * clicou em "Copiar código" nas Janelas e nada foi copiado: o navegador recusou a
 * API assíncrona (o cartão chegou a mostrar "Não copiou"). O `execCommand("copy")`
 * é síncrono e roda dentro do próprio clique, e é aceito onde a API assíncrona é
 * recusada. Está marcado como obsoleto, mas nenhum navegador o removeu e não há
 * substituto que funcione em todo lugar. Por isso vai primeiro, e a API assíncrona
 * fica de segunda tentativa.
 *
 * Devolve se copiou. Quem chama não pode dizer "copiado" sem esse `true`.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (copiarPorSelecao(texto)) return true;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function copiarPorSelecao(texto: string): boolean {
  const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const campo = document.createElement("textarea");
  campo.value = texto;
  // `readonly` evita o teclado virtual no celular; fixo e transparente, não
  // empurra a página nem aparece.
  campo.setAttribute("readonly", "");
  campo.setAttribute("aria-hidden", "true");
  Object.assign(campo.style, { position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(campo);
  campo.select();
  let copiou = false;
  try {
    copiou = document.execCommand("copy");
  } catch {
    copiou = false;
  }
  campo.remove();
  // Devolve o foco a quem clicou: sem isso, o teclado e o leitor de tela perdem o lugar.
  antes?.focus({ preventScroll: true });
  return copiou;
}
