import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * 20 MB era um convite. Server action é endpoint HTTP público, e as
       * quatro actions de formulário não exigem autenticação: o teto vale para
       * elas também. Com 20 MB, um laço anônimo empurrava megabytes por
       * requisição para dentro do Storage e do banco de um projeto Free.
       *
       * 5 MB cobre o maior anexo que o formulário FINEP aceita (ver
       * TAMANHO_MAX em src/app/actions-finep.ts) com folga para o restante do
       * payload. Se um formulário novo precisar de mais, suba o limite DELE,
       * não o do site inteiro.
       */
      bodySizeLimit: "5mb",
    },
  },
  /**
   * Cabeçalhos de segurança.
   *
   * O site não tinha nenhum. A superfície de XSS é pequena de fato — não há
   * `dangerouslySetInnerHTML` em lugar nenhum e o HTML servido de
   * src/conteudo/ é escrito pela equipe — então a CSP aqui é defesa em
   * profundidade, não tampa de buraco aberto.
   *
   * O que NÃO era defesa em profundidade e agora está coberto: sem
   * `frame-ancestors`, as áreas reservadas podiam ser embutidas em iframe por
   * terceiro (clickjacking); sem HSTS, a primeira visita aceitava downgrade
   * para HTTP.
   *
   * SOBRE A CSP: `unsafe-inline` em script-src é necessário enquanto o Next
   * injetar scripts inline sem nonce, e `unsafe-eval` sai do framer-motion em
   * desenvolvimento. Apertar isso exige nonce por requisição no proxy — vale
   * fazer, mas é mudança de outra natureza e não cabia nesta rodada.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
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

      /**
       * Programa renomeado em 03/09/2026. A rota /paraiba-produtiva chegou a
       * ser publicada por algumas horas; quem tiver o link cai na nova.
       */
      { source: "/paraiba-produtiva", destination: "/agroeconomia-biomas", permanent: true },

      /**
       * HUB Bananeiras — arquivado em 03/09/2026.
       *
       * O cliente desistiu: era proposta comercial, sem contratação nem
       * pagamento. A proposta e o Workspace circularam por link com o
       * instituidor e com terceiros, então vale o mesmo critério das outras
       * duas: 301 em vez de 404, para quem tiver o link antigo chegar à home
       * em vez de achar que o site quebrou.
       *
       * O material está em Site-Ponte/_arquivo/hub-bananeiras-2026-09-03/.
       */
      { source: "/hub-bananeiras", destination: "/", permanent: true },
      { source: "/hub-bananeiras/:path*", destination: "/", permanent: true },

      /**
       * Mapa de Oportunidades emancipado em 12/09/2026.
       *
       * Nasceu como aba de `/plataforma/app`, cuja moldura declara "protótipo ·
       * sem login real". Sobre ele isso era falso — é a única superfície com
       * login real, RLS, dado oficial e cron —, então mudou-se para `/mapa`,
       * com moldura própria.
       *
       * O endereço antigo circulou por poucos dias, mas circulou: está no guia
       * do projeto e em e-mail de convite. 301 aqui, e não `redirect()` dentro
       * de uma página, porque o redirecionamento não pode depender de renderizar
       * um segmento que já não existe.
       *
       * `/oportunidades` e `/plataforma/app/descobrir` NÃO redirecionam ainda:
       * eles entregam hoje a lista filtrável do catálogo inteiro, que o `/mapa`
       * só passa a cobrir na fase do contrato v2. Apontar agora tiraria função
       * de quem usa.
       */
      { source: "/plataforma/app/mapa-de-oportunidades", destination: "/mapa", permanent: true },
      { source: "/plataforma/app/mapa-de-oportunidades/:path*", destination: "/mapa", permanent: true },
    ];
  },
};

export default nextConfig;
