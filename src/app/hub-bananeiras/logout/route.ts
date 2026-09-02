import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Logout do Workspace do Instituidor.
 *
 * Existe como rota GET — e não só como server action — porque o Workspace é
 * HTML estático servido por Route Handler (ver ../workspace/route.ts). HTML
 * estático não invoca server action; o botão "Encerrar Sessão" só consegue
 * navegar para uma URL. Esta é essa URL.
 *
 * Apaga o cookie de sessão da área e devolve para a oferta pública. Depois
 * disso o proxy volta a barrar /hub-bananeiras/workspace, como para qualquer
 * visitante sem cookie.
 */
export async function GET(req: Request) {
  const jar = await cookies();
  jar.delete("hub_bananeiras_auth");
  return NextResponse.redirect(new URL("/hub-bananeiras", req.url));
}
