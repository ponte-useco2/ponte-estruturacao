import type { MetadataRoute } from "next";

/**
 * robots.txt (12/11/2026). Antes dava 404.
 *
 * As áreas com login, as salas de cliente, a API e o protótipo da plataforma
 * ficam fora da indexação. Isso NÃO é controle de acesso: quem protege essas
 * rotas é o login e a senha da sala. O robots só evita que o buscador gaste
 * tempo nelas ou guarde a tela de entrada como resultado.
 *
 * Portal das emendas federais na PB (17/11/2026): `/emendas` é público e
 * indexável (entra pelo `allow: "/"`). Ficam fora só a troca de preferência de
 * acessibilidade (redireciona) e o arquivo do recorte filtrado, que tem um
 * endereço por combinação de filtro e faria o buscador baixar a base sem fim;
 * os arquivos completos (`/emendas/dados/linhas.csv` e os outros) ficam.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/mapa",
        "/sala",
        "/oportunidades",
        "/carteira",
        "/plataforma/app",
        "/auth",
        "/api",
        "/emendas/preferencias",
        "/emendas/dados/recorte",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
