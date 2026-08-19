import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * Serve o Workspace do Instituidor (HUB Bananeiras).
 *
 * O HTML vive em `src/conteudo/` — fora de `public/` — de propósito: qualquer
 * coisa em public é servida pelo CDN sem passar pelo proxy, e a URL crua
 * `.html` vazaria o conteúdo mesmo com a rota bonita protegida.
 *
 * Aqui o arquivo só sai daqui depois que o proxy validou o cookie de sessão.
 *
 * O Workspace usa localStorage para persistir deliberações localmente. Como é
 * servido do mesmo domínio, isso continua funcionando normalmente — cada
 * instituidor mantém seu rascunho no próprio navegador até que o backend do
 * Governance Graph (ver docs/GOVERNANCE-GRAPH-SPEC-v1.0.md) exista.
 */
export async function GET() {
  try {
    const arquivo = path.join(process.cwd(), "src", "conteudo", "hub-workspace.html");
    const html = await fs.readFile(arquivo, "utf-8");

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Conteúdo reservado: nunca cacheado por CDN ou proxy intermediário
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return new NextResponse("Workspace indisponível.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
