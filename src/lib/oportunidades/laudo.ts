/**
 * Laudo das exigências da cláusula suspensiva de um convênio (onda 11, parte 2).
 *
 * Junta o dossiê colhido no Acesso Livre do Transferegov (`exigencia_dossie`: documentos, histórico
 * datado e o texto do concedente) ao contexto do painel (`painel_instrumento`: valores, prazo da
 * suspensiva, vigência) e devolve a LEITURA: de quem é a vez, há quanto tempo, quanto tempo cada lado
 * segurou o processo, os riscos, as causas, a estratégia e o custo de não fazer nada.
 *
 * Tudo aqui é função pura, sem banco e sem relógio: `hoje` e a data da coleta entram como parâmetro.
 *
 * Duas regras de redação que valem para o arquivo inteiro:
 *   · "Atendido" NÃO quer dizer "o município entregou tudo". Em Cabedelo (963081) o único evento é
 *     uma análise atendida cuja observação diz só "Adimplente", sem documento anexado. Por isso o
 *     laudo cita o texto do concedente em vez de concluir por ele.
 *   · O tempo parado conta até a COLETA, e não até hoje: depois dela não sabemos o que aconteceu.
 *     Já o prazo da suspensiva e a vigência contam até hoje, porque vêm do painel, que é diário.
 */
import { formatarData } from "./central.ts";
// Só o tipo: padroes.ts importa este arquivo, e o cálculo do tempo no órgão mora lá.
import type { TempoOrgao } from "./padroes.ts";
import { moedaCurta } from "./radar.ts";

// ================================================================ dados de entrada

export type Lado = "concedente" | "proponente";

export interface ExigInstrumento {
  numero: string;
  id_convenio: string | null;
  proposta: string | null;
  situacao_contratacao: string | null;
  modalidade: string | null;
  vez_de: Lado | null;
  ultimo_evento: string | null;
  parado_desde: string | null;
  primeiro_evento_em: string | null;
  rodadas_de_exigencia: number;
  envios_do_municipio: number;
  documentos: number;
  eventos: number;
  erro: string | null;
  coletado_em: string | null;
}

export interface ExigDocumento {
  ordem: number;
  grupo: string | null;
  arquivo: string;
  descricao: string | null;
  requisito: string | null;
  enviado_em: string | null;
  validade: string | null;
}

export interface ExigEvento {
  ordem: number;
  evento: string;
  lado: Lado | "indefinido";
  resultado: string | null;
  responsavel: string | null;
  ocorrido_em: string;
  id_situacao: string | null;
}

export interface ExigDetalhe {
  id_situacao: string;
  analise: string | null;
  responsavel: string | null;
  atribuicao: string | null;
  analisada_em: string | null;
  situacao: string | null;
  observacao: string | null;
  solicitacao: string | null;
}

/** O que `exigencia_dossie(numero)` devolve. */
export interface Dossie {
  coletado_em: string | null;
  referencia: string | null;
  fonte: string | null;
  instrumento: ExigInstrumento | null;
  documentos: ExigDocumento[];
  eventos: ExigEvento[];
  detalhes: ExigDetalhe[];
}

/** O pedaço de `painel_instrumento` que o laudo usa. */
export interface ContextoLaudo {
  vl_repasse: number | null;
  vl_desembolsado: number | null;
  dt_assinatura: string | null;
  dt_suspensiva: string | null;
  dt_retirada_suspensiva: string | null;
  dt_fim_vigencia: string | null;
  orgao_sup: string | null;
  /** `MOTIVO_SUSPENSAO` do SICONV: o que o termo exige (oport_18b). Nulo sem a coluna ou sem texto. */
  motivo_suspensao?: string | null;
}

// ================================================================ leitura

export type Nivel = "critico" | "alto" | "moderado" | "informativo";

/**
 * Uma condição do termo e se algum texto do concedente na aba de requisitos fala dela.
 * `livre`: veio do campo de texto livre do motivo, não da lista padrão do SICONV.
 */
export interface Condicao {
  texto: string;
  mencionada: boolean;
  livre: boolean;
}

export interface LinhaDoTempo {
  quando: string;
  /** Dia em hora de Brasília, "AAAA-MM-DD". */
  dia: string;
  evento: string;
  lado: Lado | "indefinido";
  resultado: string | null;
  responsavel: string | null;
  atribuicao: string | null;
  /** Data que o analista informou, quando difere do registro. */
  analisadaEm: string | null;
  /** Dias entre a data da análise e o registro no sistema. */
  atrasoRegistro: number | null;
  texto: string | null;
  tipoTexto: "solicitacao" | "observacao" | null;
  /** De quem ficou a vez depois deste evento. */
  vezDepois: Lado | null;
  /** Dias até o evento seguinte (ou até a coleta, no último). */
  diasAteProximo: number;
  /**
   * O evento tem painel de detalhe no Transferegov. Com `texto` nulo, quer dizer que o texto existe lá
   * mas não foi colhido (a coleta pega o detalhe dos eventos mais recentes), não que veio em branco.
   */
  temDetalhe: boolean;
}

export interface Risco {
  nivel: Nivel;
  titulo: string;
  fato: string;
}

export interface Passo {
  titulo: string;
  porque: string;
}

