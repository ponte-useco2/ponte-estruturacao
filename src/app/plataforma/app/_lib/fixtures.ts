/**
 * Dados ilustrativos do protótipo.
 *
 * Regra: nada aqui vem de banco. É a mesma "simulação demonstrativa" declarada
 * na página pública /plataforma — PJF-0027, CP-014 e CP-015 são cópia fiel do
 * objeto `demoProject` de public/plataforma.html, para que o visitante não veja
 * duas versões do mesmo projeto.
 *
 * O único dado real do app é `/dados/oportunidades.json` (ambiente Descobrir).
 */

import type {
  ArestaGrafo,
  Chamada,
  NoGrafo,
  Perfil,
  PerfilId,
  Projeto,
  TipoNo,
} from "./tipos";

export const PERFIS: Perfil[] = [
  {
    id: "empresa",
    numero: "01",
    nome: "Empresa / Indústria",
    curto: "Empresa / Indústria",
    resumo: "Desafio tecnológico, P&D, mercado",
  },
  {
    id: "especialista",
    numero: "02",
    nome: "Especialista / Fornecedor",
    curto: "Especialista",
    resumo: "Capacidade técnica, entregas",
  },
  {
    id: "osc",
    numero: "03",
    nome: "OSC / Associação / Cooperativa",
    curto: "OSC / Associação",
    resumo: "Legitimidade e execução local",
  },
  {
    id: "territorio",
    numero: "04",
    nome: "Território / Poder Público",
    curto: "Território",
    resumo: "Problema público, ativos, permissões",
  },
  {
    id: "ict",
    numero: "05",
    nome: "ICT / Entidade Setorial",
    curto: "ICT / Entidade",
    resumo: "Pesquisa, laboratório, validação",
  },
  {
    id: "capital",
    numero: "06",
    nome: "Capital / Financiador",
    curto: "Capital",
    resumo: "Tese, elegibilidade, risco",
  },
  {
    id: "ponte",
    numero: "07",
    nome: "Equipe PONTE — backoffice / PMO",
    curto: "Equipe PONTE",
    resumo: "Acesso interno: curadoria de PJF, chamadas, grafo",
    porConvite: true,
  },
];

export function perfilPor(id: PerfilId | undefined): Perfil {
  return PERFIS.find((p) => p.id === id) ?? PERFIS[0];
}

/**
 * Ponte entre o formulário de lead da página pública e os 7 atores do
 * onboarding. O `<select>` de public/plataforma.html não tem `value`, então a
 * chave é o próprio rótulo — se aquele select mudar, esta tabela muda junto.
 */
const PERFIL_POR_ROTULO_PUBLICO: Record<string, PerfilId> = {
  "Empresa / Indústria": "empresa",
  "Especialista / Fornecedor": "especialista",
  "OSC / Associação / Cooperativa": "osc",
  "Gestão Pública / Território": "territorio",
  "Pesquisador / ICT": "ict",
  "Federação / Sindicato Patronal / Entidade Setorial": "ict",
  "Capital / Financiador": "capital",
};

export function perfilDoRotuloPublico(rotulo: string | null | undefined): PerfilId | null {
  if (!rotulo) return null;
  const direto = PERFIL_POR_ROTULO_PUBLICO[rotulo];
  if (direto) return direto;
  // Também aceita o id cru, caso o link já venha do próprio app.
  return PERFIS.some((p) => p.id === rotulo && !p.porConvite) ? (rotulo as PerfilId) : null;
}

/** Mesma lista de interesses do formulário de lead da página pública. */
export const INTERESSES = [
  "Acompanhar oportunidades e editais",
  "Implementar Núcleo de P&D",
  "Compor Projeto em Formação",
  "Apresentar problema territorial",
  "Conectar ICT ou capacidade científica",
  "Estruturar carteira setorial",
  "Conhecer projetos para financiamento",
];

// ------------------------------------------------------------------ projetos

