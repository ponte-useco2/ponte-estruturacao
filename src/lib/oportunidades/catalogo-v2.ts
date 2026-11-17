/**
 * Do catálogo v2 ao que a tela mostra — puro: sem banco, rede nem relógio.
 *
 * É aqui que as regras do contrato (`contrato-v2.ts`) e a elegibilidade
 * (`elegibilidade.ts`) viram lista. A tela só desenha; não decide o que é
 * aberto, o que a entidade pode pleitear nem em que ordem aparece.
 */
import {
  ORDEM_CANAL,
  ROTULO_INSTRUMENTO,
  ROTULO_SAUDE,
  canalDaOportunidade,
  diasAte,
  ehAberta,
  ehFluxoContinuo,
  encerradaRecente,
  hojeLocal,
  urgente,
  type CanalV2,
  type OportunidadeV2,
  type PayloadV2,
  type SaudeDaFonte,
  type SaudeFonte,
} from "./contrato-v2.ts";
import {
  avaliar,
  ehDoTransferegov,
  janelaDoV2,
  ufNaFrase,
  type Aderencia,
  type Papel,
  type Perguntante,
} from "./elegibilidade.ts";
import { comAscendentes, paiDe } from "./temas.ts";

export interface JanelaVista {
  id: string;
  titulo: string;
  financiador: string;
  fonteId: string;
  fonteNome: string;
  /** `source.url`: a página pública da fonte. Nas fontes das APIs novas do Transferegov é o módulo do sistema. */
  fonteUrl: string;
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
  /**
   * Diagnóstico externo de 17/11/2026 (A03): a saúde da fonte em `sources`, para o cartão dizer desde quando ela está
   * sem leitura (ver `avisoDaFonte`). Null quando a fonte não está em `sources`.
   */
  fonteStatus: SaudeFonte | null;
  fonteUltimoSucesso: string | null;
  /** A03: `avisoDaFonte` já calculado com o "hoje" da tela. */
  avisoFonte: { selo: string; frase: string } | null;
  /**
   * A11: `source.url` é a página do próprio item, e não a página geral da fonte (`sources[].url`). É o que permite
   * usá-la como link principal do cartão.
   */
  fontePaginaPropria: boolean;
  /** Contrato 2.2. Null sem entidade declarada; "parceira" quando ela só entra junto; "vinculo" na bolsa (A01). */
  papel: Papel | null;
  /** Contrato 2.2: os parceiros do edital (Decit/MS, CNPq, a FAP). */
  parceiros: string[];
  /** Contrato 2.2: a descrição da fonte, que é o que explica uma porta permanente. */
  descricao: string | null;
  /** Só nas encerradas: quando encerrou (ou o prazo). Null também quando a fonte não informou. */
  encerradaEm: string | null;
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
   * Contrato 2.2. Abertas em que a entidade entra só como PARCEIRA — à parte da
   * lista principal, que continua sendo a do que ela pode propor. Vazia sem entidade.
   */
  comoParceira: JanelaVista[];
  /**
   * Diagnóstico externo de 17/11/2026 (A01). Bolsas abertas em que a entidade é só a instituição de vínculo de quem se
   * candidata. À parte, como a de parceira. Vazia sem entidade.
   */
  comoVinculo: JanelaVista[];
  /** Contrato 2.2: portas de fluxo contínuo (sem prazo). Com entidade, só as que servem a ela. */
  portas: JanelaVista[];
  /**
   * Encerradas nos últimos 24 meses (decisão do titular, 14/10/2026): o que já
   * houve, para quem prepara a próxima edição. Com entidade, só as que serviam a ela.
   */
  encerradas: JanelaVista[];
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
    /** Abertas hoje em que ela entra como parceira (contrato 2.2). */
    comoParceira: number;
    /** A01: abertas hoje em que ela é a instituição de vínculo de uma bolsa. */
    comoVinculo: number;
    /** A02: abertas hoje que aceitam o tipo, mas cujo título restringe a outro território. */
    foraDoTerritorio: number;
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

function vista(
  o: OportunidadeV2,
  hojeIso: string,
  aderencia: Aderencia | null,
  codigos: string[],
  saude: SaudeDaFonte | undefined,
  encerradaEm: string | null = null,
): JanelaVista {
  const fonteStatus = saude?.status ?? null;
  const fonteUltimoSucesso = saude?.last_success_at ?? null;
  return {
    id: o.id,
    titulo: o.title,
    financiador: o.funder,
    fonteId: o.source.id,
    fonteNome: o.source.name,
    fonteUrl: o.source.url,
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
    fonteStatus,
    fonteUltimoSucesso,
    avisoFonte: avisoDaFonte(
      { fonteNome: o.source.name, fonteStatus, fonteUltimoSucesso, fonteDefasada: o.source.stale },
      hojeIso,
    ),
    fontePaginaPropria: o.source.url !== saude?.url,
    papel: aderencia?.papel ?? null,
    parceiros: o.partners ?? [],
    descricao: o.description,
    encerradaEm,
  };
}

/** A mais recente primeiro, as sem data no fim; empate pelo título, para a ordem ser estável. */
function ordenarEncerradas(a: JanelaVista, b: JanelaVista): number {
  const da = a.encerradaEm ?? "";
  const db = b.encerradaEm ?? "";
  if (da !== db) return da < db ? 1 : -1;
  return a.titulo.localeCompare(b.titulo, "pt-BR");
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
  // A porta permanente (contrato 2.2) é "aberta" pela regra 5, mas não é janela:
  // não vence nem entra na conta de abertas. Vai para a lista própria.
  const abertas = payload.opportunities.filter((o) => ehAberta(o, hojeIso) && !ehFluxoContinuo(o));
  // A03: a saúde de cada fonte vai junto da janela, para o cartão dizer desde quando ela está sem leitura.
  const saudePorFonte = new Map(payload.sources.map((s) => [s.id, s]));
  // A01: a versão do arquivo decide se "bolsa" já separa a pessoa da instituição (ver `bolsaSeparaPessoa`).
  const avaliarAqui = (o: OportunidadeV2, q: Perguntante) => avaliar(janelaDoV2(o, payload.version), q);

  const janelas: JanelaVista[] = [];
  const comoParceira: JanelaVista[] = [];
  const comoVinculo: JanelaVista[] = [];
  let foraDoTipo = 0;
  let foraDoTerritorio = 0;
  for (const o of abertas) {
    const codigosDaJanela = codigos.get(o.id) ?? [];
    const saude = saudePorFonte.get(o.source.id);
    if (quem === null) {
      janelas.push(vista(o, hojeIso, null, codigosDaJanela, saude));
      continue;
    }
    const a = avaliarAqui(o, quem);
    if (a.elegivel) {
      janelas.push(vista(o, hojeIso, a, codigosDaJanela, saude));
    } else if (a.papel === "parceira") {
      comoParceira.push(vista(o, hojeIso, a, codigosDaJanela, saude));
    } else if (a.papel === "vinculo") {
      comoVinculo.push(vista(o, hojeIso, a, codigosDaJanela, saude));
    } else if (a.territorio === "incompativel") {
      foraDoTerritorio++;
    } else {
      foraDoTipo++;
    }
  }
  janelas.sort(ordenar);
  comoParceira.sort(ordenar);
  comoVinculo.sort(ordenar);

  // Portas e encerradas: sem entidade, todas; com entidade, as que servem a ela,
  // como proponente, como parceira ou como instituição de vínculo (A01).
  const serve = (o: OportunidadeV2): Aderencia | null | false => {
    if (quem === null) return null;
    const a = avaliarAqui(o, quem);
    return a.elegivel || a.papel === "parceira" || a.papel === "vinculo" ? a : false;
  };
  const portas: JanelaVista[] = [];
  const encerradas: JanelaVista[] = [];
  for (const o of payload.opportunities) {
    const continua = ehFluxoContinuo(o);
    const encerrada = continua ? null : encerradaRecente(o, hojeIso);
    if (!continua && encerrada === null) continue;
    const a = serve(o);
    if (a === false) continue;
    const saude = saudePorFonte.get(o.source.id);
    if (continua) portas.push(vista(o, hojeIso, a, codigos.get(o.id) ?? [], saude));
    else encerradas.push(vista(o, hojeIso, a, codigos.get(o.id) ?? [], saude, encerrada?.em ?? null));
  }
  portas.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  encerradas.sort(ordenarEncerradas);

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
    comoParceira,
    comoVinculo,
    portas,
    encerradas,
    universo: { monitoradas: payload.summary.monitored, abertasHoje: abertas.length },
    paraEntidade:
      quem === null
        ? null
        : {
            elegiveis: janelas.length,
            urgentes: janelas.filter((j) => j.urgente).length,
            foraDoTipo,
            comoParceira: comoParceira.length,
            comoVinculo: comoVinculo.length,
            foraDoTerritorio,
          },
    fontes,
    fontesComProblema: fontes.filter((f) => f.status !== "healthy"),
  };
}

