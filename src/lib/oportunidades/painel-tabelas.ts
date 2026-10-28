/**
 * As tabelas com filtro das listas do painel (onda 15, fase 3, F3.1a, 20/10/2026): as colunas e os valores crus das
 * seis visões de convênio, das mudanças e das propostas. Puro, com teste; as células (link, etiqueta, a nota que junta
 * dados) ficam em `app/mapa/painel/TabelasConvenio.tsx`.
 *
 * As mesmas colunas servem à ficha do município (F3.1a: tudo na página, o filtro roda nas linhas lidas) e ao painel
 * (F3.2: o filtro vai à consulta). Por isso cada coluna que filtra corresponde a UM campo do banco: a célula que junta
 * vários dados ("Proponente e convênio", "Programa e órgão") continua desenhada como antes, e o número do convênio, o
 * órgão, o objeto e os dias parados vão em colunas ocultas, que filtram, ordenam e vão ao CSV.
 *
 * Telas de administrador: toda coluna ordena. Percentuais vão de 0 a 100, inteiros, como a tela escreve ("37%").
 */
import {
  EXIGENCIAS,
  ROTULO_DESFECHO,
  ROTULO_ETAPA_LICITACAO,
  ROTULO_EXIGENCIA,
  ROTULO_GRUPO_SUSPENSIVA,
  ROTULO_LADO_CONTAS,
  ROTULO_MOTIVO_ADITIVO,
  ROTULO_SINAL,
  SINAIS,
  ROTULO_ETAPA,
  TIPOS_MUDANCA,
  definicaoMudanca,
  exigenciasDe,
  fracao,
  maisLento,
  medianaComparavel,
  semDesfecho,
  type DimensaoTempo,
  type LadoContas,
  type LinhaDesfecho,
  type LinhaEtapa,
  type LinhaMatriz,
  type MudancaPainel,
  type PropostaPainel,
} from "./painel.ts";
import type { ConvenioPainel, MunicipioPainel } from "./painel.server.ts";
import type { CampoBanco, CamposBanco } from "./tabela-banco.ts";
import {
  gravarEstado,
  lerEstado,
  normalizarTexto,
  type ColunaTabela,
  type EstadoTabela,
  type FiltroColuna,
  type ValorCelula,
} from "./tabela-filtro.ts";

/** As seis visões de convênio que a ficha e o painel listam. */
export type VisaoConvenio = "suspensiva" | "nunca" | "vigencia" | "contas" | "saldo" | "fisico";
export const VISOES_CONVENIO: readonly VisaoConvenio[] = ["suspensiva", "nunca", "vigencia", "contas", "saldo", "fisico"];

/** O id de cada tabela da ficha no endereço (`?t.<id>.…`). */
export const TABELA_FICHA: Readonly<Record<VisaoConvenio, string>> = Object.freeze({
  suspensiva: "ficha-suspensiva",
  nunca: "ficha-nunca",
  vigencia: "ficha-vigencia",
  contas: "ficha-contas",
  saldo: "ficha-saldo",
  fisico: "ficha-fisico",
});
export const TABELA_FICHA_MUDANCAS = "ficha-mudancas";
export type ListaPropostas = "sem-desfecho" | "negadas" | "assinadas";
export const TABELA_FICHA_PROPOSTAS: Readonly<Record<ListaPropostas, string>> = Object.freeze({
  "sem-desfecho": "ficha-prop-sem-desfecho",
  negadas: "ficha-prop-negadas",
  assinadas: "ficha-prop-assinadas",
});

/** A fração de 0 a 1 em pontos percentuais inteiros, como `percentual` escreve. */
export const pct100 = (x: number | null | undefined): number | null =>
  x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 100);

const num = (titulo: string, id: string, oculta = false): ColunaTabela => ({ id, titulo, tipo: "numero", alinhar: "direita", ...(oculta ? { oculta } : {}) });
const data = (titulo: string, id: string, oculta = false): ColunaTabela => ({ id, titulo, tipo: "data", ...(oculta ? { oculta } : {}) });

/** A primeira coluna (o cabeçalho da linha) e as ocultas que a nota "Proponente e convênio" junta. */
function colunasDoConvenio(comMunicipio: boolean): { visivel: ColunaTabela; ocultas: ColunaTabela[] } {
  return {
    visivel: { id: "proponente", titulo: "Proponente e convênio", tipo: "texto" },
    ocultas: [
      { id: "convenio", titulo: "Nº do convênio", tipo: "texto", textoNoCsv: true, oculta: true },
      ...(comMunicipio ? [{ id: "municipio", titulo: "Município", tipo: "texto", oculta: true } satisfies ColunaTabela] : []),
      { id: "sem-movimento", titulo: "Dias sem movimentação", tipo: "numero", alinhar: "direita", oculta: true },
    ],
  };
}

