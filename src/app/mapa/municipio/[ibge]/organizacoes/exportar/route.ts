import type { NextRequest } from "next/server";
import { areaDaUrl, listaDoMunicipio } from "@/lib/oportunidades/osc";
import { COLUNAS_OSC_MUNICIPIO, TABELA_OSC_MUNICIPIO, valoresDaOsc } from "@/lib/oportunidades/osc-tabela";
import { lerOscDoMunicipio } from "@/lib/oportunidades/osc.server";
import { ibgeDaUrl } from "@/lib/oportunidades/pagina-municipio";
import { lerEntidadesDoMunicipio } from "@/lib/oportunidades/relatorio-municipio.server";
import { aplicar, csvDaTabela, lerEstado, nomeDoCsv } from "@/lib/oportunidades/tabela-filtro";
import { visitanteAtual } from "@/lib/supabase-auth";

/**
 * O CSV das organizações da sociedade civil de um município (onda 15, fase 3, F3.3, 22/10/2026): o recorte da página
 * (área e busca) e o filtro e a ordem da tabela, com todas as linhas. Mesmo acesso da página (quem tem cadastro
 * aprovado); o cadastro é público e não traz endereço, dirigente nem contato. `no-store`: nada de cache compartilhado.
 */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ ibge: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return new Response("Não encontrado.", { status: 404, headers: CABECALHOS_PRIVADOS });
  const { ibge } = await params;
  if (!ibgeDaUrl(ibge)) return new Response("Não encontrado.", { status: 404, headers: CABECALHOS_PRIVADOS });
  const sp = req.nextUrl.searchParams;
  const [osc, linhas] = await Promise.all([lerOscDoMunicipio(ibge), lerEntidadesDoMunicipio(ibge)]);
  if (!osc) return new Response("O cadastro das organizações está indisponível agora.", { status: 503, headers: CABECALHOS_PRIVADOS });
  const instrumentos = new Map<string, number>();
  for (const l of linhas ?? []) if (l.cnpj) instrumentos.set(l.cnpj, (instrumentos.get(l.cnpj) ?? 0) + 1);
  const area = areaDaUrl(sp.get("area") ?? undefined);
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const lista = listaDoMunicipio(osc.ativas, instrumentos, { area, q, pagina: 1 }, true);
  const estado = lerEstado(TABELA_OSC_MUNICIPIO, COLUNAS_OSC_MUNICIPIO, sp);
  const tabela = aplicar(
    COLUNAS_OSC_MUNICIPIO,
    lista.grupos.map((g) => ({ chave: g.principal.cnpj, valores: valoresDaOsc(g), celulas: {} })),
    estado,
  );
  return new Response(csvDaTabela(COLUNAS_OSC_MUNICIPIO, tabela), {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeDoCsv(`organizacoes-${ibge}`)}"`,
    },
  });
}
