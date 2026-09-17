/**
 * Painel de Capacidade Fiscal (onda 8) — puro: tipos, rótulos, filtros e a evidência em linhas.
 *
 * As regras moram no job (`fiscal/regras.py`); a tela só mostra o que ele gravou. Nada aqui
 * recalcula estado: a frase, a base legal e a versão da regra vêm prontas do banco.
 */
import { formatarData } from "./central.ts";
import { moedaCurta } from "./radar.ts";

export type EstadoFiscal = "atendido" | "nao_atendido" | "atencao" | "nao_verificavel" | "desatualizado";
export type Decisao = "A" | "B" | "C";

export const ESTADOS: readonly EstadoFiscal[] = ["nao_atendido", "atencao", "desatualizado", "nao_verificavel", "atendido"];

export const ROTULO_ESTADO: Record<EstadoFiscal, string> = {
  atendido: "Atendido",
  nao_atendido: "Não atendido",
  atencao: "Atenção",
  nao_verificavel: "Não verificável",
  desatualizado: "Desatualizado",
};

/** A decisão fala de outro jeito: bloqueada, com alertas, em aberto (faltou dado) ou sem bloqueio. */
export const ROTULO_DECISAO: Record<EstadoFiscal, string> = {
  atendido: "Sem bloqueio",
  nao_atendido: "Bloqueada",
  atencao: "Com alertas",
  nao_verificavel: "Em aberto",
  desatualizado: "Com alertas",
};

/** Marca de forma, além da cor: o estado não pode depender só de cor. */
export const MARCA_ESTADO: Record<EstadoFiscal, string> = {
  atendido: "✓",
  nao_atendido: "✕",
  atencao: "!",
  nao_verificavel: "?",
  desatualizado: "↻",
};

export const TOM_ESTADO: Record<EstadoFiscal, "aderente" | "urgente" | "proto" | "neutro" | "nova"> = {
  atendido: "aderente",
  nao_atendido: "urgente",
  atencao: "proto",
  nao_verificavel: "neutro",
  desatualizado: "nova",
};

export const DECISOES: readonly { id: Decisao; nome: string; curto: string }[] = [
  { id: "A", nome: "Declarações fiscais em dia", curto: "Declarações" },
  { id: "B", nome: "Receber transferência voluntária", curto: "Transferência voluntária" },
  { id: "C", nome: "Contratar operação de crédito", curto: "Operação de crédito" },
];

export const NOME_VERIFICACAO: Record<string, string> = {
  G1: "Entregas ao Siconfi",
  G2: "Despesa com pessoal do Executivo",
  G3: "Regra de ouro",
  G4: "Operações de crédito no exercício",
  G5: "Comprometimento anual com a dívida",
  G6: "Dívida consolidada líquida",
  G7: "CAUC",
  G7A: "CAUC · obrigações de transparência",
  G8: "Previsão orçamentária do objeto e da contrapartida",
  G9: "Autorização legislativa da operação de crédito",
  G10: "Projeto, licenças e capacidade de execução",
  G11: "Aplicação mínima em educação",
  G12: "Aplicação mínima em saúde",
};

/** Para listas apertadas: o que bloqueia, em uma ou duas palavras. */
export const NOME_CURTO: Record<string, string> = {
  G1: "Entregas",
  G2: "Pessoal",
  G3: "Regra de ouro",
  G4: "Crédito no ano",
  G5: "Serviço da dívida",
  G6: "DCL",
  G7: "CAUC",
  G7A: "CAUC (transparência)",
  G8: "Orçamento",
  G9: "Lei autorizativa",
  G10: "Projeto",
  G11: "Educação",
  G12: "Saúde",
};

/** Ordem de leitura: das declarações ao crédito, e os documentais no fim. */
export const ORDEM_VERIFICACOES = ["G1", "G7", "G7A", "G2", "G11", "G12", "G6", "G4", "G3", "G5", "G8", "G9", "G10"] as const;

export const AVISO_FIXO =
  "Leitura automática de fontes públicas, cada uma com a sua data. Não substitui certidão nem a análise da STN, do Tribunal de " +
  "Contas, do concedente ou do agente financeiro. “Não verificável” quer dizer que a fonte não trouxe o dado, nunca que está tudo certo.";

export interface ConclusaoFiscal {
  decisao: Decisao;
  nome: string;
  estado: EstadoFiscal;
  bloqueantes: string[];
  alertas: string[];
  sem_dado: string[];
  documentais: string[];
  versao: string;
}

export interface IndicadoresFiscais {
  pessoal_pct: number | null;
  dcl_pct: number | null;
  operacoes_pct: number | null;
  rgf: string | null;
  educacao_pct: number | null;
  educacao_exercicio: number | null;
  saude_pct: number | null;
  saude_exercicio: number | null;
  pvls: number | null;
  cauc_pendencias: string[];
  // Onda 9 — a base do simulador.
  rcl_ajustada: number | null;
  dc: number | null;
  dcl: number | null;
  operacoes_exercicio: number | null;
  servico_ano: ServicoDoAno | null;
  servico_siconfi: { exercicio: number; juros: number; amortizacao: number; total: number } | null;
  caixa: { exercicio: number; nao_vinculado_liquido: number | null; nao_vinculado_bruto: number | null; total_liquido: number | null } | null;
  pvl_referencia: PvlReferencia | null;
}

