/**
 * Padrões das cláusulas suspensivas da PB e checklist preventivo (onda 11, parte 3).
 *
 * Duas fontes, com papéis diferentes:
 *   · HISTÓRICO — `painel_instrumento` (dados abertos, atualizado todo dia): todo convênio da PB que já
 *     teve suspensiva, com a data de retirada de quem saiu. É daqui que sai o destino (quem saiu, quem
 *     morreu nela) e o tempo típico até a retirada. O SICONV apaga o prazo na retirada: quem saiu tem
 *     `dt_retirada_suspensiva` e prazo nulo; quem segue ou morreu tem prazo e retirada nula.
 *   · AGORA — a coleta do Acesso Livre (`exigencia_*`) dos convênios que seguem em suspensiva: quem
 *     analisou, o que pediu, quais documentos, com que palavras.
 *
 * A coleta só tem quem AINDA está preso. Medir tempo típico só com ela diria quanto espera quem ficou,
 * não quanto leva para sair — por isso o tempo vem do histórico, e a coleta responde o resto.
 *
 * Tudo função pura, sem banco e sem relógio.
 */
import { diaBrasilia, diasEntre, lerCondicoes, type ExigDetalhe, type ExigDocumento, type ExigEvento } from "./laudo.ts";

// ================================================================ utilidades

