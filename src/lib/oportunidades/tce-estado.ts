/**
 * O dinheiro do Estado no TCE-PB (emendas estaduais, E3, 16/10/2026): o que o município registrou como recebido e o
 * que gastou com fonte estadual, ao lado do que o Estado diz ter pago (`epb_destino`). Lógica pura, com teste; a
 * leitura das tabelas `tce_estado_*` (oport_42) mora em `emendas-pb.server.ts`.
 *
 * O que vale (estudo de 16/10/2026, 8 municípios, 2025):
 *   · o principal recebido com o CO 3210 (emenda parlamentar individual estadual) fechou EXATO com o pago pelo Estado a
 *     prefeitura e fundos em 7 dos 8; a emenda paga no fim do ano entra como receita do ano seguinte. Por isso a tabela
 *     põe lado a lado o pago pelo Estado (pelo ano da emenda) e o recebido (pelo ano do caixa), e nunca os subtrai;
 *   · a fonte 710 (transferência especial dos Estados) é o "Pix estadual": o gasto nela, com a fatia de capital (grupos
 *     4 e 5), diz quanto do recebido o município já usou e em quê;
 *   · ano cujo arquivo não foi lido é "não verificado", nunca zero.
 */

export interface CoberturaEstado {
  ano: number;
  receitas_lidas: boolean;
  despesas_lidas: boolean;
  motivo: string | null;
}

export interface ReceitaEstado {
  ano: number;
  fonte: string;
  co: string | null;
  tipo: "principal" | "rendimento" | "deducao";
  valor: number;
}

export interface DespesaEstado {
  ano: number;
  fonte: string;
  co: string | null;
  grupo: string | null;
  empenhado: number;
  pago: number;
}

export interface LeituraTceEstado {
  estado: "ok";
  /** A data do arquivo mais novo lido (coluna `dado_ate` da execução `tce_*`). */
  dadoAte: string | null;
  cobertura: CoberturaEstado[];
  receita: ReceitaEstado[];
  despesa: DespesaEstado[];
}
export type LeituraTceEstadoMunicipio = LeituraTceEstado | { estado: "sem_dado" } | { estado: "falha" };

export const CO_EMENDA_ESTADUAL = "3210";
export const FONTE_PIX_ESTADUAL = "710";
export const FONTE_CONVENIO_ESTADUAL = "701";
const CAPITAL = new Set(["4", "5"]);

export interface AnoNoTce {
  ano: number;
  /** O que o Estado diz ter pago a prefeitura e fundos nas emendas deste ano (`epb_destino`, pelo ano da emenda). */
  pagoPeloEstado: number;
  /** null: o arquivo de receitas deste ano não foi lido. */
  recebidoEmenda: number | null;
  recebidoPix: number | null;
  rendimentoPix: number | null;
  recebidoConvenio: number | null;
  /** null: a parte estadual das despesas deste ano não foi lida. */
  gastoPix: number | null;
  /** Capital ÷ gasto na fonte 710, em %; null sem gasto ou sem leitura. */
  pctCapitalPix: number | null;
  gastoConvenio: number | null;
  motivo: string | null;
}

const soma = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((s, x) => s + (f(x) || 0), 0);

/**
 * Os anos lidos pelo TCE-PB (os da cobertura), do mais novo ao mais velho, com o pago pelo Estado ao lado. O pago pelo
 * Estado de um ano fora da cobertura (antes de 2024) fica de fora: não há o que pôr ao lado.
 */
export function anosNoTce(l: Omit<LeituraTceEstado, "estado" | "dadoAte">, pagoPeloEstadoPorAno: ReadonlyMap<number, number>): AnoNoTce[] {
  return [...l.cobertura]
    .sort((a, b) => b.ano - a.ano)
    .map((c) => {
      const rec = c.receitas_lidas ? l.receita.filter((r) => r.ano === c.ano) : null;
      const desp = c.despesas_lidas ? l.despesa.filter((d) => d.ano === c.ano) : null;
      const recebido = (f: (r: ReceitaEstado) => boolean) => (rec ? soma(rec.filter((r) => r.tipo === "principal" && f(r)), (r) => r.valor) : null);
      const pix = desp ? desp.filter((d) => d.fonte === FONTE_PIX_ESTADUAL) : null;
      const gastoPix = pix ? soma(pix, (d) => d.pago) : null;
      const capital = pix ? soma(pix.filter((d) => CAPITAL.has(d.grupo ?? "")), (d) => d.pago) : null;
      return {
        ano: c.ano,
        pagoPeloEstado: pagoPeloEstadoPorAno.get(c.ano) ?? 0,
        recebidoEmenda: recebido((r) => r.co === CO_EMENDA_ESTADUAL),
        recebidoPix: recebido((r) => r.fonte === FONTE_PIX_ESTADUAL),
        rendimentoPix: rec ? soma(rec.filter((r) => r.tipo === "rendimento" && r.fonte === FONTE_PIX_ESTADUAL), (r) => r.valor) : null,
        recebidoConvenio: recebido((r) => r.fonte === FONTE_CONVENIO_ESTADUAL),
        gastoPix,
        pctCapitalPix: gastoPix && capital !== null ? Math.round((capital / gastoPix) * 1000) / 10 : null,
        gastoConvenio: desp ? soma(desp.filter((d) => d.fonte === FONTE_CONVENIO_ESTADUAL), (d) => d.pago) : null,
        motivo: c.motivo,
      };
    });
}

/** Algum ano tem algo a mostrar (lido, com valor, ou com pago pelo Estado)? */
export function temAlgoNoTce(anos: readonly AnoNoTce[]): boolean {
  return anos.some(
    (a) =>
      a.pagoPeloEstado > 0 ||
      [a.recebidoEmenda, a.recebidoPix, a.recebidoConvenio, a.gastoPix, a.gastoConvenio].some((v) => v !== null && v !== 0),
  );
}
