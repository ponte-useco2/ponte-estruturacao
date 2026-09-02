/**
 * Carteira Territorial da Serra do Teixeira — modelo de domínio.
 *
 * Origem: `Radar-PARNA-Site-v3.dc.html` do handoff do Claude Design
 * (PARNA_WEB_SITE_OPORTUNIDADES). O protótipo não trazia as 76 oportunidades
 * escritas uma a uma: trazia 12 municípios, 7 programas e as regras que
 * combinam os dois. Este arquivo preserva essa escolha.
 *
 * POR QUE MANTER O MOTOR EM VEZ DE CONGELAR 76 REGISTROS: a carteira é um
 * produto cartesiano com duas exclusões e oito gates derivados. Congelada,
 * cada mudança de valor calibrado de um município viraria seis edições
 * manuais, e a primeira divergência entre elas passaria despercebida. Gerada,
 * um município novo é uma linha.
 *
 * Este módulo é puro e sem estado: roda igual no servidor e no cliente, o que
 * evita divergência de hidratação nos totais.
 */

// ============================ TIPOS ==============================

/** Prioridade territorial. Governa gates, plano de ação e leitura de prontidão. */
export type Prioridade = "alta" | "média" | "baixa";

/** Estado de maturação de uma oportunidade. Derivado dos gates, nunca digitado. */
export type EstadoProposta = "PRONTA EM BREVE" | "ESTRUTURAÇÃO" | "PREPARAÇÃO";

/** Situação de um gate individual. */
export type SituacaoGate = "ok" | "parcial" | "falta";

/** Tom dos selos. Espelha os `tone` do design system CTLC. */
export type Tom =
  | "neutral"
  | "brand"
  | "blue"
  | "violet"
  | "success"
  | "warning"
  | "danger";

export interface Municipio {
  id: string;
  nome: string;
  /** População, já formatada em pt-BR — vem do texto do protótipo, não de cálculo. */
  pop: string;
  /** Valor calibrado por proposta neste município, em reais. */
  valor: number;
  prio: Prioridade;
  /** Convênios celebrados pelo Ministério das Cidades, no formato "X de Y propostas". */
  mcid: string;
  /** Pendência registrada no TransfereGov. `null` quando a situação é regular. */
  pend: string | null;
  /** Nome do assentamento de reforma agrária, quando existe. Habilita o programa do INCRA. */
  assentamento: string | null;
  /** Bloqueia o PROMAQ: município com convênio de patrulha mecanizada rescindido. */
  semPromaq?: boolean;
}

export interface Programa {
  /** Código do programa no TransfereGov. */
  cod: string;
  /** Rótulo curto — concedente e trilha. */
  curto: string;
  janela: string;
  item: string;
  titulo: string;
  objeto: string;
  rota: string;
  evidencia: string;
  /** Teto fixo que ignora o valor calibrado do município (caso do PROMAQ). */
  valorFixo?: number;
  /** Só se aplica a município com assentamento. */
  soAssentamento?: boolean;
}

export interface Oportunidade {
  id: string;
  /** Id do município — chave de junção com {@link MUNICIPIOS}. */
  mid: string;
  municipio: string;
  programaCurto: string;
  cod: string;
  titulo: string;
  objeto: string;
  item: string;
  janela: string;
  rota: string;
  evidencia: string;
  /** Valor calibrado já formatado. */
  valor: string;
  valorNum: number;
  gatesOk: number;
  /** Índice de especificidade territorial, no formato "n/8". */
  especificidade: string;
  estado: EstadoProposta;
  gatesRaw: Record<string, SituacaoGate>;
}

// ============================ BASE ==============================

/**
 * Os doze municípios do entorno do PARNA da Serra do Teixeira.
 *
 * `valor` é valor CALIBRADO, não orçamento executivo: calibrado pela mediana
 * convertida do concedente no território. Vira valor validado só depois do
 * orçamento SINAPI — a distinção aparece na tela e não pode ser apagada aqui.
 */
