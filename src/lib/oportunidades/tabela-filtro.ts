/**
 * Tabelas com filtro e ordem em cada coluna (onda 15, 13/10/2026): regra permanente do titular. Lógica pura, sem React e
 * sem Next; o componente é `app/mapa/_componentes/TabelaFiltravel.tsx`.
 *
 * CONTRATO escrito pelo supervisor antes do disparo: tipos e assinaturas que o componente e as telas usam. Quem
 * implementa preenche os corpos (hoje lançam "a implementar") e pode ACRESCENTAR funções; não muda nome nem forma do
 * que já está aqui sem combinar com o supervisor.
 *
 * Por que as linhas chegam já com os valores (e não com uma função `valor(linha)`): as telas são componentes do
 * servidor, e um componente do navegador não recebe função como propriedade. Cada linha leva:
 *   · `valores`: o dado cru de cada coluna, que filtra, ordena e vai ao CSV (texto, número, data ISO AAAA-MM-DD ou null);
 *   · `celulas`: o que se desenha em cada coluna (texto, número formatado, link, etiqueta), montado pela tela.
 *
 * Regras (decisões do titular, 13/10/2026):
 *   · vale para toda tabela que LISTA coisas; tabela de resumo e de método (3 a 10 linhas fixas) fica sem filtro;
 *   · nas telas de administrador, ordem por qualquer coluna; nas que forem públicas, o filtro vale, mas sem ordenar por
 *     valor (`ordenavel: false` nas colunas de valor) e a ordem padrão é a alfabética — ranking público foi rejeitado;
 *   · o estado (filtros e ordem) fica no endereço, para compartilhar; o CSV sai só com o que está filtrado;
 *   · no celular, os filtros ficam num painel "Filtrar e ordenar", nunca numa linha de campos que force rolagem lateral.
 *
 * O formato do endereço (onda 15, A, 13/10/2026). Cada tabela tem um prefixo, o `id` dela (só letras minúsculas,
 * dígitos e hífen), e várias tabelas convivem na mesma página sem se tocar:
 *   · texto:     `?t.<tabela>.<coluna>=silva`              — contém todas as palavras, sem acento e sem caixa;
 *   · número:    `?t.<tabela>.<coluna>=1000..5000`         — de..até, limites inclusivos; um lado pode faltar
 *                (`1000..` é "a partir de", `..5000` é "até"); um número só (`1000`) é o valor exato. No endereço, o
 *                número vai com ponto decimal e sem milhar (`1234.5`), como o `String(n)` do JavaScript; à mão, a forma
 *                brasileira também vale quando tem vírgula ou sufixo (`1.234,5`, `1,2 mi`);
 *   · data:      `?t.<tabela>.<coluna>=2024-01-01..2024-12-31` — AAAA-MM-DD, de..até, inclusivos, como o número;
 *   · categoria: `?t.<tabela>.<coluna>=Bancada,Comiss%C3%A3o` — qualquer uma das escolhidas, separadas por vírgula; a
 *                vírgula e a barra dentro de um valor vão escapadas (`\,` e `\\`). A comparação é sem acento e sem caixa;
 *                a mesma chave repetida soma os valores;
 *   · ordem:     `?t.<tabela>.o=<coluna>.<asc|desc>`       — sem ela, a ordem padrão da tela. Por isso nenhuma coluna
 *                pode se chamar `o`.
 * Lixo no endereço (coluna que não existe, coluna sem filtro, número ou data ilegível, ordem por coluna que não ordena,
 * sentido desconhecido) é ignorado, nunca erro. Os parâmetros que não são desta tabela passam intactos.
 */

import type { ReactNode } from "react";
import { paraCsv, type ColunaCsv } from "./csv.ts";

/** Como a coluna filtra: texto (contém), número e data (de… até…), categoria (escolha múltipla). */
export type TipoColuna = "texto" | "numero" | "data" | "categoria";

