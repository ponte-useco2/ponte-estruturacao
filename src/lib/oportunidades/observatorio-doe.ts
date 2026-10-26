/**
 * O Observatório do Diário Oficial da PB (26/10/2026): as peças de due diligence lidas no Diário Oficial do Estado,
 * geradas noutro projeto (D:\doe_PB) e copiadas para `web/src/conteudo/doe/` por `scripts/copiar_doe_pb.py`.
 *
 * Só administrador: a página e a rota de cada peça conferem no servidor. As peças ficam fora de `public/` (lá, o
 * endereço direto .html as serviria a qualquer um) e vão à página num iframe com sandbox, sem acesso à sessão.
 *
 * Quando as peças forem regeradas, a sessão de lá avisa; roda-se a cópia de novo e muda-se `BASE_DOE`.
 */

/** Até que dia o Diário foi lido nas peças desta cópia (AAAA-MM-DD). */
export const BASE_DOE = "2026-10-24";

export const DIARIO_OFICIAL_PB = "https://auniao.pb.gov.br/servicos/doe";

export const ASSINATURA_DOE = "PONTE Estruturação de Projetos de Impacto";

export interface PecaDoe {
  /** O id na URL e o nome do arquivo em `src/conteudo/doe/<id>.html`. */
  id: string;
  /** O nome curto, na aba. */
  nome: string;
  /** O título por extenso, no cabeçalho da página. */
  titulo: string;
  /** Uma frase sobre o que a peça cobre. */
  resumo: string;
}

export const PECAS_DOE: readonly PecaDoe[] = [
  {
    id: "cehap",
    nome: "CEHAP",
    titulo: "Companhia Estadual de Habitação Popular (CEHAP)",
    resumo: "Atos, orçamento, credores e licitações da companhia de habitação, em infográfico.",
  },
  {
    id: "secties",
    nome: "SECTIES",
    titulo: "Secretaria da Ciência, Tecnologia, Inovação e Ensino Superior (SECTIES)",
    resumo: "Due diligence da secretaria: atos do Diário, orçamento, credores, convênios e licitações.",
  },
  {
    id: "fapesq",
    nome: "FAPESQ",
    titulo: "Fundação de Apoio à Pesquisa do Estado da Paraíba (FAPESQ)",
    resumo: "Due diligence da fundação: atos do Diário, orçamento, credores e convênios.",
  },
  {
    id: "fundiario",
    nome: "Regularização fundiária",
    titulo: "Regularização fundiária no Diário Oficial",
    resumo: "Os atos de regularização fundiária publicados no Diário, mês a mês.",
  },
];

/** A peça do id, ou null (id fora da lista nunca vira caminho de arquivo). */
export function pecaDoe(id: string | null | undefined): PecaDoe | null {
  return PECAS_DOE.find((p) => p.id === id) ?? null;
}

/** A rota que serve o HTML da peça (só administrador; os outros recebem 404). */
export function urlPecaDoe(id: string): string {
  return `/mapa/diario-oficial/peca/${id}`;
}

/** A página do observatório na peça. */
export function urlObservatorioDoe(id: string): string {
  return id === PECAS_DOE[0].id ? "/mapa/diario-oficial" : `/mapa/diario-oficial?peca=${id}`;
}
