import type { NextRequest } from "next/server";
import { notasCsv } from "@/lib/oportunidades/csv";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { COLUNAS_CSV_INSTRUMENTOS, cnpjDaUrl } from "@/lib/oportunidades/pagina-entidade";
import { paraCsv } from "@/lib/oportunidades/painel";
import { PODE } from "@/lib/oportunidades/pagina-municipio";
import { COLUNAS_CSV_ACHADOS, relatorioSemNomes } from "@/lib/oportunidades/relatorio-municipio";
import { lerRelatorioEntidade } from "@/lib/oportunidades/relatorio-municipio.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { nivelDoVisitanteNaEntidade } from "../nivel.server";

/**
 * CSV da entidade (E1): os instrumentos do CNPJ (padrão) ou os achados (`?tipo=achados`). Para todo aprovado (D1:
 * CSV pede cadastro); quem não é administrador recebe os achados sem nome de fornecedor. Quem não pode recebe 404.
 * `no-store`: a CDN não guarda a resposta de um visitante para entregar a outro.
 */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ cnpj: string }> }) {
  const naoEncontrado = () => new Response("Não encontrado", { status: 404, headers: CABECALHOS_PRIVADOS });
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return naoEncontrado();
  const cnpj = cnpjDaUrl((await params).cnpj);
  if (!cnpj) return naoEncontrado();
  const hoje = diaBrasilia(new Date().toISOString());
  const leitura = await lerRelatorioEntidade(cnpj, hoje);
  if (leitura.estado === "nao_encontrado") return naoEncontrado();
  if (leitura.estado !== "ok") return new Response("Indisponível", { status: 503, headers: CABECALHOS_PRIVADOS });

  const achados = req.nextUrl.searchParams.get("tipo") === "achados";
  // D1 A18 (09/11/2026): o mesmo nível da página (`nivelDoVisitanteNaEntidade`) decide os nomes, em um lugar só.
  const nivel = await nivelDoVisitanteNaEntidade(visitante, leitura.entidade);
  const r = PODE.interno(nivel) ? leitura.relatorio : relatorioSemNomes(leitura.relatorio);
  const notas = notasCsv({
    titulo: achados ? `Achados da entidade de CNPJ ${cnpj}` : `Instrumentos da entidade de CNPJ ${cnpj}`,
    fontes: achados ? r.fontes : r.fontes.filter((f) => f.fonte.startsWith("SICONV")),
    aviso: achados ? "Achado é ponto para olhar, não irregularidade; a falta de dado numa fonte é dita como falta, nunca como zero." : undefined,
    geradoEm: hoje,
  });
  const csv = achados ? paraCsv(COLUNAS_CSV_ACHADOS, r.achados, notas) : paraCsv(COLUNAS_CSV_INSTRUMENTOS, leitura.instrumentos, notas);
  return new Response(csv, {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="entidade-${cnpj}-${achados ? "achados" : "instrumentos"}-${hoje}.csv"`,
    },
  });
}