export const MUNICIPIOS: Municipio[] = [
  { id: "teixeira", nome: "Teixeira", pop: "15.082", valor: 397000, prio: "alta", mcid: "15 de 21", pend: null, assentamento: "Poços de Baixo" },
  { id: "agua-branca", nome: "Água Branca", pop: "9.578", valor: 301000, prio: "alta", mcid: "14 de 17", pend: "Convênio rescindido em 2019 e prestação de contas rejeitada em 2009.", assentamento: null, semPromaq: true },
  { id: "imaculada", nome: "Imaculada", pop: "10.550", valor: 315000, prio: "alta", mcid: "17 de 25", pend: "Prestação de contas rejeitada em 2009.", assentamento: null },
  { id: "matureia", nome: "Maturéia", pop: "6.677", valor: 295000, prio: "alta", mcid: "12 de 19", pend: null, assentamento: "Cachoeira de Maturéia" },
  { id: "juru", nome: "Juru", pop: "9.410", valor: 390000, prio: "média", mcid: "8 de 18", pend: null, assentamento: null },
  { id: "catingueira", nome: "Catingueira", pop: "4.572", valor: 388000, prio: "alta", mcid: "10 de 17", pend: "Inadimplência registrada em 2009.", assentamento: "Padre Luciano" },
  { id: "santa-teresinha", nome: "Santa Teresinha", pop: "4.499", valor: 287000, prio: "média", mcid: "9 de 14", pend: null, assentamento: "Nego Fuba" },
  { id: "mae-dagua", nome: "Mãe d'Água", pop: "3.624", valor: 302000, prio: "média", mcid: "10 de 16", pend: null, assentamento: null },
  { id: "santana-garrotes", nome: "Santana dos Garrotes", pop: "6.657", valor: 370000, prio: "média", mcid: "7 de 13", pend: "Convênio rescindido em 2019 — patrulha mecanizada.", assentamento: null, semPromaq: true },
  { id: "olho-dagua", nome: "Olho d'Água", pop: "6.111", valor: 243000, prio: "baixa", mcid: "7 de 13", pend: "Prestação de contas rejeitada em 2009.", assentamento: "Grotão" },
  { id: "cacimba-areia", nome: "Cacimba de Areia", pop: "3.354", valor: 252000, prio: "baixa", mcid: "7 de 14", pend: "Convênio rescindido em 2017 — pavimentação.", assentamento: "Liberdade" },
  { id: "sao-jose-bonfim", nome: "São José do Bonfim", pop: "3.333", valor: 247000, prio: "baixa", mcid: "5 de 10", pend: null, assentamento: null },
];

/** Ids válidos de município — usados pela rota para validar `?municipio=`. */
export const IDS_MUNICIPIO = MUNICIPIOS.map((m) => m.id);

/** Os sete programas-base do Ciclo 1. */
export const PROGRAMAS: Programa[] = [
  {
    cod: "2200020260004",
    curto: "MAPA · Fomento (voluntária)",
    janela: "31/12/2026",
    item: "Obras e Serviços de Engenharia",
    titulo: "Unidade de beneficiamento da produção familiar",
    objeto: "Estruturação de unidade de beneficiamento da produção da agricultura familiar do entorno do PARNA da Serra do Teixeira.",
    rota: "Rotear para Comissão SF (90,7%) ou CD (92,5%)",
    evidencia: "A vocação de mel e polpa está declarada pelos municípios desde 2009. Nunca combinar itens.",
  },
  {
    cod: "2200020260018",
    curto: "MAPA · Obras de Fomento",
    janela: "31/12/2026",
    item: "Obras e Serviços de Engenharia",
    titulo: "Feira coberta do produtor",
    objeto: "Construção de feira coberta do produtor da agricultura familiar, entorno do PARNA da Serra do Teixeira.",
    rota: "Emenda de comissão do MAPA quando houver indicação",
    evidencia: "Catingueira converteu a construção da feira coberta por R$ 545 mil via CDR em 2025. Programa 100% obras.",
  },
  {
    cod: "2200020260022",
    curto: "MAPA · PROMAQ",
    janela: "31/12/2026",
    item: "Equipamentos",
    valorFixo: 249000,
    titulo: "Patrulha mecanizada para manejo conservacionista",
    objeto: "Aquisição de patrulha mecanizada para manejo conservacionista de áreas produtivas no entorno do PARNA.",
    rota: "Submeter apenas abaixo de R$ 250 mil",
    evidencia: "Catingueira converteu por R$ 229.990. Programa 100% equipamentos, item que converte 4,4%.",
  },
  {
    cod: "2220120260023",
    curto: "INCRA SR-PB",
    janela: "31/12/2026",
    item: "Obras e Serviços de Engenharia",
    soAssentamento: true,
    titulo: "Estradas vicinais em assentamento",
    objeto: "Melhoria de estradas vicinais em assentamento de reforma agrária no entorno do PARNA da Serra do Teixeira.",
    rota: "Aceita as duas trilhas e não tem nenhuma proposta apresentada",
    evidencia: "Nego Fuba converteu R$ 600 mil em 2017 e Poços de Baixo R$ 603 mil em 2021.",
  },
  {
    cod: "2220320260042",
    curto: "Codevasf · Esgotamento",
    janela: "31/12/2026",
    item: "Obras e Serviços de Engenharia",
    titulo: "Projeto executivo de esgotamento sanitário",
    objeto: "Elaboração de projeto executivo do Sistema de Esgotamento Sanitário da sede municipal, nascentes do entorno do PARNA.",
    rota: "Entrar por projeto, não por obra",
    evidencia: "A Paraíba tem 0 convênios Codevasf em 223 municípios; o Piauí tem 220 de 224. É o argumento da assimetria.",
  },
  {
    cod: "5300020260001",
    curto: "MIDR · 00SX voluntária",
    janela: "30/11/2026",
    item: "Obras e Serviços de Engenharia",
    titulo: "Estradas vicinais de acesso às comunidades rurais",
    objeto: "Recuperação e pavimentação de estradas vicinais de acesso às comunidades rurais do entorno do PARNA.",
    rota: "Rotear para CDR/Senado, ação 00SX, se houver indicação",
    evidencia: "Objeto-assinatura do programa. Obras isolado converte 13,5%; equipamentos 4,4%; item combinado 0,5%.",
  },
  {
    cod: "5300020260036",
    curto: "MIDR · 00SX 2ª janela",
    janela: "30/11/2026",
    item: "Obras e Serviços de Engenharia",
    titulo: "Infraestrutura de acesso e sinalização das rotas de visitação",
    objeto: "Implantação de infraestrutura de acesso e sinalização das rotas de visitação do entorno do PARNA.",
    rota: "Única das sete que aceita OSC — o CTLC/Ponte pode propor diretamente",
    evidencia: "Mesma ação 00SX. A CDR do Senado indica emendas RP8 exatamente nesta ação.",
  },
];

