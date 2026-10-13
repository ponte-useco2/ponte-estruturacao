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
  ROTULO_CANAL,
  ROTULO_TIPO_AUTOR,
  TIPOS_AUTOR,
  ordenarAutores,
  rotuloEnteTipo,
  type AnoCanalEmendas,
  type AutorEmendas,
  type CanalEmenda,
  type DestinoEmendas,
  type EnteTipoEmenda,
  type ExecucaoNaSafra,
  type MunicipioPopulacao,
  type TipoAutor,
} from "./emendas.ts";
import { gravarEstado, lerEstado, type ColunaTabela, type ValorCelula } from "./tabela-filtro.ts";
import { tituloDaPagina } from "./titulo-pagina.ts";

/** Os municípios da PB: a base do "n de 223" e dos não atendidos. */
export const TOTAL_MUNICIPIOS_PB = 223;

// ================================================================ a lista dos autores

/**
 * O tipo pedido no endereço antigo (`?tipo=`), só se for um dos cinco; o resto vira "todos" (null). Desde a onda 15
 * (A, 13/10/2026), o filtro de tipo é o da coluna "Tipo" da tabela (`?t.parl.tipo=`); o `?tipo=` antigo continua
 * valendo porque a lista redireciona para a forma nova (`urlParlamentares`).
 */
export function tipoDaUrl(v: string | string[] | undefined | null): TipoAutor | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && (TIPOS_AUTOR as readonly string[]).includes(s) ? (s as TipoAutor) : null;
}

/** O prefixo da tabela dos autores no endereço (`?t.parl.<coluna>=…`). */
export const TABELA_PARLAMENTARES = "parl";

/**
 * O endereço da lista, com o filtro de tipo quando há (onda 15, A, 13/10/2026): o filtro de categoria da coluna "Tipo"
 * da tabela, pelo rótulo ("?t.parl.tipo=Comiss%C3%A3o"), e não mais o `?tipo=comissao` de antes.
 */
export function urlParlamentares(tipo?: TipoAutor | null): string {
  if (!tipo) return "/mapa/parlamentares";
  const filtro = { tipo: { tipo: "categoria" as const, valores: [ROTULO_TIPO_AUTOR[tipo] ?? ROTULO_TIPO_AUTOR.outro] } };
  return `/mapa/parlamentares?${gravarEstado(TABELA_PARLAMENTARES, { filtros: filtro, ordem: null }, new URLSearchParams()).toString()}`;
}

/**
 * O tipo que o endereço pede, para o título da aba (integração da onda 15, 13/10/2026): o `?tipo=` antigo ou o filtro
 * da coluna "Tipo" da tabela (`?t.parl.tipo=`) com UM tipo só. Dois tipos ou nenhum: null (o título genérico).
 */
