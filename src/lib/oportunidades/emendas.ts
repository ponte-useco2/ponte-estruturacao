/**
 * Emendas parlamentares com destino à PB, para as telas de administrador (onda 14, parte 2, 13/10/2026). Lógica pura:
 * sem banco e sem Next; a leitura mora em `emendas.server.ts`.
 *
 * CONTRATO escrito pelo supervisor antes do disparo: os tipos e as assinaturas abaixo são o que as páginas usam. O agente
 * da lógica implementa os corpos (hoje lançam "a implementar") e pode ACRESCENTAR funções; não muda nome nem forma do
 * que já está aqui sem combinar com o supervisor.
 *
 * As regras que valem em toda tela (decisões do titular e achados da onda 13 e da prova da parte 1):
 *   · só administrador, até a revisão jurídica;
 *   · a chave é o código do autor (4 dígitos, do MANDATO); a pessoa só vem da tabela curada; nunca cruzar por nome;
 *   · bancada, comissão e relator-geral são autoria coletiva: ninguém é "padrinho";
 *   · sem nota única e sem ranking: as listas vão por tipo e nome, nunca "melhor" e "pior";
 *   · o CATÁLOGO (execução orçamentária do Portal) e o CANAL (convênio, Pix, FNS, favorecido) nunca se somam;
 *   · o valor do catálogo só aparece pelo recorte da PB (`catalogo_*_pb`): as emendas "Múltiplo" e "Nacional" trazem o
 *     valor do Brasil inteiro (o catálogo bruto das relevantes somou R$ 66,7 bi);
 *   · DESTINO na PB é o ente público: município e fundo municipal (com IBGE), e o estado e o fundo estadual (sem IBGE, à
 *     parte). Empresa, OSC e outros favorecidos com sede na PB NÃO são destino: aparecem separados, como "pago a
 *     entidade com sede na PB";
 *   · valor por habitante = soma ÷ soma da população (nunca a média dos municípios);
 *   · execução só se compara na MESMA safra (ano da emenda) e no mesmo canal;
 *   · "caducou" (proposta nunca assinada, depois de 31/12 do ano seguinte ao da emenda) fica à parte, fora da fila;
 *   · "ponto para olhar", nunca "irregular"; a vez de quem age só quando o dado diz.
 *
 * Os corpos e as funções acrescentadas (onda 14, parte 2, A, 13/10/2026), conferidos pelo MCP na execução 1:
 *   · `separarDestino` deixa fora das três classes do contrato o ente municipal SEM IBGE (17 linhas do favorecido na
 *     PB, R$ 4,9 mi, com o município não identificado) e a linha sem tipo de ente. Não é destino municipal (não há
 *     município para pôr no mapa) nem entidade: sai em `destinoNaoClassificado`, para a página dizer quanto ficou de fora;
 *   · o consórcio, o órgão federal e o "outro" vão com a empresa e a OSC em `entidadeComSede`: atendem região, sem per
 *     capita municipal (estudo B da onda 13, §4.1);
 *   · o rótulo do tipo "individual" é "Individual", e não "Deputado(a) federal": o código individual também é de
 *     senador (4088, 4218 e 4270 na PB), e a Casa só virá com a tabela oficial de autores;
 *   · o rótulo do canal "favorecido" é "Pago ao favorecido", e não "Pago a entidade": 79% do que esse canal soma vai a
 *     município e a fundo municipal, e "entidade com sede na PB" é o nome do bloco que NÃO é destino;
 *   · o canal favorecido não tem escada (só o pago): a medida "válido" dele é zero, e ele fica fora da execução na safra.
 */
import { dataBrasilia } from "./datas.ts";

export type CanalEmenda = "convenio" | "pix" | "fns" | "favorecido";
export type TipoAutor = "individual" | "bancada" | "comissao" | "relator" | "outro";
export type EnteTipoEmenda =
  | "municipio" | "fundo_municipal" | "estado" | "fundo_estadual" | "consorcio" | "osc" | "empresa" | "orgao_federal" | "outro";

