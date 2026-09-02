import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (ex-middleware, convenção Next 16) — protege rotas privadas do site.
 *
 * Protege:
 *   /hub-bananeiras/workspace  Workspace do Instituidor — cookie próprio
 *
 * E renova a sessão do Supabase em /oportunidades e /plataforma/app, cujo
 * controle de acesso mora no layout de cada segmento, não aqui.
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
    // DÍVIDA CONHECIDA, adiada de propósito.
    //
    // Este valor está publicado no GitHub e precisa ser trocado. Ele volta
    // aqui porque removê-lo sozinho quebra o acesso do cliente: o login em
    // src/app/hub-bananeiras/login/actions.ts ainda grava este mesmo texto no
    // cookie, e HUB_AUTH_SECRET não existe na Vercel (conferido em 02/09).
    // Sem o default, o login aceita a senha e o proxy devolve para o login,
    // em laço.
    //
    // Para quitar: criar HUB_USER, HUB_PASS e HUB_AUTH_SECRET na Vercel e
    // commitar o actions.ts corrigido, na mesma passada — é o que o
    // rotaciona-credenciais.ps1 faz. Só então esta linha pode cair.
    segredo: process.env.HUB_AUTH_SECRET || "hub-bananeiras-2026",
  },
  // /plataforma/app saiu daqui: passou a usar Supabase Auth com a mesma lista
  // de acesso da /oportunidades, verificada no layout do segmento. Cookie
  // próprio e senha em variável de ambiente deixaram de existir — as três
  // PLATAFORMA_* na Vercel ficaram órfãs e podem ser removidas.
] as const;

/**
 * Renova a sessão do Supabase.
 *
 * O token de acesso expira em cerca de uma hora. Server Components não podem
 * gravar cookie, então sem esta passagem pelo middleware o refresh nunca
 * acontece: a pessoa é deslogada no meio do uso, sem ter feito nada.
 *
 * Aqui apenas renovamos. Quem decide se a pessoa entra é a página, que também
 * consulta o status de aprovação — informação que não está no token.
 */
async function renovarSessao(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(lista) {
        lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Áreas com Supabase Auth: aqui só renovamos o token. Quem decide o acesso
  // é a página, que também consulta o status de aprovação — informação que não
  // viaja no token e por isso não pode ser verificada aqui.
  if (pathname.startsWith("/oportunidades") || pathname.startsWith("/plataforma/app")) {
    const res = NextResponse.next({ request: req });
    await renovarSessao(req, res);
    return res;
  }

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
    // reescrita para plataforma.html — se entrasse aqui, o middleware
    // interceptaria a página que o site inteiro divulga.
    "/plataforma/app/:path*",
    "/plataforma/login",
    "/oportunidades/:path*",
  ],
};
