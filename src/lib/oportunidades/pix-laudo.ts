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
import type { ColunaCsv } from "./painel.ts";

export type EstadoItem = "atendido" | "nao_atendido" | "informativo" | "pendente" | "legado" | "nao_verificavel" | "nao_se_aplica";
export type NivelItem = "critico" | "alto" | "moderado";

export interface ItemLaudoPix {
  item: string;
  titulo: string;
  dispositivo: string;
  estado: EstadoItem;
  nivel: NivelItem | null;
  fato: string;
}

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

export const ROTULO_ESTADO: Record<EstadoItem, string> = {
  atendido: "atendido",
  nao_atendido: "a conferir",
  informativo: "informação",
  pendente: "no prazo",
  legado: "legado",
  nao_verificavel: "não verificável",
  nao_se_aplica: "não se aplica",
};

export const ROTULO_NIVEL: Record<NivelItem, string> = { critico: "crítico", alto: "alto", moderado: "moderado" };

/** Os grupos do roteiro, na ordem da IN 93: comunicação e conta, destino, relatórios, prazo, dinheiro. */
export const GRUPOS: { letra: string; titulo: string }[] = [
  { letra: "A", titulo: "Comunicação, conta e plano de trabalho" },
  { letra: "B", titulo: "Para onde foi o dinheiro" },
  { letra: "C", titulo: "Relatórios de gestão" },
  { letra: "D", titulo: "Prazo e ritmo da execução" },
  { letra: "E", titulo: "Dinheiro na conta" },
];

const PESO_NIVEL: Record<NivelItem, number> = { critico: 0, alto: 1, moderado: 2 };

/** Os itens de um grupo, na ordem do catálogo (o job já grava na ordem). */
export function itensDoGrupo(itens: ItemLaudoPix[], letra: string): ItemLaudoPix[] {
  return itens.filter((i) => i.item.startsWith(letra));
}

/** Os pontos a conferir, do mais grave ao mais leve, para o topo do laudo. */
export function pontosAConferir(itens: ItemLaudoPix[]): ItemLaudoPix[] {
  return itens
    .map((i, k) => ({ i, k }))
    .filter(({ i }) => i.estado === "nao_atendido" && i.nivel)
    .sort((a, b) => PESO_NIVEL[a.i.nivel as NivelItem] - PESO_NIVEL[b.i.nivel as NivelItem] || a.k - b.k)
    .map(({ i }) => i);
}

/** Classe de cor do estado (as mesmas etiquetas do laudo do convênio). */
export function classeEstado(i: Pick<ItemLaudoPix, "estado" | "nivel">): string {
  if (i.estado === "nao_atendido" && i.nivel) return `mp-laudo-${i.nivel}`;
  if (i.estado === "atendido") return "mp-laudo-atendido";
  return "mp-laudo-informativo";
}

export function rotuloItem(i: Pick<ItemLaudoPix, "estado" | "nivel">): string {
  if (i.estado === "nao_atendido" && i.nivel) return `a conferir · ${ROTULO_NIVEL[i.nivel]}`;
  return ROTULO_ESTADO[i.estado];
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
