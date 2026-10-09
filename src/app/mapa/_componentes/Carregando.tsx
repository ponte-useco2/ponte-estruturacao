"use client";

import { useEffect, useState } from "react";
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

/** Quanto o aviso do esqueleto espera, já com a região na tela, para escrever o texto. */
const ESPERA_DO_AVISO = 100;

/**
 * O aviso do esqueleto ao leitor de tela (onda 7, C, 09/10/2026; N13 da auditoria R1, WCAG 4.1.3). A região de status
 * do `Esqueleto` nascia já com o texto ("Carregando a página do município…"), e região que entra na tela com o texto
 * pronto pode não ser lida: é a regra do `Carregando` acima e do A20. Aqui a região nasce vazia e o texto entra logo
 * depois. O texto à vista continua no `Esqueleto`, fora do leitor de tela, para não ser lido duas vezes.
 */
export function AvisoDeEspera({ texto }: { texto: string }) {
  const [dito, setDito] = useState("");
  useEffect(() => {
    const espera = setTimeout(() => setDito(texto), ESPERA_DO_AVISO);
    return () => clearTimeout(espera);
  }, [texto]);
  return (
    <span role="status" className="pa-sr">
      {dito}
    </span>
  );
}
