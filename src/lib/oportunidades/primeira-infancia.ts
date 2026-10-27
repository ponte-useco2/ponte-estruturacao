/**
 * Primeira infância na PB (P2, 22/10/2026; plano em Site-Ponte/primeira-infancia/PLANO.md). Puro, com teste.
 *
 * A página separa três coisas, como o protótipo de 22/10 (artifact AwQPiDc3Z2kT9PYnpXKedH):
 *   · o dinheiro CARIMBADO para a primeira infância: termos de creche e educação infantil (Novo PAC e PAR4, do
 *     SICONV), planos do Pix só de creche e a conta "Primeira Infância no SUAS" (Criança Feliz, do FNAS);
 *   · o CONTEXTO, dinheiro que pode ir para a primeira infância e não é carimbado: o FUNDEB não usado no ano, o saldo
 *     do salário-educação (SIOPE) e o saldo das contas da saúde (FNS, sem marca de idade);
 *   · a NECESSIDADE do município, da camada 2: creche de 0 a 3 anos, pré-escola, mortalidade infantil e materna.
 *
 * "Parado" é ponto para olhar, não irregularidade. O FUNDEB acima de 10% não aplicado cita a Lei 14.113/2020, art. 25,
 * §3º (até 10% podem ficar para o 1º quadrimestre do ano seguinte). Decisões do titular (22/10/2026): administrador e
 * cadastrado veem; só o administrador ordena por valor (sem ranking de municípios para quem não é da casa).
 */
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";

// ============================================================================ termos de creche (SICONV)

const sem = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Creche e educação infantil no programa ou no objeto ("trabalho infantil" e "mortalidade infantil" não contam). */
const CRECHE = /creche|educacao infantil|ensino infantil|pre-?escola|proinfancia|pro-infancia|primeira infancia|\bcmei\b/;

export function ehCreche(programa: string | null, objeto: string | null): boolean {
  return CRECHE.test(sem(`${programa ?? ""} ${objeto ?? ""}`));
}

/** Os padrões do `.or()` do PostgREST que trazem os candidatos (o filtro fino é `ehCreche`). */
export const PADROES_CRECHE = ["creche", "infantil", "pré-escola", "pre-escola", "proinf", "primeira inf"];

export interface TermoCreche {
  nr: string;
  ibge: string | null;
  municipio: string | null;
  programa: string | null;
  situacao: string | null;
  repasse: number | null;
  desembolsado: number | null;
  saldo: number | null;
  assinatura: string | null;
  vigencia: string | null;
  /** 0 a 1. */
  fisico: number | null;
  /** Dias sem movimento na conta, contados até o dia do arquivo do SICONV (`painel_convenio`). */
  dias: number | null;
  nuncaPagou: boolean | null;
  licitacao: string | null;
}

export type EstadoTermo = "parado" | "recente" | "pagando" | "a_liberar" | "par";

/** O limite do "parado": a 1ª parcela em conta, nenhum pagamento e esse tanto de dias sem movimento. */
export const DIAS_PARADO = 90;
export const DIAS_PARADO_LONGO = 180;

export const ROTULO_ESTADO: Record<EstadoTermo, string> = {
  parado: "em conta, sem pagamento",
  recente: "liberado há pouco",
  pagando: "pagando",
  a_liberar: "assinado, a liberar",
  par: "PAR4 (ver as obras do município)",
};

/**
 * O estado do termo. Os do PAR4 ficam à parte: o SICONV traz o termo do SIMEC sem a execução (o vazio do SIMEC/PAR,
 * onda 12), então o saldo em conta existe, mas só o SIMEC diz se a obra andou.
 */
export function estadoTermo(t: TermoCreche): EstadoTermo {
  if (/par ?4|simec/i.test(t.programa ?? "")) return "par";
  if (!t.desembolsado) return "a_liberar";
  if (t.nuncaPagou) return (t.dias ?? 0) >= DIAS_PARADO ? "parado" : "recente";
  return "pagando";
}

// ============================================================================ Pix

/**
 * A mesma regra do job do Pix (`pix_fundo/laudo.py`, `classe_primeira_infancia`, oport_48): enquanto a coluna do laudo
 * não vem preenchida (rodada de segunda-feira), a tela classifica pelo objeto. Mantida em par com a do job pelo teste.
 */
const PIX_SIM = /creche|educacao infantil|ensino infantil|pre-?escola|primeira infancia|pro-?infancia|\bcmei\b|\bcei\b/;
const PIX_OUTROS =
  /paviment|calcament|fotovolt|\bubs\b|samu|quadra|cemiter|matadouro|maquin|orla|estrada|fundamental|esportiv|veicul|agricol|unidade basica|posto|socioassistencial|saneamento|abastecimento|iluminacao|praca|mercado|hospital|academia|ginasio|fisioterap/;

export type ClassePix = "exclusivo" | "misto";

export function classePix(objeto: string | null, doJob?: string | null): ClassePix | null {
  if (doJob === "exclusivo" || doJob === "misto") return doJob;
  const t = sem(objeto).replace(/ /g, " ");
  if (!PIX_SIM.test(t)) return null;
  return PIX_OUTROS.test(t) ? "misto" : "exclusivo";
}