/** Os oito gates, na ordem em que a tela os apresenta. */
export const GATES = [
  "Elegibilidade",
  "Item único",
  "Ticket calibrado",
  "Capacidade técnica",
  "Demanda validada",
  "Local/terreno",
  "Orçamento SINAPI",
  "Rota parlamentar",
] as const;

/** Código do PROMAQ — citado nas regras de exclusão e do gate de local/terreno. */
const COD_PROMAQ = "2200020260022";
/** Código do projeto executivo da Codevasf — não precisa de terreno, é projeto. */
const COD_CODEVASF = "2220320260042";
/** Prefixo das duas janelas do MIDR na ação 00SX, as únicas com rota parlamentar aberta. */
const PREFIXO_MIDR = "53000";

// ============================ FORMATAÇÃO ==============================

/**
 * Real brasileiro sem casas decimais.
 *
 * Implementado à mão em vez de `toLocaleString("pt-BR")` de propósito: o
 * separador de milhar do Intl depende do ICU disponível no runtime, e servidor
 * e navegador podem discordar. Uma discordância aqui vira erro de hidratação
 * numa tela em que o número é o conteúdo.
 */
export function brl(n: number): string {
  const s = Math.round(Math.abs(n)).toString();
  let saida = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) saida += ".";
    saida += s[i];
  }
  return "R$ " + (n < 0 ? "-" : "") + saida;
}

// ============================ MOTOR ==============================

/**
 * Monta a carteira: produto cartesiano de municípios por programas, menos as
 * duas exclusões, com os oito gates derivados de cada par.
 *
 * As exclusões:
 *  1. O programa do INCRA só existe onde há assentamento de reforma agrária.
 *  2. O PROMAQ não é submetido onde a patrulha mecanizada já foi rescindida.
 *
 * 12 × 7 = 84, menos 6 sem assentamento, menos 2 sem PROMAQ = 76.
 */
function montarCarteira(): Oportunidade[] {
  const saida: Oportunidade[] = [];

  for (const m of MUNICIPIOS) {
    for (const pr of PROGRAMAS) {
      if (pr.soAssentamento && !m.assentamento) continue;
      if (pr.cod === COD_PROMAQ && m.semPromaq) continue;

      const valor = pr.valorFixo ?? m.valor;

      // O objeto do protótipo termina em ponto; o município entra antes dele.
      const objeto = pr.objeto.replace(".", ", no Município de " + m.nome + "/PB.");

      const gatesRaw: Record<string, SituacaoGate> = {
        Elegibilidade: "ok",
        "Item único": "ok",
        "Ticket calibrado": "ok",
        // Pendência no TransfereGov não impede cadastrar, impede celebrar.
        "Capacidade técnica": m.pend ? "parcial" : "ok",
        "Demanda validada": m.prio === "alta" ? "ok" : "parcial",
        // Equipamento não precisa de terreno; projeto executivo, tampouco.
        "Local/terreno": pr.cod === COD_PROMAQ || pr.cod === COD_CODEVASF ? "ok" : "parcial",
        // Nenhuma das 76 tem orçamento ainda. É o gargalo declarado da operação.
        "Orçamento SINAPI": "falta",
        "Rota parlamentar":
          pr.cod.startsWith(PREFIXO_MIDR) && m.prio === "alta" ? "parcial" : "falta",
      };

      const feitos = GATES.filter((k) => gatesRaw[k] === "ok").length;

      saida.push({
        id: m.id + "-" + pr.cod,
        mid: m.id,
        municipio: m.nome,
        programaCurto: pr.curto,
        cod: pr.cod,
        titulo: pr.titulo + (pr.soAssentamento ? " — " + m.assentamento : ""),
        objeto,
        item: pr.item,
        janela: pr.janela,
        rota: pr.rota,
        evidencia: pr.evidencia,
        valor: brl(valor),
        valorNum: valor,
        gatesOk: feitos,
        // Objeto em assentamento é o mais específico que o território produz:
        // trecho nomeado, comunidade nomeada, PARNA no entorno.
        especificidade: pr.soAssentamento ? "8/8" : m.prio === "alta" ? "7/8" : "6/8",
        estado: feitos >= 6 ? "PRONTA EM BREVE" : feitos >= 5 ? "ESTRUTURAÇÃO" : "PREPARAÇÃO",
        gatesRaw,
      });
    }
  }

  return saida;
}

