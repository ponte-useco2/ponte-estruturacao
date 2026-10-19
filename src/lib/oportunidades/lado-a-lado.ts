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

// ================================================================ com o municipal (J3 das emendas de João Pessoa, 19/10/2026)

/**
 * As emendas da Câmara de João Pessoa por ano: o orçamento do PRÓPRIO município indicado pelos vereadores, com o valor
 * atual e o pago. Não é dinheiro que chega de fora, como a federal e a estadual: fica ao lado, e nunca se soma.
 */
export interface MunicipalAno {
  ano: number;
  atual: number;
  pago: number;
}

export interface LinhaLadoALado3 extends LinhaLadoALado {
  municipalAtual: number;
  municipalPago: number;
}

/** O lado a lado com as três esferas, de 2021 em diante, do ano mais novo ao mais velho. */
export function ladoALado3(federal: readonly FederalAno[], estadual: readonly EstadualAno[], municipal: readonly MunicipalAno[]): LinhaLadoALado3[] {
  const anos = new Map<number, LinhaLadoALado3>(ladoALado(federal, estadual).map((l) => [l.ano, { ...l, municipalAtual: 0, municipalPago: 0 }]));
  for (const m of municipal) {
    if (m.ano < PRIMEIRO_ANO_ESTADUAL) continue;
    const l = anos.get(m.ano) ?? { ano: m.ano, federalValido: 0, federalPago: 0, estadualEmpenhado: 0, estadualPago: 0, municipalAtual: 0, municipalPago: 0 };
    l.municipalAtual += m.atual || 0;
    l.municipalPago += m.pago || 0;
    anos.set(m.ano, l);
  }
  return [...anos.values()]
    .filter((l) => l.federalValido || l.federalPago || l.estadualEmpenhado || l.estadualPago || l.municipalAtual || l.municipalPago)
    .sort((a, b) => b.ano - a.ano);
}
