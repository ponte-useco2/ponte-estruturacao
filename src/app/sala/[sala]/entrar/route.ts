import { NextResponse, type NextRequest } from "next/server";
import { consumir, origemDoPedido } from "@/lib/freio";
import { DIAS_DE_ACESSO, emitirAcesso, nomeDoCookie, salaPorSlug, senhaConfere, senhaDaSala } from "@/lib/oportunidades/sala";

/**
 * Entrada da sala: confere a senha (POST do formulário) e devolve o cookie assinado, só do caminho da sala. Errar a
 * senha volta ao formulário com `?erro=senha`, depois de uma pausa; muitas tentativas do mesmo IP, `?erro=muitas` (o freio
 * é por instância: encarece o script, não é limite global — ver `lib/freio.ts`).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ sala: string }> }) {
  const sala = salaPorSlug((await params).sala);
  if (!sala) return new NextResponse(null, { status: 404 });

  const destino = new URL(`/sala/${sala.slug}`, req.url);
  const senha = senhaDaSala(sala, process.env);
  if (!senha) return NextResponse.redirect(destino, 303);

  if (!consumir(await origemDoPedido(`sala:${sala.slug}`), { limite: 8, janelaMs: 10 * 60 * 1000 })) {
    destino.searchParams.set("erro", "muitas");
    return NextResponse.redirect(destino, 303);
  }

  let digitada = "";
  try {
    digitada = String((await req.formData()).get("senha") ?? "");
  } catch {
    digitada = "";
  }
  if (!senhaConfere(digitada, senha)) {
    await new Promise((fim) => setTimeout(fim, 700));
    destino.searchParams.set("erro", "senha");
    return NextResponse.redirect(destino, 303);
  }

  const resposta = NextResponse.redirect(destino, 303);
  resposta.cookies.set(nomeDoCookie(sala), emitirAcesso(sala, senha, Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/sala/${sala.slug}`,
    maxAge: DIAS_DE_ACESSO * 86_400,
  });
  return resposta;
}
