/**
 * Laudo do plano de ação das transferências especiais — o "Pix" (onda 13A).
 *
 * O job (`pix_fundo/laudo.py`) aplica as regras e grava, por plano da PB, cada item com estado, nível,
 * fato e dispositivo (`pix_laudo_plano.itens`). Aqui só se apresenta: grupos, rótulos, o resumo por item,
 * o CSV do ente e quem pode ver. As regras e a versão ficam no job, num lugar só.
 *
 * Pessoal e dívida (CF, art. 166-A, §1º) não estão nos itens do job: a API das especiais não traz a
 * natureza da despesa. A página cruza com o TCE-PB (`marcasPix`, por município e ano).
 *
 * Redação: "não atendido" é "a conferir", nunca "irregular"; falta de dado é "não verificável".
 * Função pura, sem banco e sem relógio.
 */
import type { AcessoFicha } from "./cliente.ts";
import { ROTULO_NIVEL, rotuloItem, type EstadoItem, type ItemLaudo, type NivelItem } from "./itens-laudo.ts";
import type { ColunaCsv } from "./painel.ts";
import { MOTIVOS_ESPECIAIS, type LadoMotivo } from "./pix.ts";
import { moedaCurta } from "./radar.ts";

export type { EstadoItem, NivelItem } from "./itens-laudo.ts";
export { ROTULO_ESTADO, ROTULO_NIVEL, classeEstado, pontosAConferir, rotuloItem } from "./itens-laudo.ts";
/** O item do laudo do Pix é o item genérico (`itens-laudo.ts`). */
export type ItemLaudoPix = ItemLaudo;

export interface PlanoLaudoPix {
  id_plano_acao: number;
  codigo_plano_acao: string | null;
  ano: number;
  beneficiario: string | null;
  cnpj: string | null;
  cod_ibge: string | null;
  autor: string | null;
  codigo_emenda: string | null;
  situacao: string | null;
  valor: number;
  custeio: number;
  investimento: number;
  pago: number;
  dt_primeira_ob: string | null;
  fim_execucao: string | null;
  limite_execucao: string | null;
  area: string | null;
  objeto: string | null;
  saldo: number | null;
  dt_saldo: string | null;
  pior: NivelItem | null;
  n_critico: number;
  n_alto: number;
  n_moderado: number;
  n_pendente: number;
  itens: ItemLaudoPix[];
  versao: string | null;
  /** Análise do plano de trabalho e, no impedido, o porquê (oport_29, regras 2026-10-07.1). Nulo antes delas. */
  analise_pt?: AnalisePlanoPix | null;
}

/** Uma análise do plano de trabalho, como o órgão registrou no Transferegov (trecho do parecer, sem CPF). */
export interface AnalisePtPix {
  orgao: string | null;
  situacao: string | null;
  parecer: string | null;
  data: string | null;
  valor_reprovado: number | null;
  trecho: string | null;
  /** O parecer diz que o plano não é da área do órgão (leitura do texto: "a conferir"). */
  fora_da_area: boolean;
}

export interface ImpedimentoPix {
  motivo: string | null;
  /** O mesmo agrupamento do painel do Pix (`MOTIVOS_ESPECIAIS`). */
  grupo: string | null;
  /** O plano idêntico do mesmo exercício que não ficou impedido: a reapresentação no ciclo seguinte. */
  gemeo: { codigo: string | null; situacao: string | null; pago: number } | null;
  /** O impedido que já é de um ciclo seguinte e tem o mesmo dinheiro ciente noutro plano (regras 2026-10-07.2). */
  repetido_de?: { codigo: string | null; situacao: string | null; pago: number } | null;
  /** O mesmo autor indicou o mesmo ente de novo no exercício seguinte (LC 210/2024, art. 12). */
  reindicacao: { ano: number; planos: number; valor: number; nao_impedidos: number; pago: number } | null;
  /** O exercício seguinte já tem planos na API: só então "não reindicou" é um fato. */
  ano_seguinte_no_dado?: boolean;
}

export interface AnalisePlanoPix {
  analises: AnalisePtPix[];
  total_analises: number;
  impedimento: ImpedimentoPix | null;
}

export const impedido = (p: Pick<PlanoLaudoPix, "situacao">) => (p.situacao ?? "").toUpperCase().startsWith("IMPEDIDO");

export interface PorQueImpedido {
  rotulo: string;
  lado: LadoMotivo;
  /** O motivo como o Transferegov escreve. */
  motivo: string | null;
  /** O que aconteceu depois, em frases prontas: a reapresentação no mesmo ano e a reindicação no seguinte. */
  depois: string[];
  /** Ficou com o dinheiro no mesmo exercício pelo gêmeo (ciente). */
  recuperado: boolean;
}

