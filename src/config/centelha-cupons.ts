/**
 * Catálogo de cupons do checkout /centelha-3-pb.
 *
 * A fonte de verdade é a tabela `centelha_cupons` no Supabase. Este arquivo
 * serve como:
 *   1. Documentação humana de quem é quem
 *   2. Tipagem TypeScript pros enums
 *   3. Referência cruzada quando precisar atualizar a tabela
 *
 * Para ALTERAR cupons em produção:
 *   1. Atualizar a tabela `centelha_cupons` no Supabase
 *   2. Refletir aqui (opcional, só pra manter doc sincronizada)
 *
 * Para CRIAR um novo cupom:
 *   1. INSERT na tabela
 *   2. Adicionar ao array CUPOM_CATALOGO abaixo
 */

export type TipoCupom = "afiliado_20" | "amigos_270";

export interface CupomCatalogo {
  codigo: string;
  tipo: TipoCupom;
  valorFinalCentavos: number;
  maxUsos: number | null; // null = ilimitado
  afiliadoNome: string;
}

export const VALOR_PADRAO_CENTAVOS = 270000; // R$ 2.700,00
export const VALOR_AFILIADO_20_CENTAVOS = 216000; // R$ 2.160,00 (20% off)
export const VALOR_AMIGOS_270_CENTAVOS = 27000; // R$ 270,00

export const CUPOM_CATALOGO: CupomCatalogo[] = [
  // Afiliados 20% (ilimitado)
  {
    codigo: "PEDRO",
    tipo: "afiliado_20",
    valorFinalCentavos: VALOR_AFILIADO_20_CENTAVOS,
    maxUsos: null,
    afiliadoNome: "Pedro",
  },
  {
    codigo: "GAYOSO",
    tipo: "afiliado_20",
    valorFinalCentavos: VALOR_AFILIADO_20_CENTAVOS,
    maxUsos: null,
    afiliadoNome: "Gayoso",
  },
  {
    codigo: "ESC",
    tipo: "afiliado_20",
    valorFinalCentavos: VALOR_AFILIADO_20_CENTAVOS,
    maxUsos: null,
    afiliadoNome: "ESC",
  },
  {
    codigo: "WS",
    tipo: "afiliado_20",
    valorFinalCentavos: VALOR_AFILIADO_20_CENTAVOS,
    maxUsos: null,
    afiliadoNome: "WS",
  },
  {
    codigo: "RESULT",
    tipo: "afiliado_20",
    valorFinalCentavos: VALOR_AFILIADO_20_CENTAVOS,
    maxUsos: null,
    afiliadoNome: "Result",
  },

  // Amigos R$ 270 (2 vagas cada, total 10)
  {
    codigo: "LUZERO",
    tipo: "amigos_270",
    valorFinalCentavos: VALOR_AMIGOS_270_CENTAVOS,
    maxUsos: 2,
    afiliadoNome: "Luzero",
  },
  {
    codigo: "FABRICIO",
    tipo: "amigos_270",
    valorFinalCentavos: VALOR_AMIGOS_270_CENTAVOS,
    maxUsos: 2,
    afiliadoNome: "Fabrício",
  },
  {
    codigo: "PAULO",
    tipo: "amigos_270",
    valorFinalCentavos: VALOR_AMIGOS_270_CENTAVOS,
    maxUsos: 2,
    afiliadoNome: "Paulo",
  },
  {
    codigo: "ISABELLE",
    tipo: "amigos_270",
    valorFinalCentavos: VALOR_AMIGOS_270_CENTAVOS,
    maxUsos: 2,
    afiliadoNome: "Isabelle",
  },
  {
    codigo: "PABLO",
    tipo: "amigos_270",
    valorFinalCentavos: VALOR_AMIGOS_270_CENTAVOS,
    maxUsos: 2,
    afiliadoNome: "Pablo",
  },
];

/** Helper para formatar centavos como "R$ X.XXX,XX". */
export function formatBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/** Tag legível pra mostrar o desconto aplicado. */
export function descricaoCupom(c: {
  tipo: TipoCupom;
  afiliadoNome: string | null;
}): string {
  switch (c.tipo) {
    case "afiliado_20":
      return `Indicação de ${c.afiliadoNome ?? "afiliado"} — 20% de desconto`;
    case "amigos_270":
      return `Indicação de ${c.afiliadoNome ?? "amigo"} — taxa social`;
  }
}