export const CARTEIRA: Oportunidade[] = montarCarteira();

export const TOTAL_CALIBRADO = CARTEIRA.reduce((s, p) => s + p.valorNum, 0);

/** "R$ 23,287 mi" — três casas, porque o milhar importa numa carteira desse porte. */
export const TOTAL_TXT =
  "R$ " + (TOTAL_CALIBRADO / 1000000).toFixed(3).replace(".", ",") + " mi";

// ============================ PLANO DE AÇÃO ==============================

/**
 * O plano por prioridade. O bloco "Não fazer" é tão parte do plano quanto os
 * outros dois: as duas maiores perdas do território são combinar itens numa
 * mesma proposta (converte 0,5%) e submeter sem capacidade de acompanhar.
 */
export const PLANO: Record<Prioridade, Array<{ bloco: string; itens: string[] }>> = {
  alta: [
    { bloco: "Agora", itens: ["Confirmar indicação de emenda de comissão para os objetos de maior ticket.", "Contratar orçamento SINAPI das duas propostas de obras prioritárias.", "Validar demanda territorial com as comunidades do entorno."] },
    { bloco: "Em seguida", itens: ["Fechar terreno e titularidade dos equipamentos de comercialização.", "Preparar a proposta da 2ª janela do MIDR, que aceita OSC."] },
    { bloco: "Não fazer", itens: ["Não combinar itens na mesma proposta: converte 0,5%.", "Não pedir acima de R$ 500 mil sem emenda vinculada."] },
  ],
  média: [
    { bloco: "Agora", itens: ["Abrir a conversa de indicação com a CDR, onde a Paraíba tem assento.", "Validar demanda territorial e definir trecho ou comunidade de cada objeto."] },
    { bloco: "Em seguida", itens: ["Orçamento SINAPI das propostas que passarem no gate de demanda.", "Documentação de capacidade técnica — campo discriminante na base."] },
    { bloco: "Não fazer", itens: ["Não replicar o texto padrão: nomear município, comunidade, trecho e etapa.", "Não submeter sem responsável designado para diligência."] },
  ],
  baixa: [
    { bloco: "Agora", itens: ["Regularizar a situação no TransfereGov: bloqueia a celebração, não o cadastro.", "Escolher uma única proposta-piloto e levá-la até o fim."] },
    { bloco: "Em seguida", itens: ["Construir acesso parlamentar via comissão.", "Orçamento e capacidade técnica da proposta-piloto."] },
    { bloco: "Não fazer", itens: ["Não submeter as sete de uma vez sem capacidade de acompanhar.", "Não repetir objeto genérico sem trecho identificado."] },
  ],
};

// ============================ CONTEÚDO DAS SUPERFÍCIES ==============================
//
// Daqui para baixo é conteúdo redigido, não derivado: números apurados na base
// de 3.164 propostas históricas do território. Mora em constante — e não no
// componente — para que a revisão do texto não passe por dentro do JSX.

/** Cockpit · as três frentes que precisam correr em paralelo. */
export const FRENTES = [
  { nome: "Mobilização", n: "76", cor: "var(--ct-violet-500)", itens: ["Indicação de emenda e comissão", "Rota parlamentar por objeto", "Prazos de indicação da CDR"] },
  { nome: "Estruturação", n: "76", cor: "var(--ct-blue-400)", itens: ["Orçamento SINAPI", "Capacidade técnica documentada", "Demanda territorial validada"] },
  { nome: "Execução", n: "38", cor: "var(--ct-green-500)", itens: ["Diligências e complementações", "SLA de 15 dias", "Escalonamento de atraso"] },
];

