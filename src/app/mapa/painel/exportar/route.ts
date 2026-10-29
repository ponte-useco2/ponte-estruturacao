import type { NextRequest } from "next/server";
import { formatarData } from "@/lib/oportunidades/central";
import { diaBrasilia } from "@/lib/oportunidades/datas";
import { ROTULO_AGENTE } from "@/lib/oportunidades/organizacao";
import {
  ROTULO_DESFECHO,
  ROTULO_ETAPA_LICITACAO,
  ROTULO_EXIGENCIA,
  ROTULO_FONTE_MOVIMENTACAO,
  ROTULO_GRUPO_MUDANCA,
  ROTULO_MOTIVO_ADITIVO,
  definicaoMudanca,
  diaDoDado,
  ehVisaoConvenio,
  exigenciasDe,
  paraCsv,
  parametrosFicha,
  parametrosPainel,
  type ColunaCsv,
  type MudancaPainel,
} from "@/lib/oportunidades/painel";
import {
  lerConveniosParaExportar,
  lerMudancasParaExportar,
  lerMunicipiosParaExportar,
  LIMITE_EXPORTACAO,
  lerPropostasParaExportar,
  type ConvenioPainel,
  type MunicipioPainel,
  type LeituraExportacao,
} from "@/lib/oportunidades/painel.server";
import { TABELA_PAINEL_VENCIDOS, estadosDaVisao, valoresDoMunicipioPainel } from "@/lib/oportunidades/painel-tabelas";
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
  { titulo: "Dias sem movimentação (na data do arquivo)", valor: (c) => c.dias_sem_movimentacao },
  { titulo: "Fonte da última movimentação", valor: (c) => ROTULO_FONTE_MOVIMENTACAO[c.ultima_movimentacao_tipo ?? ""] ?? null },
  { titulo: "Aditivos de vigência", valor: (c) => c.n_aditivos_vigencia },
  { titulo: "Motivo do último aditivo de vigência", valor: (c) => ROTULO_MOTIVO_ADITIVO[c.motivo_aditivo ?? ""] ?? null },
  { titulo: "Extensões de vigência", valor: (c) => c.n_extensoes },
  { titulo: "Prazo da cláusula suspensiva", valor: (c) => c.suspensiva_prazo },
  { titulo: "Dias até o prazo da suspensiva (na data do arquivo)", valor: (c) => c.suspensiva_dias },
  { titulo: "Exigências da suspensiva", valor: (c) => exigenciasDe(c).map((e) => ROTULO_EXIGENCIA[e]).join(", ") || null },
  { titulo: "Etapa (nunca desembolsado)", valor: (c) => ROTULO_ETAPA_LICITACAO[c.etapa_licitacao ?? ""] ?? null },
  { titulo: "Aceite da licitação", valor: (c) => c.dt_aceite },
  {
    titulo: "Prestação de contas: de quem é a vez",
    valor: (c) => ({ convenente: "convenente", concedente: "concedente", negativo: "desfecho negativo" })[c.contas_lado ?? ""] ?? null,
  },
  { titulo: "Dias após o limite das contas (na data do arquivo)", valor: (c) => c.dias_apos_limite },
  { titulo: "Dias com o concedente (na data do arquivo)", valor: (c) => c.dias_com_concedente },
  { titulo: "Financeiro ≥ 80% com físico < 30%", valor: (c) => c.financeiro_sem_fisico },
];

/** Os municípios com sinais (F3.3): os valores da tabela da tela, com o IBGE como texto. */
const COLUNAS_MUNICIPIO: ColunaCsv<MunicipioPainel>[] = [
  { titulo: "Município", valor: (m) => m.municipio },
  { titulo: "UF", valor: (m) => m.uf },
  { titulo: "Código IBGE", valor: (m) => m.cod_ibge, texto: true },
  { titulo: "Sinais", valor: (m) => m.n_sinais },
  { titulo: "Sinais acesos", valor: (m) => valoresDoMunicipioPainel(m).quais },
  { titulo: "Saldo parado (R$)", valor: (m) => valoresDoMunicipioPainel(m).saldo },
  { titulo: "Suspensivas vencendo", valor: (m) => m.n_suspensiva },
  { titulo: "Contas atrasadas", valor: (m) => m.n_contas_atrasadas },
  { titulo: "Contas negativas", valor: (m) => m.n_contas_negativas },
  { titulo: "Sem desembolso", valor: (m) => m.n_sem_desembolso },
  { titulo: "Valor sem desembolso (R$)", valor: (m) => valoresDoMunicipioPainel(m)["valor-sem-desembolso"] },
];

