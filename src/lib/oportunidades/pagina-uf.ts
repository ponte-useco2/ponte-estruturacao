/**
 * As páginas do território acima do município (desenho aprovado em 08/10/2026): a UF (`/mapa/uf/[sigla]`) e, na
 * U2, o Brasil. O território soma: Brasil › UF › município › entidade.
 *
 * Cobertura, que a página diz: a Paraíba tem o dado completo (todos os instrumentos desde 2008, fiscal, indicadores,
 * OSC); as outras UFs, só o que a base guarda para o país (instrumentos vivos, propostas desde 2019, tempo por etapa,
 * Pix e fundo a fundo por ano). Por isso as comparações com o Brasil usam só os vivos.
 *
 * Decisões do titular (08/10): a lista dos municípios é neutra para quem não é administrador (ordem alfabética
 * dentro da região imediata, sem coluna nem ordem de problema — ranking público rejeitado em 02/10); o
 * administrador vê os sinais do painel e a decisão B do fiscal, com ordenação. Aqui fica o que é puro. Sem banco.
 */
import { GRUPOS_SITUACAO } from "./busca.ts";
import type { ItemCatalogo } from "./indicadores-municipio.ts";
import { especieDe, lenteDe, type LenteEntidade } from "./pagina-entidade.ts";
import { versaoLegivel } from "./osc.ts";
import { NOME_ABA, type NivelAcesso } from "./pagina-municipio.ts";
import {
  CHAVE_TODOS,
  ETAPAS_CAMINHO,
  FATOR_LENTO,
  MINIMO_MEDICOES,
  ROTULO_ETAPA,
  maisLento,
  medianaComparavel,
  type ColunaCsv,
  type LinhaDesfecho,
  type LinhaEtapa,
} from "./painel.ts";

export const NOME_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

/** "na Paraíba", "no Acre", "em Alagoas": o nome com a preposição de cada UF. */
const PREPOSICAO: Record<string, string> = {
  AC: "no", AL: "em", AP: "no", AM: "no", BA: "na", CE: "no", DF: "no", ES: "no", GO: "em", MA: "no", MT: "em", MS: "em", MG: "em",
  PA: "no", PB: "na", PR: "no", PE: "em", PI: "no", RJ: "no", RN: "no", RS: "no", RO: "em", RR: "em", SC: "em", SP: "em", SE: "em", TO: "no",
};
export const naUf = (sigla: string) => `${PREPOSICAO[sigla] ?? "em"} ${NOME_UF[sigla] ?? sigla}`;

/** As lentes vistas do estado (na página do município, a lente estadual é "Estado no município"). */
export const ROTULO_LENTE_UF: Record<LenteEntidade, string> = {
  municipal: "Prefeituras, fundos e órgãos municipais",
  estado: "O governo do estado e os seus órgãos",
  sociedade: "Sociedade civil",
  outros: "Empresas, Sistema S e outros",
};

/** A UF com o dado completo. */
export const UF_COMPLETA = "PB";
export const ehUfCompleta = (sigla: string) => sigla === UF_COMPLETA;

/** A sigla da URL ("pb" ou "PB"), ou null fora das 27. */
export function siglaDaUrl(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toUpperCase();
  return Object.hasOwn(NOME_UF, s) ? s : null;
}

// ================================================================ abas e acesso

export type AbaUf = "resumo" | "municipios" | "estado" | "dinheiro" | "tempos" | "relatorio";

/**
 * As abas e o nível mínimo de cada uma (D1): o público vê o resumo, os municípios, o estado e o dinheiro resumido. Os
 * nomes comuns aos 4 níveis vêm de `NOME_ABA` (B11, 08/10/2026: "Dinheiro" virou "Dinheiro federal", como no município).
 */
export const ABAS_UF: readonly { id: AbaUf; nome: string; minimo: NivelAcesso }[] = [
  { id: "resumo", nome: NOME_ABA.resumo, minimo: 0 },
  { id: "municipios", nome: "Municípios", minimo: 0 },
  { id: "estado", nome: "O estado como proponente", minimo: 0 },
  { id: "dinheiro", nome: NOME_ABA.dinheiro, minimo: 0 },
  { id: "tempos", nome: "Tempos e funil", minimo: 1 },
  { id: "relatorio", nome: NOME_ABA.relatorio, minimo: 1 },
];