/** Cockpit · concedente importa mais que programa. Taxas medidas no território. */
export const CONCEDENTES: Array<{
  nome: string; props: number; conv: number; mediana: string;
  semEmenda: string; comEmenda: string; corSem: string; tone: Tom; rec: string;
}> = [
  { nome: "Ministério das Cidades", props: 197, conv: 121, mediana: "R$ 384.705", semEmenda: "46,8%", comEmenda: "86,3%", corSem: "var(--ct-green-500)", tone: "success", rec: "Melhor rota discricionária" },
  { nome: "MAPA", props: 555, conv: 60, mediana: "R$ 239.750", semEmenda: "6,1%", comEmenda: "90,3%", corSem: "var(--ct-red-500)", tone: "violet", rec: "Só por emenda" },
  { nome: "MIDR", props: 383, conv: 26, mediana: "R$ 487.000", semEmenda: "3,3%", comEmenda: "100%", corSem: "var(--ct-red-500)", tone: "violet", rec: "Só por emenda" },
  { nome: "MDA / INCRA SR-PB", props: 53, conv: 0, mediana: "—", semEmenda: "0%", comEmenda: "—", corSem: "var(--ct-text-muted)", tone: "warning", rec: "Porta nunca aberta" },
  { nome: "Codevasf", props: 0, conv: 0, mediana: "—", semEmenda: "—", comEmenda: "—", corSem: "var(--ct-text-muted)", tone: "violet", rec: "White space" },
];

/** Articulação · a migração da captação individual para a emenda de comissão. */
export const SERIE_COMISSAO = [
  { ano: "2023", v: "9/9", l: "propostas de comissão convertidas" },
  { ano: "2024", v: "6/7", l: "propostas de comissão convertidas" },
  { ano: "2025", v: "17/17", l: "propostas de comissão convertidas" },
  { ano: "2026", v: "11/16", l: "até a base analisada" },
];

/** Articulação · a peça de reunião da CDR, em números. */
export const CDR = [
  { v: "12", l: "municípios" },
  { v: "8", l: "objetos prontos para indicação" },
  { v: "R$ 3,1 mi", l: "solicitados" },
  { v: "00SX", l: "ação orçamentária" },
  { v: "6", l: "já beneficiados historicamente" },
  { v: "2", l: "prioritários sem cobertura recente" },
];

/** Articulação · mapa objeto → ação → comissão → município. */
export const INDICACOES: Array<{
  objeto: string; acao: string; comissao: string;
  municipios: string; valor: string; tone: Tom; status: string;
}> = [
  { objeto: "Estradas vicinais de acesso às comunidades rurais", acao: "00SX", comissao: "CDR / Senado", municipios: "12 municípios", valor: "R$ 3,7 mi", tone: "warning", status: "Aguarda calendário" },
  { objeto: "Infraestrutura de visitação do entorno", acao: "00SX", comissao: "CDR / Senado", municipios: "12 municípios", valor: "R$ 3,7 mi", tone: "warning", status: "Aguarda calendário" },
  { objeto: "Feira coberta do produtor", acao: "114420ZV", comissao: "Comissão CD do MAPA", municipios: "12 municípios", valor: "R$ 3,7 mi", tone: "blue", status: "A abrir conversa" },
  { objeto: "Unidade de beneficiamento da produção familiar", acao: "114420ZV", comissao: "Comissão SF do MAPA", municipios: "12 municípios", valor: "R$ 3,7 mi", tone: "blue", status: "A abrir conversa" },
  { objeto: "Estradas vicinais em assentamento", acao: "211A5136", comissao: "INCRA SR-PB, ambas as trilhas", municipios: "6 municípios", valor: "R$ 1,8 mi", tone: "neutral", status: "Confirmar com a SR-PB" },
];

/** Articulação · quem efetivamente converte no território. */
export const PARLAMENTARES: Array<{
  nome: string; tipo: string; mun: number; props: number; conv: number;
  valor: string; periodo: string; tone: Tom; estado: string;
}> = [
  { nome: "Com. Desenvolvimento Regional e Turismo", tipo: "Comissão", mun: 9, props: 24, conv: 20, valor: "R$ 13,9 mi", periodo: "2023–2026", tone: "success", estado: "Rota principal" },
  { nome: "Com. Turismo", tipo: "Comissão", mun: 8, props: 11, conv: 9, valor: "R$ 6,2 mi", periodo: "2024–2026", tone: "success", estado: "Rota ativa" },
  { nome: "Com. Desenvolvimento Urbano", tipo: "Comissão", mun: 4, props: 10, conv: 7, valor: "R$ 4,1 mi", periodo: "2012–2026", tone: "success", estado: "Rota ativa" },
  { nome: "Wellington Roberto", tipo: "Individual", mun: 5, props: 15, conv: 13, valor: "R$ 3,3 mi", periodo: "2013–2026", tone: "blue", estado: "Ativo em 2026" },
  { nome: "Com. Esporte", tipo: "Comissão", mun: 4, props: 4, conv: 4, valor: "R$ 2,7 mi", periodo: "2025–2026", tone: "blue", estado: "Ativo em 2026" },
  { nome: "Hugo Motta", tipo: "Individual", mun: 12, props: 38, conv: 33, valor: "R$ 13,8 mi", periodo: "2012–2019", tone: "neutral", estado: "Sem convênio desde 2019" },
];

