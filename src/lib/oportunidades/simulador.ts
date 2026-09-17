/**
 * Simulador de operação de crédito e diagnóstico por projeto (onda 9) — puro, sem rede.
 *
 * Parte do que o job fiscal gravou (RCL ajustada, DCL, serviço da dívida, caixa não vinculado e o
 * cronograma do PVL de referência) e projeta, ano a ano, uma operação simulada contra os limites da
 * Resolução do Senado nº 43/2001, art. 7º (16% e 11,5% da RCL) e da nº 40/2001 (DCL até 120% da RCL).
 *
 * É aproximação com premissas escritas na tela (`PREMISSAS`): não substitui a análise da STN no PVL
 * nem a do agente financeiro. O estado de cada verificação continua vindo do job; aqui só se soma a
 * operação simulada ao que já existe.
 */
import {
  NOME_VERIFICACAO,
  ORDEM_VERIFICACOES,
  type ConclusaoFiscal,
  type Decisao,
  type EstadoFiscal,
  type IndicadoresFiscais,
  type ProjecaoFiscal,
  type PvlReferencia,
  type ServicoDoAno,
  type VerificacaoFiscal,
} from "./fiscal.ts";

export const LIMITE_OPERACOES = 16;
export const ALERTA_OPERACOES = 14.4;
export const LIMITE_SERVICO = 11.5;
export const ALERTA_SERVICO = 10.35;
export const LIMITE_DCL = 120;
export const ALERTA_DCL = 108;

export type Sistema = "sac" | "price";

// ============================ ENTRADA ============================

export const CAMPOS = ["total", "repasse", "credito", "taxa", "prazo", "carencia", "liberacao", "sistema", "inicio", "crescimento"] as const;
export type Campo = (typeof CAMPOS)[number];

export interface Projeto {
  /** `null`: não informado; a contrapartida fica zero. */
  total: number | null;
  repasse: number;
  credito: number;
}

export interface Operacao {
  valor: number;
  /** % ao ano. */
  taxa: number;
  /** Anos, com a carência incluída. */
  prazo: number;
  carencia: number;
  /** Anos de liberação, em parcelas iguais. */
  liberacao: number;
  sistema: Sistema;
  /** Ano da primeira liberação. */
  inicio: number;
}

export interface ParametrosSimulador {
  /** O que a pessoa digitou (ou o padrão), para devolver ao formulário tal como veio. */
  bruto: Record<Campo, string>;
  projeto: Projeto | null;
  operacao: Operacao | null;
  /** % real ao ano de crescimento da RCL. */
  crescimento: number;
  erros: string[];
}

/**
 * Número escrito do jeito brasileiro ("1.500.000,00", "8,5") ou com ponto decimal ("8.5").
 * Ponto só vira separador de milhar quando separa grupos de três dígitos e não há vírgula.
 */
