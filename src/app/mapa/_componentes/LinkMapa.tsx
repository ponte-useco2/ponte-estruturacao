"use client";

/**
 * O link do Mapa (B10, 08/10/2026; achado H01 da auditoria B1+B2): o `<Link>` do Next com as regras do `/mapa`
 * embutidas, para nenhum link novo sair sem elas.
 *
 * - Sem pré-carga, sempre (`prefetch={false}` fixo, fora do alcance de quem usa): cada página do Mapa é dinâmica,
 *   e a pré-carga do menu sozinha disparava 11 renderizações no servidor a cada página aberta (ver `Carregando`).
 * - Com o `Carregando` dentro: o ponto que pulsa e o aviso ao leitor de tela, do clique até a página chegar. Na troca
 *   de aba (`?aba=`) é o único retorno; nas outras, o esqueleto do `loading.tsx` assume quando o servidor começa a
 *   responder. Desde a onda 8, C (09/10/2026; N22 da auditoria R1), o aviso sai na região única da moldura
 *   (`EsperaDoMapa`), e não mais numa região dentro de cada link: o nome do link fica só com o texto dele.
 * - Com a direção da descida (onda 16, M0, 27/10/2026): entre duas páginas de nível, o link leva o tipo `mp-descer` ou
 *   `mp-subir` para a transição do React (`descida.ts`), e a página afunda ou volta do fundo
 *   (`_movimento/transicoes.css`). Quem chama não precisa saber: a direção sai do caminho aberto e do destino. Por isso
 *   o componente passou a ser de cliente (`usePathname`); os filhos continuam podendo vir do servidor.
 *
 * Não serve dentro do mapa em SVG (`MapaTerritorio`): o `Carregando` desenha `<span>`, que não existe em SVG. Lá vai o
 * `LinkArea`, logo abaixo, com a mesma direção.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { tiposDaTransicao } from "@/lib/oportunidades/descida";
import { Carregando } from "./Carregando";

type Props = Omit<ComponentProps<typeof Link>, "prefetch" | "legacyBehavior" | "passHref">;

export function LinkMapa({ children, transitionTypes, ...props }: Props) {
  const atual = usePathname();
  const tipos = transitionTypes ?? (typeof props.href === "string" ? tiposDaTransicao(atual, props.href) : undefined);
  return (
    <Link {...props} prefetch={false} transitionTypes={tipos}>
      {children}
      <Carregando />
    </Link>
  );
}

/**
 * A área do mapa em SVG (onda 16, M0): o `<Link>` do Next sem pré-carga e com a direção da descida, para o clique no
 * mapa também ser navegação do Next. Antes era `<a>` simples, que recarregava a página inteira e ficava fora da
 * transição. Dentro do `<svg>` o React cria o `<a>` do SVG; o conteúdo (`<title>` e `<path>`) vem do servidor.
 */
export function LinkArea({
  href,
  tabIndex,
  onClick,
  onPointerEnter,
  children,
}: {
  href: string;
  tabIndex?: number;
  /** O mapa vivo (onda 16, M1) usa para abrir a prévia no primeiro clique; `preventDefault` segura a navegação. */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onPointerEnter?: () => void;
  children: ReactNode;
}) {
  const atual = usePathname();
  return (
    <Link href={href} prefetch={false} tabIndex={tabIndex} transitionTypes={tiposDaTransicao(atual, href)} onClick={onClick} onPointerEnter={onPointerEnter}>
      {children}
    </Link>
  );
}
