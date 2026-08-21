/**
 * Tipos do protótipo do app da Plataforma PONTE.
 *
 * O contrato de oportunidades NÃO é mais definido aqui.
 *
 * Antes ele era repetido neste arquivo, com a justificativa de que as duas
 * superfícies poderiam evoluir sem se quebrarem. A divergência que isso
 * previa aconteceu: o painel público passou ao contrato 1.1 e ganhou
 * `propostas_enviadas`, `propostas_em_elaboracao` e `propostas_por_situacao`,
 * e esta cópia não — silenciosamente, porque nada liga os dois arquivos.
 *
 * Agora ambos importam de `@/lib/oportunidades/contrato`, que é a leitura
 * única de docs/CONTRATO-DADOS-OPORTUNIDADES.md. Campo novo em minor chega
 * aos dois ao mesmo tempo; mudança de major quebra o build dos dois juntos,
 * que é o comportamento desejado.
 */

import type { Payload } from "@/lib/oportunidades/contrato";

export { CONTRATO_MAJOR } from "@/lib/oportunidades/contrato";
export type { Canal, Oportunidade } from "@/lib/oportunidades/contrato";

/**
 * O app consome um recorte do payload: não usa `propostas_recentes` nem
 * `encerradas`, que são seções exclusivas do painel público.
 *
 * `Pick` sobre o tipo compartilhado — e não uma interface própria — mantém o
 * formato de cada campo governado por uma definição só. As chaves extras do
 * JSON continuam chegando em runtime; apenas não são visíveis para o app.
 */
export type PayloadOportunidades = Pick<
  Payload,
  "versao" | "gerado_em" | "uf" | "origem" | "resumo" | "filtros" | "oportunidades"
>;

// ------------------------------------------------------------------ atores

/** Os 7 atores do onboarding (1e). O 07 entra por convite, não por autocadastro. */
export type PerfilId =
  | "empresa"
  | "especialista"
  | "osc"
  | "territorio"
  | "ict"
  | "capital"
  | "ponte";

export interface Perfil {
  id: PerfilId;
  numero: string;
  nome: string;
  resumo: string;
  /** Rótulo curto exibido no topo do app. */
  curto: string;
  /** Só por convite — não aparece como opção clicável no autocadastro. */
  porConvite?: boolean;
}

export interface Sessao {
  perfil: PerfilId;
  interesse: string;
  nome: string;
  territorio: string;
  setor: string;
  concluido: boolean;
}

// ------------------------------------------------------------------ projeto

export type EixoTransformacao = "ambiental" | "economico" | "social";

export interface FuncaoCritica {
  nome: string;
  /** Quem cobre a função quando confirmada; código da chamada quando aberta. */
  ator?: string;
  chamada?: string;
  confirmada: boolean;
}

export interface Entrega {
  codigo: string;
  titulo: string;
  responsavel: string;
  estado: "aprovada" | "pendente" | "andamento";
  detalhe: string;
  /** Percentual apenas para entregas em andamento. */
  progresso?: number;
  evidencias?: number;
  vence?: string;
}

export interface Decisao {
  data: string;
  texto: string;
}

export interface Projeto {
  id: string;
  status: string;
  statusCurto: string;
  titulo: string;
  territorio: string;
  eixos: EixoTransformacao[];
  progresso: number;
  problema: string;
  solucao: string;
  organizacoes: string;
  capital: string;
  ativos: string;
  funcoes: FuncaoCritica[];
  /** Etapas já vencidas do ciclo problema → transformação. */
  cicloAte: number;
  temas: string[];
  entregas: Entrega[];
  decisoes: Decisao[];
  emExecucao: boolean;
}

export interface Chamada {
  codigo: string;
  projetoId: string;
  titulo: string;
  papel: string;
  entregas: string;
  experiencia: string;
  participacao: string;
  /** Aderência calculada no protótipo a partir do perfil declarado. */
  aderencia: number;
  cobre: string[];
}

// ------------------------------------------------------------------ grafo

export type TipoNo =
  | "territorio"
  | "problema"
  | "ativo"
  | "organizacao"
  | "capacidade"
  | "capital"
  | "projeto"
  | "execucao"
  | "evidencia"
  | "resultado";

export interface NoGrafo {
  id: string;
  tipo: TipoNo;
  rotulo: string;
  detalhe: string;
  /** Posição em percentual da área de desenho. */
  x: number;
  y: number;
}

export interface ArestaGrafo {
  de: string;
  para: string;
  relacao: string;
}