export function abaDaUf(pedida: string | string[] | undefined, nivel: NivelAcesso): AbaUf {
  const p = Array.isArray(pedida) ? pedida[0] : pedida;
  const aba = ABAS_UF.find((a) => a.id === p);
  return aba && nivel >= aba.minimo ? aba.id : "resumo";
}

export function urlUf(sigla: string, aba?: AbaUf): string {
  return `/mapa/uf/${sigla.toLowerCase()}${aba && aba !== "resumo" ? `?aba=${aba}` : ""}`;
}

/** A âncora de uma região imediata na aba Municípios ("Sousa - Cajazeiras" → "regiao-sousa-cajazeiras"). */
export function ancoraRegiao(regiao: string): string {
  const s = regiao.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `regiao-${s}`;
}

/** A trilha do município (`trilha.ts`) volta à lista dos municípios da UF, na região dele. */
export function urlRegiao(sigla: string, regiao: string): string {
  return `${urlUf(sigla, "municipios")}#${ancoraRegiao(regiao)}`;
}

/**
 * O relatório da UF para imprimir (C1a, onda 3 de UX, 08/10/2026; proposta da B11, 9.5): uma rota própria, como a do
 * município, e a aba "Relatório e dados" fica curta, com o link, o CSV e as fontes.
 */
export function urlRelatorioUf(sigla: string): string {
  return `/mapa/uf/${sigla.toLowerCase()}/relatorio`;
}

/** Quem abre o relatório: o mesmo nível mínimo da aba "Relatório e dados" (C1a); a regra mora num lugar só, `ABAS_UF`. */
export function podeRelatorioUf(nivel: NivelAcesso): boolean {
  const aba = ABAS_UF.find((a) => a.id === "relatorio");
  return aba !== undefined && nivel >= aba.minimo;
}

// ================================================================ as somas do job (painel_territorio, oport_34)

export interface LinhaTerritorio {
  recorte: string;
  dimensao: "situacao" | "orgao" | "tema" | "total";
  chave: string;
  vivo: boolean | null;
  n: number;
  em_execucao: number;
  valor: number;
  desembolsado: number;
  municipios: number | null;
  proponentes: number | null;
}

export interface GrupoSituacaoUf {
  id: string;
  rotulo: string;
  n: number;
  valor: number;
  desembolsado: number;
}

/** As situações de um recorte agrupadas como na busca; o que não casa com nenhum grupo vai em "Outras situações". */
export function porSituacao(linhas: LinhaTerritorio[], recorte: string, soVivos = false): GrupoSituacaoUf[] {
  const grupos = [...GRUPOS_SITUACAO.map((g) => ({ id: g.id, rotulo: g.rotulo, situacoes: g.situacoes })), { id: "outro", rotulo: "Outras situações", situacoes: [] as string[] }];
  const soma = new Map(grupos.map((g) => [g.id, { id: g.id, rotulo: g.rotulo, n: 0, valor: 0, desembolsado: 0 }]));
  for (const l of linhas) {
    if (l.recorte !== recorte || l.dimensao !== "situacao" || (soVivos && !l.vivo)) continue;
    const g = soma.get(grupos.find((x) => x.situacoes.includes(l.chave))?.id ?? "outro");
    if (!g) continue;
    g.n += l.n;
    g.valor += l.valor;
    g.desembolsado += l.desembolsado;
  }
  return [...soma.values()].filter((g) => g.n > 0);
}

export function totalTerritorio(linhas: LinhaTerritorio[], recorte: string, chave: "vivos" | "todos"): LinhaTerritorio | null {
  return linhas.find((l) => l.recorte === recorte && l.dimensao === "total" && l.chave === chave) ?? null;
}

/** Órgãos ou temas de um recorte (só os vivos), do maior valor para o menor. */
export function porChave(linhas: LinhaTerritorio[], recorte: string, dimensao: "orgao" | "tema"): LinhaTerritorio[] {
  return linhas.filter((l) => l.recorte === recorte && l.dimensao === dimensao).sort((a, b) => b.valor - a.valor || a.chave.localeCompare(b.chave));
}

// ================================================================ quem recebe no estado

export interface ProponenteUf {
  cnpj: string;
  proponente: string | null;
  tipo_agente: string | null;
  cod_ibge: string | null;
  municipio: string | null;
  instrumentos: number;
  em_execucao: number;
  valor: number;
  ultimo_ano: number | null;
}

