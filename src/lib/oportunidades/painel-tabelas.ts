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
  ROTULO_DESFECHO,
  ROTULO_ETAPA_LICITACAO,
  ROTULO_EXIGENCIA,
  ROTULO_GRUPO_SUSPENSIVA,
  ROTULO_LADO_CONTAS,
  ROTULO_MOTIVO_ADITIVO,
  definicaoMudanca,
  exigenciasDe,
  type LadoContas,
  type MudancaPainel,
  type PropostaPainel,
} from "./painel.ts";
import type { ConvenioPainel } from "./painel.server.ts";
import type { ColunaTabela, ValorCelula } from "./tabela-filtro.ts";

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
