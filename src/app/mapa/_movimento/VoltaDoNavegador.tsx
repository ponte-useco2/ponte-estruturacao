"use client";

/**
 * O voltar e o avançar do navegador com a direção da descida (onda 19, 28/10/2026). Os links do Mapa levam o tipo
 * (`mp-descer`, `mp-subir`) e o React anima a troca; o botão do navegador não leva nada, e o React não anima a troca
 * que vem do histórico (medido no Chrome em 28/10: nenhuma transição no voltar). A página trocava seca.
 *
 * Como fica: um ouvinte do `popstate` que roda antes do Next (fase de captura, registrado quando este módulo carrega,
 * antes dos efeitos do roteador) segura o evento quando a troca é entre dois níveis da descida, abre a transição do
 * navegador com o tipo da direção (`mp-volta-subir` ou `mp-volta-descer`) e, já com a foto da página que sai tirada,
 * devolve o mesmo evento ao Next, que restaura a página do histórico como sempre (da memória dele, sem esperar o
 * servidor). O CSS (`transicoes.css`) dá nome ao conteúdo só durante esse tipo e reusa as animações da descida; o
 * cabeçalho fica parado.
 *
 * Sem `document.startViewTransition` (navegador antigo), fora da descida (abas, busca, janelas) ou com o mesmo nível,
 * nada muda: o evento segue direto para o Next.
 */
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { direcaoDoLink } from "@/lib/oportunidades/descida";

export const TIPO_VOLTA = { subir: "mp-volta-subir", descer: "mp-volta-descer" } as const;

/** O caminho da página que está na tela (o `location` já mudou quando o `popstate` chega). */
let caminhoNaTela: string | null = null;
/** O evento que este ouvinte devolve ao Next: ele passa direto na segunda vez. */
let devolvido: PopStateEvent | null = null;
/** Quem espera a página nova chegar à tela para encerrar a troca. */
let aoChegar: ((caminho: string) => void) | null = null;

function aoVoltar(e: PopStateEvent) {
  if (e === devolvido || typeof document.startViewTransition !== "function") return;
  const anterior = caminhoNaTela;
  const destino = window.location.pathname;
  const direcao = direcaoDoLink(anterior, destino);
  if (!direcao) return;
  e.stopImmediatePropagation();
  const estado = e.state;
  try {
    document.startViewTransition({
      update: () =>
        new Promise<void>((pronto) => {
          const limite = window.setTimeout(() => ((aoChegar = null), pronto()), 3000);
          aoChegar = (caminho) => {
            if (caminho !== destino) return;
            window.clearTimeout(limite);
            aoChegar = null;
            pronto();
          };
          devolvido = new PopStateEvent("popstate", { state: estado });
          window.dispatchEvent(devolvido);
          devolvido = null;
        }),
      types: [TIPO_VOLTA[direcao]],
    });
  } catch {
    // Sem os tipos (navegador que só aceita a função): a troca acontece sem a animação, como antes.
    devolvido = new PopStateEvent("popstate", { state: estado });
    window.dispatchEvent(devolvido);
    devolvido = null;
  }
}

if (typeof window !== "undefined") window.addEventListener("popstate", aoVoltar, { capture: true });

/** Acompanha a página na tela: o ouvinte precisa saber de onde se volta. */
export function VoltaDoNavegador() {
  const caminho = usePathname();
  useEffect(() => {
    caminhoNaTela = caminho;
    aoChegar?.(caminho);
  }, [caminho]);
  return null;
}
