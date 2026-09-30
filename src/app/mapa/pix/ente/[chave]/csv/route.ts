import type { NextRequest } from "next/server";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { paraCsv } from "@/lib/oportunidades/painel";
import { catalogoDe, chaveEnteValida, colunasCsvEnte, podeVerPlanoPix } from "@/lib/oportunidades/pix-laudo";
import { lerLaudoEntePix } from "@/lib/oportunidades/pix-laudo.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";

/**
 * CSV do laudo do Pix de um ente: um plano por linha, um item por coluna (onda 13A). Mesmo portão da
 * página: administrador, ou o cliente do próprio município. Quem não pode recebe 404, sem saber se o
 * ente existe. `no-store`: a CDN não guarda a resposta de um visitante para entregar a outro.
 */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ chave: string }> }) {
  const naoEncontrado = () => new Response("Não encontrado", { status: 404, headers: CABECALHOS_PRIVADOS });
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return naoEncontrado();
  const k = chaveEnteValida((await params).chave);
  if (!k) return naoEncontrado();

  let podeVer: Parameters<typeof lerLaudoEntePix>[1];
  if (!ehAdministrador(visitante.email)) {
    const { acesso } = await lerAcessoFicha(visitante);
    if (!acesso.ok) return naoEncontrado();
    podeVer = (p) => podeVerPlanoPix(acesso, p);
  }
  const leitura = await lerLaudoEntePix(k, podeVer);
  if (leitura.estado === "nao_encontrado") return naoEncontrado();
  if (leitura.estado !== "ok") return new Response("Indisponível", { status: 503, headers: CABECALHOS_PRIVADOS });

  const csv = paraCsv(colunasCsvEnte(catalogoDe(leitura.planos)), leitura.planos);
  const nome = `laudo-pix-${k.valor}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: { ...CABECALHOS_PRIVADOS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
  });
}
