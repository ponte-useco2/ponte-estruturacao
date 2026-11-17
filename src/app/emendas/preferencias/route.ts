import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIES_ANTIGOS,
  COOKIES_DO_PORTAL,
  COOKIE_MOVIMENTO,
  COOKIE_TEMA,
  COOKIE_TEXTO,
  COOKIE_TITULOS,
  VALIDADE_COOKIE_S,
  aplicarPedido,
  lerPreferencias,
  voltaSegura,
} from "@/lib/oportunidades/emendas-publico";

/**
 * As preferências de acessibilidade do portal das emendas (versão 2, 17/11/2026): os links do painel
 * (`?tema=sistema|claro|escuro|contraste`, `?texto=mais|menos|normal`, `?movimento=normal|reduzido`,
 * `?titulos=simples|padrao`) gravam a escolha em cookie e voltam para a página de onde a pessoa veio; `?restaurar=1`
 * apaga todos os cookies de preferência do portal (volta tudo ao padrão). Funciona sem JavaScript. Os cookies guardam
 * só a preferência, neste navegador, por um ano, e só valem em `/emendas`; os dois da versão 1 são apagados na primeira
 * escolha.
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
    titulos: req.cookies.get(COOKIE_TITULOS)?.value,
    contrasteAntigo: req.cookies.get(COOKIES_ANTIGOS[0])?.value,
    fonteAntiga: req.cookies.get(COOKIES_ANTIGOS[1])?.value,
  });
  const sp = req.nextUrl.searchParams;
  const destino = new URL(voltaSegura(req.headers.get("referer"), req.nextUrl.origin), req.nextUrl.origin);
  const res = NextResponse.redirect(destino, 303);
  const opcoes = { path: "/emendas", maxAge: VALIDADE_COOKIE_S, sameSite: "lax" as const, httpOnly: true, secure: req.nextUrl.protocol === "https:" };
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (sp.get("restaurar") === "1") {
    // Restaurar padrão: apaga todos os cookies de preferência do portal (os que existirem).
    for (const nome of COOKIES_DO_PORTAL) if (req.cookies.has(nome)) res.cookies.set(nome, "", { ...opcoes, maxAge: 0 });
    return res;
  }
  const nova = aplicarPedido(atual, { tema: sp.get("tema"), texto: sp.get("texto"), movimento: sp.get("movimento"), titulos: sp.get("titulos") });
  res.cookies.set(COOKIE_TEMA, nova.tema, opcoes);
  res.cookies.set(COOKIE_TEXTO, String(nova.texto), opcoes);
  res.cookies.set(COOKIE_MOVIMENTO, nova.movimento, opcoes);
  res.cookies.set(COOKIE_TITULOS, nova.titulos, opcoes);
  for (const velho of COOKIES_ANTIGOS) if (req.cookies.has(velho)) res.cookies.set(velho, "", { ...opcoes, maxAge: 0 });
  return res;
}