export const PROJETOS: Projeto[] = [
  {
    id: "PJF-0027",
    status: "Em composição",
    statusCurto: "EM COMPOSIÇÃO",
    titulo: "Recuperação Hídrica, Drenagem e Gestão Integrada de Resíduos",
    territorio: "Vale do Mamanguape / PB",
    eixos: ["ambiental", "economico", "social"],
    progresso: 60,
    problema:
      "Descarte inadequado de resíduos em bacia hidrográfica e déficit de drenagem pluvial urbana.",
    solucao:
      "Sistema integrado de recuperação de mata ciliar, drenagem sustentável e valorização de recicláveis.",
    organizacoes:
      "Associação territorial e cooperativa local com papéis definidos na composição do projeto.",
    capital:
      "Instrumentos sob análise de aderência, incluindo linhas de saneamento ambiental e fundos climáticos.",
    ativos:
      "Infraestrutura comunitária, áreas disponíveis, bases territoriais e outros recursos físicos passíveis de mobilização.",
    funcoes: [
      { nome: "Proponente", ator: "Associação", confirmada: true },
      { nome: "Operação Territorial", ator: "Cooperativa local", confirmada: true },
      { nome: "Estruturação / PMO", ator: "PONTE Projetos", confirmada: true },
      { nome: "Engenharia Hídrica", chamada: "CP-014", confirmada: false },
      { nome: "Geoprocessamento", chamada: "CP-015", confirmada: false },
    ],
    cicloAte: 1,
    temas: ["agua", "residuos", "clima", "saneamento", "meio ambiente"],
    emExecucao: true,
    entregas: [
      {
        codigo: "E-01",
        titulo: "Mapeamento da bacia e diagnóstico espacial",
        responsavel: "Cooperativa local",
        estado: "aprovada",
        detalhe: "Evidência aprovada em 12/06",
        evidencias: 5,
      },
      {
        codigo: "E-02",
        titulo: "Memorial descritivo de microdrenagem",
        responsavel: "Engenharia (CP-014)",
        estado: "pendente",
        detalhe: "Evidência pendente",
        vence: "30/08",
      },
      {
        codigo: "E-03",
        titulo: "Mobilização comunitária — 3 oficinas",
        responsavel: "Associação",
        estado: "andamento",
        detalhe: "1 de 3 oficinas realizadas",
        progresso: 33,
      },
    ],
    decisoes: [
      { data: "14/08", texto: "CP-014 composta" },
      { data: "02/08", texto: "Capital acoplado" },
      { data: "21/07", texto: "Orçamento aprovado" },
      { data: "05/07", texto: "Coalizão inicial confirmada — 3/5 funções" },
      { data: "18/06", texto: "Problema demonstrado com laudo e base territorial" },
    ],
  },
  {
    id: "PJF-0041",
    status: "Diagnóstico",
    statusCurto: "DIAGNÓSTICO",
    titulo: "Núcleo de P&D — automação de linha de envase",
    territorio: "João Pessoa / PB",
    eixos: ["economico"],
    progresso: 20,
    problema:
      "Perda de produtividade e retrabalho na linha de envase, sem estrutura interna de P&D para tratar o gargalo.",
    solucao:
      "Núcleo de P&D sob demanda com plano de pesquisa aplicada, parceria com ICT e enquadramento em instrumentos de inovação.",
    organizacoes: "Empresa proponente. Coalizão ainda não composta.",
    capital: "Subvenção econômica e incentivos fiscais de inovação sob análise de elegibilidade.",
    ativos: "Linha de produção existente, dados de processo e equipe técnica interna.",
    funcoes: [
      { nome: "Proponente", ator: "Empresa", confirmada: true },
      { nome: "Estruturação / PMO", ator: "PONTE Projetos", confirmada: true },
      { nome: "Pesquisa aplicada", chamada: "CP-021", confirmada: false },
      { nome: "Automação industrial", chamada: "CP-022", confirmada: false },
      { nome: "Gestão de incentivos", chamada: "CP-023", confirmada: false },
    ],
    cicloAte: 0,
    temas: ["inovacao", "industria", "tecnologia"],
    emExecucao: false,
    entregas: [
      {
        codigo: "E-01",
        titulo: "Diagnóstico técnico do gargalo de envase",
        responsavel: "PONTE Projetos",
        estado: "andamento",
        detalhe: "Coleta de dados de processo em curso",
        progresso: 40,
      },
    ],
    decisoes: [{ data: "11/08", texto: "Problema apresentado e aceito para diagnóstico" }],
  },
];

