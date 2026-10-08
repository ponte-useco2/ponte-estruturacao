/**
 * As organizações da sociedade civil da Paraíba pelo Mapa das OSC (Ipea) — E3 da página da entidade (07/10/2026).
 *
 * O job `osc_mapa` (mensal) grava o cadastro de todas as OSC da PB (`osc_entidade`) e o resumo dos 223 municípios
 * (`osc_municipio`). Aqui fica o que é puro: os rótulos (natureza, área, subárea, CEBAS), a versão da fonte em
 * português, a situação na Receita, o agrupamento das filiais pela raiz do CNPJ e o filtro por área. Sem banco.
 *
 * OSC ativa = situação "Ativa" e não removida pelo Ipea. É a lista que a página do município mostra; inaptas,
 * suspensas e baixadas entram só como número. O site e a API do Mapa contam também as inaptas (por isso os números
 * de lá são maiores). Nunca há endereço, coordenadas, dirigentes nem contato: o job não grava.
 */

export type TipoCebas = "suas" | "saude" | "educacao";

export interface CebasOsc {
  tipo: TipoCebas;
  situacao: string | null;
  inicio: string | null;
  fim: string | null;
}

export interface CadastroOsc {
  cnpj: string;
  cnpj_raiz: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  natureza_juridica: string | null;
  matriz: boolean | null;
  situacao_cadastral: string | null;
  removida: boolean;
  ativa: boolean;
  dt_fundacao: string | null;
  dt_fechamento: string | null;
  cod_ibge: string;
  /** O nome do município-sede (a semente dos 223 do job). */
  municipio: string | null;
  cnae_principal: string | null;
  areas: string[];
  subareas: string[];
  cebas: CebasOsc[];
}

/** Uma linha da lista do município (só as colunas que a lista usa). */
export type OscNaLista = Pick<CadastroOsc, "cnpj" | "cnpj_raiz" | "razao_social" | "nome_fantasia" | "natureza_juridica" | "matriz" | "areas" | "dt_fundacao"> & {
  municipio?: string | null;
};

export interface ResumoOscMunicipio {
  cod_ibge: string;
  ativas: number;
  matrizes: number;
  filiais: number;
  raizes: number;
  inaptas: number;
  suspensas: number;
  baixadas: number;
  removidas: number;
  recentes: number;
  com_cebas: number;
  por_area: Record<string, number>;
  por_natureza: Record<string, number>;
}

/** A carga do mês: a versão do arquivo do Ipea e se as planilhas de CEBAS foram lidas. */
export interface FonteOsc {
  versao: string | null;
  cebasLido: boolean;
  /** Last-Modified das planilhas de CEBAS (paradas em 12/2024). */
  cebasModificado: string | null;
}

/** As naturezas que o Ipea inclui (Lei 13.019/2014, art. 2º, I), da tabela da Receita. */
export const ROTULO_NATUREZA: Record<string, string> = {
  "3999": "Associação privada",
  "3069": "Fundação privada",
  "3220": "Organização religiosa",
  "3301": "Organização social (OS)",
  "3204": "Fundação ou associação estrangeira",
};

/** As 8 áreas do Ipea, na ordem da tabela do município (a mais comum na PB primeiro). */
export const ROTULO_AREA: Record<string, string> = {
  desenvolvimento_e_defesa_de_direitos_e_interesses: "Desenvolvimento e defesa de direitos",
  religiao: "Religião",
  outras_atividades_associativas: "Outras atividades associativas",
  cultura_e_recreacao: "Cultura e recreação",
  assistencia_social: "Assistência social",
  associacoes_patronais_e_profissionais: "Associações patronais e profissionais",
  educacao_e_pesquisa: "Educação e pesquisa",
  saude: "Saúde",
  sem_area: "Sem área informada",
};

export const ROTULO_SUBAREA: Record<string, string> = {
  assistencia_social: "Assistência social",
  associacoes_de_atividades_nao_especificadas_anteriormente: "Associações não especificadas",
  associacoes_de_produtores_rurais_pescadores_e_similares: "Produtores rurais, pescadores e similares",
  associacoes_empresariais_e_patronais: "Empresariais e patronais",
  associacoes_profissionais: "Profissionais",
  atividades_de_apoio_a_educacao: "Apoio à educação",
  cultura_e_arte: "Cultura e arte",
  desenvolvimento_e_defesa_de_direitos: "Desenvolvimento e defesa de direitos",
  educacao_infantil: "Educação infantil",
  educacao_profissional: "Educação profissional",
  ensino_fundamental: "Ensino fundamental",
  ensino_superior: "Ensino superior",
  esportes_e_recreacao: "Esportes e recreação",
  estudos_e_pesquisas: "Estudos e pesquisas",
  hospitais: "Hospitais",
  outras_formas_de_educacao_ensino: "Outras formas de educação",
  outros_servicos_de_saude: "Outros serviços de saúde",
  religiao: "Religião",
};

