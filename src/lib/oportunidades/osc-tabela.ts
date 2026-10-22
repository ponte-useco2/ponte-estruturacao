/**
 * A lista das organizações da sociedade civil de um município como tabela com filtro (onda 15, fase 3, F3.3,
 * 22/10/2026). Puro, com teste.
 *
 * A lista era paginada no servidor (100 por página, até 2.215 linhas em João Pessoa). Agora o servidor lê tudo (já
 * lia), aplica o filtro de cada coluna em memória (`aplicar`, a mesma regra da tabela no navegador) e manda à tela as
 * 100 primeiras com o total; o CSV sai de uma rota com o mesmo filtro. Os chips de área e a busca de cima continuam
 * escolhendo o recorte. Tela de quem tem cadastro: a contagem de instrumentos filtra, mas não ordena (sem ranking).
 */
import { fantasiaUtil, nomeOsc, rotuloArea, rotuloNatureza, type GrupoOsc } from "./osc.ts";
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";

export const TABELA_OSC_MUNICIPIO = "osc-lista";
/** As linhas que a tela mostra de uma vez (o resto, refinando o filtro ou no CSV). */
export const OSC_NA_TELA = 100;

export const COLUNAS_OSC_MUNICIPIO: ColunaTabela[] = [
  { id: "organizacao", titulo: "Organização", tipo: "texto" },
  { id: "natureza", titulo: "Natureza", tipo: "categoria" },
  { id: "area", titulo: "Área", tipo: "texto" },
  { id: "fundacao", titulo: "Fundação", tipo: "numero", alinhar: "direita" },
  { id: "instrumentos", titulo: "Instrumentos federais", tipo: "numero", alinhar: "direita", ordenavel: false },
  { id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "fantasia", titulo: "Nome fantasia", tipo: "texto", oculta: true },
  { id: "filiais", titulo: "Filiais no município", tipo: "numero", alinhar: "direita", oculta: true },
];

export function valoresDaOsc(g: GrupoOsc & { instrumentos: number }): Record<string, ValorCelula> {
  const ano = g.principal.dt_fundacao ? Number(g.principal.dt_fundacao.slice(0, 4)) : null;
  return {
    organizacao: nomeOsc(g.principal),
    natureza: rotuloNatureza(g.principal.natureza_juridica),
    area: g.principal.areas.length ? g.principal.areas.map(rotuloArea).join("; ") : null,
    fundacao: ano !== null && Number.isFinite(ano) ? ano : null,
    instrumentos: g.instrumentos || null,
    cnpj: g.principal.cnpj,
    fantasia: g.principal.razao_social ? fantasiaUtil(g.principal) : null,
    filiais: g.filiais || null,
  };
}
