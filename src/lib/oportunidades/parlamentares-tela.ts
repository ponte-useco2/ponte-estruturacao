/**
 * A apresentação das telas de administrador dos parlamentares (onda 14, parte 2, B, 13/10/2026): `/mapa/parlamentares`
 * (a lista dos autores) e `/mapa/parlamentar/[codigo]` (a ficha, em abas). Funções puras, sem banco e sem Next, com
 * teste. A lógica do dado (separar o destino, o valor por habitante, a execução na safra, os rótulos de tipo e canal)
 * é do contrato `emendas.ts`; aqui só o que a tela precisa para ordenar, agrupar, rotular e montar endereços.
 *
 * As regras do contrato valem aqui também (onda 14, parte 2, B, 13/10/2026):
 *   · a lista vai por tipo e nome, nunca por valor, posição ou nota;
 *   · o catálogo do Portal e o canal nunca se somam, e o catálogo só aparece pelo recorte da PB;
 *   · o município atendido é ente público municipal (município ou fundo municipal); entidade com sede na PB não é
 *     destino;
 *   · valor por habitante é soma ÷ soma da população, nunca a média das razões.
 *
 * A ordem dos tipos e dos canais, os rótulos e a ordem dos autores vêm de `emendas.ts` (agente A), para haver uma fonte
 * só; aqui fica o que é só da tela.
 */
import {
  CANAIS,
  ROTULO_TIPO_AUTOR,
  TIPOS_AUTOR,
  ordenarAutores,
  type AnoCanalEmendas,
  type AutorEmendas,
  type CanalEmenda,
  type DestinoEmendas,
  type EnteTipoEmenda,
  type MunicipioPopulacao,
  type TipoAutor,
} from "./emendas.ts";
import { tituloDaPagina } from "./titulo-pagina.ts";

/** Os municípios da PB: a base do "n de 223" e dos não atendidos. */
export const TOTAL_MUNICIPIOS_PB = 223;

// ================================================================ a lista dos autores

/** O tipo pedido no endereço (`?tipo=`), só se for um dos cinco; o resto vira "todos" (null). */
export function tipoDaUrl(v: string | string[] | undefined | null): TipoAutor | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && (TIPOS_AUTOR as readonly string[]).includes(s) ? (s as TipoAutor) : null;
}

/** O endereço da lista, com o filtro de tipo quando há. */
export function urlParlamentares(tipo?: TipoAutor | null): string {
  return tipo ? `/mapa/parlamentares?tipo=${tipo}` : "/mapa/parlamentares";
}

/** Quantos autores de cada tipo (os cinco sempre presentes, com zero quando não há). */
export function contarPorTipo(autores: readonly Pick<AutorEmendas, "tipo">[]): Record<TipoAutor, number> {
  const conta: Record<TipoAutor, number> = { individual: 0, bancada: 0, comissao: 0, relator: 0, outro: 0 };
  for (const a of autores) conta[a.tipo in conta ? a.tipo : "outro"] += 1;
  return conta;
}

const COMPARA_NOME = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Onde o autor cai na lista, só com as colunas de `emd_autores` (a lista não traz o destino linha a linha; a ficha
 * separa com `separarDestino`). Conferido no banco em 13/10/2026 (64 + 5 + 277 + 37 = 383):
 *   · `publico`: tem município atendido (município ou fundo municipal, com instrumento válido ou pago direto), ou Pix
 *     ou saúde fundo a fundo válidos, canais que só vão a ente público (município, estado ou fundo);
 *   · `convenio_sem_municipio`: convênio válido, mas nenhum município atendido: o convênio foi com entidade com sede na
 *     PB ou com o governo do estado, e só a ficha diz qual;
 *   · `entidade`: só pagamento direto do Portal (favorecido), sem município atendido: entidade ou empresa com sede na PB;
 *   · `sem_canal`: nenhum canal com valor na PB (só no catálogo do Portal com a PB na localidade, só proposta que não
 *     virou instrumento válido, ou só pagamento a pessoa física, que é somado e não aparece por autor).
 */
export type GrupoDestino = "publico" | "convenio_sem_municipio" | "entidade" | "sem_canal";

export function grupoDeDestino(
  a: Pick<AutorEmendas, "municipios" | "convenio_valido" | "pix_valido" | "fns_valido" | "favorecido_pago">,
): GrupoDestino {
  if (a.municipios > 0 || a.pix_valido > 0 || a.fns_valido > 0) return "publico";
  if (a.convenio_valido > 0) return "convenio_sem_municipio";
  if (a.favorecido_pago > 0) return "entidade";
  return "sem_canal";
}

