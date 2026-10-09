/**
 * A página do Brasil e os mapas 2D (U2, desenho aprovado em 08/10/2026): o topo da descida Brasil › UF › município ›
 * entidade. As 27 UFs lado a lado, em ordem alfabética (decisão do titular: sem destaque de melhor ou pior), com o
 * que a base guarda para o país inteiro — instrumentos vivos, propostas, Pix e janelas abertas. Os mapas são SVG
 * 2D pela malha do IBGE, com cor só por região (macrorregião no Brasil, região intermediária na Paraíba), nunca por
 * problema. Aqui fica o que é puro. Sem banco.
 */
import { diaBrasilia } from "./datas.ts";
import { NOME_ABA, nivelSemCliente, type NivelAcesso } from "./pagina-municipio.ts";
import { NOME_UF, totalTerritorio, porSituacao, type LinhaTerritorio } from "./pagina-uf.ts";
import type { ColunaCsv, LinhaDesfecho } from "./painel.ts";
import type { LinhaEspecialAno } from "./pix.ts";

// ================================================================ regiões

export type Macrorregiao = "N" | "NE" | "CO" | "SE" | "S";

export const MACRORREGIAO: Record<string, Macrorregiao> = {
  AC: "N", AM: "N", AP: "N", PA: "N", RO: "N", RR: "N", TO: "N",
  AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
  DF: "CO", GO: "CO", MS: "CO", MT: "CO",
  ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
  PR: "S", RS: "S", SC: "S",
};

export const ROTULO_MACRORREGIAO: Record<Macrorregiao, string> = { N: "Norte", NE: "Nordeste", CO: "Centro-Oeste", SE: "Sudeste", S: "Sul" };
export const ORDEM_MACRORREGIAO: Macrorregiao[] = ["N", "NE", "CO", "SE", "S"];

// ================================================================ mapas

/** Uma malha gerada por `scripts/malhas_ibge.py` (no monorepo, fora do espelho): o viewBox e um caminho SVG por área (UF ou município). */
export interface Malha {
  viewBox: string;
  fonte: string;
  areas: { id: string; d: string; x: number; y: number }[];
}

export interface AreaMapa {
  nome: string;
  href: string | null;
  /** O índice da cor (0 a 4): a região, nunca um problema. */
  grupo: number;
}

/** Os grupos de cor de uma lista de regiões, na ordem dada; o que não estiver na lista fica no grupo 0. */
export function gruposDeCor(regioes: string[]): Map<string, number> {
  return new Map(regioes.map((r, i) => [r, i % 5]));
}

// ================================================================ abas

export type AbaBrasil = "resumo" | "estados" | "dinheiro" | "tempos" | "relatorio";

/**
 * Os nomes comuns aos 4 níveis vêm de `NOME_ABA` (B11, 08/10/2026): "Dinheiro" virou "Dinheiro federal", e o Brasil
 * ganhou "Relatório e dados", a última aba nos outros três níveis — com o mesmo papel da UF (a página numa peça só para
 * imprimir e o CSV das 27 UFs, que antes só morava na aba das UFs).
 */
export const ABAS_BRASIL: readonly { id: AbaBrasil; nome: string; minimo: NivelAcesso }[] = [
  { id: "resumo", nome: NOME_ABA.resumo, minimo: 0 },
  { id: "estados", nome: "As 27 UFs", minimo: 0 },
  { id: "dinheiro", nome: NOME_ABA.dinheiro, minimo: 0 },
  { id: "tempos", nome: "Tempos e funil", minimo: 1 },
  { id: "relatorio", nome: NOME_ABA.relatorio, minimo: 1 },
];

export function abaDoBrasil(pedida: string | string[] | undefined, nivel: NivelAcesso): AbaBrasil {
  const p = Array.isArray(pedida) ? pedida[0] : pedida;
  const aba = ABAS_BRASIL.find((a) => a.id === p);
  return aba && nivel >= aba.minimo ? aba.id : "resumo";
}

export function urlBrasil(aba?: AbaBrasil): string {
  return `/mapa/brasil${aba && aba !== "resumo" ? `?aba=${aba}` : ""}`;
}

