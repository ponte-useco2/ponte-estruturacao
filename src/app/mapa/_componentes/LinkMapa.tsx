/**
 * O link do Mapa (B10, 08/10/2026; achado H01 da auditoria B1+B2): o `<Link>` do Next com as duas regras do
 * `/mapa` embutidas, para nenhum link novo sair sem elas.
 *
 * - Sem pré-carga, sempre (`prefetch={false}` fixo, fora do alcance de quem usa): cada página do Mapa é dinâmica,
 *   e a pré-carga do menu sozinha disparava 11 renderizações no servidor a cada página aberta (ver `Carregando`).
 * - Com o `Carregando` dentro: o ponto que pulsa e a região de status do leitor de tela, do clique até a página
 *   chegar. Na troca de aba (`?aba=`) é o único retorno; nas outras, o esqueleto do `loading.tsx` assume quando o
 *   servidor começa a responder.
 *
 * Não serve dentro do mapa em SVG (`MapaTerritorio`): o `Carregando` desenha `<span>`, que não existe em SVG.
 * Sem "use client": vale em componente de servidor e de cliente (o `Link` e o `Carregando` já são de cliente).
 */
import Link from "next/link";
import type { ComponentProps } from "react";
import { Carregando } from "./Carregando";

export function LinkMapa({ children, ...props }: Omit<ComponentProps<typeof Link>, "prefetch" | "legacyBehavior" | "passHref">) {
  return (
    <Link {...props} prefetch={false}>
      {children}
      <Carregando />
    </Link>
  );
}
