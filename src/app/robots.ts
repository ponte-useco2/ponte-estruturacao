import type { MetadataRoute } from "next";

/**
 * robots.txt (12/11/2026). Antes dava 404.
 *
 * As áreas com login, as salas de cliente, a API e o protótipo da plataforma
 * ficam fora da indexação. Isso NÃO é controle de acesso: quem protege essas
 * rotas é o login e a senha da sala. O robots só evita que o buscador gaste
 * tempo nelas ou guarde a tela de entrada como resultado.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/mapa", "/sala", "/oportunidades", "/carteira", "/plataforma/app", "/auth", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
