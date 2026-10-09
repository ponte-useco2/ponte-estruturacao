/**
 * Busca por município (B12, onda 2 de UX, 08/10/2026). O inventário B0 achou "não há busca por município": para saber
 * quanto dinheiro federal o próprio município recebeu, a pessoa precisava escolher a UF, buscar, escolher o município
 * e buscar de novo. Agora quem digita o nome vê no topo da busca um grupo "Municípios" que leva à página dele.
 *
 * De onde vêm os nomes (nenhuma consulta pesada):
 *   · Paraíba: a lista fixa `municipios-pb.ts` (223, nome oficial com acento), sem banco.
 *   · Outra UF escolhida no filtro: a lista de municípios que a busca já lê para o seletor (`painel_municipios`).
 *   · Sem UF: `painel_municipio` (3,7 mil linhas, uma por município), filtrada no banco por `regexMunicipio`
 *     (13 ms medidos com EXPLAIN ANALYZE em 08/10/2026). Essa tabela só tem os municípios com algum sinal do painel:
 *     3.520 dos 5.271 de fora da PB com instrumento. O que falta aparece quando a pessoa escolhe a UF.
 *
 * Comparação: sem acento, sem caixa, sem hífen nem apóstrofo; z vale s, y vale i e letra dobrada conta uma vez
 * ("souza" acha Sousa); "de", "da", "do", "das", "dos", "e" e o "d'" podem faltar ou sobrar ("sao jose piranhas" acha
 * São José de Piranhas, "olho dagua" acha Olho d'Água). Três graus, do mais forte ao mais fraco: o nome inteiro, o
 * começo do nome e o começo de uma palavra do nome ("piranhas"). Função pura, sem banco.
 */
import { dobrar, urlBusca, urlDoMunicipio, type ParametrosBusca } from "./busca.ts";
import { MUNICIPIOS_PB } from "./municipios-pb.ts";
import { NOME_UF, urlUf } from "./pagina-uf.ts";
import { ufDoIbge } from "./painel.ts";

/** Menos que isso não diz que município é ("sa" casaria com centenas). */
export const MINIMO_LETRAS = 3;
/** Quantos municípios o grupo mostra; os outros pedem o nome inteiro ou a UF. */
export const LIMITE_MUNICIPIOS = 6;
const MAXIMO_PALAVRAS = 6;
const MAXIMO_CARACTERES = 60;

const PARTICULAS = new Set(["d", "da", "das", "de", "do", "dos", "e"]);

/** Uma forma de comparar: as letras seguidas, sem espaço, e onde começa cada palavra. */
interface Forma {
  compacta: string;
  inicios: number[];
}

/** O texto em palavras de comparar: z vira s, y vira i. Espaço, hífen, apóstrofo, ponto e dígito separam. */
function palavras(texto: string): string[] {
  return dobrar(texto)
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((p) => p.replace(/z/g, "s").replace(/y/g, "i"));
}

/** As palavras juntas, com letra dobrada contada uma vez (também entre palavras: "Santa Ana" = "santana"). */
function compactar(lista: string[]): Forma {
  let compacta = "";
  const inicios: number[] = [];
  for (const p of lista) {
    let inicio = compacta.length;
    [...p].forEach((letra, k) => {
      if (compacta.endsWith(letra)) {
        if (k === 0) inicio = compacta.length - 1;
        return;
      }
      compacta += letra;
    });
    inicios.push(inicio);
  }
  return { compacta, inicios };
}

/** Com as partículas e sem elas: "de" pode faltar no que se digita, e o "d'" pode vir colado ("dagua"). */
function formas(texto: string): { palavras: string[]; formas: Forma[] } {
  const todas = palavras(texto);
  const sem = todas.filter((p) => !PARTICULAS.has(p));
  return { palavras: sem.length ? sem : todas, formas: sem.length && sem.length < todas.length ? [compactar(todas), compactar(sem)] : [compactar(todas)] };
}

