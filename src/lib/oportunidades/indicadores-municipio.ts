/**
 * Indicadores do município (onda 14, camada 2): social, economia, território e governança.
 *
 * O job `municipios/` grava um valor por município e indicador (`mun_indicador`), com o ano, a fonte, a posição
 * na PB e as medianas do porte e da região imediata; as referências de cada indicador (PB e Brasil quando a
 * fonte traz; a mediana e os quartis dos 223 sempre) vão em `mun_referencia`. Nome, unidade e direção vêm do
 * catálogo (`indicadores-municipio.json`), o mesmo que o job usa.
 *
 * Regra de nível (versionada em VERSAO_REGRA_INDICADOR; o máximo é "alto", nunca crítico):
 *   · alto — entre os 25% piores da PB (pelo quartil) e pior que o Brasil;
 *   · moderado — pior que a mediana da PB ou pior que o Brasil;
 *   · em dia — no resto.
 * "Pior que" a mediana ou o Brasil pede uma diferença de mais de 5% (TOLERANCIA): 17,5 contra 17,4 é empate.
 * Só os indicadores-chave do catálogo ganham nível; os de contexto (população, PIB, frota) não. Sem valor, sem
 * nível: a ausência é dita com o porquê da fonte, nunca como zero. Função pura, sem banco e sem relógio.
 *
 * Onda 8, A (09/10/2026): a creche de 0 a 3 anos entra com nível pela regra de sempre (maior é melhor; PB e Brasil
 * pela mesma conta, sinopse do INEP sobre o Censo 2022). A pré-escola e os quatro do MapBiomas (vegetação nativa,
 * a variação dela em 10 anos, agropecuária e área urbanizada) são informativos: `chave: false`, sem nível. Só a
 * variação tem direção (perder vegetação é o pior), e por isso tem posição na PB; as fatias da área não são
 * melhores nem piores em si, e a pré-escola passa de 100 em quase metade dos municípios, o que tornaria a posição
 * enganosa.
 */
import { moedaCurta } from "./radar.ts";

export const VERSAO_REGRA_INDICADOR = "2026-10-01.2";

/** Diferença relativa abaixo da qual o valor empata com a mediana da PB ou com o Brasil. */
export const TOLERANCIA = 0.05;

export type DimensaoIndicador = "municipio" | "economia" | "educacao" | "saude" | "seguranca" | "assistencia" | "territorio" | "governanca";

export interface ItemCatalogo {
  id: string;
  dimensao: DimensaoIndicador;
  nome: string;
  unidade: string;
  casas: number;
  direcao: "maior" | "menor" | null;
  chave: boolean;
  nota?: string;
}

/** As colunas de `mun_indicador` que o relatório lê. */
export interface LinhaIndicador {
  indicador: string;
  ano: string;
  valor: number | null;
  fonte: string;
  url: string | null;
  nota: string | null;
  posicao_pb: number | null;
  total_pb: number | null;
  mediana_porte: number | null;
  mediana_regiao: number | null;
}

export type RecorteReferencia = "PB" | "BR" | "q1_pb" | "mediana_pb" | "q3_pb";

export interface ReferenciaIndicador {
  indicador: string;
  ano: string;
  recorte: RecorteReferencia;
  valor: number;
}

export interface GrupoMunicipio {
  porte: string | null;
  regiao_imediata: string | null;
  regiao_intermediaria: string | null;
  regic: string | null;
  arranjo: string | null;
  polo: boolean | null;
}

export interface EntradaIndicadores {
  catalogo: ItemCatalogo[];
  linhas: LinhaIndicador[];
  referencias: ReferenciaIndicador[];
  grupo: GrupoMunicipio | null;
  /** Fim da execução do job (`mun_execucao.concluida_em`). */
  coletadoEm: string | null;
}

export type NivelIndicador = "alto" | "moderado" | "em_dia";

export interface IndicadorLido {
  id: string;
  dimensao: DimensaoIndicador;
  nome: string;
  unidade: string;
  chave: boolean;
  direcao: "maior" | "menor" | null;
  ano: string;
  valor: number | null;
  /** O valor com a unidade, pronto para mostrar ("82,25%", "14,14 por mil nascidos vivos"). */
  texto: string;
  fonte: string;
  url: string | null;
  /** A nota da linha (por que falta, ou o recorte) e a do catálogo, juntas. */
  nota: string | null;
  pb: string | null;
  br: string | null;
  mediana: string | null;
  porte: string | null;
  regiao: string | null;
  /** "12º de 223" (1º = melhor). */
  posicao: string | null;
  nivel: NivelIndicador | null;
  /** Por que o nível: a comparação que o decidiu. */
  porque: string | null;
}