/** "Programa e órgão" e as ocultas que a nota junta. */
const PROGRAMA: ColunaTabela = { id: "programa", titulo: "Programa e órgão", tipo: "texto" };
const OCULTAS_PROGRAMA: ColunaTabela[] = [
  { id: "orgao", titulo: "Órgão", tipo: "categoria", oculta: true },
  { id: "objeto", titulo: "Objeto", tipo: "texto", oculta: true },
];

/**
 * As colunas de uma visão, na ordem em que a tela as desenha (as ocultas depois de todas). Na ficha o município é o da
 * página e não entra; no painel (F3.2) entra, oculto.
 */
export function colunasDaVisao(v: VisaoConvenio, { comMunicipio = false }: { comMunicipio?: boolean } = {}): ColunaTabela[] {
  const { visivel, ocultas } = colunasDoConvenio(comMunicipio);
  const comuns = [...ocultas, ...OCULTAS_PROGRAMA];
  switch (v) {
    case "suspensiva":
      return [
        visivel,
        data("Prazo", "prazo"),
        PROGRAMA,
        { id: "exigencias", titulo: "Exigências", tipo: "texto" },
        num("Repasse", "repasse"),
        ...comuns,
      ];
    case "nunca":
      return [
        visivel,
        PROGRAMA,
        data("Assinado", "assinatura"),
        { id: "onde-parou", titulo: "Onde parou", tipo: "categoria" },
        num("Repasse", "repasse"),
        num("Empenhado", "empenhado"),
        ...comuns,
        data("Aceite do processo licitatório", "aceite", true),
      ];
    case "vigencia":
      return [
        visivel,
        data("Fim da vigência", "fim-vigencia"),
        PROGRAMA,
        num("Desembolsado (%)", "desembolsado-pct"),
        num("Extensões", "extensoes"),
        num("A desembolsar", "a-desembolsar"),
        ...comuns,
        { id: "motivo", titulo: "Motivo do último aditivo", tipo: "categoria", oculta: true },
      ];
    case "contas":
      return [
        visivel,
        PROGRAMA,
        { id: "situacao", titulo: "Situação", tipo: "categoria" },
        num("Dias depois do prazo das contas", "prazo-contas"),
        num("Repasse", "repasse"),
        ...comuns,
        { id: "lado", titulo: "Com quem está", tipo: "categoria", oculta: true },
        num("Dias com o concedente", "dias-concedente", true),
      ];
    case "saldo":
      return [
        visivel,
        PROGRAMA,
        data("Último pagamento", "ultimo-pagamento"),
        num("Dias parado", "parado"),
        num("Saldo", "saldo"),
        num("Rendimento", "rendimento"),
        ...comuns,
      ];
    case "fisico":
      return [
        visivel,
        PROGRAMA,
        num("Desembolsado (%)", "desembolsado-pct"),
        num("Físico aferido (%)", "fisico-pct"),
        data("Fim da vigência", "fim-vigencia"),
        num("Valor desembolsado", "desembolsado"),
        ...comuns,
      ];
  }
}

/** Onde parou o convênio nunca desembolsado: a etapa da licitação ou, sem ela, o grupo da suspensiva. */
export function ondeParou(c: Pick<ConvenioPainel, "etapa_licitacao" | "grupo_suspensiva">): string | null {
  if (c.etapa_licitacao) return ROTULO_ETAPA_LICITACAO[c.etapa_licitacao] ?? c.etapa_licitacao;
  return c.grupo_suspensiva ? (ROTULO_GRUPO_SUSPENSIVA[c.grupo_suspensiva] ?? c.grupo_suspensiva) : null;
}