export const GRUPOS_DESTINO: readonly { id: GrupoDestino; titulo: string; nota: string }[] = [
  {
    id: "publico",
    titulo: "Com destino público na PB",
    nota:
      "Têm ao menos um município atendido (prefeitura ou fundo municipal, com convênio assinado, Pix pronto para pagar, " +
      "proposta do FNS válida ou pagamento direto), ou Pix ou saúde fundo a fundo válidos, que só vão a ente público.",
  },
  {
    id: "convenio_sem_municipio",
    titulo: "Com convênio, sem município atendido",
    nota:
      "Têm convênio válido na PB, mas com entidade sediada aqui ou com o governo do estado, nunca com prefeitura. A ficha de " +
      "cada um separa o estadual da entidade.",
  },
  {
    id: "entidade",
    titulo: "Só pagaram entidade com sede na PB",
    nota:
      "Só aparecem pelo pagamento direto do Portal, a empresa ou entidade com sede na PB (muitos são de outros estados). " +
      "Empresa sediada aqui não é destino na PB: o recurso pode atender outro lugar.",
  },
  {
    id: "sem_canal",
    titulo: "Sem canal com valor na PB",
    nota:
      "Aparecem só no catálogo do Portal com a PB na localidade, só com proposta que não virou instrumento válido, ou só em " +
      "pagamento a pessoa física, que entra somado e nunca por nome.",
  },
];

export interface GrupoDaLista<T> {
  id: GrupoDestino;
  titulo: string;
  nota: string;
  autores: T[];
}

/**
 * A lista da tela: o filtro de tipo, a ordem por tipo e nome (`ordenarAutores`, nunca por valor) e os quatro grupos
 * (vazios inclusive, na ordem fixa).
 */
export function listaDaTela<T extends Pick<AutorEmendas, "tipo" | "nome" | "codigo" | "municipios" | "convenio_valido" | "pix_valido" | "fns_valido" | "favorecido_pago">>(
  autores: readonly T[],
  tipo: TipoAutor | null,
): GrupoDaLista<T>[] {
  const ordenados = ordenarAutores(tipo ? autores.filter((a) => a.tipo === tipo) : autores);
  return GRUPOS_DESTINO.map((g) => ({ ...g, autores: ordenados.filter((a) => grupoDeDestino(a) === g.id) }));
}

/** "64 de 223"; sem município, "nenhum". */
export function municipiosDe223(n: number): string {
  return n > 0 ? `${n.toLocaleString("pt-BR")} de ${TOTAL_MUNICIPIOS_PB}` : "nenhum";
}

/** Os anos da emenda: "2015 a 2026", "2024" ou "—". */
export function periodoDoAutor(a: Pick<AutorEmendas, "ano_min" | "ano_max">): string {
  const { ano_min: de, ano_max: ate } = a;
  if (de === null && ate === null) return "—";
  if (de === null || ate === null || de === ate) return String(de ?? ate);
  return `${de} a ${ate}`;
}

// ================================================================ a ficha: abas e endereços

export type AbaParlamentar = "acesso" | "destinacao" | "execucao" | "contexto";

export const ABAS_PARLAMENTAR: readonly { id: AbaParlamentar; nome: string }[] = [
  { id: "acesso", nome: "Acesso" },
  { id: "destinacao", nome: "Destinação" },
  { id: "execucao", nome: "Execução" },
  { id: "contexto", nome: "Contexto e método" },
];

/** A aba pedida (`?aba=`), só se existir; senão, a de entrada (Acesso). */
export function abaDoParlamentar(v: string | string[] | undefined | null): AbaParlamentar {
  const s = Array.isArray(v) ? v[0] : v;
  return ABAS_PARLAMENTAR.find((a) => a.id === s)?.id ?? "acesso";
}

/** O endereço da ficha; a aba de entrada fica sem `?aba=`, como na página do município. */
export function urlParlamentar(codigo: string, aba?: AbaParlamentar | null): string {
  const base = `/mapa/parlamentar/${encodeURIComponent(codigo)}`;
  return aba && aba !== "acesso" ? `${base}?aba=${aba}` : base;
}

/**
 * O título da aba do navegador, no padrão de `titulo-pagina.ts`: só o que está no endereço (o código já validado e a
 * aba), sem ler o banco. "Autor 1277 · Destinação · Mapa de Oportunidades · PONTE"; código que não vale, o genérico.
 */
export function tituloParlamentar(codigo: string | null, aba: AbaParlamentar | null): string {
  if (!codigo) return tituloDaPagina("Autor de emendas");
  return tituloDaPagina(`Autor ${codigo}`, ABAS_PARLAMENTAR.find((a) => a.id === aba)?.nome);
}

