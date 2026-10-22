import type { NextRequest } from "next/server";
import { nomeFornecedor } from "@/lib/oportunidades/fornecedores";
import { TABELA_FORNECEDORES, colunasFornecedores, filtroDosParametros, valoresDoFornecedor } from "@/lib/oportunidades/fornecedores-tabela";
import { lerPainelFornecedores, type LinhaPainel } from "@/lib/oportunidades/fornecedores.server";
import { paraCsv, type ColunaCsv } from "@/lib/oportunidades/painel";
import { aplicar, lerEstado } from "@/lib/oportunidades/tabela-filtro";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";

/**
 * O CSV da lista de empresas do painel de fornecedores (onda 15, fase 3, F3.3, 22/10/2026): o formulário da página e o
 * filtro e a ordem da tabela, com todas as linhas (sem o corte de 100). Só administradores; quem não é recebe 404.
 * `no-store`: a CDN não guarda a resposta de um administrador para outro visitante.
 */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

const COLUNAS: ColunaCsv<LinhaPainel>[] = [
  { titulo: "CNPJ", valor: (l) => l.cnpj, texto: true },
  { titulo: "Empresa", valor: (l) => nomeFornecedor(l) },
  { titulo: "MEI", valor: (l) => l.mei },
  { titulo: "Lista do TCU", valor: (l) => valoresDoFornecedor(l).tcu },
  { titulo: "CEIS/CNEP", valor: (l) => (l.ceisCnep === "vigente" ? `vigente (${l.cadastros ?? "CEIS/CNEP"})` : l.ceisCnep === "encerrada" ? "encerrado" : null) },
  { titulo: "Municípios na PB", valor: (l) => l.pb_municipios },
  { titulo: "Convênios na PB", valor: (l) => l.pb_convenios },
  { titulo: "Recebeu no recorte (R$)", valor: (l) => (l.noMunicipio ? l.noMunicipio.pago : l.pb_pago) },
  { titulo: "Recebeu na PB (R$)", valor: (l) => l.pb_pago },
  { titulo: "Contratos", valor: (l) => l.pb_contratos },
  { titulo: "Contratado (R$)", valor: (l) => l.pb_contratado },
  { titulo: "UFs no Brasil", valor: (l) => l.br_ufs },
  { titulo: "Convênios no Brasil", valor: (l) => l.br_convenios },
  { titulo: "Recebeu no Brasil (R$)", valor: (l) => l.br_pago },
];

export async function GET(req: NextRequest) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado" || !ehAdministrador(visitante.email)) {
    return new Response("Não encontrado.", { status: 404, headers: CABECALHOS_PRIVADOS });
  }
  const sp = req.nextUrl.searchParams;
  const filtro = filtroDosParametros(sp);
  const colunas = colunasFornecedores(null);
  const estado = lerEstado(TABELA_FORNECEDORES, colunas, sp);
  const leitura = await lerPainelFornecedores(filtro, { estado, tudo: true });
  if (leitura.estado !== "ok") {
    return new Response("Os fornecedores não estão disponíveis agora.", { status: 503, headers: CABECALHOS_PRIVADOS });
  }
  // No caminho comum o banco já filtrou; com município ou CEIS/CNEP, o filtro da tabela roda aqui, como na página.
  let linhas = leitura.linhas;
  if (leitura.modo === "pagina") {
    const porCnpj = new Map(linhas.map((l) => [l.cnpj, l]));
    linhas = aplicar(colunas, linhas.map((l) => ({ chave: l.cnpj, valores: valoresDoFornecedor(l), celulas: {} })), estado).map(
      (t) => porCnpj.get(t.chave) as LinhaPainel,
    );
  }
  const referencia = leitura.execucao.referencia ?? "";
  const onde = filtro.municipio ?? "pb";
  return new Response(paraCsv(COLUNAS, linhas), {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fornecedores-${onde}-${referencia}.csv"`,
    },
  });
}