export function projetoPor(id: string): Projeto | undefined {
  return PROJETOS.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

// ------------------------------------------------------------------ chamadas

export const CHAMADAS: Chamada[] = [
  {
    codigo: "CP-014",
    projetoId: "PJF-0027",
    titulo: "Engenharia de Drenagem e Soluções Baseadas na Natureza",
    papel: "Dimensionamento hidráulico e projetos executivos de microdrenagem sustentável.",
    entregas: "Memorial descritivo, responsabilidade técnica aplicável e plano de intervenção.",
    experiencia: "Atuação comprovada em hidrologia, drenagem ou engenharia sanitária.",
    participacao: "Prestação de serviços técnicos integrada à composição orçamentária do projeto.",
    aderencia: 78,
    cobre: ["SIG", "Hidrologia", "2 projetos similares"],
  },
  {
    codigo: "CP-015",
    projetoId: "PJF-0027",
    titulo: "Geoprocessamento e Mapeamento Territorial",
    papel:
      "Mapeamento de bacia, delimitação territorial, diagnóstico espacial e apoio cartográfico.",
    entregas: "Mapas temáticos, base georreferenciada e produtos cartográficos.",
    experiencia: "Domínio de SIG, geoprocessamento e análise territorial ou ambiental.",
    participacao: "Prestação de serviços técnicos integrada à composição orçamentária do projeto.",
    aderencia: 64,
    cobre: ["SIG", "Análise territorial"],
  },
  {
    codigo: "CP-021",
    projetoId: "PJF-0041",
    titulo: "Pesquisa Aplicada em Processos de Envase",
    papel: "Desenho do plano de pesquisa aplicada e definição de hipóteses de ganho de processo.",
    entregas: "Plano de pesquisa, protocolo experimental e relatório de linha de base.",
    experiencia: "Pesquisa aplicada em engenharia de produção, processos ou alimentos.",
    participacao: "Vínculo com ICT ou prestação técnica integrada ao Núcleo de P&D.",
    aderencia: 41,
    cobre: ["Engenharia de processos"],
  },
  {
    codigo: "CP-022",
    projetoId: "PJF-0041",
    titulo: "Automação Industrial e Instrumentação de Linha",
    papel: "Especificação de instrumentação, controle e integração da linha de envase.",
    entregas: "Especificação técnica, arquitetura de automação e plano de comissionamento.",
    experiencia: "Automação industrial, instrumentação ou integração de sistemas produtivos.",
    participacao: "Prestação de serviços técnicos integrada à composição orçamentária.",
    aderencia: 35,
    cobre: [],
  },
  {
    codigo: "CP-023",
    projetoId: "PJF-0041",
    titulo: "Enquadramento em Incentivos à Inovação",
    papel: "Enquadramento do dispêndio de P&D nos instrumentos de incentivo aplicáveis.",
    entregas: "Parecer de enquadramento, memória de cálculo e plano de documentação.",
    experiencia: "Atuação com Lei do Bem, subvenção econômica ou instrumentos equivalentes.",
    participacao: "Prestação de serviços técnicos com escopo definido em instrumento próprio.",
    aderencia: 22,
    cobre: [],
  },
];

export function chamadaPor(codigo: string): Chamada | undefined {
  return CHAMADAS.find((c) => c.codigo.toLowerCase() === codigo.toLowerCase());
}

/**
 * Ressalva contratual — texto idêntico ao da página pública. É obrigatório em
 * qualquer tela que ofereça manifestar capacidade.
 */
export const RESSALVA_MANIFESTACAO =
  "A manifestação de interesse não constitui promessa de contratação, financiamento ou participação definitiva no projeto. As condições econômicas e responsabilidades serão formalizadas em instrumento próprio caso a composição avance.";

// ------------------------------------------------------------------ grafo

export const TIPOS_NO: { id: TipoNo; rotulo: string }[] = [
  { id: "territorio", rotulo: "Território" },
  { id: "problema", rotulo: "Problema" },
  { id: "ativo", rotulo: "Ativo" },
  { id: "organizacao", rotulo: "Organização" },
  { id: "capacidade", rotulo: "Capacidade" },
  { id: "capital", rotulo: "Capital" },
  { id: "projeto", rotulo: "Projeto" },
  { id: "execucao", rotulo: "Execução" },
  { id: "evidencia", rotulo: "Evidência" },
  { id: "resultado", rotulo: "Resultado" },
];

export const NOS_GRAFO: NoGrafo[] = [
  {
    id: "n-territorio",
    tipo: "territorio",
    rotulo: "Vale do Mamanguape / PB",
    detalhe: "Território onde o problema foi demonstrado e onde a execução acontece.",
    x: 50,
    y: 9,
  },
  {
    id: "n-problema",
    tipo: "problema",
    rotulo: "Resíduos em bacia + drenagem",
    detalhe: "Descarte inadequado em bacia hidrográfica e déficit de drenagem pluvial urbana.",
    x: 17,
    y: 29,
  },
  {
    id: "n-ativo",
    tipo: "ativo",
    rotulo: "Áreas e infraestrutura comunitária",
    detalhe: "Ativos mobilizáveis já identificados no território. Ativo não é organização.",
    x: 82,
    y: 29,
  },
  {
    id: "n-org-assoc",
    tipo: "organizacao",
    rotulo: "Associação territorial",
    detalhe: "Exerce a função de Proponente. Função institucional, não capacidade técnica.",
    x: 8,
    y: 53,
  },
  {
    id: "n-org-coop",
    tipo: "organizacao",
    rotulo: "Cooperativa local",
    detalhe: "Exerce a função de Operação Territorial na coalizão.",
    x: 28,
    y: 68,
  },
  {
    id: "n-capacidade",
    tipo: "capacidade",
    rotulo: "Engenharia hídrica (vaga)",
    detalhe: "Função crítica ainda descoberta. Chamada de composição CP-014 aberta.",
    x: 40,
    y: 47,
  },
  {
    id: "n-capital",
    tipo: "capital",
    rotulo: "Saneamento e fundo climático",
    detalhe: "Instrumentos sob análise de aderência. Nenhum recurso contratado até aqui.",
    x: 80,
    y: 53,
  },
  {
    id: "n-projeto",
    tipo: "projeto",
    rotulo: "PJF-0027",
    detalhe: "Projeto em Formação — em composição, 3/5 funções críticas cobertas (60%).",
    x: 52,
    y: 72,
  },
  {
    id: "n-execucao",
    tipo: "execucao",
    rotulo: "Execução — 3 entregas",
    detalhe: "E-01 aprovada, E-02 pendente, E-03 em andamento.",
    x: 16,
    y: 89,
  },
  {
    id: "n-evidencia",
    tipo: "evidencia",
    rotulo: "5 evidências aprovadas",
    detalhe: "Cada registro guarda autor, data e entrega vinculada.",
    x: 78,
    y: 89,
  },
  {
    id: "n-resultado",
    tipo: "resultado",
    rotulo: "Resultado em apuração",
    detalhe: "O que mudou ainda não é demonstrável. Entrega não é resultado.",
    x: 50,
    y: 97,
  },
];

export const ARESTAS_GRAFO: ArestaGrafo[] = [
  { de: "n-territorio", para: "n-problema", relacao: "onde ocorre" },
  { de: "n-territorio", para: "n-ativo", relacao: "abriga" },
  { de: "n-problema", para: "n-org-assoc", relacao: "apresentado por" },
  { de: "n-problema", para: "n-capacidade", relacao: "exige" },
  { de: "n-org-assoc", para: "n-projeto", relacao: "proponente de" },
  { de: "n-org-coop", para: "n-projeto", relacao: "opera" },
  { de: "n-capacidade", para: "n-projeto", relacao: "função crítica de" },
  { de: "n-ativo", para: "n-projeto", relacao: "mobilizado por" },
  { de: "n-capital", para: "n-projeto", relacao: "instrumento analisado para" },
  { de: "n-projeto", para: "n-execucao", relacao: "executado como" },
  { de: "n-execucao", para: "n-evidencia", relacao: "comprovado por" },
  { de: "n-evidencia", para: "n-resultado", relacao: "sustenta" },
];

/** Relações do nó, montadas a partir das arestas — nada é digitado duas vezes. */
export function relacoesDoNo(id: string): { relacao: string; outro: NoGrafo }[] {
  const nome = (nid: string) => NOS_GRAFO.find((n) => n.id === nid);
  const saida = ARESTAS_GRAFO.filter((a) => a.de === id)
    .map((a) => ({ relacao: a.relacao, outro: nome(a.para) }))
    .filter((r): r is { relacao: string; outro: NoGrafo } => Boolean(r.outro));
  const entrada = ARESTAS_GRAFO.filter((a) => a.para === id)
    .map((a) => ({ relacao: `${a.relacao} (recebida)`, outro: nome(a.de) }))
    .filter((r): r is { relacao: string; outro: NoGrafo } => Boolean(r.outro));
  return [...saida, ...entrada];
}

// ------------------------------------------------------------------ pendências

/** Números do painel. Derivados das fixtures, nunca digitados soltos. */
export const PENDENCIAS = {
  chamadasAbertas: CHAMADAS.length,
  evidenciasPendentes: PROJETOS.flatMap((p) => p.entregas).filter(
    (e) => e.estado === "pendente" || e.estado === "andamento",
  ).length,
};

// ------------------------------------------------------------------ conversa

export interface MensagemConversa {
  autor: "ponte" | "voce";
  texto: string;
  transcricao?: string;
  duracao?: string;
  acoes?: string[];
}

/** Roteiro fixo do modo conversa. Não há STT nem LLM ligados a este protótipo. */
export const CONVERSA_INICIAL: MensagemConversa[] = [
  {
    autor: "ponte",
    texto:
      "Oi. Pode falar comigo por áudio, como no WhatsApp. Me conte o que você precisa — um problema pra resolver, uma capacidade que você tem, ou dinheiro pra alocar.",
    duracao: "0:34",
    transcricao:
      "Oi. Pode falar comigo por áudio, como no WhatsApp. Me conte o que você precisa — um problema pra resolver, uma capacidade que você tem, ou dinheiro pra alocar.",
    acoes: ["Quais vagas combinam comigo?", "O que fecha nos próximos 15 dias?", "Falar com pessoa"],
  },
];