export interface Analista {
  nome: string;
  atribuicao: string | null;
  atos: number;
  exigencias: number;
  atendimentos: number;
  primeiro: string;
  ultimo: string;
}

export interface Laudo {
  referencia: string;
  retirada: string | null;
  vez: { lado: Lado | null; desde: string | null; dias: number | null; frase: string };
  prazo: { data: string | null; dias: number | null; nivel: Nivel; frase: string };
  vigencia: { data: string | null; dias: number | null; nivel: Nivel | null };
  dinheiro: { repasse: number | null; desembolsado: number | null; parado: number | null };
  tempoPorLado: { concedente: number; proponente: number; total: number };
  maiorEspera: { lado: Lado; dias: number; de: string; ate: string } | null;
  riscos: Risco[];
  causas: string[];
  estrategia: Passo[];
  inacao: string[];
  linha: LinhaDoTempo[];
  documentos: { total: number; comValidade: number; vencidos: ExigDocumento[]; porGrupo: { grupo: string; n: number }[] };
  analistas: Analista[];
  /** O que o termo exige (motivo da suspensiva), com a marca de quais o concedente chegou a mencionar. */
  condicoes: Condicao[];
  /** Este convênio contra quem já saiu da suspensiva no mesmo órgão (`tempoNoOrgao`); nulo sem histórico. */
  tempoOrgao: TempoOrgao | null;
  /** Eventos com painel de detalhe no Transferegov e quantos deles tiveram o texto colhido. */
  textos: { comDetalhe: number; colhidos: number };
}

// ------------------------------------------------------------------ condições do termo

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const PALAVRAS_VAZIAS = new Set(["para", "sobre", "entre", "outros", "outras", "previo", "previa", "documento", "documentos"]);