/** O comprometimento com a dívida no exercício: do cronograma do PVL recente ou do empenhado no último exercício. */
export type ServicoDoAno =
  | { fonte: "sadipem"; exercicio: number; valor: number; pvl: string | number; data_pvl: string }
  | { fonte: "siconfi"; exercicio: number; valor: number };

export interface PvlReferencia {
  id_pleito: number;
  num_pvl: string | null;
  status: string;
  data_protocolo: string | null;
  tipo_operacao: string | null;
  finalidade: string | null;
  valor: number | null;
  pendente: boolean;
}

/** Uma linha de `fiscal_projecao`: o cronograma do PVL de referência num ano. */
export interface ProjecaoFiscal {
  ano: number;
  servico_demais: number;
  servico_pleiteada: number;
  liberacoes: number;
}

export interface MunicipioFiscal {
  ibge: string;
  nome: string;
  populacao: number | null;
  tce: string | null;
  estados: Record<string, EstadoFiscal>;
  conclusoes: ConclusaoFiscal[];
  indicadores: Partial<IndicadoresFiscais>;
}

export interface FonteEvidencia {
  sistema?: string;
  urls?: string[];
  situacoes?: number[];
  sha256?: string[];
  coletado_em?: string;
  erro?: string;
}

export interface VerificacaoFiscal {
  codigo: string;
  nome: string;
  estado: EstadoFiscal;
  resumo: string;
  decisoes: Decisao[];
  evidencia: Record<string, unknown> & { fonte?: FonteEvidencia };
  base_legal: string;
  documental: boolean;
  versao: string;
}

export interface HistoricoFiscal {
  codigo: string;
  estado: EstadoFiscal;
  resumo: string;
  desde: string;
  visto_ate: string;
}

export interface ExecucaoFiscal {
  id: number;
  concluida_em: string;
  referencia: string | null;
  contagens: Record<string, unknown>;
}

// ============================ FILTROS ============================

export interface ParametrosFiscal {
  q: string;
  decisao: Decisao | null;
  estado: EstadoFiscal | null;
}

const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parametrosFiscal(sp: Record<string, string | string[] | undefined>): ParametrosFiscal {
  const decisao = primeiro(sp.decisao);
  const estado = primeiro(sp.estado);
  return {
    q: (primeiro(sp.q) ?? "").slice(0, 80),
    decisao: decisao === "A" || decisao === "B" || decisao === "C" ? decisao : null,
    estado: estado && (ESTADOS as readonly string[]).includes(estado) ? (estado as EstadoFiscal) : null,
  };
}

export function urlFiscal(p: ParametrosFiscal, muda: Partial<ParametrosFiscal> = {}): string {
  const f = { ...p, ...muda };
  const q = new URLSearchParams();
  if (f.q) q.set("q", f.q);
  if (f.decisao) q.set("decisao", f.decisao);
  if (f.decisao && f.estado) q.set("estado", f.estado);
  const s = q.toString();
  return `/mapa/fiscal${s ? `?${s}` : ""}`;
}

export const urlMunicipioFiscal = (ibge: string) => `/mapa/fiscal/${ibge}`;
export const urlSimularFiscal = (ibge: string) => `/mapa/fiscal/${ibge}/simular`;

function dobrar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function conclusaoDe(m: Pick<MunicipioFiscal, "conclusoes">, d: Decisao): ConclusaoFiscal | undefined {
  return m.conclusoes.find((c) => c.decisao === d);
}

