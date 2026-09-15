/**
 * Assuntos, com rótulo legível — em dois níveis.
 *
 * O radar marca cada janela com os RADICAIS que casaram no nome do programa e
 * do órgão (`TEMAS_PADRAO`, em `radar/scripts/radar.py`): fragmentos como
 * `inovaç`, `socioassist`, `fundiári`. São dado interno — ninguém escolhe
 * "inovaç" numa tela. Aqui cada assunto vira um id estável, um rótulo em
 * português e a lista de radicais que o representam.
 *
 * O id é o que fica gravado na preferência de cada pessoa. Ele é estável de
 * propósito: se o radar trocar um radical, muda a lista aqui e nada do que já
 * foi escolhido se perde.
 *
 * ------------------------------------------------------------------ dois níveis
 *
 * Até 12/09/2026 eram doze assuntos planos, construídos para o Transferegov:
 * regularização fundiária, ATHIS, saneamento. O catálogo v2 trouxe as outras
 * três fontes — Finep, CNPq e FAPESQ — e com elas o vocabulário de FOMENTO À
 * INOVAÇÃO: subvenção econômica, bioeconomia, descarbonização, indústria 4.0.
 *
 * Pôr tudo num nível só daria 29 caixas de seleção lado a lado, e as verticais
 * da Finep só fazem sentido para quem já decidiu que quer inovação. Por isso
 * elas são FILHAS de `inovacao`: a tela só as mostra quando Inovação está
 * marcado.
 *
 * A regra de casamento que decorre disso: janela marcada como `bioeconomia`
 * TAMBÉM combina com quem segue `inovacao`. Marcar o pai traz tudo abaixo dele;
 * marcar o filho estreita. Ver `comAscendentes`.
 *
 * Cobertura: no v1.1 de 11/09/2026, 40 das 150 janelas tinham algum tema; no v2
 * de 10/09/2026, 62 das 171. É por isso que a preferência não é só por tema —
 * órgão e natureza também contam, e esses cobrem o catálogo inteiro.
 */

export interface Tema {
  id: string;
  rotulo: string;
  /** Radicais do radar e cadeias do v2, em minúsculas. */
  radicais: string[];
  /** Quando presente, é subtema: a tela só o mostra com o pai marcado. */
  pai?: string;
}

/**
 * Prefixo curto demais casa com qualquer coisa. `tic` casaria com "ticket";
 * com quatro caracteres o risco vira desprezível, e radical curto continua
 * valendo por igualdade exata.
 */
const MIN_PREFIXO = 4;

