import { NextResponse, type NextRequest } from "next/server";
import { clienteSessao } from "@/lib/supabase-auth";

/**
 * Retorno do Google.
 *
 * O Supabase manda o visitante de volta para cá com um `code` na URL. Aqui
 * ele vira sessão em cookie httpOnly.
 *
 * O `next` é validado contra caminho interno: aceitar qualquer valor faria
 * desta rota um redirecionador aberto — bastaria divulgar o nosso link de
 * login com ?next=//site-do-atacante para a vítima atribuir o desvio a nós.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const erro = searchParams.get("error_description") || searchParams.get("error");

  const pedido = searchParams.get("next") || "/oportunidades";
  const destino =
    pedido.startsWith("/") && !pedido.startsWith("//") && !pedido.includes("://")
      ? pedido
      : "/oportunidades";

  if (erro) {
    const url = new URL("/oportunidades/entrar", origin);
    url.searchParams.set("erro", "google");
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/oportunidades/entrar", origin));
  }

  const supabase = await clienteSessao();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/oportunidades/entrar", origin);
    url.searchParams.set("erro", "sessao");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(destino, origin));
}
