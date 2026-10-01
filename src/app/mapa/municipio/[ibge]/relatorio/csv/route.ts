import type { NextRequest } from "next/server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { paraCsv } from "@/lib/oportunidades/painel";
import { COLUNAS_CSV_ACHADOS } from "@/lib/oportunidades/relatorio-municipio";
import { lerRelatorioMunicipio } from "@/lib/oportunidades/relatorio-municipio.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";

/**
 * CSV dos achados do relatório do município (onda 14): um achado por linha. Só administradores; quem não
 * pode recebe 404. `no-store`: a CDN não guarda a resposta de um visitante para entregar a outro.
 */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ibge: string }> }) {
  const naoEncontrado = () => new Response("Não encontrado", { status: 404, headers: CABECALHOS_PRIVADOS });
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado" || !ehAdministrador(visitante.email)) return naoEncontrado();
  const { ibge } = await params;
  if (!/^25\d{5}$/.test(ibge)) return naoEncontrado();
  const hoje = diaBrasilia(new Date().toISOString());
  const leitura = await lerRelatorioMunicipio(ibge, hoje);
  if (leitura.estado === "nao_encontrado") return naoEncontrado();
  if (leitura.estado !== "ok") return new Response("Indisponível", { status: 503, headers: CABECALHOS_PRIVADOS });
  const csv = paraCsv(COLUNAS_CSV_ACHADOS, leitura.relatorio.achados);
  return new Response(csv, {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${ibge}-${hoje}.csv"`,
    },
  });
}
