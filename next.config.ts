import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async rewrites() {
    return [
      // Hotpage estática servida de public/planeje.html
      // URL bonita /planeje (sem extensão .html)
      { source: "/planeje", destination: "/planeje.html" },

      // Proposta pública do HUB Bananeiras. O Workspace reservado NÃO vive em
      // public/ — é servido por Route Handler autenticado em
      // /hub-bananeiras/workspace (ver src/proxy.ts).
      { source: "/hub-bananeiras", destination: "/hub-bananeiras.html" },

      // Apresentação executiva da plataforma PONTE Projetos.
      // O formulário posta em /api/leads/ponte-projetos, que grava no Supabase
      // e só então devolve o convite da comunidade no WhatsApp.
      { source: "/plataforma", destination: "/plataforma.html" },
    ];
  },
  async redirects() {
    return [
      /**
       * Páginas encerradas.
       *
       * O ciclo do Centelha 3 PB fechou em 10/08/2026 e o Conecta Impact GO
       * saiu do ar. As rotas foram removidas, mas os links continuam vivos
       * fora do site: os cupons (GAYOSO, LUZERO, PEDRO, ISABELLE e os demais)
       * circularam em grupos de WhatsApp e o link de parceria está em material
       * de terceiros. Deixar 404 faria essas pessoas acharem que o site
       * quebrou.
       *
       * `permanent: true` emite 301: os buscadores transferem para a home o
       * histórico dessas URLs em vez de descartá-lo. O `:path*` cobre as
       * subpáginas — checkout, obrigado, parceria-roree e login.
       */
      { source: "/centelha-3-pb", destination: "/", permanent: true },
      { source: "/centelha-3-pb/:path*", destination: "/", permanent: true },
      { source: "/conecta-impact-go", destination: "/", permanent: true },
      { source: "/conecta-impact-go/:path*", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