/** Diligências · o tamanho do abandono histórico. */
export const DILIG_KPIS = [
  { v: "38", l: "propostas paradas em complementação desde 2024", cor: "var(--ct-amber-500)" },
  { v: "225", l: "propostas históricas abandonadas ainda em rascunho", cor: "var(--ct-red-500)" },
  { v: "16 × 5", l: "etapas de tramitação: mediana das convertidas contra as não convertidas", cor: "var(--ct-text-primary)" },
];

/** Diligências · a fila aberta. `dias` é o que resta do SLA de 15 dias. */
export const DILIGENCIAS: Array<{
  dias: string; t: string; doc: string; resp: string;
  tone: Tom; solido: boolean; estado: string; cor: string; borda: string;
}> = [
  { dias: "11", t: "Complementação recebida — Catingueira, pavimentação 5600020260023", doc: "planilha orçamentária revisada", resp: "Secretaria de Obras", tone: "warning", solido: true, estado: "Dentro do SLA", cor: "var(--ct-amber-500)", borda: "rgba(224,162,60,.4)" },
  { dias: "3", t: "Plano de trabalho em complementação — Santana dos Garrotes, 2200020260014", doc: "declaração de capacidade técnica", resp: "Secretaria de Agricultura", tone: "danger", solido: true, estado: "Prazo crítico", cor: "var(--ct-red-500)", borda: "rgba(226,86,75,.4)" },
  { dias: "9", t: "Proposta em análise — Água Branca, reforma do mercado agrícola 56107", doc: "comprovação de titularidade do terreno", resp: "Procuradoria", tone: "warning", solido: false, estado: "Dentro do SLA", cor: "var(--ct-amber-500)", borda: "var(--ct-border-subtle)" },
  { dias: "—", t: "38 propostas históricas sem responsável designado", doc: "triagem inicial", resp: "a designar", tone: "neutral", solido: false, estado: "Não iniciado", cor: "var(--ct-text-muted)", borda: "var(--ct-border-subtle)" },
];

/** Inteligência · anatomia do white space da Codevasf. */
export const WHITESPACE = [
  { k: "Histórico local", v: "Inexistente", cor: "var(--ct-text-muted)" },
  { k: "Dotação e porta", v: "Existentes", cor: "var(--ct-green-500)" },
  { k: "Concorrência observada", v: "Nenhuma", cor: "var(--ct-green-500)" },
  { k: "Risco", v: "Primeira entrada", cor: "var(--ct-amber-500)" },
  { k: "Potencial estratégico", v: "Alto", cor: "var(--ct-violet-500)" },
];

/** Inteligência · a assimetria federativa da Codevasf, por UF. */
export const CODEVASF_UF = [
  { uf: "PI", barW: "98%", mun: "220 de 224", valor: "R$ 687,6 mi", cor: "var(--ct-green-500)", borda: "var(--ct-border-subtle)" },
  { uf: "MA", barW: "92%", mun: "189 de 217", valor: "R$ 803,6 mi", cor: "var(--ct-green-500)", borda: "var(--ct-border-subtle)" },
  { uf: "BA", barW: "76%", mun: "167 de 219", valor: "R$ 426,2 mi", cor: "var(--ct-green-500)", borda: "var(--ct-border-subtle)" },
  { uf: "AL", barW: "85%", mun: "61 de 72", valor: "R$ 245,1 mi", cor: "var(--ct-green-500)", borda: "var(--ct-border-subtle)" },
  { uf: "PE", barW: "65%", mun: "41 de 63", valor: "R$ 169,2 mi", cor: "var(--ct-blue-400)", borda: "var(--ct-border-subtle)" },
  { uf: "PB", barW: "2%", mun: "0 de 223", valor: "R$ 0", cor: "var(--ct-red-500)", borda: "rgba(226,86,75,.4)" },
];

