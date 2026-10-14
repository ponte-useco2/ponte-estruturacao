/**
 * Os programas do Transferegov abertos agora a uma OSC da UF, para a sala do cliente (14/10/2026). Lógica pura; a
 * leitura é `sala.server.ts`, da última rodada do radar de janelas (`radar_programa_aberto`, uma linha por UF).
 *
 * O canal diz o que a OSC precisa para propor:
 *   · voluntária: proposta própria, sem emenda;
 *   · emenda parlamentar: só com a indicação de um parlamentar no SIOP;
 *   · beneficiário específico: só a entidade que o órgão já nomeou.
 */

export const NATUREZA_OSC = "Organização da Sociedade Civil";

export type CanalPrograma = "voluntaria" | "emenda_parlamentar" | "beneficiario_especifico";

export const ROTULO_CANAL_PROGRAMA: Record<CanalPrograma, string> = {
  voluntaria: "Voluntária (sem emenda)",
  emenda_parlamentar: "Com emenda parlamentar",
  beneficiario_especifico: "Beneficiário específico",
};

export interface LinhaRadarPrograma {
  cod_programa: string;
  programa: string | null;
  orgao: string | null;
  canal: string | null;
  abre: string | null; // AAAA-MM-DD
  fecha: string | null; // AAAA-MM-DD
  naturezas: string[] | null;
}

export interface ProgramaAberto {
  codigo: string;
  programa: string;
  orgao: string;
  canal: CanalPrograma | "outro";
  abre: string | null;
  fecha: string;
  diasRestantes: number;
}

const MS_DIA = 86_400_000;

function dias(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / MS_DIA);
}

/**
 * Título do Transferegov às vezes vem com "?" no lugar do acento (texto gravado com a codificação errada na origem:
 * "Promo??o", "SUPERA??O", "Defici?ncia"). Só os dois padrões que não deixam dúvida voltam: "??o" depois de letra é
 * "ção" e "?ncia" é "ência". O resto fica como o Transferegov publica.
 */
export function limparTitulo(texto: string | null): string {
  return (texto ?? "")
    .replace(/([A-Za-z])\?\?([oO])/g, (_, antes: string, o: string) => `${antes}${o === "O" ? "ÇÃO" : "ção"}`)
    .replace(/([A-Za-z])\?(nci[ao]s?)\b/gi, (_, antes: string, resto: string) => `${antes}${resto[0] === "N" ? "Ê" : "ê"}${resto}`)
    .replace(/\s+/g, " ")
    .trim();
}

const limpar = limparTitulo;

/**
 * Os programas abertos a OSC em `hoje` (AAAA-MM-DD): um por código (a mesma janela aparece repetida), fechando hoje ou
 * depois, em ordem de fechamento. Data de fechamento absurda (o Transferegov tem "5008-12-15") fica de fora.
 */
export function programasParaOsc(linhas: LinhaRadarPrograma[], hoje: string): ProgramaAberto[] {
  const porCodigo = new Map<string, ProgramaAberto>();
  for (const l of linhas) {
    if (!l.cod_programa || !l.fecha || !(l.naturezas ?? []).includes(NATUREZA_OSC)) continue;
    if (l.fecha < hoje || dias(hoje, l.fecha) > 800) continue;
    const canal: ProgramaAberto["canal"] =
      l.canal === "voluntaria" || l.canal === "emenda_parlamentar" || l.canal === "beneficiario_especifico" ? l.canal : "outro";
    const atual = porCodigo.get(l.cod_programa);
    const novo: ProgramaAberto = {
      codigo: l.cod_programa,
      programa: limpar(l.programa) || l.cod_programa,
      orgao: limpar(l.orgao),
      canal,
      abre: l.abre,
      fecha: l.fecha,
      diasRestantes: dias(hoje, l.fecha),
    };
    if (!atual || novo.fecha > atual.fecha) porCodigo.set(l.cod_programa, novo);
  }
  return [...porCodigo.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orgao.localeCompare(b.orgao, "pt-BR"));
}

/** Contagem por canal, para o resumo da seção. */
export function contarPorCanal(programas: ProgramaAberto[]): Record<ProgramaAberto["canal"], number> {
  const c: Record<ProgramaAberto["canal"], number> = { voluntaria: 0, emenda_parlamentar: 0, beneficiario_especifico: 0, outro: 0 };
  for (const p of programas) c[p.canal] += 1;
  return c;
}

/** Dias corridos entre duas datas AAAA-MM-DD (negativo se `ate` já passou). */
export function diasEntre(de: string, ate: string): number {
  return dias(de, ate);
}

/** A data de hoje em Brasília, AAAA-MM-DD. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}
