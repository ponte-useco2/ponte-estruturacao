import type { NextRequest } from "next/server";
import { ROTULO_AGENTE } from "@/lib/oportunidades/organizacao";
import {
  ROTULO_DESFECHO,
  ROTULO_ETAPA_LICITACAO,
  ROTULO_EXIGENCIA,
  ROTULO_FONTE_MOVIMENTACAO,
  ROTULO_MOTIVO_ADITIVO,
  ehVisaoConvenio,
  exigenciasDe,
  paraCsv,
  parametrosFicha,
  parametrosPainel,
  type ColunaCsv,
} from "@/lib/oportunidades/painel";
import {
  lerConveniosParaExportar,
  lerPropostasParaExportar,
  type ConvenioPainel,
  type LeituraExportacao,
} from "@/lib/oportunidades/painel.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";

/**
 * CSV do painel — só administradores, como a página.
 *
 *   /mapa/painel/exportar?visao=nunca&uf=PB&...        a visão, com os filtros da tela
 *   /mapa/painel/exportar?ficha=2507507&quem=todos     os convênios da ficha
 *   /mapa/painel/exportar?ficha=2507507&tipo=propostas as propostas da ficha
 *
 * Quem não é administrador recebe 404, sem saber que a rota existe. `no-store`: a CDN
 * não pode guardar a resposta de um administrador e entregá-la a outro visitante.
 */
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

const agente = (t: string | null) => (t ? (ROTULO_AGENTE as Record<string, string>)[t] ?? t : null);
const pct = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 10);

const COLUNAS_CONVENIO: ColunaCsv<ConvenioPainel>[] = [
  { titulo: "Nº do convênio", valor: (c) => c.nr_convenio },
  { titulo: "Proponente", valor: (c) => c.proponente },
  { titulo: "Tipo de proponente", valor: (c) => agente(c.tipo_agente) },
  { titulo: "Município", valor: (c) => c.municipio },
  { titulo: "UF", valor: (c) => c.uf },
  { titulo: "Código IBGE", valor: (c) => c.cod_ibge },
  { titulo: "Órgão concedente", valor: (c) => c.orgao_sup },
  { titulo: "Programa", valor: (c) => c.programa },
  { titulo: "Objeto", valor: (c) => c.objeto },
  { titulo: "Situação", valor: (c) => c.situacao },
  { titulo: "Assinatura", valor: (c) => c.dt_assinatura },
  { titulo: "Fim da vigência", valor: (c) => c.dt_fim_vigencia },
  { titulo: "Repasse (R$)", valor: (c) => c.repasse },
  { titulo: "Empenhado (R$)", valor: (c) => c.empenhado },
  { titulo: "Desembolsado (R$)", valor: (c) => c.desembolsado },
  { titulo: "Desembolsado (% do repasse)", valor: (c) => pct(c.pct_desembolsado) },
  { titulo: "Físico aferido (%)", valor: (c) => pct(c.pct_fisico) },
  { titulo: "Saldo em conta (R$)", valor: (c) => c.saldo_conta },
  { titulo: "Rendimento implícito (R$)", valor: (c) => c.rendimento_implicito },
  { titulo: "Último pagamento", valor: (c) => c.dt_ultimo_pagamento },
  { titulo: "Última movimentação", valor: (c) => c.dt_ultima_movimentacao },
  { titulo: "Dias sem movimentação", valor: (c) => c.dias_sem_movimentacao },
  { titulo: "Fonte da última movimentação", valor: (c) => ROTULO_FONTE_MOVIMENTACAO[c.ultima_movimentacao_tipo ?? ""] ?? null },
  { titulo: "Aditivos de vigência", valor: (c) => c.n_aditivos_vigencia },
  { titulo: "Motivo do último aditivo de vigência", valor: (c) => ROTULO_MOTIVO_ADITIVO[c.motivo_aditivo ?? ""] ?? null },
  { titulo: "Extensões de vigência", valor: (c) => c.n_extensoes },
  { titulo: "Prazo da cláusula suspensiva", valor: (c) => c.suspensiva_prazo },
  { titulo: "Dias até o prazo da suspensiva", valor: (c) => c.suspensiva_dias },
  { titulo: "Exigências da suspensiva", valor: (c) => exigenciasDe(c).map((e) => ROTULO_EXIGENCIA[e]).join(", ") || null },
  { titulo: "Etapa (nunca desembolsado)", valor: (c) => ROTULO_ETAPA_LICITACAO[c.etapa_licitacao ?? ""] ?? null },
  { titulo: "Aceite da licitação", valor: (c) => c.dt_aceite },
  {
    titulo: "Prestação de contas: de quem é a vez",
    valor: (c) => ({ convenente: "convenente", concedente: "concedente", negativo: "desfecho negativo" })[c.contas_lado ?? ""] ?? null,
  },
  { titulo: "Dias após o limite das contas", valor: (c) => c.dias_apos_limite },
  { titulo: "Dias com o concedente", valor: (c) => c.dias_com_concedente },
  { titulo: "Financeiro ≥ 80% com físico < 30%", valor: (c) => c.financeiro_sem_fisico },
];

