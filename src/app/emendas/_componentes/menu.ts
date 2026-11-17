/**
 * O menu do portal das emendas (versão 2, 17/11/2026): um lugar só para a barra (`NavPortal`), o rodapé e o mapa do
 * site. Arquivo comum (sem "use client"): o componente do navegador e a página do servidor leem a mesma lista.
 */
export const ITENS_DO_MENU: readonly { href: string; rotulo: string; noMenu: boolean }[] = Object.freeze([
  { href: "/emendas", rotulo: "Início", noMenu: false },
  { href: "/emendas/municipios", rotulo: "Municípios", noMenu: true },
  { href: "/emendas/registros", rotulo: "Emendas", noMenu: true },
  { href: "/emendas/parlamentares", rotulo: "Parlamentares", noMenu: true },
  { href: "/emendas/dados", rotulo: "Dados abertos", noMenu: true },
  { href: "/emendas/metodo", rotulo: "Método e PNTP", noMenu: true },
  { href: "/emendas/perguntas", rotulo: "Ajuda", noMenu: true },
]);

/** A página está nesta seção do menu? Município e suas telas: "Municípios"; registros e ficha: "Emendas". */
export function itemAtual(caminho: string, href: string): boolean {
  if (href === "/emendas") return caminho === "/emendas";
  if (href === "/emendas/registros") return caminho === href || caminho.startsWith("/emendas/emenda/");
  return caminho === href || caminho.startsWith(`${href}/`);
}

/** As telas do percurso da v2 (início, município, registros, ficha); o resto são páginas de apoio. */
export function ehPercurso(caminho: string): boolean {
  return (
    caminho === "/emendas" ||
    caminho === "/emendas/registros" ||
    caminho === "/emendas/buscar" ||
    caminho === "/emendas/emenda" ||
    /^\/emendas\/municipios\/[^/]+$/.test(caminho) ||
    /^\/emendas\/emenda\/[^/]+$/.test(caminho)
  );
}
