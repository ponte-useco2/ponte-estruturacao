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
import type { NivelAcesso } from "./pagina-municipio.ts";
import { CHAVE_TODOS, ETAPAS_CAMINHO, ROTULO_ETAPA, maisLento, medianaComparavel, type ColunaCsv, type LinhaDesfecho, type LinhaEtapa } from "./painel.ts";

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

/** As abas e o nível mínimo de cada uma (D1): o público vê o resumo, os municípios, o estado e o dinheiro resumido. */
export const ABAS_UF: readonly { id: AbaUf; nome: string; minimo: NivelAcesso }[] = [
  { id: "resumo", nome: "Resumo", minimo: 0 },
  { id: "municipios", nome: "Municípios", minimo: 0 },
  { id: "estado", nome: "O estado como proponente", minimo: 0 },
  { id: "dinheiro", nome: "Dinheiro", minimo: 0 },
  { id: "tempos", nome: "Tempos e funil", minimo: 1 },
  { id: "relatorio", nome: "Relatório e dados", minimo: 1 },
];

export function abaDaUf(pedida: string | string[] | undefined, nivel: NivelAcesso): AbaUf {
  const p = Array.isArray(pedida) ? pedida[0] : pedida;
  const aba = ABAS_UF.find((a) => a.id === p);
  return aba && nivel >= aba.minimo ? aba.id : "resumo";
}

export function urlUf(sigla: string, aba?: AbaUf): string {
  return `/mapa/uf/${sigla.toLowerCase()}${aba && aba !== "resumo" ? `?aba=${aba}` : ""}`;
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
  instrumentos: number;
  em_execucao: number;
  valor_execucao: number;
  osc_ativas: number | null;
  /** Só para o administrador: a decisão B do fiscal (receber transferência voluntária) e os sinais do painel. */
  decisao_b?: string | null;
  sinais?: number | null;
}

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");

/** A lista neutra: as regiões imediatas em ordem alfabética, e os municípios em ordem alfabética dentro de cada uma. */
export function municipiosPorRegiao(ms: MunicipioUf[]): { regiao: string; municipios: MunicipioUf[] }[] {
  const SEM = "Região não informada";
  const grupos = new Map<string, MunicipioUf[]>();
  for (const m of ms) grupos.set(m.regiao ?? SEM, [...(grupos.get(m.regiao ?? SEM) ?? []), m]);
  return [...grupos.entries()]
    .sort((a, b) => Number(a[0] === SEM) - Number(b[0] === SEM) || a[0].localeCompare(b[0], "pt-BR"))
    .map(([regiao, xs]) => ({ regiao, municipios: [...xs].sort(porNome) }));
}

/** Só para o administrador: quem tem mais sinais do painel primeiro. */
export function porSinais(ms: MunicipioUf[]): MunicipioUf[] {
  return [...ms].sort((a, b) => (b.sinais ?? -1) - (a.sinais ?? -1) || porNome(a, b));
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
