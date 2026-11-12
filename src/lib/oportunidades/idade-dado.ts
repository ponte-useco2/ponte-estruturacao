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

/**
 * Quem atrasou o dado antigo (12/11/2026): a fonte ou a nossa leitura.
 *
 * Em 08–12/11/2026 o Transferegov regravou os zips todo dia sem dado novo dentro (o carimbo do histórico parou em
 * 08/11), e o job leu certo a cada rodada; o selo "Dado antigo" sozinho fazia parecer que a leitura tinha quebrado.
 * - "fonte": o dado passou do limiar, mas a última leitura está dentro dele (lemos, e a fonte não trouxe nada novo);
 * - "leitura": a última leitura também passou do limiar (o job parou de rodar);
 * - null: o dado não é antigo, ou falta a data da leitura (nada a afirmar).
 *
 * A leitura pode ser posterior a `hoje` quando `hoje` é só o dia (meio-dia de Brasília) e o job rodou à tarde: conta
 * como leitura recente, e não como relógio torto.
 */
export type CausaAtraso = "fonte" | "leitura";

export function causaDoAtraso(
  data: string | null | undefined,
  lidoEm: string | null | undefined,
  hoje: string | Date,
  limiarHoras: number,
): CausaAtraso | null {
  if (idadeDoDado(data, hoje, limiarHoras).estado !== "antigo") return null;
  const l = instante(lidoEm);
  const h = typeof hoje === "string" ? instante(hoje) : hoje;
  if (!l || !h) return null;
  return (h.getTime() - l.getTime()) / 36e5 < limiarHoras ? "fonte" : "leitura";
}

const DIA_RECIFE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", year: "numeric" });

/** Instante (ISO com hora) → "DD/MM/AAAA" no horário da Paraíba; "" quando não dá para ler. */
export function diaDaLeitura(v: string | null | undefined): string {
  const d = instante(v);
  return d ? DIA_RECIFE.format(d) : "";
}

/** "há 3 dias", "há 1 dia", "hoje". */
export function textoIdade(i: IdadeDoDado): string {
  if (i.dias === undefined) return "";
  if (i.dias === 0) return "hoje";
  return `há ${i.dias} ${i.dias === 1 ? "dia" : "dias"}`;
}