/** Os valores crus de um convênio, por coluna de `colunasDaVisao(v)`. */
export function valoresDoConvenioPainel(c: ConvenioPainel, v: VisaoConvenio): Record<string, ValorCelula> {
  const comuns: Record<string, ValorCelula> = {
    proponente: c.proponente,
    convenio: c.nr_convenio,
    municipio: c.municipio,
    "sem-movimento": c.dias_sem_movimentacao,
    programa: c.programa,
    orgao: c.orgao_sup,
    objeto: c.objeto,
  };
  switch (v) {
    case "suspensiva": {
      const ex = exigenciasDe(c).map((e) => ROTULO_EXIGENCIA[e]);
      return { ...comuns, prazo: c.suspensiva_prazo, exigencias: ex.length ? ex.join(" · ") : null, repasse: c.repasse };
    }
    case "nunca":
      return { ...comuns, assinatura: c.dt_assinatura, "onde-parou": ondeParou(c), repasse: c.repasse, empenhado: c.empenhado, aceite: c.dt_aceite };
    case "vigencia":
      return {
        ...comuns,
        "fim-vigencia": c.dt_fim_vigencia,
        "desembolsado-pct": pct100(c.pct_desembolsado),
        extensoes: c.n_extensoes ?? 0,
        "a-desembolsar": Math.max((c.repasse ?? 0) - (c.desembolsado ?? 0), 0),
        motivo: c.motivo_aditivo ? (ROTULO_MOTIVO_ADITIVO[c.motivo_aditivo] ?? c.motivo_aditivo) : null,
      };
    case "contas":
      return {
        ...comuns,
        situacao: c.situacao,
        "prazo-contas": c.dias_apos_limite,
        repasse: c.repasse,
        lado: c.contas_lado ? (ROTULO_LADO_CONTAS[c.contas_lado as LadoContas] ?? c.contas_lado) : null,
        "dias-concedente": c.dias_com_concedente,
      };
    case "saldo":
      return {
        ...comuns,
        "ultimo-pagamento": c.dt_ultimo_pagamento,
        parado: c.dias_sem_movimento,
        saldo: c.saldo_conta,
        rendimento: c.rendimento_implicito,
      };
    case "fisico":
      return {
        ...comuns,
        "desembolsado-pct": pct100(c.pct_desembolsado),
        "fisico-pct": pct100(c.pct_fisico),
        "fim-vigencia": c.dt_fim_vigencia,
        desembolsado: c.desembolsado,
      };
  }
}

// ================================================================ as mudanças

export function colunasMudancas({ comMunicipio = false, comData = false }: { comMunicipio?: boolean; comData?: boolean } = {}): ColunaTabela[] {
  return [
    { id: "quem", titulo: "Quem", tipo: "texto" },
    { id: "mudanca", titulo: "O que mudou", tipo: "categoria" },
    PROGRAMA,
    num("Valor", "valor"),
    ...(comData ? [data("Dado de", "dia")] : []),
    { id: "numero", titulo: "Nº do convênio ou da proposta", tipo: "texto", textoNoCsv: true, oculta: true },
    { id: "alvo", titulo: "Convênio ou proposta", tipo: "categoria", oculta: true },
    ...(comMunicipio ? [{ id: "municipio", titulo: "Município", tipo: "texto", oculta: true } satisfies ColunaTabela] : []),
    ...OCULTAS_PROGRAMA,
  ];
}

/** O dia do dado ("2026-10-16T…" → "2026-10-16"): a coluna é de data. */
const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

export function valoresDaMudanca(m: MudancaPainel): Record<string, ValorCelula> {
  return {
    quem: m.proponente,
    mudanca: definicaoMudanca(m.tipo).rotulo,
    programa: m.programa,
    valor: m.valor,
    dia: dia(m.dado_ate),
    numero: m.numero ?? m.chave,
    alvo: m.alvo === "proposta" ? "Proposta" : "Convênio",
    municipio: m.municipio,
    orgao: m.orgao_sup,
    objeto: m.objeto,
  };
}

// ================================================================ as propostas da ficha

/** A coluna da data muda com a lista: o último movimento (sem desfecho, negadas) ou a assinatura. */
export function colunasPropostas(quando: "movimento" | "assinatura"): ColunaTabela[] {
  return [
    { id: "proponente", titulo: "Proponente e proposta", tipo: "texto" },
    PROGRAMA,
    { id: "situacao", titulo: "Situação", tipo: "categoria" },
    quando === "assinatura" ? data("Assinada", "assinatura") : data("Último movimento", "movimento"),
    num("Repasse pedido", "repasse"),
    { id: "proposta", titulo: "Nº da proposta", tipo: "texto", textoNoCsv: true, oculta: true },
    data("Enviada", "envio", true),
    ...(quando === "assinatura"
      ? [{ id: "convenio", titulo: "Nº do convênio", tipo: "texto", textoNoCsv: true, oculta: true } satisfies ColunaTabela]
      : [num("Dias sem movimento", "dias-parada", true)]),
    { id: "cod-programa", titulo: "Código do programa", tipo: "texto", textoNoCsv: true, oculta: true },
    ...OCULTAS_PROGRAMA,
  ];
}