/** Uma linha de `emd_autores()` (oport_39). Valores em reais. */
export interface AutorEmendas {
  codigo: string;
  nome: string | null;
  tipo: TipoAutor;
  coletivo: boolean;
  pessoa: string | null;
  emendas: number;
  ano_min: number | null;
  ano_max: number | null;
  convenio_indicado: number;
  convenio_valido: number;
  convenio_pago: number;
  pix_indicado: number;
  pix_valido: number;
  pix_pago: number;
  fns_indicado: number;
  fns_valido: number;
  fns_pago: number;
  favorecido_pago: number;
  caducados: number;
  caducado_valor: number;
  na_fila: number;
  municipios: number;
  catalogo_empenhado: number; // NUNCA mostrar: inclui o Brasil inteiro das emendas "Múltiplo"/"Nacional"
  catalogo_pago_total: number; // idem
  catalogo_a_pagar: number; // idem
  catalogo_empenhado_pb: number;
  catalogo_pago_total_pb: number;
}

/** Uma linha de `emd_destino(p_autor, p_ibge)`: município × autor × canal × tipo do ente. */
export interface DestinoEmendas {
  ibge: string | null;
  autor_codigo: string | null; // null = proposta do FNS ainda sem o detalhe (conta no município, não no autor)
  canal: CanalEmenda;
  ente_tipo: EnteTipoEmenda | null;
  instrumentos: number;
  emendas: number;
  indicado: number;
  valido: number;
  pago: number;
  caducado: number;
}

/** Uma linha de `emd_autor_anos(p_autor)`. */
export interface AnoCanalEmendas {
  ano: number;
  canal: CanalEmenda;
  emendas: number;
  indicado: number;
  valido: number;
  pago: number;
  caducado: number;
}

/** Uma linha de `emd_safra()`: toda a PB por ano da emenda, canal e tipo de autor. */
export interface SafraEmendas {
  ano: number;
  canal: CanalEmenda;
  tipo: TipoAutor;
  autores: number;
  emendas: number;
  valido: number;
  pago: number;
}

/** A execução publicada que as telas leem (a data do dado e a de quando o job rodou). */
export interface ExecucaoEmendas {
  id: number;
  concluidaEm: string;
  dadoAte: string | null; // Last-Modified do arquivo do Portal
  fnsPendentes: number; // propostas do FNS ainda sem o detalhe (carga histórica em curso)
}

/** Município da PB: nome e população (de `fiscal_municipio`, a mesma base do fiscal). */
export interface MunicipioPopulacao {
  ibge: string;
  nome: string;
  populacao: number | null;
}

export type Leitura<T> = ({ estado: "ok" } & T) | { estado: "sem_dado" } | { estado: "falha" };

export type LeituraParlamentares = Leitura<{ execucao: ExecucaoEmendas; autores: AutorEmendas[] }>;

export type LeituraParlamentar =
  | Leitura<{
      execucao: ExecucaoEmendas;
      autor: AutorEmendas;
      anos: AnoCanalEmendas[];
      destino: DestinoEmendas[];
      safra: SafraEmendas[];
      municipios: MunicipioPopulacao[];
    }>
  | { estado: "nao_encontrado" };

export type LeituraEmendasMunicipio = Leitura<{
  execucao: ExecucaoEmendas;
  destino: DestinoEmendas[]; // emd_destino(p_ibge)
  autores: Pick<AutorEmendas, "codigo" | "nome" | "tipo" | "coletivo" | "pessoa">[];
}>;

/** O código de autor da URL: exatamente 4 dígitos; senão null (a página dá o 404 de sempre, sem ler o banco). */
export function codigoAutorDaUrl(v: string | null | undefined): string | null {
  return typeof v === "string" && /^\d{4}$/.test(v) ? v : null;
}

/**
 * "Individual", "Bancada", "Comissão", "Relator-geral", "Outro": o rótulo do tipo, sem juízo. O contrato dizia
 * "Deputado(a) federal" para o individual; o código individual também é de senador, e a Casa ainda não está no dado
 * (onda 14, parte 2, A, 13/10/2026).
 */
export const ROTULO_TIPO_AUTOR: Readonly<Record<TipoAutor, string>> = Object.freeze({
  individual: "Individual",
  bancada: "Bancada",
  comissao: "Comissão",
  relator: "Relator-geral",
  outro: "Outro",
});
export function rotuloTipoAutor(tipo: TipoAutor): string {
  return ROTULO_TIPO_AUTOR[tipo] ?? ROTULO_TIPO_AUTOR.outro;
}

/**
 * "Convênio", "Pix (transferência especial)", "Saúde fundo a fundo (FNS)", "Pago ao favorecido". O contrato dizia
 * "Pago a entidade" para o favorecido; o canal também paga município e fundo municipal (onda 14, parte 2, A, 13/10/2026).
 */
