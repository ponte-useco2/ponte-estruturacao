/**
 * Contrato de dados de oportunidades — v1.0
 *
 * Fonte única de tipos e funções puras para TODA superfície que lê
 * `public/dados/oportunidades.json`:
 *   - painel público      → src/app/oportunidades/OportunidadesClient.tsx
 *   - ambiente Descobrir  → src/app/plataforma/descobrir/DescobrirClient.tsx
 *
 * Extraído de OportunidadesClient.tsx sem mudança de comportamento, para que
 * o ambiente logado seja evolução do painel e não uma segunda implementação
 * do mesmo contrato divergindo em silêncio.
 *
 * As quatro regras do contrato (docs/CONTRATO-DADOS-OPORTUNIDADES.md §"Regras
 * que o front não pode reinterpretar") valem para os dois consumidores:
 *   1. `origem.defasada === true` OBRIGA exibir o aviso.
 *   2. Não recalcular `urgente`, `dias_restantes` nem os totais de `resumo`.
 *   3. Não deduplicar por `programa` — o mesmo programa aparece uma vez por canal.
 *   4. Não reordenar por relevância própria; o array já vem ordenado.
 */

export const CONTRATO_MAJOR = 1;

export type Canal = "proposta" | "emenda";

export interface Oportunidade {
  id: string;
  programa: string;
  orgao: string;
  natureza: string;
  canal: Canal;
  modalidade?: string;
  situacao?: string;
  abre?: string;
  fecha: string;
  dias_restantes: number;
  urgente: boolean;
  nova: boolean;
  aderente: boolean;
  temas: string[];
  codigos: string[];
  propostas_recebidas: number;
  /**
   * Campos do contrato 1.1 — ausentes em payloads 1.0, por isso opcionais.
   * O contrato prevê que minor pode acrescentar chaves sem aviso e que o
   * front deve ignorar o que não conhece; o inverso também vale: quem lê
   * 1.1 precisa tolerar a ausência ao receber 1.0.
   */
  propostas_enviadas?: number;
  propostas_em_elaboracao?: number;
  propostas_por_situacao?: Record<string, number>;
}

export interface PropostaRecente {
  data: string;
  programa: string;
  proponente: string;
  municipio: string;
  uf: string;
  natureza: string;
  situacao: string;
  valor_global: number | null;
  objeto: string;
  mesma_uf: boolean;
}

export interface Payload {
  versao: string;
  gerado_em: string;
  uf: string;
  origem: {
    repositorio: string;
    modulo: string;
    atualizada_em: string | null;
    defasagem_dias: number | null;
    defasada: boolean;
  };
  resumo: {
    abertas: number;
    urgentes: number;
    aderentes: number;
    novas: number;
    propostas_recentes: number;
    encerradas: number;
  };
  filtros: {
    naturezas: string[];
    canais: Canal[];
    orgaos: string[];
  };
  oportunidades: Oportunidade[];
  propostas_recentes: PropostaRecente[];
  encerradas: string[];
}

/** Major diferente do suportado = contrato incompatível; a UI deve recusar. */
export function versaoSuportada(versao: string | undefined): boolean {
  const [major] = String(versao ?? "").split(".");
  return parseInt(major, 10) === CONTRATO_MAJOR;
}

// ============================ DATAS ==============================

/** Parse manual de YYYY-MM-DD. Evita shift de fuso (new Date("YYYY-MM-DD") interpreta como UTC). */
export function parseISODate(iso: string): { d: number; m: number; y: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
}

export function formatBR(iso: string): string {
  const p = parseISODate(iso);
  if (!p) return iso;
  const dd = String(p.d).padStart(2, "0");
  const mm = String(p.m).padStart(2, "0");
  return `${dd}/${mm}/${p.y}`;
}

/** DD/MM — usado na faixa de origem, onde o ano é ruído. */
export function formatDiaMes(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}`;
}

export function formatISOTimestamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}h${m[5]}`;
}

export function formatBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

// ============================ BUSCA E FILTRO ==============================

/** Normaliza para busca: minúsculas, sem acento. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Marcadores do quadro 1f. Derivados de campos que o pipeline já calculou. */
export type Marcador = "aderente" | "nova" | "urgente";

/** Recortes de prazo do quadro 1f. `dias_restantes` vem pronto do pipeline. */
export type FaixaPrazo = "15" | "45";