/** A palavra que identifica a condição: a mais longa, sem acento ("Projeto de Engenharia" → "engenharia"). */
export function chaveCondicao(texto: string): string | null {
  const palavras = semAcento(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 5 && !PALAVRAS_VAZIAS.has(p));
  return palavras.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Os itens padrão do motivo da suspensiva no SICONV. O campo é uma lista marcada ("Titularidade de
 * Área, Projeto de Engenharia, Licenciamento Ambiental Prévio") seguida de " e " e de um texto livre —
 * onde aparece de tudo: "Plano de Sustentabilidade" em quatro grafias, "CLÁUSULA TERCEIRA", número de
 * processo, liminar judicial. Nos 288 convênios da PB coletados em 17/09/2026 havia 45 textos distintos.
 *
 * Separar por vírgula não aguenta: o último item vem unido por " e ", há texto com os itens colados sem
 * separador, e o texto livre tem vírgulas próprias. Então os itens padrão são reconhecidos por padrão;
 * o que sobra vira condição livre, com o texto como veio. A ordem da lista importa: a declaração de
 * sustentabilidade é procurada antes do plano, para um não engolir o outro.
 *
 * `chaves`: palavras (sem acento, minúsculas) que, num texto do concedente, contam como menção.
 */
const ITENS_PADRAO: { rotulo: string; padrao: RegExp; chaves: string[] }[] = [
  { rotulo: "Titularidade de Área", padrao: /titularidade(\s+d[aeo]\s+[áa]rea)?/i, chaves: ["titularidade", "dominialidade"] },
  { rotulo: "Projeto de Engenharia", padrao: /projeto\s+de\s+engenharia/i, chaves: ["engenharia", "projeto basico", "projeto executivo"] },
  { rotulo: "Licenciamento Ambiental Prévio", padrao: /licenciamento\s+ambiental(\s+pr[ée]vio)?/i, chaves: ["licenciamento", "licenca ambiental", "licenca previa"] },
  { rotulo: "Manifestação ambiental", padrao: /manifesta[çc][ãa]o\s+ambiental/i, chaves: ["manifestacao ambiental", "licenciamento", "licenca ambiental"] },
  { rotulo: "Termo de Referência", padrao: /termo\s+de\s+refer[êe]ncia/i, chaves: ["termo de referencia"] },
  {
    rotulo: "Declaração de sustentabilidade do objeto",
    padrao: /(iv\s*[-–]\s*)?declara[çc][ãa]o\s+(sobre\s+a|de)\s+sustentabilidade(\s+do\s+objeto)?/i,
    chaves: ["sustentabilidade"],
  },
  // Lazy até o primeiro "dade": pega "Sustentabilidade", "Sutentabilidade", "SUATENTABILIDADE" e
  // "sustentabiidade", e para antes de um texto colado depois ("…SustentabilidadeCONTRATAÇÃO SOB LIMINAR").
  { rotulo: "Plano de Sustentabilidade", padrao: /plano\s+de\s+s\w*?dade/i, chaves: ["sustentabilidade"] },
  { rotulo: "Declaração do Conselho Municipal", padrao: /(v\s*[-–]\s*)?declara[çc][ãa]o\s+do\s+conselho\s+municipal/i, chaves: ["conselho"] },
  { rotulo: "Itens para autorização da licitação", padrao: /itens\s+para\s+autoriza[çc][ãa]o\s+da\s+licita[çc][ãa]o/i, chaves: ["autorizacao da licitacao"] },
  { rotulo: "Anteprojeto", padrao: /anteprojeto/i, chaves: ["anteprojeto"] },
];

/** Tira o que é só separador das pontas de um resto de texto: vírgula, ponto, travessão e o "e" solto. */
function limparResto(s: string): string {
  const junta = /^(?:[\s,;.:–—-]|e\s)+|(?:[\s,;.:–—-]|\se)+$/gi;
  let atual = s.replace(/\s+/g, " ");
  for (let anterior = ""; anterior !== atual; ) {
    anterior = atual;
    atual = atual.replace(junta, "").trim();
  }
  return atual;
}

/**
 * As condições do termo, lidas do motivo da suspensiva, e se algum texto do concedente as menciona.
 * A marca é deliberadamente literal: "menciona" quer dizer que uma palavra-chave aparece no texto, e o
 * laudo nunca diz mais do que isso.
 */
export function lerCondicoes(motivo: string | null | undefined, detalhes: ExigDetalhe[]): Condicao[] {
  if (!motivo?.trim()) return [];
  const textos = detalhes.map((d) => semAcento(`${d.solicitacao ?? ""} ${d.observacao ?? ""}`)).join(" \n ");
  const menciona = (chaves: string[]) => chaves.some((c) => textos.includes(c));

  // Onde cada item padrão aparece, na ordem do texto; os trechos que sobram viram condição livre.
  const achados: { inicio: number; fim: number; rotulo: string; chaves: string[] }[] = [];
  for (const item of ITENS_PADRAO) {
    const re = new RegExp(item.padrao.source, "gi");
    for (let m = re.exec(motivo); m; m = re.exec(motivo)) {
      const [inicio, fim] = [m.index, m.index + m[0].length];
      if (!achados.some((a) => inicio < a.fim && fim > a.inicio)) achados.push({ inicio, fim, rotulo: item.rotulo, chaves: item.chaves });
    }
  }
  achados.sort((a, b) => a.inicio - b.inicio);

  const saida: Condicao[] = [];
  const vistas = new Set<string>();
  const acrescentar = (texto: string, chaves: string[], livre: boolean) => {
    const chave = semAcento(texto);
    if (!texto || vistas.has(chave)) return;
    vistas.add(chave);
    saida.push({ texto, mencionada: menciona(chaves), livre });
  };
  let cursor = 0;
  for (const a of [...achados, { inicio: motivo.length, fim: motivo.length, rotulo: "", chaves: [] }]) {
    const resto = limparResto(motivo.slice(cursor, a.inicio));
    // Resto com letra de verdade vira condição livre; pontuação e conectivo soltos, não.
    if (/[a-zá-ú]{3}/i.test(resto)) {
      const chave = chaveCondicao(resto);
      acrescentar(resto, chave ? [chave] : [], true);
    }
    if (a.rotulo) acrescentar(a.rotulo, a.chaves, false);
    cursor = a.fim;
  }
  return saida;
}

const listaCondicoes = (c: Condicao[]) => c.map((x) => `«${x.texto}»`).join(", ");

// ------------------------------------------------------------------ limiares

/** Prazo da suspensiva a esta distância ou menos já é crítico. */
export const DIAS_PRAZO_CRITICO = 30;
/** A esta distância ou menos, é hora de pedir prorrogação. */
export const DIAS_PRAZO_ALTO = 90;
/** Vigência que sobra depois da retirada: menos que isto aperta licitação e obra. */
export const DIAS_VIGENCIA_CURTA = 180;
/** Parado há mais que isto é risco alto; entre o moderado e isto, moderado. */
export const DIAS_PARADO_ALTO = 180;
export const DIAS_PARADO_MODERADO = 90;
/** A partir desta quantidade de pedidos de complementação, há divergência a tratar em reunião. */
export const RODADAS_REUNIAO = 5;
/** Diferença entre analisar e registrar que merece menção. */
export const DIAS_ATRASO_REGISTRO = 7;

// ------------------------------------------------------------------ datas

/** "AAAA-MM-DD" em hora de Brasília. Data pura passa direto; instante é convertido (UTC−3, sem verão). */
export function diaBrasilia(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return new Date(t - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Dias de `de` até `ate`, ambos "AAAA-MM-DD" (ou instantes, convertidos para Brasília). */
export function diasEntre(de: string, ate: string): number {
  const [a, b] = [diaBrasilia(de), diaBrasilia(ate)].map((d) => {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, dd);
  });
  return Math.round((b - a) / 86_400_000);
}

const dataBr = (iso: string | null) => (iso ? formatarData(diaBrasilia(iso)) : "—");
const dias = (n: number) => `${n.toLocaleString("pt-BR")} ${Math.abs(n) === 1 ? "dia" : "dias"}`;
const vezes = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "vez" : "vezes"}`;
const por = (nome: string | null) => (nome ? `, por ${nome}` : "");

/** De quem fica a vez depois de um resultado. Espelha `exigencias.leitura.de_quem_e_a_vez`. */
export function vezDepois(resultado: string | null): Lado | null {
  if (resultado === "complementação solicitada" || resultado === "não atendido") return "proponente";
  if (resultado === "enviado" || resultado === "atendido") return "concedente";
  return null;
}

const NOME_LADO: Record<Lado, string> = { concedente: "concedente", proponente: "município" };

// ================================================================ a leitura

export function lerLaudo(dossie: Dossie, contexto: ContextoLaudo, hoje: string, tempo: TempoOrgao | null = null): Laudo {
  const referencia = diaBrasilia(dossie.referencia ?? dossie.coletado_em ?? hoje);
  const detalhePorId = new Map(dossie.detalhes.map((d) => [d.id_situacao, d]));
  const detalhaveis = dossie.eventos.filter((e) => e.id_situacao);
  const textos = { comDetalhe: detalhaveis.length, colhidos: detalhaveis.filter((e) => detalhePorId.has(e.id_situacao as string)).length };

  const linha = montarLinha(dossie.eventos, detalhePorId, referencia);
  const ultimo = linha.at(-1) ?? null;
  const tempoPorLado = somarTempo(linha);
  const maiorEspera = acharMaiorEspera(linha, referencia);
  const documentos = lerDocumentos(dossie.documentos, hoje);
  const analistas = lerAnalistas(linha);

  const retirada = contexto.dt_retirada_suspensiva;
  const vez = lerVez(ultimo, referencia);
  const prazo = lerPrazo(contexto, hoje);
  const vigencia = lerVigencia(contexto, hoje);
  const dinheiro = {
    repasse: contexto.vl_repasse,
    desembolsado: contexto.vl_desembolsado,
    parado: contexto.vl_repasse === null ? null : Math.max(0, contexto.vl_repasse - (contexto.vl_desembolsado ?? 0)),
  };

  const rodadas = linha.filter((l) => l.resultado === "complementação solicitada").length;
  const envios = linha.filter((l) => l.resultado === "enviado").length;
  const condicoes = retirada ? [] : lerCondicoes(contexto.motivo_suspensao, dossie.detalhes);
  const tempoOrgao = retirada ? null : tempo;

  const base = { linha, ultimo, vez, prazo, vigencia, dinheiro, documentos, analistas, rodadas, envios, contexto, referencia, condicoes, tempoOrgao };
  return {
    referencia,
    retirada,
    vez,
    prazo,
    vigencia,
    dinheiro,
    tempoPorLado,
    maiorEspera,
    riscos: retirada ? [] : lerRiscos(base),
    causas: lerCausas({ ...base, tempoPorLado, maiorEspera }),
    estrategia: retirada ? [{ titulo: "Acompanhar o desembolso", porque: `A cláusula suspensiva foi retirada em ${dataBr(retirada)}.` }] : lerEstrategia(base),
    inacao: retirada ? [] : lerInacao(base),
    linha,
    documentos,
    analistas,
    condicoes,
    tempoOrgao,
    textos,
  };
}

function montarLinha(eventos: ExigEvento[], detalhePorId: Map<string, ExigDetalhe>, referencia: string): LinhaDoTempo[] {
  const ordenados = [...eventos].sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em) || b.ordem - a.ordem);
  return ordenados.map((e, k) => {
    const d = e.id_situacao ? detalhePorId.get(e.id_situacao) : undefined;
    const dia = diaBrasilia(e.ocorrido_em);
    const analisadaEm = d?.analisada_em ?? null;
    const atraso = analisadaEm ? diasEntre(analisadaEm, dia) : null;
    const proximo = ordenados[k + 1];
    return {
      quando: e.ocorrido_em,
      dia,
      evento: e.evento,
      lado: e.lado,
      resultado: e.resultado,
      responsavel: e.responsavel,
      atribuicao: d?.atribuicao ?? null,
      analisadaEm: analisadaEm && analisadaEm !== dia ? analisadaEm : null,
      atrasoRegistro: atraso !== null && atraso > 0 ? atraso : null,
      texto: d?.solicitacao ?? d?.observacao ?? null,
      tipoTexto: d?.solicitacao ? "solicitacao" : d?.observacao ? "observacao" : null,
      vezDepois: vezDepois(e.resultado),
      diasAteProximo: Math.max(0, diasEntre(dia, proximo ? diaBrasilia(proximo.ocorrido_em) : referencia)),
      temDetalhe: !!e.id_situacao,
    };
  });
}

function somarTempo(linha: LinhaDoTempo[]): Laudo["tempoPorLado"] {
  const t = { concedente: 0, proponente: 0, total: 0 };
  for (const l of linha) {
    t.total += l.diasAteProximo;
    if (l.vezDepois) t[l.vezDepois] += l.diasAteProximo;
  }
  return t;
}

function acharMaiorEspera(linha: LinhaDoTempo[], referencia: string): Laudo["maiorEspera"] {
  let maior: Laudo["maiorEspera"] = null;
  linha.forEach((l, k) => {
    if (!l.vezDepois) return;
    if (!maior || l.diasAteProximo > maior.dias) {
      maior = { lado: l.vezDepois, dias: l.diasAteProximo, de: l.dia, ate: linha[k + 1]?.dia ?? referencia };
    }
  });
  return maior;
}

function lerDocumentos(docs: ExigDocumento[], hoje: string): Laudo["documentos"] {
  const comValidade = docs.filter((d) => d.validade);
  const vencidos = comValidade.filter((d) => (d.validade as string) < hoje);
  const grupos = new Map<string, number>();
  for (const d of docs) grupos.set(d.grupo ?? "Sem grupo", (grupos.get(d.grupo ?? "Sem grupo") ?? 0) + 1);
  return {
    total: docs.length,
    comValidade: comValidade.length,
    vencidos,
    porGrupo: [...grupos].map(([grupo, n]) => ({ grupo, n })).sort((a, b) => b.n - a.n),
  };
}

function lerAnalistas(linha: LinhaDoTempo[]): Analista[] {
  const m = new Map<string, Analista>();
  for (const l of linha) {
    if (l.lado !== "concedente" || !l.responsavel) continue;
    const a = m.get(l.responsavel) ?? {
      nome: l.responsavel,
      atribuicao: null,
      atos: 0,
      exigencias: 0,
      atendimentos: 0,
      primeiro: l.dia,
      ultimo: l.dia,
    };
    a.atos += 1;
    if (l.resultado === "complementação solicitada" || l.resultado === "não atendido") a.exigencias += 1;
    if (l.resultado === "atendido") a.atendimentos += 1;
    a.atribuicao ??= l.atribuicao;
    a.ultimo = l.dia;
    m.set(l.responsavel, a);
  }
  return [...m.values()].sort((a, b) => b.atos - a.atos || a.nome.localeCompare(b.nome));
}

function lerVez(ultimo: LinhaDoTempo | null, referencia: string): Laudo["vez"] {
  if (!ultimo) {
    return { lado: null, desde: null, dias: null, frase: "O Acesso Livre não registra nenhuma análise para este instrumento." };
  }
  const lado = ultimo.vezDepois;
  const d = diasEntre(ultimo.dia, referencia);
  const ate = `até a coleta de ${dataBr(referencia)}`;
  const quando = dataBr(ultimo.dia);
  let frase: string;
  switch (ultimo.resultado) {
    case "atendido":
      frase =
        `A última manifestação foi do concedente: uma análise registrada como atendida em ${quando}${por(ultimo.responsavel)}. ` +
        `Desde então, nenhum evento novo — ${dias(d)} ${ate}. A retirada da cláusula suspensiva não está registrada.`;
      break;
    case "enviado":
      frase = `O município enviou documentação em ${quando} e espera a análise do concedente há ${dias(d)}, ${ate}.`;
      break;
    case "complementação solicitada":
      frase = `O concedente pediu complementação em ${quando}${por(ultimo.responsavel)}. Não há envio do município depois disso — ${dias(d)} ${ate}.`;
      break;
    case "não atendido":
      frase = `O concedente registrou análise não atendida em ${quando}${por(ultimo.responsavel)}. Cabe ao município corrigir e reenviar — ${dias(d)} sem resposta, ${ate}.`;
      break;
    default:
      frase = `O último evento, em ${quando}, tem um rótulo que o laudo não sabe ler ("${ultimo.evento}"). Confira no Transferegov.`;
  }
  return { lado, desde: ultimo.dia, dias: d, frase };
}

function lerPrazo(c: ContextoLaudo, hoje: string): Laudo["prazo"] {
  if (c.dt_retirada_suspensiva) {
    return { data: null, dias: null, nivel: "informativo", frase: `A cláusula suspensiva foi retirada em ${dataBr(c.dt_retirada_suspensiva)}.` };
  }
  if (!c.dt_suspensiva) {
    return { data: null, dias: null, nivel: "informativo", frase: "O Transferegov não informa prazo para a cláusula suspensiva deste instrumento." };
  }
  const d = diasEntre(hoje, c.dt_suspensiva);
  const data = dataBr(c.dt_suspensiva);
  if (d < 0) {
    return { data: c.dt_suspensiva, dias: d, nivel: "critico", frase: `O prazo da cláusula suspensiva venceu em ${data}, há ${dias(-d)}, sem retirada registrada.` };
  }
  const nivel: Nivel = d <= DIAS_PRAZO_CRITICO ? "critico" : d <= DIAS_PRAZO_ALTO ? "alto" : "moderado";
  const frase = d === 0 ? `O prazo da cláusula suspensiva vence hoje, ${data}.` : `O prazo da cláusula suspensiva vence em ${data}, daqui a ${dias(d)}.`;
  return { data: c.dt_suspensiva, dias: d, nivel, frase };
}

function lerVigencia(c: ContextoLaudo, hoje: string): Laudo["vigencia"] {
  if (!c.dt_fim_vigencia) return { data: null, dias: null, nivel: null };
  const d = diasEntre(hoje, c.dt_fim_vigencia);
  return { data: c.dt_fim_vigencia, dias: d, nivel: d <= DIAS_VIGENCIA_CURTA ? "alto" : null };
}

interface Base {
  linha: LinhaDoTempo[];
  ultimo: LinhaDoTempo | null;
  vez: Laudo["vez"];
  prazo: Laudo["prazo"];
  vigencia: Laudo["vigencia"];
  dinheiro: Laudo["dinheiro"];
  documentos: Laudo["documentos"];
  analistas: Analista[];
  rodadas: number;
  envios: number;
  contexto: ContextoLaudo;
  referencia: string;
  condicoes: Condicao[];
  tempoOrgao: TempoOrgao | null;
}

const semMencao = (b: Base) => b.condicoes.filter((c) => !c.mencionada);
const ano = (iso: string) => iso.slice(0, 4);

function lerRiscos(b: Base): Risco[] {
  const r: Risco[] = [];
  if (b.prazo.nivel === "critico" || b.prazo.nivel === "alto") {
    r.push({ nivel: b.prazo.nivel, titulo: b.prazo.dias !== null && b.prazo.dias < 0 ? "Prazo da suspensiva vencido" : "Prazo da suspensiva próximo", fato: b.prazo.frase });
  }
  if (b.vigencia.nivel && b.vigencia.dias !== null) {
    r.push({
      nivel: b.vigencia.dias < 0 ? "critico" : "alto",
      titulo: b.vigencia.dias < 0 ? "Vigência encerrada" : "Pouca vigência para executar",
      fato:
        b.vigencia.dias < 0
          ? `A vigência terminou em ${dataBr(b.vigencia.data)}.`
          : `A vigência termina em ${dataBr(b.vigencia.data)}. Mesmo com a retirada hoje, sobram ${dias(b.vigencia.dias)} para licitar e executar.`,
    });
  }
  if (b.vez.dias !== null && b.vez.dias > DIAS_PARADO_MODERADO) {
    r.push({
      nivel: b.vez.dias > DIAS_PARADO_ALTO ? "alto" : "moderado",
      titulo: "Processo parado",
      fato: `Nenhum evento há ${dias(b.vez.dias)}, desde ${dataBr(b.vez.desde)}, com a vez do ${NOME_LADO[b.vez.lado ?? "concedente"]}.`,
    });
  }
  if (b.documentos.vencidos.length) {
    r.push({
      nivel: "moderado",
      titulo: "Documentos com validade vencida",
      fato: `${b.documentos.vencidos.length} de ${b.documentos.comValidade} documentos com validade já venceram. Numa nova análise, não valem mais.`,
    });
  }
  if (b.rodadas >= RODADAS_REUNIAO) {
    r.push({ nivel: "moderado", titulo: "Muitas rodadas de exigência", fato: `O concedente pediu complementação ${vezes(b.rodadas)}; o município enviou ${vezes(b.envios)}.` });
  }
  const t = b.tempoOrgao;
  if (t && t.mediana !== null && t.p75 !== null && (t.posicao === "passou_do_p75" || t.posicao === "passou_da_mediana")) {
    const alem = t.posicao === "passou_do_p75";
    r.push({
      nivel: alem ? "alto" : "moderado",
      titulo: alem ? "Mais demorado que 3 em cada 4 do órgão" : "Mais demorado que a metade do órgão",
      fato:
        `Assinado há ${dias(t.dias)}. Dos ${t.sairam.toLocaleString("pt-BR")} convênios da PB deste órgão assinados desde ${ano(t.desde)} que saíram da ` +
        `suspensiva, metade saiu em até ${dias(Math.round(t.mediana))} e 3 em cada 4, em até ${dias(Math.round(t.p75))}.`,
    });
  }
  // "Atendido" com condição do termo que nenhum texto menciona: o rótulo pode estar falando de outra
  // coisa (em Cabedelo, adimplência), e a condição que suspende o convênio segue sem registro.
  const faltando = semMencao(b);
  if (faltando.length && b.ultimo?.resultado === "atendido") {
    r.push({
      nivel: "alto",
      titulo: "Condição do termo sem registro de análise",
      fato:
        `O termo exige ${listaCondicoes(faltando)}, e nenhum texto do concedente na aba de requisitos ${faltando.length === 1 ? "a menciona" : "as menciona"}. ` +
        `O "atendido" mais recente pode não se referir ${faltando.length === 1 ? "a ela" : "a elas"}.`,
    });
  }
  const ordem: Nivel[] = ["critico", "alto", "moderado", "informativo"];
  return r.sort((a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel));
}

function lerCausas(b: Base & { tempoPorLado: Laudo["tempoPorLado"]; maiorEspera: Laudo["maiorEspera"] }): string[] {
  const c: string[] = [];
  if (b.condicoes.length) {
    const faltando = semMencao(b);
    c.push(
      `O termo condiciona a liberação a ${listaCondicoes(b.condicoes)}.` +
        (faltando.length === b.condicoes.length
          ? ` Nenhum texto do concedente na aba de requisitos menciona ${b.condicoes.length === 1 ? "essa condição" : "essas condições"}.`
          : faltando.length
            ? ` Os textos do concedente na aba de requisitos não mencionam ${listaCondicoes(faltando)}.`
            : ""),
    );
  }
  const primeiro = b.linha[0];
  if (primeiro && b.tempoPorLado.total > 0) {
    c.push(
      `Do primeiro registro, em ${dataBr(primeiro.dia)}, até a coleta, passaram ${dias(b.tempoPorLado.total)}: ` +
        `${dias(b.tempoPorLado.concedente)} com a vez do concedente e ${dias(b.tempoPorLado.proponente)} com a do município.`,
    );
  }
  if (b.maiorEspera && b.maiorEspera.dias > 0) {
    const aberta = b.maiorEspera.ate === b.referencia;
    c.push(
      `O maior intervalo sem movimento foi de ${dias(b.maiorEspera.dias)}, de ${dataBr(b.maiorEspera.de)} ` +
        `${aberta ? "até a coleta, e segue aberto" : `a ${dataBr(b.maiorEspera.ate)}`}, com a vez do ${NOME_LADO[b.maiorEspera.lado]}.`,
    );
  }
  if (b.rodadas > 0) {
    c.push(`O concedente pediu complementação ${vezes(b.rodadas)}; o município enviou documentação ${vezes(b.envios)}.`);
  }
  const doConcedente = b.analistas.length;
  if (doConcedente >= 3) c.push(`O processo passou por ${doConcedente} pessoas diferentes do lado do concedente.`);
  const atraso = b.linha.filter((l) => l.atrasoRegistro !== null && l.atrasoRegistro > DIAS_ATRASO_REGISTRO);
  if (atraso.length) {
    const pior = atraso.reduce((x, y) => ((y.atrasoRegistro ?? 0) > (x.atrasoRegistro ?? 0) ? y : x));
    c.push(
      `${atraso.length === 1 ? "Uma análise foi registrada" : `${atraso.length} análises foram registradas`} bem depois da data informada pelo analista; ` +
        `a maior diferença: análise de ${dataBr(pior.analisadaEm)} registrada em ${dataBr(pior.dia)}, ${dias(pior.atrasoRegistro ?? 0)} depois.`,
    );
  }
  if (b.documentos.vencidos.length) {
    const nomes = [...new Set(b.documentos.vencidos.map((d) => d.descricao ?? d.arquivo))].slice(0, 5);
    c.push(`Documentos anexados com validade vencida: ${nomes.join("; ")}${b.documentos.vencidos.length > nomes.length ? " e outros" : ""}.`);
  }
  return c;
}

function lerEstrategia(b: Base): Passo[] {
  const p: Passo[] = [];
  const u = b.ultimo;
  if (b.prazo.dias !== null && b.prazo.dias < 0) {
    p.push({
      titulo: "Confirmar se o instrumento segue vigente e pedir a prorrogação do prazo da suspensiva",
      porque: `O prazo registrado venceu em ${dataBr(b.prazo.data)}. Antes de qualquer outra providência, é preciso saber se ainda há instrumento a salvar.`,
    });
  } else if (b.prazo.dias !== null && b.prazo.dias <= DIAS_PRAZO_ALTO) {
    p.push({ titulo: "Pedir a prorrogação do prazo da suspensiva", porque: `${b.prazo.frase} O pedido precisa chegar antes dessa data.` });
  }
  if (b.documentos.vencidos.length) {
    const nomes = [...new Set(b.documentos.vencidos.map((d) => d.descricao ?? d.arquivo))].slice(0, 5);
    p.push({
      titulo: "Renovar e reanexar os documentos vencidos",
      porque: `Estão vencidos: ${nomes.join("; ")}${b.documentos.vencidos.length > nomes.length ? " e outros" : ""}. Cobrar o concedente com eles vencidos abre espaço para uma nova exigência.`,
    });
  }
  const faltando = semMencao(b);
  if (faltando.length) {
    p.push({
      titulo: "Descobrir onde está a análise das condições do termo",
      porque:
        `O termo exige ${listaCondicoes(faltando)} para a retirada, e nenhum texto do concedente na aba de requisitos trata disso. ` +
        `Essa análise pode estar em outro canal (por exemplo, a análise técnica da mandatária): perguntar ao concedente em qual está e pedir o parecer.`,
    });
  }
  if (u?.resultado === "atendido") {
    p.push({
      titulo: "Pedir formalmente a retirada da cláusula suspensiva",
      porque:
        `A última análise, de ${dataBr(u.dia)}${por(u.responsavel)}, foi registrada como atendida` +
        `${u.texto ? `, com a observação «${u.texto}»` : ""}. Citar essa análise no ofício` +
        `${b.condicoes.length ? `, comprovar o cumprimento de ${listaCondicoes(b.condicoes)}` : ""} e guardar o protocolo.`,
    });
  } else if (u?.resultado === "enviado") {
    p.push({ titulo: "Cobrar a análise do último envio", porque: `O município enviou em ${dataBr(u.dia)}, e não há análise há ${dias(b.vez.dias ?? 0)}.` });
  } else if (u?.resultado === "complementação solicitada" || u?.resultado === "não atendido") {
    p.push({
      titulo: "Responder ao último pedido do concedente",
      porque: `Pedido de ${dataBr(u.dia)}${por(u.responsavel)}${u.texto ? `: «${u.texto}»` : ""}.`,
    });
  }
  if (b.vigencia.dias !== null && b.vigencia.dias >= 0 && b.vigencia.dias <= DIAS_VIGENCIA_CURTA) {
    p.push({ titulo: "Pedir a prorrogação da vigência junto com a retirada", porque: `Sobram ${dias(b.vigencia.dias)} até ${dataBr(b.vigencia.data)} para licitar e executar.` });
  }
  if (b.rodadas >= RODADAS_REUNIAO) {
    p.push({
      titulo: `Pedir reunião técnica${b.contexto.orgao_sup ? ` com o ${b.contexto.orgao_sup}` : ""}`,
      // Só o fato: o número de pedidos não diz a causa. Em Gado Bravo (980439), as 18 rodadas eram o
      // mesmo aviso de inadimplência repetido, não divergência sobre o que se exige.
      porque: `O concedente registrou ${b.rodadas} pedidos de complementação contra ${b.envios.toLocaleString("pt-BR")} ${b.envios === 1 ? "envio" : "envios"} do município. Quando o vaivém se repete, uma reunião costuma destravar mais que um novo ofício.`,
    });
  }
  return p;
}

function lerInacao(b: Base): string[] {
  const i: string[] = [];
  if (b.dinheiro.parado !== null && b.dinheiro.parado > 0) {
    const nada = !b.dinheiro.desembolsado;
    i.push(
      `${moedaCurta(b.dinheiro.parado)} de repasse seguem sem desembolso` +
        (nada && b.contexto.dt_assinatura ? ` — nada foi liberado desde a assinatura, em ${dataBr(b.contexto.dt_assinatura)}.` : "."),
    );
  }
  if (b.prazo.dias !== null && b.prazo.dias < 0) {
    i.push(`Com o prazo vencido, o instrumento fica sujeito à extinção — e, com ela, à perda do repasse inteiro.`);
  } else if (b.prazo.data) {
    i.push(`Se ${dataBr(b.prazo.data)} passar sem a retirada, o instrumento pode ser extinto e o repasse, perdido.`);
  }
  if (b.vigencia.dias !== null && b.vigencia.dias > 0) {
    i.push(`Cada mês sem a retirada é um mês a menos para licitar e executar: a vigência acaba em ${dataBr(b.vigencia.data)}.`);
  }
  // Só com padrão (saídas suficientes) e com perda de fato: a taxa do órgão, não uma previsão deste convênio.
  const t = b.tempoOrgao;
  if (t && t.posicao !== null && t.perdidos > 0 && t.pctPerdido !== null) {
    i.push(
      `Neste órgão, ${Math.round(t.pctPerdido * 100)}% dos convênios da PB assinados desde ${ano(t.desde)} que terminaram morreram na suspensiva: ` +
        `${t.perdidos.toLocaleString("pt-BR")} de ${t.terminados.toLocaleString("pt-BR")}, ${moedaCurta(t.valorPerdido)} de repasse que não chegou.`,
    );
  }
  return i;
}

// ================================================================ urgência, para a lista

export interface ItemUrgencia {
  dt_suspensiva: string | null;
  dt_retirada_suspensiva: string | null;
  parado_desde: string | null;
}

/** O nível do prazo da suspensiva, com os mesmos limiares do laudo. */
export function nivelPrazo(i: Pick<ItemUrgencia, "dt_suspensiva" | "dt_retirada_suspensiva">, hoje: string): Nivel {
  if (i.dt_retirada_suspensiva || !i.dt_suspensiva) return "informativo";
  const d = diasEntre(hoje, i.dt_suspensiva);
  return d <= DIAS_PRAZO_CRITICO ? "critico" : d <= DIAS_PRAZO_ALTO ? "alto" : "moderado";
}

/**
 * Ordem da lista: primeiro o prazo (vencido e crítico no topo), depois quem está parado há mais
 * tempo. O prazo manda porque é ele que extingue o instrumento; o tempo parado só desempata.
 */
export function compararUrgencia(a: ItemUrgencia, b: ItemUrgencia, hoje: string): number {
  const peso: Record<Nivel, number> = { critico: 0, alto: 1, moderado: 2, informativo: 3 };
  const pa = peso[nivelPrazo(a, hoje)];
  const pb = peso[nivelPrazo(b, hoje)];
  if (pa !== pb) return pa - pb;
  if (pa <= 1 && a.dt_suspensiva && b.dt_suspensiva && a.dt_suspensiva !== b.dt_suspensiva) {
    return a.dt_suspensiva.localeCompare(b.dt_suspensiva);
  }
  // Parado desde mais cedo = parado há mais tempo = mais urgente. Sem data vai para o fim.
  if (a.parado_desde && b.parado_desde) return a.parado_desde.localeCompare(b.parado_desde);
  return a.parado_desde ? -1 : b.parado_desde ? 1 : 0;
}

// ================================================================ linha do tempo agrupada

export interface BlocoLinha {
  itens: LinhaDoTempo[];
  /** O bloco contém o evento mais recente. */
  ultimo: boolean;
}

/**
 * Junta eventos seguidos que só repetem o mesmo ato da mesma pessoa, sem texto: em Gado Bravo
 * (980439) são 16 pedidos de complementação em 44 dias, e 16 linhas iguais escondem o que importa.
 * Evento com texto nunca é agrupado — o texto é a parte que se lê.
 */
export function agruparLinha(linha: LinhaDoTempo[]): BlocoLinha[] {
  const blocos: BlocoLinha[] = [];
  for (const l of linha) {
    const bloco = blocos.at(-1);
    const anterior = bloco?.itens.at(-1);
    if (bloco && anterior && !anterior.texto && !l.texto && anterior.evento === l.evento && anterior.responsavel === l.responsavel) {
      bloco.itens.push(l);
    } else {
      blocos.push({ itens: [l], ultimo: false });
    }
  }
  if (blocos.length) blocos[blocos.length - 1].ultimo = true;
  return blocos;
}