export function tituloParlamentares(tipo: TipoAutor | null): string {
  return tituloDaPagina("Parlamentares", tipo ? ROTULO_TIPO_AUTOR[tipo] : null);
}

// ================================================================ aba Acesso

/** A posição do canal na ordem fixa de `CANAIS` (os três com escada e o favorecido por último). */
const ordemCanal = (c: CanalEmenda): number => {
  const k = CANAIS.indexOf(c);
  return k < 0 ? CANAIS.length : k;
};

/** O pago ao favorecido (o pagamento direto do Portal) só tem o pago: indicado e válido não existem para ele. */
export function soPago(canal: CanalEmenda): boolean {
  return canal === "favorecido";
}

export interface TotalCanal {
  canal: CanalEmenda;
  emendas: number;
  indicado: number;
  valido: number;
  pago: number;
  caducado: number;
}

/**
 * Os totais por canal da série do autor, na ordem fixa de `CANAIS` e só os canais com linha. As emendas somam por ano:
 * a mesma emenda não muda de ano, então não conta duas vezes dentro de um canal.
 */
export function totaisPorCanal(anos: readonly AnoCanalEmendas[]): TotalCanal[] {
  const por = new Map<CanalEmenda, TotalCanal>();
  for (const l of anos) {
    const t = por.get(l.canal) ?? { canal: l.canal, emendas: 0, indicado: 0, valido: 0, pago: 0, caducado: 0 };
    t.emendas += l.emendas;
    t.indicado += l.indicado;
    t.valido += l.valido;
    t.pago += l.pago;
    t.caducado += l.caducado;
    por.set(l.canal, t);
  }
  return CANAIS.flatMap((c) => (por.has(c) ? [por.get(c)!] : []));
}

/** A série por ano (o mais novo primeiro) e, dentro do ano, na ordem dos canais. Não muda a lista dada. */
export function serieDoAcesso(anos: readonly AnoCanalEmendas[]): AnoCanalEmendas[] {
  return [...anos].sort((a, b) => b.ano - a.ano || ordemCanal(a.canal) - ordemCanal(b.canal));
}

/** Os caducados por ano (só convênio caduca), do mais novo para o mais velho, e o total. */
export function caducadosPorAno(anos: readonly AnoCanalEmendas[]): { linhas: { ano: number; valor: number }[]; total: number } {
  const por = new Map<number, number>();
  for (const l of anos) if (l.caducado > 0) por.set(l.ano, (por.get(l.ano) ?? 0) + l.caducado);
  const linhas = [...por.entries()].map(([ano, valor]) => ({ ano, valor })).sort((a, b) => b.ano - a.ano);
  return { linhas, total: linhas.reduce((s, l) => s + l.valor, 0) };
}

// ================================================================ aba Destinação

export interface LinhaMunicipio {
  ibge: string;
  nome: string;
  populacao: number | null;
  /** Os canais com linha no município, na ordem fixa de `CANAIS`. */
  canais: CanalEmenda[];
  instrumentos: number;
  indicado: number;
  valido: number;
  pago: number;
  caducado: number;
  /** Com instrumento válido ou pagamento: entra no mapa e no "n de 223". Sem, só proposta ou caducado. */
  atendido: boolean;
  /** Pago ÷ população do município (null sem população ou sem pagamento). */
  pagoPorHabitante: number | null;
}

/**
 * O destino municipal por município (a parte `municipal` de `separarDestino`), com o nome e a população da base do
 * fiscal, em ordem alfabética: a tabela da Destinação não ordena município por valor. IBGE fora da base aparece com o
 * código no lugar do nome.
 */
export function linhasPorMunicipio(municipal: readonly DestinoEmendas[], municipios: readonly MunicipioPopulacao[]): LinhaMunicipio[] {
  const base = new Map(municipios.map((m) => [m.ibge, m]));
  const por = new Map<string, LinhaMunicipio>();
  for (const d of municipal) {
    if (!d.ibge) continue;
    const m = base.get(d.ibge);
    const l =
      por.get(d.ibge) ??
      ({
        ibge: d.ibge,
        nome: m?.nome ?? `IBGE ${d.ibge}`,
        populacao: m?.populacao ?? null,
        canais: [],
        instrumentos: 0,
        indicado: 0,
        valido: 0,
        pago: 0,
        caducado: 0,
        atendido: false,
        pagoPorHabitante: null,
      } satisfies LinhaMunicipio);
    if (!l.canais.includes(d.canal)) l.canais.push(d.canal);
    l.instrumentos += d.instrumentos;
    l.indicado += d.indicado;
    l.valido += d.valido;
    l.pago += d.pago;
    l.caducado += d.caducado;
    por.set(d.ibge, l);
  }
  const linhas = [...por.values()];
  for (const l of linhas) {
    l.canais.sort((a, b) => ordemCanal(a) - ordemCanal(b));
    l.atendido = l.valido > 0 || l.pago > 0;
    l.pagoPorHabitante = l.populacao && l.populacao > 0 && l.pago > 0 ? l.pago / l.populacao : null;
  }
  return linhas.sort((a, b) => COMPARA_NOME.compare(a.nome, b.nome));
}

