import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy (ex-middleware, convenção Next 16) — protege rotas privadas do site.
 *
 * Protege:
 *   /hub-bananeiras/workspace   Workspace do Instituidor
 *
 * O /conecta-impact-go saiu: a área foi removida e a rota agora é um redirect
 * 301 para a home, declarado em next.config.ts.
 *
 * NOTA sobre a suspensão da oferta do HUB: a página pública /hub-bananeiras
 * pode estar suspensa (ver src/app/hub-bananeiras/route.ts), mas o Workspace
 * continua acessível a quem tem credencial. Suspender a oferta comercial não
 * é o mesmo que tirar o acesso de quem já é cliente.
 */
const AREAS_RESERVADAS = [
  {
    prefixo: "/hub-bananeiras/workspace",
    login: "/hub-bananeiras/login",
    cookie: "hub_bananeiras_auth",
    segredo: process.env.HUB_AUTH_SECRET || "hub-bananeiras-2026",
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
  // a área inteira para qualquer um.
  if (esperado && apresentado && apresentado === esperado) {
    return NextResponse.next();
  }

  // Sem cookie válido → login, guardando o destino pretendido
  const loginUrl = new URL(area.login, req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/hub-bananeiras/:path*"],
};
