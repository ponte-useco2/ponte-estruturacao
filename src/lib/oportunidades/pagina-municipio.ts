/**
 * A página do município em abas (F1 da revisão da navegação, decisões de 06/10/2026): um endereço,
 * `/mapa/municipio/[ibge]`, no lugar das telas espalhadas (ficha do painel, investimentos, relatório, fiscal,
 * TCE-PB). O que cada nível de acesso vê segue a decisão D1:
 *   0 público · 1 cadastrado (aprovado) · 2 cliente (o próprio município) · 3 administrador.
 * Na F1a a página continua atrás do portão de aprovados, então o nível mínimo de quem chega é 1; o público
 * entra na F1d. Função pura, sem banco.
 *
 * C4a (09/10/2026): o nível 0 passou a existir como caminho de código, atrás da chave `MAPA_PUBLICO` (desligada por
 * padrão; ver `publico.ts`). Aqui moram as regras dele que valem para mais de uma página: o nível onde não há cliente
 * (Brasil e UF), quem abre o relatório do município e o recorte do relatório para o público (`relatorioDoPublico`).
 */
import { FALTAS_DA_FONTE, FONTES_DO_PUBLICO, FONTES_RELATORIO, type Achado, type Dimensao, type Relatorio } from "./relatorio-municipio.ts";

export type NivelAcesso = 0 | 1 | 2 | 3;

export type AbaMunicipio = "trava" | "resumo" | "dinheiro" | "contas" | "controle" | "indicadores" | "relatorio";

/**
 * O nome das abas que se repetem nos 4 níveis do território — Brasil, UF, município e entidade (B11, 08/10/2026;
 * achado H08 da auditoria B1+B2). A mesma coisa tinha dois nomes: "Dinheiro federal" no município e "Dinheiro" nos
 * outros três. Fica "Dinheiro federal" em todos: é o que a aba mostra em qualquer nível (convênios, emendas, Pix,
 * fundo a fundo e o dinheiro federal nas despesas do TCE-PB), e no município ela fica ao lado de "Contas públicas",
 * que é o dinheiro do próprio município. As listas dos outros níveis (`ABAS_UF`, `ABAS_BRASIL`, `ABAS_ENTIDADE`) leem
 * o nome daqui, para não voltarem a divergir.
 */
export const NOME_ABA = {
  trava: "O que trava e o que destrava",
  resumo: "Resumo",
  dinheiro: "Dinheiro federal",
  controle: "Controle",
  relatorio: "Relatório e dados",
} as const;

/**
 * A ordem das abas em qualquer nível (B11): as comuns sempre na mesma posição relativa — a fila, o resumo, o dinheiro,
 * o controle e, por último, o relatório — e as próprias de cada nível entre elas (as unidades de baixo logo depois do
 * resumo; contas, indicadores e tempos depois do dinheiro). O teste confere as quatro listas contra esta.
 */
export const ORDEM_DAS_ABAS: readonly string[] = [
  "trava",
  "resumo",
  "estados",
  "municipios",
  "estado",
  "instrumentos",
  "dinheiro",
  "contas",
  "controle",
  "indicadores",
  "tempos",
  "relatorio",
];

export const ABAS_MUNICIPIO: readonly { id: AbaMunicipio; nome: string; minimo: NivelAcesso }[] = [
  { id: "trava", nome: NOME_ABA.trava, minimo: 1 },
  { id: "resumo", nome: NOME_ABA.resumo, minimo: 0 },
  { id: "dinheiro", nome: NOME_ABA.dinheiro, minimo: 0 },
  { id: "contas", nome: "Contas públicas", minimo: 1 },
  { id: "controle", nome: NOME_ABA.controle, minimo: 1 },
  { id: "indicadores", nome: "Indicadores", minimo: 0 },
  { id: "relatorio", nome: NOME_ABA.relatorio, minimo: 1 },
];

