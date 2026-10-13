"use client";

/**
 * A caixa que rola as tabelas largas de lado (onda 2 de UX, B9, 08/10/2026; auditoria B1+B2, A08 e A09).
 *
 * A `<div className="mp-tabela-rolagem">` de antes rolava, mas não recebia foco: numa tabela só de números, sem link,
 * quem usa o teclado não alcançava as colunas da direita no Safari e no Firefox, que não tornam a caixa focável por
 * conta própria. Agora ela entra no Tab (`tabIndex={0}`), as setas rolam a tabela, o foco aparece (mapa.css) e o
 * leitor de tela anuncia uma região com o nome da tabela:
 * - `rotuloId`: o id do título que já está na tela (h2/h3, ou o `summary` do grupo), por `aria-labelledby` — o
 *   preferido, não repete texto e distingue os grupos;
 * - `rotulo`: o texto, por `aria-label`, quando o título não tem id ou é um componente.
 * As classes extras (`className`) somam-se a `mp-tabela-rolagem`, que continua sendo a do CSS.
 *
 * Onda 7, C (09/10/2026; N04 e A09 da auditoria R1):
 * - **Região e parada de Tab só quando a tabela rola.** Toda tabela virava região nomeada e parada de Tab, também as que
 *   cabem na largura e as empilhadas do celular: a aba Municípios da PB tinha 15 regiões e 15 paradas a mais. A caixa
 *   mede a largura (ResizeObserver, na caixa e na tabela) e, quando nada passa da borda, fica um `div` simples. No
 *   servidor e antes de medir (ou sem JavaScript), fica como era: região com Tab, o caminho que nunca deixa coluna
 *   fora do alcance do teclado. A medição volta a valer quando a janela, a fonte ou o conteúdo mudam.
 * - **A tabela ganha o nome.** Das 107 tabelas, 9 tinham `<caption>`; nas outras, o leitor de tela dizia só "tabela".
 *   A `<table>` filha direta recebe o mesmo nome da caixa (`aria-labelledby` ou `aria-label`), salvo quando já tem
 *   `<caption>` ou nome próprio. Assim o nome fica também quando a caixa deixa de ser região.
 *
 * Integração da onda 14 (13/10/2026): o nome da tabela passa a ser posto no DOM depois de montar, e não mais clonando o
 * filho. Com uma tabela grande vinda de um componente do servidor, o React entrega o filho ao render do servidor ainda
 * como referência pendente (não clonável) e ao navegador já resolvido: o servidor desenhava a tabela sem o nome, o
 * navegador com ele, e a hidratação acusava a diferença (visto na ficha do parlamentar, com 180 municípios). Agora o
 * HTML do servidor e o primeiro desenho do navegador são iguais, e o nome entra logo em seguida.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

type Nome =
  | {
      /** O texto que nomeia a tabela (vira `aria-label`). */
      rotulo: string;
      rotuloId?: never;
    }
  | {
      /** O id do título visível que nomeia a tabela (vira `aria-labelledby`). */
      rotuloId: string;
      rotulo?: never;
    };

/** Dá à `<table>` filha direta o nome da caixa, se ela ainda não tem `<caption>` nem nome próprio. */
function nomearTabela(caixa: HTMLElement, nome: Nome): void {
  const tabela = caixa.firstElementChild;
  if (!tabela || tabela.tagName !== "TABLE") return;
  if (tabela.hasAttribute("aria-label") || tabela.hasAttribute("aria-labelledby")) return;
  if (tabela.querySelector(":scope > caption")) return;
  if (nome.rotuloId) tabela.setAttribute("aria-labelledby", nome.rotuloId);
  else if (nome.rotulo) tabela.setAttribute("aria-label", nome.rotulo);
}

export function TabelaRolagem({ rotulo, rotuloId, className, children }: Nome & { className?: string; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [rola, setRola] = useState(true);

  useEffect(() => {
    if (caixa.current) nomearTabela(caixa.current, (rotuloId ? { rotuloId } : { rotulo }) as Nome);
  }, [rotulo, rotuloId]);

  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // 1 px de folga: arredondamento de subpixel não é coluna escondida.
    const medir = () => setRola(el.scrollWidth > el.clientWidth + 1);
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    if (el.firstElementChild) observador.observe(el.firstElementChild);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={caixa}
      role={rola ? "region" : undefined}
      aria-label={rola && !rotuloId ? rotulo : undefined}
      aria-labelledby={rola ? rotuloId : undefined}
      tabIndex={rola ? 0 : undefined}
      className={className ? `mp-tabela-rolagem ${className}` : "mp-tabela-rolagem"}
    >
      {children}
    </div>
  );
}
