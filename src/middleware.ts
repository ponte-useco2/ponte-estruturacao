import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware — protege rotas privadas do site.
 *
 * Hoje protege apenas:
 *   /conecta-impact-go  (dashboard operacional privado)
 *
 * Como funciona:
 *   - Se a rota pede auth e o cookie `ci_go_auth` está VÁLIDO → deixa passar
 *   - Se não tem cookie → redireciona pra /conecta-impact-go/login
 *   - A página /conecta-impact-go/login é sempre acessível (permite login)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Só cuidamos de /conecta-impact-go/*
  if (!pathname.startsWith("/conecta-impact-go")) {
    return NextResponse.next();
  }

  // /conecta-impact-go/login e recursos assets internos passam livres
  if (pathname.startsWith("/conecta-impact-go/login")) {
    return NextResponse.next();
  }

  // Valida cookie de sessão
  const auth = req.cookies.get("ci_go_auth")?.value;
  const expected = process.env.CI_GO_AUTH_SECRET || "conecta-impact-go-2026";

  if (auth === expected) {
    return NextResponse.next();
  }

  // Sem cookie válido → redireciona para login mantendo destino em ?next=
  const loginUrl = new URL("/conecta-impact-go/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/conecta-impact-go/:path*"],
};