/** A forma de comparar do nome (exportada para o teste): "São José de Piranhas" → "saojosedepiranhas". */
export function chaveMunicipio(texto: string): string {
  return compactar(palavras(texto)).compacta;
}

/**
 * O que a pessoa digitou serve para procurar município? Não com dígito (número de convênio, CNPJ), não com menos de
 * três letras, não com frase longa. Devolve as formas de comparar, ou null.
 */
function consulta(q: string): ReturnType<typeof formas> | null {
  const t = q.trim();
  if (!t || t.length > MAXIMO_CARACTERES || /\d/.test(t)) return null;
  const f = formas(t);
  if (f.palavras.length > MAXIMO_PALAVRAS || f.formas.every((x) => x.compacta.length < MINIMO_LETRAS)) return null;
  return f;
}

export function pareceMunicipio(q: string): boolean {
  return consulta(q) !== null;
}

/** 3 = o nome inteiro; 2 = o começo do nome; 1 = o começo de uma palavra do nome; 0 = não casa. */
export type GrauMunicipio = 0 | 1 | 2 | 3;

export function grauDoMunicipio(q: string, nome: string): GrauMunicipio {
  const c = consulta(q);
  return c ? grau(c.formas, formas(nome).formas) : 0;
}

function grau(consultas: Forma[], nomes: Forma[]): GrauMunicipio {
  let melhor: GrauMunicipio = 0;
  for (const a of consultas) {
    if (a.compacta.length < MINIMO_LETRAS) continue;
    for (const b of nomes) {
      if (b.compacta === a.compacta) return 3;
      if (b.compacta.startsWith(a.compacta)) melhor = Math.max(melhor, 2) as GrauMunicipio;
      else if (b.inicios.some((i) => i > 0 && b.compacta.startsWith(a.compacta, i))) melhor = Math.max(melhor, 1) as GrauMunicipio;
    }
  }
  return melhor;
}

/** "SÃO JOÃO D'ALIANÇA" → "São João d'Aliança". O nome que já vem em caixa mista (a lista da PB) fica como está. */
export function nomeDeMunicipio(nome: string): string {
  const t = nome.trim().replace(/\s+/g, " ");
  if (t !== t.toUpperCase()) return t;
  const minusculas = new Set(["da", "das", "de", "do", "dos", "e"]);
  const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return t
    .toLowerCase()
    .split(" ")
    .map((palavra, k) =>
      palavra
        .split("-")
        .map((parte, j) => {
          const pedacos = parte.split("'");
          if (pedacos.length === 1) return k > 0 && j === 0 && minusculas.has(parte) ? parte : maiuscula(parte);
          // d'Oeste, d'Água, d'Ávila; mas Sant'Ana.
          return pedacos.map((p, m) => (m === 0 && p === "d" ? p : maiuscula(p))).join("'");
        })
        .join("-"),
    )
    .join(" ");
}

/** Um município candidato, como a lista fixa ou o banco o dão. O nome do banco vem em caixa alta. */
export interface MunicipioNome {
  ibge: string;
  nome: string;
}

export interface MunicipioAchado {
  ibge: string;
  /** Como a tela mostra: o nome oficial na PB; fora dela, o do banco em caixa de título. */
  nome: string;
  uf: string;
  grau: Exclude<GrauMunicipio, 0>;
  /** A página em abas na PB; fora dela, os investimentos (a única tela de município que cobre o Brasil). */
  href: string;
}

/** A lista fixa da PB no formato dos candidatos. */
export const CANDIDATOS_PB: readonly MunicipioNome[] = MUNICIPIOS_PB.map(([ibge, nome]) => ({ ibge, nome }));

/**
 * Os municípios que casam com o que se digitou, do mais forte ao mais fraco: grau, depois a PB na frente, depois o
 * nome mais curto (o mais perto do que se digitou), depois a ordem alfabética. Um código IBGE aparece uma vez só: vale
 * o primeiro candidato (a lista da PB vem antes do banco, e o nome dela é o oficial).
 */