export interface ColunaTabela {
  /** Identificador curto da coluna no endereço: só letras minúsculas, dígitos e hífen. */
  id: string;
  titulo: string;
  tipo: TipoColuna;
  /** Padrão true. False nas colunas de valor das telas públicas (sem ranking). */
  ordenavel?: boolean;
  /** Padrão true. */
  filtravel?: boolean;
  /** Números e datas à direita. */
  alinhar?: "esquerda" | "direita";
  /** CSV: identificador que o Excel estragaria (código, "1/2024"); ver `ColunaCsv.texto` em `painel.ts`. */
  textoNoCsv?: boolean;
  /** Fora do CSV (ex.: coluna só de link). Padrão: entra. */
  semCsv?: boolean;
  /**
   * Coluna só de filtro (integração da onda 15, 13/10/2026): não se desenha na tabela, mas filtra, ordena e vai ao CSV.
   * Para a célula que junta vários dados ("Proponente e convênio", "Programa e órgão"): a tela mantém o desenho de
   * hoje e põe a UF, o órgão ou o município numa coluna oculta, que o painel de filtros mostra.
   */
  oculta?: boolean;
}

export type ValorCelula = string | number | null;

export interface LinhaTabela {
  /** Única na tabela (código, IBGE, número do convênio...). */
  chave: string;
  valores: Record<string, ValorCelula>;
  celulas: Record<string, ReactNode>;
}

export type Sentido = "asc" | "desc";
export interface Ordem {
  coluna: string;
  sentido: Sentido;
}

/** O filtro de uma coluna, conforme o tipo. */
export type FiltroColuna =
  | { tipo: "texto"; contem: string }
  | { tipo: "numero"; de: number | null; ate: number | null }
  | { tipo: "data"; de: string | null; ate: string | null } // AAAA-MM-DD
  | { tipo: "categoria"; valores: string[] };

export interface EstadoTabela {
  filtros: Record<string, FiltroColuna>;
  ordem: Ordem | null;
}

// ================================================================ peças (onda 15, A, 13/10/2026)

/** O estado sem filtro e na ordem padrão. */
export const ESTADO_VAZIO: EstadoTabela = Object.freeze({ filtros: Object.freeze({}) as Record<string, FiltroColuna>, ordem: null });

/** A chave da ordem no endereço; por isso nenhuma coluna pode se chamar assim. */
export const CHAVE_ORDEM = "o";
const ID_VALIDO = /^[a-z0-9-]+$/;
/** Teto do texto e das categorias lidos do endereço: endereço gigante não vira trabalho gigante. */
const MAX_TEXTO = 200;
const MAX_CATEGORIAS = 50;

/** Id de tabela ou de coluna que cabe no endereço sem ambiguidade. */
export function idValido(id: string): boolean {
  return ID_VALIDO.test(id) && id !== CHAVE_ORDEM;
}

const prefixo = (tabela: string) => `t.${tabela}.`;

const COMPARA_TEXTO = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** O texto como se compara: sem acento, sem caixa e com os espaços em um só. "  São  JOÃO " vira "sao joao". */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const EXPOENTE_DO_SUFIXO: Readonly<Record<string, number>> = {
  mil: 3,
  mi: 6,
  milhao: 6,
  milhoes: 6,
  bi: 9,
  bilhao: 9,
  bilhoes: 9,
  tri: 12,
};

/**
 * O número como se digita no Brasil, ou null se não der para ler:
 *   · vírgula decimal e ponto de milhar: "1.234,5" → 1234.5; "1234,5" → 1234.5; ",5" → 0.5;
 *   · sem vírgula, o ponto em grupos de três é milhar ("1.234" → 1234, "1.234.567" → 1234567); fora disso, é o ponto
 *     decimal ("1.5" → 1.5, "1234.56" → 1234.56);
 *   · o "R$" na frente e os sufixos da tela ("350 mil", "1,2 mi", "2 bi", "1 tri") valem, como o `moedaCurta` escreve;
 *   · sinal de menos na frente; espaços em qualquer lugar.
 * A conta vai pela notação científica em texto ("1.2e6"), e não por multiplicação, para "1,1 mi" dar 1100000 exato.
 */