// ============================ FONTE E LINKS DO CARTÃO ============================

/** "23/10", ou "23/10/2025" quando o ano não é o de hoje. No horário da Paraíba, como o "hoje" da tela. */
function diaEMes(instante: string, hojeIso: string): string | null {
  const t = Date.parse(instante);
  if (Number.isNaN(t)) return null;
  const [ano, mes, dia] = hojeLocal(new Date(t)).split("-");
  return ano === hojeIso.slice(0, 4) ? `${dia}/${mes}` : `${dia}/${mes}/${ano}`;
}

/**
 * Diagnóstico externo de 17/11/2026 (A03). O aviso de uma janela cuja fonte está em falha: o `selo` curto (tabela das
 * encerradas) e a `frase` do cartão, com a data da última leitura boa. Antes o cartão dizia só "fonte fora do ar",
 * sem data, e a FAPESQ estava sem leitura desde 23/10. Null quando a fonte está em dia e o dado não é de leitura antiga.
 */
export function avisoDaFonte(
  j: Pick<JanelaVista, "fonteNome" | "fonteStatus" | "fonteUltimoSucesso" | "fonteDefasada">,
  hojeIso: string,
): { selo: string; frase: string } | null {
  if (j.fonteStatus !== null && j.fonteStatus !== "healthy") {
    const desde = j.fonteUltimoSucesso ? diaEMes(j.fonteUltimoSucesso, hojeIso) : null;
    const selo = desde ? `sem leitura desde ${desde}` : "sem leitura boa registrada";
    return { selo, frase: `${j.fonteNome} ${selo}; prazo e regras podem ter mudado.` };
  }
  if (j.fonteDefasada) {
    return { selo: "dado de leitura anterior", frase: "Dado da última leitura boa da fonte; prazo e regras podem ter mudado." };
  }
  return null;
}