export interface PlanoPixPI {
  id: number;
  codigo: string;
  ibge: string | null;
  ano: number;
  pago: number;
  saldo: number | null;
  dataSaldo: string | null;
  objeto: string | null;
  classe: ClassePix;
}

// ============================================================================ contexto e necessidade

/** O SIOPE de um município num ano (códigos do job `fnas/`, `ROTULO_SIOPE`). */
export type Siope = Partial<Record<"1.4" | "1.6" | "1.7" | "2.1" | "2.4" | "4.1" | "4.15" | "7.2" | "7.3" | "11" | "166", number>>;

export interface ContextoPI {
  /** Saldo da conta "Primeira Infância no SUAS" (Criança Feliz) no último mês e o repasse dos 12 meses até ele. */
  cfSaldo: number | null;
  cfRepasse12: number | null;
  siope: Siope | null;
  /** A saúde por grupo de conta (custeio, investimento, emenda, outras), só do fundo municipal. */
  saude: Partial<Record<"custeio" | "investimento" | "emenda" | "outras", number>> | null;
}

/**
 * Uma obra de creche ou educação infantil no Obrasgov.br (job `obras/`, oport_49, P0.4 de 27/10/2026). A fonte não traz
 * o número do termo: obra e termo se ligam só pelo município. `origem` diz de onde veio o município.
 */
export interface ObraCreche {
  id: string;
  ibge: string | null;
  origem: "tomador" | "nome" | "geometria" | "nao_identificado";
  nome: string;
  situacao: string | null;
  sistema: string | null;
  pct: number | null;
  inicio: string | null;
  fimPrevista: string | null;
  dataSituacao: string | null;
  justificativa: string | null;
}

export const SITUACAO_PARALISADA = "Paralisada";
export const SITUACAO_EM_EXECUCAO = "Em execução";