export const ROTULO_CANAL: Readonly<Record<CanalEmenda, string>> = Object.freeze({
  convenio: "Convênio",
  pix: "Pix (transferência especial)",
  fns: "Saúde fundo a fundo (FNS)",
  favorecido: "Pago ao favorecido",
});
export function rotuloCanal(canal: CanalEmenda): string {
  return ROTULO_CANAL[canal] ?? canal;
}

/** A ordem fixa dos canais e dos tipos nas telas: nunca por valor (onda 14, parte 2, A, 13/10/2026). */
export const CANAIS: readonly CanalEmenda[] = Object.freeze(["convenio", "pix", "fns", "favorecido"] as CanalEmenda[]);
export const TIPOS_AUTOR: readonly TipoAutor[] = Object.freeze(["individual", "bancada", "comissao", "relator", "outro"] as TipoAutor[]);
const ordemCanal = (c: CanalEmenda): number => {
  const k = CANAIS.indexOf(c);
  return k < 0 ? CANAIS.length : k;
};
const ordemTipo = (t: TipoAutor): number => {
  const k = TIPOS_AUTOR.indexOf(t);
  return k < 0 ? TIPOS_AUTOR.length : k;
};

/** O rótulo do tipo do ente, para as tabelas de destino (onda 14, parte 2, A, 13/10/2026). */
export const ROTULO_ENTE_TIPO: Readonly<Record<EnteTipoEmenda, string>> = Object.freeze({
  municipio: "Município",
  fundo_municipal: "Fundo municipal",
  estado: "Governo do estado",
  fundo_estadual: "Fundo estadual",
  consorcio: "Consórcio",
  osc: "OSC",
  empresa: "Empresa",
  orgao_federal: "Órgão federal",
  outro: "Outro",
});
export function rotuloEnteTipo(tipo: EnteTipoEmenda | null): string {
  return tipo ? (ROTULO_ENTE_TIPO[tipo] ?? "Outro") : "Não informado";
}

/** O destino na PB, separado: ente público municipal (com IBGE), estadual (sem IBGE) e entidade com sede na PB. */
export interface DestinoSeparado {
  municipal: DestinoEmendas[];
  estadual: DestinoEmendas[];
  entidadeComSede: DestinoEmendas[];
}

/**
 * A classe de uma linha de destino (onda 14, parte 2, A, 13/10/2026):
 *   · municipal: município ou fundo municipal COM IBGE (o banco grava o IBGE do ente, nunca o da sede de empresa);
 *   · estadual: governo do estado ou fundo estadual (o banco grava sempre sem IBGE: a sede não é o destino);
 *   · entidadeComSede: empresa, OSC, consórcio, órgão federal e "outro", com ou sem IBGE: nunca destino municipal;
 *   · naoClassificado: ente municipal sem IBGE (o município não foi identificado) e linha sem tipo de ente.
 */
export type ClasseDestino = keyof DestinoSeparado | "naoClassificado";
const ENTES_MUNICIPAIS: ReadonlySet<string> = new Set(["municipio", "fundo_municipal"]);
const ENTES_ESTADUAIS: ReadonlySet<string> = new Set(["estado", "fundo_estadual"]);
const ENTIDADES: ReadonlySet<string> = new Set(["empresa", "osc", "consorcio", "orgao_federal", "outro"]);

export function classeDestino(d: Pick<DestinoEmendas, "ibge" | "ente_tipo">): ClasseDestino {
  const t = d.ente_tipo;
  if (t && ENTES_MUNICIPAIS.has(t)) return d.ibge && /^\d{7}$/.test(d.ibge) ? "municipal" : "naoClassificado";
  if (t && ENTES_ESTADUAIS.has(t)) return "estadual";
  if (t && ENTIDADES.has(t)) return "entidadeComSede";
  return "naoClassificado";
}

export function separarDestino(destino: DestinoEmendas[]): DestinoSeparado {
  const saida: DestinoSeparado = { municipal: [], estadual: [], entidadeComSede: [] };
  for (const d of destino) {
    const c = classeDestino(d);
    if (c !== "naoClassificado") saida[c].push(d);
  }
  return saida;
}

/** As linhas que `separarDestino` deixa fora das três classes (ver `classeDestino`), para a página dizer quanto. */
export function destinoNaoClassificado(destino: DestinoEmendas[]): DestinoEmendas[] {
  return destino.filter((d) => classeDestino(d) === "naoClassificado");
}

