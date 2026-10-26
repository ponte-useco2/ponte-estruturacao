import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { pecaDoe } from "@/lib/oportunidades/observatorio-doe";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";

/**
 * O HTML de uma peça do Observatório do Diário Oficial — só administradores, como a página que a emoldura.
 *
 * Quem não é administrador recebe 404, sem saber que a rota existe. O arquivo vem de `src/conteudo/doe/` (fora de
 * `public/`), pelo id da lista: o id da URL nunca vira caminho. `no-store`: a CDN não guarda a resposta de um
 * administrador para entregá-la a outro visitante. Só esta rota pode ir para um iframe, e só do próprio site
 * (`next.config.ts`); a página a abre com sandbox, sem a origem do portal.
 */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ peca: string }> }) {
  const visitante = await visitanteAtual();
  const peca = pecaDoe((await params).peca);
  if (!visitante || visitante.status !== "aprovado" || !ehAdministrador(visitante.email) || !peca) {
    return new Response("Não encontrado", { status: 404, headers: CABECALHOS_PRIVADOS });
  }
  const html = await readFile(path.join(process.cwd(), "src", "conteudo", "doe", `${peca.id}.html`), "utf-8");
  return new Response(html, { headers: { ...CABECALHOS_PRIVADOS, "Content-Type": "text/html; charset=utf-8" } });
}
