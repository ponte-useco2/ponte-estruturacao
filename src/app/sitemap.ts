import type { MetadataRoute } from "next";

/**
 * sitemap.xml (12/11/2026). Antes dava 404.
 *
 * Só as páginas públicas e vivas. Ficam fora as que redirecionam
 * (`/finep-subvencao` e as arquivadas em next.config.ts), as marcadas com
 * `noindex` (`/carteira`, `/perfil-institucional`) e as áreas bloqueadas no
 * robots.ts. Página pública nova entra aqui.
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
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGINAS.map((caminho) => ({ url: `${SITE_URL}${caminho === "/" ? "" : caminho}` }));
}
