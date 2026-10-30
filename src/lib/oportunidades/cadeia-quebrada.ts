/**
 * Cadeia quebrada do gasto, fase 1 (PUB-11 do plano de publicação, 29/10/2026): a parte pura da página. O portal é só
 * vitrine: a análise é da sessão DOE-PB, que entrega um pacote conferido pelo carregador (`cadeia/carregar.py`) e
 * gravado em `cq_execucao` e `cq_resultado` (oport_56).
 *
 * Regras da fase 1 (decisões do titular, PUB-05 e seguintes):
 *   - só agregados: nenhum CNPJ, nome de empresa, de ente ou de pessoa; os recortes por órgão ficam no banco e fora
 *     da tela; os casos (fase 2) nem entram no banco;
 *   - "fecha" é só a linha que o pacote marca com `soma_como_fecha`; "nome… (a conferir)" nunca soma como fecha;
 *   - a frase fixa: ponto para olhar, não irregularidade.
 */

export const FRASE_FIXA = "Ponto para olhar, não irregularidade.";

/** Tira do texto do pacote as referências internas do plano ("(PUB-04b: 20/20)"), que não dizem nada a quem lê. */
export function semReferenciaInterna(t: string | null | undefined): string {
  return (t ?? "").replace(/\s*\(PUB-[^)]*\)/g, "").trim();
}

export interface LinhaCq {
  conjunto: string;
  ordem: number;
  orgao: string | null;
  situacao: string | null;
  confianca: string | null;
  soma_como_fecha: boolean;
  pares: number | null;
  pago: number | string | null;
}

export interface ExecucaoCq {
  id: number;
  concluida_em: string | null;
  dado_ate: string | null;
  sha256_pacote: string | null;
  versao_pacote: string | null;
  gerado_em: string | null;
  regra_versao: string | null;
  regra_fecha: string | null;
  limiar_precisao: string | null;
  contagens: Record<string, unknown>;
  cobertura: Record<string, unknown>;
  regra_alcance: Record<string, unknown>;
}

export interface SituacaoCq {
  situacao: string;
  confianca: string | null;
  fecha: boolean;
  pares: number;
  pago: number | null;
  /** Fatia dos pares do bloco (0 a 1). */
  fatia: number;
}

export interface BlocoCq {
  linhas: SituacaoCq[];
  pares: number;
  pago: number;
}

export interface CadeiaQuebrada {
  notas: BlocoCq;
  emendas: BlocoCq;
  sancoes: BlocoCq;
  /** Os pares que fecham (só `soma_como_fecha`), dos que entram na conta das notas. */
  notasFecham: number;
  orgaosNotas: number;
  fornecedoresConsultados: number | null;
  regras: { chave: string; classe: string; motivo: string; base: string }[];
}

const numero = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : 0);

function bloco(linhas: LinhaCq[]): BlocoCq {
  const pares = linhas.reduce((s, l) => s + numero(l.pares), 0);
  const pago = linhas.reduce((s, l) => s + numero(l.pago), 0);
  return {
    pares,
    pago,
    // Na tela, a linha que fecha vem primeiro; o resto, do maior número de pares ao menor (empate: a ordem do pacote).
    linhas: [...linhas]
      .sort((a, b) => Number(b.soma_como_fecha) - Number(a.soma_como_fecha) || numero(b.pares) - numero(a.pares) || a.ordem - b.ordem)
      .map((l) => ({
        situacao: l.situacao ?? "situação não informada",
        confianca: l.confianca,
        fecha: l.soma_como_fecha === true,
        pares: numero(l.pares),
        pago: l.pago === null ? null : numero(l.pago),
        fatia: pares > 0 ? numero(l.pares) / pares : 0,
      })),
  };
}

/** As três tabelas da página, a partir das linhas da última execução. Não lê os conjuntos por órgão. */
export function montarCadeia(ex: ExecucaoCq, linhas: LinhaCq[]): CadeiaQuebrada {
  const de = (c: string) => linhas.filter((l) => l.conjunto === c);
  const notas = bloco(de("notas"));
  const cob = (ex.cobertura ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const orgaos = cob.notas_empenho?.orgaos;
  const consultados = cob.sancoes?.fornecedores_consultados;
  const regras = Object.entries(((ex.regra_alcance ?? {}) as { regras?: Record<string, Record<string, unknown>> }).regras ?? {})
    .map(([chave, r]) => ({ chave, classe: String(r.classe ?? ""), motivo: String(r.motivo ?? ""), base: String(r.base_legal ?? "") }))
    .sort((a, b) => ORDEM_CLASSE(a.classe) - ORDEM_CLASSE(b.classe) || a.chave.localeCompare(b.chave));
  return {
    notas,
    emendas: bloco(de("emendas")),
    sancoes: bloco(de("sancoes_classe")),
    notasFecham: notas.linhas.filter((l) => l.fecha).reduce((s, l) => s + l.pares, 0),
    orgaosNotas: Array.isArray(orgaos) ? orgaos.length : 0,
    fornecedoresConsultados: typeof consultados === "number" ? consultados : null,
    regras,
  };
}

function ORDEM_CLASSE(c: string): number {
  return ["alcança", "a conferir", "não alcança", "sai"].indexOf(c) + 1 || 9;
}

/**
 * Confere a página contra o manifesto gravado na execução (o mesmo teste da validação independente, PUB-13): os pares
 * das notas, os que fecham, os das emendas e os cruzamentos das sanções. Devolve as divergências (vazio = confere).
 */
export function divergenciasDoManifesto(ex: ExecucaoCq, c: CadeiaQuebrada): string[] {
  const m = ex.contagens ?? {};
  const pares: [string, number][] = [
    ["notas_pares", c.notas.pares],
    ["notas_fecham", c.notasFecham],
    ["emendas_pares", c.emendas.pares],
    ["sancoes_brutos", c.sancoes.pares],
  ];
  return pares.filter(([k, v]) => numero(m[k]) !== v).map(([k, v]) => `${k}: manifesto ${numero(m[k])}, página ${v}`);
}