/** A soma das medidas de um conjunto de linhas de destino (do mesmo canal ou não: os canais não se cobrem). */
export interface SomaDestino {
  indicado: number;
  valido: number;
  pago: number;
  caducado: number;
}
export function somarDestino(linhas: DestinoEmendas[]): SomaDestino {
  const s: SomaDestino = { indicado: 0, valido: 0, pago: 0, caducado: 0 };
  for (const d of linhas) {
    s.indicado += numero(d.indicado);
    s.valido += numero(d.valido);
    s.pago += numero(d.pago);
    s.caducado += numero(d.caducado);
  }
  return s;
}

const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Valor por habitante do destino municipal: soma do pago (ou do válido) ÷ soma da população dos municípios atendidos,
 * e a fatia que vai aos municípios menores (o quinto de menor população da PB) contra a fatia deles na população.
 */
export interface PorHabitante {
  atendidos: number;
  populacaoAtendida: number;
  valorPorHabitante: number | null;
  fatiaMenores: number | null; // fatia do valor nos 20% menores municípios da PB
  fatiaPopulacaoMenores: number | null; // fatia da população da PB nesses municípios
}
/**
 * Regras (onda 14, parte 2, A, 13/10/2026):
 *   · só entra a linha municipal com IBGE (`classeDestino`), mesmo que a página passe o destino inteiro;
 *   · o município sem população (ou fora da lista) fica fora do numerador E do denominador, e fora de `atendidos`;
 *   · `atendidos` = municípios com valor > 0 na medida e com população: é a base da razão, e não o `municipios` de
 *     `emd_autores` (que conta o válido OU o favorecido, sem olhar a medida);
 *   · `valorPorHabitante` = soma do valor ÷ soma da população dos atendidos (nunca a média das razões);
 *   · os menores são o quinto de menor população entre os municípios com população da lista (223 → 45), em ordem de
 *     população e, no empate, de IBGE; `fatiaMenores` é a fatia do valor deles no valor dos atendidos, e
 *     `fatiaPopulacaoMenores`, a fatia deles na população da lista inteira (não só dos atendidos);
 *   · na medida "valido", o canal favorecido soma zero: ele não tem escada, só o pago.
 */
export function porHabitante(municipal: DestinoEmendas[], municipios: MunicipioPopulacao[], medida: "pago" | "valido"): PorHabitante {
  const populacao = populacaoPorIbge(municipios);
  const menores = quintoMenor(populacao);

  const valor = new Map<string, number>();
  for (const d of municipal) {
    if (classeDestino(d) !== "municipal") continue;
    const ibge = d.ibge as string;
    valor.set(ibge, (valor.get(ibge) ?? 0) + numero(d[medida]));
  }

  let atendidos = 0;
  let populacaoAtendida = 0;
  let soma = 0;
  let somaMenores = 0;
  for (const [ibge, v] of valor) {
    const p = populacao.get(ibge);
    if (p === undefined || !(v > 0)) continue;
    atendidos += 1;
    populacaoAtendida += p;
    soma += v;
    if (menores.has(ibge)) somaMenores += v;
  }

  let populacaoTotal = 0;
  let populacaoMenores = 0;
  for (const [ibge, p] of populacao) {
    populacaoTotal += p;
    if (menores.has(ibge)) populacaoMenores += p;
  }

  return {
    atendidos,
    populacaoAtendida,
    valorPorHabitante: populacaoAtendida > 0 ? soma / populacaoAtendida : null,
    fatiaMenores: soma > 0 && menores.size > 0 ? somaMenores / soma : null,
    fatiaPopulacaoMenores: populacaoTotal > 0 && menores.size > 0 ? populacaoMenores / populacaoTotal : null,
  };
}

/** A população válida (> 0) por IBGE; o resto fica de fora. */
function populacaoPorIbge(municipios: MunicipioPopulacao[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of municipios) {
    const p = x.populacao;
    if (typeof p === "number" && Number.isFinite(p) && p > 0 && /^\d{7}$/.test(x.ibge)) m.set(x.ibge, p);
  }
  return m;
}

/** O quinto de menor população (arredondado: 223 → 45), em ordem de população e, no empate, de IBGE. */
function quintoMenor(populacao: Map<string, number>): Set<string> {
  const k = Math.round(populacao.size / 5);
  return new Set(
    [...populacao]
      .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, k)
      .map(([ibge]) => ibge),
  );
}