/**
 * O nível no Brasil: administrador 3, todo aprovado 1. Uma regra só para a página e para a rota do relatório (C1b,
 * 08/10/2026), para as duas nunca divergirem.
 *
 * C4a (09/10/2026; achado B1 da revisão R3): recebe também se o cadastro está aprovado. Antes era só
 * `administrador ? 3 : 1`, certo apenas enquanto o portão de aprovados vinha antes; quem não é aprovado agora é 0, e
 * "Tempos e funil", o relatório e o CSV continuam pedindo 1. A regra é a de `nivelSemCliente` (no Brasil não há cliente).
 */
export function nivelNoBrasil(v: { aprovado: boolean; administrador: boolean }): NivelAcesso {
  return nivelSemCliente(v);
}

/** Se o nível abre a aba. A rota do relatório usa o mínimo de "Relatório e dados" (C1b): quem vê a aba abre a peça. */
export function podeAbaBrasil(aba: AbaBrasil, nivel: NivelAcesso): boolean {
  const a = ABAS_BRASIL.find((x) => x.id === aba);
  return a !== undefined && nivel >= a.minimo;
}

// ================================================================ as 27 UFs

export interface LinhaUfBrasil {
  sigla: string;
  nome: string;
  regiao: Macrorregiao;
  vivos: number;
  emExecucao: number;
  prestandoContas: number;
  valorVivos: number;
  municipiosVivos: number;
  propostasAno: number | null;
  assinadasAno: number | null;
  pixPagoAno: number | null;
  janelas: number | null;
}

/**
 * As 27 UFs em ordem alfabética do nome, só com o que é comparável entre elas: os instrumentos vivos (fora da PB a
 * base não guarda os outros), as propostas e o Pix do ano e as janelas abertas.
 */