/** A ordem das obras na tela: paralisadas, em execução, cadastradas, o resto; dentro, o nome. */
export function ordenarObras(obras: ObraCreche[]): ObraCreche[] {
  const peso = (o: ObraCreche) =>
    o.situacao === SITUACAO_PARALISADA ? 0 : o.situacao === SITUACAO_EM_EXECUCAO ? 1 : o.situacao === "Cadastrada" ? 2 : 3;
  return [...obras].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface MunicipioPI {
  ibge: string;
  nome: string;
  termos: TermoCreche[];
  pix: PlanoPixPI[];
  /** As obras de creche do município no Obrasgov.br (as sem município identificado ficam fora). */
  obras: ObraCreche[];
  contexto: ContextoPI;
  /** Matrículas em creche por 100 crianças de 0 a 3 anos (camada 2), quando há. */
  creche03: number | null;
}

export interface ResumoPI {
  parado: number;
  paradoLongo: number;
  nParado: number;
  recente: number;
  aLiberar: number;
  nALiberar: number;
  parSaldo: number;
  pixSaldo: number;
  cfSaldo: number | null;
  /** Quantos meses de repasse o saldo do Criança Feliz representa (saldo ÷ repasse médio mensal dos 12 meses). */
  cfMeses: number | null;
  fundebNaoUsado: number | null;
  /** Estimativa, com o cálculo exposto: não usado × % do FUNDEB aplicado em educação infantil (indicador 2.1). */
  fundebEiEstimado: number | null;
  fundebPctNaoAplicado: number | null;
  fundebAcimaDoLimite: boolean;
  salarioEducacao: number | null;
  saude: number | null;
  /** Obras de creche no Obrasgov.br: paralisadas e em execução. */
  obrasParalisadas: number;
  obrasEmExecucao: number;
}

export const LIMITE_FUNDEB_NAO_APLICADO = 10;

const soma = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

export function resumoMunicipio(m: MunicipioPI): ResumoPI {
  const com = (e: EstadoTermo) => m.termos.filter((t) => estadoTermo(t) === e);
  const parados = com("parado");
  const s = m.contexto.siope;
  const naoUsado = s?.["7.3"] ?? null;
  const pctEi = s?.["2.1"] ?? null;
  const pctNaoAplicado = s?.["1.4"] ?? null;
  const cf = m.contexto.cfSaldo;
  const rep = m.contexto.cfRepasse12;
  return {
    parado: soma(parados.map((t) => t.saldo)),
    paradoLongo: soma(parados.filter((t) => (t.dias ?? 0) >= DIAS_PARADO_LONGO).map((t) => t.saldo)),
    nParado: parados.length,
    recente: soma(com("recente").map((t) => t.saldo)),
    aLiberar: soma(com("a_liberar").map((t) => t.repasse)),
    nALiberar: com("a_liberar").length,
    parSaldo: soma(com("par").map((t) => t.saldo)),
    pixSaldo: soma(m.pix.filter((p) => p.classe === "exclusivo").map((p) => p.saldo)),
    cfSaldo: cf,
    cfMeses: cf !== null && rep ? Math.round((cf / (rep / 12)) * 10) / 10 : null,
    fundebNaoUsado: naoUsado,
    fundebEiEstimado: naoUsado !== null && pctEi !== null ? Math.round(naoUsado * pctEi) / 100 : null,
    fundebPctNaoAplicado: pctNaoAplicado,
    fundebAcimaDoLimite: pctNaoAplicado !== null && pctNaoAplicado > LIMITE_FUNDEB_NAO_APLICADO,
    salarioEducacao: s?.["166"] ?? null,
    saude: m.contexto.saude ? soma(Object.values(m.contexto.saude)) : null,
    obrasParalisadas: m.obras.filter((o) => o.situacao === SITUACAO_PARALISADA).length,
    obrasEmExecucao: m.obras.filter((o) => o.situacao === SITUACAO_EM_EXECUCAO).length,
  };
}

/** Se o município tem algo carimbado para mostrar (termo, plano do Pix ou saldo do Criança Feliz). */
export function temCarimbado(m: MunicipioPI): boolean {
  return m.termos.length > 0 || m.pix.length > 0 || (m.contexto.cfSaldo ?? 0) > 0 || m.obras.some((o) => o.situacao === SITUACAO_PARALISADA);
}

export function totais(lista: MunicipioPI[]): ResumoPI & { municipios: number; acimaDoLimite: string[] } {
  const rs = lista.map(resumoMunicipio);
  const s = (k: keyof ResumoPI) => soma(rs.map((r) => r[k] as number | null));
  return {
    parado: s("parado"),
    paradoLongo: s("paradoLongo"),
    nParado: s("nParado"),
    recente: s("recente"),
    aLiberar: s("aLiberar"),
    nALiberar: s("nALiberar"),
    parSaldo: s("parSaldo"),
    pixSaldo: s("pixSaldo"),
    cfSaldo: s("cfSaldo"),
    cfMeses: null,
    fundebNaoUsado: s("fundebNaoUsado"),
    fundebEiEstimado: s("fundebEiEstimado"),
    fundebPctNaoAplicado: null,
    fundebAcimaDoLimite: rs.some((r) => r.fundebAcimaDoLimite),
    salarioEducacao: s("salarioEducacao"),
    saude: s("saude"),
    obrasParalisadas: s("obrasParalisadas"),
    obrasEmExecucao: s("obrasEmExecucao"),
    municipios: lista.length,
    acimaDoLimite: lista.filter((_, i) => rs[i].fundebAcimaDoLimite).map((m) => m.nome),
  };
}

// ============================================================================ a tabela dos 223

export const TABELA_PRIMEIRA_INFANCIA = "pi-municipios";

/**
 * As colunas da lista dos 223. Para quem não é administrador, as colunas de valor filtram mas não ordenam (decisão de
 * 22/10/2026: sem ranking de municípios fora da casa); o nome e a creche de 0 a 3 anos ordenam para todos.
 */
export function colunasPI(administrador: boolean): ColunaTabela[] {
  const valor = (id: string, titulo: string, oculta = false): ColunaTabela => ({
    id,
    titulo,
    tipo: "numero",
    alinhar: "direita",
    ...(administrador ? {} : { ordenavel: false }),
    ...(oculta ? { oculta: true } : {}),
  });
  return [
    { id: "municipio", titulo: "Município", tipo: "texto" },
    valor("parado", "Creche: em conta, sem pagamento"),
    valor("a-liberar", "Creche: assinado, a liberar"),
    valor("par", "PAR4: saldo (conferir)"),
    valor("pix", "Pix só de creche: saldo"),
    valor("obras-paralisadas", "Obras de creche paralisadas (Obrasgov)"),
    valor("crianca-feliz", "Criança Feliz: saldo"),
    valor("fundeb", "FUNDEB não usado no ano"),
    valor("fundeb-ei", "dele, proporção da educação infantil (estimativa)", true),
    valor("fundeb-pct", "% do FUNDEB não aplicado", true),
    valor("salario-educacao", "Salário-educação: saldo", true),
    valor("saude", "Saúde: saldo nas contas do FNS", true),
    { id: "creche-03", titulo: "Creche de 0 a 3 anos (por 100 crianças)", tipo: "numero", alinhar: "direita" },
    { id: "ibge", titulo: "IBGE", tipo: "texto", oculta: true, textoNoCsv: true },
  ];
}

export function valoresPI(m: MunicipioPI): Record<string, ValorCelula> {
  const r = resumoMunicipio(m);
  const ou = (x: number | null) => (x ? x : null);
  return {
    municipio: m.nome,
    parado: ou(r.parado),
    "a-liberar": ou(r.aLiberar),
    par: ou(r.parSaldo),
    pix: ou(r.pixSaldo),
    "obras-paralisadas": ou(r.obrasParalisadas),
    "crianca-feliz": ou(r.cfSaldo),
    fundeb: r.fundebNaoUsado,
    "fundeb-ei": r.fundebEiEstimado,
    "fundeb-pct": r.fundebPctNaoAplicado,
    "salario-educacao": r.salarioEducacao,
    saude: r.saude,
    "creche-03": m.creche03,
    ibge: m.ibge,
  };
}