export function lerNumeroBr(texto: string): number | null {
  let s = normalizarTexto(texto).replace(/−/g, "-").replace(/\s+/g, "");
  let negativo = false;
  if (s.startsWith("-")) {
    negativo = true;
    s = s.slice(1);
  }
  s = s.replace(/^r\$/, "");
  if (!negativo && s.startsWith("-")) {
    negativo = true;
    s = s.slice(1);
  }
  const m = /^([\d.,]+)([a-z]*)$/.exec(s);
  if (!m) return null;
  const [, corpo, sufixo] = m;
  let expoente = 0;
  if (sufixo) {
    const e = EXPOENTE_DO_SUFIXO[sufixo];
    if (e === undefined) return null;
    expoente = e;
  }
  let inteiro: string;
  let decimal = "";
  if (corpo.includes(",")) {
    const partes = corpo.split(",");
    if (partes.length !== 2) return null;
    [inteiro, decimal] = partes;
    if (!/^\d*$/.test(decimal)) return null;
    if (inteiro.includes(".")) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(inteiro)) return null;
      inteiro = inteiro.replace(/\./g, "");
    }
    if (!/^\d*$/.test(inteiro) || (inteiro === "" && decimal === "")) return null;
  } else if (corpo.includes(".")) {
    if (/^\d{1,3}(\.\d{3})+$/.test(corpo)) inteiro = corpo.replace(/\./g, "");
    else if (/^\d+\.\d+$/.test(corpo)) [inteiro, decimal] = corpo.split(".");
    else return null;
  } else {
    inteiro = corpo;
  }
  const v = Number(`${negativo ? "-" : ""}${inteiro || "0"}.${decimal || "0"}e${expoente}`);
  return Number.isFinite(v) ? (Object.is(v, -0) ? 0 : v) : null;
}

/** O número na forma da tela: "1.234,5". Até seis casas, para o que se digitou voltar igual ao campo. */
export function formatarNumeroBr(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

/** O número escrito no endereço: ponto decimal, sem milhar ("1234.5"). Lê também a forma brasileira com vírgula ou sufixo. */
function lerNumeroDoEndereco(s: string): number | null {
  const t = s.trim();
  let v: number | null = null;
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(t)) v = Number(t);
  else if (/[,a-z]/i.test(t)) v = lerNumeroBr(t);
  return v !== null && Number.isFinite(v) ? v : null;
}

/** Data AAAA-MM-DD que existe no calendário (sem `Date`, que mudaria com o fuso). */
export function dataValida(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  return dia <= dias;
}

/** A data da célula: os 10 primeiros caracteres, se forem uma data (aceita também um instante ISO inteiro). */
function dataDoValor(v: ValorCelula | undefined): string | null {
  if (typeof v !== "string") return null;
  const d = v.slice(0, 10);
  return dataValida(d) ? d : null;
}