/** As mudanças (F3.5a): uma linha por evento, com o antes e o depois que a frase da tela resume. */
const COLUNAS_MUDANCA: ColunaCsv<MudancaPainel>[] = [
  { titulo: "Dado de", valor: (m) => diaDoDado(m.dado_ate) },
  { titulo: "O que mudou", valor: (m) => definicaoMudanca(m.tipo).rotulo },
  { titulo: "Grupo", valor: (m) => ROTULO_GRUPO_MUDANCA[definicaoMudanca(m.tipo).grupo] },
  { titulo: "Convênio ou proposta", valor: (m) => (m.alvo === "proposta" ? "Proposta" : "Convênio") },
  { titulo: "Número", valor: (m) => m.numero ?? m.chave, texto: true },
  { titulo: "Proponente", valor: (m) => m.proponente },
  { titulo: "Tipo de proponente", valor: (m) => agente(m.tipo_agente) },
  { titulo: "Município", valor: (m) => m.municipio },
  { titulo: "UF", valor: (m) => m.uf },
  { titulo: "Código IBGE", valor: (m) => m.cod_ibge, texto: true },
  { titulo: "Órgão concedente", valor: (m) => m.orgao_sup },
  { titulo: "Programa", valor: (m) => m.programa },
  { titulo: "Objeto", valor: (m) => m.objeto },
  { titulo: "Antes", valor: (m) => m.antes },
  { titulo: "Depois", valor: (m) => m.depois },
  { titulo: "Valor (R$)", valor: (m) => m.valor },
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
  // A5-15 (29/10/2026): a fonte, a data do arquivo e o corte vão no próprio arquivo, que circula sem a página.
  const notas = [
    "Painel de execução dos convênios — PONTE Estruturação de Projetos de Impacto.",
    `Fonte: SICONV/Transferegov (dados abertos), arquivo de ${formatarData(leitura.execucao.referencia)}.`,
    ...(leitura.truncado ? [`Parcial: o arquivo para em ${LIMITE_EXPORTACAO.toLocaleString("pt-BR")} linhas; filtre o recorte para ter o resto.`] : []),
    `Gerado em ${formatarData(diaBrasilia(new Date().toISOString()))}.`,
  ];
  return new Response(paraCsv(colunas, leitura.linhas, notas), {
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
  // F3.3: os municípios com sinais, com o filtro e a ordem da tabela da tela.
  if (p.visao === "municipios") {
    const estado = estadosDaVisao("municipios", req.nextUrl.searchParams).lista;
    if (!estado) return new Response("Esta visão não tem exportação.", { status: 400, headers: CABECALHOS_PRIVADOS });
    return resposta(await lerMunicipiosParaExportar(p.uf, estado), COLUNAS_MUNICIPIO, `painel-municipios-${(p.uf ?? "brasil").toLowerCase()}`);
  }
  // F3.5a: as mudanças do período, com o tipo do chip e o filtro e a ordem da tabela da tela.
  if (p.visao === "mudancas") {
    const estado = estadosDaVisao("mudancas", req.nextUrl.searchParams).lista;
    if (!estado) return new Response("Esta visão não tem exportação.", { status: 400, headers: CABECALHOS_PRIVADOS });
    const onde = p.municipio ?? (p.uf ?? "brasil").toLowerCase();
    return resposta(await lerMudancasParaExportar(p, estado), COLUNAS_MUDANCA, `painel-mudancas-${p.dias}d-${onde}${p.tipo ? `-${p.tipo}` : ""}`);
  }
  if (!ehVisaoConvenio(p.visao)) {
    return new Response("Esta visão não tem exportação.", { status: 400, headers: CABECALHOS_PRIVADOS });
  }
  // F3.2: o CSV de uma tabela do painel (`tabela=<id>`) sai com o filtro e a ordem dela; sem `tabela`, a visão inteira.
  const estados = estadosDaVisao(p.visao, req.nextUrl.searchParams);
  const vencidos = sp.tabela === TABELA_PAINEL_VENCIDOS;
  const estado = sp.tabela ? (vencidos ? estados.vencidos : estados.lista) : undefined;
  const leitura = await lerConveniosParaExportar(
    p.visao,
    p.lado,
    {
      uf: p.uf,
      orgao: p.orgao,
      ibge: p.municipio,
      assinadoDe: p.assinadoDe,
      assinadoAte: p.assinadoAte,
      movimento: p.movimento,
    },
    estado ? { estado, vencidos } : undefined,
  );
  const lado = p.visao === "contas" ? `-${p.lado}` : "";
  const onde = p.municipio ?? (p.uf ?? "brasil").toLowerCase();
  const parte = estado ? (vencidos ? "-vencidos" : p.visao === "suspensiva" ? "-a-vencer" : "") + "-filtrado" : "";
  return resposta(leitura, COLUNAS_CONVENIO, `painel-${p.visao}${lado}-${onde}${parte}`);
}
