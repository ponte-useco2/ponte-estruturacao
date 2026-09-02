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
      { source: "/planeje", destination: "/planeje.html" },

      // Apresentação executiva da plataforma PONTE Projetos.
      { source: "/plataforma", destination: "/plataforma.html" },

      // NOTA: o rewrite de /hub-bananeiras saiu daqui.
      // A oferta agora é servida por Route Handler em
      // src/app/hub-bananeiras/route.ts, que consulta a variável HUB_OFERTA
      // e decide entre a proposta e o aviso de suspensão. O HTML saiu de
      // public/ para src/conteudo/ — em public/ ele continuaria acessível
      // pelo endereço direto .html e a suspensão seria contornável.
    ];
  },
  async redirects() {
    return [
      /**
       * Páginas tiradas do ar.
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