/** Os IBGEs do quinto de menor população da lista (a mesma regra de `porHabitante`), para a curva e o mapa. */
export function municipiosMenores(municipios: MunicipioPopulacao[]): Set<string> {
  return quintoMenor(populacaoPorIbge(municipios));
}

/** Um município da lista com o valor de um autor (ou de todos) nele: a tabela e o mapa dos 223, em ordem de nome. */
export interface DestinoMunicipio {
  ibge: string;
  nome: string;
  populacao: number | null;
  valor: number;
  /** null sem população ou sem valor. */
  valorPorHabitante: number | null;
  atendido: boolean;
  menor: boolean;
}

/**
 * Os municípios da lista (os 223), cada um com o valor da medida no destino municipal e o valor por habitante dele, em
 * ordem de nome, nunca de valor (onda 14, parte 2, A, 13/10/2026). Os não atendidos ficam na lista, com valor zero: a
 * tela mostra "n de 223 sem emenda". O IBGE do destino que não está na lista entra no fim, com o próprio IBGE como nome.
 */
export function destinoPorMunicipio(
  municipal: DestinoEmendas[],
  municipios: MunicipioPopulacao[],
  medida: "pago" | "valido",
): DestinoMunicipio[] {
  const valor = new Map<string, number>();
  for (const d of municipal) {
    if (classeDestino(d) !== "municipal") continue;
    const ibge = d.ibge as string;
    valor.set(ibge, (valor.get(ibge) ?? 0) + numero(d[medida]));
  }
  const menores = municipiosMenores(municipios);
  const conhecidos = new Set<string>();
  const linha = (ibge: string, nome: string, populacao: number | null): DestinoMunicipio => {
    const v = valor.get(ibge) ?? 0;
    const p = typeof populacao === "number" && Number.isFinite(populacao) && populacao > 0 ? populacao : null;
    return { ibge, nome, populacao, valor: v, valorPorHabitante: p && v > 0 ? v / p : null, atendido: v > 0, menor: menores.has(ibge) };
  };
  const lista: DestinoMunicipio[] = [];
  for (const m of municipios) {
    if (conhecidos.has(m.ibge)) continue;
    conhecidos.add(m.ibge);
    lista.push(linha(m.ibge, m.nome, m.populacao));
  }
  lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || (a.ibge < b.ibge ? -1 : 1));
  const fora = [...valor.keys()].filter((ibge) => !conhecidos.has(ibge)).sort().map((ibge) => linha(ibge, ibge, null));
  return [...lista, ...fora];
}

/** A execução do autor contra a PB na mesma safra e canal: pago ÷ válido dele e da PB, por ano. */
export interface ExecucaoNaSafra {
  ano: number;
  canal: CanalEmenda;
  validoAutor: number;
  pagoAutor: number;
  fracaoAutor: number | null;
  fracaoPb: number | null;
}
/**
 * Regras (onda 14, parte 2, A, 13/10/2026):
 *   · a PB é a linha de `emd_safra` do MESMO ano, canal e tipo de autor (o próprio autor está dentro dela);
 *   · ano e canal sem a linha da PB, ou com válido zero na PB: `fracaoPb` null (nunca compara com outro ano);
 *   · válido zero do autor: `fracaoAutor` null;
 *   · o canal favorecido fica fora: não tem escada (válido sempre zero), só o pago;
 *   · ordem por ano e pela ordem fixa dos canais; linhas repetidas do mesmo ano e canal somam.
 */
export function execucaoNaSafra(anos: AnoCanalEmendas[], safra: SafraEmendas[], tipo: TipoAutor): ExecucaoNaSafra[] {
  const chave = (ano: number, canal: CanalEmenda) => `${ano}|${canal}`;
  const pb = new Map<string, { valido: number; pago: number }>();
  for (const s of safra) {
    if (s.tipo !== tipo || s.canal === "favorecido" || !Number.isInteger(s.ano)) continue;
    const k = chave(s.ano, s.canal);
    const x = pb.get(k) ?? { valido: 0, pago: 0 };
    x.valido += numero(s.valido);
    x.pago += numero(s.pago);
    pb.set(k, x);
  }
  const autor = new Map<string, { ano: number; canal: CanalEmenda; valido: number; pago: number }>();
  for (const a of anos) {
    if (a.canal === "favorecido" || !Number.isInteger(a.ano)) continue;
    const k = chave(a.ano, a.canal);
    const x = autor.get(k) ?? { ano: a.ano, canal: a.canal, valido: 0, pago: 0 };
    x.valido += numero(a.valido);
    x.pago += numero(a.pago);
    autor.set(k, x);
  }
  return [...autor.entries()]
    .map(([k, a]): ExecucaoNaSafra => {
      const p = pb.get(k);
      return {
        ano: a.ano,
        canal: a.canal,
        validoAutor: a.valido,
        pagoAutor: a.pago,
        fracaoAutor: a.valido > 0 ? a.pago / a.valido : null,
        fracaoPb: p && p.valido > 0 ? p.pago / p.valido : null,
      };
    })
    .sort((x, y) => x.ano - y.ano || ordemCanal(x.canal) - ordemCanal(y.canal));
}

