/**
 * Do catálogo v2 ao que a tela mostra — puro: sem banco, rede nem relógio.
 *
 * É aqui que as regras do contrato (`contrato-v2.ts`) e a elegibilidade
 * (`elegibilidade.ts`) viram lista. A tela só desenha; não decide o que é
 * aberto, o que a entidade pode pleitear nem em que ordem aparece.
 */
import {
  ROTULO_INSTRUMENTO,
  ROTULO_SAUDE,
  canalDaOportunidade,
  diasAte,
  ehAberta,
  urgente,
  type CanalV2,
  type OportunidadeV2,
  type PayloadV2,
  type SaudeFonte,
} from "./contrato-v2.ts";
import { avaliar, janelaDoV2, type Aderencia, type Perguntante } from "./elegibilidade.ts";
import { comAscendentes, paiDe } from "./temas.ts";

export interface JanelaVista {
  id: string;
  titulo: string;
  financiador: string;
  fonteId: string;
  fonteNome: string;
  instrumento: string;
  /** Null quando o arquivo não informa e o `id` não permite deduzir. */
  canal: CanalV2 | null;
  prazo: string | null;
  diasRestantes: number | null;
  urgente: boolean;
  /** Ids estáveis de `temas.ts`, já normalizados. */
  temas: string[];
  /** Null quando ninguém declarou entidade: sem quem pergunta, não há aderência. */
  aderencia: Aderencia | null;
  documentos: { titulo: string; url: string }[];
  /**
   * Códigos do programa no Transferegov, para digitar na consulta pública. Vazio
   * nas outras fontes e quando o v1 não casou (ver `codigos-transferegov.ts`).
   */
  codigos: string[];
  /** `source.stale`: o dado desta janela é o da última leitura boa da fonte. */
  fonteDefasada: boolean;
}

export interface FonteVista {
  id: string;
  nome: string;
  status: SaudeFonte;
  rotuloStatus: string;
  /** Abertas hoje nesta fonte — só as elegíveis, quando há entidade. */
  abertas: number;
  ultimoSucesso: string | null;
  erro: string | null;
}

export interface CatalogoVista {
  geradoEm: string;
  hoje: string;
  janelas: JanelaVista[];
  /**
   * Regra 2 do contrato: o UNIVERSO do catálogo, nunca rotulado como "seu".
   *
   * `abertasHoje` é calculado aqui, e não lido de `summary.open`: o `summary`
   * é do instante da geração e conta como abertas as que já venceram (regra
   * 5). No catálogo de 10/09 lido em 12/09 seriam 165 contra 153 de verdade.
   */
  universo: { monitoradas: number; abertasHoje: number };
  /** Só existe com entidade declarada. */
  paraEntidade: {
    elegiveis: number;
    urgentes: number;
    /** Abertas hoje que o tipo de proponente da entidade não pode pleitear. */
    foraDoTipo: number;
  } | null;
  fontes: FonteVista[];
  /** Regra 1: as que a tela é obrigada a nomear. */
  fontesComProblema: FonteVista[];
}

/**
 * Regra 6: a ordem do arquivo NÃO é preservada, porque o radar desempata por
 * `ponte_score`. Aqui: prazo mais próximo primeiro (quem não tem prazo vai ao
 * fim), depois a aderência de QUEM OLHA, depois o título para a ordem ser
 * estável.
 */