export function casarMunicipios(q: string, candidatos: readonly MunicipioNome[]): MunicipioAchado[] {
  const c = consulta(q);
  if (!c) return [];
  const vistos = new Set<string>();
  const achados: { municipio: MunicipioAchado; tamanho: number }[] = [];
  for (const m of candidatos) {
    const uf = ufDoIbge(m.ibge);
    if (!uf || !m.nome || vistos.has(m.ibge)) continue;
    vistos.add(m.ibge);
    const f = formas(m.nome);
    const g = grau(c.formas, f.formas);
    if (g === 0) continue;
    achados.push({
      municipio: { ibge: m.ibge, nome: nomeDeMunicipio(m.nome), uf, grau: g, href: urlDoMunicipio(m.ibge) },
      tamanho: f.formas[0].compacta.length,
    });
  }
  return achados
    .sort(
      (a, b) =>
        b.municipio.grau - a.municipio.grau ||
        Number(b.municipio.uf === "PB") - Number(a.municipio.uf === "PB") ||
        a.tamanho - b.tamanho ||
        a.municipio.nome.localeCompare(b.municipio.nome, "pt-BR"),
    )
    .map((a) => a.municipio);
}

/** Os primeiros para o grupo da busca e se há mais além deles. */
export function municipiosDaBusca(
  q: string,
  candidatos: readonly MunicipioNome[],
  limite = LIMITE_MUNICIPIOS,
): { achados: MunicipioAchado[]; mais: boolean } {
  const todos = casarMunicipios(q, candidatos);
  return { achados: todos.slice(0, limite), mais: todos.length > limite };
}

/**
 * Onde procurar o município desta busca:
 *   · null — não procura (sem nome, com número, com município já escolhido, ou da página 2 em diante);
 *   · "pb" — só a lista fixa da PB (a aba das organizações é só da PB; ou a UF escolhida é a PB);
 *   · "uf" — a lista da UF escolhida, que a busca já lê para o seletor de município;
 *   · "brasil" — a lista da PB e a consulta por nome fora da PB.
 */
export type OndeProcurarMunicipio = "pb" | "uf" | "brasil" | null;

export function ondeProcurarMunicipio(p: ParametrosBusca): OndeProcurarMunicipio {
  if (p.pagina > 1 || p.municipio || !pareceMunicipio(p.q)) return null;
  if (p.aba === "organizacoes" || p.uf === "PB") return "pb";
  return p.uf ? "uf" : "brasil";
}

/** As letras que o banco grava com acento ou que se trocam na fala (cedilha, z por s, y por i). */
const CLASSE: Record<string, string> = {
  a: "[aáàâãä]",
  e: "[eéèêë]",
  i: "[iíìîïy]",
  o: "[oóòôõö]",
  u: "[uúùûü]",
  c: "[cç]",
  n: "[nñ]",
  s: "[sz]",
};
/** Hífen, apóstrofo e espaço entre as letras: "olhodagua" acha "OLHO D'ÁGUA". */
const SEPARADOR = "[^[:alnum:]]*";

/**
 * O filtro do banco para os nomes fora da PB (`~*` do PostgreSQL, sem caixa): cada palavra do que se digitou, sem as
 * partículas, precisa começar uma palavra do nome, em qualquer ordem. É uma peneira larga, um pouco maior que
 * `casarMunicipios`, que decide depois. Só letras de a a z entram na expressão (o resto separa palavras): nada do que
 * a pessoa digita vira operador. Null quando o texto não serve para procurar município.
 */
export function regexMunicipio(q: string): string | null {
  const c = consulta(q);
  if (!c) return null;
  const palavra = (p: string) => [...p].map((letra) => `${CLASSE[letra] ?? letra}+`).join(SEPARADOR);
  return `^${c.palavras.map((p) => `(?=.*(^|[^[:alnum:]])${palavra(p)})`).join("")}`;
}

// ============================ QUANDO A BUSCA NÃO ACHA NADA ============================

export interface SaidaBusca {
  texto: string;
  /** Sem endereço, a saída é uma dica em texto. */
  href: string | null;
  /** Texto depois do link. */
  nota?: string;
}