/**
 * Diagnóstico externo de 17/11/2026 (A11). O link principal do cartão fora do Transferegov: a página do próprio item
 * (`source.url`). Antes era o primeiro documento, que na Finep é a "Plataforma de Apoio e Financiamento", igual em
 * todas as chamadas. No Transferegov, `source.url` é o módulo inteiro: lá vale o código do programa. Null também
 * quando o endereço não é https ou é só a página geral da fonte.
 */
export function paginaDoItem(j: Pick<JanelaVista, "fonteId" | "fonteUrl" | "fontePaginaPropria">): string | null {
  if (ehDoTransferegov(j.fonteId) || !j.fontePaginaPropria) return null;
  return j.fonteUrl.startsWith("https://") ? j.fonteUrl : null;
}

/** A11: os documentos que vão como links secundários, sem repetir a página do item. */
export function documentosSecundarios(
  j: Pick<JanelaVista, "fonteId" | "fonteUrl" | "fontePaginaPropria" | "documentos">,
): { titulo: string; url: string }[] {
  const pagina = paginaDoItem(j);
  return pagina === null ? [] : j.documentos.filter((d) => d.url !== pagina);
}

// ============================ RECONCILIAÇÃO ============================

export interface Reconciliacao {
  /** Abertas hoje no catálogo inteiro, todas as fontes, sem as portas permanentes. */
  abertasHoje: number;
  /** As que aceitam o tipo e a UF da entidade: a lista principal. */
  aceitam: number;
  urgentes: number;
  /** Na ordem de `ORDEM_CANAL`; o canal não informado (null) por último. Só os que têm janela. */
  porCanal: { canal: CanalV2 | null; n: number }[];
  /** Programas distintos entre as que aceitam: as janelas de emenda e voluntária do mesmo código contam uma vez. */
  programas: number;
  foraDoTipo: number;
  comoParceira: number;
  comoVinculo: number;
  foraDoTerritorio: number;
  /** As partes somam o todo. Se não somarem, a tela não mostra a conta (ela mentiria). */
  fecha: boolean;
}

/**
 * Diagnóstico externo de 17/11/2026 (A05). De onde sai o número da lista: as abertas de hoje no catálogo inteiro, as
 * que aceitam a entidade (por canal e por programa) e o resto (fora do tipo, parceira, vínculo, fora do território).
 * Null sem entidade declarada. Não é a conta de outras telas, e não precisa ser.
 */
