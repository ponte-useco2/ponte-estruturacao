/**
 * Portal público das emendas, versão 2 do desenho (17/11/2026; `Site-Ponte/transparencia-emendas/IMPLEMENTACAO-V2.md`):
 * o RECORTE no endereço (dicionário do CONTRATO §11), os totais com a cobertura (ajuste A), a frase do período (ajuste
 * B), os instrumentos de cada emenda com a fonte oficial (ajuste C) e o arquivo do recorte. Lógica pura: sem banco e
 * sem Next. A leitura mora em `emendas-publico.server.ts`; o vocabulário comum e a privacidade, em `emendas-publico.ts`.
 *
 * O recorte vive no endereço (o "estado único" do protótipo, agora real): navegar, abrir um link compartilhado e baixar
 * o arquivo dão os mesmos registros e os mesmos totais, porque os três leem o mesmo endereço com `lerRecorte` e pedem ao
 * banco os mesmos argumentos (`argumentosDoRecorte`).
 */
import { paraCsv } from "./csv.ts";
import { dataBrasilia } from "./datas.ts";
import type { CanalEmenda, EnteTipoEmenda } from "./emendas.ts";
import {
  BASE_PORTAL,
  codigoLegivel,
  nomePublicoDoEnte,
  padroesDeTexto,
  rotuloEtapa,
  urlPortalEmenda,
  type CampoDicionario,
  type LinhaCatalogo,
  type LinhaPublica,
  type TipoEmenda,
} from "./emendas-publico.ts";
import { normalizarTexto } from "./tabela-filtro.ts";

// ================================================================ vocabulário (CONTRATO §4 e §11)

/** A forma de repasse com o nome do endereço (`canal=convenio|especial|saude|direto`). */
export type CanalPublico = "convenio" | "especial" | "saude" | "direto";
export const CANAIS_PUBLICOS: readonly CanalPublico[] = Object.freeze(["convenio", "especial", "saude", "direto"] as CanalPublico[]);
export const CANAL_DA_FONTE: Readonly<Record<CanalEmenda, CanalPublico>> = Object.freeze({
  convenio: "convenio",
  pix: "especial",
  fns: "saude",
  favorecido: "direto",
});
export const FONTE_DO_CANAL: Readonly<Record<CanalPublico, CanalEmenda>> = Object.freeze({
  convenio: "convenio",
  especial: "pix",
  saude: "fns",
  direto: "favorecido",
});
export const CANAL: Readonly<Record<CanalPublico, { nome: string; curto: string }>> = Object.freeze({
  convenio: { nome: "Convênio ou contrato de repasse", curto: "convênio" },
  especial: { nome: "Transferência especial", curto: "transferência especial" },
  saude: { nome: "Fundo a fundo (saúde)", curto: "fundo a fundo" },
  direto: { nome: "Pagamento direto ao favorecido", curto: "pagamento direto" },
});

/** Quem recebeu (`destinatario=prefeitura|fundos|osc|estado|empresas`), pelo tipo do ente. */
export type Destinatario = "prefeitura" | "fundos" | "osc" | "estado" | "empresas";
export const DESTINATARIOS: readonly Destinatario[] = Object.freeze(["prefeitura", "fundos", "osc", "estado", "empresas"] as Destinatario[]);
export const NOME_DESTINATARIO: Readonly<Record<Destinatario, string>> = Object.freeze({
  prefeitura: "Prefeitura",
  fundos: "Fundos municipais",
  osc: "OSC",
  estado: "Estado",
  empresas: "Empresas e outros",
});
/** Os tipos de ente de cada destinatário, como o banco filtra (`""` é o tipo não informado: vai com "outros"). */
export const ENTES_DO_DESTINATARIO: Readonly<Record<Destinatario, readonly string[]>> = Object.freeze({
  prefeitura: ["municipio"],
  fundos: ["fundo_municipal"],
  osc: ["osc"],
  estado: ["estado", "fundo_estadual"],
  empresas: ["empresa", "consorcio", "orgao_federal", "outro", ""],
});
export function destinatarioDoEnte(t: EnteTipoEmenda | string | null | undefined): Destinatario {
  for (const d of DESTINATARIOS) if (ENTES_DO_DESTINATARIO[d].includes(t ?? "")) return d;
  return "empresas";
}

/** O tipo da emenda no endereço (`tipo=individual-finalidade|individual-especial|bancada|comissao|relator`). */
export type TipoPublico = "individual-finalidade" | "individual-especial" | "bancada" | "comissao" | "relator" | "outro";
export const TIPOS_PUBLICOS: readonly TipoPublico[] = Object.freeze([
  "individual-finalidade", "individual-especial", "bancada", "comissao", "relator", "outro",
] as TipoPublico[]);
export const NOME_TIPO: Readonly<Record<TipoPublico, string>> = Object.freeze({
  "individual-finalidade": "Individual — finalidade definida",
  "individual-especial": "Individual — transferência especial",
  bancada: "Bancada",
  comissao: "Comissão",
  relator: "Relator",
  outro: "Outro",
});
export const tipoPublico = (t: TipoEmenda | null | undefined): TipoPublico | null => (t ? (t.replace("_", "-") as TipoPublico) : null);
const tipoDoBanco = (t: TipoPublico): string => t.replace("-", "_");

/** As palavras da ausência (CONTRATO §11): o que a fonte não traz, o que não se acha e o que não existe. */
export const NAO_INFORMADO = "não informado pela fonte";
export const NAO_LOCALIZADO = "não localizado na fonte";
export const NAO_SE_APLICA = "não se aplica";

