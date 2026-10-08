import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { COLUNAS_CSV_MUNICIPIOS_UF, siglaDaUrl } from "@/lib/oportunidades/pagina-uf";
import { lerUf } from "@/lib/oportunidades/pagina-uf.server";
import { paraCsv } from "@/lib/oportunidades/painel";
import { visitanteAtual } from "@/lib/supabase-auth";

/**
 * CSV dos municípios da UF (U1): a lista neutra (sem a decisão fiscal nem os sinais, que são do administrador).
 * Para todo aprovado (D1: CSV pede cadastro); quem não pode recebe 404. `no-store`, como os outros CSV do Mapa.
 */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_req: Request, { params }: { params: Promise<{ sigla: string }> }) {
  const naoEncontrado = () => new Response("Não encontrado", { status: 404, headers: CABECALHOS_PRIVADOS });
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return naoEncontrado();
  const sigla = siglaDaUrl((await params).sigla);
  if (!sigla) return naoEncontrado();
  const leitura = await lerUf(sigla, false);
  if (leitura.estado !== "ok" || !leitura.municipios) return new Response("Indisponível", { status: 503, headers: CABECALHOS_PRIVADOS });
  const linhas = [...leitura.municipios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return new Response(paraCsv(COLUNAS_CSV_MUNICIPIOS_UF, linhas), {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="municipios-${sigla.toLowerCase()}-${diaBrasilia(new Date().toISOString())}.csv"`,
    },
  });
}
