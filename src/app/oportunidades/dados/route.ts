import { NextResponse } from "next/server";
import { lerPayload } from "../dados.server";
import { visitanteAtual } from "@/lib/supabase-auth";

/**
 * Payload do painel, para o fallback do cliente.
 *
 * Substitui o antigo `/dados/oportunidades.json`, que era servido como
 * arquivo estático de `public/` e não passava por nenhuma verificação.
 *
 * `no-store` é deliberado: sem isso, a CDN da Vercel poderia guardar a
 * resposta de um usuário aprovado e entregá-la a outro visitante — a
 * verificação aconteceria uma vez e o cache serviria o resto.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  const payload = await lerPayload();
  if (!payload) {
    return NextResponse.json({ erro: "payload_indisponivel" }, { status: 503 });
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