export function filtrarMunicipios(ms: readonly MunicipioFiscal[], p: ParametrosFiscal): MunicipioFiscal[] {
  const termo = dobrar(p.q);
  return ms
    .filter((m) => !termo || dobrar(m.nome).includes(termo) || m.ibge.startsWith(termo))
    .filter((m) => !p.decisao || !p.estado || estadoDaDecisao(conclusaoDe(m, p.decisao)?.estado) === estadoDaDecisao(p.estado))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "Desatualizado" e "atenção" são o mesmo grupo na decisão (com alertas). */
function estadoDaDecisao(e: EstadoFiscal | undefined): string | undefined {
  return e === "desatualizado" ? "atencao" : e;
}

export function contarDecisoes(ms: readonly MunicipioFiscal[]): Record<Decisao, Record<string, number>> {
  const saida = { A: {}, B: {}, C: {} } as Record<Decisao, Record<string, number>>;
  for (const m of ms) {
    for (const c of m.conclusoes) {
      const chave = estadoDaDecisao(c.estado) ?? "nao_verificavel";
      saida[c.decisao][chave] = (saida[c.decisao][chave] ?? 0) + 1;
    }
  }
  return saida;
}

export function ordenarVerificacoes<T extends { codigo: string }>(vs: readonly T[]): T[] {
  const pos = (c: string) => {
    const i = (ORDEM_VERIFICACOES as readonly string[]).indexOf(c);
    return i === -1 ? 99 : i;
  };
  return [...vs].sort((a, b) => pos(a.codigo) - pos(b.codigo));
}

// ============================ EVIDÊNCIA ============================

export interface LinhaEvidencia {
  rotulo: string;
  valor: string;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const pct = (v: unknown): string => {
  const x = num(v);
  return x === null ? "—" : `${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};
const reais = (v: unknown): string => (num(v) === null ? "—" : moedaCurta(num(v)));
const texto = (v: unknown): string => (v === null || v === undefined || v === "" ? "—" : String(v));
const dataIso = (v: unknown): string => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? formatarData(v) : texto(v));

/** Os números que sustentam a frase, em linhas. Só o que ajuda a conferir; o resto fica no banco. */
export function linhasDaEvidencia(v: Pick<VerificacaoFiscal, "codigo" | "evidencia">): LinhaEvidencia[] {
  const e = v.evidencia ?? {};
  const linha = (rotulo: string, valor: string): LinhaEvidencia => ({ rotulo, valor });
  switch (v.codigo) {
    case "G1": {
      const faltas = (e.faltas as { entregavel: string; exercicio: number; prazo: string }[] | undefined) ?? [];
      const retificadas = (e.retificadas as unknown[] | undefined) ?? [];
      return [
        linha("Não constam", faltas.length ? faltas.map((f) => `${f.entregavel}/${f.exercicio} (prazo ${dataIso(f.prazo)})`).join("; ") : "nenhuma"),
        linha("Retificações no período", String(retificadas.length)),
      ];
    }
    case "G2":
      return [
        linha("Período", texto(e.referencia)),
        linha("Despesa total com pessoal", reais(e.dtp)),
        linha("RCL ajustada", reais(e.rcl_ajustada)),
        linha("Sobre a RCL ajustada", pct(e.dtp_pct)),
        linha("Limites (alerta · prudencial · máximo)", `${pct(e.limite_alerta_pct)} · ${pct(e.limite_prudencial_pct)} · ${pct(e.limite_maximo_pct)}`),
        linha("Cálculo", texto(e.calculo)),
      ];
    case "G3":
      return [linha("Exercício", texto(e.exercicio)), linha("Despesas de capital − operações de crédito", reais(e.resultado))];
    case "G4":
      return [
        linha("Período", texto(e.referencia)),
        linha("Operações consideradas", e.sem_operacoes ? "nenhuma no período" : reais(e.operacoes)),
        linha("Sobre a RCL ajustada", pct(e.operacoes_pct)),
        linha("Limite · alerta", `${pct(e.limite_pct)} · ${pct(e.limite_alerta_pct)}`),
      ];
    case "G5": {
      const s = e.servico as ServicoDoAno | null | undefined;
      const origem = !s
        ? "—"
        : s.fonte === "sadipem"
          ? `cronograma do PVL ${s.pvl} (${dataIso(s.data_pvl)}), previsto para ${s.exercicio}`
          : `empenhado em juros e amortização em ${s.exercicio} (RREO), repetido`;
      return [
        linha("Serviço da dívida no ano", reais(s?.valor)),
        linha("Origem", origem),
        linha("RCL ajustada", reais(e.rcl_ajustada)),
        linha("Sobre a RCL ajustada", pct(e.pct)),
        linha("Limite · alerta", "11,50% · 10,35%"),
        linha("Pedidos no SADIPEM", texto(e.pvls)),
      ];
    }
    case "G6":
      return [
        linha("Período", texto(e.referencia)),
        linha("Dívida consolidada líquida", reais(e.dcl)),
        linha("Sobre a RCL ajustada", pct(e.dcl_pct)),
        linha("Limite do Senado · alerta", `${reais(e.limite_senado)} · ${reais(e.limite_alerta)}`),
      ];
    case "G7":
    case "G7A": {
      const pendencias = (e.pendencias as { item: string; nome: string }[] | undefined) ?? [];
      return [
        linha("Posição do CAUC", dataIso(e.data_pesquisa)),
        linha("Pendências", pendencias.length ? pendencias.map((p) => `${p.item} ${p.nome}`).join("; ") : "nenhuma"),
      ];
    }
    case "G11":
    case "G12":
      return [linha("Exercício", texto(e.exercicio)), linha("Aplicado", pct(e.percentual))];
    default:
      return [];
  }
}

export function fonteDaEvidencia(v: Pick<VerificacaoFiscal, "evidencia">): FonteEvidencia | null {
  const f = v.evidencia?.fonte;
  return f && typeof f === "object" && Object.keys(f).length ? (f as FonteEvidencia) : null;
}

/** "a1b2c3d4…" — o bastante para conferir contra o bruto, sem ocupar a linha. */
export function hashCurto(sha: string | undefined): string {
  return sha ? `${sha.slice(0, 12)}…` : "—";
}
