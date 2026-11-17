import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIES_ANTIGOS,
  COOKIE_MOVIMENTO,
  COOKIE_TEMA,
  COOKIE_TEXTO,
  VALIDADE_COOKIE_S,
  aplicarPedido,
  lerPreferencias,
  voltaSegura,
} from "@/lib/oportunidades/emendas-publico";

/**
 * As preferências de acessibilidade do portal das emendas (versão 2, 17/11/2026): os links do painel
 * (`?tema=sistema|claro|escuro|contraste`, `?texto=mais|menos|normal`, `?movimento=normal|reduzido`) gravam a escolha
 * em cookie e voltam para a página de onde a pessoa veio. Funciona sem JavaScript. Os cookies guardam só a preferência,
 * neste navegador, por um ano, e só valem em `/emendas`; os dois da versão 1 são apagados na primeira escolha.
 *
 * A volta é pelo `Referer`, e só para dentro de `/emendas` no mesmo site (`voltaSegura`): nunca um redirecionamento
 * aberto. Sem `Referer` (navegador que não manda), volta ao início do portal.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const atual = lerPreferencias({
    tema: req.cookies.get(COOKIE_TEMA)?.value,
    texto: req.cookies.get(COOKIE_TEXTO)?.value,
    movimento: req.cookies.get(COOKIE_MOVIMENTO)?.value,
    contrasteAntigo: req.cookies.get(COOKIES_ANTIGOS[0])?.value,
    fonteAntiga: req.cookies.get(COOKIES_ANTIGOS[1])?.value,
  });
  const sp = req.nextUrl.searchParams;
  const nova = aplicarPedido(atual, { tema: sp.get("tema"), texto: sp.get("texto"), movimento: sp.get("movimento") });
  const destino = new URL(voltaSegura(req.headers.get("referer"), req.nextUrl.origin), req.nextUrl.origin);
  const res = NextResponse.redirect(destino, 303);
  const opcoes = { path: "/emendas", maxAge: VALIDADE_COOKIE_S, sameSite: "lax" as const, httpOnly: true, secure: req.nextUrl.protocol === "https:" };
  res.cookies.set(COOKIE_TEMA, nova.tema, opcoes);
  res.cookies.set(COOKIE_TEXTO, String(nova.texto), opcoes);
  res.cookies.set(COOKIE_MOVIMENTO, nova.movimento, opcoes);
  for (const velho of COOKIES_ANTIGOS) if (req.cookies.has(velho)) res.cookies.set(velho, "", { ...opcoes, maxAge: 0 });
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