export function valoresDaProposta(p: PropostaPainel, quando: "movimento" | "assinatura"): Record<string, ValorCelula> {
  const semPrograma = !p.cod_programa || p.cod_programa === "(sem programa)";
  return {
    proponente: p.proponente,
    programa: p.programa,
    situacao: ROTULO_DESFECHO[p.desfecho] ?? p.desfecho,
    ...(quando === "assinatura" ? { assinatura: p.dt_assinatura, convenio: p.nr_convenio } : { movimento: dia(p.dt_ultimo_evento), "dias-parada": p.dias_sem_evento }),
    repasse: p.valor_repasse,
    proposta: p.nr_proposta ?? p.id_proposta,
    envio: p.dt_envio,
    "cod-programa": semPrograma ? null : p.cod_programa,
    orgao: p.orgao_sup,
    objeto: p.objeto,
  };
}

// ================================================================ no painel, o filtro vai ao banco (F3.2, 20/10/2026)

/** O id de cada tabela do painel no endereço; a suspensiva tem duas listas (a vencer e vencidos). */
export const TABELA_PAINEL: Readonly<Record<VisaoConvenio, string>> = Object.freeze({
  suspensiva: "painel-suspensiva",
  nunca: "painel-nunca",
  vigencia: "painel-vigencia",
  contas: "painel-contas",
  saldo: "painel-saldo",
  fisico: "painel-fisico",
});
export const TABELA_PAINEL_VENCIDOS = "painel-suspensiva-vencidos";

/** Rótulo da tela → valor do banco (o inverso de um mapa de rótulos). */
const inverso = (m: Readonly<Record<string, string>>): Record<string, string> => Object.fromEntries(Object.entries(m).map(([v, r]) => [r, v]));

/** As exigências que um texto acha (todas as palavras no rótulo), como expressão `or` do PostgREST; nenhuma: nada passa. */
function exigenciasNoBanco(f: FiltroColuna): string | null {
  if (f.tipo !== "texto") return null;
  const palavras = normalizarTexto(f.contem).split(" ").filter(Boolean);
  if (!palavras.length) return null;
  const achadas = EXIGENCIAS.filter((e) => palavras.every((p) => normalizarTexto(ROTULO_EXIGENCIA[e]).includes(p)));
  return achadas.length ? achadas.map((e) => `exige_${e}.eq.true`).join(",") : "nr_convenio.is.null";
}

/** "Onde parou": a etapa da licitação ou, sem ela, o grupo da suspensiva (`ondeParou`). */
function ondeParouNoBanco(f: FiltroColuna): string | null {
  if (f.tipo !== "categoria" || !f.valores.length) return null;
  const alvo = new Set(f.valores.map(normalizarTexto));
  const etapas = Object.entries(ROTULO_ETAPA_LICITACAO).filter(([, r]) => alvo.has(normalizarTexto(r))).map(([v]) => v);
  const grupos = Object.entries(ROTULO_GRUPO_SUSPENSIVA).filter(([, r]) => alvo.has(normalizarTexto(r))).map(([v]) => v);
  const partes = [
    ...(etapas.length ? [`etapa_licitacao.in.(${etapas.join(",")})`] : []),
    ...(grupos.length ? [`and(etapa_licitacao.is.null,grupo_suspensiva.in.(${grupos.join(",")}))`] : []),
  ];
  return partes.length ? partes.join(",") : "nr_convenio.is.null";
}

/** As colunas que o banco não sabe filtrar nem ordenar (calculadas na tela ou juntando várias colunas). */
const SO_NA_TELA = new Set(["a-desembolsar"]);
const SEM_ORDEM_NO_BANCO = new Set(["exigencias", "onde-parou", "a-desembolsar"]);
/** Categoria cuja lista de valores o painel não tem à mão: no banco, vira texto ("contém"). */
const TEXTO_NO_BANCO = new Set(["situacao"]);

/**
 * As colunas do painel: as mesmas da ficha, com o município (oculto) e os ajustes do banco — a calculada fica sem filtro
 * e sem ordem; a que junta colunas filtra mas não ordena; a situação das contas filtra como texto.
 */
export function colunasNoBanco(v: VisaoConvenio): ColunaTabela[] {
  return colunasDaVisao(v, { comMunicipio: true }).map((c) => ({
    ...c,
    ...(TEXTO_NO_BANCO.has(c.id) ? { tipo: "texto" as const } : {}),
    ...(SO_NA_TELA.has(c.id) ? { filtravel: false } : {}),
    ...(SEM_ORDEM_NO_BANCO.has(c.id) ? { ordenavel: false } : {}),
  }));
}

