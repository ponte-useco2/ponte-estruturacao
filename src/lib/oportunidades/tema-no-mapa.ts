/**
 * O filtro por tema no mapa (onda 17, 28/10/2026): no Brasil e na Paraíba, quem tem cadastro escolhe um tema do
 * programa e o mapa acende as áreas (UF ou município) com instrumento vivo nele; as outras se apagam. A cor continua a
 * da região (decisão do titular: nunca cor de problema), e o tema não vira escala de mais ou menos: a área está no tema
 * ou não está, e o número fica na prévia. A escolha vai para o endereço (`?tema=saude`). Puro, com teste
 * (`tema-no-mapa.test.ts`); o desenho mora em `app/mapa/_movimento/MapaVivo.tsx`.
 *
 * Fontes: as UFs vêm de `painel_territorio` (dimensão tema, só os vivos, por UF); os municípios da PB, dos instrumentos
 * vivos de `painel_instrumento` com o tema do programa. Um instrumento pode ter mais de um tema e conta em cada um.
 */
import { moedaCurta } from "./radar.ts";
import { ROTULO_TEMA } from "./temas.ts";

export const PARAMETRO_TEMA = "tema";

/** Instrumentos vivos e valor global de uma área num tema. */
export type SomaDoTema = readonly [n: number, valor: number];

/** Por área (sigla da UF ou IBGE do município), por tema. Vai do servidor ao mapa: compacto de propósito. */
export type TemasPorArea = Record<string, Record<string, SomaDoTema>>;

export interface OpcaoDeTema {
  id: string;
  rotulo: string;
  /** Em quantas áreas do mapa o tema tem instrumento vivo. */
  areas: number;
}

export const rotuloDoTema = (id: string): string => ROTULO_TEMA[id] ?? id.replace(/_/g, " ");

/** As UFs por tema, das linhas de `painel_territorio` (o Brasil, recorte "BR", fica de fora: não é área do mapa). */
export function temasDasUfs(linhas: readonly { recorte: string; dimensao: string; chave: string; n: number; valor: number }[]): TemasPorArea {
  const saida: TemasPorArea = {};
  for (const l of linhas) {
    if (l.dimensao !== "tema" || l.recorte === "BR" || l.n <= 0) continue;
    (saida[l.recorte] ??= {})[l.chave] = [l.n, Number(l.valor)];
  }
  return saida;
}

/** Os municípios por tema, somados dos instrumentos vivos (cada tema do instrumento conta uma vez). */
export function temasDosMunicipios(instrumentos: readonly { cod_ibge: string | null; temas: readonly string[] | null; vl_global: number | string | null }[]): TemasPorArea {
  const saida: TemasPorArea = {};
  for (const i of instrumentos) {
    if (!i.cod_ibge || !i.temas?.length) continue;
    const area = (saida[i.cod_ibge] ??= {});
    const valor = Number(i.vl_global ?? 0) || 0;
    for (const t of new Set(i.temas)) {
      const [n, v] = area[t] ?? [0, 0];
      area[t] = [n + 1, v + valor];
    }
  }
  return saida;
}

/**
 * Os temas que o mapa oferece: os que têm ao menos uma área, do que alcança mais áreas para o que alcança menos (e pelo
 * rótulo no empate). É a ordem de "onde há", não de "quanto": nenhum tema é classificado pelo dinheiro.
 */
export function opcoesDeTema(porArea: TemasPorArea): OpcaoDeTema[] {
  const contagem = new Map<string, number>();
  for (const temas of Object.values(porArea)) for (const [t, [n]] of Object.entries(temas)) if (n > 0) contagem.set(t, (contagem.get(t) ?? 0) + 1);
  return [...contagem]
    .map(([id, areas]) => ({ id, rotulo: rotuloDoTema(id), areas }))
    .sort((a, b) => b.areas - a.areas || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** O tema pedido no endereço, se o mapa o oferece; senão nenhum (o mapa inteiro). */
export function lerTema(valor: string | null | undefined, opcoes: readonly OpcaoDeTema[]): string | null {
  const v = (valor ?? "").trim();
  return opcoes.some((o) => o.id === v) ? v : null;
}

/** A soma da área no tema, ou null quando ela não tem instrumento vivo nele. */
export function somaNoTema(porArea: TemasPorArea, area: string, tema: string): SomaDoTema | null {
  const s = porArea[area]?.[tema];
  return s && s[0] > 0 ? s : null;
}

/** A linha da prévia com o tema escolhido: "Saúde: 3 instrumentos vivos · R$ 2,1 mi" ou "Saúde: nenhum instrumento vivo". */
export function linhaDoTema(rotulo: string, soma: SomaDoTema | null): string {
  if (!soma) return `${rotulo}: nenhum instrumento vivo`;
  const [n, valor] = soma;
  const quantos = `${n.toLocaleString("pt-BR")} ${n === 1 ? "instrumento vivo" : "instrumentos vivos"}`;
  return valor > 0 ? `${rotulo}: ${quantos} · ${moedaCurta(valor)}` : `${rotulo}: ${quantos}`;
}

/** A frase do mapa filtrado: "Saúde: 140 de 223 municípios com instrumento vivo no tema." */
export function resumoDoTema(rotulo: string, comTema: number, total: number, unidade: { um: string; varios: string }): string {
  return `${rotulo}: ${comTema.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${total === 1 ? unidade.um : unidade.varios} com instrumento vivo no tema.`;
}

/**
 * O link da área com o tema que desce (onda 18, 28/10/2026): só para as áreas cujo destino tem o mapa por tema (no
 * Brasil, as UFs completas), e já na aba desse mapa; na aba Resumo da UF não há mapa, e o tema chegava sem efeito.
 */
export function hrefComTema(href: string, area: string, tema: string | null, desce: { aba: string; areas: readonly string[] } | undefined): string {
  if (!tema || !desce || !desce.areas.includes(area)) return href;
  const [semAncora, ancora = ""] = href.split("#", 2);
  const [caminho, busca = ""] = semAncora.split("?", 2);
  const p = new URLSearchParams(busca);
  p.set("aba", desce.aba);
  p.set(PARAMETRO_TEMA, tema);
  return `${caminho}?${p.toString()}${ancora ? `#${ancora}` : ""}`;
}

/** O endereço de agora com o tema (ou sem o parâmetro, no mapa inteiro), preservando o resto. */
export function enderecoComTema(atual: string, tema: string | null): string {
  const [semAncora, ancora = ""] = atual.split("#", 2);
  const [caminho, busca = ""] = semAncora.split("?", 2);
  const p = new URLSearchParams(busca);
  if (tema) p.set(PARAMETRO_TEMA, tema);
  else p.delete(PARAMETRO_TEMA);
  const q = p.toString();
  return `${caminho}${q ? `?${q}` : ""}${ancora ? `#${ancora}` : ""}`;
}
