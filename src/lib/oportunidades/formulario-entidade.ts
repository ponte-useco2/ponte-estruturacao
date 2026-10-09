/**
 * O formulário "Quem é a entidade" (`/mapa/conta/organizacao`), a porta de quem chega pelas Janelas (onda 7, C,
 * 09/10/2026; achado N08 da auditoria R1, WCAG 3.3.1 e 3.3.2). Funções puras, com teste.
 *
 * - O município se escolhe pelo nome: o formulário pedia o código do IBGE de 7 dígitos, que quase ninguém sabe. A lista
 *   é a fixa dos 223 da Paraíba (`municipios-pb.ts`), em ordem de nome; o valor enviado continua sendo o IBGE.
 * - O erro fica ligado ao campo de que fala (`aria-describedby` e `aria-invalid`). A ação do servidor
 *   (`cadastrarOrganizacao`) devolve só o texto, sem dizer o campo: `campoDoErro` reconhece o campo pelo texto, e o
 *   teste confere as mensagens de hoje. A mensagem que não fala de campo nenhum (sem permissão, falha do banco) sai sem
 *   ligação, só no aviso.
 */
import { MUNICIPIOS_PB } from "./municipios-pb.ts";

export type CampoDaEntidade = "tipo" | "nome" | "uf" | "municipio" | "cnpj";

/** Os 223 municípios da PB em ordem alfabética do nome (a lista fixa vem na ordem do código do IBGE). */
export const MUNICIPIOS_PB_POR_NOME: readonly { ibge: string; nome: string }[] = MUNICIPIOS_PB.map(([ibge, nome]) => ({ ibge, nome })).sort(
  (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
);

/** O campo de que a mensagem de erro fala, ou null. Sem acento e sem caixa: "Município", "municipio" e "MUNICÍPIO" valem. */
export function campoDoErro(erro: string | null | undefined): CampoDaEntidade | null {
  if (!erro) return null;
  const e = erro
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (e.includes("cnpj")) return "cnpj";
  if (e.includes("ibge") || e.includes("municipio")) return "municipio";
  if (/\buf\b/.test(e)) return "uf";
  if (e.includes("tipo de agente")) return "tipo";
  if (/\bnome\b/.test(e)) return "nome";
  return null;
}

/**
 * O que o campo do município oferece. Sem UF ou na Paraíba, a lista pelo nome; em outra UF, o código do IBGE (a lista
 * fixa só tem a PB, e é lá que estão os clientes).
 */
export function municipioPeloNome(uf: string | null | undefined): boolean {
  return !uf || uf === "PB";
}
