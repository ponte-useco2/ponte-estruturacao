/**
 * 16 fases do dashboard /conecta-impact-go.
 * Extraído do handoff Claude Design (07/2026).
 */

import type { Phase, Block, Item } from "./conecta-impact-timeline";

const s = (t: string): Item => ({ t, subs: [] });
const CL = (a: string[], d: string[], p: string[]): Block[] => [
  { title: "Checklist — Antes", items: a.map(s), tone: "antes", basis: "260px" },
  { title: "Checklist — Durante", items: d.map(s), tone: "durante", basis: "260px" },
  { title: "Checklist — Depois", items: p.map(s), tone: "depois", basis: "260px" },
];

export const PHASES: Phase[] = [
  // ============= FASE 01 =============
  {
    n: "01",
    short: "Trilho mestre de governança",
    kicker: "1 · Trilho mestre de governança",
    title: "Deixar o projeto apto para contratar sem erro",
    meta: [{ label: "Janela", value: "D0–D10 · 01/07 a 10/07/2026" }],
    blocks: [
      {
        title: "Microtarefas obrigatórias",
        items: [
          s("1. Ler TO, edital, manual e RN 01/2023."),
          { t: "2. Confirmar em planilha:", subs: ["vigência", "rubricas", "valores", "contrapartida", "regras da 2ª parcela", "prazo de RTP", "prazo final de RTF/RFF"] },
          { t: "3. Abrir estrutura documental:", subs: ["00_TO_Edital_Manual", "01_Planejamento", "02_Cotacoes", "03_Certidoes", "04_Contratos_OS", "05_NFs_RPAs", "06_Comprovantes", "07_Evidencias_Tecnicas", "08_RTP", "09_RTF_RFF"] },
          { t: "4. Abrir planilha-mestra com:", subs: ["item", "rubrica", "fornecedor", "escopo", "data da cotação", "data da certidão", "data do contrato", "data da entrega", "data do faturamento", "data do pagamento", "aceite técnico", "evidência vinculada", "saldo"] },
          s("5. Ativar rotina de aplicação financeira dos recursos na conta exclusiva."),
          s("6. Definir responsável por conferência documental antes do pagamento."),
          { t: "7. Criar modelos:", subs: ["termo de referência", "mapa comparativo", "ata de kickoff", "termo de aceite técnico", "checklist de pagamento"] },
        ],
      },
      {
        title: "Entregáveis",
        items: ["planilha-mestra ativa", "pastas do projeto criadas", "checklist-padrão de contratação aprovado"].map(s),
      },
    ],
  },

  // ============= FASE 02 =============
  {
    n: "02",
    short: "Contrapartida — Gestão (R$ 8.540)",
    kicker: "2 · Contrapartida",
    title: "Gestão de projetos — R$ 8.540",
    meta: [
      { label: "Competências", value: "jul/26 a abr/27 · 10 × R$ 854,00" },
      { label: "Início da execução", value: "11/07/2026" },
    ],
    blocks: [
      {
        title: "Escopo",
        items: [],
        intro: "Acompanhamento físico-financeiro, integração entre fornecedores, controle de entregas, cronograma, documentação e interface operacional.",
      },
      {
        title: "Calendário",
        items: [
          "Cotação / seleção: 01/07 a 07/07",
          "Contratação: 08/07 a 10/07",
          "Início da execução: 11/07",
          "Faturamento mensal sugerido: todo dia 25 do mês de competência",
          "Pagamento mensal sugerido: até o dia 05 do mês seguinte",
        ].map(s),
      },
      ...CL(
        ["escopo mensal definido", "registro da atuação prevista", "documento do prestador", "forma correta de emissão fiscal"],
        ["relatório mensal de gestão", "atualização da planilha-mestra", "atas/reuniões/pendências resolvidas"],
        ["NFA ou RPA correto", "comprovante de pagamento", "arquivo na pasta da competência", "vínculo com atividade apoiada no mês"]
      ),
    ],
  },

  // ============= FASE 03 =============
  {
    n: "03",
    short: "Atividade 1 — Pesquisa (R$ 9.600)",
    kicker: "3 · Atividade 1",
    title: "Pesquisa de mercado e validação de requisitos — R$ 9.600",
    meta: [{ label: "Execução aprovada", value: "01/07 a 31/08/2026" }],
    blocks: [
      {
        title: "Janelas",
        items: [
          "Cotação: 03/07 a 11/07",
          "Contratação: 14/07 a 18/07",
          "Execução: 21/07 a 31/08",
          "Faturamento sugerido: 01/09 a 03/09",
          "Pagamento sugerido: 08/09 a 10/09",
        ].map(s),
      },
      {
        title: "Microtarefas de contratação",
        items: [
          s("1. Redigir TR da pesquisa."),
          { t: "2. Fixar entregáveis:", subs: ["20 entrevistas", "3 perfis de usuários", "matriz de dores e ganhos", "lista priorizada de requisitos"] },
          s("3. Solicitar 3 orçamentos comparáveis."),
          { t: "4. Conferir se todos trazem:", subs: ["nome do fornecedor", "contato", "data", "descrição compatível"] },
          s("5. Montar mapa comparativo."),
          s("6. Verificar certidão de regularidade."),
          s("7. Formalizar contratação."),
        ],
      },
      ...CL(
        ["TR aprovado", "3 cotações", "mapa comparativo", "certidão", "proposta/OS assinada"],
        ["kickoff", "cronograma de entrevistas", "registros de entrevistas", "consolidação parcial"],
        ["relatório final", "aceite técnico", "NF emitida em nome correto", "comprovante bancário", "armazenamento das evidências"]
      ),
    ],
  },

  // ============= FASE 04 =============
  {
    n: "04",
    short: "Software house — Marcos (R$ 38.000)",
    kicker: "4 · Atividade 3 reconfigurada",
    title: "Software house — contrato por marcos — R$ 38.000",
    meta: [
      { label: "Assinatura / OS", value: "25/07/2026" },
      { label: "Cotação", value: "03/07 a 15/07" },
      { label: "Contratação", value: "18/07 a 24/07" },
    ],
    blocks: [
      {
        title: "Objetivo",
        items: [
          "refinar viabilidade técnica",
          "estruturar arquitetura preliminar",
          "apoiar backlog técnico",
          "definir critérios de matching factíveis",
          "depois desenvolver o núcleo funcional do MVP",
        ].map(s),
        intro: "Antecipar a software house sem sobrepor a Atividade 2. Ela entra cedo para:",
      },
      {
        title: "Microtarefas de contratação",
        items: [
          s("1. Redigir TR por marcos, não por entrega única."),
          { t: "2. Separar o que é:", subs: ["viabilidade técnica", "arquitetura e backlog técnico", "desenvolvimento núcleo do MVP", "homologação/estabilização"] },
          { t: "3. Deixar expresso que:", subs: ["UX/prototipação visual principal continua na Atividade 2", "a software house apoia tecnicamente a tradução disso para solução implementável"] },
          s("4. Pedir 3 propostas com o mesmo escopo de marcos."),
          s("5. Exigir cronograma técnico por fase."),
          s("6. Verificar certidão do fornecedor."),
          s("7. Negociar propriedade dos artefatos, documentação e critérios de aceite."),
        ],
      },
      { title: "MARCO SH-0 — Descoberta técnica e viabilidade", items: [], tone: "marco", intro: "Execução: 25/07 a 31/08 · Faturamento: 01/09 · Pagamento: 08/09" },
      { title: "Entregáveis SH-0", items: ["matriz de viabilidade técnica", "arquitetura preliminar", "modelo de dados inicial", "backlog técnico inicial", "parecer de limitações e riscos técnicos", "critérios técnicos preliminares do matching"].map(s) },
      ...CL(
        ["TR assinado", "3 cotações", "mapa comparativo", "certidão", "contrato/OS"],
        ["atas de workshops", "artefatos técnicos parciais", "versões de backlog", "decisões arquiteturais registradas"],
        ["relatório do marco", "aceite técnico do marco", "NF", "comprovante de pagamento"]
      ),
      { title: "MARCO SH-1 — Engenharia de solução e apoio técnico à prototipação", items: [], tone: "marco", intro: "Execução: 01/09 a 31/10 · Faturamento: 03/11 · Pagamento: 10/11" },
      { title: "Entregáveis SH-1", items: ["backlog refinado", "especificações do núcleo do MVP", "critérios funcionais do matching", "apoio à passagem do protótipo para escopo desenvolvível", "definição de stack, ambientes e homologação"].map(s) },
      ...CL(
        ["confirmação do escopo do marco", "atualização da planilha", "evidências do SH-0 arquivadas"],
        ["reuniões quinzenais", "documentação técnica de transição UX → engenharia", "mapa de dependências"],
        ["relatório do marco", "aceite técnico", "NF", "comprovante bancário"]
      ),
      { title: "MARCO SH-2 — Desenvolvimento do núcleo funcional do MVP", items: [], tone: "marco", intro: "Execução: 01/11/2026 a 31/01/2027 · Faturamento: 03/02/2027 · Pagamento: 10/02/2027" },
      { title: "Entregáveis SH-2", items: ["cadastro de projetos", "cadastro de apoiadores", "painel de oportunidades", "matching inicial", "registro de interações", "ambiente de testes/homologação", "documentação mínima"].map(s) },
      ...CL(
        ["escopo congelado", "critérios de homologação definidos", "responsável por homologação nomeado"],
        ["sprints quinzenais", "changelog", "prints", "links", "atas de revisão", "aceite parcial por módulo"],
        ["termo de aceite do núcleo funcional", "NF", "comprovante bancário", "dossiê de homologação"]
      ),
      { title: "MARCO SH-3 — Suporte à homologação e estabilização pré-piloto", items: [], tone: "marco", intro: "Execução: 01/02 a 28/02/2027 · Faturamento: 03/03 · Pagamento: 10/03" },
      { title: "Entregáveis SH-3", items: ["correções críticas", "estabilização do ambiente", "checklist de prontidão para piloto"].map(s) },
      ...CL(
        ["lista de pendências aprovada"],
        ["correções validadas", "atualização do ambiente"],
        ["aceite técnico", "NF", "comprovante de pagamento"]
      ),
    ],
  },

  // ============= FASE 05 =============
  {
    n: "05",
    short: "Atividade 2 — UX e protótipo (R$ 15.800)",
    kicker: "5 · Atividade 2",
    title: "Arquitetura funcional, UX e protótipo navegável — R$ 15.800",
    meta: [{ label: "Execução aprovada", value: "01/09 a 31/10/2026" }],
    blocks: [
      {
        title: "Janelas",
        items: [
          "Cotação: 10/08 a 20/08",
          "Contratação: 21/08 a 28/08",
          "Execução: 01/09 a 31/10",
          "Faturamento sugerido: 03/11",
          "Pagamento sugerido: 10/11",
        ].map(s),
      },
      ...CL(
        ["insumos da pesquisa consolidados", "TR com jornadas, fluxos e protótipo", "3 cotações", "certidão", "contrato/OS"],
        ["wireframes", "jornadas", "critérios de priorização", "validações semanais"],
        ["protótipo final", "backlog funcional", "aceite técnico", "NF", "comprovante bancário"]
      ),
    ],
  },

  // ============= FASE 06 =============
  {
    n: "06",
    short: "Atividade 4 — PF LGPD/CRM (R$ 6.000)",
    kicker: "6 · Atividade 4",
    title: "PF LGPD / Onboarding / CRM — R$ 6.000",
    meta: [
      { label: "Execução", value: "01/12/2026 a 28/02/2027" },
      { label: "Competências", value: "4 × R$ 1.500" },
    ],
    blocks: [
      {
        title: "Janelas",
        items: [
          "Cotação/seleção: 10/11 a 20/11",
          "Contratação: 21/11 a 28/11",
          "Execução: 01/12/2026 a 28/02/2027",
        ].map(s),
      },
      {
        title: "Modelo financeiro sugerido",
        items: [
          { t: "Faturamento/RPA ao fim de cada mês:", subs: ["26/12", "26/01", "26/02", "26/03"] },
          { t: "Pagamentos:", subs: ["05/01", "05/02", "05/03", "05/04"] },
        ],
      },
      ...CL(
        ["escopo sem vínculo empregatício", "definição de NFA ou RPA", "retenções previstas"],
        ["versões de termos", "fluxo de consentimento", "parametrização do CRM", "roteiro de onboarding"],
        ["entrega mensal", "aceite mensal", "NFA/RPA", "comprovante de pagamento"]
      ),
    ],
  },

  // ============= FASE 07 =============
  {
    n: "07",
    short: "RTP / 2ª parcela",
    kicker: "7 · RTP",
    title: "RTP / Preparação da 2ª parcela",
    meta: [
      { label: "Consolidação", value: "15/12/2026 a 20/01/2027" },
      { label: "Marco-alvo interno", value: "20/01/2027 — dossiê parcial pronto" },
    ],
    blocks: [
      {
        title: "Conteúdo mínimo a separar",
        items: [
          s("1. execução física até metade do projeto;"),
          s("2. entregas das Atividades 1, 2 e marcos SH-0/SH-1 em ordem;"),
          { t: "3. despesas já pagas com:", subs: ["cotações", "certidões", "contratos", "notas", "comprovantes", "aceites"] },
          s("4. relatório interno de desvios;"),
          s("5. saldo por rubrica;"),
          s("6. contrapartida executada."),
        ],
      },
      {
        title: "Observação crítica",
        items: [],
        tone: "alert",
        intro: "Se o TO exigir rito específico para liberação da 2ª parcela, esta data deve ser recalibrada no mesmo dia em que o TO for assinado.",
      },
    ],
  },

  // ============= FASE 08 =============
  {
    n: "08",
    short: "Atividade 5 — Piloto (R$ 7.200)",
    kicker: "8 · Atividade 5",
    title: "Validação em campo / piloto controlado — R$ 7.200",
    meta: [
      { label: "Execução", value: "01/03 a 31/05/2027" },
      { label: "Competências", value: "4 × R$ 1.800" },
    ],
    blocks: [
      {
        title: "Janelas",
        items: ["Cotação: 05/02 a 14/02", "Contratação: 15/02 a 20/02", "Execução: 01/03/2027 a 31/05/2027"].map(s),
      },
      {
        title: "Modelo financeiro sugerido",
        items: [
          { t: "Faturamento:", subs: ["28/03", "28/04", "28/05", "05/06 (fechamento final)"] },
          { t: "Pagamentos:", subs: ["05/04", "05/05", "05/06", "12/06"] },
        ],
      },
      ...CL(
        ["protocolo do piloto definido", "metas de uso e feedback", "forma fiscal correta"],
        ["relatórios quinzenais", "métricas de uso", "evidências de onboarding", "feedback de usuários"],
        ["relatório final", "aceite técnico", "documento fiscal", "comprovante bancário"]
      ),
    ],
  },

  // ============= FASE 09 =============
  {
    n: "09",
    short: "Atividade 6 — Melhorias (R$ 8.800)",
    kicker: "9 · Atividade 6",
    title: "Melhorias do MVP e consolidação — R$ 8.800",
    meta: [{ label: "Execução", value: "01/05 a 30/06/2027" }],
    blocks: [
      {
        title: "Janelas",
        items: [
          "Cotação: 01/04 a 10/04",
          "Contratação: 11/04 a 18/04",
          "Execução: 01/05/2027 a 30/06/2027",
          "Faturamento: até 27/06/2027 (02/07 é arriscado — fica fora da vigência)",
          "Pagamento: até 30/06/2027",
        ].map(s),
      },
      {
        title: "Regra de ouro dessa contratação",
        items: [],
        tone: "alert",
        intro: "Nada aqui pode ser deixado para faturar ou pagar depois de 30/06/2027.",
      },
      ...CL(
        ["backlog pós-piloto priorizado", "saldo validado", "3 cotações", "certidão", "contrato"],
        ["correções homologadas", "melhoria dos indicadores", "documentação final"],
        ["aceite técnico final", "NF emitida dentro da vigência", "comprovante de pagamento dentro da vigência"]
      ),
    ],
  },

  // ============= FASE 10 =============
  {
    n: "10",
    short: "Fechamento da execução",
    kicker: "10 · Fechamento",
    title: "Fechamento da execução",
    meta: [{ label: "Janela", value: "20/06 a 30/06/2027" }],
    blocks: [
      {
        title: "Microtarefas",
        items: [
          s("1. travar novas contratações;"),
          { t: "2. conferir se tudo que foi contratado foi:", subs: ["entregue", "faturado", "pago", "aceito", "arquivado"] },
          s("3. fechar extrato da conta exclusiva;"),
          s("4. consolidar saldo;"),
          s("5. preparar devolução de eventual saldo remanescente, se aplicável;"),
          s("6. baixar todas as aplicações financeiras e rendimentos;"),
          s("7. finalizar planilha financeira."),
        ],
      },
    ],
  },

  // ============= FASE 11 =============
  {
    n: "11",
    short: "Prestação de contas final",
    kicker: "11 · Prestação de contas",
    title: "Prestação de contas final",
    meta: [
      { label: "Janela", value: "01/07 a 30/07/2027" },
      { label: "Entregas", value: "RTF · RFF · anexos comprobatórios" },
    ],
    blocks: [
      {
        title: "Microtarefas",
        items: [
          s("1. consolidar execução física final;"),
          s("2. consolidar execução financeira final;"),
          s("3. montar índice documental;"),
          { t: "4. revisar se cada despesa possui:", subs: ["aderência à rubrica", "aderência à vigência", "orçamento/certidão, quando exigível", "contrato/OS", "documento fiscal", "comprovante de pagamento", "aceite técnico", "evidência do objeto"] },
          s("5. protocolar dentro do prazo;"),
          s("6. guardar documentos originais por 5 anos."),
        ],
      },
    ],
  },

  // ============= FASE 12 =============
  {
    n: "12",
    short: "Checklists documentais padrão",
    kicker: "12 · Checklist documental por marco",
    title: "Checklists documentais padrão",
    meta: [],
    blocks: [
      {
        title: "Para qualquer PJ acima da pequena monta",
        items: ["TR/escopo", "3 orçamentos", "mapa comparativo", "certidão de regularidade", "proposta aceita / OS / contrato", "ata de kickoff", "relatório ou entrega do marco", "termo de aceite técnico", "nota fiscal em nome correto", "comprovante bancário", "lançamento na planilha"].map(s),
        basis: "280px",
      },
      {
        title: "Para qualquer PF",
        items: ["escopo claro sem vínculo empregatício", "documento pessoal/cadastro fiscal", "forma correta de emissão", "evidência da entrega", "aceite", "NFA ou RPA com retenções", "comprovante de pagamento", "lançamento na planilha"].map(s),
        basis: "280px",
      },
      {
        title: "Para a conta exclusiva",
        items: ["extratos", "comprovantes de aplicação financeira", "controle de rendimentos", "reconciliação entre saldo da conta e planilha do projeto"].map(s),
        basis: "280px",
      },
    ],
  },

  // ============= FASE 13 =============
  {
    n: "13",
    short: "Alertas finais",
    kicker: "13 · Alertas finais",
    title: "Alertas finais",
    meta: [],
    blocks: [
      {
        title: "Não perder de vista",
        items: [
          "1. Software house antecipada: sim, mas por marcos.",
          "2. Não misturar escopo da software house com o da UX/prototipação.",
          "3. Não deixar NF da Atividade 6 para julho.",
          "4. Não pagar sem aceite técnico.",
          "5. Não considerar a 2ª parcela como disponível antes da aprovação formal do parcial.",
          "6. Se o TO exigir rito específico para liberação da 2ª parcela, recalibrar imediatamente as datas do bloco RTP.",
        ].map(s),
        tone: "alert",
      },
    ],
  },

  // ============= FASE 14 =============
  {
    n: "14",
    short: "Papel da coordenadora",
    kicker: "Guia da coordenadora",
    title: "Papel da coordenadora e a regra de ouro",
    meta: [{ label: "Princípio", value: "cada gasto precisa contar uma história" }],
    blocks: [
      {
        title: "O que significa coordenar este projeto",
        items: [
          { t: "Decidir com base no plano", subs: ["Toda ação precisa estar ligada ao cronograma, orçamento e Termo de Outorga. Se não estiver, antes de executar é preciso avaliar adequação."] },
          { t: "Cobrar evidências", subs: ["Não basta dizer que fez. Cada atividade precisa deixar rastro: cotação, contrato/OS, nota fiscal, pagamento, entrega e aceite."] },
          { t: "Proteger o projeto", subs: ["Evitar gastos fora da vigência, fornecedores incompatíveis, documentos fiscais errados e pagamentos sem entrega validada."] },
        ],
        intro: 'A coordenadora não "faz tudo". Ela garante que cada entrega aconteça, seja documentada e possa ser comprovada — sem risco de glosa ou desorganização.',
      },
      {
        title: "A regra de ouro — 6 perguntas de cada gasto",
        items: [
          "1. Está no plano?",
          "2. Tem cotação?",
          "3. Fornecedor regular?",
          "4. Nota/RPA certo?",
          "5. Entrega aceita?",
          "6. Pagamento comprovado?",
        ].map(s),
        intro: "Da contratação até a prestação de contas, tudo precisa fazer sentido e caber no plano.",
      },
      {
        title: "Se uma dessas peças faltar",
        items: [],
        tone: "alert",
        intro: "O gasto pode virar problema na prestação de contas. A maior proteção contra diligência é um dossiê por despesa, montado no dia em que a despesa aconteceu.",
      },
      {
        title: "O que ainda depende do TO",
        items: ["valor exato das parcelas", "regra formal para liberação da 2ª parcela", "prazo e formulário específico de prestação parcial/final"].map(s),
        basis: "300px",
      },
      {
        title: "Como usar este guia",
        items: [
          "Quando o Termo de Outorga sair, conferir datas, parcelas, prazos e formulários — qualquer divergência deve atualizar este cronograma.",
          "Toda reunião, decisão, contratação, entrega e pagamento deve deixar evidência: a prestação de contas será apenas a organização do que já foi feito corretamente.",
          "Base: proposta ConectaImpact GO + Manual de Utilização de Recursos e Prestação de Contas FAPEG/RN 01/2023.",
        ].map(s),
        basis: "300px",
        intro: "Roteiro de gestão, não substituto do Termo de Outorga.",
      },
    ],
  },

  // ============= FASE 15 =============
  {
    n: "15",
    short: "Sinais de alerta e checklist de pagamento",
    kicker: "Guia da coordenadora",
    title: "Sinais de alerta na contratação e checklist de pagamento",
    meta: [{ label: "Regra", value: "se aparecer um desses pontos, pare antes de pagar" }],
    blocks: [
      {
        title: "Alerta documental",
        items: ["fornecedor sem certidão", "orçamento sem data", "escopo diferente nas cotações", "NF sem descrição detalhada", "nota em nome errado"].map(s),
        tone: "alert",
        basis: "260px",
      },
      {
        title: "Alerta técnico",
        items: ["entrega não testável", '"consultoria" sem relatório', "software sem acesso/prints", "protótipo sem arquivo final", "pagamento sem aceite"].map(s),
        tone: "alert",
        basis: "260px",
      },
      {
        title: "Alerta de escopo",
        items: ["CNAE estranho ao serviço", 'fornecedor "faz tudo"', "item fora da rubrica", "serviço que parece administrativo", "mudança sem adequação prévia"].map(s),
        tone: "alert",
        basis: "260px",
      },
      {
        title: "Checklist de parede — antes de qualquer pagamento",
        items: [
          "1. Está no plano de trabalho?",
          "2. Está na rubrica correta?",
          "3. Está dentro da vigência?",
          "4. Tem 3 cotações ou justificativa?",
          "5. Fornecedor está regular?",
          "6. CNAE conversa com o serviço?",
          "7. Existe contrato/OS?",
          "8. A entrega foi aceita?",
          "9. NF/RPA está correto?",
          "10. Comprovante foi arquivado?",
        ].map(s),
        intro: 'Sem resposta "sim" para todos os 10 pontos, o pagamento não deve sair.',
      },
    ],
  },

  // ============= FASE 16 =============
  {
    n: "16",
    short: "CNAEs e fornecedores",
    kicker: "16 · CNAEs por contratação",
    title: "Fornecedores de outros estados e CNAEs aderentes",
    meta: [{ label: "Regra", value: "PJ: NF em nome do beneficiário, com discriminação detalhada" }],
    blocks: [
      {
        title: "Fornecedores de outros estados",
        items: [
          "podem ser de outros estados;",
          "precisam passar na checagem documental e fiscal aplicável;",
          "guardar no processo a prova da regularidade perante a Fazenda Pública de Goiás, além das cotações e do documento fiscal correto.",
        ].map(s),
        intro: 'Sim — empresas de outros estados podem ser fornecedoras. O manual não traz restrição geográfica; exige contratar dentro da rubrica e da vigência, pelo menor valor à vista, com item previsto no plano de trabalho e fornecedor adimplente com o Estado de Goiás. Acima de pequena monta: 3 orçamentos + regularidade perante a Fazenda de Goiás. Os CNAEs abaixo não são "únicos obrigatórios" — são os mais aderentes ao objeto de cada contratação.',
      },
      {
        title: "1 · Pesquisa qualitativa com usuários — R$ 9.600",
        items: [
          "73.20-3/00 — Pesquisas de mercado e de opinião pública",
          "70.20-4/00 — Consultoria em gestão empresarial, exceto consultoria técnica específica",
          "74.90-1/99 — Outras atividades profissionais, científicas e técnicas",
          { t: "Preferência:", subs: ["Se a empresa for claramente de pesquisa/descoberta com método de entrevistas e validação: 73.20-3/00."] },
        ].map((it) => (typeof it === "string" ? s(it) : it)),
        basis: "360px",
      },
      {
        title: "2 · Arquitetura funcional, UX e protótipo — R$ 15.800",
        items: [
          "62.04-0/00 — Consultoria em tecnologia da informação",
          "62.01-5/01 — Desenvolvimento de programas de computador sob encomenda",
          "74.10-2/99 — Atividades de design não especificadas anteriormente",
          "74.90-1/99 — Outras atividades profissionais, científicas e técnicas",
          { t: "Preferência:", subs: ["Fornecedor mais produto/UX: 62.04-0/00 + 74.10-2/99.", "Protótipo navegável com forte componente funcional/técnico: 62.01-5/01 também encaixa bem."] },
        ].map((it) => (typeof it === "string" ? s(it) : it)),
        basis: "360px",
      },
      {
        title: "3 · Desenvolvimento do MVP (núcleo funcional) — R$ 38.000",
        items: [
          "62.01-5/01 — Desenvolvimento de programas de computador sob encomenda",
          "62.03-1/00 — Desenvolvimento e licenciamento de programas não-customizáveis",
          "62.04-0/00 — Consultoria em tecnologia da informação",
          "62.09-1/00 — Suporte técnico, manutenção e outros serviços de TI",
          { t: "Preferência:", subs: ["Software house construindo para vocês: 62.01-5/01.", "Se também operar componentes próprios/SaaS: 62.03-1/00 como secundário."] },
        ].map((it) => (typeof it === "string" ? s(it) : it)),
        basis: "360px",
      },
      {
        title: "4 · LGPD / consentimento / onboarding — R$ 6.000",
        items: [
          "No orçamento final: Serviços de Terceiros de Pessoa Física. Se PF, não há CNAE.",
          { t: "Se contratado via PJ:", subs: ["69.20-6/02 — Consultoria e auditoria contábil e tributária (menos aderente, casos muito específicos)", "69.10-1/99 — Atividades jurídicas, exceto cartórios (escritório jurídico/LGPD contratual)", "62.04-0/00 — Consultoria em TI (governança digital, acessos, fluxos, adequação técnica)", "74.90-1/99 — Outras atividades profissionais, científicas e técnicas"] },
          { t: "Preferência:", subs: ["Consultoria mista privacidade + operação digital: 62.04-0/00 ou 74.90-1/99.", "Escritório jurídico de fato: 69.10-1/99."] },
        ].map((it) => (typeof it === "string" ? s(it) : it)),
        basis: "360px",
      },
      {
        title: "5 · Validação em campo — R$ 7.200 (PJ)",
        items: [
          "73.20-3/00 — Pesquisas de mercado e de opinião pública",
          "70.20-4/00 — Consultoria em gestão empresarial",
          "74.90-1/99 — Outras atividades profissionais, científicas e técnicas",
          "62.04-0/00 — Consultoria em TI (se a validação for colada em teste funcional e adoção)",
          { t: "Preferência:", subs: ["Foco em teste com usuários, aderência, percepção de valor e feedback: 73.20-3/00 ou 74.90-1/99."] },
        ].map((it) => (typeof it === "string" ? s(it) : it)),
        basis: "360px",
      },
      {
        title: "6 · Melhorias do MVP e indicadores — R$ 8.800",
        items: [
          "62.01-5/01 — Desenvolvimento de programas de computador sob encomenda",
          "62.04-0/00 — Consultoria em tecnologia da informação",
          "62.09-1/00 — Suporte técnico, manutenção e outros serviços de TI",
          "63.11-9/00 — Tratamento de dados, ASP e hospedagem (se forte componente de dados/analytics)",
          { t: "Preferência:", subs: ["Mais aderente: 62.01-5/01, com 62.04-0/00 ou 62.09-1/00 como complementares."] },
        ].map((it) => (typeof it === "string" ? s(it) : it)),
        basis: "360px",
      },
      {
        title: "7 · Gestor de projetos — contrapartida R$ 8.540 (PJ)",
        items: [
          "70.20-4/00 — Consultoria em gestão empresarial, exceto consultoria técnica específica",
          "74.90-1/99 — Outras atividades profissionais, científicas e técnicas",
          "85.99-6/04 — Treinamento em desenvolvimento profissional e gerencial (menos aderente; só se misturar mentoria/capacitação)",
          "82.11-3/00 — Serviços combinados de escritório e apoio administrativo — não recomendado (aproxima demais de apoio administrativo geral)",
          { t: "Preferência:", subs: ["Empresa de PMO/coordenação de projeto: 70.20-4/00 ou 74.90-1/99."] },
        ].map((it) => (typeof it === "string" ? s(it) : it)),
        basis: "360px",
      },
      {
        title: "Recomendação final — reduzir risco de glosa",
        items: [
          "escolher fornecedores cujo CNAE principal ou secundário converse claramente com o objeto contratado;",
          "fazer o escopo do TR bater com o CNAE;",
          "para fornecedores de outros estados, conferir com antecedência a regularidade exigida perante Goiás e guardar essa prova no dossiê da contratação;",
          'evitar fornecedores com CNAE muito distante do objeto, mesmo que "consigam emitir NF".',
        ].map(s),
        tone: "alert",
      },
    ],
  },
];
