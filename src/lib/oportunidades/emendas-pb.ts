/**
 * As emendas impositivas da Assembleia Legislativa da Paraíba (emendas estaduais, E2, 16/10/2026): a lógica das telas
 * de administrador, pura, sem banco e sem React, com teste. A leitura mora em `emendas-pb.server.ts`; as tabelas são as
 * `epb_*` da `oport_41`, gravadas pelo job `emendas_pb/` (semanal, no runner da máquina do titular).
 *
 * As regras (as das emendas federais, ajustadas; `Site-Ponte/emendas-estaduais-pb/PLANO.md`, seção 3):
 *   · a chave é a EMENDA (`NNNN/AAAA`). O CATÁLOGO (execução orçamentária: valor, empenhado e pago) e o DESTINO (o
 *     empenho: credor × município) são o mesmo dinheiro visto de dois lugares e NUNCA se somam;
 *   · o deputado vem da semente curada (`emendas_pb/seeds/deputado_estadual.csv`), ligada pelo código da emenda; o nome
 *     é o publicado (deputado é agente público). Sem ranking: a lista vai por nome, e ordenar por valor é leitura do
 *     administrador, não posição;
 *   · a "vez" só quando o dado diz: há a data do último passo e o seguinte está vazio. "Empenhada" é empenhada e ainda
 *     não paga por inteiro (em 2021, 161 de 164 com o empenho por pagar, em 16/10/2026);
 *   · o destino vale pela MODALIDADE da emenda no catálogo: na transferência a municípios, o credor é a prefeitura ou o
 *     fundo, e o município dele é o atendido; na transferência a entidade sem fins lucrativos, o credor é a entidade, e
 *     o município é a sede dela; na aplicação direta, o credor é fornecedor do Estado, e o município dele não é destino;
 *   · pessoa física credora só somada (`epb_pf`), sem nome nem documento;
 *   · o nome do servidor de cada passo (`epb_tramite.responsavel`) e o nome do credor pessoa jurídica: só administrador.
 *     Todas as telas daqui são de administrador até a revisão jurídica;
 *   · "ponto para olhar", nunca "irregular".
 */

// ================================================================ o que vem do banco

export interface ExecucaoEpb {
  id: number;
  concluidaEm: string;
  /** O instante da leitura da API (a API não informa a data do dado). */
  dadoAte: string | null;
  /** O dia da rodada, em Brasília. */
  referencia: string | null;
  anosLidos: number[];
}

/** `epb_ficha`: uma por emenda, com o passo atual do caminho. */
export interface FichaEpb {
  ano: number;
  emenda: string;
  prioridade: number | null;
  deputado_publicado: string | null;
  pessoa: string | null;
  autoria_divergente: boolean;
  no_catalogo: boolean;
  tipo: string | null;
  secretaria: string | null;
  objeto: string | null;
  retificacao_objeto: string | null;
  beneficiario_final: string | null;
  beneficiario_retido: boolean;
  tipo_entidade: string | null;
  valor: number;
  passo: PassoEpb;
  passo_em: string | null;
  devolvida: boolean;
  datas_fora_de_ordem: boolean;
}

/** `epb_emenda`: o catálogo, uma linha por classificação (`seq`). */
export interface CatalogoEpb {
  ano: number;
  emenda: string;
  seq: number;
  autor_publicado: string | null;
  pessoa: string | null;
  orgao: string | null;
  unidade: string | null;
  funcao: string | null;
  subfuncao: string | null;
  programa: string | null;
  acao: string | null;
  natureza: string | null;
  fonte_recurso: string | null;
  modalidade: string | null;
  elemento: string | null;
  valor_emenda: number;
  empenhado: number;
  liquidado: number;
  pago: number;
}