export function numeroBr(texto: string | undefined): number | null {
  if (texto === undefined) return null;
  let s = texto.replace(/R\$|%|\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const primeiro = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 40);

export function parametrosSimulador(sp: Record<string, string | string[] | undefined>, anoInicio: number): ParametrosSimulador {
  const padrao: Record<Campo, string> = {
    total: "", repasse: "", credito: "", taxa: "", prazo: "20", carencia: "3", liberacao: "2", sistema: "sac",
    inicio: String(anoInicio), crescimento: "0",
  };
  const bruto = Object.fromEntries(CAMPOS.map((c) => [c, primeiro(sp[c]) || padrao[c]])) as Record<Campo, string>;
  const erros: string[] = [];
  const valor = (c: Campo, rotulo: string, opcional: boolean): number | null => {
    if (!bruto[c]) {
      if (!opcional) erros.push(`${rotulo}: informe um valor.`);
      return null;
    }
    const n = numeroBr(bruto[c]);
    if (n === null) erros.push(`${rotulo}: use só números, como 1.500.000,00.`);
    return n;
  };
  const inteiro = (c: Campo, rotulo: string, min: number, max: number): number => {
    const n = valor(c, rotulo, false);
    if (n !== null && (!Number.isInteger(n) || n < min || n > max)) erros.push(`${rotulo}: um número inteiro de ${min} a ${max}.`);
    return n ?? min;
  };

  const crescimento = valor("crescimento", "Crescimento real da RCL", true) ?? 0;
  if (crescimento < -5 || crescimento > 10) erros.push("Crescimento real da RCL: entre -5% e 10% ao ano.");
  if (!bruto.total && !bruto.repasse && !bruto.credito) return { bruto, projeto: null, operacao: null, crescimento, erros };

  const total = valor("total", "Valor total do projeto", true);
  const repasse = valor("repasse", "Repasse", true) ?? 0;
  const credito = valor("credito", "Operação de crédito", true) ?? 0;
  if ([total ?? 0, repasse, credito].some((v) => v < 0)) erros.push("Os valores do projeto não podem ser negativos.");
  if (total !== null && total < repasse + credito) erros.push("O valor total do projeto é menor que a soma do repasse e do crédito.");
  if (total === null && repasse + credito === 0 && !erros.length) erros.push("Informe o valor total, o repasse ou o crédito.");

  let operacao: Operacao | null = null;
  if (credito > 0) {
    const taxa = valor("taxa", "Taxa de juros", false);
    if (taxa !== null && (taxa < 0 || taxa > 30)) erros.push("Taxa de juros: entre 0% e 30% ao ano.");
    const prazo = inteiro("prazo", "Prazo total", 1, 40);
    const carencia = inteiro("carencia", "Carência", 1, 20);
    const liberacao = inteiro("liberacao", "Anos de liberação", 1, 10);
    const inicio = inteiro("inicio", "Ano da primeira liberação", anoInicio - 1, anoInicio + 10);
    if (carencia >= prazo) erros.push("A carência precisa ser menor que o prazo total.");
    // Liberação depois da carência mistura amortização com saldo ainda crescendo: o simulador não modela.
    if (liberacao > carencia) erros.push("A carência precisa cobrir os anos de liberação.");
    const sistema: Sistema = bruto.sistema === "price" ? "price" : "sac";
    operacao = { valor: credito, taxa: taxa ?? 0, prazo, carencia, liberacao, sistema, inicio };
  }
  const projeto = { total, repasse, credito };
  return erros.length ? { bruto, projeto: null, operacao: null, crescimento, erros } : { bruto, projeto, operacao, crescimento, erros };
}

export function urlSimulador(ibge: string, bruto: Partial<Record<Campo, string>>): string {
  const q = new URLSearchParams();
  for (const c of CAMPOS) if (bruto[c]) q.set(c, bruto[c] as string);
  const s = q.toString();
  return `/mapa/fiscal/${ibge}/simular${s ? `?${s}` : ""}`;
}

// ============================ CRONOGRAMA ============================

export interface LinhaCronograma {
  ano: number;
  liberacao: number;
  juros: number;
  amortizacao: number;
  servico: number;
  /** Saldo devedor no fim do ano. */
  saldo: number;
}

/**
 * Ano a ano: liberação em parcelas iguais no meio do ano, juros pagos também na carência e
 * amortização de `prazo − carência` anos por SAC (amortização constante) ou Price (prestação constante).
 */
export function cronograma(op: Operacao): LinhaCronograma[] {
  const i = op.taxa / 100;
  const n = op.prazo - op.carencia;
  const linhas: LinhaCronograma[] = [];
  let saldo = 0;
  let amortizacaoSac = 0;
  let prestacao = 0;
  for (let k = 0; k < op.prazo; k++) {
    const liberacao = k < op.liberacao ? op.valor / op.liberacao : 0;
    const inicial = saldo;
    const juros = i * (inicial + liberacao / 2);
    if (k === op.carencia) {
      amortizacaoSac = inicial / n;
      prestacao = i === 0 ? inicial / n : (inicial * i) / (1 - (1 + i) ** -n);
    }
    let amortizacao = 0;
    if (k >= op.carencia) {
      // No último ano, o que sobrou: sem resíduo de arredondamento.
      amortizacao = k === op.prazo - 1 ? inicial : op.sistema === "sac" ? amortizacaoSac : prestacao - juros;
    }
    saldo = inicial + liberacao - amortizacao;
    linhas.push({ ano: op.inicio + k, liberacao, juros, amortizacao, servico: juros + amortizacao, saldo });
  }
  return linhas;
}

// ============================ BASE DO MUNICÍPIO ============================

export interface BaseFiscal {
  /** Exercício do RGF lido: a RCL ajustada é dos 12 meses até ele. */
  anoBase: number | null;
  rgf: string | null;
  rcl: number | null;
  dcl: number | null;
  servicoAno: ServicoDoAno | null;
  servicoSiconfi: IndicadoresFiscais["servico_siconfi"];
  operacoesExercicio: number | null;
  caixa: { exercicio: number; valor: number } | null;
  pvl: PvlReferencia | null;
  projecao: ProjecaoFiscal[];
}

const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function baseFiscal(ind: Partial<IndicadoresFiscais>, projecao: readonly ProjecaoFiscal[]): BaseFiscal {
  const ano = /\/(\d{4})$/.exec(ind.rgf ?? "");
  const caixa = ind.caixa && numero(ind.caixa.nao_vinculado_liquido) !== null ? { exercicio: ind.caixa.exercicio, valor: ind.caixa.nao_vinculado_liquido as number } : null;
  return {
    anoBase: ano ? Number(ano[1]) : null,
    rgf: ind.rgf ?? null,
    rcl: numero(ind.rcl_ajustada) && (ind.rcl_ajustada as number) > 0 ? (ind.rcl_ajustada as number) : null,
    dcl: numero(ind.dcl),
    servicoAno: ind.servico_ano ?? null,
    servicoSiconfi: ind.servico_siconfi ?? null,
    operacoesExercicio: numero(ind.operacoes_exercicio),
    caixa,
    pvl: ind.pvl_referencia ?? null,
    projecao: [...projecao].sort((a, b) => a.ano - b.ano),
  };
}

/**
 * O que já existe num ano, sem a operação simulada.
 * Com PVL recente, o cronograma dele: cobre a dívida consolidada e as operações contratadas (e a pedida,
 * enquanto o pedido está em curso); ano fora do cronograma não tem serviço. Sem PVL, o empenhado no último
 * exercício, repetido: conservador, porque a dívida antiga também amortiza.
 * Liberações: no exercício do RGF, o maior entre o previsto e o já realizado.
 */
export function existente(base: BaseFiscal, ano: number): { servico: number | null; liberacoes: number } {
  const realizadas = ano === base.anoBase ? (base.operacoesExercicio ?? 0) : 0;
  if (base.projecao.length) {
    const p = base.projecao.find((x) => x.ano === ano);
    return { servico: p ? p.servico_demais + p.servico_pleiteada : 0, liberacoes: Math.max(p?.liberacoes ?? 0, realizadas) };
  }
  return { servico: base.servicoSiconfi ? base.servicoSiconfi.total : null, liberacoes: realizadas };
}

// ============================ SIMULAÇÃO ============================

export interface AnoSimulado {
  ano: number;
  rcl: number | null;
  liberacaoExistente: number;
  liberacaoSimulada: number;
  operacoesPct: number | null;
  servicoExistente: number | null;
  servicoSimulado: number;
  servicoPct: number | null;
  dcl: number | null;
  dclPct: number | null;
}

export type CodigoLimite = "G4" | "G5" | "G6";

export interface LimiteSimulado {
  codigo: CodigoLimite;
  nome: string;
  estado: EstadoFiscal;
  /** O percentual que decide: o pior ano (G4, G6) ou a média dos anos com pagamento (G5). */
  pct: number | null;
  ano: number | null;
  frase: string;
}

export interface Simulacao {
  anos: AnoSimulado[];
  cronograma: LinhaCronograma[];
  limites: LimiteSimulado[];
}

const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function estadoPorLimite(v: number, limite: number, alerta: number): EstadoFiscal {
  return v > limite ? "nao_atendido" : v > alerta ? "atencao" : "atendido";
}

function pior<T>(xs: readonly T[], chave: (x: T) => number | null): T | null {
  let melhor: T | null = null;
  for (const x of xs) {
    const v = chave(x);
    if (v !== null && (melhor === null || v > (chave(melhor) as number))) melhor = x;
  }
  return melhor;
}

export function simular(base: BaseFiscal, op: Operacao, crescimento: number): Simulacao {
  const linhas = cronograma(op);
  const anoBase = base.anoBase ?? op.inicio;
  let acumulado = 0;
  const anos = linhas.map((l): AnoSimulado => {
    const rcl = base.rcl === null ? null : base.rcl * (1 + crescimento / 100) ** (l.ano - anoBase);
    const ex = existente(base, l.ano);
    acumulado += l.liberacao - l.amortizacao;
    const dcl = base.dcl === null ? null : base.dcl + acumulado;
    return {
      ano: l.ano,
      rcl,
      liberacaoExistente: ex.liberacoes,
      liberacaoSimulada: l.liberacao,
      operacoesPct: rcl === null ? null : ((ex.liberacoes + l.liberacao) / rcl) * 100,
      servicoExistente: ex.servico,
      servicoSimulado: l.servico,
      servicoPct: rcl === null || ex.servico === null ? null : ((ex.servico + l.servico) / rcl) * 100,
      dcl,
      dclPct: rcl === null || dcl === null ? null : (dcl / rcl) * 100,
    };
  });
  return { anos, cronograma: linhas, limites: [limiteOperacoes(anos), limiteServico(anos, base), limiteDcl(anos)] };
}

function limiteOperacoes(anos: AnoSimulado[]): LimiteSimulado {
  const nome = NOME_VERIFICACAO.G4;
  const comLiberacao = anos.filter((a) => a.liberacaoSimulada > 0);
  if (comLiberacao.some((a) => a.operacoesPct === null)) {
    return { codigo: "G4", nome, estado: "nao_verificavel", pct: null, ano: null, frase: "Sem a RCL ajustada, não há como calcular." };
  }
  const p = pior(comLiberacao, (a) => a.operacoesPct) as AnoSimulado;
  const pct = p.operacoesPct as number;
  return {
    codigo: "G4", nome, estado: estadoPorLimite(pct, LIMITE_OPERACOES, ALERTA_OPERACOES), pct, ano: p.ano,
    frase: `No pior ano, ${p.ano}, as liberações somam ${fmtPct(pct)} da RCL projetada (limite de 16%).`,
  };
}

function limiteServico(anos: AnoSimulado[], base: BaseFiscal): LimiteSimulado {
  const nome = NOME_VERIFICACAO.G5;
  const comPagamento = anos.filter((a) => a.servicoSimulado > 0);
  if (!comPagamento.length || comPagamento.some((a) => a.servicoPct === null)) {
    const motivo = base.rcl === null ? "Sem a RCL ajustada" : "Sem o serviço da dívida que o município já tem";
    return { codigo: "G5", nome, estado: "nao_verificavel", pct: null, ano: null, frase: `${motivo}, não há como calcular.` };
  }
  const media = comPagamento.reduce((s, a) => s + (a.servicoPct as number), 0) / comPagamento.length;
  const p = pior(comPagamento, (a) => a.servicoPct) as AnoSimulado;
  const piorPct = p.servicoPct as number;
  let estado = estadoPorLimite(media, LIMITE_SERVICO, ALERTA_SERVICO);
  let frase = `Média de ${fmtPct(media)} da RCL nos ${comPagamento.length} anos com pagamento da operação (limite de 11,5%); o pior ano é ${p.ano}, com ${fmtPct(piorPct)}.`;
  if (estado === "atendido" && piorPct > LIMITE_SERVICO) {
    estado = "atencao";
    frase = `Média de ${fmtPct(media)} da RCL nos ${comPagamento.length} anos com pagamento da operação, dentro do limite de 11,5%, mas ${p.ano} chega a ${fmtPct(piorPct)}.`;
  }
  return { codigo: "G5", nome, estado, pct: media, ano: p.ano, frase };
}

function limiteDcl(anos: AnoSimulado[]): LimiteSimulado {
  const nome = NOME_VERIFICACAO.G6;
  if (anos.some((a) => a.dclPct === null)) {
    const frase = anos.some((a) => a.rcl === null) ? "Sem a RCL ajustada, não há como calcular." : "Sem a DCL do último RGF, não há como calcular.";
    return { codigo: "G6", nome, estado: "nao_verificavel", pct: null, ano: null, frase };
  }
  const p = pior(anos, (a) => a.dclPct) as AnoSimulado;
  const pct = p.dclPct as number;
  return {
    codigo: "G6", nome, estado: estadoPorLimite(pct, LIMITE_DCL, ALERTA_DCL), pct, ano: p.ano,
    frase: `A dívida consolidada líquida aproximada chega a ${fmtPct(pct)} da RCL em ${p.ano} (limite de 120%).`,
  };
}

/**
 * O maior valor que, nas mesmas condições, não passa de nenhum limite (16%, média de 11,5% e 120%).
 * `null` quando algum limite não pode ser calculado; 0 quando nem um valor mínimo cabe.
 * Arredondado para baixo, em milhares.
 */
export function valorMaximo(base: BaseFiscal, op: Operacao, crescimento: number): number | null {
  const cabe = (valor: number) => simular(base, { ...op, valor }, crescimento).limites.every((l) => l.estado !== "nao_atendido");
  if (simular(base, op, crescimento).limites.some((l) => l.estado === "nao_verificavel")) return null;
  if (!cabe(1000)) return 0;
  let baixo = 1000;
  let alto = Math.max(op.valor, 1000);
  while (cabe(alto)) {
    baixo = alto;
    alto *= 2;
    if (alto > 1e13) return null;
  }
  for (let k = 0; k < 80 && alto - baixo > 1; k++) {
    const meio = (baixo + alto) / 2;
    if (cabe(meio)) baixo = meio;
    else alto = meio;
  }
  return Math.floor(baixo / 1000) * 1000;
}

// ============================ DIAGNÓSTICO POR PROJETO ============================

export type TipoProvidencia = "bloqueio" | "limite" | "contrapartida" | "conferir" | "documento" | "alerta";

export interface Providencia {
  tipo: TipoProvidencia;
  codigo: string | null;
  texto: string;
  porque: string;
}

export interface Diagnostico {
  decisoes: Decisao[];
  contrapartida: number;
  estado: EstadoFiscal;
  /** O caminho mínimo, na ordem: bloqueios, limites da operação, contrapartida, o que conferir e os documentos. */
  providencias: Providencia[];
  /** Alertas: não impedem, mas pedem acompanhamento. */
  acompanhar: Providencia[];
  /** Quando a contrapartida cabe no caixa, a frase que diz isso (com a ressalva). */
  notaContrapartida: string | null;
}

const PROVIDENCIA_BLOQUEIO: Record<string, string> = {
  G1: "Entregar ao Siconfi os relatórios que não constam e conferir a baixa no CAUC.",
  G2: "Reconduzir a despesa com pessoal a menos de 54% da RCL: fora do prazo de recondução, ficam vedadas transferência voluntária e operação de crédito (LRF, art. 23, § 3º).",
  G3: "Rever a programação para que as operações de crédito não superem as despesas de capital (regra de ouro).",
  G4: "Esperar o próximo exercício: as operações de crédito do exercício já passam de 16% da RCL.",
  G5: "Reduzir o comprometimento com a dívida antes de pedir nova operação.",
  G6: "Reduzir a dívida consolidada líquida a menos de 120% da RCL.",
  G7: "Regularizar os itens com pendência no CAUC e conferir a baixa na posição seguinte.",
  G7A: "Regularizar as obrigações de transparência (bloco 3 do CAUC).",
  G11: "Aplicar o mínimo de 25% em educação e transmitir o SIOPE.",
  G12: "Aplicar o mínimo de 15% em saúde e homologar o SIOPS.",
};

const PROVIDENCIA_DOCUMENTO: Record<string, string> = {
  G8: "Prever na LOA o objeto e a contrapartida.",
  G9: "Aprovar a lei que autoriza a operação de crédito.",
  G10: "Ter projeto, licenças e capacidade de execução exigidos pelo concedente ou pelo agente financeiro.",
};

const PROVIDENCIA_LIMITE: Record<CodigoLimite, string> = {
  G4: "Espalhar as liberações por mais anos ou reduzir o valor da operação.",
  G5: "Alongar o prazo ou a carência, negociar a taxa ou reduzir o valor da operação.",
  G6: "Reduzir o valor da operação.",
};

export const moeda = (v: number) => `${v < 0 ? "-" : ""}R$ ${Math.abs(Math.round(v)).toLocaleString("pt-BR")}`;

export function diagnosticar(e: {
  projeto: Projeto;
  conclusoes: readonly ConclusaoFiscal[];
  verificacoes: readonly Pick<VerificacaoFiscal, "codigo" | "nome" | "estado" | "resumo">[];
  base: BaseFiscal;
  simulacao: Simulacao | null;
}): Diagnostico {
  const { projeto, base, simulacao } = e;
  const decisoes: Decisao[] = ["A", ...(projeto.repasse > 0 ? (["B"] as const) : []), ...(projeto.credito > 0 ? (["C"] as const) : [])];
  const relevantes = e.conclusoes.filter((c) => decisoes.includes(c.decisao));
  // Com operação simulada, G4, G5 e G6 saem da simulação, não do retrato de hoje.
  const substituidas = new Set<string>(simulacao ? ["G4", "G5", "G6"] : []);
  const ordem = (cs: string[]) => {
    const unicos = new Set(cs);
    // O G7A é o bloco 3 do mesmo CAUC: com o G7 na lista, os itens dele já estão lá.
    if (unicos.has("G7")) unicos.delete("G7A");
    return [...unicos].filter((c) => !substituidas.has(c)).sort((a, b) => (ORDEM_VERIFICACOES as readonly string[]).indexOf(a) - (ORDEM_VERIFICACOES as readonly string[]).indexOf(b));
  };
  const resumo = (c: string) => e.verificacoes.find((v) => v.codigo === c)?.resumo ?? NOME_VERIFICACAO[c] ?? c;
  const nome = (c: string) => NOME_VERIFICACAO[c] ?? c;

  const bloqueios = ordem(relevantes.flatMap((c) => c.bloqueantes)).map(
    (c): Providencia => ({ tipo: "bloqueio", codigo: c, texto: PROVIDENCIA_BLOQUEIO[c] ?? `Resolver: ${nome(c)}.`, porque: resumo(c) }),
  );
  const conferir = ordem(relevantes.flatMap((c) => c.sem_dado)).map(
    (c): Providencia => ({ tipo: "conferir", codigo: c, texto: `Conferir na fonte: ${nome(c)}. A leitura automática não trouxe o dado.`, porque: resumo(c) }),
  );
  const acompanhar = ordem(relevantes.flatMap((c) => c.alertas)).map(
    (c): Providencia => ({ tipo: "alerta", codigo: c, texto: `Acompanhar: ${nome(c)}.`, porque: resumo(c) }),
  );
  const documentos = [...new Set(relevantes.flatMap((c) => c.documentais))]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((c): Providencia => ({ tipo: "documento", codigo: c, texto: PROVIDENCIA_DOCUMENTO[c] ?? nome(c), porque: "Não é examinado automaticamente: depende de documento do município." }));

  const limites: Providencia[] = [];
  for (const l of simulacao?.limites ?? []) {
    if (l.estado === "nao_atendido") limites.push({ tipo: "limite", codigo: l.codigo, texto: PROVIDENCIA_LIMITE[l.codigo], porque: l.frase });
    else if (l.estado === "atencao") acompanhar.push({ tipo: "alerta", codigo: l.codigo, texto: `Acompanhar: ${l.nome}.`, porque: l.frase });
    else if (l.estado === "nao_verificavel") conferir.push({ tipo: "conferir", codigo: l.codigo, texto: `Conferir: ${l.nome}.`, porque: l.frase });
  }

  const contrapartida = projeto.total === null ? 0 : Math.max(0, projeto.total - projeto.repasse - projeto.credito);
  const contrapartidas: Providencia[] = [];
  let notaContrapartida: string | null = null;
  if (contrapartida > 0) {
    const cx = base.caixa;
    if (!cx) {
      conferir.push({ tipo: "conferir", codigo: null, texto: "Conferir o caixa não vinculado do fim do exercício.", porque: "O Anexo 05 do RGF do último período do exercício anterior não foi lido." });
    } else if (cx.valor < contrapartida) {
      contrapartidas.push({
        tipo: "contrapartida",
        codigo: null,
        texto: `Garantir no orçamento fonte própria para a contrapartida de ${moeda(contrapartida)}.`,
        porque:
          cx.valor < 0
            ? `O caixa não vinculado em 31/12/${cx.exercicio} era negativo (${moeda(cx.valor)}): não sobrou recurso livre do exercício.`
            : `A contrapartida supera o caixa não vinculado de 31/12/${cx.exercicio} (${moeda(cx.valor)}).`,
      });
    } else {
      notaContrapartida = `A contrapartida de ${moeda(contrapartida)} cabe no caixa não vinculado de 31/12/${cx.exercicio} (${moeda(cx.valor)}). O caixa é retrato do fim do exercício, não reserva: a contrapartida ainda precisa estar na LOA.`;
    }
  }

  const providencias = [...bloqueios, ...limites, ...contrapartidas, ...conferir, ...documentos];
  const estado: EstadoFiscal =
    bloqueios.length || limites.length ? "nao_atendido" : conferir.length ? "nao_verificavel" : acompanhar.length || contrapartidas.length ? "atencao" : "atendido";
  return { decisoes, contrapartida, estado, providencias, acompanhar, notaContrapartida };
}

export const PREMISSAS: readonly string[] = [
  "A operação é liberada em parcelas iguais, no meio de cada ano de liberação; os juros são pagos também na carência. Não entram taxas nem outros encargos.",
  "A RCL ajustada é a do último RGF lido e cresce, ano a ano, à taxa real informada.",
  "O serviço da dívida que o município já tem vem do cronograma do PVL de referência no SADIPEM (pedido dos últimos 5 anos, com a operação pedida enquanto o pedido está em curso). Sem PVL recente, é o empenhado em juros e amortização no último exercício (RREO), repetido em todos os anos.",
  "Operações no ano (16%): as liberações da operação simulada somadas às previstas no PVL de referência ou, no exercício do RGF, às já realizadas.",
  "Comprometimento com a dívida (11,5%): média dos anos com pagamento da operação simulada, como a STN apura no pedido; o pior ano aparece na tabela.",
  "Dívida consolidada líquida (120%): a do último RGF, somada às liberações e deduzida das amortizações da operação simulada. As outras operações não entram nessa conta.",
  "Operações por antecipação de receita (ARO) têm limite próprio e não entram.",
];
