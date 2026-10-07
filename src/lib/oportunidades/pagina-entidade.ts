/**
 * A página da entidade (E1, desenho aprovado em 07/10/2026): um CNPJ proponente — prefeitura, fundo, autarquia,
 * órgão estadual, consórcio, organização da sociedade civil — com a sua carteira, a sua fila e o seu dinheiro.
 * O município é o território que soma as entidades municipais; a entidade é a unidade. A página usa o mesmo motor
 * do relatório do município (`montarRelatorio`), com a entrada lida por CNPJ.
 *
 * Aqui fica o que é puro: o CNPJ da URL, a espécie (pelo tipo do painel e pelo nome), as abas por nível de acesso
 * (decisão D1), quem é cliente da entidade e o agrupamento do bloco "Quem recebe no município". Sem banco.
 */
import { GRUPOS_SITUACAO, grupoDaSituacao } from "./busca.ts";
import type { NivelAcesso } from "./pagina-municipio.ts";
import type { ColunaCsv } from "./painel.ts";
import type { AreaExcetuada, InstrumentoRelatorio } from "./relatorio-municipio.ts";

/**
 * O CNPJ como a base guarda: 14 posições, sem máscara. Aceita o alfanumérico (12 posições de letras e dígitos e 2
 * dígitos verificadores, em vigor desde 07/2026). Fora do formato, null (a página responde 404).
 */