function ordenar(a: JanelaVista, b: JanelaVista): number {
  const pa = a.diasRestantes ?? Number.POSITIVE_INFINITY;
  const pb = b.diasRestantes ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  const sa = a.aderencia?.pontuacao ?? 0;
  const sb = b.aderencia?.pontuacao ?? 0;
  if (sa !== sb) return sb - sa;
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

function vista(o: OportunidadeV2, hojeIso: string, aderencia: Aderencia | null, codigos: string[]): JanelaVista {
  return {
    id: o.id,
    titulo: o.title,
    financiador: o.funder,
    fonteId: o.source.id,
    fonteNome: o.source.name,
    instrumento: ROTULO_INSTRUMENTO[o.instrument.type] ?? o.instrument.type,
    canal: canalDaOportunidade(o),
    prazo: o.dates.deadline,
    diasRestantes: diasAte(o.dates.deadline, hojeIso),
    urgente: urgente(o, hojeIso),
    temas: janelaDoV2(o).temas,
    aderencia,
    documentos: o.documents.map((d) => ({ titulo: d.title, url: d.url })),
    codigos,
    fonteDefasada: o.source.stale,
  };
}

/**
 * `codigos`: id da oportunidade → códigos do programa, montado no servidor por
 * `codigosPorJanela`. Chega pronto porque o casamento usa `node:crypto`, e este
 * módulo também roda no navegador (os filtros).
 */
export function montarCatalogo(
  payload: PayloadV2,
  quem: Perguntante | null,
  hojeIso: string,
  codigos: ReadonlyMap<string, string[]> = new Map(),
): CatalogoVista {
  const abertas = payload.opportunities.filter((o) => ehAberta(o, hojeIso));

  const janelas: JanelaVista[] = [];
  let foraDoTipo = 0;
  for (const o of abertas) {
    const codigosDaJanela = codigos.get(o.id) ?? [];
    if (quem === null) {
      janelas.push(vista(o, hojeIso, null, codigosDaJanela));
      continue;
    }
    const a = avaliar(janelaDoV2(o), quem);
    if (!a.elegivel) {
      foraDoTipo++;
      continue;
    }
    janelas.push(vista(o, hojeIso, a, codigosDaJanela));
  }
  janelas.sort(ordenar);

  const abertasPorFonte = new Map<string, number>();
  for (const j of janelas) abertasPorFonte.set(j.fonteId, (abertasPorFonte.get(j.fonteId) ?? 0) + 1);

  const fontes: FonteVista[] = payload.sources.map((s) => ({
    id: s.id,
    nome: s.name,
    status: s.status,
    rotuloStatus: ROTULO_SAUDE[s.status] ?? s.status,
    abertas: abertasPorFonte.get(s.id) ?? 0,
    ultimoSucesso: s.last_success_at,
    erro: s.error,
  }));

  return {
    geradoEm: payload.generated_at,
    hoje: hojeIso,
    janelas,
    universo: { monitoradas: payload.summary.monitored, abertasHoje: abertas.length },
    paraEntidade:
      quem === null
        ? null
        : { elegiveis: janelas.length, urgentes: janelas.filter((j) => j.urgente).length, foraDoTipo },
    fontes,
    fontesComProblema: fontes.filter((f) => f.status !== "healthy"),
  };
}

// ============================ FILTROS ============================

/**
 * O que a pessoa está olhando AGORA. Não confundir com preferência: a
 * preferência é gravada e decide a aderência; o filtro vive só na tela e some ao
 * sair. Os dois usam o mesmo vocabulário de assuntos.
 */
export interface FiltrosCatalogo {
  fontes: string[];
  canais: CanalV2[];
  assuntos: string[];
  busca: string;
}

export const SEM_FILTRO: FiltrosCatalogo = { fontes: [], canais: [], assuntos: [], busca: "" };

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Assunto escolhido alcança a janela pela MESMA regra de hierarquia da
 * aderência: escolher Inovação traz a janela marcada só como `bioeconomia`;
 * escolher `bioeconomia` não traz `descarbonizacao`, nem a janela marcada só com
 * `inovacao` genérica. É `comAscendentes` que garante isso.
 */
export function alcancaAssunto(temasDaJanela: string[], escolhidos: string[]): boolean {
  if (escolhidos.length === 0) return true;
  const alcance = comAscendentes(temasDaJanela);
  return escolhidos.some((a) => alcance.includes(a));
}

/**
 * O subfiltro REFINA: se algum filho de um pai escolhido também foi escolhido,
 * o pai sai e ficam só os filhos.
 *
 * Sem isto o subfiltro não teria efeito. Pela regra de alcance, Inovação já
 * inclui Bioeconomia; marcar Inovação e depois Bioeconomia somaria o que já
 * estava lá, e a lista não mudaria. Quem abre o subfiltro quer estreitar.
 *
 *   [inovacao]                        → toda a inovação
 *   [inovacao, bioeconomia]           → só bioeconomia
 *   [inovacao, bioeconomia, saude]    → bioeconomia e saúde
 */
export function assuntosEfetivos(escolhidos: string[]): string[] {
  const paisRefinados = new Set(
    escolhidos.map((a) => paiDe(a)).filter((p): p is string => p !== null && escolhidos.includes(p)),
  );
  return escolhidos.filter((a) => !paisRefinados.has(a));
}

export function filtrarJanelas(janelas: JanelaVista[], f: FiltrosCatalogo): JanelaVista[] {
  const termo = semAcento(f.busca.trim());
  const assuntos = assuntosEfetivos(f.assuntos);
  return janelas.filter(
    (j) =>
      (f.fontes.length === 0 || f.fontes.includes(j.fonteId)) &&
      // Janela sem canal conhecido só aparece sem filtro de canal: incluí-la em
      // qualquer escolha afirmaria um canal que o dado não informa.
      (f.canais.length === 0 || (j.canal !== null && f.canais.includes(j.canal))) &&
      alcancaAssunto(j.temas, assuntos) &&
      (termo === "" || semAcento(`${j.titulo} ${j.financiador}`).includes(termo)),
  );
}

/**
 * Quantas janelas cada assunto alcança, já com a contagem SUBINDO para o pai —
 * a mesma regra do painel de preferências. Contagem é o que impede escolher às
 * cegas; se não subisse, Inovação apareceria alcançando menos do que alcança.
 */
export function contarPorAssunto(janelas: JanelaVista[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const j of janelas) {
    for (const id of comAscendentes(j.temas)) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  }
  return contagem;
}

/** Quantas janelas da entidade chegam por cada canal. Mesma base das outras contagens. */
export function contarPorCanal(janelas: JanelaVista[]): Map<CanalV2, number> {
  const contagem = new Map<CanalV2, number>();
  for (const j of janelas) {
    if (j.canal !== null) contagem.set(j.canal, (contagem.get(j.canal) ?? 0) + 1);
  }
  return contagem;
}
