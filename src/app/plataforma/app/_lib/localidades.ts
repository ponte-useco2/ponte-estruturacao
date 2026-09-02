/**
 * Estados e municípios brasileiros para o onboarding.
 *
 * As 27 UFs vão embutidas — são poucas, nunca mudam, e não vale uma chamada de
 * rede para uma lista tão curta. Os municípios (5.570) vêm da API pública do
 * IBGE sob demanda, quando a UF é escolhida: embutir todos engordaria o bundle
 * do cliente em centenas de KB por um campo de protótipo.
 *
 * A API do IBGE é aberta, sem chave, com CORS liberado. Se ela falhar, o
 * chamador cai para um campo de texto livre — o onboarding nunca trava por
 * causa de uma lista indisponível.
 */

export interface UF {
  sigla: string;
  nome: string;
}

/** Ordenadas por nome — é como aparecem no select. */
export const UFS: UF[] = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

const SIGLAS = new Set(UFS.map((u) => u.sigla));

/** True se a string é uma sigla de UF válida (após normalizar caixa). */
export function ehUF(valor: string): boolean {
  return SIGLAS.has(valor.trim().toUpperCase());
}

// Cache por UF, no escopo do módulo: trocar de estado e voltar não refaz a
// chamada. Vive enquanto a aba estiver aberta, que é a vida do protótipo.
const cache = new Map<string, string[]>();

interface MunicipioIBGE {
  nome: string;
}

/**
 * Nomes dos municípios de uma UF, ordenados. Lança se a rede falhar — quem
 * chama decide o fallback (aqui, um campo de texto livre).
 */
export async function buscarMunicipios(uf: string): Promise<string[]> {
  const sigla = uf.trim().toUpperCase();
  const doCache = cache.get(sigla);
  if (doCache) return doCache;

  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${sigla}/municipios?orderBy=nome`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`IBGE respondeu ${resp.status} para ${sigla}`);

  const dados = (await resp.json()) as MunicipioIBGE[];
  const nomes = dados.map((m) => m.nome);
  cache.set(sigla, nomes);
  return nomes;
}

/**
 * Compõe o valor gravado na sessão a partir de município e UF. Mantém o
 * formato "Município / UF" que o resto do app já espera (Tags, prefill do
 * Apresentar). Vazio se faltar qualquer um dos dois.
 */
export function comporTerritorio(municipio: string, uf: string): string {
  const m = municipio.trim();
  const u = uf.trim().toUpperCase();
  if (!m || !u) return "";
  return `${m} / ${u}`;
}

/**
 * Desfaz "Município / UF" em partes, para semear os selects quando a sessão já
 * tem território salvo. Se o formato for outro (texto antigo, livre), devolve o
 * todo como município e UF vazia — nada se perde.
 */
export function separarTerritorio(territorio: string): { municipio: string; uf: string } {
  const t = (territorio ?? "").trim();
  if (!t) return { municipio: "", uf: "" };

  const barra = t.lastIndexOf("/");
  if (barra === -1) return { municipio: t, uf: "" };

  const municipio = t.slice(0, barra).trim();
  const possivelUf = t.slice(barra + 1).trim().toUpperCase();
  return ehUF(possivelUf) ? { municipio, uf: possivelUf } : { municipio: t, uf: "" };
}