export function nivelDeAcesso(v: { aprovado: boolean; administrador: boolean; clienteDoMunicipio: boolean }): NivelAcesso {
  if (!v.aprovado) return 0;
  if (v.administrador) return 3;
  return v.clienteDoMunicipio ? 2 : 1;
}

/**
 * O nível onde não existe cliente, o Brasil e a UF (C4a, 09/10/2026; achado B1 da revisão R3): a mesma regra de
 * `nivelDeAcesso`, sem o 2. Antes, Brasil e UF davam 1 a todo não administrador (`administrador ? 3 : 1`), o que só
 * estava certo porque o portão de aprovados vinha antes; sem cadastro aprovado, agora é 0.
 */
export function nivelSemCliente(v: { aprovado: boolean; administrador: boolean }): NivelAcesso {
  return nivelDeAcesso({ ...v, clienteDoMunicipio: false });
}

/**
 * Se o nível abre a aba (D1). O relatório para imprimir (`/mapa/municipio/[ibge]/relatorio`) segue a aba "Relatório e
 * dados", como o da entidade (`podeAbaEntidade`) e o da UF (`podeRelatorioUf`): C4a, achado B1 da R3 — a rota do
 * relatório do município não conferia nível nenhum, só o portão de aprovados.
 */
export function podeAbaMunicipio(aba: AbaMunicipio, nivel: NivelAcesso): boolean {
  const a = ABAS_MUNICIPIO.find((x) => x.id === aba);
  return a !== undefined && nivel >= a.minimo;
}

/** A aba que abre: a pedida, se existe e o nível alcança; senão a de entrada (o que trava, ou o resumo para o público). */
export function abaEscolhida(pedida: string | string[] | undefined, nivel: NivelAcesso): AbaMunicipio {
  const p = Array.isArray(pedida) ? pedida[0] : pedida;
  const aba = ABAS_MUNICIPIO.find((a) => a.id === p);
  if (aba && nivel >= aba.minimo) return aba.id;
  return nivel >= 1 ? "trava" : "resumo";
}

export function urlMunicipio(ibge: string, aba?: AbaMunicipio): string {
  return `/mapa/municipio/${encodeURIComponent(ibge)}${aba && aba !== "trava" ? `?aba=${aba}` : ""}`;
}

/** O que cada nível alcança dentro das abas. */
export const PODE = {
  /**
   * O que a D1 põe atrás do cadastro, dentro das abas abertas ao público (C4a, 09/10/2026; achados B2, B3 e C5 da R3):
   * o fiscal, o controle, o TCE-PB, os fornecedores (mesmo somados), o Pix, os pontos "a conferir", o botão de imprimir
   * e a estrela de seguir.
   */
  cadastro: (n: NivelAcesso) => n >= 1,
  /** O laudo do convênio: o cliente vê o dos instrumentos do próprio município; o cadastrado vai à página do instrumento. */
  laudo: (n: NivelAcesso) => n >= 2,
  simulador: (n: NivelAcesso) => n >= 2,
  /** Fornecedor com nome, processos nominais e os painéis dos 223. */
  interno: (n: NivelAcesso) => n >= 3,
};

/** "/mapa/instrumento/942082/laudo" para quem pode o laudo; "/mapa/instrumento/942082" para os outros. */
export function destinoConvenio(nivel: NivelAcesso): (nr: string) => string {
  return PODE.laudo(nivel) ? (nr) => `/mapa/instrumento/${nr}/laudo` : (nr) => `/mapa/instrumento/${nr}`;
}

// ================================================================ o recorte do público (C4a)

/**
 * Os cartões do "Em números" que o público vê: só o dinheiro em execução. Pessoal/RCL e CAUC são o fiscal; as tomadas
 * de contas especiais do TCU, o controle (achado B2 da R3). Lista branca: cartão novo nasce fora do nível 0.
 */
export const CARTOES_DO_PUBLICO: readonly string[] = ["Convênios em execução"];

