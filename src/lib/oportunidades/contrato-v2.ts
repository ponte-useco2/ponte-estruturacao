/**
 * Contrato de dados de oportunidades — v2.0, multifonte.
 *
 * Espelha `schema/funding-opportunity-2.0.schema.json` do radar
 * (diretoriajnconsulting-dotcom/jn-portal-oportunidades), que é a fonte de
 * verdade. Este arquivo NÃO valida o schema inteiro: quem valida é a Action que
 * aceita o arquivo, com `jsonschema`, antes de ele entrar no repositório. Aqui
 * se garante só o que o front precisa para não quebrar e para não mentir.
 *
 * Convive com `contrato.ts` (v1.1) durante a transição. Não o substitui ainda.
 *
 * ------------------------------------------------ regras que o front NÃO reinterpreta
 *
 *   1. Fonte com `status` diferente de `healthy`, ou oportunidade com
 *      `source.stale`, OBRIGA aviso na tela, nomeando a fonte. Dado velho
 *      apresentado como atual é a mentira mais barata de contar.
 *
 *   2. `summary` descreve o CATÁLOGO INTEIRO — as 171 oportunidades, inclusive
 *      as que a entidade de quem olha não pode pleitear. Pode ser mostrado como
 *      universo ("171 monitoradas"), nunca rotulado como "suas".
 *
 *   3. `matching` e `summary.priority_a` são métricas DA PONTE: respondem "a
 *      Ponte se encaixa?", calculadas contra as quatro carteiras de
 *      `config/portfolios.json`. Não entram em tela nenhuma. A aderência de quem
 *      olha é calculada na leitura, em `elegibilidade.ts`.
 *
 *   4. Não deduplicar por título. O mesmo título pode ser dois instrumentos
 *      diferentes — o radar testa exatamente isso em
 *      `test_same_title_deadline_different_instruments_do_not_merge`.
 *
 *   5. Aberta é `status === "open"` E prazo que ainda não passou. `scheduled`
 *      ainda não abriu e `unknown` é o radar dizendo que não sabe. E `open`
 *      sozinho NÃO basta: o status é o do instante da geração. No catálogo de
 *      10/09/2026 lido em 12/09/2026, 12 das 165 marcadas `open` já tinham
 *      vencido — 7% do catálogo apareceria aberto estando fechado.
 *
 *   6. A ordem do array NÃO é para ser preservada, ao contrário do v1.1. O radar
 *      desempata por `ponte_score` (regra 3), então a ordem dele já embute a
 *      carteira da Ponte. O front reordena por prazo e pela aderência de quem
 *      olha.
 */

export const CONTRATO_V2_MAJOR = 2;

export type StatusV2 = "open" | "closed" | "scheduled" | "unknown";
export type SituacaoMudanca = "baseline" | "new" | "changed" | "closed" | "unchanged";
export type SaudeFonte = "healthy" | "stale" | "error";
export type CampoMudanca = "title" | "status" | "dates.deadline" | "funding.program_budget";
export type TipoInstrumento =
  | "subvencao_economica"
  | "convenio"
  | "termo_fomento"
  | "bolsa"
  | "credito"
  | "investimento"
  | "contratacao_pdi"
  | "premio"
  | "outros";

export interface FonteDaOportunidade {
  id: string;
  name: string;
  official: true;
  url: string;
  checked_at: string;
  stale: boolean;
}

export interface SaudeDaFonte {
  id: string;
  name: string;
  url: string;
  status: SaudeFonte;
  checked_at: string;
  last_success_at: string | null;
  last_change_at: string | null;
  opportunity_count: number;
  consecutive_errors: number;
  error: string | null;
}

/** Uma alteração auditada, com a procedência que o diff do site não tem. */
export interface MudancaV2 {
  detected_at: string;
  field: CampoMudanca;
  before: unknown;
  after: unknown;
  impact_days: number | null;
  source_document: string | null;
}

export interface DocumentoV2 {
  title: string;
  url: string;
  published: string | null;
}

export interface OportunidadeV2 {
  id: string;
  source: FonteDaOportunidade;
  external_id: string | null;
  title: string;
  description: string | null;
  funder: string;
  instrument: { type: TipoInstrumento; repayable: boolean | null };
  status: StatusV2;
  dates: { published: string | null; deadline: string | null };
  eligibility: { organization_types: string[]; geography: string[] };
  /** Crus, NÃO normalizados — passar por `temasNormalizados` antes de usar. */
  themes: string[];
  funding: { program_budget: number | null };
  documents: DocumentoV2[];
  changes: MudancaV2[];
  change_status: SituacaoMudanca;
  /** Métrica da Ponte. Regra 3: não usar. Tipado como unknown de propósito. */
  matching: unknown;
}

