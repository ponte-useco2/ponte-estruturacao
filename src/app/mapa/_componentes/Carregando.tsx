"use client";

import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useLinkStatus } from "next/link";
import { AVISO_DO_LINK, ESPERA_VAZIA, marcarEsqueleto, marcarLink, textoDaEspera } from "./espera";

/**
 * A região de status única do Mapa (onda 8, C, 09/10/2026; N22 da auditoria R1, WCAG 4.1.3 como referência).
 *
 * Antes, cada link levava a sua região `role="status"` (a aba Municípios da PB montava mais de 230), e o nome do link,
 * durante a espera, virava "Patos carregando a página": a região ficava dentro dele. Agora a moldura (`MapaFrame`) monta
 * uma região só, desde a primeira tela e vazia (o leitor só anuncia mudança em região que já estava lá). O link pendente
 * (`Carregando`) e o esqueleto do `loading.tsx` (`AvisoDeEspera`) só informam o que está a caminho; o texto sai de
 * `textoDaEspera` (`espera.ts`, com teste).
 *
 * Fora da moldura (não há caso hoje), o contexto é null e cada peça volta a ter a própria região, como antes.
 */
interface Espera {
  link: (id: string, pendente: boolean) => void;
  esqueleto: (id: string, texto: string | null) => void;
}

const EsperaDoMapaContexto = createContext<Espera | null>(null);

export function EsperaDoMapa({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState(ESPERA_VAZIA);
  // Funções estáveis: quem só informa não renderiza de novo quando o texto muda.
  const espera = useMemo<Espera>(
    () => ({
      link: (id, pendente) => setEstado((e) => marcarLink(e, id, pendente)),
      esqueleto: (id, texto) => setEstado((e) => marcarEsqueleto(e, id, texto)),
    }),
    [],
  );
  return (
    <EsperaDoMapaContexto.Provider value={espera}>
      {children}
      <p role="status" className="pa-sr">
        {textoDaEspera(estado)}
      </p>
    </EsperaDoMapaContexto.Provider>
  );
}

/**
 * Sinal de que o clique foi recebido (06/10/2026). Os links do menu, das abas do município e dos convênios
 * saem sem pré-carga: cada página do Mapa é dinâmica, e a pré-carga do menu sozinha disparava 11 renderizações
 * no servidor, duas vezes, a cada página aberta. O clique que vinha logo depois esperava na fila e parecia
 * perdido. Sem pré-carga, a página só é pedida no clique, e este ponto pulsa até ela chegar.
 * Vai DENTRO do <Link>: o `useLinkStatus` lê o estado do link mais próximo.
 *
 * Leitor de tela também ouve (B10, 08/10/2026): enquanto a página não chega, a região de status diz "carregando a
 * página". O ponto continua filho direto do link: o CSS da aba pulsando (`a:has(> …)`) depende disso.
 * Na troca de aba (`?aba=`), é o único retorno: o esqueleto do `loading.tsx` só aparece quando muda a página.
 *
 * Onda 8, C (09/10/2026; N22): a região saiu de dentro do link e foi para a moldura (`EsperaDoMapa`, acima). Só o link
 * pendente se registra, e sai ao chegar a página ou ao desmontar: os links parados não fazem nada.
 */
export function Carregando() {
  const { pending } = useLinkStatus();
  const espera = useContext(EsperaDoMapaContexto);
  const id = useId();
  useEffect(() => {
    if (!espera || !pending) return;
    espera.link(id, true);
    return () => espera.link(id, false);
  }, [espera, id, pending]);
  return (
    <>
      <span aria-hidden="true" className={pending ? "mp-carregando mp-carregando-ativo" : "mp-carregando"} />
      {!espera && (
        <span role="status" className="pa-sr">
          {pending ? AVISO_DO_LINK : ""}
        </span>
      )}
    </>
  );
}

/** Quanto o aviso do esqueleto espera, já com a região na tela, para escrever o texto (só fora da moldura). */
const ESPERA_DO_AVISO = 100;

/**
 * O aviso do esqueleto ao leitor de tela (onda 7, C, 09/10/2026; N13 da auditoria R1, WCAG 4.1.3). A região de status
 * do `Esqueleto` nascia já com o texto ("Carregando a página do município…"), e região que entra na tela com o texto
 * pronto pode não ser lida: é a regra do `Carregando` acima e do A20. O texto à vista continua no `Esqueleto`, fora do
 * leitor de tela, para não ser lido duas vezes.
 *
 * Onda 8, C (09/10/2026; N22): dentro da moldura, o texto vai para a região única, que já estava na tela; não precisa
 * mais da espera de 100 ms. O "carregando a página" do link clicado dá lugar ao nome da página que vem. Fora da
 * moldura, a região própria, que nasce vazia e recebe o texto logo depois, como na onda 7.
 */
export function AvisoDeEspera({ texto }: { texto: string }) {
  const espera = useContext(EsperaDoMapaContexto);
  const id = useId();
  const [dito, setDito] = useState("");
  useEffect(() => {
    if (espera) {
      espera.esqueleto(id, texto);
      return () => espera.esqueleto(id, null);
    }
    const t = setTimeout(() => setDito(texto), ESPERA_DO_AVISO);
    return () => clearTimeout(t);
  }, [espera, id, texto]);
  if (espera) return null;
  return (
    <span role="status" className="pa-sr">
      {dito}
    </span>
  );
}