type PropostaExportada = Awaited<ReturnType<typeof lerPropostasParaExportar>> extends LeituraExportacao<infer T> ? T : never;

const COLUNAS_PROPOSTA: ColunaCsv<PropostaExportada>[] = [
  { titulo: "Nº da proposta", valor: (p) => p.nr_proposta, texto: true },
  { titulo: "Proponente", valor: (p) => p.proponente },
  { titulo: "Tipo de proponente", valor: (p) => agente(p.tipo_agente) },
  { titulo: "Município", valor: (p) => p.municipio },
  { titulo: "UF", valor: (p) => p.uf },
  { titulo: "Órgão concedente", valor: (p) => p.orgao_sup },
  { titulo: "Código do programa", valor: (p) => p.cod_programa, texto: true },
  { titulo: "Programa", valor: (p) => p.programa },
  { titulo: "Objeto", valor: (p) => p.objeto },
  { titulo: "Repasse pedido (R$)", valor: (p) => p.valor_repasse },
  { titulo: "Com emenda", valor: (p) => p.com_emenda },
  { titulo: "Envio", valor: (p) => p.dt_envio },
  { titulo: "Desfecho", valor: (p) => ROTULO_DESFECHO[p.desfecho] ?? p.desfecho },
  { titulo: "Reprovação em lote", valor: (p) => p.em_lote },
  { titulo: "Nunca analisada, parada há +1 ano", valor: (p) => p.limbo },
  { titulo: "Situação no Transferegov", valor: (p) => p.situacao },
  { titulo: "Último evento", valor: (p) => p.dt_ultimo_evento },
  { titulo: "Dias sem evento", valor: (p) => p.dias_sem_evento },
  { titulo: "Assinatura", valor: (p) => p.dt_assinatura },
  { titulo: "Nº do convênio", valor: (p) => p.nr_convenio },
];

function resposta<T>(leitura: LeituraExportacao<T>, colunas: ColunaCsv<T>[], nome: string): Response {
  if (leitura.estado !== "ok") {
    const status = leitura.estado === "erro" ? 502 : 503;
    return new Response("O painel não está disponível agora.", { status, headers: CABECALHOS_PRIVADOS });
  }
  // O nome carrega a data do dado e avisa quando o teto cortou linhas.
  const arquivo = `${nome}-${leitura.execucao.referencia}${leitura.truncado ? "-parcial" : ""}.csv`;
  return new Response(paraCsv(colunas, leitura.linhas), {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado" || !ehAdministrador(visitante.email)) {
    return new Response("Não encontrado.", { status: 404, headers: CABECALHOS_PRIVADOS });
  }
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());

  if (sp.ficha) {
    const f = parametrosFicha(sp.ficha, sp);
    if (!f) return new Response("Código IBGE inválido.", { status: 400, headers: CABECALHOS_PRIVADOS });
    const agenteFicha = f.quem === "prefeitura" ? "municipio" : null;
    if (sp.tipo === "propostas") {
      return resposta(await lerPropostasParaExportar(f.ibge, agenteFicha), COLUNAS_PROPOSTA, `propostas-${f.ibge}-${f.quem}`);
    }
    const leitura = await lerConveniosParaExportar(null, "atrasada", {
      ibge: f.ibge,
      agente: agenteFicha,
      assinadoDe: f.assinadoDe,
      assinadoAte: f.assinadoAte,
      movimento: f.movimento,
    });
    return resposta(leitura, COLUNAS_CONVENIO, `convenios-${f.ibge}-${f.quem}`);
  }

  const p = parametrosPainel(sp);
  if (!ehVisaoConvenio(p.visao)) {
    return new Response("Esta visão não tem exportação.", { status: 400, headers: CABECALHOS_PRIVADOS });
  }
  const leitura = await lerConveniosParaExportar(p.visao, p.lado, {
    uf: p.uf,
    orgao: p.orgao,
    ibge: p.municipio,
    assinadoDe: p.assinadoDe,
    assinadoAte: p.assinadoAte,
    movimento: p.movimento,
  });
  const lado = p.visao === "contas" ? `-${p.lado}` : "";
  const onde = p.municipio ?? (p.uf ?? "brasil").toLowerCase();
  return resposta(leitura, COLUNAS_CONVENIO, `painel-${p.visao}${lado}-${onde}`);
}