export const TEMAS: Tema[] = [
  // ------------------------------------------------ primeiro nível: território
  { id: "regularizacao_fundiaria", rotulo: "Regularização fundiária", radicais: ["fundiári", "fundiari", "regulariza"] },
  { id: "habitacao", rotulo: "Habitação e moradia", radicais: ["habitaç", "habitac", "moradia"] },
  { id: "athis", rotulo: "ATHIS", radicais: ["athis"] },
  { id: "urbanizacao", rotulo: "Urbanização e cidades", radicais: ["urbaniz", "cidades"] },
  {
    id: "saneamento",
    rotulo: "Saneamento e segurança hídrica",
    radicais: ["saneamento", "segurança hídrica", "seguranca_hidrica", "seguranca hidrica"],
  },
  { id: "mobilidade", rotulo: "Mobilidade e logística", radicais: ["mobilidade"] },
  { id: "desenvolvimento_regional", rotulo: "Desenvolvimento regional", radicais: ["desenvolvimento regional", "desenvolvimento_regional"] },
  // Entrou em 15/09/2026 com os instrumentos do SICONV: prevenção de desastres é programa próprio do MIDR.
  { id: "defesa_civil", rotulo: "Defesa civil e desastres", radicais: ["defesa civil", "desastre"] },

  // ------------------------------------------------ primeiro nível: pessoas
  {
    id: "assistencia_social",
    rotulo: "Assistência social",
    radicais: ["assistência social", "assistencia social", "socioassist", "suas"],
  },
  { id: "saude", rotulo: "Saúde", radicais: ["saúde", "saude"] },
  { id: "educacao", rotulo: "Educação", radicais: ["educaç", "educac"] },
  { id: "cultura", rotulo: "Cultura e patrimônio", radicais: ["cultura", "patrimônio", "patrimonio"] },
  { id: "turismo", rotulo: "Turismo", radicais: ["turismo"] },
  // Entrou em 15/09/2026 com os instrumentos do SICONV: é o 3º tema em volume de convênios.
  { id: "esporte", rotulo: "Esporte e lazer", radicais: ["esporte", "esportiv", "lazer"] },

  // ------------------------------------------------ primeiro nível: economia
  { id: "economia_solidaria", rotulo: "Economia solidária", radicais: ["economia solidária", "economia solidaria"] },
  { id: "empreendedorismo", rotulo: "Empreendedorismo", radicais: ["empreendedor"] },
  { id: "agropecuaria", rotulo: "Agropecuária e agroindústria", radicais: ["agro", "agricultura", "agricola", "agrícola"] },
  { id: "energia", rotulo: "Energia", radicais: ["energia"] },
  {
    id: "meio_ambiente",
    rotulo: "Meio ambiente e clima",
    radicais: ["meio ambiente", "meio_ambiente", "clima", "sustentabilidade", "ambiental"],
  },

  // ------------------------------------------------ primeiro nível: conhecimento
  { id: "tecnologia", rotulo: "Tecnologia", radicais: ["tecnologia"] },
  { id: "inovacao", rotulo: "Inovação", radicais: ["inovaç", "inovac"] },

  // =============================================== subtemas de INOVAÇÃO
  // O vocabulário de fomento da Finep e do CNPq. Aparecem na tela só quando
  // `inovacao` está marcado — ver `subtemasDe`.
  {
    id: "subvencao_economica",
    rotulo: "Subvenção econômica",
    radicais: ["subvenç", "subvenc"],
    pai: "inovacao",
  },
  { id: "bioeconomia", rotulo: "Bioeconomia", radicais: ["bioeconomia"], pai: "inovacao" },
  { id: "biotecnologia", rotulo: "Biotecnologia", radicais: ["biotecnologia"], pai: "inovacao" },
  {
    id: "transformacao_digital",
    rotulo: "Transformação digital e TIC",
    radicais: ["transformação digital", "transformacao_digital", "tecnologias_digitais", "tic"],
    pai: "inovacao",
  },
  {
    id: "industria_4_0",
    rotulo: "Indústria 4.0",
    radicais: ["indústria 4.0", "industria 4.0", "industria_4_0"],
    pai: "inovacao",
  },
  {
    id: "materiais_avancados",
    rotulo: "Materiais avançados",
    radicais: ["materiais avançados", "industria_e_materiais", "indústria e materiais"],
    pai: "inovacao",
  },
  {
    id: "extrativas_minerais",
    rotulo: "Indústrias extrativas e minerais",
    radicais: ["industrias_extrativas", "indústrias extrativas", "extrativ"],
    pai: "inovacao",
  },
  { id: "descarbonizacao", rotulo: "Descarbonização", radicais: ["descarboniz"], pai: "inovacao" },
  {
    id: "espaco_defesa",
    rotulo: "Espaço, defesa e segurança",
    radicais: ["espaco_defesa", "espaço, defesa", "espaco defesa"],
    pai: "inovacao",
  },
  {
    id: "cooperacao_internacional",
    rotulo: "Cooperação internacional",
    radicais: ["cooperação internacional", "cooperacao_internacional", "cooperacao internacional"],
    pai: "inovacao",
  },
];

const POR_RADICAL = new Map<string, string>(
  TEMAS.flatMap((t) => t.radicais.map((r) => [r.toLowerCase(), t.id] as [string, string])),
);

