import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (ex-middleware, convenção Next 16).
 *
 * Hoje ele faz UMA coisa: renova a sessão do Supabase em /oportunidades e
 * /plataforma/app. O controle de acesso não mora aqui — mora no layout de cada
 * segmento, que também consulta o status de aprovação.
 *
 * NÃO HÁ MAIS ÁREA COM USUÁRIO E SENHA NO SITE.
 *
 * Havia três, e todas saíram:
 *   - /conecta-impact-go   removida quando a parceria encerrou
 *   - /plataforma/app      migrada para Supabase Auth (mesma lista da /oportunidades)
 *   - /hub-bananeiras      arquivada em 03/09/2026, cliente desistiu do projeto
 *
 * Com isso saiu junto o modelo de credencial compartilhada: um usuário e uma
 * senha em variável de ambiente, iguais para todo mundo, sem identidade por
 * pessoa e sem revogação individual. Se um dia existir área reservada nova, o
 * caminho é o das duas que sobraram — Supabase Auth com lista de acesso
 * aprovada por administrador —, não a volta do login por env var.
 *
 * O material do HUB está em Site-Ponte/_arquivo/hub-bananeiras-2026-09-03/.
 */

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
  const res = NextResponse.next({ request: req });
  await renovarSessao(req, res);
  return res;
}

export const config = {
  matcher: [
    // Só os dois segmentos com Supabase Auth. As rotas removidas
    // (/conecta-impact-go, /hub-bananeiras) são redirects 301 declarados em
    // next.config.ts e não precisam passar por aqui.
    "/plataforma/app/:path*",
    "/oportunidades/:path*",
  ],
};