export interface PayloadV2 {
  version: string;
  change_mode: "baseline" | "incremental";
  generated_at: string;
  sources: SaudeDaFonte[];
  summary: {
    monitored: number;
    open: number;
    urgent: number;
    new: number;
    changed: number;
    closed: number;
    unchanged: number;
    /** Métrica da Ponte. Regra 3: não usar. */
    priority_a: number;
    stale_sources: number;
  };
  opportunities: OportunidadeV2[];
}

/** Major diferente do suportado = contrato incompatível; a UI deve recusar. */
export function versaoSuportadaV2(versao: string | undefined): boolean {
  const [major] = String(versao ?? "").split(".");
  return parseInt(major, 10) === CONTRATO_V2_MAJOR;
}

/**
 * Guarda estrutural mínima. Devolve o payload tipado ou null.
 *
 * Não é validação de schema — isso é trabalho da Action. É o que impede um
 * arquivo truncado ou de outra versão de derrubar a tela com `undefined is not
 * iterable` em vez de cair no estado "dados indisponíveis", que existe para
 * isso.
 */
export function comoPayloadV2(bruto: unknown): PayloadV2 | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const p = bruto as Partial<PayloadV2>;
  if (!versaoSuportadaV2(p.version)) return null;
  if (typeof p.generated_at !== "string") return null;
  if (!Array.isArray(p.opportunities) || !Array.isArray(p.sources)) return null;
  if (typeof p.summary !== "object" || p.summary === null) return null;
  return p as PayloadV2;
}

// ============================ REGRAS DE LEITURA ============================

/**
 * Prazo de urgência: o MESMO do radar (`pipeline.py`, `<= 15`). Não é o corte
 * de 7 dias dos grupos de prazo da central — aquilo é agrupamento de leitura,
 * isto é a definição de "urgente" que o radar publica em `summary.urgent`.
 * Usar outro número aqui faria a mesma janela ser urgente num lugar e não no
 * outro.
 */
export const DIAS_URGENTE = 15;

/**
 * Hoje, como data de calendário, no horário de quem usa o painel.
 *
 * O radar conta dias em UTC. Contar assim no front erra o dia nas três primeiras
 * horas de cada dia brasileiro — a `/carteira` já documentou esse defeito. O
 * fuso é o mesmo de `central.ts` (Paraíba não tem horário de verão).
 *
 * Recebe o instante em vez de ler o relógio: servidor e cliente precisam
 * concordar na hidratação, e quem decide o instante é o servidor.
 */
const FORMATO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Recife",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hojeLocal(agora: Date): string {
  return FORMATO_DIA.format(agora);
}

/**
 * Dias inteiros de calendário entre hoje e o prazo. Negativo quando já passou;
 * null quando não há prazo — o schema permite, e duas das 171 não têm.
 *
 * As duas datas viram meia-noite UTC antes de subtrair: são datas sem hora, e a
 * subtração em UTC de duas meias-noites UTC dá dia inteiro exato, sem que o
 * fuso interfira.
 */
export function diasAte(prazo: string | null, hojeIso: string): number | null {
  if (!prazo) return null;
  const a = Date.parse(`${prazo.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${hojeIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

/**
 * Regra 5. Recebe a data de hoje porque `status` é o do instante em que o radar
 * gerou o arquivo, e o arquivo é lido dias depois. Sem prazo, vale o status: o
 * schema permite prazo nulo, e sem data não há como afirmar que venceu.
 */
export function ehAberta(o: Pick<OportunidadeV2, "status" | "dates">, hojeIso: string): boolean {
  if (o.status !== "open") return false;
  const d = diasAte(o.dates.deadline, hojeIso);
  return d === null || d >= 0;
}

export function urgente(o: Pick<OportunidadeV2, "status" | "dates">, hojeIso: string): boolean {
  if (!ehAberta(o, hojeIso)) return false;
  const d = diasAte(o.dates.deadline, hojeIso);
  return d !== null && d >= 0 && d <= DIAS_URGENTE;
}

/** Regra 1: as fontes que a tela é obrigada a nomear. */
export function fontesComProblema(p: Pick<PayloadV2, "sources">): SaudeDaFonte[] {
  return p.sources.filter((s) => s.status !== "healthy");
}

// ============================ RÓTULOS ============================

export const ROTULO_INSTRUMENTO: Record<TipoInstrumento, string> = {
  subvencao_economica: "Subvenção econômica",
  convenio: "Convênio",
  termo_fomento: "Termo de fomento",
  bolsa: "Bolsa",
  credito: "Crédito",
  investimento: "Investimento",
  contratacao_pdi: "Contratação de PD&I",
  premio: "Prêmio",
  outros: "Outro instrumento",
};

export const ROTULO_STATUS: Record<StatusV2, string> = {
  open: "Aberta",
  closed: "Encerrada",
  scheduled: "Ainda não abriu",
  unknown: "Situação não informada pela fonte",
};

export const ROTULO_SAUDE: Record<SaudeFonte, string> = {
  healthy: "em dia",
  stale: "desatualizada",
  error: "com falha na última leitura",
};