/** Cada coluna da tela no banco. `deslocamento`: os dias que a tela soma às contagens do arquivo (`contarAteHoje`). */
export function camposDoConvenio(deslocamento: number): CamposBanco {
  const idade = (coluna: string): CampoBanco => ({ coluna, ajuste: deslocamento });
  return {
    proponente: { coluna: "proponente", busca: "busca_proponente" },
    convenio: { coluna: "nr_convenio" },
    municipio: { coluna: "municipio", busca: "busca_municipio" },
    "sem-movimento": idade("dias_sem_movimentacao"),
    programa: { coluna: "programa", busca: "busca_programa" },
    orgao: { coluna: "orgao_sup" },
    objeto: { coluna: "objeto", busca: "busca_objeto" },
    prazo: { coluna: "suspensiva_prazo" },
    exigencias: { coluna: "exige_projeto", especial: exigenciasNoBanco },
    repasse: { coluna: "repasse" },
    assinatura: { coluna: "dt_assinatura" },
    "onde-parou": { coluna: "etapa_licitacao", especial: ondeParouNoBanco },
    empenhado: { coluna: "empenhado" },
    aceite: { coluna: "dt_aceite" },
    "fim-vigencia": { coluna: "dt_fim_vigencia" },
    "desembolsado-pct": { coluna: "pct_desembolsado", escala: 100 },
    extensoes: { coluna: "n_extensoes" },
    motivo: { coluna: "motivo_aditivo", valores: inverso(ROTULO_MOTIVO_ADITIVO) },
    situacao: { coluna: "situacao", busca: "busca_situacao" },
    "prazo-contas": idade("dias_apos_limite"),
    lado: { coluna: "contas_lado", valores: inverso(ROTULO_LADO_CONTAS) },
    "dias-concedente": idade("dias_com_concedente"),
    "ultimo-pagamento": { coluna: "dt_ultimo_pagamento" },
    parado: idade("dias_sem_movimento"),
    saldo: { coluna: "saldo_conta" },
    rendimento: { coluna: "rendimento_implicito" },
    "fisico-pct": { coluna: "pct_fisico", escala: 100 },
    desembolsado: { coluna: "desembolsado" },
  };
}

// ================================================================ as mudanças no painel (F3.5a, 28/10/2026)

export const TABELA_PAINEL_MUDANCAS = "painel-mudancas";

/** As colunas das mudanças no banco: as da ficha, com o município; o órgão filtra como texto (a lista não está à mão). */
export function colunasMudancasNoBanco(comData: boolean): ColunaTabela[] {
  return colunasMudancas({ comMunicipio: true, comData }).map((c) => (c.id === "orgao" ? { ...c, tipo: "texto" as const } : c));
}

/** Cada coluna das mudanças em `painel_mudancas_janela` (oport_50); o texto pelos campos sem acento. */
export const CAMPOS_MUDANCA: CamposBanco = {
  quem: { coluna: "proponente", busca: "busca_proponente" },
  mudanca: { coluna: "tipo", valores: Object.fromEntries(TIPOS_MUDANCA.map((d) => [d.rotulo, d.tipo])) },
  programa: { coluna: "programa", busca: "busca_programa" },
  valor: { coluna: "valor" },
  dia: { coluna: "dado_ate", fimDoDia: true },
  numero: { coluna: "numero" },
  alvo: { coluna: "alvo", valores: { Convênio: "convenio", Proposta: "proposta" } },
  municipio: { coluna: "municipio", busca: "busca_municipio" },
  orgao: { coluna: "orgao_sup", curinga: true },
  objeto: { coluna: "objeto", busca: "busca_objeto" },
};

/** A ordem da v1: o dado mais recente, o maior valor, o tipo e a chave (total: uma mudança por tipo e chave no dia). */
export const ORDEM_MUDANCAS = [
  { coluna: "dado_ate", ascendente: false },
  { coluna: "valor", ascendente: false, nulosPrimeiro: false },
  { coluna: "tipo", ascendente: true },
  { coluna: "chave", ascendente: true },
] as const;

/** As opções das categorias das mudanças: os tipos na ordem de leitura e os dois alvos. */
export const OPCOES_MUDANCA: Record<string, { valor: string; linhas: number | null }[]> = {
  mudanca: TIPOS_MUDANCA.map((d) => ({ valor: d.rotulo, linhas: null })),
  alvo: [
    { valor: "Convênio", linhas: null },
    { valor: "Proposta", linhas: null },
  ],
};