/** `epb_destino`: emenda × credor pessoa jurídica × município × órgão. */
export interface DestinoEpb {
  ano: number;
  emenda: string;
  credor_cnpj: string;
  credor_nome: string | null;
  ibge: string | null;
  municipio: string | null;
  orgao: string | null;
  empenhado: number;
  liquidado: number;
  pago: number;
  notas: number;
  primeira: string | null;
  ultima: string | null;
}

/** `epb_autor`: a pessoa curada e as grafias publicadas. */
export interface AutorEpb {
  pessoa: string;
  pessoa_fonte: string | null;
  grafias_catalogo: string[];
  grafias_ficha: string[];
  emendas: number;
  anos: number[];
}

/** `epb_pf`: a pessoa física credora, só somada, por emenda. */
export interface PfEpb {
  ano: number;
  emenda: string;
  empenhado: number;
  pago: number;
  notas: number;
}

/** `epb_tramite`: um passo datado da ficha, com o parecer (mascarado) e o responsável (servidor; só administrador). */
export interface TramiteEpb {
  emenda: string;
  ordem: number;
  passo: Exclude<PassoEpb, "nenhum" | "empenhada" | "paga">;
  data: string | null;
  texto: string | null;
  responsavel: string | null;
}

export interface RetratoEpb {
  execucao: ExecucaoEpb;
  fichas: FichaEpb[];
  catalogo: CatalogoEpb[];
  destinos: DestinoEpb[];
  autores: AutorEpb[];
  pf: PfEpb[];
}

export type LeituraAssembleia = { estado: "ok"; retrato: RetratoEpb } | { estado: "sem_dado" } | { estado: "falha" };
export type LeituraEmendaEpb =
  | { estado: "ok"; retrato: RetratoEpb; emenda: string; tramites: TramiteEpb[] }
  | { estado: "nao_encontrado" }
  | { estado: "sem_dado" }
  | { estado: "falha" };

// ================================================================ o caminho

export type PassoEpb = "nenhum" | "envio" | "seplag" | "sec_seplag" | "cronograma_sefaz" | "sec_sefaz" | "empenhada" | "paga";

/** A ordem do caminho, do primeiro ao último. */
export const PASSOS_EPB: readonly PassoEpb[] = ["nenhum", "envio", "seplag", "sec_seplag", "cronograma_sefaz", "sec_sefaz", "empenhada", "paga"];

/** O passo como a tela escreve: o que já aconteceu. */
export const ROTULO_PASSO: Record<PassoEpb, string> = {
  nenhum: "Sem passo datado",
  envio: "Enviada à SEPLAG",
  seplag: "Parecer da SEPLAG",
  sec_seplag: "Aprovada pelo secretário da SEPLAG",
  cronograma_sefaz: "No cronograma da SEFAZ",
  sec_sefaz: "Aprovada pelo secretário da SEFAZ",
  empenhada: "Empenhada, falta pagar",
  paga: "Paga",
};

/**
 * De quem é a vez depois de cada passo: o passo seguinte do caminho, que está vazio. Só quando o dado diz (há a data do
 * passo); "sem passo datado" e "paga" não têm vez.
 */
export const VEZ_DEPOIS: Record<PassoEpb, string | null> = {
  nenhum: null,
  envio: "SEPLAG (parecer técnico)",
  seplag: "Secretário da SEPLAG",
  sec_seplag: "SEFAZ (cronograma)",
  cronograma_sefaz: "Secretário da SEFAZ",
  sec_sefaz: "Órgão executor (empenho)",
  empenhada: "Órgão executor (pagamento)",
  paga: null,
};

export const ordemDoPasso = (p: PassoEpb): number => {
  const i = PASSOS_EPB.indexOf(p);
  return i < 0 ? 0 : i;
};

// ================================================================ a modalidade (o destino)

export type GrupoModalidade = "municipios" | "entidades" | "direta" | "outras";

export const ROTULO_MODALIDADE: Record<GrupoModalidade, string> = {
  municipios: "Transferência a municípios",
  entidades: "Entidade sem fins lucrativos",
  direta: "Aplicação direta do Estado",
  outras: "Outras modalidades",
};

