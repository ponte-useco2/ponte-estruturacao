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

// ================================================================ descida até o último nível (30/10/2026)

/**
 * Os três blocos da página e onde cada um mora: as linhas da situação em `cq_resultado` (`conjunto`), o recorte por
 * órgão quando existe, e o `teste` dos casos em `cq_caso`. O titular pediu (30/10/2026) que tudo seja clicável até o
 * último nível: situação → órgão (ou motivo) → caso por CNPJ → origem.
 */
export const BLOCOS = {
  notas: { titulo: "Pagamentos com nota de empenho", conjunto: "notas", porOrgao: "notas_orgao", teste: "notas_empenho" },
  emendas: { titulo: "Emendas parlamentares estaduais", conjunto: "emendas", porOrgao: null, teste: "emendas" },
  sancoes: { titulo: "Sanções do CEIS e do CNEP × atos do Diário", conjunto: "sancoes_classe", porOrgao: null, teste: "sancoes" },
} as const;
export type BlocoId = keyof typeof BLOCOS;

export function blocoDaUrl(x: string | undefined): BlocoId | null {
  return x === "notas" || x === "emendas" || x === "sancoes" ? x : null;
}

/** A situação dos casos de sanção é "sanção alcança"; a classe na tabela é "alcança". */
export function situacaoDosCasos(bloco: BlocoId, situacao: string): string {
  return bloco === "sancoes" ? `sanção ${situacao}` : situacao;
}

/**
 * O rótulo na tela. O pacote escreve "CNPJ nos chamamentos da CEHAP (site, fora do Diário)"; por decisão do titular
 * (30/10/2026) a página não nomeia órgão nos rótulos. O endereço continua com o texto do pacote.
 */
export function rotuloSituacao(s: string): string {
  // M-2 da conferência (PUB-13, 30/10/2026): nas emendas, a ligação é por CNPJ em qualquer órgão, sem precisão medida.
  if (s === "CNPJ em ato contratual do Diário") return "CNPJ em ato contratual do Diário (qualquer órgão; precisão não medida)";
  return s.replace(/CNPJ nos chamamentos da CEHAP \(site, fora do Diário\)/, "CNPJ em chamamento publicado só no site do órgão (fora do Diário)");
}

export function urlSituacao(bloco: BlocoId, situacao: string, orgao?: string | null): string {
  const q = new URLSearchParams({ s: situacao });
  if (orgao) q.set("o", orgao);
  return `/mapa/cadeia-quebrada/${bloco}?${q.toString()}`;
}

export const urlCnpjCadeia = (cnpj: string) => `/mapa/cadeia-quebrada/cnpj/${cnpj}`;

export function cnpjDaUrl(x: string | undefined): string | null {
  const d = (x ?? "").replace(/\D/g, "");
  return d.length === 14 ? d : null;
}

export const cnpjLegivelCq = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

/** As fontes de origem de cada bloco, com o endereço público onde o dado nasce. */
export const FONTES_CQ = {
  diario: { nome: "Diário Oficial da Paraíba (A União)", url: "https://auniao.pb.gov.br/servicos/doe" },
  notas: { nome: "Notas de empenho do Estado (API de dados abertos da PB)", url: "https://api.dados.pb.gov.br/api/v1/despesas/notas_empenho" },
  emendas: { nome: "Emendas parlamentares estaduais (dados abertos da PB)", url: "https://dados.pb.gov.br" },
  transparencia: { nome: "Portal da Transparência da Paraíba", url: "https://transparencia.pb.gov.br" },
  sancoes: { nome: "CEIS e CNEP (Portal da Transparência da CGU)", url: "https://portaldatransparencia.gov.br/sancoes" },
} as const;

export const FONTES_DO_BLOCO: Record<BlocoId, (keyof typeof FONTES_CQ)[]> = {
  notas: ["notas", "diario", "transparencia"],
  emendas: ["emendas", "diario"],
  sancoes: ["sancoes", "diario"],
};

const LEIS: [RegExp, string][] = [
  [/14\.133/, "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"],
  [/8\.666/, "https://www.planalto.gov.br/ccivil_03/leis/l8666cons.htm"],
  [/8\.429/, "https://www.planalto.gov.br/ccivil_03/leis/l8429.htm"],
  [/12\.846/, "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12846.htm"],
  [/8\.443/, "https://www.planalto.gov.br/ccivil_03/leis/l8443.htm"],
  [/10\.520/, "https://www.planalto.gov.br/ccivil_03/leis/2002/l10520.htm"],
];

/** O texto oficial da primeira lei citada na base legal (Planalto); null quando a base não cita lei. */
export function urlDaLei(base: string): string | null {
  return LEIS.find(([re]) => re.test(base))?.[1] ?? null;
}

/** Onde conferir um CNPJ fora do portal: a busca do PNCP (contratações públicas) e o CEIS/CNEP da CGU. */
export function origensDoCnpj(cnpj: string): { nome: string; url: string }[] {
  return [
    { nome: "Contratações no PNCP", url: `https://pncp.gov.br/app/editais?q=${cnpj}` },
    { nome: "Sanções no CEIS e no CNEP (CGU)", url: `https://portaldatransparencia.gov.br/sancoes/consulta?cpfCnpj=${cnpj}` },
    { nome: "Despesas no Portal da Transparência da PB", url: FONTES_CQ.transparencia.url },
  ];
}

export interface CasoCq {
  ordem: number;
  teste: string;
  situacao: string;
  cnpj: string;
  orgao: string | null;
  pago: number | string | null;
  notas: number | null;
  anos: string[] | null;
  link_diario: string | null;
  tipo_ato: string | null;
  data_ato: string | null;
  motivo: string | null;
  sancao: { cadastro?: string; tipo?: string; sancionador?: string; uf?: string; inicio?: string | null; fim?: string | null; link?: string } | null;
}

export interface GrupoCq {
  chave: string;
  pares: number;
  pago: number | null;
}

/** Os casos somados por órgão, do maior valor pago ao menor. */
export function casosPorOrgao(casos: CasoCq[]): GrupoCq[] {
  const m = new Map<string, { pares: number; pago: number }>();
  for (const c of casos) {
    const k = c.orgao ?? "órgão não informado";
    const g = m.get(k) ?? { pares: 0, pago: 0 };
    g.pares += 1;
    g.pago += numero(c.pago);
    m.set(k, g);
  }
  return [...m].map(([chave, g]) => ({ chave, ...g })).sort((a, b) => b.pago - a.pago || a.chave.localeCompare(b.chave));
}

/** Para as sanções: os motivos (de `sancoes_motivo`) que caem na classe escolhida, pela regra da própria geração. */
export function motivosDaClasse(ex: ExecucaoCq, motivos: LinhaCq[], classe: string): GrupoCq[] {
  const regras = Object.values(((ex.regra_alcance ?? {}) as { regras?: Record<string, { classe?: string; motivo?: string }> }).regras ?? {});
  const daClasse = new Set(regras.filter((r) => r.classe === classe).map((r) => r.motivo));
  return motivos
    .filter((m) => m.situacao && daClasse.has(m.situacao))
    .map((m) => ({ chave: m.situacao ?? "", pares: numero(m.pares), pago: null }))
    .sort((a, b) => b.pares - a.pares);
}
