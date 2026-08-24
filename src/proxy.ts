import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy (ex-middleware, convenção Next 16) — protege rotas privadas do site.
 *
 * Protege:
 *   /hub-bananeiras/workspace  Workspace do Instituidor
 *   /plataforma/app            app logado da Plataforma PONTE
 *
 * Como funciona:
 *   - Cookie da área presente E igual ao segredo da área → deixa passar
 *   - Qualquer outro caso → redireciona para o login da área, com ?next=
 *   - A página de login da própria área é sempre acessível
 */
/**
 * Áreas reservadas do site. Cada uma tem cookie, segredo e página de login
 * próprios — um vazamento de credencial em uma não abre a outra.
 */
const AREAS_RESERVADAS = [
  // Nenhuma área tem segredo padrão. O repositório é público: um default
  // hardcoded é uma senha publicada. Sem a env var, o segredo é undefined e a
  // checagem abaixo nega o acesso — fecha, não abre.
  {
    prefixo: "/hub-bananeiras/workspace",
    login: "/hub-bananeiras/login",
    cookie: "hub_bananeiras_auth",
    segredo: process.env.HUB_AUTH_SECRET,
  },
  {
    prefixo: "/plataforma/app",
    login: "/plataforma/login",
    cookie: "plataforma_auth",
    segredo: process.env.PLATAFORMA_AUTH_SECRET,
  },
] as const;

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const area = AREAS_RESERVADAS.find((a) => pathname.startsWith(a.prefixo));
  if (!area) return NextResponse.next();

  // A própria página de login é sempre acessível — senão ninguém entra
  if (pathname.startsWith(area.login)) return NextResponse.next();

  const esperado = area.segredo;
  const apresentado = req.cookies.get(area.cookie)?.value;

  // Os dois testes de existência não são redundantes. Sem eles, uma área com
  // env var ausente teria `esperado === undefined`; um visitante sem cookie
  // teria `apresentado === undefined`; e `undefined === undefined` liberaria
  // a área inteira para qualquer um. Falta de configuração tem que fechar a
  // porta, nunca escancará-la.
  if (esperado && apresentado && apresentado === esperado) {
    return NextResponse.next();
  }

  // Sem cookie válido → login, guardando o destino pretendido
  const loginUrl = new URL(area.login, req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // /conecta-impact-go saiu: a área foi removida e a rota agora é um
    // redirect 301 para a home, declarado em next.config.ts.
    "/hub-bananeiras/:path*",
    // Só o app e o login. `/plataforma` sozinho é a apresentação pública,
    // reescrita para plataforma.html — não pode passar por aqui.
    "/plataforma/app/:path*",
    "/plataforma/login",
  ],
};
