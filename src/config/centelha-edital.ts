/**
 * Configuração centralizada do edital Centelha — única fonte de verdade.
 *
 * Quando vier o Centelha 4 PB (ou houver postergação de prazo), basta editar
 * este arquivo. A página /centelha-3-pb e a server action consomem daqui.
 *
 * Para alterar datas/valores em produção:
 *   1. Editar este arquivo
 *   2. Rodar `npm run build` para validar
 *   3. Commit + push (deploy automático na Vercel)
 */

export const centelhaEdital = {
  /** Identificação da edição atual do edital. */
  edition: {
    label: "Centelha 3 PB",
    year: "2026",
    fullName: "Programa Centelha 3 — Paraíba",
  },

  /** Valor máximo de apoio por projeto, considerando subvenção + bolsas CNPq. */
  funding: {
    maxValueLabel: "Até R$ 135.333,33",
    maxValueDescription:
      "Oportunidade de apoio de até R$ 135.333,33 por projeto, considerando subvenção econômica e bolsas CNPq, conforme regras, elegibilidade e disponibilidade previstas no edital oficial.",
  },

  /** Cronograma do edital. Em caso de postergação, atualizar aqui. */
  schedule: {
    phase1: {
      label: "Fase 1 (Submissão)",
      window: "24/04 a 25/05/2026",
      /** Data de fim em formato ISO — útil se quiser exibir countdown/banner */
      endIso: "2026-05-25T23:59:59-03:00",
    },
    phase2Classified: {
      label: "Fase 2 (Classificados)",
      window: "20/07 a 10/08/2026",
      endIso: "2026-08-10T23:59:59-03:00",
    },
  },

  /** Funil de classificação. */
  funnel: {
    classifiedIdeasLabel: "Até 100 classificadas",
    classifiedProjectsLabel: "Até 50 classificados",
    finalContractsLabel: "Até 25 projetos",
    /** Número usado no badge "Apenas X projetos" do hero da seção. */
    finalContractsCount: 25,
  },

  /** Investimento da consultoria — manter sincronizado se reajustar. */
  pricing: {
    stage1: {
      label: "Etapa 1 — Estruturação Técnica",
      price: "R$ 2.700",
      priceCents: ",00",
    },
    stage2: {
      label: "Etapa 2 — Acompanhamento Técnico Pós-Aprovação",
      price: "R$ 10.800",
      priceCents: ",00",
    },
  },
} as const;

/**
 * String resumida do prazo do edital — usada como `prazo_edital` no Supabase
 * para registrar em qual edição o lead caiu.
 */
export function getPrazoEditalLabel(): string {
  return `${centelhaEdital.edition.label} - ${centelhaEdital.schedule.phase1.label}: ${centelhaEdital.schedule.phase1.window}`;
}