/** Inteligência · o que separa a proposta que converte da que não converte. */
export const ANATOMIA = [
  { k: "Metas por proposta", emenda: "1", voluntaria: "1", leitura: "99% têm meta única" },
  { k: "Prazo declarado", emenda: "1.096 dias", voluntaria: "1.402 dias", leitura: "a voluntária pede quatro anos; a emenda, três" },
  { k: "Itens no plano de aplicação", emenda: "1", voluntaria: "1", leitura: "98 de 105 têm item único" },
  { k: "Tipo de despesa dominante", emenda: "Obra / serviço", voluntaria: "Obra / serviço", leitura: "natureza Outras Obras e Instalações" },
  { k: "Contrapartida mediana", emenda: "0,11%", voluntaria: "0,10%", leitura: "não é diferenciador" },
  { k: "Capacidade técnica preenchida", emenda: "99% × 84%", voluntaria: "100% × 71%", leitura: "campo discriminante entre converter e não" },
  { k: "Relação com objetivos do programa", emenda: "312 caracteres", voluntaria: "304 × 138", leitura: "a convertida escreve o dobro" },
  { k: "Etapas de tramitação", emenda: "16 × 5", voluntaria: "8 × 3", leitura: "converter exige acompanhamento" },
];

/** Inteligência · rotas que ainda precisam virar objeto concreto. */
export const PROSPECCAO = [
  { prioridade: "Prioridade alta", t: "Ministério das Cidades", d: "Melhor rota discricionária do território, com 46,8% sem emenda e 121 convênios celebrados. Não está entre os sete programas do Ciclo 1 e precisa virar objetos concretos." },
  { prioridade: "Prioridade alta", t: "Codevasf — emendas exclusivas da Paraíba", d: "Dois programas de emenda exclusivos da PB na ação 00SX.0025, abertos até 31/12/2026 e com zero propostas apresentadas." },
  { prioridade: "Prioridade média", t: "Rotas de Integração e Bioeconomia", d: "Ação 214S do MIDR, também sem propostas do território. Aderente à tese produtiva do entorno." },
];

/** Inteligência · a cadeia causal que liga o parque ao objeto de investimento. */
export const CADEIA = [
  "Unidade de conservação recente",
  "Mudança territorial",
  "Acessibilidade, cadeia produtiva, visitação, água",
  "Objeto de investimento",
];

/**
 * Inteligência · a tese, com selo de evidência.
 *
 * Os selos não são decorativos: separam o que está em fonte primária do que
 * ainda é referência recorrente. "Setenta nascentes" e a relação de
 * assentamentos não podem entrar em peça oficial antes de confirmados.
 */
export const TESE: Array<{ selo: string; tone: Tom; t: string; d: string }> = [
  { selo: "Confirmado", tone: "success", t: "61.095 hectares de Caatinga sobre doze municípios", d: "Decreto 11.552, de 05/06/2023. Primeiro parque nacional da Paraíba." },
  { selo: "Confirmado", tone: "success", t: "Plano de manejo vence em 05/06/2028", d: "Prazo do SNUC, artigo 27. A zona de amortecimento ainda não foi definida." },
  { selo: "Confirmado", tone: "success", t: "A Paraíba tem assento na CDR", d: "Efraim Filho é titular. A ata de 09/12/2025 registra Catingueira com R$ 570 mil de emenda RP8 na ação 00SX." },
  { selo: "Em validação", tone: "warning", t: "Setenta nascentes na serra", d: "Referência recorrente; falta confirmação em fonte primária antes de uso em peça oficial." },
  { selo: "Em validação", tone: "warning", t: "Assentamentos em seis municípios", d: "Os seis objetos do INCRA dependem de confirmação da relação de assentamentos com a SR-PB." },
  { selo: "Hipótese estratégica", tone: "violet", t: "Mosaico com o Parque Estadual Pico do Jabre", d: "Depende de checagem geoespacial de sobreposição. É o veículo institucional mais adequado para a estratégia territorial." },
];

// ============================ DERIVAÇÕES DE APRESENTAÇÃO ==============================

/** Tom do selo de estado. Verde só quando os seis gates possíveis estão fechados. */
export function tomDoEstado(e: EstadoProposta): Tom {
  return e === "PRONTA EM BREVE" ? "success" : e === "ESTRUTURAÇÃO" ? "warning" : "neutral";
}

/** Cor do contador de gates, na mesma escala do selo de estado. */
export function corDosGates(n: number): string {
  return n >= 6 ? "var(--ct-green-500)" : n >= 5 ? "var(--ct-amber-500)" : "var(--ct-text-muted)";
}

/** Paleta dos chips de gate, por situação. */
export const CORES_GATE: Record<SituacaoGate, { bg: string; cor: string; borda: string }> = {
  ok: { bg: "rgba(63,191,143,.14)", cor: "var(--ct-green-500)", borda: "rgba(63,191,143,.45)" },
  parcial: { bg: "rgba(224,162,60,.14)", cor: "var(--ct-amber-500)", borda: "rgba(224,162,60,.45)" },
  falta: { bg: "rgba(226,86,75,.10)", cor: "var(--ct-red-500)", borda: "rgba(226,86,75,.35)" },
};