const POR_ID = new Map<string, Tema>(TEMAS.map((t) => [t.id, t]));

export const ROTULO_TEMA: Record<string, string> = Object.fromEntries(TEMAS.map((t) => [t.id, t.rotulo]));

export function ehTemaConhecido(id: string): boolean {
  return Object.hasOwn(ROTULO_TEMA, id);
}

/** Os assuntos de primeiro nível, na ordem em que a tela os mostra. */
export const TEMAS_RAIZ: Tema[] = TEMAS.filter((t) => t.pai === undefined);

/** Os filhos de um assunto. Vazio para quem não tem. */
export function subtemasDe(id: string): Tema[] {
  return TEMAS.filter((t) => t.pai === id);
}

export function paiDe(id: string): string | null {
  return POR_ID.get(id)?.pai ?? null;
}

export function ehSubtema(id: string): boolean {
  return paiDe(id) !== null;
}

/**
 * Acrescenta os pais aos ids dados.
 *
 * É o que faz "marquei Inovação" alcançar uma janela marcada só como
 * `bioeconomia`. Sem isso, quem seguisse o assunto amplo perderia justamente as
 * janelas mais específicas dele — o contrário do que escolher um assunto amplo
 * significa.
 */
export function comAscendentes(ids: string[]): string[] {
  const todos = new Set<string>();
  for (const id of ids) {
    todos.add(id);
    const pai = paiDe(id);
    if (pai) todos.add(pai);
  }
  return TEMAS.filter((t) => todos.has(t.id)).map((t) => t.id);
}

/**
 * Radicais do contrato → ids de tema, sem repetição e na ordem de `TEMAS`.
 *
 * Radical desconhecido é ignorado, e não vira id novo: a lista que a pessoa vê
 * é fechada, e um radical solto na tela seria vazamento de dado interno. O
 * teste de cobertura falha se o radar ganhar um radical que este arquivo não
 * conhece.
 */
export function temasDaJanela(radicais: string[] | undefined): string[] {
  if (!radicais?.length) return [];
  const ids = new Set<string>();
  for (const r of radicais) {
    const id = POR_RADICAL.get(r.trim().toLowerCase());
    if (id) ids.add(id);
  }
  return TEMAS.filter((t) => ids.has(t.id)).map((t) => t.id);
}

/** Radicais que nenhum tema conhece. Usado pelo teste de cobertura. */
export function radicaisDesconhecidos(radicais: string[]): string[] {
  return radicais.filter((r) => !POR_RADICAL.has(r.trim().toLowerCase()));
}

/**
 * Um assunto a partir de uma cadeia SOLTA — o que o contrato v2 entrega.
 *
 * O v1.1 entrega radicais (`inovac`), e `temasDaJanela` casa por igualdade. O v2
 * não normaliza: no catálogo de 10/09/2026 `inovac` aparece 12 vezes e
 * `inovacao` 10, o mesmo assunto com duas grafias. Por isso aqui o casamento é
 * por PREFIXO depois de tentar o exato — é o que o radar faz ao procurar o
 * radical dentro do nome do programa.
 *
 * O prefixo só vale a partir de `MIN_PREFIXO` caracteres, e a busca percorre
 * `TEMAS` na ordem declarada: assunto mais específico primeiro quando dois
 * poderiam casar.
 *
 * Devolve null para o que nenhum assunto conhece. Nunca inventa id: a lista que
 * a pessoa vê é fechada.
 */
export function temaDeCadeia(cadeia: string): string | null {
  const c = cadeia.trim().toLowerCase();
  if (c === "") return null;

  const exato = POR_RADICAL.get(c);
  if (exato) return exato;

  for (const t of TEMAS) {
    for (const r of t.radicais) {
      if (r.length >= MIN_PREFIXO && c.startsWith(r)) return t.id;
    }
  }
  return null;
}