// ================================================================ acrescentadas (onda 14, parte 2, A, 13/10/2026)

/** Um canal do autor: a escada indicado → válido → pago. O favorecido só tem o pago (indicado e válido null). */
export interface CanalDoAutor {
  canal: CanalEmenda;
  indicado: number | null;
  valido: number | null;
  pago: number;
}
/**
 * O resumo do autor por canal, na ordem fixa, e os totais dos canais. O catálogo (execução orçamentária do Portal)
 * nunca entra: é o mesmo dinheiro visto de outro lugar. Os canais somam entre si (o banco já tirou o que um canal
 * cobre do outro). `validoTotal` é dos canais com escada (convênio, Pix e FNS); `pagoTotal` inclui o favorecido: por
 * isso a razão entre os dois NÃO é a execução do autor (para ela, `execucaoNaSafra`).
 */
export interface ResumoAutor {
  canais: CanalDoAutor[];
  validoTotal: number;
  pagoTotal: number;
}
export function resumoPorCanal(a: AutorEmendas): ResumoAutor {
  const canais: CanalDoAutor[] = [
    { canal: "convenio", indicado: numero(a.convenio_indicado), valido: numero(a.convenio_valido), pago: numero(a.convenio_pago) },
    { canal: "pix", indicado: numero(a.pix_indicado), valido: numero(a.pix_valido), pago: numero(a.pix_pago) },
    { canal: "fns", indicado: numero(a.fns_indicado), valido: numero(a.fns_valido), pago: numero(a.fns_pago) },
    { canal: "favorecido", indicado: null, valido: null, pago: numero(a.favorecido_pago) },
  ];
  return {
    canais,
    validoTotal: canais.reduce((s, c) => s + (c.valido ?? 0), 0),
    pagoTotal: canais.reduce((s, c) => s + c.pago, 0),
  };
}

/** Os canais em que o autor tem algum valor (indicado ou pago), na ordem fixa. */
export function canaisComValor(a: AutorEmendas): CanalEmenda[] {
  return resumoPorCanal(a).canais.filter((c) => (c.indicado ?? 0) > 0 || c.pago > 0).map((c) => c.canal);
}

/** Os autores em ordem de tipo (a ordem fixa) e de nome, e no fim o código: nunca por valor, nunca ranking. */
export function ordenarAutores<T extends Pick<AutorEmendas, "codigo" | "nome" | "tipo">>(autores: readonly T[]): T[] {
  return [...autores].sort(
    (a, b) =>
      ordemTipo(a.tipo) - ordemTipo(b.tipo) ||
      (a.nome ?? "￿").localeCompare(b.nome ?? "￿", "pt-BR") ||
      (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0),
  );
}

/** O destino de um município (ou de um recorte) por autor: o bloco "de onde vêm as emendas". */
export interface DestinoDoAutor {
  /** null: proposta do FNS ainda sem o detalhe (conta no município, não no autor). */
  codigo: string | null;
  autor: Pick<AutorEmendas, "codigo" | "nome" | "tipo" | "coletivo" | "pessoa"> | null;
  canais: CanalEmenda[];
  indicado: number;
  valido: number;
  pago: number;
  caducado: number;
}
/**
 * Soma as linhas de destino por autor e canal, em ordem de tipo e nome do autor (nunca de valor); o autor sem a linha
 * em `autores` vai no fim do tipo "outro", e o FNS sem detalhe (código null), no fim de tudo. Passe o recorte que a
 * tela quer (o `municipal` de `separarDestino`, ou o destino inteiro com a classe à parte).
 */