/** Quantil com interpolação linear, como o `percentile_cont` do Postgres. Nulo sem dados. */
export function quantil(valores: number[], q: number): number | null {
  if (!valores.length) return null;
  const xs = [...valores].sort((a, b) => a - b);
  const pos = (xs.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return xs[base + 1] === undefined ? xs[base] : xs[base] + resto * (xs[base + 1] - xs[base]);
}

/** A moda e a fatia que ela ocupa: "atende 43 convênios, 100% do Ministério X". */
export function concentracao(itens: (string | null)[]): { valor: string | null; fatia: number } {
  const validos = itens.filter((x): x is string => !!x);
  if (!validos.length) return { valor: null, fatia: 0 };
  const m = new Map<string, number>();
  for (const x of validos) m.set(x, (m.get(x) ?? 0) + 1);
  const [valor, n] = [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { valor, fatia: n / validos.length };
}

/** Chave para juntar grafias do mesmo requisito: "CERTIDÃO TJ", "Certidão TJ" e "CERTIDAO TJ." são um só. */
export function chaveRequisito(texto: string | null | undefined): string | null {
  const t = (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "")
    .toUpperCase();
  return t || null;
}

/** Abaixo disto, não há padrão, há coincidência: a página mostra o número mas não tira conclusão. */
export const MINIMO_PADRAO = 5;
/** Coorte do histórico: as regras mudaram (Portaria 424/2016, Portaria Conjunta 33/2023). */
export const COORTE_DESDE = "2019-01-01";

/** Palavras que o SICONV grava ora com, ora sem acento nos nomes de órgão. */
const ACENTOS_ORGAO: Record<string, string> = {
  ministerio: "ministério",
  saude: "saúde",
  justica: "justiça",
  seguranca: "segurança",
  publica: "pública",
  integracao: "integração",
  educacao: "educação",
  ciencia: "ciência",
  inovacao: "inovação",
  agropecuaria: "agropecuária",
};

/** "MINISTERIO DA SAUDE" → "Ministério da Saúde": o dado vem em caixa alta e às vezes sem acento. */
export function tituloOrgao(o: string): string {
  const minusculas = new Set(["da", "das", "de", "do", "dos", "e"]);
  return o
    .toLowerCase()
    .replace(/[a-zà-ú]+/g, (p) => ACENTOS_ORGAO[p] ?? p)
    .split(/\s+/)
    .map((p, k) => (k > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// ================================================================ HISTÓRICO: destino e tempo típico

export interface HistoricoSuspensiva {
  nr_convenio: string;
  orgao_sup: string | null;
  programa: string | null;
  situacao: string | null;
  dt_assinatura: string | null;
  dt_suspensiva: string | null;
  dt_retirada_suspensiva: string | null;
  vl_repasse: number | null;
  vl_desembolsado: number | null;
}

/**
 * O que aconteceu com quem entrou em suspensiva:
 *   · saiu      — a suspensiva foi retirada;
 *   · morreu    — anulado, rescindido ou cancelado com a suspensiva pendente;
 *   · encerrou  — outra situação final (prestação de contas) sem a retirada: a vigência acabou antes;
 *   · segue     — em execução, ainda em suspensiva.
 * Nulo para quem nunca teve suspensiva (prazo e retirada vazios).
 */
export type Destino = "saiu" | "morreu" | "encerrou" | "segue";

export function destino(h: Pick<HistoricoSuspensiva, "situacao" | "dt_suspensiva" | "dt_retirada_suspensiva">): Destino | null {
  if (h.dt_retirada_suspensiva) return "saiu";
  if (!h.dt_suspensiva) return null;
  const s = (h.situacao ?? "").toLowerCase();
  if (/anulad|rescindid|cancelad|extint/.test(s)) return "morreu";
  if (/em execu/.test(s)) return "segue";
  return "encerrou";
}

export interface ContaDestino {
  n: number;
  valor: number;
}

export interface LinhaHistorico {
  orgao: string;
  total: number;
  destinos: Record<Destino, ContaDestino>;
  /** Dias da assinatura à retirada, só de quem saiu. */
  mediana: number | null;
  p75: number | null;
  /** Fatia de quem terminou (saiu, morreu ou encerrou) que morreu ou encerrou sem sair. */
  pctPerdido: number | null;
}

function vazio(): Record<Destino, ContaDestino> {
  return { saiu: { n: 0, valor: 0 }, morreu: { n: 0, valor: 0 }, encerrou: { n: 0, valor: 0 }, segue: { n: 0, valor: 0 } };
}

function linha(orgao: string, hs: HistoricoSuspensiva[]): LinhaHistorico {
  const destinos = vazio();
  const tempos: number[] = [];
  for (const h of hs) {
    const d = destino(h);
    if (!d) continue;
    destinos[d].n += 1;
    destinos[d].valor += h.vl_repasse ?? 0;
    if (d === "saiu" && h.dt_assinatura && h.dt_retirada_suspensiva) {
      const dias = diasEntre(h.dt_assinatura, h.dt_retirada_suspensiva);
      if (dias >= 0) tempos.push(dias);
    }
  }
  const terminados = destinos.saiu.n + destinos.morreu.n + destinos.encerrou.n;
  return {
    orgao,
    total: terminados + destinos.segue.n,
    destinos,
    mediana: quantil(tempos, 0.5),
    p75: quantil(tempos, 0.75),
    pctPerdido: terminados ? (destinos.morreu.n + destinos.encerrou.n) / terminados : null,
  };
}

/** Destino e tempo típico da coorte (assinaturas desde `desde`), no total e por órgão. */
export function lerHistorico(hs: HistoricoSuspensiva[], desde = COORTE_DESDE): { total: LinhaHistorico; orgaos: LinhaHistorico[] } {
  const coorte = hs.filter((h) => destino(h) && h.dt_assinatura && h.dt_assinatura >= desde);
  const porOrgao = new Map<string, HistoricoSuspensiva[]>();
  for (const h of coorte) {
    const o = h.orgao_sup ?? "Órgão não informado";
    porOrgao.set(o, [...(porOrgao.get(o) ?? []), h]);
  }
  return {
    total: linha("Todos os órgãos", coorte),
    orgaos: [...porOrgao].map(([o, lista]) => linha(o, lista)).sort((a, b) => b.total - a.total || a.orgao.localeCompare(b.orgao)),
  };
}

// ================================================================ AGORA: quem segue em suspensiva

export interface AtualSuspensiva {
  numero: string;
  orgao_sup: string | null;
  programa: string | null;
  motivo_suspensao: string | null;
  dt_assinatura: string | null;
  dt_suspensiva: string | null;
  vl_repasse: number | null;
  parado_desde: string | null;
  rodadas_de_exigencia: number;
}

export interface LinhaCondicao {
  condicao: string;
  convenios: number;
  valor: number;
  /** Dias desde a assinatura, até hoje: quanto tempo quem exige isto está preso. */
  medianaEmSuspensiva: number | null;
  /** Prazo da suspensiva vencido ou em até 30 dias. */
  prazoApertado: number;
}

const OUTRAS = "Outras condições (texto livre do termo)";

/** Por condição do termo, entre quem segue em suspensiva. Um convênio conta em cada condição que tem. */
export function porCondicao(atuais: AtualSuspensiva[], hoje: string): LinhaCondicao[] {
  const m = new Map<string, AtualSuspensiva[]>();
  for (const a of atuais) {
    const nomes = new Set(lerCondicoes(a.motivo_suspensao, []).map((c) => (c.livre ? OUTRAS : c.texto)));
    for (const nome of nomes) m.set(nome, [...(m.get(nome) ?? []), a]);
  }
  return [...m]
    .map(([condicao, lista]) => ({
      condicao,
      convenios: lista.length,
      valor: lista.reduce((s, a) => s + (a.vl_repasse ?? 0), 0),
      medianaEmSuspensiva: quantil(
        lista.filter((a) => a.dt_assinatura).map((a) => diasEntre(a.dt_assinatura as string, hoje)),
        0.5,
      ),
      prazoApertado: lista.filter((a) => a.dt_suspensiva && diasEntre(hoje, a.dt_suspensiva) <= 30).length,
    }))
    .sort((a, b) => b.convenios - a.convenios || a.condicao.localeCompare(b.condicao));
}

// ================================================================ AGORA: quem analisa

export interface EventoComNumero extends ExigEvento {
  numero: string;
}

export interface DetalheComNumero extends ExigDetalhe {
  numero: string;
}

export interface PerfilAnalista {
  nome: string;
  atribuicao: string | null;
  atos: number;
  convenios: number;
  orgao: { valor: string | null; fatia: number };
  programa: { valor: string | null; fatia: number };
  exigencias: number;
  atendimentos: number;
  recusas: number;
  /** O dia com mais convênios analisados pela pessoa. */
  maiorLote: { dia: string; convenios: number } | null;
  /** Convênios em que a pessoa deu a última palavra, e há quanto tempo (até a coleta). */
  ultimaPalavra: { convenios: number; medianaDias: number | null; valor: number };
}

/**
 * Perfil de cada pessoa do lado do concedente. Os nomes são públicos e ficam: é o que revela a
 * estrutura do atendimento (quem só atende um ministério, quem só exige, quem analisa em lote).
 * Contato pessoal já saiu na coleta.
 */
export function perfilAnalistas(
  eventos: EventoComNumero[],
  detalhes: DetalheComNumero[],
  contexto: Map<string, Pick<AtualSuspensiva, "orgao_sup" | "programa" | "vl_repasse">>,
  referencia: string,
): PerfilAnalista[] {
  const atribuicao = new Map<string, string | null>();
  for (const d of detalhes) if (d.responsavel && d.atribuicao) atribuicao.set(d.responsavel, d.atribuicao);
  const autorDetalhe = new Map(detalhes.map((d) => [`${d.numero}|${d.id_situacao}`, d.atribuicao]));

  // A última palavra de cada convênio: o evento mais recente, de quem quer que seja.
  const ultimo = new Map<string, EventoComNumero>();
  for (const e of eventos) {
    const u = ultimo.get(e.numero);
    if (!u || e.ocorrido_em > u.ocorrido_em) ultimo.set(e.numero, e);
  }

  const porPessoa = new Map<string, EventoComNumero[]>();
  for (const e of eventos) {
    if (e.lado !== "concedente" || !e.responsavel) continue;
    porPessoa.set(e.responsavel, [...(porPessoa.get(e.responsavel) ?? []), e]);
  }

  return [...porPessoa]
    .map(([nome, evs]) => {
      const numeros = [...new Set(evs.map((e) => e.numero))];
      const lotes = new Map<string, Set<string>>();
      for (const e of evs) {
        const dia = diaBrasilia(e.ocorrido_em); // dia de Brasília: às 22h ainda é o mesmo dia
        lotes.set(dia, (lotes.get(dia) ?? new Set()).add(e.numero));
      }
      const [diaLote, conjunto] = [...lotes].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))[0] ?? [];
      const minhas = [...ultimo.values()].filter((u) => u.responsavel === nome);
      const atr =
        atribuicao.get(nome) ??
        evs.map((e) => autorDetalhe.get(`${e.numero}|${e.id_situacao}`)).find((x): x is string => !!x) ??
        null;
      return {
        nome,
        atribuicao: atr,
        atos: evs.length,
        convenios: numeros.length,
        orgao: concentracao(numeros.map((nr) => contexto.get(nr)?.orgao_sup ?? null)),
        programa: concentracao(numeros.map((nr) => contexto.get(nr)?.programa ?? null)),
        exigencias: evs.filter((e) => e.resultado === "complementação solicitada").length,
        atendimentos: evs.filter((e) => e.resultado === "atendido").length,
        recusas: evs.filter((e) => e.resultado === "não atendido").length,
        maiorLote: diaLote && conjunto ? { dia: diaLote, convenios: conjunto.size } : null,
        ultimaPalavra: {
          convenios: minhas.length,
          medianaDias: quantil(minhas.map((u) => diasEntre(u.ocorrido_em, referencia)), 0.5),
          valor: minhas.reduce((s, u) => s + (contexto.get(u.numero)?.vl_repasse ?? 0), 0),
        },
      };
    })
    .sort((a, b) => b.convenios - a.convenios || b.atos - a.atos || a.nome.localeCompare(b.nome));
}

// ================================================================ AGORA: documentos que voltam

export interface DocumentoComNumero extends ExigDocumento {
  numero: string;
}

export interface LinhaRequisito {
  requisito: string;
  convenios: number;
  /** Anexos com esse requisito (um convênio pode ter vários). */
  documentos: number;
  comValidade: number;
  vencidos: number;
}

/**
 * Documento que perde a validade ou precisa ser recente: certidão, declaração, comprovante, CAUC,
 * protocolo de envio. O campo de validade do anexo não serve para isso — na coleta de 17/09/2026 só
 * 25% das certidões do TJ o traziam preenchido —, então a marca vem da natureza do documento.
 */
export function venceNaNatureza(requisito: string): boolean {
  return /CERTID|DECLARA|COMPROVANTE|CAUC|PROTOCOLO|EXTRATO|REGULARIDADE|ADIMPL/.test(chaveRequisito(requisito) ?? "");
}

export function porRequisito(docs: DocumentoComNumero[], hoje: string): LinhaRequisito[] {
  const m = new Map<string, { convenios: Set<string>; documentos: number; comValidade: number; vencidos: number; grafias: Map<string, number> }>();
  for (const d of docs) {
    const original = (d.requisito ?? d.descricao ?? "").replace(/\s+/g, " ").trim().replace(/\.$/, "").toUpperCase();
    const r = chaveRequisito(original);
    if (!r) continue;
    const a = m.get(r) ?? { convenios: new Set<string>(), documentos: 0, comValidade: 0, vencidos: 0, grafias: new Map<string, number>() };
    a.convenios.add(d.numero);
    a.documentos += 1;
    a.grafias.set(original, (a.grafias.get(original) ?? 0) + 1);
    if (d.validade) {
      a.comValidade += 1;
      if (d.validade < hoje) a.vencidos += 1;
    }
    m.set(r, a);
  }
  return [...m]
    // Mostra a grafia mais usada, com acento quando alguém escreveu com acento.
    .map(([, a]) => ({
      requisito: [...a.grafias].sort((x, y) => y[1] - x[1] || y[0].localeCompare(x[0]))[0][0],
      convenios: a.convenios.size,
      documentos: a.documentos,
      comValidade: a.comValidade,
      vencidos: a.vencidos,
    }))
    .sort((a, b) => b.convenios - a.convenios || a.requisito.localeCompare(b.requisito));
}

// ================================================================ CHECKLIST preventivo

export interface Checklist {
  orgao: string;
  /** Convênios em suspensiva deste órgão na coleta: a base de tudo o que vem abaixo. */
  base: number;
  condicoes: { texto: string; convenios: number; fatia: number }[];
  documentos: { requisito: string; convenios: number; fatia: number; vence: boolean }[];
  /** Os pedidos do concedente, nas palavras dele, do mais repetido ao menos. */
  palavras: { texto: string; vezes: number; convenios: number }[];
  historico: LinhaHistorico | null;
}

/** Texto do pedido para agrupar: sem espaço dobrado e sem saudação/assinatura variando. */
function chaveTexto(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * O que um proponente precisa ter pronto antes de mandar uma proposta a este órgão, aprendido com
 * quem já está preso na suspensiva dele: as condições que o termo costuma impor, os documentos que
 * o concedente pede (com os que vencem marcados) e as exigências nas palavras dele.
 */
export function montarChecklist(
  orgao: string,
  hoje: string,
  atuais: AtualSuspensiva[],
  docs: DocumentoComNumero[],
  detalhes: DetalheComNumero[],
  historico: LinhaHistorico[],
): Checklist {
  const meus = atuais.filter((a) => a.orgao_sup === orgao);
  const numeros = new Set(meus.map((a) => a.numero));
  const base = meus.length;
  const fatia = (n: number) => (base ? n / base : 0);

  const condicoes = porCondicao(meus, hoje).map((c) => ({ texto: c.condicao, convenios: c.convenios, fatia: fatia(c.convenios) }));

  const documentos = porRequisito(
    docs.filter((d) => numeros.has(d.numero)),
    hoje,
  ).map((r) => ({
    requisito: r.requisito,
    convenios: r.convenios,
    fatia: fatia(r.convenios),
    // Pela natureza, ou quando a maioria dos anexos traz validade preenchida.
    vence: venceNaNatureza(r.requisito) || r.comValidade / r.documentos >= 0.5,
  }));

  const textos = new Map<string, { texto: string; vezes: number; convenios: Set<string> }>();
  for (const d of detalhes) {
    if (!numeros.has(d.numero) || !d.solicitacao) continue;
    const k = chaveTexto(d.solicitacao);
    const t = textos.get(k) ?? { texto: d.solicitacao, vezes: 0, convenios: new Set<string>() };
    t.vezes += 1;
    t.convenios.add(d.numero);
    textos.set(k, t);
  }
  const palavras = [...textos.values()]
    .map((t) => ({ texto: t.texto, vezes: t.vezes, convenios: t.convenios.size }))
    .sort((a, b) => b.convenios - a.convenios || b.vezes - a.vezes || a.texto.length - b.texto.length);

  return {
    orgao,
    base,
    condicoes,
    documentos,
    palavras,
    historico: historico.find((h) => h.orgao === orgao) ?? null,
  };
}