export const ROTULO_CEBAS: Record<TipoCebas, string> = {
  suas: "CEBAS da assistência social (MDS)",
  saude: "CEBAS da saúde (Ministério da Saúde)",
  educacao: "CEBAS da educação (MEC)",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "20260522" → "maio de 2026" (a data no nome do arquivo do Ipea). */
export function versaoLegivel(versao: string | null | undefined): string {
  const m = /^(\d{4})(\d{2})\d{2}$/.exec(versao ?? "");
  if (!m) return "versão não informada";
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? `${MESES[mes - 1]} de ${m[1]}` : "versão não informada";
}

export const rotuloNatureza = (codigo: string | null | undefined) =>
  codigo ? (ROTULO_NATUREZA[codigo] ?? `Natureza ${codigo.replace(/^(\d{3})(\d)$/, "$1-$2")}`) : "Natureza não informada";
export const rotuloArea = (a: string) => ROTULO_AREA[a] ?? a.replace(/_/g, " ");
export const rotuloSubarea = (a: string) => ROTULO_SUBAREA[a] ?? a.replace(/_/g, " ");

/** As subáreas que acrescentam alguma coisa: a que tem o mesmo nome da área ("Religião (Religião)") sai. */
export function subareasUteis(o: Pick<CadastroOsc, "areas" | "subareas">): string[] {
  const areas = new Set(o.areas.map(rotuloArea));
  return o.subareas.map(rotuloSubarea).filter((s) => !areas.has(s));
}

/** O nome que a lista mostra: a razão social; sem ela, o nome fantasia; sem os dois, o CNPJ. */
export function nomeOsc(o: Pick<CadastroOsc, "cnpj" | "razao_social" | "nome_fantasia">): string {
  return o.razao_social || o.nome_fantasia || o.cnpj;
}

/** O nome fantasia só quando acrescenta: some quando repete a razão social ou já está dentro dela. */
export function fantasiaUtil(o: Pick<CadastroOsc, "razao_social" | "nome_fantasia">): string | null {
  const f = o.nome_fantasia?.trim();
  if (!f) return null;
  const limpar = (t: string) => t.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
  return o.razao_social && limpar(o.razao_social).includes(limpar(f)) ? null : f;
}

/** Anos completos desde a fundação, na data `hoje` (AAAA-MM-DD). */
export function idade(fundacao: string | null | undefined, hoje: string): number | null {
  const f = /^(\d{4})-(\d{2})-(\d{2})/.exec(fundacao ?? "");
  const h = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoje);
  if (!f || !h) return null;
  const anos = Number(h[1]) - Number(f[1]) - (h[2] + h[3] < f[2] + f[3] ? 1 : 0);
  return anos >= 0 ? anos : null;
}

/** A situação na Receita, em uma frase, e se pede atenção (inapta, suspensa, baixada ou removida pelo Ipea). */
export function situacaoNaReceita(o: Pick<CadastroOsc, "situacao_cadastral" | "removida" | "ativa">): { texto: string; atencao: boolean } {
  if (o.ativa) return { texto: "Ativa na Receita", atencao: false };
  const s = o.situacao_cadastral ?? "não informada";
  if (s === "Ativa" && o.removida) return { texto: "Ativa na Receita, mas retirada do Mapa das OSC pelo Ipea", atencao: true };
  return { texto: `${s} na Receita`, atencao: true };
}

/**
 * A matriz de uma filial: a raiz com a ordem 0001 e os dígitos verificadores. Vale para o CNPJ alfanumérico (cada
 * posição vale o código ASCII − 48). Para link: a página só existe se a matriz estiver na base ou no cadastro.
 */
export function cnpjDaMatriz(cnpj: string): string | null {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj)) return null;
  const base = `${cnpj.slice(0, 8)}0001`;
  const v = [...base].map((c) => c.charCodeAt(0) - 48);
  const pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv = (xs: number[], ps: number[]) => {
    const r = 11 - (xs.reduce((s, x, i) => s + x * ps[i], 0) % 11);
    return r >= 10 ? 0 : r;
  };
  const d1 = dv(v, pesos);
  const d2 = dv([...v, d1], [6, ...pesos]);
  return `${base}${d1}${d2}`;
}

export interface GrupoOsc {
  /** A matriz, quando está na lista; senão a primeira filial pelo nome. */
  principal: OscNaLista;
  /** As outras linhas da mesma raiz no município (filiais). */
  filiais: number;
  /** A matriz não está na lista do município (fica em outro município, ou não está ativa). */
  matrizFora: boolean;
  /** Todos os CNPJs do grupo no município. */
  cnpjs: string[];
}

