/**
 * Emendas federais e estaduais lado a lado, por ano da emenda (emendas estaduais, E3, 16/10/2026): para a prefeitura e
 * os fundos de um município, ou para uma entidade (CNPJ). Lógica pura, com teste.
 *
 * São dinheiros diferentes, com fontes, regras e definições diferentes: NUNCA se somam. A federal é a dos canais com
 * destino (convênio, Pix, saúde fundo a fundo e pago ao favorecido; `emd_canal`), com o válido e o pago; a estadual é a
 * da Assembleia da PB pelo empenho (`epb_destino`), com o empenhado e o pago. Só os anos com emenda estadual possível
 * (2021 em diante, o primeiro ano da API da PB) entram, para a comparação ser do mesmo período.
 */

export interface FederalAno {
  ano: number;
  valido: number;
  pago: number;
}

export interface EstadualAno {
  ano: number;
  empenhado: number;
  pago: number;
}

export type LeituraFederalPorAno = { estado: "ok"; anos: FederalAno[] } | { estado: "sem_dado" } | { estado: "falha" };

export interface LinhaLadoALado {
  ano: number;
  federalValido: number;
  federalPago: number;
  estadualEmpenhado: number;
  estadualPago: number;
}

export const PRIMEIRO_ANO_ESTADUAL = 2021;

/** Os anos de 2021 em diante com alguma emenda (federal ou estadual), do mais novo ao mais velho. */
export function ladoALado(federal: readonly FederalAno[], estadual: readonly EstadualAno[]): LinhaLadoALado[] {
  const anos = new Map<number, LinhaLadoALado>();
  const linha = (ano: number) => {
    const l = anos.get(ano) ?? { ano, federalValido: 0, federalPago: 0, estadualEmpenhado: 0, estadualPago: 0 };
    anos.set(ano, l);
    return l;
  };
  for (const f of federal) {
    if (f.ano < PRIMEIRO_ANO_ESTADUAL) continue;
    const l = linha(f.ano);
    l.federalValido += f.valido || 0;
    l.federalPago += f.pago || 0;
  }
  for (const e of estadual) {
    if (e.ano < PRIMEIRO_ANO_ESTADUAL) continue;
    const l = linha(e.ano);
    l.estadualEmpenhado += e.empenhado || 0;
    l.estadualPago += e.pago || 0;
  }
  return [...anos.values()]
    .filter((l) => l.federalValido || l.federalPago || l.estadualEmpenhado || l.estadualPago)
    .sort((a, b) => b.ano - a.ano);
}

/** As linhas de `emd_canal` (já sem o que outro canal cobre) somadas por ano: o válido e o pago só do que é válido. */
export function federalPorAno(linhas: readonly { ano: number | null; valido: boolean; indicado: number | null; pago: number | null }[]): FederalAno[] {
  const m = new Map<number, FederalAno>();
  for (const l of linhas) {
    if (l.ano === null || !l.valido) continue;
    const a = m.get(l.ano) ?? { ano: l.ano, valido: 0, pago: 0 };
    a.valido += l.indicado ?? 0;
    a.pago += l.pago ?? 0;
    m.set(l.ano, a);
  }
  return [...m.values()].sort((a, b) => a.ano - b.ano);
}