export function destinoPorAutor(
  destino: DestinoEmendas[],
  autores: Pick<AutorEmendas, "codigo" | "nome" | "tipo" | "coletivo" | "pessoa">[],
): DestinoDoAutor[] {
  const porCodigo = new Map(autores.map((a) => [a.codigo, a]));
  const grupos = new Map<string, DestinoDoAutor>();
  for (const d of destino) {
    const k = d.autor_codigo ?? "";
    const g =
      grupos.get(k) ??
      ({ codigo: d.autor_codigo, autor: d.autor_codigo ? (porCodigo.get(d.autor_codigo) ?? null) : null, canais: [], indicado: 0, valido: 0, pago: 0, caducado: 0 } as DestinoDoAutor);
    if (!g.canais.includes(d.canal)) g.canais.push(d.canal);
    g.indicado += numero(d.indicado);
    g.valido += numero(d.valido);
    g.pago += numero(d.pago);
    g.caducado += numero(d.caducado);
    grupos.set(k, g);
  }
  for (const g of grupos.values()) g.canais.sort((a, b) => ordemCanal(a) - ordemCanal(b));
  const posicao = (g: DestinoDoAutor) => (g.codigo === null ? 2 : g.autor ? 0 : 1);
  return [...grupos.values()].sort(
    (a, b) =>
      posicao(a) - posicao(b) ||
      ordemTipo(a.autor?.tipo ?? "outro") - ordemTipo(b.autor?.tipo ?? "outro") ||
      (a.autor?.nome ?? "￿").localeCompare(b.autor?.nome ?? "￿", "pt-BR") ||
      ((a.codigo ?? "") < (b.codigo ?? "") ? -1 : (a.codigo ?? "") > (b.codigo ?? "") ? 1 : 0),
  );
}

/** As frases fixas das telas: o método, o agente público e a autoria coletiva. */
export const FRASE_METODO =
  "Valores pelos canais com destino na Paraíba (convênio, Pix, saúde fundo a fundo e pagamento ao favorecido), cada real " +
  "contado uma vez; a execução orçamentária do Portal da Transparência fica à parte e nunca se soma aos canais. A escada " +
  "é indicado, válido e pago: o indicado não é dinheiro recebido. Por habitante é a soma do valor dividida pela soma da " +
  "população dos municípios atendidos. A execução só se compara na mesma safra (ano da emenda) e no mesmo canal.";
export const FRASE_AGENTE_PUBLICO =
  "Agente público. A execução depende também do município, da entidade e do órgão; cada ponto diz quem resolve.";
export const FRASE_AUTORIA_COLETIVA = "Autoria coletiva: o dado aberto não identifica quem indicou cada destino.";
export const FRASE_ENTIDADE_COM_SEDE =
  "Pago a entidade com sede na Paraíba (empresa, OSC, consórcio ou órgão federal): não é destino municipal nem entra no valor por habitante.";

/** A nota do autor: a do agente público e, se for bancada, comissão ou relator-geral, a da autoria coletiva. */
export function notasDoAutor(a: Pick<AutorEmendas, "coletivo">): string[] {
  return a.coletivo ? [FRASE_AGENTE_PUBLICO, FRASE_AUTORIA_COLETIVA] : [FRASE_AGENTE_PUBLICO];
}

/** A data do dado (o arquivo do Portal) e a da rodada, em "DD/MM/AAAA" de Brasília; "—" quando não há. */
export function datasDaExecucao(e: Pick<ExecucaoEmendas, "dadoAte" | "concluidaEm">): { dadoAte: string; rodouEm: string } {
  return { dadoAte: dataBrasilia(e.dadoAte), rodouEm: dataBrasilia(e.concluidaEm) };
}

/**
 * O aviso da carga histórica do FNS: as propostas ainda sem o detalhe contam no município e não no autor, e o valor de
 * saúde por autor ainda vai crescer. null quando não há pendência.
 */
export function avisoFnsPendente(e: Pick<ExecucaoEmendas, "fnsPendentes">): string | null {
  const n = Number.isFinite(e.fnsPendentes) ? Math.max(0, Math.trunc(e.fnsPendentes)) : 0;
  if (n === 0) return null;
  const qtd = n.toLocaleString("pt-BR");
  return `Carga histórica da saúde fundo a fundo em curso: ${qtd} ${n === 1 ? "proposta ainda sem" : "propostas ainda sem"} o detalhe do autor. Elas contam no município, não no autor; o valor de saúde por autor ainda vai crescer.`;
}