export function cnpjDaUrl(v: string | null | undefined): string | null {
  const c = (v ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return /^[0-9A-Z]{12}\d{2}$/.test(c) ? c : null;
}

export type EspecieEntidade =
  | "prefeitura"
  | "fundo_municipal"
  | "municipal_outro"
  | "governo_estadual"
  | "secretaria_estadual"
  | "universidade_estadual"
  | "fundo_estadual"
  | "estadual_outro"
  | "consorcio"
  | "osc"
  | "empresa"
  | "outro";

export const ROTULO_ESPECIE: Record<EspecieEntidade, string> = {
  prefeitura: "Prefeitura",
  fundo_municipal: "Fundo municipal",
  municipal_outro: "Órgão ou entidade municipal",
  governo_estadual: "Governo do estado",
  secretaria_estadual: "Secretaria estadual",
  universidade_estadual: "Universidade estadual",
  fundo_estadual: "Fundo estadual",
  estadual_outro: "Órgão ou entidade estadual",
  consorcio: "Consórcio público",
  osc: "Organização da sociedade civil",
  empresa: "Empresa",
  outro: "Outro proponente",
};

/**
 * A espécie pelo tipo do painel (`tipo_agente`) e pelo nome. O nome corrige o que o tipo do painel erra: o "Fundo
 * Municipal de Saúde de Pitimbu" vem como `osc` (a correção no job é da E3) e aqui sai como fundo municipal.
 */
export function especieDe(nome: string | null | undefined, tipoAgente: string | null | undefined): EspecieEntidade {
  const n = (nome ?? "").toUpperCase();
  if (/^(FUNDO MUNICIPAL|FMS\b|FMAS\b)/.test(n)) return "fundo_municipal";
  switch (tipoAgente) {
    case "municipio":
      if (/^(MUNIC[IÍ]PIO|PREFEITURA)/.test(n)) return "prefeitura";
      if (/\bFUNDO\b/.test(n)) return "fundo_municipal";
      return "municipal_outro";
    case "estado":
      if (/^(ESTADO D[AEO]|GOVERNO D[OA] ESTADO)/.test(n)) return "governo_estadual";
      if (/^SECRETARIA/.test(n)) return "secretaria_estadual";
      if (/UNIVERSIDADE/.test(n)) return "universidade_estadual";
      if (/\bFUNDO\b/.test(n)) return "fundo_estadual";
      return "estadual_outro";
    case "consorcio_publico":
      return "consorcio";
    case "osc":
      return "osc";
    case "empresa":
      return "empresa";
    default:
      return "outro";
  }
}

/** A lente do bloco "Quem recebe no município" (desenho da entidade): poder público, estado ou sociedade civil. */
export type LenteEntidade = "municipal" | "estado" | "sociedade" | "outros";

export const ROTULO_LENTE: Record<LenteEntidade, string> = {
  municipal: "Poder público municipal",
  estado: "Estado no município",
  sociedade: "Sociedade civil",
  outros: "Outros proponentes",
};

export const EXPLICA_LENTE: Record<LenteEntidade, string> = {
  municipal: "A prefeitura, os fundos e as autarquias e consórcios municipais. São eles que formam a fila do município.",
  estado: "Órgãos estaduais com sede aqui. Não entram na fila do município.",
  sociedade: "Organizações da sociedade civil com convênio ou termo de fomento. Não entram na fila do município.",
  outros: "Empresas e outros proponentes com sede aqui.",
};

export function lenteDe(e: EspecieEntidade): LenteEntidade {
  if (e === "prefeitura" || e === "fundo_municipal" || e === "municipal_outro" || e === "consorcio") return "municipal";
  if (e === "governo_estadual" || e === "secretaria_estadual" || e === "universidade_estadual" || e === "fundo_estadual" || e === "estadual_outro") return "estado";
  if (e === "osc") return "sociedade";
  return "outros";
}

/**
 * A área de um fundo ou órgão municipal de saúde, educação ou assistência social, pelo nome: a LRF não suspende
 * transferências voluntárias para essas ações (art. 25, § 3º). A prefeitura não tem área: é o ente inteiro.
 */
export function areaExcetuadaDe(nome: string | null | undefined, especie: EspecieEntidade): AreaExcetuada | null {
  if (especie !== "fundo_municipal" && especie !== "municipal_outro") return null;
  const n = (nome ?? "").toUpperCase();
  if (/SA[UÚ]DE|\bFMS\b/.test(n)) return "saude";
  if (/ASSIST[EÊ]NCIA SOCIAL|\bFMAS\b/.test(n)) return "assistencia";
  if (/EDUCA[CÇ][AÃ]O|FUNDEB/.test(n)) return "educacao";
  return null;
}

/** Entidades municipais (prefeitura e fundos): o CAUC e a LRF do município valem para elas. */
export const ehMunicipal = (e: EspecieEntidade) => e === "prefeitura" || e === "fundo_municipal" || e === "municipal_outro";

// ================================================================ abas e acesso

export type AbaEntidade = "trava" | "resumo" | "instrumentos" | "dinheiro" | "controle" | "relatorio";

/** As abas e o nível mínimo de cada uma (D1): o público vê o resumo, a carteira e o dinheiro resumido. */
export const ABAS_ENTIDADE: readonly { id: AbaEntidade; nome: string; minimo: NivelAcesso }[] = [
  { id: "trava", nome: "O que trava e o que destrava", minimo: 1 },
  { id: "resumo", nome: "Resumo", minimo: 0 },
  { id: "instrumentos", nome: "Instrumentos", minimo: 0 },
  { id: "dinheiro", nome: "Dinheiro", minimo: 0 },
  { id: "controle", nome: "Controle", minimo: 1 },
  { id: "relatorio", nome: "Relatório e dados", minimo: 1 },
];

/** A aba que abre: a pedida, se existe e o nível alcança; senão a de entrada (o que trava, ou o resumo para o público). */
export function abaDaEntidade(pedida: string | string[] | undefined, nivel: NivelAcesso): AbaEntidade {
  const p = Array.isArray(pedida) ? pedida[0] : pedida;
  const aba = ABAS_ENTIDADE.find((a) => a.id === p);
  if (aba && nivel >= aba.minimo) return aba.id;
  return nivel >= 1 ? "trava" : "resumo";
}

export function urlEntidade(cnpj: string, aba?: AbaEntidade): string {
  return `/mapa/entidade/${encodeURIComponent(cnpj)}${aba && aba !== "trava" ? `?aba=${aba}` : ""}`;
}

/**
 * O nível de quem abre a página da entidade. Cliente (2) é a organização de município com o IBGE confirmado,
 * diante de uma entidade municipal do mesmo IBGE (a regra do `podeVerInstrumento`). OSC, estado e consórcio só
 * serão clientes quando a organização tiver o CNPJ confirmado (E2); até lá, veem como cadastrados.
 */
export function nivelNaEntidade(
  v: { aprovado: boolean; administrador: boolean; ibgeConfirmado: string | null },
  e: { especie: EspecieEntidade; cod_ibge: string | null },
): NivelAcesso {
  if (!v.aprovado) return 0;
  if (v.administrador) return 3;
  return v.ibgeConfirmado && ehMunicipal(e.especie) && e.cod_ibge === v.ibgeConfirmado ? 2 : 1;
}

// ================================================================ quem recebe no município

export interface LinhaEntidadeMunicipio {
  cnpj: string | null;
  proponente: string | null;
  tipo_agente: string | null;
  situacao: string | null;
  vl_global: number | null;
  dt_assinatura: string | null;
}

export interface EntidadeNoMunicipio {
  cnpj: string;
  nome: string;
  especie: EspecieEntidade;
  instrumentos: number;
  emExecucao: number;
  valor: number;
  /** Ano da assinatura mais recente. */
  ultimoAno: number | null;
}

/** Os instrumentos de um município agrupados por CNPJ e por lente, cada lente do maior valor para o menor. */
export function quemRecebe(linhas: LinhaEntidadeMunicipio[]): { lente: LenteEntidade; entidades: EntidadeNoMunicipio[] }[] {
  const porCnpj = new Map<string, EntidadeNoMunicipio & { tipo: string | null; dataNome: string }>();
  for (const l of linhas) {
    if (!l.cnpj) continue;
    const g = porCnpj.get(l.cnpj) ?? { cnpj: l.cnpj, nome: l.proponente ?? l.cnpj, especie: "outro" as EspecieEntidade, instrumentos: 0, emExecucao: 0, valor: 0, ultimoAno: null, tipo: l.tipo_agente, dataNome: "" };
    g.instrumentos += 1;
    if (/^em execu/i.test(l.situacao ?? "")) g.emExecucao += 1;
    g.valor += l.vl_global ?? 0;
    const ano = l.dt_assinatura ? Number(l.dt_assinatura.slice(0, 4)) : null;
    if (ano && (!g.ultimoAno || ano > g.ultimoAno)) g.ultimoAno = ano;
    // o nome mais recente vale (a razão social muda; "PREFEITURA MUNICIPAL DE" vira "MUNICIPIO DE")
    if (l.proponente && (l.dt_assinatura ?? "") >= g.dataNome) {
      g.nome = l.proponente;
      g.dataNome = l.dt_assinatura ?? "";
    }
    porCnpj.set(l.cnpj, g);
  }
  const ordem: LenteEntidade[] = ["municipal", "estado", "sociedade", "outros"];
  const grupos = new Map<LenteEntidade, EntidadeNoMunicipio[]>();
  for (const g of porCnpj.values()) {
    const especie = especieDe(g.nome, g.tipo);
    const e: EntidadeNoMunicipio = { cnpj: g.cnpj, nome: g.nome, especie, instrumentos: g.instrumentos, emExecucao: g.emExecucao, valor: g.valor, ultimoAno: g.ultimoAno };
    const lente = lenteDe(especie);
    grupos.set(lente, [...(grupos.get(lente) ?? []), e]);
  }
  return ordem
    .filter((l) => grupos.has(l))
    .map((lente) => ({ lente, entidades: (grupos.get(lente) ?? []).sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR")) }));
}

// ================================================================ carteira e dinheiro

/** A carteira por situação, na ordem dos grupos da busca; o que não casa com nenhum grupo vai em "Outras situações". */
export function carteiraPorSituacao(instrumentos: InstrumentoRelatorio[]): { id: string; rotulo: string; itens: InstrumentoRelatorio[]; valor: number }[] {
  const grupos = [...GRUPOS_SITUACAO.map((g) => ({ id: g.id, rotulo: g.rotulo })), { id: "outro", rotulo: "Outras situações" }];
  const porGrupo = new Map<string, InstrumentoRelatorio[]>();
  for (const i of instrumentos) {
    const g = grupoDaSituacao(i.situacao) ?? "outro";
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), i]);
  }
  return grupos
    .filter((g) => porGrupo.has(g.id))
    .map((g) => {
      const itens = (porGrupo.get(g.id) ?? []).sort((a, b) => (b.dt_assinatura ?? "").localeCompare(a.dt_assinatura ?? "") || a.nr_convenio.localeCompare(b.nr_convenio));
      return { ...g, itens, valor: itens.reduce((s, i) => s + (i.vl_global ?? 0), 0) };
    });
}

/** De onde veio o dinheiro: por órgão concedente, do maior valor para o menor. */
export function dinheiroPorOrgao(instrumentos: InstrumentoRelatorio[]): { orgao: string; n: number; valor: number; desembolsado: number }[] {
  const m = new Map<string, { orgao: string; n: number; valor: number; desembolsado: number }>();
  for (const i of instrumentos) {
    const k = i.orgao_sup ?? "Órgão não informado";
    const g = m.get(k) ?? { orgao: k, n: 0, valor: 0, desembolsado: 0 };
    g.n += 1;
    g.valor += i.vl_global ?? 0;
    g.desembolsado += i.vl_desembolsado ?? 0;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor || a.orgao.localeCompare(b.orgao, "pt-BR"));
}

/** O CSV dos instrumentos da entidade (aba "Relatório e dados"). */
export const COLUNAS_CSV_INSTRUMENTOS: ColunaCsv<InstrumentoRelatorio>[] = [
  { titulo: "Número", valor: (i) => i.nr_convenio, texto: true },
  { titulo: "Modalidade", valor: (i) => i.modalidade },
  { titulo: "Situação", valor: (i) => i.situacao },
  { titulo: "Órgão", valor: (i) => i.orgao_sup },
  { titulo: "Programa", valor: (i) => i.programa },
  { titulo: "Objeto", valor: (i) => i.objeto },
  { titulo: "Valor global (R$)", valor: (i) => i.vl_global },
  { titulo: "Repasse (R$)", valor: (i) => i.vl_repasse },
  { titulo: "Desembolsado (R$)", valor: (i) => i.vl_desembolsado },
  { titulo: "Assinatura", valor: (i) => i.dt_assinatura },
  { titulo: "Fim da vigência", valor: (i) => i.dt_fim_vigencia },
  { titulo: "Limite da prestação de contas", valor: (i) => i.dt_limite_contas },
];