/**
 * A lista do município com as filiais agrupadas pela raiz do CNPJ ("e mais N filiais"): uma igreja com 6 templos
 * na cidade vira uma linha. Ordem alfabética do nome.
 */
export function agruparPorRaiz(lista: OscNaLista[]): GrupoOsc[] {
  const porRaiz = new Map<string, OscNaLista[]>();
  for (const o of lista) porRaiz.set(o.cnpj_raiz, [...(porRaiz.get(o.cnpj_raiz) ?? []), o]);
  const grupos: GrupoOsc[] = [];
  for (const xs of porRaiz.values()) {
    const ordem = [...xs].sort((a, b) => nomeOsc(a).localeCompare(nomeOsc(b), "pt-BR") || a.cnpj.localeCompare(b.cnpj));
    const matriz = ordem.find((o) => o.matriz === true);
    grupos.push({ principal: matriz ?? ordem[0], filiais: xs.length - 1, matrizFora: !matriz, cnpjs: ordem.map((o) => o.cnpj) });
  }
  return grupos.sort((a, b) => nomeOsc(a.principal).localeCompare(nomeOsc(b.principal), "pt-BR"));
}

/** As áreas presentes na lista, da mais comum para a menos comum ("sem área" por último). */
export function areasDaLista(lista: Pick<OscNaLista, "areas">[]): { area: string; n: number }[] {
  const c = new Map<string, number>();
  for (const o of lista) for (const a of o.areas.length ? o.areas : ["sem_area"]) c.set(a, (c.get(a) ?? 0) + 1);
  return [...c.entries()]
    .map(([area, n]) => ({ area, n }))
    .sort((a, b) => Number(a.area === "sem_area") - Number(b.area === "sem_area") || b.n - a.n || a.area.localeCompare(b.area));
}

export function filtrarPorArea<T extends Pick<OscNaLista, "areas">>(lista: T[], area: string | null): T[] {
  if (!area) return lista;
  return lista.filter((o) => (area === "sem_area" ? o.areas.length === 0 : o.areas.includes(area)));
}

/** A área pedida na URL, se é uma das conhecidas. */
export function areaDaUrl(v: string | string[] | undefined): string | null {
  const a = Array.isArray(v) ? v[0] : v;
  return a && Object.hasOwn(ROTULO_AREA, a) ? a : null;
}

export const OSC_POR_PAGINA = 100;

const dobrar = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cada palavra digitada (sem acento) tem de aparecer no nome, no nome fantasia ou no CNPJ. */
export function filtrarPorNome<T extends Pick<OscNaLista, "cnpj" | "razao_social" | "nome_fantasia">>(lista: T[], q: string): T[] {
  const termos = dobrar(q).replace(/[./-]/g, "").split(/\s+/).filter((t) => t.length >= 2);
  if (!termos.length) return lista;
  return lista.filter((o) => {
    const alvo = dobrar(`${o.razao_social ?? ""} ${o.nome_fantasia ?? ""} ${o.cnpj}`);
    return termos.every((t) => alvo.includes(t));
  });
}

export interface ListaOsc {
  grupos: (GrupoOsc & { instrumentos: number })[];
  /** Organizações (CNPJs, com as filiais) depois dos filtros. */
  organizacoes: number;
  /** Linhas da tabela (as filiais vão na linha da matriz), em todas as páginas. */
  linhas: number;
  paginas: number;
}

/**
 * A lista da página das organizações: filtro por área e por nome, filiais agrupadas pela raiz, quem tem instrumento
 * federal na base primeiro (do que tem mais para o que tem menos) e depois a ordem alfabética; uma página por vez.
 */
export function listaDoMunicipio(
  ativas: OscNaLista[],
  instrumentos: ReadonlyMap<string, number>,
  filtros: { area: string | null; q: string; pagina: number },
): ListaOsc {
  const filtradas = filtrarPorNome(filtrarPorArea(ativas, filtros.area), filtros.q);
  const grupos = agruparPorRaiz(filtradas)
    .map((g) => ({ ...g, instrumentos: g.cnpjs.reduce((s, c) => s + (instrumentos.get(c) ?? 0), 0) }))
    .sort((a, b) => b.instrumentos - a.instrumentos || nomeOsc(a.principal).localeCompare(nomeOsc(b.principal), "pt-BR"));
  const paginas = Math.max(1, Math.ceil(grupos.length / OSC_POR_PAGINA));
  const pagina = Math.min(Math.max(1, filtros.pagina), paginas);
  return {
    grupos: grupos.slice((pagina - 1) * OSC_POR_PAGINA, pagina * OSC_POR_PAGINA),
    organizacoes: filtradas.length,
    linhas: grupos.length,
    paginas,
  };
}