export function reconciliar(vista: Pick<CatalogoVista, "janelas" | "universo" | "paraEntidade">): Reconciliacao | null {
  const e = vista.paraEntidade;
  if (e === null) return null;
  const contagem = new Map<CanalV2 | null, number>();
  const programas = new Set<string>();
  for (const j of vista.janelas) {
    contagem.set(j.canal, (contagem.get(j.canal) ?? 0) + 1);
    programas.add(j.codigos.length > 0 ? [...j.codigos].sort().join("+") : `${j.fonteId}|${j.titulo}`);
  }
  const porCanal = [...ORDEM_CANAL, null]
    .filter((c) => (contagem.get(c) ?? 0) > 0)
    .map((c) => ({ canal: c, n: contagem.get(c) ?? 0 }));
  const soma = e.elegiveis + e.foraDoTipo + e.comoParceira + e.comoVinculo + e.foraDoTerritorio;
  return {
    abertasHoje: vista.universo.abertasHoje,
    aceitam: e.elegiveis,
    urgentes: e.urgentes,
    porCanal,
    programas: programas.size,
    foraDoTipo: e.foraDoTipo,
    comoParceira: e.comoParceira,
    comoVinculo: e.comoVinculo,
    foraDoTerritorio: e.foraDoTerritorio,
    fecha: soma === vista.universo.abertasHoje,
  };
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

const PARTE_DO_CANAL: Record<CanalV2, (n: number) => string> = {
  voluntaria: (n) => plural(n, "voluntária", "voluntárias"),
  emenda_parlamentar: (n) => `${n} de emenda`,
  beneficiario_especifico: (n) => `${n} de beneficiário específico`,
  chamada_publica: (n) => `${n} de chamada pública`,
  fluxo_continuo: (n) => `${n} de fluxo contínuo`,
};

/**
 * A05: as duas frases da tela. `universo` vai junto do número ("68 abertas aceitam município da PB, em todas as
 * fontes (...)"); `conta`, recolhida, reconcilia com as abertas de hoje. `tipo` já vem no meio da frase (ver
 * `tipoNaFrase` na tela).
 */
export function frasesDaReconciliacao(r: Reconciliacao, tipo: string, uf: string | null): { universo: string; conta: string } {
  const quem = uf ? `${tipo} ${ufNaFrase(uf, "de")}` : tipo;
  const beneficiario = r.porCanal.find((c) => c.canal === "beneficiario_especifico")?.n ?? 0;
  const universo =
    `${r.aceitam} ${r.aceitam === 1 ? "aberta aceita" : "abertas aceitam"} ${quem}, em todas as fontes` +
    (beneficiario > 0
      ? ` (${beneficiario} de beneficiário específico só ${beneficiario === 1 ? "vale" : "valem"} para o ente que o concedente indicar)`
      : "");
  const canais = r.porCanal.map((c) => (c.canal === null ? `${c.n} sem canal informado` : PARTE_DO_CANAL[c.canal](c.n)));
  const detalhe = [canais.join(", "), plural(r.programas, "programa", "programas")].filter(Boolean).join("; ");
  const resto = [`fora do tipo ${r.foraDoTipo}`];
  if (r.comoParceira > 0) resto.push(`parceira ${r.comoParceira}`);
  if (r.comoVinculo > 0) resto.push(`instituição de vínculo ${r.comoVinculo}`);
  if (r.foraDoTerritorio > 0) resto.push(`fora do território ${r.foraDoTerritorio}`);
  const conta =
    `${plural(r.abertasHoje, "aberta", "abertas")} hoje no catálogo, sem as portas permanentes → ` +
    `${r.aceitam} ${r.aceitam === 1 ? "aceita" : "aceitam"} ${quem} (${detalhe}) → ${resto.join(", ")}.`;
  return { universo, conta };
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
      // A11: os códigos do programa também, que é o que se digita no Transferegov.
      (termo === "" || semAcento(`${j.titulo} ${j.financiador} ${j.codigos.join(" ")}`).includes(termo)),
  );
}

/** O que a tela desenha depois dos filtros, seção por seção. As encerradas têm tabela com filtros próprios. */
export interface VistaFiltrada {
  janelas: JanelaVista[];
  comoParceira: JanelaVista[];
  comoVinculo: JanelaVista[];
  portas: JanelaVista[];
}

/**
 * Diagnóstico externo de 17/11/2026 (A11). Os filtros valem para todas as seções da tela, e não só para a lista
 * principal: antes, buscar "Finep" deixava as portas e a parceira inteiras embaixo. Nas portas o canal não filtra —
 * todas são `fluxo_continuo`, e qualquer escolha de canal as esconderia; valem a busca, a fonte e o assunto.
 */
export function filtrarVista(
  vista: Pick<CatalogoVista, "janelas" | "comoParceira" | "comoVinculo" | "portas">,
  f: FiltrosCatalogo,
): VistaFiltrada {
  return {
    janelas: filtrarJanelas(vista.janelas, f),
    comoParceira: filtrarJanelas(vista.comoParceira, f),
    comoVinculo: filtrarJanelas(vista.comoVinculo, f),
    portas: filtrarJanelas(vista.portas, { ...f, canais: [] }),
  };
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