/** "2024-03-07" → "07/03/2024". */
export function formatarDataBr(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** Separa os valores de categoria do endereço: vírgula separa, `\,` e `\\` são a vírgula e a barra dentro do valor. */
export function separarCategorias(s: string): string[] {
  const saida: string[] = [];
  let atual = "";
  let escapando = false;
  for (const ch of s) {
    if (escapando) {
      atual += ch;
      escapando = false;
    } else if (ch === "\\") escapando = true;
    else if (ch === ",") {
      saida.push(atual);
      atual = "";
    } else atual += ch;
  }
  if (escapando) atual += "\\"; // barra solta no fim fica como está
  saida.push(atual);
  return saida.map((v) => v.trim()).filter((v) => v !== "");
}

/** O inverso de `separarCategorias`. */
export function juntarCategorias(valores: readonly string[]): string {
  return valores.map((v) => v.replace(/\\/g, "\\\\").replace(/,/g, "\\,")).join(",");
}

/** O filtro faz alguma coisa? Texto em branco, intervalo sem nenhum lado e categoria sem escolha não fazem. */
export function filtroAtivo(f: FiltroColuna): boolean {
  switch (f.tipo) {
    case "texto":
      return normalizarTexto(f.contem) !== "";
    case "numero":
      return (f.de !== null && Number.isFinite(f.de)) || (f.ate !== null && Number.isFinite(f.ate));
    case "data":
      return (f.de !== null && dataValida(f.de)) || (f.ate !== null && dataValida(f.ate));
    case "categoria":
      return f.valores.some((v) => v.trim() !== "");
    default:
      return false;
  }
}

function lerIntervalo<T>(bruto: string, ler: (s: string) => T | null): { de: T | null; ate: T | null } | null {
  const s = bruto.trim();
  if (!s) return null;
  const partes = s.split("..");
  if (partes.length > 2) return null;
  if (partes.length === 1) {
    const v = ler(partes[0]);
    return v === null ? null : { de: v, ate: v };
  }
  const [a, b] = partes.map((p) => p.trim());
  const de = a ? ler(a) : null;
  const ate = b ? ler(b) : null;
  if ((a && de === null) || (b && ate === null) || (de === null && ate === null)) return null;
  return { de, ate };
}

function lerFiltro(tipo: TipoColuna, brutos: string[]): FiltroColuna | null {
  switch (tipo) {
    case "texto": {
      const contem = brutos[0].trim().slice(0, MAX_TEXTO);
      return contem ? { tipo, contem } : null;
    }
    case "numero": {
      const r = lerIntervalo(brutos[0], lerNumeroDoEndereco);
      return r ? { tipo, ...r } : null;
    }
    case "data": {
      const r = lerIntervalo(brutos[0], (s) => (dataValida(s) ? s : null));
      return r ? { tipo, ...r } : null;
    }
    case "categoria": {
      const valores = [...new Set(brutos.flatMap(separarCategorias).map((v) => v.slice(0, MAX_TEXTO)))].slice(0, MAX_CATEGORIAS);
      return valores.length > 0 ? { tipo, valores } : null;
    }
    default:
      return null;
  }
}

function lerOrdem(bruto: string | null, colunas: readonly ColunaTabela[]): Ordem | null {
  if (!bruto) return null;
  const s = bruto.trim().toLowerCase();
  const k = s.lastIndexOf(".");
  if (k <= 0) return null;
  const coluna = s.slice(0, k);
  const sentido = s.slice(k + 1);
  if (sentido !== "asc" && sentido !== "desc") return null;
  const c = colunas.find((x) => x.id === coluna);
  if (!c || c.ordenavel === false) return null;
  return { coluna, sentido };
}

/** O valor de um filtro no endereço, ou null se ele não faz nada. */
function serializarFiltro(f: FiltroColuna): string | null {
  if (!filtroAtivo(f)) return null;
  switch (f.tipo) {
    case "texto":
      return f.contem.trim().slice(0, MAX_TEXTO);
    case "numero": {
      const lado = (n: number | null) => (n !== null && Number.isFinite(n) ? String(n) : "");
      return `${lado(f.de)}..${lado(f.ate)}`;
    }
    case "data": {
      const lado = (d: string | null) => (d !== null && dataValida(d) ? d : "");
      return `${lado(f.de)}..${lado(f.ate)}`;
    }
    case "categoria":
      return juntarCategorias([...new Set(f.valores.map((v) => v.trim()).filter((v) => v !== ""))]);
    default:
      return null;
  }
}

// ================================================================ o contrato

/**
 * Lê o estado de UMA tabela dos parâmetros do endereço. Cada tabela tem um prefixo (o `id` da tabela), para várias
 * tabelas conviverem na mesma página: `?t.<tabela>.<coluna>=…` e `?t.<tabela>.o=<coluna>.<asc|desc>`. Valor que não casa
 * com a coluna (tipo errado, coluna que não existe, número ilegível) é ignorado, nunca erro.
 */
export function lerEstado(tabela: string, colunas: ColunaTabela[], parametros: URLSearchParams): EstadoTabela {
  const pre = prefixo(tabela);
  const filtros: Record<string, FiltroColuna> = {};
  for (const c of colunas) {
    if (c.filtravel === false || !idValido(c.id)) continue;
    const brutos = parametros.getAll(pre + c.id);
    if (brutos.length === 0) continue;
    const f = lerFiltro(c.tipo, brutos);
    if (f && filtroAtivo(f)) filtros[c.id] = f;
  }
  return { filtros, ordem: lerOrdem(parametros.get(pre + CHAVE_ORDEM), colunas) };
}

/** O inverso de `lerEstado`: devolve os parâmetros com o estado desta tabela trocado e os das outras tabelas intactos. */
export function gravarEstado(tabela: string, estado: EstadoTabela, parametros: URLSearchParams): URLSearchParams {
  const pre = prefixo(tabela);
  const saida = new URLSearchParams();
  // Cópia nova sempre: o `useSearchParams` do Next entrega parâmetros que não aceitam mudança.
  for (const [k, v] of parametros) if (!k.startsWith(pre)) saida.append(k, v);
  for (const [coluna, filtro] of Object.entries(estado.filtros)) {
    if (!idValido(coluna)) continue;
    const v = serializarFiltro(filtro);
    if (v !== null) saida.append(pre + coluna, v);
  }
  const o = estado.ordem;
  if (o && idValido(o.coluna) && (o.sentido === "asc" || o.sentido === "desc")) saida.append(pre + CHAVE_ORDEM, `${o.coluna}.${o.sentido}`);
  return saida;
}

/** A forma única de um estado (o pedaço do endereço que ele escreveria): dois estados iguais têm a mesma chave. */
export function chaveDoEstado(tabela: string, estado: EstadoTabela): string {
  return gravarEstado(tabela, estado, new URLSearchParams()).toString();
}

type ValorDeOrdem = number | string | null;

function valorDeOrdem(tipo: TipoColuna, v: ValorCelula | undefined): ValorDeOrdem {
  if (v === null || v === undefined) return null;
  if (tipo === "numero") return typeof v === "number" && Number.isFinite(v) ? v : null;
  if (tipo === "data") return dataDoValor(v);
  const s = String(v).trim();
  return s === "" ? null : s;
}

function compararValores(tipo: TipoColuna, a: number | string, b: number | string): number {
  if (tipo === "numero") return (a as number) - (b as number);
  if (tipo === "data") return a < b ? -1 : a > b ? 1 : 0;
  return COMPARA_TEXTO.compare(String(a), String(b));
}

function testeDoFiltro(coluna: string, f: FiltroColuna): (l: LinhaTabela) => boolean {
  switch (f.tipo) {
    case "texto": {
      // Contém todas as palavras, em qualquer ordem: "silva joao" acha "João da Silva".
      const palavras = normalizarTexto(f.contem).split(" ");
      return (l) => {
        const v = l.valores[coluna];
        if (v === null || v === undefined) return false;
        const alvo = normalizarTexto(String(v));
        return palavras.every((p) => alvo.includes(p));
      };
    }
    case "numero":
      return (l) => {
        const v = l.valores[coluna];
        if (typeof v !== "number" || !Number.isFinite(v)) return false;
        return (f.de === null || v >= f.de) && (f.ate === null || v <= f.ate);
      };
    case "data": {
      const de = f.de !== null && dataValida(f.de) ? f.de : null;
      const ate = f.ate !== null && dataValida(f.ate) ? f.ate : null;
      return (l) => {
        const v = dataDoValor(l.valores[coluna]);
        if (v === null) return false;
        return (de === null || v >= de) && (ate === null || v <= ate);
      };
    }
    case "categoria": {
      const escolhidas = new Set(f.valores.map(normalizarTexto).filter((v) => v !== ""));
      return (l) => {
        const v = l.valores[coluna];
        return v !== null && v !== undefined && escolhidas.has(normalizarTexto(String(v)));
      };
    }
    default:
      return () => true;
  }
}

/**
 * Filtra e ordena. Texto: contém, sem acento e sem caixa. Número e data: limites inclusivos. Categoria: qualquer uma das
 * escolhidas. Null nunca passa num filtro ativo e vai para o fim em qualquer sentido. Ordem estável; empate pela ordem
 * de chegada (a ordem padrão que a tela escolheu).
 *
 * Detalhes (onda 15, A, 13/10/2026): o texto exige todas as palavras digitadas, em qualquer ordem; texto vazio conta
 * como null; filtro de coluna que não existe, que não filtra ou de tipo trocado é ignorado, e a ordem por coluna que não
 * ordena também. Nunca muda a lista recebida.
 */
export function aplicar(colunas: ColunaTabela[], linhas: LinhaTabela[], estado: EstadoTabela): LinhaTabela[] {
  const porId = new Map(colunas.map((c) => [c.id, c]));
  const testes: ((l: LinhaTabela) => boolean)[] = [];
  for (const [id, f] of Object.entries(estado.filtros)) {
    const c = porId.get(id);
    if (!c || c.filtravel === false || c.tipo !== f.tipo || !filtroAtivo(f)) continue;
    testes.push(testeDoFiltro(id, f));
  }
  const filtradas = testes.length > 0 ? linhas.filter((l) => testes.every((t) => t(l))) : [...linhas];

  const o = estado.ordem;
  const c = o ? porId.get(o.coluna) : undefined;
  if (!o || !c || c.ordenavel === false || (o.sentido !== "asc" && o.sentido !== "desc")) return filtradas;
  const fator = o.sentido === "desc" ? -1 : 1;
  return filtradas
    .map((linha, i) => ({ linha, i, v: valorDeOrdem(c.tipo, linha.valores[o.coluna]) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) {
        if (a.v === null && b.v === null) return a.i - b.i;
        return a.v === null ? 1 : -1; // o vazio vai para o fim nos dois sentidos
      }
      return fator * compararValores(c.tipo, a.v, b.v) || a.i - b.i;
    })
    .map((x) => x.linha);
}

/** As opções de uma coluna de categoria, a partir das linhas (sem repetição, em ordem alfabética). */
export function opcoesDaCategoria(coluna: string, linhas: LinhaTabela[]): string[] {
  const vistas = new Set<string>();
  for (const l of linhas) {
    const v = l.valores[coluna];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) vistas.add(s);
  }
  return [...vistas].sort(COMPARA_TEXTO.compare);
}