/** O grupo da modalidade do catálogo, pelo texto publicado ("TRANSFERÊNCIAS A MUNICÍPIOS"...). */
export function grupoModalidade(modalidade: string | null | undefined): GrupoModalidade {
  const t = dobrar(modalidade ?? "");
  if (/MUNICIPIO/.test(t)) return "municipios";
  if (/SEM FINS LUCRATIVOS/.test(t)) return "entidades";
  if (/APLICAC(AO|OES) DIRETA/.test(t)) return "direta";
  return "outras";
}

// ================================================================ utilidades

export function dobrar(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const DATA_PURA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 24 * 3600 * 1000;

/** Dias entre duas datas "AAAA-MM-DD" (de → até); null se uma falta ou não é data. */
export function diasEntre(de: string | null, ate: string): number | null {
  if (!de || !DATA_PURA.test(de) || !DATA_PURA.test(ate)) return null;
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS);
}

/** A razão em %, ou null quando a base é zero. */
export function pct(parte: number, base: number): number | null {
  return base > 0 ? Math.round((parte / base) * 1000) / 10 : null;
}

// ================================================================ endereços

export const URL_ASSEMBLEIA = "/mapa/parlamentares/assembleia";
export const URL_FILA_EPB = "/mapa/parlamentares/assembleia/fila";