export interface BlocoIndicadores {
  dimensao: DimensaoIndicador;
  titulo: string;
  itens: IndicadorLido[];
}

export interface LeituraIndicadores {
  /** "O município": população, PIB, IDHM e os grupos de comparação. */
  municipio: IndicadorLido[];
  grupo: GrupoMunicipio | null;
  social: BlocoIndicadores[];
  economia: BlocoIndicadores | null;
  territorio: BlocoIndicadores | null;
  governanca: BlocoIndicadores | null;
  coletadoEm: string | null;
  /** Quantos indicadores-chave em cada nível. */
  contagem: Record<NivelIndicador, number>;
}

export const TITULO_DIMENSAO_INDICADOR: Record<DimensaoIndicador, string> = {
  municipio: "O município",
  economia: "Economia",
  educacao: "Educação",
  saude: "Saúde",
  seguranca: "Segurança",
  assistencia: "Assistência social",
  territorio: "Território",
  governanca: "Governança",
};

const SOCIAL: DimensaoIndicador[] = ["saude", "educacao", "assistencia", "seguranca"];

const CLASSES = ["", "Mínima", "Baixa", "Média", "Alta", "Máxima"];

/**
 * O número com as casas do catálogo. Variação em pontos percentuais (unidade "p.p. …", onda 8, A, 09/10/2026: a da
 * vegetação nativa em 10 anos) leva o sinal, "+0,9" ou "-5,9" (o que arredonda a zero fica "0,0"): sem ele, ganho
 * e perda se confundem na tabela.
 */
function comCasas(v: number, item: Pick<ItemCatalogo, "unidade" | "casas">): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: item.casas,
    maximumFractionDigits: item.casas,
    ...(item.unidade.startsWith("p.p.") ? { signDisplay: "exceptZero" as const } : {}),
  });
}

export function formatarValor(v: number, item: Pick<ItemCatalogo, "unidade" | "casas">): string {
  if (item.unidade === "mil R$") return moedaCurta(v * 1000);
  const t = comCasas(v, item);
  if (item.unidade.startsWith("%")) return `${t}${item.unidade}`;
  if (item.unidade.startsWith("pontos")) return t;
  return `${t} ${item.unidade}`;
}

/** A referência na mesma escala do valor, sem a unidade (moeda em mil R$, classe pelo nome). */
function numero(v: number | null | undefined, item: Pick<ItemCatalogo, "unidade" | "casas">): string | null {
  if (v === null || v === undefined) return null;
  if (item.unidade === "mil R$") return moedaCurta(v * 1000);
  if (item.unidade.startsWith("classe") && CLASSES[Math.round(v)]) return CLASSES[Math.round(v)];
  return comCasas(v, item);
}

const comPonto = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/**
 * O nível de um indicador-chave contra os quartis da PB e o Brasil. Devolve null quando não há como julgar
 * (sem direção, sem valor ou sem a mediana da PB no mesmo ano).
 */
export function nivelIndicador(
  valor: number | null,
  direcao: "maior" | "menor" | null,
  ref: { q1?: number | null; mediana?: number | null; q3?: number | null; br?: number | null },
): { nivel: NivelIndicador; porque: string } | null {
  if (valor === null || !direcao || ref.mediana === null || ref.mediana === undefined) return null;
  const folga = (b: number) => Math.abs(b) * TOLERANCIA;
  const pior = (a: number, b: number) => (direcao === "maior" ? a < b - folga(b) : a > b + folga(b));
  const corte = direcao === "maior" ? ref.q1 : ref.q3;
  const noPiorQuartil = corte !== null && corte !== undefined && (direcao === "maior" ? valor <= corte : valor >= corte);
  const piorQueBr = ref.br !== null && ref.br !== undefined && pior(valor, ref.br);
  const piorQueMediana = pior(valor, ref.mediana);
  if (noPiorQuartil && piorQueBr) return { nivel: "alto", porque: "entre os 25% piores da PB e pior que o Brasil" };
  if (piorQueMediana && piorQueBr) return { nivel: "moderado", porque: "pior que a mediana da PB e que o Brasil" };
  if (piorQueMediana) return { nivel: "moderado", porque: noPiorQuartil ? "entre os 25% piores da PB" : "pior que a mediana da PB" };
  if (piorQueBr) return { nivel: "moderado", porque: "pior que o Brasil" };
  return { nivel: "em_dia", porque: ref.br !== null && ref.br !== undefined ? "na mediana da PB ou melhor, e não pior que o Brasil" : "na mediana da PB ou melhor" };
}