/** O CSV das linhas filtradas, pelas regras de `paraCsv` (BOM, ponto e vírgula, vírgula decimal, proteção de fórmula). */
export function csvDaTabela(colunas: ColunaTabela[], linhas: LinhaTabela[]): string {
  const doCsv: ColunaCsv<LinhaTabela>[] = colunas
    .filter((c) => !c.semCsv)
    .map((c) => ({
      titulo: c.titulo,
      valor: (l: LinhaTabela) => {
        const v = l.valores[c.id];
        if (v === undefined) return null;
        // Identificador que chegou como número (código 1277) também sai como texto intacto.
        return c.textoNoCsv && typeof v === "number" ? String(v) : v;
      },
      texto: c.textoNoCsv,
    }));
  return paraCsv(doCsv, linhas);
}

/** Quantos filtros estão ativos (para o botão "Filtrar e ordenar (N)"). */
export function filtrosAtivos(estado: EstadoTabela): number {
  return Object.values(estado.filtros).filter(filtroAtivo).length;
}

// ================================================================ o que o componente diz (onda 15, A, 13/10/2026)

/** O próximo passo do clique no título da coluna: crescente → decrescente → padrão. `atual` é a ordem do endereço. */
export function proximaOrdem(atual: Ordem | null, coluna: string, padrao: Ordem | null = null): Ordem | null {
  let proxima: Ordem | null;
  if (atual && atual.coluna === coluna) proxima = atual.sentido === "asc" ? { coluna, sentido: "desc" } : null;
  // Sem ordem no endereço, a tela já mostra o padrão: se ele é esta coluna crescente, o clique vai ao decrescente.
  else if (!atual && padrao && padrao.coluna === coluna && padrao.sentido === "asc") proxima = { coluna, sentido: "desc" };
  else proxima = { coluna, sentido: "asc" };
  // A ordem igual à padrão não vai ao endereço.
  if (proxima && padrao && proxima.coluna === padrao.coluna && proxima.sentido === padrao.sentido) return null;
  return proxima;
}

