/**
 * A página do Brasil e os mapas 2D (U2, desenho aprovado em 08/10/2026): o topo da descida Brasil › UF › município ›
 * entidade. As 27 UFs lado a lado, em ordem alfabética (decisão do titular: sem destaque de melhor ou pior), com o
 * que a base guarda para o país inteiro — instrumentos vivos, propostas, Pix e janelas abertas. Os mapas são SVG
 * 2D pela malha do IBGE, com cor só por região (macrorregião no Brasil, região intermediária na Paraíba), nunca por
 * problema. Aqui fica o que é puro. Sem banco.
 */
import type { NivelAcesso } from "./pagina-municipio.ts";
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

export type AbaBrasil = "resumo" | "estados" | "dinheiro" | "tempos";

export const ABAS_BRASIL: readonly { id: AbaBrasil; nome: string; minimo: NivelAcesso }[] = [
  { id: "resumo", nome: "Resumo", minimo: 0 },
  { id: "estados", nome: "As 27 UFs", minimo: 0 },
  { id: "dinheiro", nome: "Dinheiro", minimo: 0 },
  { id: "tempos", nome: "Tempos e funil", minimo: 1 },
];

export function abaDoBrasil(pedida: string | string[] | undefined, nivel: NivelAcesso): AbaBrasil {
  const p = Array.isArray(pedida) ? pedida[0] : pedida;
  const aba = ABAS_BRASIL.find((a) => a.id === p);
  return aba && nivel >= aba.minimo ? aba.id : "resumo";
}

export function urlBrasil(aba?: AbaBrasil): string {
  return `/mapa/brasil${aba && aba !== "resumo" ? `?aba=${aba}` : ""}`;
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