/** A função de governo no endereço: sem acento, minúscula, com hífens (`funcao=assistencia-social`). */
export const FUNCAO_SEM_CATALOGO = "nao-localizado-na-fonte";
export function slugFuncao(f: string | null | undefined): string {
  const s = normalizarTexto(f ?? "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || FUNCAO_SEM_CATALOGO;
}
/** O valor que o banco compara (`oport_sem_acento(funcao)`): o slug com espaços; o "não localizado" é o nulo (`""`). */
export const funcaoNoBanco = (slug: string): string => (slug === FUNCAO_SEM_CATALOGO ? "" : slug.replace(/-/g, " "));

// ================================================================ textos: grafia (o que a fonte publica em maiúsculas)

const ACENTOS: Readonly<Record<string, string>> = Object.freeze({
  MUNICIPIO: "Município", MUNICIPAL: "Municipal", SAUDE: "Saúde", ASSISTENCIA: "Assistência", EDUCACAO: "Educação",
  ASSOCIACAO: "Associação", ORGANIZACAO: "Organização", SERTAO: "Sertão", CONSTRUCOES: "Construções", CONSTRUCAO: "Construção",
  COMERCIO: "Comércio", INDUSTRIA: "Indústria", PARAIBA: "Paraíba", JOAO: "João", SAO: "São", CONSORCIO: "Consórcio",
  FUNDACAO: "Fundação", INSTITUICAO: "Instituição", AGRICOLA: "Agrícola", PUBLICA: "Pública", PUBLICO: "Público",
  CIENCIA: "Ciência", CRIANCA: "Criança", ADOLESCENCIA: "Adolescência", FAMILIA: "Família", MEDICA: "Médica",
  SERVICOS: "Serviços", SERVICO: "Serviço", TECNICA: "Técnica", ACAO: "Ação", PROMOCAO: "Promoção", PROTECAO: "Proteção",
  HABITACAO: "Habitação", COMUNITARIA: "Comunitária", COMUNITARIO: "Comunitário", UNIAO: "União", NUCLEO: "Núcleo",
  GESTAO: "Gestão", SEGURANCA: "Segurança", PREVIDENCIA: "Previdência", DAMIAO: "Damião", REGO: "Rêgo",
  MINISTERIO: "Ministério", JOSE: "José", ANTONIO: "Antônio", FABIO: "Fábio", ANDRE: "André", ROGERIO: "Rogério",
  MARCIO: "Márcio", LEAO: "Leão", ARAUJO: "Araújo", INFORMATICA: "Informática", MEDICOS: "Médicos", SOLUCOES: "Soluções",
  POCO: "Poço", RIACHAO: "Riachão", DISTRIBUICAO: "Distribuição", COMUNICACAO: "Comunicação", FATIMA: "Fátima",
  GONCALVES: "Gonçalves", GUIMARAES: "Guimarães", MENDONCA: "Mendonça", LUCIO: "Lúcio", MAGALHAES: "Magalhães",
  SERGIO: "Sérgio", ESPIRITO: "Espírito", AGUA: "Água", SEBASTIAO: "Sebastião", CUITE: "Cuité", JUSTICA: "Justiça",
  EDUCACIONAL: "Educacional", AGROPECUARIA: "Agropecuária", FARMACIA: "Farmácia", ELETRICA: "Elétrica", PECAS: "Peças",
  VEICULOS: "Veículos", PEDAGOGICA: "Pedagógica",
});
const SIGLAS = new Set(["SOS", "FMAS", "FMS", "APAE", "ONG", "EPP", "EIRELI", "MEI", "CRAS", "CREAS", "CAPS", "UBS", "UPA", "SUS", "PB",
  "IFPB", "UFPB", "UEPB", "UFCG", "EMATER", "SENAI", "SESC", "SEBRAE", "CNPJ", "ME", "SA", "S/A"]);
const MINUSCULAS = new Set(["DA", "DE", "DO", "DAS", "DOS", "E", "A", "O", "AS", "OS", "AO", "AOS", "EM", "NA", "NO", "NAS", "NOS", "PARA", "POR"]);

/** "MUNICIPIO DE SAO BENTO" → "Município de São Bento": só para ler; texto que já tem minúscula fica como está. */
export function suavizar(t: string | null | undefined): string {
  if (!t) return "";
  if (/[a-zà-ÿ]/.test(t)) return t;
  return t
    .split(/(\s+)/)
    .map((w, i) => {
      if (!/[A-ZÀ-Ý]/.test(w)) return w;
      const limpo = w.replace(/[.,;:()]+$/, "").replace(/^[(]+/, "");
      const antes = w.slice(0, w.indexOf(limpo));
      const resto = w.slice(w.indexOf(limpo) + limpo.length);
      if (SIGLAS.has(limpo)) return w;
      if (ACENTOS[limpo]) return antes + ACENTOS[limpo] + resto;
      if (i > 0 && MINUSCULAS.has(limpo)) return antes + limpo.toLowerCase() + resto;
      if (limpo === "LTDA") return `${antes}Ltda${resto}`;
      if (limpo.length <= 2 || /\d/.test(limpo) || !/[AEIOUÁÉÍÓÚÂÊÔÃÕ]/.test(limpo)) return w;
      return antes + limpo.charAt(0) + limpo.slice(1).toLowerCase() + resto;
    })
    .join("");
}

/** Os nomes das autorias coletivas e de Patos, como o desenho grafou (o arquivo do Portal publica em maiúsculas). */
const NOME_AUTORIA: Readonly<Record<string, string>> = Object.freeze({
  "7116": "Bancada da Paraíba", "2712": "Hugo Motta", "6011": "Comissão de Desenvolvimento Regional e Turismo", "5041": "Comissão de Saúde",
  "3530": "Damião Feliciano", "5007": "Comissão de Turismo", "1271": "Luiz Couto", "4317": "Cabo Gilberto Silva",
  "5049": "Comissão de Previdência, Assistência Social, Infância, Adolescência e Família", "4432": "Mersinho Lucena",
  "4088": "Veneziano Vital do Rêgo", "5006": "Comissão do Esporte",
});
export function nomeDaAutoria(codigo: string | null | undefined, nome: string | null | undefined): string {
  if (codigo && NOME_AUTORIA[codigo]) return NOME_AUTORIA[codigo];
  return nome ? suavizar(nome) : NAO_LOCALIZADO;
}

// ================================================================ números

const N2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const N1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const N0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const menos = (v: number) => (v < 0 ? "−" : "");

/** "R$ 10.280.311,30": o valor exato. */
export const rs = (v: number): string => `${menos(v)}R$ ${N2.format(Math.abs(v))}`;
/** "R$ 44,13 mi", "R$ 4,09 bi", "R$ 966,6 mil": o valor curto; zero é "R$ 0,00" (zero é valor). */
export function comp(v: number): string {
  const a = Math.abs(v);
  if (v === 0) return "R$ 0,00";
  if (a >= 1e9) return `${menos(v)}R$ ${N2.format(a / 1e9)} bi`;
  if (a >= 1e6) return `${menos(v)}R$ ${N2.format(a / 1e6)} mi`;
  if (a >= 1e3) return `${menos(v)}R$ ${N1.format(a / 1e3)} mil`;
  return rs(v);
}
export const inteiroPt = (n: number): string => N0.format(n);
/** "1 registro", "44 registros". */
export const plural = (n: number, um: string, varios: string): string => `${inteiroPt(n)} ${n === 1 ? um : varios}`;
export const porcento = (fracao: number): string => `${N1.format(fracao * 100)}%`;

// ================================================================ o período (ajuste B: é o ANO DA EMENDA)

export interface Periodo {
  de: number;
  ate: number;
}
/** O percurso cobre as emendas de 2019 em diante (CONTRATO §12: canais conferidos quanto à sobreposição). */
export const ANO_INICIAL_PERCURSO = 2019;

/** O ano de hoje em Brasília: o teto do período. */
export function anoAtualBrasilia(agora = Date.now()): number {
  return new Date(agora - 3 * 3600 * 1000).getUTCFullYear();
}

/** O padrão e as três opções do seletor: os quatro anos mais recentes, os quatro anteriores e a série toda. */
export function periodosDoSeletor(anoMax: number): { id: string; rotulo: string; periodo: Periodo }[] {
  const recente = { de: Math.max(ANO_INICIAL_PERCURSO, anoMax - 3), ate: anoMax };
  const anterior = { de: Math.max(ANO_INICIAL_PERCURSO, anoMax - 7), ate: Math.max(ANO_INICIAL_PERCURSO, anoMax - 4) };
  const serie = { de: ANO_INICIAL_PERCURSO, ate: anoMax };
  return [
    { id: textoPeriodoUrl(recente), rotulo: textoPeriodo(recente), periodo: recente },
    { id: textoPeriodoUrl(anterior), rotulo: textoPeriodo(anterior), periodo: anterior },
    { id: textoPeriodoUrl(serie), rotulo: `Toda a série (${textoPeriodo(serie)})`, periodo: serie },
  ];
}
export const periodoPadrao = (anoMax: number): Periodo => periodosDoSeletor(anoMax)[0].periodo;

/** `periodo=2023-2026` (ou `2024`): fora do formato vira o padrão; fora dos limites, o limite; invertido, desvirado. */
export function lerPeriodo(v: string | null | undefined, anoMax: number): Periodo {
  const m = /^(\d{4})(?:-(\d{4}))?$/.exec((v ?? "").trim());
  if (!m) return periodoPadrao(anoMax);
  const limita = (n: number) => Math.min(anoMax, Math.max(ANO_INICIAL_PERCURSO, n));
  let de = limita(Number(m[1]));
  let ate = limita(Number(m[2] ?? m[1]));
  if (de > ate) [de, ate] = [ate, de];
  return { de, ate };
}
/**
 * O período pedido no endereço: `periodo=2023-2026` ou, do formulário "Personalizado" (que funciona sem JavaScript),
 * `ano_de=2020&ano_ate=2024` (a página redireciona para o endereço canônico, com `periodo`).
 */
export function periodoDoEndereco(sp: URLSearchParams): string | null {
  const p = sp.get("periodo");
  if (p) return p;
  const de = sp.get("ano_de");
  const ate = sp.get("ano_ate");
  return de ? `${de}-${ate || de}` : ate || null;
}
export const temPeriodoDoFormulario = (sp: URLSearchParams): boolean => sp.has("ano_de") || sp.has("ano_ate");

export const textoPeriodoUrl = (p: Periodo): string => (p.de === p.ate ? String(p.de) : `${p.de}-${p.ate}`);
/** "2023–2026" ou "2024". */
export const textoPeriodo = (p: Periodo): string => (p.de === p.ate ? String(p.de) : `${p.de}–${p.ate}`);
/** "Emendas de 2023 a 2026" ou "Emendas de 2024". */
export const emendasDoPeriodo = (p: Periodo): string => (p.de === p.ate ? `Emendas de ${p.de}` : `Emendas de ${p.de} a ${p.ate}`);
export const mesmoPeriodo = (a: Periodo, b: Periodo): boolean => a.de === b.de && a.ate === b.ate;

/**
 * A frase do ajuste B: o período é o ano da emenda e o realizado é acumulado até a data de referência.
 * "Emendas de 2023 a 2026: R$ 44,13 mi pagos a destinatários em Patos até 13/11/2026".
 */
export function fraseDoRealizado(p: Periodo, realizado: number, onde: string, dadoAte: string | null): string {
  const ate = dataBrasilia(dadoAte, "");
  return `${emendasDoPeriodo(p)}: ${comp(realizado)} pagos a destinatários ${onde}${ate ? ` até ${ate}` : ""}`;
}
/** "emendas de 2023 a 2026; valores até 13/11/2026": o mesmo cuidado nos arquivos e nas legendas. */
export function notaDoPeriodo(p: Periodo, dadoAte: string | null): string {
  const ate = dataBrasilia(dadoAte, "");
  return `${emendasDoPeriodo(p).toLowerCase()}; valores até ${ate || "a data de referência"}`;
}

// ================================================================ o recorte no endereço (CONTRATO §11)

export type CampoOrdem =
  | "codigo" | "ano" | "autoria" | "tipo" | "canal" | "destinatario" | "finalidade" | "previsto" | "empenhado" | "realizado" | "situacao";
/** As colunas da tabela de registros, na ordem da tela; toda coluna ordena. */
export const COLUNAS_REGISTROS: readonly { campo: CampoOrdem; titulo: string; numerica?: boolean }[] = Object.freeze([
  { campo: "codigo", titulo: "Emenda" },
  { campo: "ano", titulo: "Ano" },
  { campo: "autoria", titulo: "Autoria" },
  { campo: "tipo", titulo: "Tipo" },
  { campo: "canal", titulo: "Forma de repasse" },
  { campo: "destinatario", titulo: "Destinatário" },
  { campo: "finalidade", titulo: "Finalidade" },
  { campo: "previsto", titulo: "Previsto", numerica: true },
  { campo: "empenhado", titulo: "Empenhado", numerica: true },
  { campo: "realizado", titulo: "Realizado", numerica: true },
  { campo: "situacao", titulo: "Situação" },
]);
const CAMPOS_ORDEM = new Set<string>(COLUNAS_REGISTROS.map((c) => c.campo));
const ORDEM_NO_BANCO: Readonly<Record<CampoOrdem, string>> = Object.freeze({
  codigo: "codigo", ano: "ano", autoria: "autor", tipo: "tipo", canal: "canal", destinatario: "ente", finalidade: "objeto",
  previsto: "previsto", empenhado: "empenhado", realizado: "pago", situacao: "situacao",
});
export const nomeDaColuna = (c: CampoOrdem): string => (COLUNAS_REGISTROS.find((x) => x.campo === c)?.titulo ?? c).toLowerCase();
export const colunaNumerica = (c: CampoOrdem): boolean => !!COLUNAS_REGISTROS.find((x) => x.campo === c)?.numerica;

export interface Ordem {
  campo: CampoOrdem;
  desc: boolean;
}
/** Ordem padrão da tabela: por código da emenda, crescente (V2-ESPEC). */
export const ORDEM_PADRAO: Ordem = Object.freeze({ campo: "codigo", desc: false }) as Ordem;
export const POR_PAGINA_PADRAO = 20;
const POR_PERMITIDOS = [10, 20, 50, 100];
const MAX_VALORES = 30;
const MAX_BUSCA = 200;

export interface Recorte {
  municipio: string | null;
  periodo: Periodo;
  canal: CanalPublico[];
  destinatario: Destinatario[];
  funcao: string[];
  tipo: TipoPublico[];
  autoria: string[];
  ano: number[];
  q: string;
  ordem: Ordem;
  pagina: number;
  por: number;
}

export function recorteVazio(periodo: Periodo, municipio: string | null = null): Recorte {
  return { municipio, periodo, canal: [], destinatario: [], funcao: [], tipo: [], autoria: [], ano: [], q: "", ordem: { ...ORDEM_PADRAO }, pagina: 1, por: POR_PAGINA_PADRAO };
}

function valores(sp: URLSearchParams, nome: string): string[] {
  const vs = sp.getAll(nome).flatMap((v) => v.split(",")).map((v) => v.trim()).filter((v) => v !== "");
  return [...new Set(vs)].slice(0, MAX_VALORES);
}
const naOrdemDe = <T extends string>(lista: readonly T[], vs: readonly string[]): T[] => lista.filter((x) => vs.includes(x));

export const ibgeValido = (v: string | null | undefined): string | null => (typeof v === "string" && /^25\d{5}$/.test(v) ? v : null);

export function lerOrdem(v: string | null | undefined): Ordem {
  const m = /^(-)?([a-z]+)$/.exec((v ?? "").trim());
  if (!m || !CAMPOS_ORDEM.has(m[2])) return { ...ORDEM_PADRAO };
  return { campo: m[2] as CampoOrdem, desc: m[1] === "-" };
}
export const textoOrdem = (o: Ordem): string => `${o.desc ? "-" : ""}${o.campo}`;
export const ordemPadrao = (o: Ordem): boolean => o.campo === ORDEM_PADRAO.campo && o.desc === ORDEM_PADRAO.desc;

export function limparBusca(q: string | null | undefined): string {
  return (q ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_BUSCA);
}

/** O recorte de um endereço. Valor fora do dicionário cai fora (nunca vira erro): o endereço velho ainda abre. */
export function lerRecorte(sp: URLSearchParams, anoMax: number): Recorte {
  const periodo = lerPeriodo(periodoDoEndereco(sp), anoMax);
  const pagina = Number(sp.get("pagina"));
  const por = Number(sp.get("por"));
  return {
    municipio: ibgeValido(sp.get("municipio")),
    periodo,
    canal: naOrdemDe(CANAIS_PUBLICOS, valores(sp, "canal")),
    destinatario: naOrdemDe(DESTINATARIOS, valores(sp, "destinatario")),
    funcao: valores(sp, "funcao").filter((v) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length <= 60).sort(),
    tipo: naOrdemDe(TIPOS_PUBLICOS, valores(sp, "tipo")),
    autoria: valores(sp, "autoria").filter((v) => /^\d{4}$/.test(v)).sort(),
    ano: valores(sp, "ano").map(Number).filter((n) => Number.isInteger(n) && n >= periodo.de && n <= periodo.ate).sort((a, b) => a - b),
    q: limparBusca(sp.get("q")),
    ordem: lerOrdem(sp.get("ordem")),
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 100_000 ? pagina : 1,
    por: POR_PERMITIDOS.includes(por) ? por : POR_PAGINA_PADRAO,
  };
}

/**
 * A consulta canônica do recorte, na ordem do dicionário: `municipio`, `periodo`, os filtros, `q`, `ordem` (fora do
 * padrão), `pagina` (depois da 1ª) e `por` (fora de 20). O mesmo recorte dá sempre o mesmo endereço.
 */
export function consultaDoRecorte(r: Recorte, o: { pagina?: boolean } = {}): string {
  const ps: string[] = [];
  const lista = (nome: string, vs: readonly (string | number)[]) => {
    if (vs.length) ps.push(`${nome}=${vs.map((v) => encodeURIComponent(String(v))).join(",")}`);
  };
  if (r.municipio) ps.push(`municipio=${r.municipio}`);
  ps.push(`periodo=${textoPeriodoUrl(r.periodo)}`);
  lista("canal", r.canal);
  lista("destinatario", r.destinatario);
  lista("funcao", r.funcao);
  lista("tipo", r.tipo);
  lista("autoria", r.autoria);
  lista("ano", r.ano);
  if (r.q) ps.push(`q=${encodeURIComponent(r.q)}`);
  if (!ordemPadrao(r.ordem)) ps.push(`ordem=${textoOrdem(r.ordem)}`);
  if (o.pagina !== false) {
    if (r.pagina > 1) ps.push(`pagina=${r.pagina}`);
    if (r.por !== POR_PAGINA_PADRAO) ps.push(`por=${r.por}`);
  }
  return ps.join("&");
}

export const URL_REGISTROS = `${BASE_PORTAL}/registros`;
export const urlRegistros = (r: Recorte): string => `${URL_REGISTROS}?${consultaDoRecorte(r)}`;
/** O arquivo do recorte: os mesmos parâmetros (e a mesma ordem), o recorte INTEIRO (sem página). */
export const urlExportacao = (r: Recorte, formato: "csv" | "json"): string =>
  `${BASE_PORTAL}/dados/recorte.${formato}?${consultaDoRecorte(r, { pagina: false })}`;
export const urlMunicipio = (ibge: string, p: Periodo): string => `${BASE_PORTAL}/municipios/${ibge}?periodo=${textoPeriodoUrl(p)}`;
export const urlInicio = (p: Periodo, ibge: string | null = null): string =>
  `${BASE_PORTAL}?periodo=${textoPeriodoUrl(p)}${ibge ? `&municipio=${ibge}` : ""}`;
/** A ficha, com o recorte de origem (`de`) para a volta. */
export const urlFicha = (codigo: string, de: string | null): string =>
  `${BASE_PORTAL}/emenda/${encodeURIComponent(codigo)}${de ? `?de=${encodeURIComponent(de)}` : ""}`;
/** A âncora de uma linha da tabela de registros: a volta da ficha devolve o foco a ela. */
export const ancoraDaLinha = (linha: number): string => `linha-${linha}`;

/** O recorte com uma mudança; mexer em filtro, período ou ordem volta à página 1. */
export function mudar(r: Recorte, m: Partial<Recorte>): Recorte {
  const novo = { ...r, ...m };
  if (!("pagina" in m)) novo.pagina = 1;
  if (m.periodo) novo.ano = novo.ano.filter((a) => a >= novo.periodo.de && a <= novo.periodo.ate);
  return novo;
}
export const quantosFiltros = (r: Recorte): number =>
  r.canal.length + r.destinatario.length + r.funcao.length + r.tipo.length + r.autoria.length + r.ano.length + (r.q ? 1 : 0);

/** Os argumentos de `emd_pub_linhas` (oport_68) para o recorte: só vai o que filtra. */
export function argumentosDoRecorte(r: Recorte, faixa: { limite: number; deslocamento: number }): Record<string, unknown> {
  const a: Record<string, unknown> = { p_ano_de: r.periodo.de, p_ano_ate: r.periodo.ate };
  if (r.municipio) a.p_ibge = r.municipio;
  if (r.canal.length) a.p_canal = r.canal.map((c) => FONTE_DO_CANAL[c]);
  if (r.destinatario.length) a.p_ente_tipo = [...new Set(r.destinatario.flatMap((d) => ENTES_DO_DESTINATARIO[d]))];
  if (r.funcao.length) a.p_funcao = r.funcao.map(funcaoNoBanco);
  if (r.tipo.length) a.p_tipo = r.tipo.map(tipoDoBanco);
  if (r.autoria.length) a.p_autores = r.autoria;
  if (r.ano.length) a.p_anos = r.ano;
  const busca = padroesDeTexto(r.q);
  if (busca) a.p_busca = busca;
  a.p_ordem = ORDEM_NO_BANCO[r.ordem.campo];
  a.p_desc = r.ordem.desc;
  a.p_limite = faixa.limite;
  a.p_deslocamento = faixa.deslocamento;
  return a;
}
/** Os argumentos de `emd_pub_facetas` (oport_68): os mesmos filtros do recorte, sem ordem nem página. */
export function argumentosDasFacetas(r: Recorte): Record<string, unknown> {
  const a = argumentosDoRecorte(r, { limite: 1, deslocamento: 0 });
  delete a.p_ordem;
  delete a.p_desc;
  delete a.p_limite;
  delete a.p_deslocamento;
  return a;
}
export const faixaDaPagina = (r: Recorte): { limite: number; deslocamento: number } => ({ limite: r.por, deslocamento: (r.pagina - 1) * r.por });

/**
 * Os endereços velhos da lista (`/emendas/lista?q=…&t.emendas.forma=…&t.emendas.o=pago.desc`) no dicionário novo: a
 * busca, a forma de repasse, o tipo e a ordem por valor passam; a lista velha não tinha período: vai a série toda.
 */
export function recorteDaListaAntiga(sp: URLSearchParams, anoMax: number): Recorte {
  const r = lerRecorte(sp, anoMax);
  if (!sp.get("periodo")) r.periodo = { de: ANO_INICIAL_PERCURSO, ate: anoMax };
  const velho = (nome: string) => sp.getAll(`t.emendas.${nome}`).flatMap((v) => v.split("|")).map((v) => normalizarTexto(v));
  const formas: Record<string, CanalPublico> = {
    [normalizarTexto("Convênio ou contrato de repasse")]: "convenio",
    [normalizarTexto("Transferência especial")]: "especial",
    [normalizarTexto("Fundo a fundo (saúde)")]: "saude",
    [normalizarTexto("Pagamento direto ao favorecido")]: "direto",
  };
  const tipos: Record<string, TipoPublico> = {
    [normalizarTexto("Individual, com finalidade definida")]: "individual-finalidade",
    [normalizarTexto("Individual, transferência especial")]: "individual-especial",
    bancada: "bancada",
    [normalizarTexto("Comissão")]: "comissao",
    [normalizarTexto("Relator-geral")]: "relator",
  };
  if (!r.canal.length) r.canal = naOrdemDe(CANAIS_PUBLICOS, velho("forma").map((v) => formas[v]).filter(Boolean));
  if (!r.tipo.length) r.tipo = naOrdemDe(TIPOS_PUBLICOS, velho("tipo").map((v) => tipos[v]).filter(Boolean));
  const o = /^([a-z]+)\.(asc|desc)$/.exec(sp.get("t.emendas.o") ?? "");
  const ordens: Record<string, CampoOrdem> = { pago: "realizado", previsto: "previsto", ano: "ano", emenda: "codigo", autor: "autoria" };
  if (o && ordens[o[1]] && !sp.get("ordem")) r.ordem = { campo: ordens[o[1]], desc: o[2] === "desc" };
  r.pagina = 1;
  return r;
}

// ================================================================ a volta da ficha (`de`), sem redirecionamento aberto

/**
 * O caminho de origem que a ficha aceita: só dentro do portal (`/emendas`, `/emendas/…` ou `/emendas?…`), sem esquema,
 * sem `//`, sem `\`, sem `.`/`..` como segmento, sem caractere de controle. Qualquer outra coisa é ignorada (null).
 */
export function deSeguro(v: string | null | undefined): string | null {
  if (typeof v !== "string" || v.length === 0 || v.length > 2000) return null;
  if (!(v === BASE_PORTAL || v.startsWith(`${BASE_PORTAL}/`) || v.startsWith(`${BASE_PORTAL}?`) || v.startsWith(`${BASE_PORTAL}#`))) return null;
  if (v.includes("//") || v.includes("\\") || /[\u0000-\u001f\u007f\s]/.test(v)) return null;
  const caminho = v.split(/[?#]/)[0];
  if (/(^|\/)(\.|\.\.|%2e|%2e%2e|\.%2e|%2e\.)(\/|$)/i.test(caminho)) return null;
  return v;
}

export type Origem =
  | { tela: "registros"; recorte: Recorte; foco: number | null; caminho: string }
  | { tela: "municipio"; ibge: string; periodo: Periodo; caminho: string }
  | { tela: "inicio"; caminho: string }
  | { tela: "outra"; caminho: string };

/** O que a ficha sabe do recorte de origem: a tela, o município e o período (para o destaque e o rótulo da volta). */
export function lerOrigem(de: string | null, anoMax: number): Origem | null {
  const c = deSeguro(de);
  if (!c) return null;
  const u = new URL(c, "https://exemplo.invalido");
  const foco = /^#linha-(\d{1,9})$/.exec(u.hash);
  if (u.pathname === URL_REGISTROS) return { tela: "registros", recorte: lerRecorte(u.searchParams, anoMax), foco: foco ? Number(foco[1]) : null, caminho: c };
  const m = /^\/emendas\/municipios\/(25\d{5})$/.exec(u.pathname);
  if (m) return { tela: "municipio", ibge: m[1], periodo: lerPeriodo(u.searchParams.get("periodo"), anoMax), caminho: c };
  if (u.pathname === BASE_PORTAL) return { tela: "inicio", caminho: c };
  return { tela: "outra", caminho: c };
}

/** "← Voltar aos registros de Patos (1 filtro, ordem: realizado decrescente)". */
export function rotuloDaVolta(o: Origem | null, nomeDoMunicipio: (ibge: string) => string | null): string {
  if (!o) return "← Voltar ao início";
  if (o.tela === "registros") {
    const r = o.recorte;
    const onde = r.municipio ? `de ${nomeDoMunicipio(r.municipio) ?? r.municipio}` : "da Paraíba";
    const n = quantosFiltros(r);
    const filtros = n ? plural(n, "filtro", "filtros") : "sem filtros";
    return `← Voltar aos registros ${onde} (${filtros}, ordem: ${nomeDaColuna(r.ordem.campo)}${r.ordem.desc ? " decrescente" : ""})`;
  }
  if (o.tela === "municipio") return `← Voltar a ${nomeDoMunicipio(o.ibge) ?? o.ibge}`;
  if (o.tela === "inicio") return "← Voltar ao início";
  return "← Voltar";
}

// ================================================================ os totais com a cobertura (ajuste A)

export interface Soma {
  registros: number;
  emendas: number;
  previsto: number;
  comPrevisto: number;
  empenhado: number;
  comEmpenhado: number;
  realizado: number;
}
export const SOMA_ZERO: Soma = Object.freeze({ registros: 0, emendas: 0, previsto: 0, comPrevisto: 0, empenhado: 0, comEmpenhado: 0, realizado: 0 });

/** A soma de registros, com nulo que NÃO vira zero: `comPrevisto` e `comEmpenhado` contam só quem tem a medida. */
export function somar(rs_: readonly Pick<LinhaPublica, "codigo" | "previsto" | "empenhado" | "pago">[]): Soma {
  const s = { ...SOMA_ZERO };
  const cods = new Set<string>();
  for (const r of rs_) {
    s.registros += 1;
    if (r.previsto !== null && r.previsto !== undefined) {
      s.previsto += r.previsto;
      s.comPrevisto += 1;
    }
    if (r.empenhado !== null && r.empenhado !== undefined) {
      s.empenhado += r.empenhado;
      s.comEmpenhado += 1;
    }
    s.realizado += r.pago;
    if (r.codigo) cods.add(r.codigo);
  }
  s.emendas = cods.size;
  s.previsto = arred(s.previsto);
  s.empenhado = arred(s.empenhado);
  s.realizado = arred(s.realizado);
  return s;
}
const arred = (v: number) => Math.round(v * 100) / 100;

export interface Coberto {
  /** O valor curto (ou "não informado pela fonte" quando nenhum registro tem a medida). */
  valor: string;
  /** O valor exato. */
  exato: string | null;
  /** "em 32 dos 44 registros" quando a cobertura é parcial; null quando é total. */
  cobertura: string | null;
  /** Por que falta: "o pagamento direto não traz previsto na fonte". */
  porque: string | null;
  ausente: boolean;
}

function coberto(valor: number, com: number, de: number, porque: string | null): Coberto {
  if (de === 0) return { valor: "nenhum registro", exato: null, cobertura: null, porque: null, ausente: true };
  if (com === 0) return { valor: NAO_INFORMADO, exato: null, cobertura: `nenhum dos ${inteiroPt(de)} registros tem o campo`, porque, ausente: true };
  if (com === de) return { valor: comp(valor), exato: rs(valor), cobertura: null, porque: null, ausente: false };
  return { valor: comp(valor), exato: rs(valor), cobertura: `em ${inteiroPt(com)} ${de === 1 ? "de" : "dos"} ${inteiroPt(de)} registros`, porque, ausente: false };
}

/**
 * Previsto e empenhado com a cobertura. O motivo é estrutural (oport_39): o pagamento direto não traz previsto; o fundo a
 * fundo e o pagamento direto não trazem empenho. Com o filtro de forma de repasse, o motivo cita só as do filtro.
 */
export function coberturas(s: Soma, canais: readonly CanalPublico[] = []): { previsto: Coberto; empenhado: Coberto } {
  const tem = (c: CanalPublico) => canais.length === 0 || canais.includes(c);
  const semEmp = (["saude", "direto"] as CanalPublico[]).filter(tem).map((c) => (c === "saude" ? "o fundo a fundo" : "o pagamento direto"));
  return {
    previsto: coberto(s.previsto, s.comPrevisto, s.registros, tem("direto") ? "o pagamento direto não traz previsto na fonte" : null),
    empenhado: coberto(
      s.empenhado,
      s.comEmpenhado,
      s.registros,
      semEmp.length ? `${semEmp.join(" e ")} ${semEmp.length > 1 ? "não trazem" : "não traz"} empenho` : null,
    ),
  };
}
/** "Previsto: R$ 59,79 mi em 32 dos 44 registros · o pagamento direto não traz previsto na fonte". */
export function fraseDaCobertura(rotulo: string, c: Coberto): string {
  return [`${rotulo}: ${c.valor}${c.cobertura && !c.ausente ? ` ${c.cobertura}` : ""}`, c.ausente ? c.cobertura : null, c.porque].filter(Boolean).join(" · ");
}
/** A execução física: "registrada em 4 dos 6 convênios". */
export function coberturaDoFisico(com: number, convenios: number): string {
  if (convenios === 0) return `${NAO_SE_APLICA}: nenhum convênio`;
  if (com === 0) return `${NAO_INFORMADO} em nenhum dos ${inteiroPt(convenios)} ${convenios === 1 ? "convênio" : "convênios"}`;
  return `registrada em ${inteiroPt(com)} ${convenios === 1 ? "de" : "dos"} ${plural(convenios, "convênio", "convênios")}`;
}
/** As emendas sem o catálogo do Portal (tipo e função): "tipo e função não localizados na fonte para 3 emendas de 2026". */
export function fraseSemCatalogo(porAno: readonly { ano: number; emendas: number }[]): string | null {
  const xs = porAno.filter((x) => x.emendas > 0);
  if (!xs.length) return null;
  return `Tipo e função ${NAO_LOCALIZADO.replace("localizado", "localizados")} para ${xs.map((x) => `${plural(x.emendas, "emenda", "emendas")} de ${x.ano}`).join(", ")}.`;
}

// ================================================================ o registro como a tela e o arquivo mostram

export const FONTE_DA_FINALIDADE: Readonly<Record<string, string>> = Object.freeze({
  convenio: "Objeto do instrumento",
  plano_acao: "Objeto do plano de ação",
  proposta_fns: "Tipo de proposta (FNS)",
  acao_orcamentaria: "Ação orçamentária",
});
const SITUACAO_DA_FONTE: Readonly<Record<string, string>> = Object.freeze({
  CIENTE: "Ciente",
  AGUARDANDO_CIENCIA: "Aguardando ciência",
  IMPEDIDO: "Impedido",
  IMPEDIDO_REJEICAO_PLANO_TRABALHO: "Impedido: plano de trabalho rejeitado",
  "PLANO DE TRABALHO EM ELABORAÇÃO/AGUARDANDO ENVIO PARA ANÁLISE": "Plano de trabalho em elaboração ou aguardando envio para análise",
});

/** A situação numa etiqueta só: o "caducou" com a data; senão a situação da fonte; senão a etapa. */
export function situacaoDoRegistro(l: Pick<LinhaPublica, "etapa" | "situacao" | "ano">): string {
  if (l.etapa === "caducou") return rotuloEtapa("caducou", l.ano);
  const s = (l.situacao ?? "").trim();
  if (s) return SITUACAO_DA_FONTE[s] ?? (/[a-z]/.test(s) ? s : suavizar(s));
  return l.etapa ? rotuloEtapa(l.etapa, l.ano) : NAO_INFORMADO;
}

/** O nome do destinatário para ler: a prefeitura vira "Município de Patos"; o resto, suavizado (o MEI já vem omitido). */
export function nomeDoDestinatario(l: Pick<LinhaPublica, "ente_tipo" | "ente_nome" | "municipio" | "ibge">): string {
  const nome = nomePublicoDoEnte(l.ente_nome);
  if (l.ente_tipo === "municipio" && l.municipio && (!nome || /^MUNIC[IÍ]PIO/i.test(nome))) return `Município de ${l.municipio}`;
  return nome ? suavizar(nome) : NAO_INFORMADO;
}

/** O rótulo do número do instrumento: "Instrumento nº 960337", "Plano de ação nº 65837", "Proposta nº …", "CNPJ …". */
export function rotuloDoInstrumento(l: Pick<LinhaPublica, "canal" | "instrumento" | "ente_cnpj">): string {
  const c = CANAL_DA_FONTE[l.canal];
  if (c === "convenio") return `Instrumento nº ${l.instrumento}`;
  if (c === "especial") return `Plano de ação nº ${l.instrumento}`;
  if (c === "saude") return `Proposta nº ${l.instrumento}`;
  return `CNPJ ${cnpjLegivel(l.ente_cnpj ?? l.instrumento)}`;
}
export const cnpjLegivel = (c: string | null | undefined): string =>
  c && /^\d{14}$/.test(c) ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (c ?? "");

/** A fonte oficial de cada instrumento (conferidos pelo titular em 17/11/2026: os dois primeiros abrem direto). */
export interface FonteOficial {
  texto: string;
  href: string;
  /** O número a consultar, escrito ao lado (a fonte não tem endereço direto para ele). */
  numero: string | null;
}
export const urlTransferegovConvenio = (n: string): string =>
  `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?sequencialConvenio=${encodeURIComponent(n)}&Usr=guest&Pwd=guest`;
export const URL_ESPECIAIS = "https://especiais.transferegov.sistema.gov.br/";
export const URL_FNS = "https://consultafns.saude.gov.br/";
export function fonteDoInstrumento(l: Pick<LinhaPublica, "canal" | "instrumento" | "codigo">): FonteOficial {
  const c = CANAL_DA_FONTE[l.canal];
  if (c === "convenio") return { texto: `Transferegov: convênio nº ${l.instrumento}`, href: urlTransferegovConvenio(l.instrumento), numero: null };
  if (c === "especial") return { texto: `Consulte o plano de ação nº ${l.instrumento}`, href: URL_ESPECIAIS, numero: l.instrumento };
  if (c === "saude") return { texto: `Consulte a proposta nº ${l.instrumento}`, href: URL_FNS, numero: l.instrumento };
  return l.codigo
    ? { texto: "Portal da Transparência: favorecidos da emenda", href: urlPortalEmenda(l.codigo), numero: null }
    : { texto: "Portal da Transparência", href: "https://portaldatransparencia.gov.br/emendas", numero: null };
}

/** Um registro como a tabela, o cartão e o arquivo do recorte mostram. */
export interface Registro {
  linha: number;
  codigo: string | null;
  codigoLegivel: string;
  ano: number | null;
  anoPagamento: number | null;
  autoria: string;
  autoriaCodigo: string | null;
  coletiva: boolean;
  tipo: string;
  canal: CanalPublico;
  canalNome: string;
  instrumento: string;
  instrumentoRotulo: string;
  destinatario: string;
  destinatarioGrupo: Destinatario;
  cnpj: string | null;
  municipio: string | null;
  ibge: string | null;
  funcao: string | null;
  finalidadeFonte: string;
  finalidade: string | null;
  previsto: number | null;
  empenhado: number | null;
  realizado: number;
  situacao: string;
  /** "campo: motivo", um por campo sem dado (CONTRATO §11). Zero é valor: não entra. */
  ausencias: string[];
}

export function registroDaLinha(l: LinhaPublica): Registro {
  const canal = CANAL_DA_FONTE[l.canal];
  const ausencias: string[] = [];
  if (l.previsto === null) ausencias.push(`previsto: ${NAO_INFORMADO}`);
  if (l.empenhado === null) ausencias.push(`empenhado: ${NAO_INFORMADO}`);
  if (!l.objeto) ausencias.push(`finalidade: ${NAO_INFORMADO}`);
  if (!l.autor_nome && !l.autor_codigo) ausencias.push(`autoria: ${NAO_LOCALIZADO}`);
  if (!l.no_catalogo) ausencias.push(`tipo e função: ${NAO_LOCALIZADO}`);
  const t = tipoPublico(l.tipo);
  return {
    linha: l.linha,
    codigo: l.codigo,
    codigoLegivel: l.codigo ? codigoLegivel(l.codigo) : NAO_LOCALIZADO,
    ano: l.ano,
    anoPagamento: canal === "direto" ? l.ano_pagamento : null,
    autoria: nomeDaAutoria(l.autor_codigo, l.autor_nome),
    autoriaCodigo: l.autor_codigo,
    coletiva: l.coletivo,
    tipo: t ? NOME_TIPO[t] : NAO_LOCALIZADO,
    canal,
    canalNome: CANAL[canal].nome,
    instrumento: l.instrumento,
    instrumentoRotulo: rotuloDoInstrumento(l),
    destinatario: nomeDoDestinatario(l),
    destinatarioGrupo: destinatarioDoEnte(l.ente_tipo),
    cnpj: l.ente_cnpj,
    municipio: l.municipio,
    ibge: l.ibge,
    funcao: l.funcao,
    finalidadeFonte: l.objeto_fonte ? (FONTE_DA_FINALIDADE[l.objeto_fonte] ?? "Finalidade") : "Finalidade",
    finalidade: l.objeto,
    previsto: l.previsto,
    empenhado: l.empenhado,
    realizado: l.pago,
    situacao: situacaoDoRegistro(l),
    ausencias,
  };
}

// ================================================================ o arquivo do recorte (os mesmos registros e totais da tela)

/** O registro como o arquivo leva: as colunas da tela, os identificadores e a coluna única `ausencias`. */
export interface RegistroExportado {
  emenda: string | null;
  ano: number | null;
  ano_pagamento: number | null;
  autoria: string;
  autoria_codigo: string | null;
  autoria_coletiva: boolean;
  tipo: string;
  forma_de_repasse: string;
  instrumento: string;
  destinatario: string;
  destinatario_grupo: string;
  cnpj: string | null;
  municipio: string | null;
  ibge: string | null;
  funcao: string | null;
  finalidade_fonte: string;
  finalidade: string | null;
  previsto: number | null;
  empenhado: number | null;
  realizado: number;
  situacao: string;
  ausencias: string;
}

export function exportado(r: Registro): RegistroExportado {
  return {
    emenda: r.codigo,
    ano: r.ano,
    ano_pagamento: r.anoPagamento,
    autoria: r.autoria,
    autoria_codigo: r.autoriaCodigo,
    autoria_coletiva: r.coletiva,
    tipo: r.tipo,
    forma_de_repasse: r.canalNome,
    instrumento: r.instrumento,
    destinatario: r.destinatario,
    destinatario_grupo: NOME_DESTINATARIO[r.destinatarioGrupo],
    cnpj: r.cnpj,
    municipio: r.municipio,
    ibge: r.ibge,
    funcao: r.funcao,
    finalidade_fonte: r.finalidadeFonte,
    finalidade: r.finalidade,
    previsto: r.previsto,
    empenhado: r.empenhado,
    realizado: r.realizado,
    situacao: r.situacao,
    ausencias: r.ausencias.join(" | "),
  };
}

const FONTES_REG = "Portal da Transparência (CGU), Transferegov e Fundo Nacional de Saúde";
/** O dicionário do arquivo do recorte, na ordem das colunas (as da tabela de registros). */
export const DICIONARIO_RECORTE: readonly CampoDicionario<RegistroExportado>[] = Object.freeze([
  { campo: "emenda", tipo: "código", descricao: "Código da emenda, com 12 dígitos: ano, autoria e número.", fonte: FONTES_REG, identificador: true },
  { campo: "ano", tipo: "inteiro", descricao: "Ano da emenda (o período do recorte é o ano da emenda).", fonte: FONTES_REG },
  { campo: "ano_pagamento", tipo: "inteiro", descricao: "Só no pagamento direto: o ano em que o favorecido recebeu.", fonte: FONTES_REG },
  { campo: "autoria", tipo: "texto", descricao: "Parlamentar, bancada, comissão ou relator, como publicado.", fonte: FONTES_REG },
  { campo: "autoria_codigo", tipo: "código", descricao: "Código da autoria (4 dígitos).", fonte: FONTES_REG, identificador: true },
  { campo: "autoria_coletiva", tipo: "sim ou não", descricao: "Bancada, comissão ou relator: autoria coletiva.", fonte: FONTES_REG },
  { campo: "tipo", tipo: "texto", descricao: "Tipo da emenda.", fonte: FONTES_REG },
  { campo: "forma_de_repasse", tipo: "texto", descricao: "Convênio ou contrato de repasse, transferência especial, fundo a fundo (saúde) ou pagamento direto ao favorecido.", fonte: FONTES_REG },
  { campo: "instrumento", tipo: "código", descricao: "Número do convênio, do plano de ação, da proposta do FNS ou o CNPJ do favorecido.", fonte: FONTES_REG, identificador: true },
  { campo: "destinatario", tipo: "texto", descricao: "Quem recebeu (pessoa jurídica). Microempreendedor individual sai como \"Microempreendedor individual (nome omitido)\".", fonte: FONTES_REG },
  { campo: "destinatario_grupo", tipo: "texto", descricao: "Prefeitura, fundos municipais, OSC, Estado ou empresas e outros.", fonte: "PONTE, pelo tipo do ente" },
  { campo: "cnpj", tipo: "código", descricao: "CNPJ do destinatário.", fonte: FONTES_REG, identificador: true },
  { campo: "municipio", tipo: "texto", descricao: "Município do destinatário (vazio no Estado).", fonte: "IBGE" },
  { campo: "ibge", tipo: "código", descricao: "Código IBGE do município.", fonte: "IBGE", identificador: true },
  { campo: "funcao", tipo: "texto", descricao: "Função de governo da emenda.", fonte: "Portal da Transparência (CGU)" },
  { campo: "finalidade_fonte", tipo: "texto", descricao: "De onde vem o texto da finalidade.", fonte: "PONTE" },
  { campo: "finalidade", tipo: "texto", descricao: "Objeto do instrumento ou do plano de ação, tipo de proposta do FNS ou ação orçamentária.", fonte: FONTES_REG },
  { campo: "previsto", tipo: "número (reais)", descricao: "Valor indicado pela autoria para este destino. Vazio no pagamento direto (não informado pela fonte).", fonte: FONTES_REG },
  { campo: "empenhado", tipo: "número (reais)", descricao: "Valor empenhado para este destino. Vazio no fundo a fundo e no pagamento direto (não informado pela fonte).", fonte: "Transferegov" },
  { campo: "realizado", tipo: "número (reais)", descricao: "Pago no canal até a data de referência: desembolsado pela União (convênio), pago (transferência especial e fundo a fundo) ou recebido (pagamento direto).", fonte: FONTES_REG },
  { campo: "situacao", tipo: "texto", descricao: "Situação do instrumento como a fonte registra.", fonte: FONTES_REG },
  { campo: "ausencias", tipo: "texto", descricao: "Os campos sem dado neste registro e o motivo (\"campo: motivo | campo: motivo\"). Zero é valor e não aparece aqui.", fonte: "PONTE" },
]);

/** Os totais do recorte no JSON, com a cobertura. */
export function totaisDoArquivo(s: Soma): Record<string, number> {
  return {
    registros: s.registros,
    emendas: s.emendas,
    previsto: s.previsto,
    registros_com_previsto: s.comPrevisto,
    empenhado: s.empenhado,
    registros_com_empenhado: s.comEmpenhado,
    realizado: s.realizado,
  };
}

/** A descrição do recorte em palavras (metadados do arquivo e legenda). */
export function descreverRecorte(r: Recorte, nomes: { municipio: string | null; autoria: (c: string) => string; funcao: (s: string) => string }): string[] {
  const d = [`período (ano da emenda): ${textoPeriodo(r.periodo)}`];
  d.push(r.municipio ? `município: ${nomes.municipio ?? r.municipio} (IBGE ${r.municipio})` : "Paraíba (todos os municípios e o Estado)");
  if (r.canal.length) d.push(`forma de repasse: ${r.canal.map((c) => CANAL[c].nome).join(", ")}`);
  if (r.destinatario.length) d.push(`destinatário: ${r.destinatario.map((x) => NOME_DESTINATARIO[x]).join(", ")}`);
  if (r.funcao.length) d.push(`função: ${r.funcao.map(nomes.funcao).join(", ")}`);
  if (r.tipo.length) d.push(`tipo: ${r.tipo.map((t) => NOME_TIPO[t]).join(", ")}`);
  if (r.autoria.length) d.push(`autoria: ${r.autoria.map(nomes.autoria).join(", ")}`);
  if (r.ano.length) d.push(`ano da emenda: ${r.ano.join(", ")}`);
  if (r.q) d.push(`busca: "${r.q}"`);
  d.push(`ordem: ${nomeDaColuna(r.ordem.campo)}${r.ordem.desc ? ", do maior para o menor" : ""}`);
  return d;
}
/** "emendas_patos-2510808_2023-2026_1-filtro.csv". */
export function nomeDoArquivoDoRecorte(r: Recorte, nomeMunicipio: string | null, formato: "csv" | "json"): string {
  const onde = r.municipio ? `${slugFuncao(nomeMunicipio ?? "municipio")}-${r.municipio}` : "paraiba";
  const n = quantosFiltros(r);
  return `emendas_${onde}_${textoPeriodoUrl(r.periodo)}${n ? `_${n}-${n === 1 ? "filtro" : "filtros"}` : ""}.${formato}`;
}
export function csvDoRecorte(regs: readonly RegistroExportado[]): string {
  return paraCsv(
    DICIONARIO_RECORTE.map((d) => ({
      titulo: d.campo,
      valor: (l: RegistroExportado) => {
        const v = l[d.campo];
        if (v === null || v === undefined) return null;
        return d.identificador && typeof v === "number" ? String(v) : v;
      },
      texto: d.identificador,
      decimais: d.tipo === "número (reais)" ? 2 : undefined,
    })),
    [...regs],
  );
}

// ================================================================ os blocos do município (todos do recorte)

export interface Blocos {
  total: Soma;
  destinatarios: { id: Destinatario; soma: Soma; entes: string[] }[];
  canais: { id: CanalPublico; soma: Soma }[];
  funcoes: { slug: string; nome: string; soma: Soma }[];
  anos: { ano: number; soma: Soma }[];
  autorias: { codigo: string; nome: string; coletiva: boolean; soma: Soma }[];
  semCatalogo: { ano: number; emendas: number }[];
  convenios: number;
  comFisico: number;
}

const COMPARA = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** Os blocos da tela do município, todos do mesmo conjunto de registros (o total de cada um abre a tela de registros). */
export function blocosDoRecorte(linhas: readonly LinhaPublica[], p: Periodo, comEstado: boolean): Blocos {
  const grupo = <K extends string>(chave: (l: LinhaPublica) => K) => {
    const m = new Map<K, LinhaPublica[]>();
    for (const l of linhas) {
      const k = chave(l);
      const xs = m.get(k);
      if (xs) xs.push(l);
      else m.set(k, [l]);
    }
    return m;
  };
  const porDest = grupo((l) => destinatarioDoEnte(l.ente_tipo));
  const destinatarios = DESTINATARIOS.filter((d) => comEstado || d !== "estado").map((id) => {
    const xs = porDest.get(id) ?? [];
    const porEnte = new Map<string, number>();
    for (const l of xs) {
      const n = nomeDoDestinatario(l);
      porEnte.set(n, (porEnte.get(n) ?? 0) + l.pago);
    }
    return { id, soma: somar(xs), entes: [...porEnte.entries()].sort((a, b) => b[1] - a[1] || COMPARA.compare(a[0], b[0])).map((x) => x[0]) };
  });
  const porCanal = grupo((l) => CANAL_DA_FONTE[l.canal]);
  const porFuncao = grupo((l) => slugFuncao(l.funcao));
  const funcoes = [...porFuncao.entries()]
    .map(([slug, xs]) => ({ slug, nome: xs[0].funcao ?? NAO_LOCALIZADO, soma: somar(xs) }))
    .sort((a, b) => COMPARA.compare(a.nome, b.nome));
  const porAno = grupo((l) => String(l.ano ?? ""));
  const anos: Blocos["anos"] = [];
  for (let a = p.de; a <= p.ate; a += 1) anos.push({ ano: a, soma: somar(porAno.get(String(a)) ?? []) });
  const porAutoria = grupo((l) => l.autor_codigo ?? "");
  const autorias = [...porAutoria.entries()]
    .map(([codigo, xs]) => ({ codigo, nome: nomeDaAutoria(codigo || null, xs[0].autor_nome), coletiva: xs[0].coletivo, soma: somar(xs) }))
    .sort((a, b) => COMPARA.compare(a.nome, b.nome));
  const sem = new Map<number, Set<string>>();
  for (const l of linhas) {
    if (l.no_catalogo || !l.codigo || l.ano === null) continue;
    const s = sem.get(l.ano) ?? new Set<string>();
    s.add(l.codigo);
    sem.set(l.ano, s);
  }
  const convenios = linhas.filter((l) => l.canal === "convenio");
  return {
    total: somar(linhas),
    destinatarios,
    canais: CANAIS_PUBLICOS.map((id) => ({ id, soma: somar(porCanal.get(id) ?? []) })),
    funcoes,
    anos,
    autorias,
    semCatalogo: [...sem.entries()].sort((a, b) => a[0] - b[0]).map(([ano, s]) => ({ ano, emendas: s.size })),
    convenios: convenios.length,
    comFisico: convenios.filter((l) => l.fisico !== null).length,
  };
}

/** A caixa de um contorno da malha (`M x y L x y …`): o centro posiciona o rótulo do mapa; os cantos, o recorte. */
export function caixaDoContorno(d: string): { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number } | null {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 4) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
    y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** A largura da barra, de 0 a 100 (%), relativa ao maior do bloco. */
export const largura = (v: number, maximo: number): number => (maximo > 0 ? Math.max(0, Math.min(100, (v / maximo) * 100)) : 0);

// ================================================================ a ficha: execução orçamentária, instrumentos, fontes

export const DEGRAUS_DA_EXECUCAO = Object.freeze([
  "Empenhado", "Liquidado", "Pago no exercício", "Restos a pagar pagos", "Restos a pagar cancelados", "A pagar",
] as const);

export interface Execucao {
  degraus: { rotulo: string; valor: number | null }[];
  pagoTotal: number | null;
}

/** A execução NACIONAL da emenda (todas as localidades do Portal): nunca somada à parcela da PB. */
export function execucaoNacional(catalogo: readonly LinhaCatalogo[]): Execucao | null {
  const c = catalogo.find((x) => x.nacional_empenhado !== null);
  if (!c) return null;
  const vs = [c.nacional_empenhado, c.nacional_liquidado, c.nacional_pago, c.nacional_rp_pago, c.nacional_rp_cancelado, c.nacional_a_pagar];
  return {
    degraus: DEGRAUS_DA_EXECUCAO.map((rotulo, i) => ({ rotulo, valor: vs[i] })),
    pagoTotal: c.nacional_pago !== null && c.nacional_rp_pago !== null ? arred(c.nacional_pago + c.nacional_rp_pago) : null,
  };
}
/** A linha (ou linhas) do Portal com a PB na localidade: as mesmas medidas, só dela. */
export function execucaoDaLinhaPb(catalogo: readonly LinhaCatalogo[]): Execucao | null {
  const pb = catalogo.filter((x) => x.pb_localidade);
  if (!pb.length) return null;
  const soma = (k: keyof LinhaCatalogo) => arred(pb.reduce((t, x) => t + (typeof x[k] === "number" ? (x[k] as number) : 0), 0));
  const vs = [soma("empenhado"), soma("liquidado"), soma("pago"), soma("rp_pago"), soma("rp_cancelado"), soma("a_pagar")];
  return { degraus: DEGRAUS_DA_EXECUCAO.map((rotulo, i) => ({ rotulo, valor: vs[i] })), pagoTotal: arred(vs[2] + vs[3]) };
}

export interface CampoDoInstrumento {
  rotulo: string;
  valor: string;
  ausente: boolean;
}
const campo = (rotulo: string, v: string | null | undefined, ausencia = NAO_INFORMADO): CampoDoInstrumento =>
  v === null || v === undefined || v === "" ? { rotulo, valor: ausencia, ausente: true } : { rotulo, valor: v, ausente: false };
const dt = (v: string | null) => (v ? dataBrasilia(v, "") : null);
const valorOuNada = (v: number | null) => (v === null ? null : rs(v));
const intervalo = (a: string | null, b: string | null) => (a ? (b && b !== a ? `${dt(a)} a ${dt(b)}` : dt(a)) : null);

const TIPO_DE_RECURSO: Readonly<Record<string, string>> = Object.freeze({
  "EMENDA INDIVIDUAL": "Emenda individual",
  "EMENDA BANCADA OBRIGATÓRIA": "Emenda de bancada (obrigatória)",
  "EMENDA COMISSAO": "Emenda de comissão",
  "EMENDA RELATORIA": "Emenda de relator",
  "EMENDA BANCADA": "Emenda de bancada",
});

/** O detalhe de um instrumento, por forma de repasse (V2-ESPEC, tela 4). */
export function camposDoInstrumento(l: LinhaPublica): CampoDoInstrumento[] {
  const c = CANAL_DA_FONTE[l.canal];
  const sit = campo("Situação", situacaoDoRegistro(l));
  if (c === "convenio")
    return [
      campo("Concedente", l.concedente ? suavizar(l.concedente) : null),
      sit,
      campo("Assinatura", dt(l.dt_assinatura)),
      campo("Vigência", l.vigencia_inicio || l.vigencia_fim ? `${dt(l.vigencia_inicio) ?? "—"} a ${dt(l.vigencia_fim) ?? "—"}` : null),
      campo("Valor global", valorOuNada(l.valor_global)),
      campo("Repasse da União", valorOuNada(l.convenio_repasse)),
      campo("Contrapartida", valorOuNada(l.contrapartida)),
      campo("Previsto", valorOuNada(l.previsto)),
      campo("Empenhado", valorOuNada(l.empenhado)),
      campo("Desembolsado pela União (realizado)", rs(l.pago)),
      campo("Desembolsos", intervalo(l.dt_primeiro_pagamento, l.dt_ultimo_pagamento), "nenhum desembolso registrado"),
      campo("Execução física atestada", l.fisico === null ? null : porcento(l.fisico)),
    ];
  if (c === "especial")
    return [
      campo("Área do plano de ação", l.pix_area),
      sit,
      campo("Custeio", valorOuNada(l.pix_custeio)),
      campo("Investimento", valorOuNada(l.pix_investimento)),
      campo("Fim da execução", dt(l.pix_fim_execucao)),
      campo("Previsto", valorOuNada(l.previsto)),
      campo("Empenhado", valorOuNada(l.empenhado)),
      campo("Pago (realizado)", rs(l.pago)),
      campo("Pagamento", intervalo(l.dt_primeiro_pagamento, l.dt_ultimo_pagamento), "nenhum pagamento registrado"),
      campo("Execução física", null),
    ];
  if (c === "saude")
    return [
      campo("Tipo de recurso", l.fns_tipo_recurso ? (TIPO_DE_RECURSO[l.fns_tipo_recurso] ?? suavizar(l.fns_tipo_recurso)) : null),
      sit,
      campo("Previsto", valorOuNada(l.previsto)),
      campo("Empenhado", null),
      campo("Pago (realizado)", rs(l.pago)),
      campo("Pagamentos", intervalo(l.dt_primeiro_pagamento, l.dt_ultimo_pagamento), "nenhum pagamento registrado"),
      campo("Execução física", null),
    ];
  return [
    campo("Favorecido", nomeDoDestinatario(l)),
    campo("CNPJ", cnpjLegivel(l.ente_cnpj)),
    campo("Ano do pagamento", l.ano_pagamento === null ? null : String(l.ano_pagamento)),
    campo("Previsto", null),
    campo("Empenhado", null),
    campo("Recebido (realizado)", rs(l.pago)),
    campo("Execução física", null, NAO_SE_APLICA),
  ];
}

export type OrdemInstrumentos = "municipio" | "-realizado" | "realizado" | "-previsto" | "previsto" | "canal" | "situacao";
export const ORDENS_INSTRUMENTOS: readonly { id: OrdemInstrumentos; rotulo: string }[] = Object.freeze([
  { id: "municipio", rotulo: "Município (o do recorte primeiro)" },
  { id: "-realizado", rotulo: "Realizado, do maior para o menor" },
  { id: "realizado", rotulo: "Realizado, do menor para o maior" },
  { id: "-previsto", rotulo: "Previsto, do maior para o menor" },
  { id: "previsto", rotulo: "Previsto, do menor para o maior" },
  { id: "canal", rotulo: "Forma de repasse" },
  { id: "situacao", rotulo: "Situação" },
] as { id: OrdemInstrumentos; rotulo: string }[]);
export const INSTRUMENTOS_POR_PAGINA = 20;

export interface ConsultaInstrumentos {
  q: string;
  ordem: OrdemInstrumentos;
  pagina: number;
}
export function lerConsultaInstrumentos(sp: URLSearchParams): ConsultaInstrumentos {
  const o = sp.get("iordem") ?? "";
  const p = Number(sp.get("ipagina"));
  return {
    q: limparBusca(sp.get("iq")),
    ordem: (ORDENS_INSTRUMENTOS.some((x) => x.id === o) ? o : "municipio") as OrdemInstrumentos,
    pagina: Number.isInteger(p) && p >= 1 && p <= 10_000 ? p : 1,
  };
}

/** A lista dos instrumentos da emenda na PB: busca, ordem (o município do recorte sempre no topo) e página. */
export function instrumentosDaEmenda(
  linhas: readonly LinhaPublica[],
  municipioDoRecorte: string | null,
  c: ConsultaInstrumentos,
): { itens: LinhaPublica[]; total: number; filtrados: number; paginas: number; pagina: number; doRecorte: number } {
  const palavras = normalizarTexto(c.q).split(" ").filter(Boolean);
  const texto = (l: LinhaPublica) =>
    normalizarTexto([l.municipio ?? "Estado da Paraíba", nomeDoDestinatario(l), l.instrumento, l.objeto ?? "", CANAL[CANAL_DA_FONTE[l.canal]].nome, situacaoDoRegistro(l)].join(" "));
  const achados = palavras.length ? linhas.filter((l) => palavras.every((p) => texto(l).includes(p))) : [...linhas];
  const ordemCanal = (l: LinhaPublica) => CANAIS_PUBLICOS.indexOf(CANAL_DA_FONTE[l.canal]);
  const nomeMun = (l: LinhaPublica) => l.municipio ?? "~Estado";
  const nulosNoFim = (a: number | null, b: number | null, desc: boolean) =>
    a === null && b === null ? 0 : a === null ? 1 : b === null ? -1 : desc ? b - a : a - b;
  const porOrdem: Record<OrdemInstrumentos, (a: LinhaPublica, b: LinhaPublica) => number> = {
    municipio: (a, b) => COMPARA.compare(nomeMun(a), nomeMun(b)) || ordemCanal(a) - ordemCanal(b),
    "-realizado": (a, b) => b.pago - a.pago,
    realizado: (a, b) => a.pago - b.pago,
    "-previsto": (a, b) => nulosNoFim(a.previsto, b.previsto, true),
    previsto: (a, b) => nulosNoFim(a.previsto, b.previsto, false),
    canal: (a, b) => ordemCanal(a) - ordemCanal(b),
    situacao: (a, b) => COMPARA.compare(situacaoDoRegistro(a), situacaoDoRegistro(b)),
  };
  const destaque = (l: LinhaPublica) => (municipioDoRecorte && l.ibge === municipioDoRecorte ? 0 : 1);
  const ord = achados.sort(
    (a, b) => destaque(a) - destaque(b) || porOrdem[c.ordem](a, b) || COMPARA.compare(nomeMun(a), nomeMun(b)) || a.instrumento.localeCompare(b.instrumento) || a.linha - b.linha,
  );
  const paginas = Math.max(1, Math.ceil(ord.length / INSTRUMENTOS_POR_PAGINA));
  const pagina = Math.min(c.pagina, paginas);
  return {
    itens: ord.slice((pagina - 1) * INSTRUMENTOS_POR_PAGINA, pagina * INSTRUMENTOS_POR_PAGINA),
    total: linhas.length,
    filtrados: ord.length,
    paginas,
    pagina,
    doRecorte: municipioDoRecorte ? linhas.filter((l) => l.ibge === municipioDoRecorte).length : 0,
  };
}

/** As páginas a mostrar na paginação: a 1ª, a última e duas em volta da atual; `null` é a reticência. */
export function paginasVisiveis(atual: number, total: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let p = 1; p <= total; p += 1) {
    if (total <= 9 || p === 1 || p === total || Math.abs(p - atual) <= 2) out.push(p);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

// ================================================================ as definições (um glossário só, aberto pelo "?")

export type ChaveDefinicao = "realizado" | "previsto" | "empenhado" | "registros" | "municipios" | "nacional" | "parcela" | "escala" | "execucao" | "fisico";
export const DEFINICOES: Readonly<Record<ChaveDefinicao, { titulo: string; fonte: string; texto: string }>> = Object.freeze({
  realizado: {
    titulo: "Realizado",
    fonte: "Portal da Transparência, Transferegov e Fundo Nacional de Saúde",
    texto: "O que foi pago no canal até a data de referência: no convênio, o que a União desembolsou na conta do instrumento; na transferência especial e no fundo a fundo, o pago; no pagamento direto, o recebido pelo favorecido. Os canais foram conferidos para que o mesmo pagamento não seja contado duas vezes.",
  },
  previsto: {
    titulo: "Previsto",
    fonte: "Transferegov, Fundo Nacional de Saúde e Portal da Transparência",
    texto: "O valor indicado pela autoria para aquele destino. O pagamento direto não tem previsto na fonte; por isso o total soma só os registros que têm o campo e diz em quantos.",
  },
  empenhado: {
    titulo: "Empenhado",
    fonte: "Transferegov",
    texto: "O valor reservado no orçamento para aquele destino, como o canal registra. O fundo a fundo e o pagamento direto não trazem empenho por destino; o total diz em quantos registros há o campo.",
  },
  registros: {
    titulo: "Registros e emendas",
    fonte: "Portal da Transparência, Transferegov e Fundo Nacional de Saúde",
    texto: "Cada registro é uma emenda, um destino e um instrumento. Uma emenda pode ter vários registros, em vários municípios e canais.",
  },
  municipios: {
    titulo: "Municípios com algum registro",
    fonte: "Portal da Transparência, Transferegov e Fundo Nacional de Saúde",
    texto: "Municípios em que a prefeitura, um fundo municipal ou outra entidade sediada tem registro no período. Recursos do Estado não entram nesta contagem.",
  },
  nacional: {
    titulo: "Valor nacional da emenda",
    fonte: "Portal da Transparência",
    texto: "A execução orçamentária da emenda no país inteiro, somando todas as localidades. Nunca é somada à parcela da Paraíba.",
  },
  parcela: {
    titulo: "Parcela identificada na Paraíba",
    fonte: "Portal da Transparência, Transferegov e Fundo Nacional de Saúde",
    texto: "A soma dos registros desta emenda com destino na Paraíba, em todos os municípios e no Estado, nos quatro canais.",
  },
  escala: {
    titulo: "Escala",
    fonte: "cálculo da PONTE sobre o Portal da Transparência e os registros",
    texto: "O previsto na Paraíba dividido pelo empenhado nacional. Mostra o tamanho da parcela paraibana dentro da emenda, não a execução.",
  },
  execucao: {
    titulo: "Execução orçamentária",
    fonte: "Portal da Transparência",
    texto: "Empenhado: reservado no orçamento. Liquidado: entrega ou serviço reconhecido. Pago no exercício: pago no mesmo ano. Restos a pagar pagos: pagos em anos seguintes. Restos a pagar cancelados: deixaram de ser devidos. A pagar: reservado e ainda não pago.",
  },
  fisico: {
    titulo: "Execução física",
    fonte: "Transferegov",
    texto: "O percentual da obra ou da entrega atestado no Transferegov. Existe só no convênio; na transferência especial e no fundo a fundo a fonte não informa; no pagamento direto não se aplica.",
  },
});
/** A linha de baixo da definição: território, período, atualização e fonte. */
export function metaDaDefinicao(chave: ChaveDefinicao, territorio: string, periodo: string): string {
  return `Território: ${territorio} · Período: ${periodo} · Atualização: semanal, às terças; a data de referência mostra a última coleta concluída · Fonte: ${DEFINICOES[chave].fonte}.`;
}

// ================================================================ o painel "Filtrar (n)" da tela de registros

export interface OpcaoDoFiltro {
  valor: string;
  rotulo: string;
  registros: number | null;
  marcada: boolean;
}
export interface GrupoDoFiltro {
  nome: "canal" | "destinatario" | "funcao" | "tipo" | "autoria" | "ano";
  titulo: string;
  opcoes: OpcaoDoFiltro[];
}

/**
 * Os grupos do painel "Filtrar": cada opção com quantos registros teria (os outros filtros aplicados, o do grupo não:
 * `emd_pub_facetas`), em ordem FIXA (forma, destinatário, tipo, ano) ou ALFABÉTICA (função, autoria), nunca por valor.
 * Aparece a opção que tem registro e a que já está marcada (mesmo com zero, para poder desmarcar).
 */
export function gruposDoFiltro(
  facetas: readonly { grupo: string; chave: string; rotulo: string | null; registros: number }[] | null,
  r: Recorte,
): GrupoDoFiltro[] {
  const de = (g: string) => new Map((facetas ?? []).filter((f) => f.grupo === g).map((f) => [f.chave, f]));
  const n = (m: Map<string, { registros: number }>, k: string) => (facetas ? (m.get(k)?.registros ?? 0) : null);
  const visivel = (o: OpcaoDoFiltro) => o.marcada || o.registros === null || o.registros > 0;
  const canal = de("canal");
  const ente = de("ente_tipo");
  const funcao = de("funcao");
  const tipo = de("tipo");
  const autoria = de("autoria");
  const ano = de("ano");
  const anos: number[] = [];
  for (let a = r.periodo.de; a <= r.periodo.ate; a += 1) anos.push(a);
  const funcoes = [...funcao.values()]
    .map((f) => ({ valor: f.rotulo ? slugFuncao(f.rotulo) : FUNCAO_SEM_CATALOGO, rotulo: f.rotulo ?? NAO_LOCALIZADO, registros: facetas ? f.registros : null }))
    .concat(r.funcao.filter((s) => ![...funcao.values()].some((f) => (f.rotulo ? slugFuncao(f.rotulo) : FUNCAO_SEM_CATALOGO) === s)).map((s) => ({ valor: s, rotulo: s.replace(/-/g, " "), registros: facetas ? 0 : null })))
    .map((o) => ({ ...o, marcada: r.funcao.includes(o.valor) }))
    .sort((a, b) => COMPARA.compare(a.rotulo, b.rotulo));
  const autorias = [...autoria.values()]
    .filter((a) => a.chave !== "")
    .map((a) => ({ valor: a.chave, rotulo: nomeDaAutoria(a.chave, a.rotulo), registros: facetas ? a.registros : null }))
    .concat(r.autoria.filter((c) => !autoria.has(c)).map((c) => ({ valor: c, rotulo: nomeDaAutoria(c, null), registros: facetas ? 0 : null })))
    .map((o) => ({ ...o, marcada: r.autoria.includes(o.valor) }))
    .sort((a, b) => COMPARA.compare(a.rotulo, b.rotulo));
  return [
    { nome: "canal" as const, titulo: "Forma de repasse", opcoes: CANAIS_PUBLICOS.map((c) => ({ valor: c, rotulo: CANAL[c].nome, registros: n(canal, FONTE_DO_CANAL[c]), marcada: r.canal.includes(c) })) },
    {
      nome: "destinatario" as const,
      titulo: "Destinatário",
      opcoes: DESTINATARIOS.map((d) => ({
        valor: d,
        rotulo: NOME_DESTINATARIO[d],
        registros: facetas ? ENTES_DO_DESTINATARIO[d].reduce((t, e) => t + (ente.get(e)?.registros ?? 0), 0) : null,
        marcada: r.destinatario.includes(d),
      })).filter(visivel),
    },
    { nome: "funcao" as const, titulo: "Função de governo", opcoes: funcoes.filter(visivel) },
    {
      nome: "tipo" as const,
      titulo: "Tipo da emenda",
      opcoes: TIPOS_PUBLICOS.map((t) => ({ valor: t, rotulo: NOME_TIPO[t], registros: n(tipo, tipoDoBanco(t)), marcada: r.tipo.includes(t) })).filter(visivel),
    },
    { nome: "autoria" as const, titulo: "Autoria", opcoes: autorias.filter(visivel) },
    { nome: "ano" as const, titulo: "Ano da emenda", opcoes: anos.map((a) => ({ valor: String(a), rotulo: String(a), registros: n(ano, String(a)), marcada: r.ano.includes(a) })) },
  ];
}

// ================================================================ o item do menu marcado (aria-current)

/**
 * A seção do menu de uma tela: o que veio de um município é "Municípios" (a tela do município, os registros com
 * `municipio=` e a ficha aberta com `de=` de um recorte de município); "Emendas" é a lista geral, a ficha sem município e
 * a busca. O início não marca nenhum. Devolve o `href` do item, ou null.
 */
export function secaoDoMenu(caminho: string, sp: URLSearchParams): string | null {
  const MUN = `${BASE_PORTAL}/municipios`;
  const EMENDAS = URL_REGISTROS;
  if (caminho === BASE_PORTAL) return null;
  if (caminho === MUN || caminho.startsWith(`${MUN}/`)) return MUN;
  if (caminho === EMENDAS) return ibgeValido(sp.get("municipio")) ? MUN : EMENDAS;
  if (caminho.startsWith(`${BASE_PORTAL}/emenda/`)) {
    const o = lerOrigem(sp.get("de"), anoAtualBrasilia());
    const mun = o?.tela === "registros" ? o.recorte.municipio : o?.tela === "municipio" ? o.ibge : null;
    return mun ? MUN : EMENDAS;
  }
  if (caminho === `${BASE_PORTAL}/emenda` || caminho === `${BASE_PORTAL}/buscar`) return EMENDAS;
  for (const h of ["parlamentares", "dados", "metodo", "perguntas"]) {
    const href = `${BASE_PORTAL}/${h}`;
    if (caminho === href || caminho.startsWith(`${href}/`)) return href;
  }
  return null;
}

// ================================================================ "O caminho do recurso" (Ajuda)

/** As âncoras dos passos do caminho do recurso, na página de perguntas; os "?" das medidas apontam para elas. */
export const ANCORA_DO_CAMINHO = Object.freeze({
  previsto: "caminho-indicacao",
  empenhado: "caminho-empenho",
  instrumento: "caminho-instrumento",
  realizado: "caminho-pagamento",
  fisico: "caminho-fisico",
  contas: "caminho-contas",
});
/** O link "ver no caminho do recurso" de uma definição (só das medidas que têm passo). */
export function linkDoCaminho(chave: ChaveDefinicao): string | null {
  const id = (ANCORA_DO_CAMINHO as Readonly<Record<string, string>>)[chave];
  return id ? `${BASE_PORTAL}/perguntas#${id}` : null;
}
