import { notasCsv } from "@/lib/oportunidades/csv";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { COLUNAS_CSV_UFS, anoDeReferencia, ufsLadoALado } from "@/lib/oportunidades/pagina-brasil";
import { lerBrasil } from "@/lib/oportunidades/pagina-brasil.server";
import { paraCsv } from "@/lib/oportunidades/painel";
import { visitanteAtual } from "@/lib/supabase-auth";

/** CSV das 27 UFs (U2), em ordem alfabética. Para todo aprovado (D1: CSV pede cadastro); quem não pode recebe 404. */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return new Response("Não encontrado", { status: 404, headers: CABECALHOS_PRIVADOS });
  const leitura = await lerBrasil();
  if (leitura.estado !== "ok" || !leitura.territorio) return new Response("Indisponível", { status: 503, headers: CABECALHOS_PRIVADOS });
  const hoje = diaBrasilia(new Date().toISOString());
  const ano = anoDeReferencia(leitura.execucao, hoje);
  const linhas = ufsLadoALado(leitura.territorio, leitura.desfechos ?? [], leitura.pix ?? [], leitura.janelas, ano);
  const notas = notasCsv({
    titulo: "As 27 UFs lado a lado, em ordem alfabética",
    fontes: [
      { fonte: "SICONV/Transferegov (arquivos abertos)", data: leitura.execucao.referencia },
      { fonte: "API das transferências especiais e do fundo a fundo (Transferegov)", data: null },
      { fonte: "Catálogo de janelas abertas da PONTE (radar)", data: null },
    ],
    aviso: `Ano de referência das colunas anuais: ${ano}. Comparação entre estados, não ranking.`,
    geradoEm: hoje,
  });
  return new Response(paraCsv(COLUNAS_CSV_UFS, linhas, notas), {
    headers: { ...CABECALHOS_PRIVADOS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ufs-brasil-${hoje}.csv"` },
  });
}