/** "DR. ERICO" → "dr-erico". Só letras sem acento, dígitos e hífen. */
export function slugPessoa(pessoa: string): string {
  return dobrar(pessoa)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function urlDeputado(pessoa: string): string {
  return `${URL_ASSEMBLEIA}/${slugPessoa(pessoa)}`;
}

/** O slug do endereço, só se tiver a forma de um (o resto nem chega a procurar). */
export function slugDaUrl(v: string | null | undefined): string | null {
  return typeof v === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length <= 80 ? v : null;
}

/** A pessoa do slug, entre as do retrato; null quando não há. */
export function pessoaDoSlug(r: Pick<RetratoEpb, "autores">, slug: string): string | null {
  return r.autores.find((a) => slugPessoa(a.pessoa) === slug)?.pessoa ?? null;
}

/** "0075/2025" → ".../emenda/2025-0075". */
export function urlEmendaEpb(emenda: string): string {
  const m = /^(\d{4})\/(\d{4})$/.exec(emenda);
  return m ? `${URL_ASSEMBLEIA}/emenda/${m[2]}-${m[1]}` : URL_ASSEMBLEIA;
}

/** "2025-0075" → "0075/2025"; null fora do formato. */
export function emendaDaUrl(v: string | null | undefined): string | null {
  const m = typeof v === "string" ? /^(20\d{2})-(\d{4})$/.exec(v) : null;
  return m ? `${m[2]}/${m[1]}` : null;
}

// ================================================================ a emenda inteira (catálogo + ficha + destino)

export interface EmendaEpb {
  emenda: string;
  ano: number;
  /** A pessoa da ficha; na falta, a do catálogo. */
  pessoa: string | null;
  autorCatalogo: string | null;
  deputadoFicha: string | null;
  autoriaDivergente: boolean;
  temFicha: boolean;
  noCatalogo: boolean;
  tipo: string | null;
  secretaria: string | null;
  objeto: string | null;
  /** O valor da ficha; sem ficha, o do catálogo. */
  valor: number;
  /** O catálogo, somadas as classificações. */
  valorCatalogo: number;
  empenhado: number;
  liquidado: number;
  pago: number;
  /** A modalidade da classificação de maior valor. */
  modalidade: GrupoModalidade;
  modalidadeTexto: string | null;
  orgao: string | null;
  passo: PassoEpb;
  passoEm: string | null;
  devolvida: boolean;
  foraDeOrdem: boolean;
  beneficiario: string | null;
  beneficiarioRetido: boolean;
  /** O empenhado e o pago a pessoa jurídica (o destino), e a soma à pessoa física. */
  destinoEmpenhado: number;
  destinoPago: number;
  pfEmpenhado: number;
}

/** Todas as emendas do retrato, uma por código: a união do catálogo e da ficha. Em ordem de ano e número. */
export function emendasDoRetrato(r: Pick<RetratoEpb, "fichas" | "catalogo" | "destinos" | "pf">): EmendaEpb[] {
  const cat = new Map<string, CatalogoEpb[]>();
  for (const c of r.catalogo) {
    const l = cat.get(c.emenda);
    if (l) l.push(c);
    else cat.set(c.emenda, [c]);
  }
  const ficha = new Map(r.fichas.map((f) => [f.emenda, f]));
  const dest = new Map<string, { emp: number; pago: number }>();
  for (const d of r.destinos) {
    const x = dest.get(d.emenda) ?? { emp: 0, pago: 0 };
    x.emp += d.empenhado;
    x.pago += d.pago;
    dest.set(d.emenda, x);
  }
  const pf = new Map(r.pf.map((p) => [p.emenda, p]));
  const codigos = new Set<string>([...cat.keys(), ...ficha.keys()]);
  const saida: EmendaEpb[] = [];
  for (const emenda of codigos) {
    const linhas = cat.get(emenda) ?? [];
    const f = ficha.get(emenda);
    const maior = [...linhas].sort((a, b) => b.valor_emenda - a.valor_emenda || a.seq - b.seq)[0];
    const soma = (k: "valor_emenda" | "empenhado" | "liquidado" | "pago") => linhas.reduce((s, l) => s + (l[k] || 0), 0);
    const valorCatalogo = soma("valor_emenda");
    saida.push({
      emenda,
      ano: f?.ano ?? maior?.ano ?? Number(emenda.slice(5)),
      pessoa: f?.pessoa ?? maior?.pessoa ?? null,
      autorCatalogo: maior?.autor_publicado ?? null,
      deputadoFicha: f?.deputado_publicado ?? null,
      autoriaDivergente: f?.autoria_divergente ?? false,
      temFicha: !!f,
      noCatalogo: linhas.length > 0,
      tipo: f?.tipo ?? null,
      secretaria: f?.secretaria ?? null,
      objeto: f?.retificacao_objeto || f?.objeto || null,
      valor: f ? f.valor : valorCatalogo,
      valorCatalogo,
      empenhado: soma("empenhado"),
      liquidado: soma("liquidado"),
      pago: soma("pago"),
      modalidade: grupoModalidade(maior?.modalidade),
      modalidadeTexto: maior?.modalidade ?? null,
      orgao: maior?.orgao ?? null,
      passo: f?.passo ?? "nenhum",
      passoEm: f?.passo_em ?? null,
      devolvida: f?.devolvida ?? false,
      foraDeOrdem: f?.datas_fora_de_ordem ?? false,
      beneficiario: f?.beneficiario_final ?? null,
      beneficiarioRetido: f?.beneficiario_retido ?? false,
      destinoEmpenhado: dest.get(emenda)?.emp ?? 0,
      destinoPago: dest.get(emenda)?.pago ?? 0,
      pfEmpenhado: pf.get(emenda)?.empenhado ?? 0,
    });
  }
  return saida.sort((a, b) => a.ano - b.ano || a.emenda.localeCompare(b.emenda));
}

// ================================================================ a lista dos deputados

export interface DeputadoEpb {
  pessoa: string;
  slug: string;
  /** A origem da ligação na semente; vazia = autor fora da semente. */
  fonte: string | null;
  grafiasCatalogo: string[];
  grafiasFicha: string[];
  emendas: number;
  anoMin: number | null;
  anoMax: number | null;
  valor: number;
  empenhado: number;
  pago: number;
  /** O valor por modalidade (soma = valor das emendas com catálogo). */
  porModalidade: Record<GrupoModalidade, number>;
  /** Municípios com prefeitura ou fundo credor, nas transferências a municípios. */
  municipios: number;
  /** Entidades sem fins lucrativos credoras. */
  entidades: number;
  /** Emendas que ainda não estão pagas (passo diferente de "paga"). */
  noCaminho: number;
  devolvidas: number;
  divergentes: number;
}

/** As emendas por pessoa; as sem pessoa ficam fora (não há o que ligar). */
function porPessoa(emendas: EmendaEpb[]): Map<string, EmendaEpb[]> {
  const m = new Map<string, EmendaEpb[]>();
  for (const e of emendas) {
    if (!e.pessoa) continue;
    const l = m.get(e.pessoa);
    if (l) l.push(e);
    else m.set(e.pessoa, [e]);
  }
  return m;
}

/** Os deputados do retrato, em ordem de nome. Sem posição: a tela pode ordenar por coluna, como leitura. */
export function deputadosDoRetrato(r: RetratoEpb): DeputadoEpb[] {
  const emendas = emendasDoRetrato(r);
  const doDeputado = porPessoa(emendas);
  const modalidadeDe = new Map(emendas.map((e) => [e.emenda, e.modalidade]));
  const municipios = new Map<string, Set<string>>();
  const entidades = new Map<string, Set<string>>();
  const pessoaDe = new Map(emendas.map((e) => [e.emenda, e.pessoa]));
  for (const d of r.destinos) {
    const pessoa = pessoaDe.get(d.emenda);
    if (!pessoa) continue;
    const g = modalidadeDe.get(d.emenda);
    if (g === "municipios" && d.ibge) adicionar(municipios, pessoa, d.ibge);
    if (g === "entidades") adicionar(entidades, pessoa, d.credor_cnpj);
  }
  return r.autores
    .map((a) => {
      const lista = doDeputado.get(a.pessoa) ?? [];
      const porModalidade: Record<GrupoModalidade, number> = { municipios: 0, entidades: 0, direta: 0, outras: 0 };
      for (const e of lista) if (e.noCatalogo) porModalidade[e.modalidade] += e.valorCatalogo;
      const anos = lista.map((e) => e.ano);
      return {
        pessoa: a.pessoa,
        slug: slugPessoa(a.pessoa),
        fonte: a.pessoa_fonte,
        grafiasCatalogo: a.grafias_catalogo,
        grafiasFicha: a.grafias_ficha,
        emendas: lista.length,
        anoMin: anos.length ? Math.min(...anos) : null,
        anoMax: anos.length ? Math.max(...anos) : null,
        valor: soma(lista, (e) => e.valor),
        empenhado: soma(lista, (e) => e.empenhado),
        pago: soma(lista, (e) => e.pago),
        porModalidade,
        municipios: municipios.get(a.pessoa)?.size ?? 0,
        entidades: entidades.get(a.pessoa)?.size ?? 0,
        noCaminho: lista.filter((e) => e.temFicha && e.passo !== "paga").length,
        devolvidas: lista.filter((e) => e.devolvida).length,
        divergentes: lista.filter((e) => e.autoriaDivergente).length,
      };
    })
    .sort((a, b) => a.pessoa.localeCompare(b.pessoa, "pt-BR"));
}

function adicionar(m: Map<string, Set<string>>, chave: string, valor: string) {
  const s = m.get(chave);
  if (s) s.add(valor);
  else m.set(chave, new Set([valor]));
}

const soma = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((s, x) => s + (f(x) || 0), 0);

export interface AnoDaAssembleia {
  ano: number;
  emendas: number;
  valor: number;
  empenhado: number;
  pago: number;
  pctPago: number | null;
  naoPagas: number;
  valorNaoPago: number;
}

/** A Assembleia inteira ano a ano (a safra é o ano da emenda), do mais novo ao mais velho. */
export function anosDaAssembleia(emendas: readonly EmendaEpb[]): AnoDaAssembleia[] {
  const anos = [...new Set(emendas.map((e) => e.ano))].sort((a, b) => b - a);
  return anos.map((ano) => {
    const doAno = emendas.filter((e) => e.ano === ano);
    const naoPagas = doAno.filter((e) => e.temFicha && e.passo !== "paga");
    const valor = soma(doAno, (e) => e.valor);
    const pago = soma(doAno, (e) => e.pago);
    return {
      ano,
      emendas: doAno.length,
      valor,
      empenhado: soma(doAno, (e) => e.empenhado),
      pago,
      pctPago: pct(pago, valor),
      naoPagas: naoPagas.length,
      valorNaoPago: soma(naoPagas, (e) => Math.max(0, e.valor - e.pago)),
    };
  });
}

// ================================================================ a fila do ciclo

export interface ItemFila {
  emenda: string;
  ano: number;
  pessoa: string | null;
  objeto: string | null;
  secretaria: string | null;
  modalidade: GrupoModalidade;
  /** Falso: a emenda ainda não está no catálogo (só na ficha), e a modalidade não é conhecida. */
  noCatalogo: boolean;
  valor: number;
  empenhado: number;
  pago: number;
  /** Empenhado − pago, nunca abaixo de zero. */
  faltaPagar: number;
  passo: PassoEpb;
  passoEm: string | null;
  /** Dias desde o último passo, contados hoje. */
  dias: number | null;
  vez: string | null;
  devolvida: boolean;
}

/**
 * As emendas com ficha que ainda não estão pagas: o "onde está travado". O passo é o da última rodada; os dias são
 * contados `hoje` (o job é semanal, e o `dias_no_passo` gravado envelhece). Em ordem de ano (o mais novo primeiro), passo
 * e dias (os mais parados primeiro).
 */
export function filaDoCiclo(r: RetratoEpb, hoje: string): ItemFila[] {
  return emendasDoRetrato(r)
    .filter((e) => e.temFicha && e.passo !== "paga")
    .map((e) => ({
      emenda: e.emenda,
      ano: e.ano,
      pessoa: e.pessoa,
      objeto: e.objeto,
      secretaria: e.secretaria,
      modalidade: e.modalidade,
      noCatalogo: e.noCatalogo,
      valor: e.valor,
      empenhado: e.empenhado,
      pago: e.pago,
      faltaPagar: Math.max(0, e.empenhado - e.pago),
      passo: e.passo,
      passoEm: e.passoEm,
      dias: diasEntre(e.passoEm, hoje),
      vez: e.passoEm ? VEZ_DEPOIS[e.passo] : null,
      devolvida: e.devolvida,
    }))
    .sort((a, b) => b.ano - a.ano || ordemDoPasso(a.passo) - ordemDoPasso(b.passo) || (b.dias ?? -1) - (a.dias ?? -1) || a.emenda.localeCompare(b.emenda));
}

export interface ResumoPasso {
  passo: PassoEpb;
  emendas: number;
  valor: number;
  /** A mediana dos dias no passo (só os com data). */
  medianaDias: number | null;
}

/** A fila resumida por passo, na ordem do caminho; só os passos com emenda. */
export function resumoDaFila(itens: readonly ItemFila[]): ResumoPasso[] {
  const saida: ResumoPasso[] = [];
  for (const passo of PASSOS_EPB) {
    const doPasso = itens.filter((i) => i.passo === passo);
    if (!doPasso.length) continue;
    const dias = doPasso.map((i) => i.dias).filter((d): d is number => d !== null).sort((a, b) => a - b);
    saida.push({ passo, emendas: doPasso.length, valor: soma(doPasso, (i) => i.valor), medianaDias: mediana(dias) });
  }
  return saida;
}

export function mediana(ordenados: readonly number[]): number | null {
  if (!ordenados.length) return null;
  const m = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[m] : Math.round((ordenados[m - 1] + ordenados[m]) / 2);
}

// ================================================================ a ficha do deputado

export interface AnoDoDeputado {
  ano: number;
  emendas: number;
  valor: number;
  empenhado: number;
  pago: number;
  /** Pago ÷ valor do deputado na safra, em %. */
  pctPago: number | null;
  /** Pago ÷ valor de toda a Assembleia na mesma safra, em %: a comparação justa (mesmo ano). */
  pctPagoAssembleia: number | null;
  noCaminho: number;
}

/** O deputado ano a ano, com a execução da Assembleia inteira na mesma safra ao lado. */
export function anosDoDeputado(emendas: readonly EmendaEpb[], pessoa: string): AnoDoDeputado[] {
  const anos = [...new Set(emendas.filter((e) => e.pessoa === pessoa).map((e) => e.ano))].sort((a, b) => a - b);
  return anos.map((ano) => {
    const doAno = emendas.filter((e) => e.ano === ano);
    const dele = doAno.filter((e) => e.pessoa === pessoa);
    const valor = soma(dele, (e) => e.valor);
    const pago = soma(dele, (e) => e.pago);
    return {
      ano,
      emendas: dele.length,
      valor,
      empenhado: soma(dele, (e) => e.empenhado),
      pago,
      pctPago: pct(pago, valor),
      pctPagoAssembleia: pct(soma(doAno, (e) => e.pago), soma(doAno, (e) => e.valor)),
      noCaminho: dele.filter((e) => e.temFicha && e.passo !== "paga").length,
    };
  });
}

export interface MunicipioDestino {
  ibge: string;
  municipio: string;
  emendas: number;
  empenhado: number;
  pago: number;
}

export interface CredorDestino {
  cnpj: string;
  nome: string | null;
  ibge: string | null;
  municipio: string | null;
  modalidade: GrupoModalidade;
  emendas: number;
  empenhado: number;
  pago: number;
}

export interface DestinoDoDeputado {
  /** Prefeitura ou fundo credor, nas transferências a municípios. */
  municipios: MunicipioDestino[];
  /** Todos os credores pessoa jurídica, com a modalidade da emenda (o município é a sede do credor). */
  credores: CredorDestino[];
  /** A pessoa física, só somada. */
  pf: { emendas: number; empenhado: number; pago: number };
}

/** O destino das emendas de um conjunto (de um deputado, de um município, de um credor), pelo empenho. */
export function destinoDe(r: Pick<RetratoEpb, "destinos" | "pf">, emendas: readonly EmendaEpb[]): DestinoDoDeputado {
  const codigos = new Map(emendas.map((e) => [e.emenda, e]));
  const mun = new Map<string, MunicipioDestino & { _e: Set<string> }>();
  const cred = new Map<string, CredorDestino & { _e: Set<string> }>();
  for (const d of r.destinos) {
    const e = codigos.get(d.emenda);
    if (!e) continue;
    const ch = `${d.credor_cnpj}|${e.modalidade}`;
    const c = cred.get(ch) ?? {
      cnpj: d.credor_cnpj,
      nome: d.credor_nome,
      ibge: d.ibge,
      municipio: d.municipio,
      modalidade: e.modalidade,
      emendas: 0,
      empenhado: 0,
      pago: 0,
      _e: new Set<string>(),
    };
    c._e.add(d.emenda);
    c.empenhado += d.empenhado;
    c.pago += d.pago;
    cred.set(ch, c);
    if (e.modalidade === "municipios" && d.ibge) {
      const m = mun.get(d.ibge) ?? { ibge: d.ibge, municipio: d.municipio ?? d.ibge, emendas: 0, empenhado: 0, pago: 0, _e: new Set<string>() };
      m._e.add(d.emenda);
      m.empenhado += d.empenhado;
      m.pago += d.pago;
      mun.set(d.ibge, m);
    }
  }
  const pf = r.pf.filter((p) => codigos.has(p.emenda));
  const sem = <T extends { _e: Set<string> }>({ _e, ...x }: T) => ({ ...x, emendas: _e.size });
  return {
    municipios: [...mun.values()].map(sem).sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR")),
    credores: [...cred.values()].map(sem).sort((a, b) => (a.nome ?? a.cnpj).localeCompare(b.nome ?? b.cnpj, "pt-BR")),
    pf: { emendas: pf.length, empenhado: soma(pf, (p) => p.empenhado), pago: soma(pf, (p) => p.pago) },
  };
}

// ================================================================ município e entidade

export interface EmendasPbDoLugar {
  /** As emendas que chegaram (pelo empenho), em ordem de ano e número. */
  emendas: (EmendaEpb & { empenhadoAqui: number; pagoAqui: number })[];
  porDeputado: { pessoa: string; emendas: number; empenhado: number; pago: number }[];
  empenhado: number;
  pago: number;
}

function doLugar(r: RetratoEpb, filtro: (d: DestinoEpb, e: EmendaEpb) => boolean): EmendasPbDoLugar {
  const emendas = new Map(emendasDoRetrato(r).map((e) => [e.emenda, e]));
  const aqui = new Map<string, { emp: number; pago: number }>();
  for (const d of r.destinos) {
    const e = emendas.get(d.emenda);
    if (!e || !filtro(d, e)) continue;
    const x = aqui.get(d.emenda) ?? { emp: 0, pago: 0 };
    x.emp += d.empenhado;
    x.pago += d.pago;
    aqui.set(d.emenda, x);
  }
  const lista = [...aqui.entries()]
    .map(([codigo, x]) => ({ ...(emendas.get(codigo) as EmendaEpb), empenhadoAqui: x.emp, pagoAqui: x.pago }))
    .sort((a, b) => a.ano - b.ano || a.emenda.localeCompare(b.emenda));
  const dep = new Map<string, { pessoa: string; emendas: number; empenhado: number; pago: number }>();
  for (const e of lista) {
    const p = e.pessoa ?? "(sem deputado na semente)";
    const x = dep.get(p) ?? { pessoa: p, emendas: 0, empenhado: 0, pago: 0 };
    x.emendas += 1;
    x.empenhado += e.empenhadoAqui;
    x.pago += e.pagoAqui;
    dep.set(p, x);
  }
  return {
    emendas: lista,
    porDeputado: [...dep.values()].sort((a, b) => a.pessoa.localeCompare(b.pessoa, "pt-BR")),
    empenhado: soma(lista, (e) => e.empenhadoAqui),
    pago: soma(lista, (e) => e.pagoAqui),
  };
}

/**
 * As emendas estaduais de um município: as transferências a municípios com credor no município (a prefeitura ou o
 * fundo) e, à parte, as entidades sem fins lucrativos com sede nele. A aplicação direta fica fora: o credor é
 * fornecedor do Estado, e o município dele não é destino.
 */
export function emendasPbDoMunicipio(r: RetratoEpb, ibge: string): { publico: EmendasPbDoLugar; entidades: EmendasPbDoLugar } {
  return {
    publico: doLugar(r, (d, e) => d.ibge === ibge && e.modalidade === "municipios"),
    entidades: doLugar(r, (d, e) => d.ibge === ibge && e.modalidade === "entidades"),
  };
}

/** As emendas estaduais que uma pessoa jurídica recebeu como credora (qualquer modalidade). */
export function emendasPbDaEntidade(r: RetratoEpb, cnpj: string): EmendasPbDoLugar {
  return doLugar(r, (d) => d.credor_cnpj === cnpj);
}

// ================================================================ a data do dado

/** "Leitura da API da PB em DD/MM/AAAA; anos 2021 a 2026." */
export function anosLidosTexto(e: Pick<ExecucaoEpb, "anosLidos">): string {
  const a = [...e.anosLidos].sort((x, y) => x - y);
  if (!a.length) return "—";
  return a.length === 1 ? String(a[0]) : `${a[0]} a ${a[a.length - 1]}`;
}
