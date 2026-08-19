import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy (ex-middleware, convenção Next 16) — protege rotas privadas do site.
 *
 * Hoje protege apenas:
 *   /conecta-impact-go  (dashboard operacional privado)
 *
 * Como funciona:
 *   - Se a rota pede auth e o cookie `ci_go_auth` está VÁLIDO → deixa passar
 *   - Se não tem cookie → redireciona pra /conecta-impact-go/login
 *   - A página /conecta-impact-go/login é sempre acessível (permite login)
 */
/**
 * Áreas reservadas do site. Cada uma tem cookie, segredo e página de login
 * próprios — um vazamento de credencial em uma não abre a outra.
 */
const AREAS_RESERVADAS = [
  {
    prefixo: "/conecta-impact-go",
    login: "/conecta-impact-go/login",
    cookie: "ci_go_auth",
    segredo: process.env.CI_GO_AUTH_SECRET || "conecta-impact-go-2026",
  },
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

  if (req.cookies.get(area.cookie)?.value === area.segredo) {
    return NextResponse.next();
  }

  // Sem cookie válido → login, guardando o destino pretendido
  const loginUrl = new URL(area.login, req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/conecta-impact-go/:path*", "/hub-bananeiras/:path*"],
};