export function ufsLadoALado(
  territorio: LinhaTerritorio[],
  desfechos: LinhaDesfecho[],
  pix: LinhaEspecialAno[],
  janelas: Map<string, number> | null,
  ano: number,
): LinhaUfBrasil[] {
  return Object.keys(NOME_UF)
    .map((sigla) => {
      const vivos = totalTerritorio(territorio, sigla, "vivos");
      const grupos = porSituacao(territorio, sigla, true);
      const g = (id: string) => grupos.find((x) => x.id === id);
      const f = desfechos.find((d) => d.uf === sigla && d.ano_envio === ano && d.cod_programa === null && d.orgao_sup === null);
      const p = pix.find((x) => x.recorte === sigla && x.ano === ano);
      return {
        sigla,
        nome: NOME_UF[sigla],
        regiao: MACRORREGIAO[sigla],
        vivos: vivos?.n ?? 0,
        emExecucao: g("execucao")?.n ?? 0,
        prestandoContas: g("contas")?.n ?? 0,
        valorVivos: vivos?.valor ?? 0,
        municipiosVivos: vivos?.municipios ?? 0,
        propostasAno: f ? f.enviadas : null,
        assinadasAno: f ? f.assinadas : null,
        pixPagoAno: p ? Number(p.pago) : null,
        janelas: janelas ? (janelas.get(sigla) ?? 0) : null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** As janelas abertas por UF, contadas das linhas de `radar_programa_aberto`. */
export function janelasPorUf(linhas: { uf: string | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of linhas) if (l.uf) m.set(l.uf, (m.get(l.uf) ?? 0) + 1);
  return m;
}

export const COLUNAS_CSV_UFS: ColunaCsv<LinhaUfBrasil>[] = [
  { titulo: "UF", valor: (u) => u.sigla },
  { titulo: "Estado", valor: (u) => u.nome },
  { titulo: "Região", valor: (u) => ROTULO_MACRORREGIAO[u.regiao] },
  { titulo: "Instrumentos vivos", valor: (u) => u.vivos },
  { titulo: "Em execução", valor: (u) => u.emExecucao },
  { titulo: "Prestando contas", valor: (u) => u.prestandoContas },
  { titulo: "Valor dos vivos (R$)", valor: (u) => u.valorVivos },
  { titulo: "Municípios com instrumento vivo", valor: (u) => u.municipiosVivos },
  { titulo: "Propostas no ano", valor: (u) => u.propostasAno },
  { titulo: "Assinadas no ano", valor: (u) => u.assinadasAno },
  { titulo: "Pix pago no ano (R$)", valor: (u) => u.pixPagoAno },
  { titulo: "Janelas abertas", valor: (u) => u.janelas },
];

// ================================================================ o relatório para imprimir

/**
 * O relatório do Brasil numa peça só (C1b, 08/10/2026), no modelo do município: uma rota própria para imprimir, e a
 * aba "Relatório e dados" fica curta (o link, o CSV e as fontes). Antes a aba repetia a página inteira (B0, 4.4).
 */
export const URL_RELATORIO_BRASIL = "/mapa/brasil/relatorio";
export const URL_CSV_BRASIL = "/mapa/brasil/csv";

/**
 * As partes do relatório, na ordem das abas da página: as que o nível abre, menos a própria "Relatório e dados". Assim
 * o relatório nunca mostra o que a página esconde do mesmo nível.
 */
export function partesDoRelatorioBrasil(nivel: NivelAcesso): AbaBrasil[] {
  return ABAS_BRASIL.filter((a) => a.id !== "relatorio" && nivel >= a.minimo).map((a) => a.id);
}

/**
 * O ano das contas "do ano" (propostas e Pix): o da referência do painel, senão o do dado, senão o de `hoje`. Antes a
 * conta se repetia na página e no CSV, cada uma com uma saída diferente para a data que falta. O `dado_ate` é carimbo
 * com hora: entra pelo dia de Brasília (A4x), senão o arquivo da noite de 31/12 contaria como o ano seguinte.
 */
export function anoDeReferencia(execucao: { referencia: string | null; dado_ate: string | null }, hoje = ""): number {
  return Number((execucao.referencia ?? (execucao.dado_ate ? diaBrasilia(execucao.dado_ate) : hoje)).slice(0, 4));
}

/** Uma fonte do relatório, com a data do dado quando a leitura traz (o mesmo formato do relatório do município). */
export interface FonteRelatorio {
  fonte: string;
  data: string | null;
  nota: string;
}

/**
 * As fontes do Brasil, cada uma com a sua data: o arquivo do Transferegov, o do Pix e o das janelas. As datas são os
 * `dado_ate` das execuções (carimbos com hora) e saem como o dia de Brasília (A4x, 08/10/2026): o arquivo de 07/10,
 * 22h34, saía como 08/10.
 */
export function fontesDoBrasil(datas: { painel: string | null; pix: string | null; janelas: string | null }): FonteRelatorio[] {
  const dia = (x: string | null) => (x ? diaBrasilia(x) : null);
  return [
    {
      fonte: "Transferegov (arquivos abertos do SICONV)",
      data: dia(datas.painel),
      nota: "Instrumentos vivos por UF, situação, órgão e tema; propostas por ano de envio e o que aconteceu com elas; tempo das etapas.",
    },
    {
      fonte: "API das transferências especiais (Pix) e do fundo a fundo",
      data: dia(datas.pix),
      nota: "Planos de ação do Pix por ano da emenda e do fundo a fundo por ano.",
    },
    {
      fonte: "Programas do Transferegov (catálogo do Mapa)",
      data: dia(datas.janelas),
      nota: "Janelas abertas por UF; o mesmo programa aberto em mais de uma UF conta em cada uma.",
    },
    { fonte: "IBGE (API de malhas v3)", data: null, nota: "O contorno das UFs no mapa; a cor é só a da macrorregião." },
  ];
}

/** Como se conta (o "método" do relatório), em texto neutro: sem classificação de UF e sem siglas soltas. */
export function metodoDoBrasil(ano: number): string[] {
  return [
    "Instrumento vivo é o que está em execução, em prestação de contas ou em tomada de contas especial. Fora da Paraíba a base guarda só os vivos; por isso as UFs são comparadas só por eles.",
    "As 27 UFs vêm em ordem alfabética, sem classificação de melhor ou pior.",
    `Propostas e Pix «do ano» são os de ${ano}, até a data do dado.`,
    "Tempo das etapas: a mediana e o «9 em cada 10 até», em dias, das etapas de todos os órgãos que terminaram nos últimos 36 meses.",
    "Funil: as propostas por ano de envio e o que aconteceu com elas até a data do dado.",
    "Valores nominais, como estão nas fontes, sem correção pela inflação.",
  ];
}
