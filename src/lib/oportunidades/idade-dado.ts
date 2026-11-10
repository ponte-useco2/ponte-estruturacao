/**
 * A idade do dado numa tela (D1 A02/A06, lote 4, 10/11/2026).
 *
 * Antes, só a central de avisos tinha o estado "Dado antigo" (`frescorDoDado`, 36 horas); o catálogo mostrava a data
 * no rodapé e a página do município um chip "dados lidos em <hoje>", que era a data da leitura, não a do dado. Aqui a
 * regra é uma só e cada tela diz qual o seu limiar, porque a fonte decide o ritmo: o catálogo e o painel são
 * diários, as coletas do Acesso Livre são por sessão, os indicadores são mensais ou anuais.
 *
 * Regra 1 do dicionário dos sinais (D0, entrega 3): todo sinal é posição numa data. Esta função só diz a data e se
 * ela passou do limiar; nunca inventa frescor quando a data falta ou vem do futuro (relógio torto).
 *
 * Tudo puro: sem banco, sem rede, sem relógio escondido (`hoje` entra como parâmetro).
 */

export type EstadoIdade = "desconhecido" | "fresco" | "antigo";

export interface IdadeDoDado {
  estado: EstadoIdade;
  /** Horas entre o dado e `hoje`; ausente quando desconhecido. */
  horas?: number;
  /** Dias inteiros (arredondados para baixo); ausente quando desconhecido. */
  dias?: number;
}

/** Limiares por ritmo da fonte, em horas. */
export const LIMIAR_HORAS = {
  /** Catálogo de janelas e painel dos convênios: rodada diária; duas rodadas perdidas é antigo. */
  diario: 48,
  /** Coletas por sessão (Acesso Livre): a sessão é rara; três meses sem coleta é antigo. */
  coleta: 24 * 90,
  /** Rodadas semanais (Pix, e-TCE): duas semanas. */
  semanal: 24 * 14,
} as const;

/** `YYYY-MM-DD` ou ISO com hora → instante; null quando não dá para ler. */
function instante(v: string | null | undefined): Date | null {
  if (!v) return null;
  // Só a data: meio-dia de Brasília, para o dia não virar véspera em UTC.
  const soDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = soDia ? new Date(`${v}T12:00:00-03:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function idadeDoDado(data: string | null | undefined, hoje: string | Date, limiarHoras: number): IdadeDoDado {
  const d = instante(data);
  const h = typeof hoje === "string" ? instante(hoje) : hoje;
  if (!d || !h) return { estado: "desconhecido" };
  const horas = (h.getTime() - d.getTime()) / 36e5;
  if (horas < 0) return { estado: "desconhecido" };
  return { estado: horas >= limiarHoras ? "antigo" : "fresco", horas, dias: Math.floor(horas / 24) };
}

/** "há 3 dias", "há 1 dia", "hoje". */
export function textoIdade(i: IdadeDoDado): string {
  if (i.dias === undefined) return "";
  if (i.dias === 0) return "hoje";
  return `há ${i.dias} ${i.dias === 1 ? "dia" : "dias"}`;
}