function ler(item: ItemCatalogo, linha: LinhaIndicador, refs: ReferenciaIndicador[]): IndicadorLido {
  // Referência só vale no mesmo ano da linha: comparar 2024 com 2025 seria comparar coisas diferentes.
  const ref = (recorte: RecorteReferencia) => refs.find((r) => r.indicador === item.id && r.recorte === recorte && r.ano === linha.ano)?.valor ?? null;
  const q1 = ref("q1_pb");
  const mediana = ref("mediana_pb");
  const q3 = ref("q3_pb");
  const pb = ref("PB");
  const br = ref("BR");
  const julgado = item.chave ? nivelIndicador(linha.valor, item.direcao, { q1, mediana, q3, br }) : null;
  const classe = item.unidade.startsWith("classe") && linha.nota?.startsWith("classe ") ? linha.nota.slice(7) : null;
  const notas = ([classe ? null : linha.nota, item.nota].filter(Boolean) as string[]).map(comPonto);
  return {
    id: item.id,
    dimensao: item.dimensao,
    nome: item.nome,
    unidade: item.unidade,
    chave: item.chave,
    direcao: item.direcao,
    ano: linha.ano,
    valor: linha.valor,
    texto: linha.valor === null ? "sem informação" : classe ?? formatarValor(linha.valor, item),
    fonte: linha.fonte,
    url: linha.url,
    nota: notas.length ? notas.join(" ") : null,
    pb: numero(pb, item),
    br: numero(br, item),
    mediana: numero(mediana, item),
    porte: numero(linha.mediana_porte, item),
    regiao: numero(linha.mediana_regiao, item),
    posicao: linha.posicao_pb && linha.total_pb ? `${linha.posicao_pb}º de ${linha.total_pb}` : null,
    nivel: julgado?.nivel ?? null,
    porque: julgado?.porque ?? null,
  };
}

export function lerIndicadores(e: EntradaIndicadores): LeituraIndicadores {
  const porId = new Map(e.linhas.map((l) => [l.indicador, l]));
  const lidos = e.catalogo.filter((i) => porId.has(i.id)).map((i) => ler(i, porId.get(i.id) as LinhaIndicador, e.referencias));
  const bloco = (d: DimensaoIndicador): BlocoIndicadores | null => {
    const itens = lidos.filter((x) => x.dimensao === d);
    return itens.length ? { dimensao: d, titulo: TITULO_DIMENSAO_INDICADOR[d], itens } : null;
  };
  const contagem: Record<NivelIndicador, number> = { alto: 0, moderado: 0, em_dia: 0 };
  for (const x of lidos) if (x.nivel) contagem[x.nivel] += 1;
  return {
    municipio: lidos.filter((x) => x.dimensao === "municipio"),
    grupo: e.grupo,
    social: SOCIAL.map(bloco).filter((b): b is BlocoIndicadores => b !== null),
    economia: bloco("economia"),
    territorio: bloco("territorio"),
    governanca: bloco("governanca"),
    coletadoEm: e.coletadoEm,
    contagem,
  };
}

/** Os indicadores com nível, em ordem: alto antes de moderado, e na ordem do catálogo dentro do nível. */
export function indicadoresComNivel(l: LeituraIndicadores): IndicadorLido[] {
  const todos = [...l.municipio, ...l.social.flatMap((b) => b.itens), ...(l.economia?.itens ?? []), ...(l.territorio?.itens ?? []), ...(l.governanca?.itens ?? [])];
  const ordem: Record<NivelIndicador, number> = { alto: 0, moderado: 1, em_dia: 2 };
  return todos.filter((x) => x.nivel).sort((a, b) => ordem[a.nivel as NivelIndicador] - ordem[b.nivel as NivelIndicador]);
}

/** Frase das referências de um indicador: "PB 75,10; mediana dos 223 70,00; Brasil 83,00". */
export function frasesReferencia(x: IndicadorLido): string {
  const partes = [
    x.pb ? `PB ${x.pb}` : null,
    x.mediana ? `mediana dos municípios da PB ${x.mediana}` : null,
    x.br ? `Brasil ${x.br}` : null,
    x.posicao ? `${x.posicao} na PB (1º = melhor)` : null,
  ].filter(Boolean);
  return partes.join("; ");
}

/** A hierarquia urbana da REGIC 2018 (IBGE), pelo código que a planilha traz. */
const REGIC: Record<string, string> = {
  "1A": "Grande Metrópole Nacional",
  "1B": "Metrópole Nacional",
  "1C": "Metrópole",
  "2A": "Capital Regional A",
  "2B": "Capital Regional B",
  "2C": "Capital Regional C",
  "3A": "Centro Sub-Regional A",
  "3B": "Centro Sub-Regional B",
  "4A": "Centro de Zona A",
  "4B": "Centro de Zona B",
  "5": "Centro Local",
};

export function rotuloRegic(codigo: string): string {
  return REGIC[codigo] ? `${REGIC[codigo]} (${codigo})` : codigo;
}