export interface FiltrosOportunidades {
  q: string;
  natureza: string[];
  canal: string[];
  orgao: string[];
  marcadores: Marcador[];
  prazo: FaixaPrazo | null;
}

export const FILTROS_VAZIOS: FiltrosOportunidades = {
  q: "",
  natureza: [],
  canal: [],
  orgao: [],
  marcadores: [],
  prazo: null,
};

export function temFiltroAtivo(f: FiltrosOportunidades): boolean {
  return (
    f.natureza.length + f.canal.length + f.orgao.length + f.marcadores.length > 0 ||
    f.prazo !== null ||
    f.q.trim().length > 0
  );
}

/**
 * Predicado de filtro. Cumulativo (E entre grupos, OU dentro do grupo) —
 * comportamento idêntico ao do painel público, ampliado com marcadores e
 * prazo, que o quadro 1f acrescenta.
 *
 * `prazo` compara contra `dias_restantes` do payload; não recalcula nada.
 */
export function aplicarFiltros(o: Oportunidade, f: FiltrosOportunidades): boolean {
  if (f.natureza.length && !f.natureza.includes(o.natureza)) return false;
  if (f.canal.length && !f.canal.includes(o.canal)) return false;
  if (f.orgao.length && !f.orgao.includes(o.orgao)) return false;

  if (f.marcadores.length) {
    const casa = f.marcadores.some((m) => o[m]);
    if (!casa) return false;
  }

  if (f.prazo !== null && o.dias_restantes > parseInt(f.prazo, 10)) return false;

  const buscaNorm = norm(f.q.trim());
  if (buscaNorm) {
    const alvo = norm(
      [o.programa, o.orgao, o.temas.join(" "), o.codigos.join(" "), o.modalidade ?? ""].join(" ")
    );
    if (!alvo.includes(buscaNorm)) return false;
  }

  return true;
}

// ============================ ESTADO EM URL ==============================

/**
 * Filtros vivem na URL: o painel público já fazia isso, e o quadro 1f herda.
 * Deep link de recorte é o que permite "manda essa lista pra alguém".
 */
export function paramsParaFiltros(sp: URLSearchParams): FiltrosOportunidades {
  const lista = (k: string) => sp.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
  const prazoBruto = sp.get("prazo");
  return {
    q: sp.get("q") ?? "",
    natureza: lista("natureza"),
    canal: lista("canal"),
    orgao: lista("orgao"),
    marcadores: lista("m").filter((m): m is Marcador =>
      m === "aderente" || m === "nova" || m === "urgente"
    ),
    prazo: prazoBruto === "15" || prazoBruto === "45" ? prazoBruto : null,
  };
}

export function filtrosParaQS(f: FiltrosOportunidades): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.natureza.length) p.set("natureza", f.natureza.join(","));
  if (f.canal.length) p.set("canal", f.canal.join(","));
  if (f.orgao.length) p.set("orgao", f.orgao.join(","));
  if (f.marcadores.length) p.set("m", f.marcadores.join(","));
  if (f.prazo) p.set("prazo", f.prazo);
  const s = p.toString();
  return s ? "?" + s : "";
}

// ============================ ORDENAÇÃO ==============================

/**
 * Regra 4 do contrato: o array já vem ordenado por dias_restantes e depois
 * por nome. Ordenação alternativa só existe atrás de controle visível, e é
 * exatamente isso que o "ORDENAR: FECHA PRIMEIRO ▾" do quadro 1f é.
 */
export type Ordenacao = "fecha_primeiro" | "mais_recentes" | "menos_concorrida";

export const ROTULO_ORDENACAO: Record<Ordenacao, string> = {
  fecha_primeiro: "Fecha primeiro",
  mais_recentes: "Novas primeiro",
  menos_concorrida: "Menos concorrida",
};

export function ordenar(lista: Oportunidade[], por: Ordenacao): Oportunidade[] {
  // fecha_primeiro é a ordem nativa do payload — não reordenar (regra 4).
  if (por === "fecha_primeiro") return lista;
  const copia = [...lista];
  if (por === "mais_recentes") {
    return copia.sort((a, b) => Number(b.nova) - Number(a.nova) || a.dias_restantes - b.dias_restantes);
  }
  return copia.sort(
    (a, b) => a.propostas_recebidas - b.propostas_recebidas || a.dias_restantes - b.dias_restantes
  );
}