/** Por que o plano ficou impedido e o que aconteceu depois. Nulo se o plano não está impedido. */
export function porQueImpedido(p: PlanoLaudoPix): PorQueImpedido | null {
  if (!impedido(p)) return null;
  const im = p.analise_pt?.impedimento ?? null;
  const def = MOTIVOS_ESPECIAIS.find((m) => m.motivo === im?.grupo);
  const depois: string[] = [];
  // "Não é da minha área" é a resposta normal de quem não é o órgão competente; o sinal é TODOS dizerem isso.
  const analises = p.analise_pt?.analises ?? [];
  if (analises.length > 0 && analises.every((a) => a.fora_da_area)) {
    depois.push(
      analises.length === 1
        ? "O único órgão que se manifestou disse que o plano não é da área dele: nenhum órgão competente o analisou (a conferir)."
        : "Todos os órgãos que se manifestaram disseram que o plano não é da área deles: nenhum órgão competente o analisou (a conferir).",
    );
  }
  const g = im?.gemeo ?? null;
  if (g) {
    depois.push(
      `Reapresentado no mesmo ano, num ciclo seguinte (plano ${g.codigo ?? "sem código"}), que ficou ${(g.situacao ?? "sem situação").toLowerCase()}` +
        (g.pago > 0 ? ` e recebeu ${moedaCurta(g.pago)}.` : ", ainda sem pagamento."),
    );
  }
  const rep = im?.repetido_de ?? null;
  if (rep) {
    depois.push(
      `Repetição do mesmo dinheiro num ciclo seguinte do mesmo ano: o valor está no plano ${rep.codigo ?? "sem código"}, que ficou ` +
        `${(rep.situacao ?? "sem situação").toLowerCase()}. Este impedimento não tirou dinheiro do ente.`,
    );
  }
  const r = im?.reindicacao ?? null;
  if (r) {
    depois.push(
      `Em ${r.ano}, o mesmo autor indicou de novo este ente: ${r.planos === 1 ? "1 plano" : `${r.planos} planos`}, ${moedaCurta(r.valor)}` +
        (r.nao_impedidos < r.planos ? ` (${r.nao_impedidos} sem impedimento)` : "") +
        (r.pago > 0 ? `, ${moedaCurta(r.pago)} já pagos.` : "."),
    );
  } else if (im?.ano_seguinte_no_dado) {
    depois.push(`Em ${p.ano + 1}, o mesmo autor não indicou de novo este ente pelo Pix.`);
  }
  return {
    rotulo: def?.rotulo ?? "Impedido sem motivo agrupado",
    lado: def?.lado ?? "outro",
    motivo: im?.motivo ?? null,
    depois,
    recuperado: Boolean((g && !(g.situacao ?? "").toUpperCase().startsWith("IMPEDIDO")) || rep),
  };
}

export interface ImpedidosDoAno {
  ano: number;
  grupo: string;
  rotulo: string;
  lado: LadoMotivo;
  planos: number;
  valor: number;
  /** Quantos foram reapresentados no mesmo ano e ficaram cientes, ou eram repetição (o dinheiro não se perdeu ali). */
  recuperados: number;
  valorRecuperado: number;
  /** O prejuízo líquido: o valor impedido menos o que voltou no mesmo ano. */
  valorPerdido: number;
  /** Quantos tiveram o ente reindicado pelo mesmo autor no ano seguinte. */
  reindicados: number;
}

/**
 * Os impedidos do ente por ano e motivo, a partir do ano dado (o relatório usa os dois últimos exercícios):
 * do maior ano para o menor e, no ano, do maior valor para o menor.
 */
export function impedidosPorAno(planos: PlanoLaudoPix[], desdeAno: number): ImpedidosDoAno[] {
  const m = new Map<string, ImpedidosDoAno>();
  for (const p of planos) {
    if (!impedido(p) || p.ano < desdeAno) continue;
    const q = porQueImpedido(p);
    const grupo = p.analise_pt?.impedimento?.grupo ?? "sem_motivo";
    const k = `${p.ano}|${grupo}`;
    const g = m.get(k) ?? {
      ano: p.ano, grupo, rotulo: q?.rotulo ?? grupo, lado: q?.lado ?? "outro",
      planos: 0, valor: 0, recuperados: 0, valorRecuperado: 0, valorPerdido: 0, reindicados: 0,
    };
    g.planos += 1;
    g.valor += p.valor;
    if (q?.recuperado) {
      g.recuperados += 1;
      g.valorRecuperado += p.valor;
    } else {
      g.valorPerdido += p.valor;
    }
    if (p.analise_pt?.impedimento?.reindicacao) g.reindicados += 1;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.ano - a.ano || b.valor - a.valor);
}

export interface AutorLaudoPix {
  ano: number;
  codigo_parlamentar: number;
  autor: string | null;
  planos: number;
  valor: number;
  investimento: number;
  pct_capital: number | null;
  planos_uf: number;
}

export interface ResumoLaudoPix {
  item: string;
  estado: EstadoItem;
  nivel: NivelItem | null;
  planos: number;
  valor: number;
}

/** Os grupos do roteiro, na ordem da IN 93: comunicação e conta, destino, relatórios, prazo, dinheiro. */
export const GRUPOS: { letra: string; titulo: string }[] = [
  { letra: "A", titulo: "Comunicação, conta e plano de trabalho" },
  { letra: "B", titulo: "Para onde foi o dinheiro" },
  { letra: "C", titulo: "Relatórios de gestão" },
  { letra: "D", titulo: "Prazo e ritmo da execução" },
  { letra: "E", titulo: "Dinheiro na conta" },
];