export function tipoDoEndereco(sp: Record<string, string | string[] | undefined>): TipoAutor | null {
  const antigo = tipoDaUrl(sp.tipo);
  if (antigo) return antigo;
  const parametros = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") parametros.set(k, v);
  const filtro = lerEstado(TABELA_PARLAMENTARES, COLUNAS_PARLAMENTARES, parametros).filtros.tipo;
  if (!filtro || filtro.tipo !== "categoria" || filtro.valores.length !== 1) return null;
  const pedido = filtro.valores[0].normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
  const achado = (Object.entries(ROTULO_TIPO_AUTOR) as [TipoAutor, string][]).find(
    ([, rotulo]) => rotulo.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase() === pedido,
  );
  return achado ? achado[0] : null;
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

/** O nome curto de cada grupo: o título do cartão e o valor da coluna "Grupo" da tabela (onda 15, A, 13/10/2026). */
export const ROTULO_CURTO_GRUPO: Readonly<Record<GrupoDestino, string>> = Object.freeze({
  publico: "Destino público na PB",
  convenio_sem_municipio: "Convênio sem município",
  entidade: "Só entidade com sede na PB",
  sem_canal: "Sem canal com valor",
});

/**
 * As colunas da tabela dos autores (onda 15, A, 13/10/2026), uma por dado, para cada uma filtrar, ordenar e ir ao CSV:
 * o válido e o pago de cada canal viram duas colunas, e os caducados, a quantidade e o valor. O código entra como
 * coluna, como no estudo da onda 13 (seção 7.1), e sai no CSV como texto. É tela de administrador: toda coluna ordena.
 * O catálogo com a PB na localidade só tem valor no grupo "sem canal" (ver `valoresDoAutor`).
 */
export const COLUNAS_PARLAMENTARES: ColunaTabela[] = [
  { id: "autor", titulo: "Autor", tipo: "texto" },
  { id: "codigo", titulo: "Código", tipo: "texto", textoNoCsv: true },
  { id: "tipo", titulo: "Tipo", tipo: "categoria" },
  { id: "grupo", titulo: "Grupo", tipo: "categoria" },
  { id: "convenio-valido", titulo: "Convênio válido", tipo: "numero", alinhar: "direita" },
  { id: "convenio-pago", titulo: "Convênio pago", tipo: "numero", alinhar: "direita" },
  { id: "pix-valido", titulo: "Pix válido", tipo: "numero", alinhar: "direita" },
  { id: "pix-pago", titulo: "Pix pago", tipo: "numero", alinhar: "direita" },
  { id: "fns-valido", titulo: "FNS válido", tipo: "numero", alinhar: "direita" },
  { id: "fns-pago", titulo: "FNS pago", tipo: "numero", alinhar: "direita" },
  { id: "favorecido-pago", titulo: "Pago ao favorecido", tipo: "numero", alinhar: "direita" },
  { id: "municipios", titulo: "Municípios atendidos", tipo: "numero", alinhar: "direita" },
  { id: "caducados", titulo: "Caducados", tipo: "numero", alinhar: "direita" },
  { id: "caducado-valor", titulo: "Valor caducado", tipo: "numero", alinhar: "direita" },
  { id: "na-fila", titulo: "Na fila", tipo: "numero", alinhar: "direita" },
  { id: "ano-inicial", titulo: "Ano inicial", tipo: "numero", alinhar: "direita" },
  { id: "ano-final", titulo: "Ano final", tipo: "numero", alinhar: "direita" },
  { id: "catalogo-empenhado", titulo: "Catálogo PB empenhado", tipo: "numero", alinhar: "direita" },
  { id: "catalogo-pago", titulo: "Catálogo PB pago", tipo: "numero", alinhar: "direita" },
];

/** O nome publicado, ou o código quando o Portal não publica nome. */
export function nomeDoAutor(a: Pick<AutorEmendas, "codigo" | "nome">): string {
  return a.nome ?? `Autor ${a.codigo} (sem nome publicado)`;
}

/**
 * Os valores crus de um autor, por coluna de `COLUNAS_PARLAMENTARES`: filtram, ordenam e vão ao CSV. O zero fica zero
 * (é valor; a tela desenha "—"); o ano ausente é null. O catálogo com a PB só vale no grupo "sem canal", que não tem
 * outro número: nos outros fica null, porque catálogo e canal são o mesmo dinheiro visto de dois lugares e a lista é
 * dos canais (a ficha mostra o catálogo de todos, na aba Contexto).
 */
export function valoresDoAutor(a: AutorEmendas): Record<string, ValorCelula> {
  const grupo = grupoDeDestino(a);
  return {
    autor: nomeDoAutor(a),
    codigo: a.codigo,
    tipo: ROTULO_TIPO_AUTOR[a.tipo] ?? ROTULO_TIPO_AUTOR.outro,
    grupo: ROTULO_CURTO_GRUPO[grupo],
    "convenio-valido": a.convenio_valido,
    "convenio-pago": a.convenio_pago,
    "pix-valido": a.pix_valido,
    "pix-pago": a.pix_pago,
    "fns-valido": a.fns_valido,
    "fns-pago": a.fns_pago,
    "favorecido-pago": a.favorecido_pago,
    municipios: a.municipios,
    caducados: a.caducados,
    "caducado-valor": a.caducado_valor,
    "na-fila": a.na_fila,
    "ano-inicial": a.ano_min,
    "ano-final": a.ano_max,
    "catalogo-empenhado": grupo === "sem_canal" ? a.catalogo_empenhado_pb : null,
    "catalogo-pago": grupo === "sem_canal" ? a.catalogo_pago_total_pb : null,
  };
}

/** A ordem padrão da tabela: os quatro grupos na ordem fixa e, dentro de cada um, tipo e nome (`listaDaTela`). */
export function autoresNaOrdemPadrao(autores: readonly AutorEmendas[]): AutorEmendas[] {
  return listaDaTela(autores, null).flatMap((g) => g.autores);
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

// ================================================================ as tabelas filtráveis da ficha e do município (onda 15, fase 2, lote A, 13/10/2026)
//
// A regra do titular (13/10/2026): cada coluna filtra e, nas telas de administrador (estas todas), ordena. A ordem padrão
// continua a de antes (por ano, por nome, por canal) e o valor só ordena quando a pessoa pede: é leitura, não posição.
// A célula que junta dois dados ("Ano e canal", "Canal e ente") mantém o desenho; o dado de baixo vai numa coluna
// oculta, que filtra e vai ao CSV.

const colunaNum = (id: string, titulo: string): ColunaTabela => ({ id, titulo, tipo: "numero", alinhar: "direita" });

/** O nome curto de cada canal no título das colunas: "Pix válido", "FNS pago", como na lista dos autores. */
const CANAL_CURTO: Readonly<Record<CanalEmenda, string>> = Object.freeze({
  convenio: "Convênio",
  pix: "Pix",
  fns: "FNS",
  favorecido: "Pago ao favorecido",
});

/**
 * As colunas de um canal: o válido e o pago, com os ids da lista dos autores (`convenio-valido`, `pix-pago`...). O pago
 * ao favorecido só tem o pago.
 */
export function colunasDoCanal(canal: CanalEmenda): ColunaTabela[] {
  const curto = CANAL_CURTO[canal] ?? canal;
  if (soPago(canal)) return [colunaNum(`${canal}-pago`, curto)];
  return [colunaNum(`${canal}-valido`, `${curto} válido`), colunaNum(`${canal}-pago`, `${curto} pago`)];
}

/** "De onde vêm as emendas", na aba do dinheiro do município (só administrador): o prefixo e as colunas, por canal. */
export const TABELA_EMENDAS_MUNICIPIO = "emendas-autor";
/** A linha da saúde fundo a fundo cujo autor a carga do FNS ainda não trouxe. */
export const SEM_AUTOR_FNS = "Saúde fundo a fundo ainda sem o autor";

export function colunasEmendasDoMunicipio(canais: readonly CanalEmenda[]): ColunaTabela[] {
  return [
    { id: "autor", titulo: "Autor", tipo: "texto" },
    { id: "codigo", titulo: "Código", tipo: "texto", textoNoCsv: true, oculta: true },
    { id: "tipo", titulo: "Tipo", tipo: "categoria" },
    ...canais.flatMap(colunasDoCanal),
  ];
}

/** A forma de `AutorNoMunicipio` (`pagina-municipio.ts`) que a tabela lê. */
export interface AutorDoMunicipioNaTabela {
  codigo: string | null;
  autor: Pick<AutorEmendas, "nome" | "tipo"> | null;
  canais: readonly { canal: CanalEmenda; valido: number | null; pago: number }[];
}

/** Os valores crus de um autor no município: o canal sem valor fica vazio (null), o zero fica zero. */
export function valoresDoAutorNoMunicipio(a: AutorDoMunicipioNaTabela, canais: readonly CanalEmenda[]): Record<string, ValorCelula> {
  const v: Record<string, ValorCelula> = {
    autor: a.codigo === null ? SEM_AUTOR_FNS : (a.autor?.nome ?? `Autor ${a.codigo}`),
    codigo: a.codigo,
    tipo: a.codigo === null ? null : (ROTULO_TIPO_AUTOR[a.autor?.tipo ?? "outro"] ?? ROTULO_TIPO_AUTOR.outro),
  };
  for (const canal of canais) {
    const c = a.canais.find((x) => x.canal === canal);
    if (!soPago(canal)) v[`${canal}-valido`] = c ? c.valido : null;
    v[`${canal}-pago`] = c ? c.pago : null;
  }
  return v;
}

const rotuloDoCanal = (canal: CanalEmenda) => ROTULO_CANAL[canal] ?? canal;

/** Acesso: a série por ano da emenda e canal. O ano é a coluna de cima da célula; o canal, oculto, filtra e vai ao CSV. */
export const TABELA_SERIE_ACESSO = "serie";
export const COLUNAS_SERIE_ACESSO: ColunaTabela[] = [
  { id: "ano", titulo: "Ano", tipo: "numero" },
  { id: "canal", titulo: "Canal", tipo: "categoria", oculta: true },
  colunaNum("emendas", "Emendas"),
  colunaNum("indicado", "Indicado"),
  colunaNum("valido", "Válido"),
  colunaNum("pago", "Pago"),
  colunaNum("caducado", "Caducado"),
];

export function valoresDaSerie(l: AnoCanalEmendas): Record<string, ValorCelula> {
  const so = soPago(l.canal);
  return {
    ano: l.ano,
    canal: rotuloDoCanal(l.canal),
    emendas: l.emendas,
    indicado: so ? null : l.indicado,
    valido: so ? null : l.valido,
    pago: l.pago,
    caducado: l.caducado,
  };
}

/** Destinação: os municípios. A situação (atendido ou só proposta) e o IBGE vão ocultos; os canais, como texto. */
export const TABELA_DESTINO_MUNICIPIOS = "destino";
export const ROTULO_ATENDIDO = Object.freeze({ sim: "Com instrumento válido ou pago", nao: "Só proposta ou caducado" });
export const COLUNAS_DESTINO_MUNICIPIOS: ColunaTabela[] = [
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "ibge", titulo: "IBGE", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "situacao", titulo: "Situação", tipo: "categoria", oculta: true },
  colunaNum("populacao", "População"),
  { id: "canais", titulo: "Canais", tipo: "texto" },
  colunaNum("instrumentos", "Instrumentos"),
  colunaNum("valido", "Válido"),
  colunaNum("pago", "Pago"),
  colunaNum("por-habitante", "Pago por habitante"),
];

export function valoresDoDestinoMunicipio(l: LinhaMunicipio): Record<string, ValorCelula> {
  return {
    municipio: l.nome,
    ibge: l.ibge,
    situacao: l.atendido ? ROTULO_ATENDIDO.sim : ROTULO_ATENDIDO.nao,
    populacao: l.populacao,
    canais: l.canais.map(rotuloDoCanal).join(" · "),
    instrumentos: l.instrumentos,
    valido: l.valido,
    pago: l.pago,
    "por-habitante": l.pagoPorHabitante,
  };
}

/** Destinação, à parte: o estadual (`estadual`) e a entidade com sede (`entidade`), duas tabelas de colunas diferentes. */
export function colunasAParte(comSede: boolean): ColunaTabela[] {
  return [
    { id: "ente", titulo: "Ente", tipo: "categoria" },
    { id: "canal", titulo: "Canal", tipo: "categoria", oculta: true },
    colunaNum("instrumentos", comSede ? "Instrumentos ou CNPJs" : "Instrumentos"),
    ...(comSede ? [colunaNum("municipios-sede", "Municípios da sede")] : []),
    colunaNum("valido", "Válido"),
    colunaNum("pago", "Pago"),
  ];
}

export function valoresDaLinhaAParte(l: LinhaResumo, comSede: boolean): Record<string, ValorCelula> {
  const v: Record<string, ValorCelula> = {
    ente: rotuloEnteTipo(l.ente_tipo),
    canal: rotuloDoCanal(l.canal),
    instrumentos: l.instrumentos,
    valido: soPago(l.canal) ? null : l.valido,
    pago: l.pago,
  };
  if (comSede) v["municipios-sede"] = l.municipiosSede;
  return v;
}

/**
 * Execução: pago ÷ válido na safra. As frações vão em pontos percentuais (92, e não 0,92), como a tela mostra: o filtro
 * se digita como se lê ("a partir de 50").
 */
export const TABELA_SAFRA = "safra";
export const COLUNAS_SAFRA: ColunaTabela[] = [
  { id: "safra", titulo: "Safra", tipo: "numero" },
  { id: "canal", titulo: "Canal", tipo: "categoria", oculta: true },
  colunaNum("valido-autor", "Válido do autor"),
  colunaNum("pago-autor", "Pago do autor"),
  colunaNum("fracao-autor", "Pago ÷ válido do autor (%)"),
  colunaNum("fracao-pb", "Pago ÷ válido da PB (%)"),
];

export function valoresDaSafra(l: ExecucaoNaSafra): Record<string, ValorCelula> {
  const pontos = (x: number | null) => (x === null || !Number.isFinite(x) ? null : x * 100);
  return {
    safra: l.ano,
    canal: rotuloDoCanal(l.canal),
    "valido-autor": l.validoAutor,
    "pago-autor": l.pagoAutor,
    "fracao-autor": pontos(l.fracaoAutor),
    "fracao-pb": pontos(l.fracaoPb),
  };
}