/** As opções das categorias que o painel conhece sem ler o banco (o órgão vem do quadro por órgão da própria visão). */
export function opcoesFixas(v: VisaoConvenio): Record<string, { valor: string; linhas: number | null }[]> {
  const de = (m: Readonly<Record<string, string>>) => [...new Set(Object.values(m))].map((valor) => ({ valor, linhas: null }));
  if (v === "nunca") return { "onde-parou": de({ ...ROTULO_ETAPA_LICITACAO, ...ROTULO_GRUPO_SUSPENSIVA }) };
  if (v === "vigencia") return { motivo: de(ROTULO_MOTIVO_ADITIVO) };
  if (v === "contas") return { lado: de(ROTULO_LADO_CONTAS) };
  return {};
}

/** A visão do painel é uma das seis de convênio (as outras visões não têm estas tabelas). */
export const ehVisaoConvenioDaTabela = (v: string): v is VisaoConvenio => (VISOES_CONVENIO as readonly string[]).includes(v);

/** O estado das tabelas da visão, lido do endereço (a página e a rota de exportação leem igual). */
export function estadosDaVisao(v: string, parametros: URLSearchParams): { lista?: EstadoTabela; vencidos?: EstadoTabela } {
  if (v === "municipios") return { lista: lerEstado(TABELA_PAINEL_MUNICIPIOS, COLUNAS_MUNICIPIOS, parametros) };
  // O dia do dado só aparece em períodos de mais de um dia; lido sempre, a leitura o solta no último dado.
  if (v === "mudancas") return { lista: lerEstado(TABELA_PAINEL_MUDANCAS, colunasMudancasNoBanco(true), parametros) };
  if (!ehVisaoConvenioDaTabela(v)) return {};
  const colunas = colunasNoBanco(v);
  return {
    lista: lerEstado(TABELA_PAINEL[v], colunas, parametros),
    ...(v === "suspensiva" ? { vencidos: lerEstado(TABELA_PAINEL_VENCIDOS, colunas, parametros) } : {}),
  };
}

/** O endereço do CSV de uma tabela do painel: a exportação da visão com o estado da tabela e o id dela. */
export function urlCsvDaTabela(urlExportacao: string, tabela: string, estado: EstadoTabela): string {
  const [caminho, consulta = ""] = urlExportacao.split("?");
  const q = gravarEstado(tabela, estado, new URLSearchParams(consulta));
  q.set("tabela", tabela);
  return `${caminho}?${q.toString()}`;
}

/** Os parâmetros da página (o `searchParams` do Next) como `URLSearchParams`, com as chaves repetidas. */
export function parametrosDaPagina(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, x);
  return q;
}

// ================================================================ os municípios com sinais (F3.3, 22/10/2026)

export const TABELA_PAINEL_MUNICIPIOS = "painel-municipios";

export const COLUNAS_MUNICIPIOS: ColunaTabela[] = [
  { id: "municipio", titulo: "Município", tipo: "texto" },
  { id: "sinais", titulo: "Sinais", tipo: "numero", alinhar: "direita" },
  { id: "saldo", titulo: "Saldo parado", tipo: "numero", alinhar: "direita" },
  { id: "suspensivas", titulo: "Suspensivas vencendo", tipo: "numero", alinhar: "direita" },
  { id: "contas-atrasadas", titulo: "Contas atrasadas", tipo: "numero", alinhar: "direita" },
  { id: "contas-negativas", titulo: "Contas negativas", tipo: "numero", alinhar: "direita" },
  { id: "sem-desembolso", titulo: "Sem desembolso", tipo: "numero", alinhar: "direita" },
  { id: "ibge", titulo: "IBGE", tipo: "texto", textoNoCsv: true, oculta: true },
  { id: "uf", titulo: "UF", tipo: "categoria", oculta: true },
  { id: "quais", titulo: "Sinais acesos", tipo: "texto", ordenavel: false, oculta: true },
  { id: "valor-sem-desembolso", titulo: "Valor sem desembolso", tipo: "numero", alinhar: "direita", oculta: true },
];

export function valoresDoMunicipioPainel(m: MunicipioPainel): Record<string, ValorCelula> {
  const quais = SINAIS.filter((s) => m[`sinal_${s}`]).map((s) => ROTULO_SINAL[s]);
  return {
    municipio: m.municipio,
    sinais: m.n_sinais,
    saldo: m.n_saldo ? m.valor_saldo : null,
    suspensivas: m.n_suspensiva || null,
    "contas-atrasadas": m.n_contas_atrasadas || null,
    "contas-negativas": m.n_contas_negativas || null,
    "sem-desembolso": m.n_sem_desembolso || null,
    ibge: m.cod_ibge,
    uf: m.uf,
    quais: quais.length ? quais.join(" · ") : null,
    "valor-sem-desembolso": m.n_sem_desembolso ? m.valor_sem_desembolso : null,
  };
}