/** "do maior para o menor", "de A a Z"... conforme o tipo da coluna. */
export function rotuloSentido(tipo: TipoColuna, sentido: Sentido): string {
  if (tipo === "numero") return sentido === "asc" ? "do menor para o maior" : "do maior para o menor";
  if (tipo === "data") return sentido === "asc" ? "da mais antiga para a mais recente" : "da mais recente para a mais antiga";
  return sentido === "asc" ? "de A a Z" : "de Z a A";
}

/** "Convênio válido, do maior para o menor". */
export function descreverOrdem(coluna: Pick<ColunaTabela, "titulo" | "tipo">, sentido: Sentido): string {
  return `${coluna.titulo}, ${rotuloSentido(coluna.tipo, sentido)}`;
}

/** O filtro em palavras, para a lista dos filtros ativos: "Autor contém “silva”", "Tipo: Bancada ou Comissão". */
export function descreverFiltro(coluna: Pick<ColunaTabela, "titulo">, f: FiltroColuna): string {
  const intervalo = (de: string | null, ate: string | null) => {
    if (de !== null && ate !== null) return de === ate ? `igual a ${de}` : `de ${de} a ${ate}`;
    if (de !== null) return `a partir de ${de}`;
    return `até ${ate}`;
  };
  switch (f.tipo) {
    case "texto":
      return `${coluna.titulo} contém “${f.contem.trim()}”`;
    case "numero":
      return `${coluna.titulo} ${intervalo(f.de === null ? null : formatarNumeroBr(f.de), f.ate === null ? null : formatarNumeroBr(f.ate))}`;
    case "data":
      return `${coluna.titulo} ${intervalo(f.de === null ? null : formatarDataBr(f.de), f.ate === null ? null : formatarDataBr(f.ate))}`;
    case "categoria":
      return `${coluna.titulo}: ${f.valores.join(" ou ")}`;
    default:
      return coluna.titulo;
  }
}

/** O texto da célula quando a tela não manda a célula desenhada: número em pt-BR, data DD/MM/AAAA e "—" no vazio. */
export function textoDoValor(coluna: Pick<ColunaTabela, "tipo">, v: ValorCelula | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return coluna.tipo === "numero" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : String(v);
  if (coluna.tipo === "data") {
    const d = dataDoValor(v);
    if (d) return formatarDataBr(d);
  }
  return v;
}

/** O nome do arquivo do CSV, sempre com a extensão `.csv` e sem caractere que o sistema de arquivos recuse. */
export function nomeDoCsv(nome: string): string {
  const limpo = [...nome.trim()].map((ch) => (ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? "-" : ch)).join("");
  const base = limpo.replace(/-{2,}/g, "-").replace(/\.csv$/i, "") || "tabela";
  return `${base}.csv`;
}