const temFiltro = (p: ParametrosBusca) => Boolean((p.aba !== "organizacoes" && p.uf) || p.municipio || p.tema || p.grupo);

/**
 * A palavra mais longa do que se digitou, como a pessoa a escreveu (com acento), sem pontuação nas pontas. Exportada
 * para o vazio da busca unificada (C2, 08/10/2026), que oferece a mesma saída.
 */
export function palavraMaisLonga(q: string): string | null {
  const lista = q
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((p) => p.length >= 2);
  if (lista.length < 2) return null;
  return lista.reduce((a, b) => (b.length > a.length ? b : a));
}

/** O título do resultado vazio: diz o que foi procurado. */
export function tituloBuscaVazia(p: ParametrosBusca): string {
  if (!p.q) return "Nada encontrado com esses filtros";
  return `Nada encontrado para “${p.q}”${temFiltro(p) ? " com os filtros escolhidos" : ""}`;
}

/** A frase do cartão vazio: em que lista se procurou e com o quê, antes do "O que tentar". */
export function textoBuscaVazia(p: ParametrosBusca): string {
  if (p.aba === "organizacoes") {
    const onde = p.municipio ? " nesse município" : "";
    return p.q ? `Nenhuma organização da Paraíba com esse nome ou CNPJ${onde}.` : `Nenhuma organização da Paraíba${onde || " com esses filtros"}.`;
  }
  const lista = p.aba === "instrumentos" ? "Nenhum convênio" : "Nenhuma proposta";
  const com = p.q ? (temFiltro(p) ? "com esses termos e filtros" : "com esses termos") : "com esses filtros";
  return `${lista} ${com}.`;
}

/**
 * O que fazer quando a busca não acha nada (B12; antes: "Nenhum resultado com esses termos e filtros", sem caminho).
 * Da mais perto do que se tentou para a mais longe: tirar o filtro, uma palavra só, a outra lista, o município, as
 * janelas. `temMunicipio`: o grupo "Municípios" já está na tela, e a dica do município sobra.
 */
export function saidasBuscaVazia(p: ParametrosBusca, temMunicipio = false): SaidaBusca[] {
  const saidas: SaidaBusca[] = [];
  const q = p.q;
  if (q && temFiltro(p)) {
    saidas.push({ texto: `Buscar “${q}” sem os filtros`, href: urlBusca(p, { uf: null, municipio: null, tema: null, grupo: null }) });
  }
  const palavra = palavraMaisLonga(q);
  if (palavra) saidas.push({ texto: `Buscar só “${palavra}”`, href: urlBusca(p, { q: palavra }) });
  if (q) {
    const [aba, onde] = p.aba === "instrumentos" ? (["propostas", "nas propostas"] as const) : (["instrumentos", "nos convênios"] as const);
    saidas.push({ texto: `Procurar “${q}” ${onde}`, href: urlBusca(p, { aba }) });
    // C2 (08/10/2026): de uma lista vazia, a busca nos cinco tipos de uma vez (o termo pode ser de município ou entidade).
    if (p.aba !== "tudo") {
      saidas.push({ texto: `Procurar “${q}” em todos os tipos`, href: urlBusca(p, { aba: "tudo" }), nota: "municípios, entidades, organizações, convênios e propostas" });
    }
  }
  if (/\d/.test(q)) saidas.push({ texto: "Confira o número digitado.", href: null });
  if (!temMunicipio) {
    const uf = p.aba === "organizacoes" ? "PB" : (p.uf ?? "PB");
    saidas.push({
      // "de"/"do"/"da" muda de UF para UF: fora da PB, o nome vai entre parênteses.
      texto: uf === "PB" ? "Ver os municípios da Paraíba" : `Ver os municípios na página da UF (${NOME_UF[uf] ?? uf})`,
      href: urlUf(uf, "municipios"),
      nota: "ou escreva na busca só o nome do município, como “Sousa”",
    });
  }
  saidas.push({ texto: "Ver as janelas abertas", href: "/mapa" });
  return saidas;
}