/** Os municípios da PB sem nenhum destino atendido deste autor, em ordem alfabética (o "visível" do não atendido). */
export function naoAtendidos(linhas: readonly LinhaMunicipio[], municipios: readonly MunicipioPopulacao[]): MunicipioPopulacao[] {
  const atendidos = new Set(linhas.filter((l) => l.atendido).map((l) => l.ibge));
  return municipios.filter((m) => !atendidos.has(m.ibge)).sort((a, b) => COMPARA_NOME.compare(a.nome, b.nome));
}

/**
 * Os cortes das faixas do mapa: os quartis do pago por habitante entre os atendidos (posição mais próxima), sem repetir.
 * Com menos de 4 valores, uma faixa só (sem corte): quartil de 3 municípios não diz nada. Faixas de quartil, e não de
 * valor fixo, para o município pequeno com uma obra só (o "efeito de denominador") não pintar o mapa inteiro de claro.
 */
export function cortesDasFaixas(valores: readonly number[]): number[] {
  const v = valores.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length < 4) return [];
  const quantil = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1))];
  const maior = v[v.length - 1];
  // Um corte no maior valor deixaria a última faixa ("acima de") vazia na legenda.
  return [...new Set([quantil(0.25), quantil(0.5), quantil(0.75)])].filter((c) => c < maior);
}

/** A faixa de um valor (1 a cortes + 1); 0 é o não atendido (sem valor). */
export function faixaDe(valor: number | null, cortes: readonly number[]): number {
  if (valor === null || !(valor > 0)) return 0;
  const i = cortes.findIndex((c) => valor <= c);
  return (i < 0 ? cortes.length : i) + 1;
}

/** O rótulo de cada faixa, para a legenda: "até R$ 12/hab", "R$ 12 a R$ 40/hab", "acima de R$ 95/hab". */
export function rotulosDasFaixas(cortes: readonly number[], formatar: (v: number) => string): string[] {
  if (cortes.length === 0) return ["com destino atendido"];
  return [
    `até ${formatar(cortes[0])}/hab.`,
    ...cortes.slice(1).map((c, i) => `${formatar(cortes[i])} a ${formatar(c)}/hab.`),
    `acima de ${formatar(cortes[cortes.length - 1])}/hab.`,
  ];
}

export interface LinhaResumo {
  canal: CanalEmenda;
  ente_tipo: EnteTipoEmenda | null;
  instrumentos: number;
  municipiosSede: number;
  valido: number;
  pago: number;
}

/**
 * O destino estadual e o da entidade com sede, por canal e tipo do ente (a ordem dos canais, depois o tipo). Para a
 * entidade, `municipiosSede` conta os municípios da sede, que não são destino.
 */
export function resumoPorCanalETipo(linhas: readonly DestinoEmendas[]): LinhaResumo[] {
  const por = new Map<string, LinhaResumo>();
  const sedes = new Map<string, Set<string>>();
  for (const d of linhas) {
    const chave = `${d.canal}|${d.ente_tipo ?? ""}`;
    const r = por.get(chave) ?? { canal: d.canal, ente_tipo: d.ente_tipo, instrumentos: 0, municipiosSede: 0, valido: 0, pago: 0 };
    r.instrumentos += d.instrumentos;
    r.valido += d.valido;
    r.pago += d.pago;
    por.set(chave, r);
    const s = sedes.get(chave) ?? new Set<string>();
    if (d.ibge) s.add(d.ibge);
    sedes.set(chave, s);
  }
  return [...por.entries()]
    .map(([chave, r]) => ({ ...r, municipiosSede: sedes.get(chave)?.size ?? 0 }))
    .sort((a, b) => ordemCanal(a.canal) - ordemCanal(b.canal) || (a.ente_tipo ?? "").localeCompare(b.ente_tipo ?? ""));
}

// ================================================================ números

/** Fração como porcentagem inteira ("92%"); abaixo de 1%, com uma casa ("0,4%"); sem valor, "—". */
export function porcento(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  const p = x * 100;
  const casas = p > 0 && p < 1 ? 1 : 0;
  return `${p.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Reais por habitante: "R$ 35,60" até R$ 100, "R$ 879" acima; sem valor, "—". */
export function reaisPorHabitante(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const casas = Math.abs(v) < 100 ? 2 : 0;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
}