export interface LenteUf {
  lente: LenteEntidade;
  entidades: number;
  instrumentos: number;
  emExecucao: number;
  valor: number;
}

/** Os proponentes da UF somados pelas lentes da página do município (municipal, estado, sociedade civil, outros). */
export function lentesDaUf(proponentes: ProponenteUf[]): LenteUf[] {
  const ordem: LenteEntidade[] = ["municipal", "estado", "sociedade", "outros"];
  const soma = new Map<LenteEntidade, LenteUf>(ordem.map((lente) => [lente, { lente, entidades: 0, instrumentos: 0, emExecucao: 0, valor: 0 }]));
  for (const p of proponentes) {
    const g = soma.get(lenteDe(especieDe(p.proponente, p.tipo_agente)));
    if (!g) continue;
    g.entidades += 1;
    g.instrumentos += p.instrumentos;
    g.emExecucao += p.em_execucao;
    g.valor += p.valor;
  }
  return ordem.map((l) => soma.get(l) as LenteUf).filter((g) => g.entidades > 0);
}

// ================================================================ municípios

export interface MunicipioUf {
  ibge: string;
  nome: string;
  populacao: number | null;
  porte: string | null;
  regiao: string | null;
  /** A região geográfica intermediária do IBGE (a cor do mapa da PB). */
  intermediaria?: string | null;
  instrumentos: number;
  em_execucao: number;
  valor_execucao: number;
  osc_ativas: number | null;
  /** Só para o administrador: a decisão B do fiscal (receber transferência voluntária) e os sinais do painel. */
  decisao_b?: string | null;
  sinais?: number | null;
}

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");