/** Os sinais que um texto acha (todas as palavras no rótulo); nenhum: nada passa. */
function sinaisNoBanco(f: FiltroColuna): string | null {
  if (f.tipo !== "texto") return null;
  const palavras = normalizarTexto(f.contem).split(" ").filter(Boolean);
  if (!palavras.length) return null;
  const achados = SINAIS.filter((s) => palavras.every((p) => normalizarTexto(ROTULO_SINAL[s]).includes(p)));
  return achados.length ? achados.map((s) => `sinal_${s}.eq.true`).join(",") : "cod_ibge.is.null";
}

export const CAMPOS_MUNICIPIO: CamposBanco = {
  municipio: { coluna: "municipio", curinga: true },
  sinais: { coluna: "n_sinais" },
  saldo: { coluna: "valor_saldo" },
  suspensivas: { coluna: "n_suspensiva" },
  "contas-atrasadas": { coluna: "n_contas_atrasadas" },
  "contas-negativas": { coluna: "n_contas_negativas" },
  "sem-desembolso": { coluna: "n_sem_desembolso" },
  ibge: { coluna: "cod_ibge" },
  uf: { coluna: "uf" },
  quais: { coluna: "n_sinais", especial: sinaisNoBanco },
  "valor-sem-desembolso": { coluna: "valor_sem_desembolso" },
};

/** A ordem da lista: mais sinais, depois o saldo parado e o valor sem desembolso; o IBGE desempata. */
export const ORDEM_MUNICIPIOS = [
  { coluna: "n_sinais", ascendente: false },
  { coluna: "valor_saldo", ascendente: false },
  { coluna: "valor_sem_desembolso", ascendente: false },
  { coluna: "cod_ibge", ascendente: true },
] as const;

// ============================================================================ F3.4: tempos e aprovação

/**
 * As tabelas de tempos e de aprovação (onda 15, fase 3, F3.4, 22/10/2026). Eram cortadas pelo banco (os 40 programas
 * com mais assinaturas; os 50 com mais propostas enviadas) e a tela não filtrava. São tabelas pequenas — no Brasil,
 * cerca de mil programas, 4 mil linhas de etapa —, então a página lê todas e o filtro roda nas linhas lidas, como na
 * ficha do município: a mediana sai do pivô das etapas, que o banco não tem pronto.
 */
export const TABELA_TEMPOS_PROGRAMAS = "tempos-programas";
export const TABELA_DESFECHOS_PROGRAMAS = "desfechos-programas";

/** O id da coluna de uma etapa: o nome com hífen ("envio_aprovacao" → "envio-aprovacao"), que cabe no endereço. */
export const idEtapa = (etapa: string) => etapa.replace(/_/g, "-");

/**
 * As colunas da matriz de tempos. As etapas mudam com o período (sem a "vez do concedente" por ano), os ids não. Por
 * programa, o código e o órgão vão ocultos (filtram e vão ao CSV); com um órgão escolhido no filtro, o órgão sai.
 */
export function colunasDosTempos(etapas: readonly string[], ano: number | null, dimensao: DimensaoTempo, comOrgao = true): ColunaTabela[] {
  const primeiras: ColunaTabela[] =
    dimensao === "programa"
      ? [
          { id: "programa", titulo: "Programa", tipo: "texto" },
          { id: "codigo", titulo: "Código do programa", tipo: "texto", textoNoCsv: true, oculta: true },
          ...(comOrgao ? [{ id: "orgao", titulo: "Órgão", tipo: "categoria", oculta: true } satisfies ColunaTabela] : []),
        ]
      : [{ id: "orgao", titulo: "Órgão", tipo: "texto" }];
  return [
    ...primeiras,
    ...etapas.map((e): ColunaTabela => ({ id: idEtapa(e), titulo: ROTULO_ETAPA[e] ?? e, tipo: "numero", alinhar: "direita" })),
    { id: "lentas", titulo: "Etapas marcadas “lento”", tipo: "numero", oculta: true },
    { id: "assinadas", titulo: ano !== null ? `Assinadas em ${ano}` : "Assinadas em 36 meses", tipo: "numero", alinhar: "direita" },
    ...(ano !== null ? [] : [{ id: "sem-desfecho", titulo: "Propostas sem desfecho", tipo: "numero", alinhar: "direita" } satisfies ColunaTabela]),
  ];
}

/**
 * Os valores crus de uma linha da matriz: a mediana arredondada como na célula, vazia ("—") com menos medições que o
 * mínimo; e as etapas "lentas" (1,5 vez a mediana do recorte inteiro), que a tela marca.
 */
