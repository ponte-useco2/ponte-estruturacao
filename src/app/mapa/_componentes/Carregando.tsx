"use client";

import { useLinkStatus } from "next/link";

/**
 * Sinal de que o clique foi recebido (06/10/2026). Os links do menu, das abas do município e dos convênios
 * saem sem pré-carga: cada página do Mapa é dinâmica, e a pré-carga do menu sozinha disparava 11 renderizações
 * no servidor, duas vezes, a cada página aberta. O clique que vinha logo depois esperava na fila e parecia
 * perdido. Sem pré-carga, a página só é pedida no clique, e este ponto pulsa até ela chegar.
 * Vai DENTRO do <Link>: o `useLinkStatus` lê o estado do link mais próximo.
 *
 * Leitor de tela também ouve (B10, 08/10/2026): enquanto a página não chega, a região de status ao lado do ponto
 * diz "carregando a página". A região existe desde o começo, vazia, porque o leitor só anuncia mudança em região
 * que já estava na tela. O ponto continua filho direto do link: o CSS da aba pulsando (`a:has(> …)`) depende disso.
 * Na troca de aba (`?aba=`), é o único retorno: o esqueleto do `loading.tsx` só aparece quando muda a página.
 */
export function Carregando() {
  const { pending } = useLinkStatus();
  return (
    <>
      <span aria-hidden="true" className={pending ? "mp-carregando mp-carregando-ativo" : "mp-carregando"} />
      <span role="status" className="pa-sr">
        {pending ? "carregando a página" : ""}
      </span>
    </>
  );
}
