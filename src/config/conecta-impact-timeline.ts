/**
 * Dados do dashboard privado /conecta-impact-go — Linha do Tempo D0–D365.
 * Fonte: handoff Claude Design (07/2026).
 *
 * D0 = 01/07/2026 · D365 = 30/06/2027.
 */

// ==================== TIPOS ====================

export type BlockTone =
  | "default"
  | "antes"
  | "durante"
  | "depois"
  | "alert"
  | "marco";

export interface Item {
  t: string;
  subs?: string[];
}

export interface Block {
  title: string;
  items: Item[];
  intro?: string;
  tone?: BlockTone;
  basis?: string; // "100%" | "260px" | "280px" | "300px" | "360px"
}

export interface Meta {
  label: string;
  value: string;
}

export interface Phase {
  n: string; // "01" .. "16"
  short: string; // usado no sidebar
  kicker: string; // rótulo pequeno
  title: string; // título principal
  meta: Meta[];
  blocks: Block[];
}

export interface GanttBar {
  name: string;
  dates: string;
  s: [number, number, number]; // [year, month(1-12), day]
  e: [number, number, number];
  color: string;
}

export interface Payment {
  item: string;
  valor: string;
  fat: string; // faturamento
  pag: string; // pagamento
}

export interface FinalAlert {
  n: string;
  t: string;
}

// ==================== HELPERS ====================

const s = (t: string): Item => ({ t, subs: [] });

const CL = (a: string[], d: string[], p: string[]): Block[] => [
  { title: "Checklist — Antes", items: a.map(s), tone: "antes", basis: "260px" },
  { title: "Checklist — Durante", items: d.map(s), tone: "durante", basis: "260px" },
  { title: "Checklist — Depois", items: p.map(s), tone: "depois", basis: "260px" },
];

// ==================== PREMISSAS (OVERVIEW) ====================

export const PREMISSAS: Meta[] = [
  { label: "D0", value: "01/07/2026" },
  { label: "D365", value: "30/06/2027" },
  { label: "Conta de execução", value: "conta exclusiva" },
  { label: "Desembolso", value: "2 parcelas" },
  { label: "Software house", value: "R$ 38.000 · marcos progressivos" },
];

// ==================== GANTT ====================

const GANTT_ACCENT = "#0E7A5F";
const GANTT_BLUE = "#2F5D9E";
const GANTT_SLATE = "#8A9299";
const GANTT_AMBER = "#B97F10";
const GANTT_RUST = "#B4530A";
const GANTT_KHAKI = "#B5AE9B";

export const GANTT_BARS: GanttBar[] = [
  { name: "1 · Governança (D0–D10)", dates: "01/07 – 10/07/26", s: [2026, 7, 1], e: [2026, 7, 10], color: GANTT_SLATE },
  { name: "2 · Contrapartida — gestão", dates: "11/07/26 – 30/04/27", s: [2026, 7, 11], e: [2027, 4, 30], color: GANTT_KHAKI },
  { name: "3 · Ativ. 1 — Pesquisa", dates: "exec. 21/07 – 31/08/26", s: [2026, 7, 21], e: [2026, 8, 31], color: GANTT_ACCENT },
  { name: "4 · SH-0 — Viabilidade", dates: "25/07 – 31/08/26", s: [2026, 7, 25], e: [2026, 8, 31], color: GANTT_BLUE },
  { name: "4 · SH-1 — Engenharia", dates: "01/09 – 31/10/26", s: [2026, 9, 1], e: [2026, 10, 31], color: GANTT_BLUE },
  { name: "4 · SH-2 — Núcleo do MVP", dates: "01/11/26 – 31/01/27", s: [2026, 11, 1], e: [2027, 1, 31], color: GANTT_BLUE },
  { name: "4 · SH-3 — Estabilização", dates: "01/02 – 28/02/27", s: [2027, 2, 1], e: [2027, 2, 28], color: GANTT_BLUE },
  { name: "5 · Ativ. 2 — UX / protótipo", dates: "01/09 – 31/10/26", s: [2026, 9, 1], e: [2026, 10, 31], color: GANTT_ACCENT },
  { name: "6 · Ativ. 4 — PF LGPD/CRM", dates: "01/12/26 – 28/02/27", s: [2026, 12, 1], e: [2027, 2, 28], color: GANTT_AMBER },
  { name: "7 · RTP / 2ª parcela", dates: "15/12/26 – 20/01/27", s: [2026, 12, 15], e: [2027, 1, 20], color: GANTT_RUST },
  { name: "8 · Ativ. 5 — Piloto", dates: "01/03 – 31/05/27", s: [2027, 3, 1], e: [2027, 5, 31], color: GANTT_ACCENT },
  { name: "9 · Ativ. 6 — Melhorias", dates: "01/05 – 30/06/27", s: [2027, 5, 1], e: [2027, 6, 30], color: GANTT_ACCENT },
  { name: "10 · Fechamento", dates: "20/06 – 30/06/27", s: [2027, 6, 20], e: [2027, 6, 30], color: GANTT_SLATE },
  { name: "11 · Prestação de contas", dates: "01/07 – 30/07/27", s: [2027, 7, 1], e: [2027, 7, 30], color: GANTT_SLATE },
];

// ==================== PAGAMENTOS ====================

export const PAYMENTS: Payment[] = [
  { item: "Contrapartida — gestão", valor: "10 × R$ 854", fat: "dia 25 (jul/26–abr/27)", pag: "até dia 05 seguinte" },
  { item: "Ativ. 1 — Pesquisa", valor: "R$ 9.600", fat: "01/09 a 03/09", pag: "08/09 a 10/09" },
  { item: "SH-0 — Viabilidade", valor: "marco", fat: "01/09", pag: "08/09" },
  { item: "SH-1 — Engenharia", valor: "marco", fat: "03/11", pag: "10/11" },
  { item: "Ativ. 2 — UX / protótipo", valor: "R$ 15.800", fat: "03/11", pag: "10/11" },
  { item: "SH-2 — Núcleo do MVP", valor: "marco", fat: "03/02/27", pag: "10/02/27" },
  { item: "SH-3 — Estabilização", valor: "marco", fat: "03/03/27", pag: "10/03/27" },
  { item: "Ativ. 4 — PF LGPD/CRM", valor: "4 × R$ 1.500", fat: "26/12 · 26/01 · 26/02 · 26/03", pag: "05/01 · 05/02 · 05/03 · 05/04" },
  { item: "Ativ. 5 — Piloto", valor: "4 × R$ 1.800", fat: "28/03 · 28/04 · 28/05 · 05/06", pag: "05/04 · 05/05 · 05/06 · 12/06" },
  { item: "Ativ. 6 — Melhorias", valor: "R$ 8.800", fat: "até 27/06/27", pag: "até 30/06/27" },
];

// ==================== ALERTAS FINAIS (OVERVIEW) ====================

export const FINAL_ALERTS: FinalAlert[] = [
  { n: "1", t: "Software house antecipada: sim, mas por marcos." },
  { n: "2", t: "Não misturar escopo da software house com o da UX/prototipação." },
  { n: "3", t: "Não deixar NF da Atividade 6 para julho." },
  { n: "4", t: "Não pagar sem aceite técnico." },
  { n: "5", t: "Não considerar a 2ª parcela como disponível antes da aprovação formal do parcial." },
  { n: "6", t: "Se o TO exigir rito específico para a 2ª parcela, recalibrar imediatamente as datas do bloco RTP." },
];

// ==================== FASES 1–16 ====================
// Continua no arquivo phases.ts (importado abaixo) — separei pra manter navegável
export { PHASES } from "./conecta-impact-phases";
