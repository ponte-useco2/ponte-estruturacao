/**
 * Execução do convênio pela Portaria Conjunta MGI/MF/CGU 33/2023 (onda 13B).
 *
 * O job do painel (`painel_execucao/portaria33.py`) grava, nos convênios da PB, o regime (PC 33, regime
 * simplificado, anterior ou fora do alcance), o nível do art. 7º e os itens conferíveis nos dados abertos,
 * na redação da época da celebração. Aqui: rótulos, o resumo para os riscos do laudo e a separação entre o
 * que pede atenção e o resto. Função pura, sem banco e sem relógio.
 */
import { ROTULO_NIVEL, pontosAConferir, type ItemLaudo, type NivelItem } from "./itens-laudo.ts";
import type { Risco } from "./laudo.ts";

export type RegimePc33 = "pc33" | "simplificado" | "anterior" | "fora";

/** As colunas que a oport_24 acrescenta a `painel_instrumento` (vazias fora da PB e antes dela). */
export interface ColunasPc33 {
  pc33_regime?: RegimePc33 | null;
  pc33_nivel?: string | null;
  pc33_pior?: NivelItem | null;
  pc33_itens?: ItemLaudo[] | null;
}

export const ROTULO_REGIME: Record<RegimePc33, string> = {
  pc33: "Portaria Conjunta 33/2023",
  simplificado: "Regime simplificado (Lei 14.133, art. 184-A)",
  anterior: "Anterior à PC 33 (norma da época)",
  fora: "Fora do alcance da PC 33",
};

export interface SecaoPc33 {
  regime: RegimePc33;
  rotulo: string;
  /** O item P0 (regime e nível), que abre a seção. */
  abertura: ItemLaudo | null;
  conferir: ItemLaudo[];
  demais: ItemLaudo[];
}

/** A seção do laudo, ou `null` quando o convênio não tem os itens (fora da PB, ou antes da oport_24). */
export function secaoPc33(i: ColunasPc33): SecaoPc33 | null {
  if (!i.pc33_regime || !i.pc33_itens?.length) return null;
  const abertura = i.pc33_itens.find((x) => x.item === "P0") ?? null;
  const conferir = pontosAConferir(i.pc33_itens);
  const vistos = new Set(conferir.map((x) => x.item));
  return {
    regime: i.pc33_regime,
    rotulo: ROTULO_REGIME[i.pc33_regime] + (i.pc33_nivel ? `, Nível ${i.pc33_nivel}` : ""),
    abertura,
    conferir,
    demais: i.pc33_itens.filter((x) => x.item !== "P0" && !vistos.has(x.item)),
  };
}

/** O resumo dos itens sem ponto a conferir, no singular ou no plural ("os outros", quando há ponto acima). */
export function rotuloDemaisPc33(n: number, haConferir: boolean): string {
  if (n === 1) return haConferir ? "O outro item conferido" : "O item conferido";
  return haConferir ? `Os outros ${n} itens conferidos` : `Os ${n} itens conferidos`;
}

const NORMA_DO_RISCO: Record<RegimePc33, string> = {
  pc33: "pela Portaria 33",
  simplificado: "pelo regime simplificado",
  anterior: "pela norma da época",
  fora: "pela Portaria 33",
};

/**
 * Itens que o laudo já tem como risco próprio (diagnostico.ts), para o quadro não dizer o mesmo duas vezes:
 * P3 é o "sem movimento financeiro há mais de um ano". Na seção da PC 33 eles continuam, com o dispositivo.
 */
const JA_NOS_RISCOS = new Set(["P3"]);

/** Um risco para o quadro do laudo, quando há ponto a conferir: o nível do mais grave, e os títulos. */
export function riscoPc33(i: ColunasPc33): Risco | null {
  const s = secaoPc33(i);
  const conferir = (s?.conferir ?? []).filter((x) => !JA_NOS_RISCOS.has(x.item));
  if (!s || !conferir.length) return null;
  const pior = conferir[0].nivel as NivelItem;
  const n = conferir.length;
  return {
    nivel: pior,
    titulo: `Execução ${NORMA_DO_RISCO[s.regime]}: ${n} ${n === 1 ? "ponto" : "pontos"} a conferir`,
    // um ponto: o fato dele; vários: os títulos, que dizem a regra e não o resultado ("a conferir" na frente)
    fato: n === 1
      ? `${conferir[0].fato} O detalhe está na seção de execução.`
      : `A conferir: ${conferir.map((x) => `${x.titulo} (${ROTULO_NIVEL[x.nivel as NivelItem]})`).join("; ")}. O detalhe está na seção de execução.`,
  };
}