export function valoresDosTempos(
  l: LinhaMatriz,
  etapas: readonly string[],
  todos: Partial<Record<string, LinhaEtapa>>,
  porAno: boolean,
  dimensao: DimensaoTempo,
): { valores: Record<string, ValorCelula>; lentas: Set<string> } {
  const valores: Record<string, ValorCelula> =
    dimensao === "programa" ? { programa: l.rotulo, codigo: l.chave, orgao: l.orgao_sup } : { orgao: l.rotulo };
  const lentas = new Set<string>();
  for (const e of etapas) {
    const m = medianaComparavel(l.etapas[e]);
    if (maisLento(m, medianaComparavel(todos[e]))) lentas.add(e);
    valores[idEtapa(e)] = m === null ? null : Math.round(m);
  }
  valores.lentas = lentas.size;
  valores.assinadas = l.volume;
  if (!porAno) valores["sem-desfecho"] = l.etapas.envio_assinatura?.em_aberto ?? 0;
  return { valores, lentas };
}

/**
 * As colunas dos desfechos por órgão ou por programa: a porcentagem das enviadas na coluna visível, a quantidade e o
 * lote em colunas ocultas. Por programa, o código e o órgão ocultos e o valor pedido.
 */
export function colunasDosDesfechos(dimensao: DimensaoTempo, comOrgao = true): ColunaTabela[] {
  const primeiras: ColunaTabela[] =
    dimensao === "programa"
      ? [
          { id: "programa", titulo: "Programa", tipo: "texto" },
          { id: "codigo", titulo: "Código do programa", tipo: "texto", textoNoCsv: true, oculta: true },
          ...(comOrgao ? [{ id: "orgao", titulo: "Órgão", tipo: "categoria", oculta: true } satisfies ColunaTabela] : []),
        ]
      : [{ id: "orgao", titulo: "Órgão", tipo: "texto" }];
  return [
    ...primeiras,
    { id: "enviadas", titulo: "Enviadas", tipo: "numero", alinhar: "direita" },
    { id: "assinadas", titulo: "Assinadas (%)", tipo: "numero", alinhar: "direita" },
    { id: "assinadas-n", titulo: "Assinadas (quantidade)", tipo: "numero", oculta: true },
    { id: "reprovadas", titulo: "Reprovadas (%)", tipo: "numero", alinhar: "direita" },
    { id: "reprovadas-n", titulo: "Reprovadas (quantidade)", tipo: "numero", oculta: true },
    { id: "reprovadas-lote", titulo: "Reprovadas em lote", tipo: "numero", oculta: true },
    { id: "impedimento", titulo: "Impedimento (%)", tipo: "numero", alinhar: "direita" },
    { id: "impedimento-n", titulo: "Impedimento (quantidade)", tipo: "numero", oculta: true },
    { id: "impedimento-lote", titulo: "Impedimento em lote", tipo: "numero", oculta: true },
    { id: "sem-desfecho", titulo: "Sem desfecho (%)", tipo: "numero", alinhar: "direita" },
    { id: "sem-desfecho-n", titulo: "Sem desfecho (quantidade)", tipo: "numero", oculta: true },
    ...(dimensao === "programa" ? [{ id: "pedido", titulo: "Pedido", tipo: "numero", alinhar: "direita" } satisfies ColunaTabela] : []),
  ];
}

/** Fração das enviadas em percentual de 0 a 100, com uma casa: "de 50" no filtro é 50%. Sem enviadas, vazio. */
export function percentualDasEnviadas(parte: number, d: LinhaDesfecho): number | null {
  const f = fracao(parte, d.enviadas);
  return f === null ? null : Math.round(f * 1000) / 10;
}

export function valoresDoDesfecho(d: LinhaDesfecho, dimensao: DimensaoTempo): Record<string, ValorCelula> {
  const sem = semDesfecho(d);
  return {
    ...(dimensao === "programa" ? { programa: d.programa, codigo: d.cod_programa, orgao: d.orgao_sup } : { orgao: d.orgao_sup }),
    enviadas: d.enviadas,
    assinadas: percentualDasEnviadas(d.assinadas, d),
    "assinadas-n": d.assinadas,
    reprovadas: percentualDasEnviadas(d.reprovadas, d),
    "reprovadas-n": d.reprovadas,
    "reprovadas-lote": d.reprovadas_lote,
    impedimento: percentualDasEnviadas(d.impedimento, d),
    "impedimento-n": d.impedimento,
    "impedimento-lote": d.impedimento_lote,
    "sem-desfecho": percentualDasEnviadas(sem, d),
    "sem-desfecho-n": sem,
    ...(dimensao === "programa" ? { pedido: d.valor_pedido } : {}),
  };
}