/** As regiões intermediárias da lista, sem repetir e em ordem alfabética: a ordem da legenda e das cores do mapa da PB. */
export function intermediariasDaUf(ms: MunicipioUf[]): string[] {
  return [...new Set(ms.map((m) => m.intermediaria).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * A lista neutra: os municípios em ordem alfabética dentro de cada região imediata. O mapa da PB pinta pela região
 * intermediária e a tabela agrupa pela imediata (achado H12 da auditoria B1+B2): cada grupo diz a sua intermediária, e
 * os grupos vêm na ordem da legenda — as intermediárias em ordem alfabética e, dentro de cada uma, as imediatas — para
 * as regiões da mesma cor ficarem juntas (B11, 08/10/2026). Continua alfabética, sem ordem de problema.
 */
export function municipiosPorRegiao(ms: MunicipioUf[]): { regiao: string; intermediaria: string | null; municipios: MunicipioUf[] }[] {
  const SEM = "Região não informada";
  const grupos = new Map<string, MunicipioUf[]>();
  for (const m of ms) grupos.set(m.regiao ?? SEM, [...(grupos.get(m.regiao ?? SEM) ?? []), m]);
  // Pelo desenho do IBGE, toda imediata cabe numa intermediária só: vale a primeira que aparecer no grupo.
  const comIntermediaria = [...grupos.entries()].map(([regiao, xs]) => ({
    regiao,
    intermediaria: regiao === SEM ? null : (xs.find((m) => m.intermediaria)?.intermediaria ?? null),
    municipios: [...xs].sort(porNome),
  }));
  return comIntermediaria.sort(
    (a, b) =>
      Number(a.regiao === SEM) - Number(b.regiao === SEM) ||
      Number(a.intermediaria === null) - Number(b.intermediaria === null) ||
      (a.intermediaria ?? "").localeCompare(b.intermediaria ?? "", "pt-BR") ||
      a.regiao.localeCompare(b.regiao, "pt-BR"),
  );
}

/** Só para o administrador: quem tem mais sinais do painel primeiro. */
export function porSinais(ms: MunicipioUf[]): MunicipioUf[] {
  return [...ms].sort((a, b) => (b.sinais ?? -1) - (a.sinais ?? -1) || porNome(a, b));
}

/** Uma região imediata somada (ou o total da UF), para o relatório em papel. */
export interface RegiaoSomada {
  regiao: string;
  intermediaria: string | null;
  municipios: number;
  /** Soma das populações; null quando nenhum município tem o dado (fora da PB). */
  populacao: number | null;
  instrumentos: number;
  emExecucao: number;
  valorExecucao: number;
  /** null quando a leitura não traz as OSC (fora da PB, ou a fonte falhou). */
  oscAtivas: number | null;
  /**
   * Só o administrador lê o fiscal e os sinais (`lerUf`): para os outros, os campos não vêm, e aqui saem 0 e null.
   * `bloqueados`: municípios com a transferência voluntária bloqueada no painel fiscal (decisão B "não atendida").
   */
  bloqueados: number;
  sinais: number | null;
}

function somarRegiao(regiao: string, intermediaria: string | null, ms: MunicipioUf[]): RegiaoSomada {
  const soma = (f: (m: MunicipioUf) => number | null | undefined): number | null => {
    const xs = ms.map(f).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
  };
  return {
    regiao,
    intermediaria,
    municipios: ms.length,
    populacao: soma((m) => m.populacao),
    instrumentos: soma((m) => m.instrumentos) ?? 0,
    emExecucao: soma((m) => m.em_execucao) ?? 0,
    valorExecucao: soma((m) => m.valor_execucao) ?? 0,
    oscAtivas: soma((m) => m.osc_ativas),
    bloqueados: ms.filter((m) => m.decisao_b === "nao_atendido").length,
    sinais: soma((m) => m.sinais),
  };
}

/**
 * Os municípios somados por região imediata, para o papel (C1a, 08/10/2026). Na PB, a lista inteira dos 223 tomaria
 * umas cinco páginas de A4 a mais e dobraria o relatório; somada, cabe em 15 linhas, na ordem da lista da página (a da
 * legenda do mapa) e nunca pelo tamanho do número — continua neutra. Município a município, a lista fica no CSV, na
 * aba "Municípios" e no relatório de cada um. `total` é a UF inteira.
 */
export function municipiosSomadosPorRegiao(ms: MunicipioUf[]): { regioes: RegiaoSomada[]; total: RegiaoSomada } {
  return {
    regioes: municipiosPorRegiao(ms).map((g) => somarRegiao(g.regiao, g.intermediaria, g.municipios)),
    total: somarRegiao("Total", null, ms),
  };
}

export const COLUNAS_CSV_MUNICIPIOS_UF: ColunaCsv<MunicipioUf>[] = [
  { titulo: "IBGE", valor: (m) => m.ibge, texto: true },
  { titulo: "Município", valor: (m) => m.nome },
  { titulo: "Região imediata", valor: (m) => m.regiao },
  { titulo: "Porte", valor: (m) => m.porte },
  { titulo: "População", valor: (m) => m.populacao },
  { titulo: "Instrumentos na base", valor: (m) => m.instrumentos },
  { titulo: "Em execução", valor: (m) => m.em_execucao },
  { titulo: "Valor em execução (R$)", valor: (m) => m.valor_execucao },
  { titulo: "OSC ativas", valor: (m) => m.osc_ativas },
];

// ================================================================ tempos e funil

export interface EtapaComparada {
  etapa: string;
  rotulo: string;
  uf: number | null;
  br: number | null;
  medicoes: number;
  lento: boolean;
}

/** As etapas do caminho de um órgão (ou de todos, `CHAVE_TODOS`) na UF, contra as do mesmo órgão no Brasil. */
export function etapasComparadas(linhas: LinhaEtapa[], uf: string, chave: string): EtapaComparada[] {
  const de = (recorte: string, etapa: string) => linhas.find((l) => l.recorte === recorte && l.dimensao === "orgao" && l.chave === chave && l.etapa === etapa);
  return ETAPAS_CAMINHO.map((etapa) => {
    const a = de(uf, etapa);
    const b = de("BR", etapa);
    const ufM = medianaComparavel(a);
    const brM = medianaComparavel(b);
    return { etapa, rotulo: ROTULO_ETAPA[etapa] ?? etapa, uf: ufM, br: brM, medicoes: a?.n ?? 0, lento: maisLento(ufM, brM) };
  });
}

export interface OrgaoComparado {
  chave: string;
  rotulo: string;
  etapas: EtapaComparada[];
  lentas: number;
}

/** Os órgãos com medição na UF, os que têm mais etapas lentas contra o Brasil primeiro. */
export function orgaosComparados(linhas: LinhaEtapa[], uf: string): OrgaoComparado[] {
  const chaves = new Map<string, string>();
  for (const l of linhas) if (l.recorte === uf && l.dimensao === "orgao" && l.chave !== CHAVE_TODOS) chaves.set(l.chave, l.rotulo ?? l.chave);
  return [...chaves.entries()]
    .map(([chave, rotulo]) => {
      const etapas = etapasComparadas(linhas, uf, chave);
      return { chave, rotulo, etapas, lentas: etapas.filter((e) => e.lento).length };
    })
    .filter((o) => o.etapas.some((e) => e.uf !== null))
    .sort((a, b) => b.lentas - a.lentas || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

export interface FunilAno {
  ano: number;
  enviadas: number;
  assinadas: number;
  negadas: number;
  emAndamento: number;
  /** Das em andamento, as paradas com o concedente há mais de um ano sem análise (o "limbo" do painel). */
  paradas: number;
  /** Assinadas ÷ enviadas, em %. Só quando houve envio. */
  pctAssinadas: number | null;
}

/** O funil das propostas de um recorte (UF ou "BR"), ano a ano: a soma do recorte (sem órgão nem programa). */
export function funil(linhas: LinhaDesfecho[], recorte: string): FunilAno[] {
  return linhas
    .filter((l) => l.uf === recorte && l.cod_programa === null && l.orgao_sup === null)
    .map((l) => {
      const negadas = l.reprovadas + l.impedimento + l.eliminadas;
      // o limbo é parte das abertas com o concedente (as paradas): não soma de novo
      const emAndamento = l.abertas_concedente + l.abertas_proponente + l.aguardando_assinatura;
      return {
        ano: l.ano_envio,
        enviadas: l.enviadas,
        assinadas: l.assinadas,
        negadas,
        emAndamento,
        paradas: l.limbo,
        pctAssinadas: l.enviadas ? (100 * l.assinadas) / l.enviadas : null,
      };
    })
    .sort((a, b) => b.ano - a.ano);
}

// ================================================================ estados vazios (lista da B12, C1a, 08/10/2026)

/** Nenhum órgão estadual na lista: diz o recorte da base, que fora da PB só guarda os instrumentos vivos. */
export function textoSemOrgaoEstadual(sigla: string): string {
  return ehUfCompleta(sigla)
    ? "Nenhum órgão estadual com instrumento na base, que guarda todos os instrumentos da Paraíba desde 2008."
    : "Nenhum órgão estadual com instrumento vivo na base. Fora da Paraíba só entram os vivos (em execução, em prestação de " +
        "contas ou em tomada de contas especial): o órgão que só tem instrumentos encerrados não aparece aqui.";
}

/** Nenhuma etapa com medições bastantes: diz o mínimo de casos (`MINIMO_MEDICOES`) e a janela de 36 meses. */
export function textoSemMedicoes(sigla: string): string {
  return (
    `Sem medições suficientes do tempo das etapas: nenhuma etapa terminou ${MINIMO_MEDICOES} vezes ou mais ${naUf(sigla)} ` +
    "nos últimos 36 meses, o mínimo para a mediana valer a comparação com o Brasil."
  );
}

// ================================================================ fontes e método do relatório (C1a, 08/10/2026)

export interface FonteUf {
  fonte: string;
  data: string | null;
  nota: string;
}

/** O que as fontes precisam da leitura da UF (a forma de `LeituraUfOk`, sem depender do arquivo do servidor). */
export interface LeituraParaFontesUf {
  sigla: string;
  completa: boolean;
  execucao: { dado_ate: string | null };
  municipios: readonly unknown[] | null;
  pix: readonly unknown[] | null;
  fundo: readonly unknown[] | null;
  janelas: number | null;
  indicadores: readonly unknown[] | null;
  osc: { versao: string | null } | null;
}

/**
 * As fontes da página da UF, cada uma com a sua data quando a leitura a tem, como no relatório do município. Só entra
 * a fonte que a página leu: fora da PB não há regiões, indicadores nem OSC. `administrador` acrescenta a origem das
 * colunas que só ele vê (o fiscal e os sinais do painel).
 */
export function fontesDaUf(l: LeituraParaFontesUf, administrador = false): FonteUf[] {
  const fontes: FonteUf[] = [
    {
      fonte: "SICONV / Transferegov (arquivos abertos)",
      data: l.execucao.dado_ate,
      nota: l.completa
        ? "Todos os instrumentos da Paraíba desde 2008, as propostas desde 2019 e o tempo de cada etapa, somados pelo painel de execução da PONTE."
        : `Os instrumentos vivos ${naUf(l.sigla)} (em execução, em prestação de contas e em tomada de contas especial), as propostas desde 2019 e o ` +
          "tempo de cada etapa, somados pelo painel de execução da PONTE. Os encerrados fora da Paraíba não estão na base.",
    },
  ];
  if (l.pix || l.fundo) {
    fontes.push({
      fonte: "API das transferências especiais (Pix) e do fundo a fundo",
      data: null,
      nota: "Os planos de ação por ano, com beneficiário no estado.",
    });
  }
  if (l.janelas !== null) {
    fontes.push({ fonte: "Catálogo de janelas do Mapa (Transferegov)", data: null, nota: "Os programas abertos hoje para proponentes do estado." });
  }
  if (l.completa && l.municipios) {
    fontes.push({
      fonte: "IBGE: regiões geográficas imediatas e intermediárias (2017)",
      data: null,
      nota:
        "Os grupos da lista dos municípios e as cores do mapa. O nome e a população dos 223 vêm da base do painel fiscal da PONTE; o porte é o terço " +
        "da população entre eles." +
        (administrador ? " A transferência voluntária e os sinais são os do painel fiscal e do painel de execução da PONTE (uso interno)." : ""),
    });
  }
  if (l.indicadores?.length) {
    fontes.push({
      fonte: "Indicadores do estado (IBGE e as demais fontes oficiais da página do município)",
      data: null,
      nota: "Cada indicador no ano mais recente, com o Brasil no mesmo ano.",
    });
  }
  if (l.osc) {
    const versao = l.osc.versao ? versaoLegivel(l.osc.versao) : null;
    fontes.push({
      fonte: "Mapa das OSC (Ipea)",
      data: null,
      nota: `As organizações ativas${versao && versao !== "versão não informada" ? `, na versão de ${versao}` : " (versão do arquivo não informada)"}. Sem endereço nem dirigentes.`,
    });
  }
  return fontes;
}

/** Como ler o relatório: as definições que valem para todas as seções. O mínimo e o fator dos tempos vêm de `painel.ts`. */
export function metodoDaUf(completa: boolean, administrador = false): string[] {
  const fator = FATOR_LENTO.toLocaleString("pt-BR");
  return [
    "Instrumento vivo é o que está em execução, em prestação de contas ou em tomada de contas especial. O valor global é o total previsto; o desembolsado, o que já foi liberado.",
    completa
      ? "Na Paraíba, a soma por situação cobre todos os instrumentos desde 2008; a soma por órgão e por tema, só os vivos."
      : "Fora da Paraíba, a base guarda só os instrumentos vivos: as somas e as comparações com o Brasil usam só eles.",
    `Tempos: a mediana, em dias, das etapas que terminaram nos últimos 36 meses. Com menos de ${MINIMO_MEDICOES} medições não há comparação; a etapa é marcada a partir de ${fator} vez a mediana do Brasil.`,
    "Funil: as propostas pelo ano de envio e o que aconteceu com elas até agora. Os anos recentes ainda têm muitas em andamento.",
    administrador
      ? "Uso interno: as colunas do fiscal e dos sinais do painel são só do administrador. A lista dos municípios que os outros veem não tem ordem de problema."
      : `Nenhuma lista deste relatório ordena municípios por problema${completa ? ": os municípios vêm pelas regiões do IBGE, em ordem alfabética" : ""}.`,
  ];
}

// ================================================================ indicadores do estado

export interface IndicadorUf {
  item: ItemCatalogo;
  ano: string;
  uf: number;
  br: number | null;
}

/** O ano mais recente de cada indicador na UF, com o Brasil no mesmo ano; na ordem do catálogo. */
export function indicadoresDaUf(
  refs: { indicador: string; ano: string; recorte: string; valor: number | null }[],
  catalogo: ItemCatalogo[],
  uf: string,
): IndicadorUf[] {
  const saida: IndicadorUf[] = [];
  for (const item of catalogo) {
    const daUf = refs.filter((r) => r.indicador === item.id && r.recorte === uf && r.valor !== null).sort((a, b) => b.ano.localeCompare(a.ano))[0];
    if (!daUf) continue;
    const br = refs.find((r) => r.indicador === item.id && r.recorte === "BR" && r.ano === daUf.ano && r.valor !== null);
    saida.push({ item, ano: daUf.ano, uf: daUf.valor as number, br: br?.valor ?? null });
  }
  return saida;
}