/**
 * As dimensões de achado que o público vê: só as da camada 2, os indicadores comparados com a PB, que moram na aba
 * "Indicadores" (aberta pela D1). Fiscal, controle, TCE-PB, fornecedores, Pix, convênios e propostas são análise — o
 * que trava, o que está "a conferir", o que está em ordem —, e a análise é do cadastro. Lista branca, como os cartões.
 */
export const DIMENSOES_DO_PUBLICO: readonly Dimensao[] = ["social", "economia", "territorio", "governanca"];

/**
 * Os nomes de falta das fontes que a leitura do nível 0 não lê: não chegam ao público. Calculado na primeira chamada,
 * e não no carregamento: `relatorio-municipio` → `busca` → este módulo → `relatorio-municipio` é um ciclo, e no
 * carregamento as listas de lá ainda não existem.
 */
let faltasForaDoPublico: Set<string> | null = null;
function faltaForaDoPublico(f: string): boolean {
  faltasForaDoPublico ??= new Set(FONTES_RELATORIO.filter((x) => !FONTES_DO_PUBLICO.includes(x)).flatMap((x) => FALTAS_DA_FONTE[x]));
  return faltasForaDoPublico.has(f);
}

/**
 * O relatório do município (ou da entidade) recortado para o nível 0 (C4a, 09/10/2026; achados B2 e B3 da R3). Recorta
 * o dado, e não só a tela: o que sai daqui nenhum bloco desenha, nem um bloco novo que alguém ponha numa aba aberta.
 *   - os cartões e os achados (inclusive o "O que está em ordem", os destaques e os passos) ficam nas listas brancas;
 *   - saem as seções do fiscal, do controle, do Pix, do TCE-PB e dos fornecedores;
 *   - dos convênios, ficam a tabela por situação e a lista dos em execução (a situação dos instrumentos, que a D1
 *     abre); saem as listas de análise (vigência vencida, sem movimento, prestação de contas pendente, liminar, nunca
 *     assinados e os pontos da PC 33).
 * O resto (indicadores, emendas, propostas por desfecho, janelas) segue como está para o cadastrado. Aplicar
 * depois de `relatorioSemNomes`: o recorte não devolve nome nenhum, mas também não tira.
 *
 * Onda 7 (09/10/2026, sugestão do A): saem também os destaques ("Em uma página") e as fontes (aba "Relatório e dados"),
 * que o nível 0 não desenha, e as faltas das fontes que a leitura pública nem lê (`FONTES_DO_PUBLICO`). Com isso o
 * recorte da leitura completa é idêntico ao da leitura leve, e "o painel fiscal falhou" não chega ao público no objeto.
 */
export function relatorioDoPublico(r: Relatorio): Relatorio {
  const aberto = (a: Achado) => DIMENSOES_DO_PUBLICO.includes(a.dimensao);
  return {
    ...r,
    cartoes: r.cartoes.filter((c) => CARTOES_DO_PUBLICO.includes(c.rotulo)),
    achados: r.achados.filter(aberto),
    destaques: [],
    emDia: r.emDia.filter(aberto),
    passos: [],
    fontes: [],
    faltas: r.faltas.filter((f) => !faltaForaDoPublico(f)),
    fiscal: null,
    controle: null,
    pix: null,
    tcePb: null,
    fornecedores: null,
    convenios: r.convenios && {
      ...r.convenios,
      vigenciaVencida: [],
      semMovimento: [],
      contasAtrasadas: [],
      contasNegativas: [],
      nuncaAssinados: [],
      nuncaAssinadosVencidos: 0,
      liminar: [],
      pc33: [],
    },
  };
}

/** O relatório que o nível vê: o inteiro só no 1 em diante; o 0 recebe o recorte do público. */
export function relatorioDoNivel(r: Relatorio, nivel: NivelAcesso): Relatorio {
  return PODE.cadastro(nivel) ? r : relatorioDoPublico(r);
}