/** Filtros da Carteira, na ordem da tela. */
export const FILTROS = ["Todas", "Preparação", "Estruturação", "Fecha em 30/11", "Equipamentos"] as const;
export type Filtro = (typeof FILTROS)[number];

/** Aplica o filtro selecionado sobre a carteira inteira. */
export function filtrarCarteira(filtro: Filtro): Oportunidade[] {
  return CARTEIRA.filter((p) => {
    if (filtro === "Todas") return true;
    if (filtro === "Fecha em 30/11") return p.janela === "30/11/2026";
    if (filtro === "Equipamentos") return p.item === "Equipamentos";
    return p.estado === filtro.toUpperCase();
  });
}

/** Municípios em ordem alfabética pt-BR, com contagem e soma da própria carteira. */
export function municipiosOrdenados() {
  return MUNICIPIOS.slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
    .map((m) => {
      const props = CARTEIRA.filter((p) => p.mid === m.id);
      return {
        id: m.id,
        nome: m.nome,
        nProp: props.length,
        valor: brl(props.reduce((s, p) => s + p.valorNum, 0)),
      };
    });
}

/**
 * A ficha de um município: hero, leitura multidimensional, propostas e plano.
 *
 * `mostrarPendencias` existe porque a mesma ficha é projetada em reunião com o
 * prefeito. A pendência é real e precisa ser tratada, mas quem decide se ela
 * entra na tela naquela sala é quem conduz a reunião — não o componente.
 */
export function fichaMunicipal(id: string, mostrarPendencias = true) {
  const base = MUNICIPIOS.find((m) => m.id === id) ?? MUNICIPIOS[0];
  const props = CARTEIRA.filter((p) => p.mid === base.id);
  const soma = props.reduce((s, p) => s + p.valorNum, 0);
  const alta = base.prio === "alta";
  const temPend = mostrarPendencias && Boolean(base.pend);

  return {
    id: base.id,
    nome: base.nome,
    pend: base.pend,
    frase: `${base.nome} tem ${props.length} oportunidades estruturadas, somando ${brl(soma)}.`,
    decisao: alta
      ? "Confirmar indicação de emenda de comissão"
      : base.prio === "média"
        ? "Validar demanda e abrir conversa com a CDR"
        : "Regularizar situação e escolher a proposta-piloto",
    heroStats: [
      { v: base.pop, l: "habitantes" },
      { v: String(props.length), l: "oportunidades estruturadas" },
      { v: base.mcid, l: "convênios pelo Ministério das Cidades" },
    ],
    dimensoes: [
      { k: "Prontidão municipal", v: alta ? "Alta" : base.prio === "média" ? "Média" : "Em recomposição", cor: alta ? "var(--ct-green-500)" : base.prio === "média" ? "var(--ct-amber-500)" : "var(--ct-text-secondary)" },
      { k: "Rota discricionária", v: "Baixa fora do MinCidades", cor: "var(--ct-amber-500)" },
      { k: "Rota por emenda de comissão", v: "Muito alta", cor: "var(--ct-green-500)" },
      { k: "Necessidade local", v: alta ? "Confirmada" : "A validar", cor: alta ? "var(--ct-green-500)" : "var(--ct-amber-500)" },
      { k: "Orçamento", v: "Pendente de SINAPI", cor: "var(--ct-red-500)" },
      { k: "Situação no TransfereGov", v: temPend ? "Pendência a regularizar" : "Regular", cor: temPend ? "var(--ct-amber-500)" : "var(--ct-green-500)" },
    ],
    tituloProp: `${props.length} oportunidades estruturadas`,
    propostas: props.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      evidencia: p.evidencia,
      valor: p.valor,
      programaCurto: p.programaCurto,
      estado: p.estado,
      estadoTone: tomDoEstado(p.estado),
      gatesTxt: `${p.gatesOk}/8 gates`,
      gatesCor: corDosGates(p.gatesOk),
    })),
    planoTitulo: `Plano de ação de ${base.nome}`,
    plano: PLANO[base.prio].map((b) => ({
      bloco: b.bloco,
      itens: b.itens,
      cor: b.bloco === "Agora" ? "var(--ct-green-500)" : b.bloco === "Em seguida" ? "var(--ct-amber-500)" : "var(--ct-text-muted)",
      borda: b.bloco === "Agora" ? "rgba(63,191,143,.4)" : b.bloco === "Em seguida" ? "rgba(224,162,60,.4)" : "var(--ct-border-subtle)",
    })),
  };
}

export type FichaMunicipal = ReturnType<typeof fichaMunicipal>;