/** Os itens de um grupo, na ordem do catálogo (o job já grava na ordem). */
export function itensDoGrupo(itens: ItemLaudoPix[], letra: string): ItemLaudoPix[] {
  return itens.filter((i) => i.item.startsWith(letra));
}

// ================================================================ resumo por item (painel)

export interface LinhaResumoItem {
  item: string;
  titulo: string;
  planos: number;
  critico: number;
  alto: number;
  moderado: number;
  atendido: number;
  outros: number;
  valorConferir: number;
}

/** Uma linha por item: quantos planos em cada estado. `titulos` vem de um plano qualquer (os itens do job). */
export function resumoPorItem(resumo: ResumoLaudoPix[], titulos: Record<string, string>): LinhaResumoItem[] {
  const por = new Map<string, LinhaResumoItem>();
  for (const r of resumo) {
    if (r.estado === "nao_se_aplica") continue;
    const l = por.get(r.item) ?? {
      item: r.item, titulo: titulos[r.item] ?? r.item, planos: 0, critico: 0, alto: 0, moderado: 0, atendido: 0, outros: 0, valorConferir: 0,
    };
    l.planos += r.planos;
    if (r.estado === "nao_atendido" && r.nivel) {
      l[r.nivel] += r.planos;
      l.valorConferir += r.valor;
    } else if (r.estado === "atendido") l.atendido += r.planos;
    else l.outros += r.planos;
    por.set(r.item, l);
  }
  return [...por.values()].sort((a, b) => a.item.localeCompare(b.item, "pt-BR", { numeric: true }));
}

// ================================================================ acesso do cliente

/**
 * O cliente vê o laudo só dos planos do próprio município: o IBGE do plano (pelo CNPJ do beneficiário) é o
 * do vínculo confirmado. O Estado da PB não tem IBGE de município e fica só para administradores.
 */
export function podeVerPlanoPix(acesso: AcessoFicha, p: Pick<PlanoLaudoPix, "cod_ibge">): boolean {
  return acesso.ok && !!p.cod_ibge && p.cod_ibge === acesso.ibge;
}

export const urlLaudoPix = (id: number | string) => `/mapa/pix/plano/${encodeURIComponent(String(id))}`;
/** O ente pelo CNPJ (14 dígitos) ou pelo IBGE (7): o "Meu município" só conhece o IBGE. */
export const urlEntePix = (chave: string) => `/mapa/pix/ente/${encodeURIComponent(chave)}`;
export const urlCsvEntePix = (chave: string) => `/mapa/pix/ente/${encodeURIComponent(chave)}/csv`;

export function chaveEnteValida(chave: string): { tipo: "cnpj" | "ibge"; valor: string } | null {
  if (/^\d{14}$/.test(chave)) return { tipo: "cnpj", valor: chave };
  if (/^25\d{5}$/.test(chave)) return { tipo: "ibge", valor: chave };
  return null;
}

// ================================================================ CSV do ente (um plano por linha, um item por coluna)

export function colunasCsvEnte(catalogo: { item: string; titulo: string }[]): ColunaCsv<PlanoLaudoPix>[] {
  const estadoDe = (p: PlanoLaudoPix, item: string) => {
    const i = p.itens.find((x) => x.item === item);
    return i ? rotuloItem(i) : null;
  };
  return [
    { titulo: "Plano de ação", valor: (p) => p.codigo_plano_acao, texto: true },
    { titulo: "Ano", valor: (p) => p.ano },
    { titulo: "Beneficiário", valor: (p) => p.beneficiario },
    { titulo: "CNPJ", valor: (p) => p.cnpj, texto: true },
    { titulo: "Emenda", valor: (p) => p.codigo_emenda },
    { titulo: "Autor", valor: (p) => p.autor },
    { titulo: "Situação", valor: (p) => p.situacao },
    { titulo: "Objeto", valor: (p) => p.objeto },
    { titulo: "Valor (R$)", valor: (p) => p.valor },
    { titulo: "Pago (R$)", valor: (p) => p.pago },
    { titulo: "1º pagamento", valor: (p) => p.dt_primeira_ob },
    { titulo: "Limite da execução", valor: (p) => p.limite_execucao },
    { titulo: "Saldo em conta (R$)", valor: (p) => p.saldo },
    { titulo: "Pior ponto", valor: (p) => (p.pior ? ROTULO_NIVEL[p.pior] : null) },
    ...catalogo.map((c) => ({ titulo: `${c.item} ${c.titulo}`, valor: (p: PlanoLaudoPix) => estadoDe(p, c.item) })),
  ];
}

/** O catálogo de itens a partir dos planos (o primeiro que não seja impedido traz todos, na ordem). */
export function catalogoDe(planos: PlanoLaudoPix[]): { item: string; titulo: string }[] {
  const p = planos.find((x) => x.itens.length) ?? null;
  return p ? p.itens.map((i) => ({ item: i.item, titulo: i.titulo })) : [];
}
