"use client";

import { useLinkStatus } from "next/link";

/**
 * Sinal de que o clique foi recebido (06/10/2026). Os links do menu, das abas do município e dos convênios
 * saem sem pré-carga: cada página do Mapa é dinâmica, e a pré-carga do menu sozinha disparava 11 renderizações
 * no servidor, duas vezes, a cada página aberta. O clique que vinha logo depois esperava na fila e parecia
 * perdido. Sem pré-carga, a página só é pedida no clique, e este ponto pulsa até ela chegar.
 * Vai DENTRO do <Link>: o `useLinkStatus` lê o estado do link mais próximo.
 */
export function Carregando() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={pending ? "mp-carregando mp-carregando-ativo" : "mp-carregando"} />;
}
