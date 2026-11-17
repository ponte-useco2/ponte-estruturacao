import type { MetadataRoute } from "next";

/**
 * sitemap.xml (12/11/2026). Antes dava 404.
 *
 * Só as páginas públicas e vivas. Ficam fora as que redirecionam
 * (`/finep-subvencao` e as arquivadas em next.config.ts), as marcadas com
 * `noindex` (`/carteira`, `/perfil-institucional`) e as áreas bloqueadas no
 * robots.ts. Página pública nova entra aqui.
 *
 * Portal das emendas federais na PB (17/11/2026): as páginas fixas. As fichas
 * (emenda, autor, município) são achadas pelos links das listas; o sitemap
 * continua estático, sem ler o banco no build.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br";

const PAGINAS = [
  "/",
  "/plataforma",
  "/planeje",
  "/consultoria-finep",
  "/agroeconomia-biomas",
  "/reurb",
  "/trilha-do-estado",
  "/diagnostico-sbce",
  "/termos",
  "/privacidade",
  "/emendas",
  "/emendas/registros",
  "/emendas/parlamentares",
  "/emendas/municipios",
  "/emendas/dados",
  "/emendas/metodo",
  "/emendas/perguntas",
  "/emendas/acessibilidade",
  "/emendas/mapa-do-site",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGINAS.map((caminho) => ({ url: `${SITE_URL}${caminho === "/" ? "" : caminho}` }));
}
