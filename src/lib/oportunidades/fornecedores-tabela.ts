/**
 * A lista das empresas do painel de fornecedores como tabela com filtro (onda 15, fase 3, F3.3, 22/10/2026): as colunas,
 * os valores crus e o mapa do banco. Puro, com teste.
 *
 * O formulário de cima (busca, município, ordem, marca) continua: ele escolhe o universo e o caminho da leitura. No
 * caminho comum (toda a PB), o filtro de cada coluna vai ao banco (`tabela-banco.ts`) e a tela mostra as 100 primeiras;
 * com município ou "com registro no CEIS/CNEP", a leitura já é toda em memória, e a tabela recebe todas as linhas e
 * filtra na página. Tela de administrador: toda coluna ordena.
 */
import type { Fornecedor } from "./fornecedores.ts";
import type { CamposBanco } from "./tabela-banco.ts";
import type { ColunaTabela, FiltroColuna, ValorCelula } from "./tabela-filtro.ts";
import { normalizarTexto } from "./tabela-filtro.ts";

export const TABELA_FORNECEDORES = "forn-lista";

const ROTULO_TCU = { sim: "Inidônea", nao: "Não consta", sem: "Não verificado" } as const;

export function colunasFornecedores(municipio: string | null): ColunaTabela[] {
  return [
    { id: "empresa", titulo: "Empresa", tipo: "texto" },
    { id: "municipios", titulo: "Municípios", tipo: "numero", alinhar: "direita" },
    { id: "recebeu", titulo: municipio ? `Recebeu em ${municipio}` : "Recebeu na PB", tipo: "numero", alinhar: "direita" },
    { id: "contratado", titulo: "Contratos", tipo: "numero", alinhar: "direita" },
    { id: "brasil", titulo: "No Brasil", tipo: "numero", alinhar: "direita" },
    { id: "cnpj", titulo: "CNPJ", tipo: "texto", textoNoCsv: true, oculta: true },
    { id: "mei", titulo: "MEI", tipo: "categoria", oculta: true },
    { id: "tcu", titulo: "Lista do TCU", tipo: "categoria", oculta: true },
    { id: "convenios", titulo: "Convênios na PB", tipo: "numero", alinhar: "direita", oculta: true },
    { id: "contratos", titulo: "Número de contratos", tipo: "numero", alinhar: "direita", oculta: true },
    { id: "ufs", titulo: "UFs no Brasil", tipo: "numero", alinhar: "direita", oculta: true },
    ...(municipio ? [{ id: "recebeu-pb", titulo: "Recebeu na PB", tipo: "numero", alinhar: "direita", oculta: true } satisfies ColunaTabela] : []),
  ];
}

export function valoresDoFornecedor(f: Fornecedor & { noMunicipio: { pago: number } | null }): Record<string, ValorCelula> {
  return {
    empresa: f.nome,
    municipios: f.pb_municipios,
    recebeu: f.noMunicipio ? f.noMunicipio.pago : f.pb_pago,
    contratado: f.pb_contratos > 0 ? f.pb_contratado : null,
    brasil: f.br_pago,
    cnpj: f.cnpj,
    mei: f.mei ? "Sim" : "Não",
    tcu: f.inidoneo_tcu === null ? ROTULO_TCU.sem : f.inidoneo_tcu ? ROTULO_TCU.sim : ROTULO_TCU.nao,
    convenios: f.pb_convenios,
    contratos: f.pb_contratos,
    ufs: f.br_ufs,
    "recebeu-pb": f.pb_pago,
  };
}

/** A lista do TCU no banco: o rótulo vira `true`, `false` ou nulo (não verificado). */
function tcuNoBanco(f: FiltroColuna): string | null {
  if (f.tipo !== "categoria" || !f.valores.length) return null;
  const alvo = new Set(f.valores.map(normalizarTexto));
  const partes = [
    ...(alvo.has(normalizarTexto(ROTULO_TCU.sim)) ? ["inidoneo_tcu.eq.true"] : []),
    ...(alvo.has(normalizarTexto(ROTULO_TCU.nao)) ? ["inidoneo_tcu.eq.false"] : []),
    ...(alvo.has(normalizarTexto(ROTULO_TCU.sem)) ? ["inidoneo_tcu.is.null"] : []),
  ];
  return partes.length ? partes.join(",") : "cnpj.is.null";
}

/** O caminho comum (toda a PB), em `painel_fornecedor`. */
export const CAMPOS_FORNECEDOR: CamposBanco = {
  empresa: { coluna: "nome", curinga: true },
  municipios: { coluna: "pb_municipios" },
  recebeu: { coluna: "pb_pago" },
  contratado: { coluna: "pb_contratado" },
  brasil: { coluna: "br_pago" },
  cnpj: { coluna: "cnpj" },
  mei: { coluna: "mei", valores: { Sim: "true", Não: "false" } },
  tcu: { coluna: "inidoneo_tcu", especial: tcuNoBanco },
  convenios: { coluna: "pb_convenios" },
  contratos: { coluna: "pb_contratos" },
  ufs: { coluna: "br_ufs" },
};

export const OPCOES_FORNECEDORES: Record<string, { valor: string; linhas: number | null }[]> = {
  mei: [{ valor: "Sim", linhas: null }, { valor: "Não", linhas: null }],
  tcu: Object.values(ROTULO_TCU).map((valor) => ({ valor, linhas: null })),
};

/** A ordem do formulário ("mais municípios" ou "mais recebido"), que é a padrão da tabela; o CNPJ desempata. */
export function ordemDoFormulario(ordem: "municipios" | "valor") {
  return ordem === "valor"
    ? [{ coluna: "pb_pago", ascendente: false }, { coluna: "cnpj", ascendente: true }]
    : [{ coluna: "pb_municipios", ascendente: false }, { coluna: "pb_pago", ascendente: false }, { coluna: "cnpj", ascendente: true }];
}

/** O filtro do formulário lido do endereço (a página e a rota do CSV leem igual). */
export function filtroDosParametros(sp: URLSearchParams): {
  q: string | null;
  municipio: string | null;
  ordem: "municipios" | "valor";
  marca: "inidoneos" | "mei" | "sancionadas" | null;
} {
  const q = (sp.get("q") ?? "").trim().slice(0, 80) || null;
  const municipio = /^\d{7}$/.test(sp.get("municipio") ?? "") ? sp.get("municipio") : null;
  const ordem = sp.get("ordem") === "valor" ? "valor" : "municipios";
  const m = sp.get("marca");
  const marca = m === "inidoneos" || m === "mei" || m === "sancionadas" ? m : null;
  return { q, municipio, ordem, marca };
}

/** O endereço do CSV: a rota de exportação com o formulário e o estado da tabela da tela. */
export function urlCsvFornecedores(consultaDaPagina: string): string {
  return `/mapa/fornecedores/exportar${consultaDaPagina ? `?${consultaDaPagina}` : ""}`;
}
