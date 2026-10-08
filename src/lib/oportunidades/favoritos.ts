/**
 * Itens seguidos e avisos sobre eles (onda 7) — puro: sem banco, rede nem relógio.
 *
 * A comparação que gera os avisos mora no banco (`oport_gerar_avisos_*`, oport_15).
 * Aqui ficam o que a tela e as ações precisam: validar a chave antes de gravar,
 * montar as janelas abertas que a geração recebe e transformar o aviso gravado
 * (campo, antes, depois) numa frase.
 */
import { formatarData } from "./central.ts";
import { ehAberta, type PayloadV2 } from "./contrato-v2.ts";
import { ROTULO_DESFECHO, percentual } from "./painel.ts";
import { moedaCurta } from "./radar.ts";

export type TipoItem = "janela" | "instrumento" | "proposta" | "municipio" | "entidade";

export const TIPOS_ITEM: readonly TipoItem[] = ["janela", "instrumento", "proposta", "municipio", "entidade"];

/** O mesmo teto da oport_15 (`oport_favorito_limite`). */
export const LIMITE_SEGUIDOS = 300;

/** As mesmas regras da tabela: a ação recusa antes de ir ao banco. */
export function chaveValida(tipo: unknown, chave: unknown): tipo is TipoItem {
  if (typeof chave !== "string") return false;
  if (tipo === "janela") return /^[A-Za-z0-9._-]{1,160}$/.test(chave);
  if (tipo === "instrumento") return /^[0-9A-Za-z]{1,20}$/.test(chave);
  if (tipo === "proposta") return /^[0-9]{1,12}$/.test(chave);
  if (tipo === "municipio") return /^[0-9]{7}$/.test(chave);
  // o CNPJ como a base guarda (oport_31): 14 posições, alfanumérico aceito
  if (tipo === "entidade") return /^[0-9A-Z]{12}[0-9]{2}$/.test(chave);
  return false;
}

export const chaveSeguida = (tipo: TipoItem, chave: string) => `${tipo}:${chave}`;

export const ROTULO_TIPO_ITEM: Record<TipoItem, string> = {
  janela: "Janela",
  instrumento: "Convênio",
  proposta: "Proposta",
  municipio: "Município",
  entidade: "Entidade",
};

/** Como as frases chamam o item: "Você deixou de seguir a janela X." */
export const ARTIGO_TIPO_ITEM: Record<TipoItem, string> = {
  janela: "a janela",
  instrumento: "o convênio",
  proposta: "a proposta",
  municipio: "o município",
  entidade: "a entidade",
};

/** Nome longo (o título da janela, o objeto da proposta) vai encurtado para caber no botão e no aviso. */
const LIMITE_NOME = 100;

function encurtar(t: string): string {
  const s = t.trim().replace(/\s+/g, " ");
  if (s.length <= LIMITE_NOME) return s;
  const corte = s.slice(0, LIMITE_NOME - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > LIMITE_NOME * 0.6 ? corte.slice(0, espaco) : corte).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/**
 * O item seguido nas frases da estrela: "o convênio nº 956541", "a janela Edital…". O convênio vai pelo número,
 * porque o título dele é o objeto. O título de reserva das telas ("Janela abc", quando o banco não tem título)
 * não se repete: vira "a janela abc".
 */
export function nomeDoItemSeguido(tipo: TipoItem, chave: string, titulo: string | null): string {
  if (tipo === "instrumento") return `${ARTIGO_TIPO_ITEM.instrumento} nº ${chave}`;
  const proprio = titulo?.trim() && titulo.trim() !== `${ROTULO_TIPO_ITEM[tipo]} ${chave}` ? titulo : null;
  return `${ARTIGO_TIPO_ITEM[tipo]} ${proprio ? encurtar(proprio) : chave}`;
}

/** O artigo e o tipo na frente, uma vez só: as telas mandam "a janela X" (o costume da onda 7) ou só "X". */
function comArtigo(tipo: TipoItem, nome: string): string {
  const n = nome.trim().replace(/\.$/, "");
  const artigo = ARTIGO_TIPO_ITEM[tipo];
  return n === artigo || n.startsWith(`${artigo} `) ? n : `${artigo} ${n}`;
}

/** Os textos da estrela num estado. Tudo diz QUAL item: no teste de 08/10/2026 a estrela sem nome levou ao item errado. */
export interface RotuloEstrela {
  /** A marca, que não depende de cor: ☆ vazia, ★ cheia. Vai com aria-hidden. */
  icone: "☆" | "★";
  /** O texto à vista ao lado da marca: "Seguir" ou "Seguindo". */
  visivel: string;
  /** O item com artigo, uma vez só: "a janela X". No botão vai em texto oculto, depois do texto à vista. */
  item: string;
  /**
   * O nome acessível: o texto à vista e o item ("Seguindo a janela X"). Começa pelo que se vê, para quem comanda
   * por voz (WCAG 2.5.3); o estado vai em aria-pressed.
   */
  nomeAcessivel: string;
  /** O que o clique faz, com o item: "Seguir a janela X" / "Deixar de seguir a janela X". É o title (a dica). */
  acao: string;
  /** O aviso depois de chegar a este estado pela estrela. */
  confirmacao: string;
  /** O que o "Desfazer" faz a partir deste estado, para o leitor de tela: "voltar a seguir a janela X". */
  desfazer: string;
  /** O aviso depois de chegar a este estado pelo "Desfazer". */
  desfeito: string;
}

export function rotuloEstrela(tipo: TipoItem, nome: string, seguindo: boolean): RotuloEstrela {
  const item = comArtigo(tipo, nome);
  return seguindo
    ? {
        icone: "★",
        visivel: "Seguindo",
        item,
        nomeAcessivel: `Seguindo ${item}`,
        acao: `Deixar de seguir ${item}`,
        confirmacao: `Agora você segue ${item}.`,
        desfazer: `deixar de seguir ${item}`,
        desfeito: `Você voltou a seguir ${item}.`,
      }
    : {
        icone: "☆",
        visivel: "Seguir",
        item,
        nomeAcessivel: `Seguir ${item}`,
        acao: `Seguir ${item}`,
        confirmacao: `Você deixou de seguir ${item}.`,
        desfazer: `voltar a seguir ${item}`,
        desfeito: `Você deixou de seguir ${item}.`,
      };
}

/**
 * Onde o item abre. O município abre a página com abas para todo aprovado (F1, 06/10/2026): o que cada um vê
 * lá dentro depende do nível de acesso, e o relatório completo é uma das abas. A janela não tem página própria:
 * o cartão no catálogo tem âncora, e só a aberta tem cartão (`situacaoDaJanela`).
 */
export function urlDoItem(tipo: TipoItem, chave: string): string {
  if (tipo === "instrumento") return `/mapa/instrumento/${encodeURIComponent(chave)}`;
  if (tipo === "proposta") return `/mapa/proposta/${encodeURIComponent(chave)}`;
  // A página com abas só existe para a PB (`^25\d{5}$`); fora dela, a estrela vem dos investimentos, que aceitam
  // qualquer UF, e o link para a página com abas dava 404 na carteira e em Meus itens (inventário B0, 08/10/2026).
  if (tipo === "municipio") {
    return /^25\d{5}$/.test(chave) ? `/mapa/municipio/${chave}` : `/mapa/municipio/${encodeURIComponent(chave)}/investimentos`;
  }
  if (tipo === "entidade") return `/mapa/entidade/${encodeURIComponent(chave)}`;
  return `/mapa#janela-${chave}`;
}

/** As frases de abrir e fechar da janela: `fraseDoAviso` as escreve e `situacaoDaJanela` as lê. */
export const FRASE_JANELA_FECHOU = "A janela fechou";
export const FRASE_JANELA_REABRIU = "A janela abriu de novo";

export type SituacaoJanela = "aberta" | "fechada" | "incerta";

/**
 * Se o nome da janela seguida pode virar link. A janela não tem página própria: `urlDoItem` aponta para a âncora
 * do cartão no catálogo, e o catálogo só lista as abertas. Fechada, o link caía no topo do catálogo, onde a estrela
 * à mão era a de outra janela (teste de 08/10/2026). Só "aberta" vira link.
 *
 * `rotulos`: as frases dos avisos da janela (`fraseDoAviso`), da mais nova para a mais velha; o último
 * "fechou"/"abriu de novo" decide. `retrato`: o que o último retrato comparado diz, quando a tela o tem —
 * true = aberta com prazo de hoje em diante; false = não (fechada, sem prazo ou prazo vencido desde a última
 * rodada), e aí, sem aviso de que fechou, não dá para dizer qual: "incerta". Sem retrato (Meus itens), a janela
 * conta como aberta até chegar o aviso de que fechou: só se segue janela que está no catálogo.
 */
export function situacaoDaJanela(rotulos: readonly string[], retrato?: boolean): SituacaoJanela {
  if (retrato === true) return "aberta";
  const sinal = rotulos.find((r) => r === FRASE_JANELA_FECHOU || r === FRASE_JANELA_REABRIU);
  if (sinal === FRASE_JANELA_FECHOU) return "fechada";
  return retrato === false ? "incerta" : "aberta";
}

export interface ItemSeguido {
  tipo: TipoItem;
  chave: string;
  titulo: string | null;
  criado_em: string;
  /** Retrato ausente do painel: o item saiu do recorte da busca. */
  ausente: boolean;
}

export interface AvisoItem {
  id: string;
  tipo: TipoItem;
  chave: string;
  evento: string;
  titulo: string | null;
  antes: string | null;
  depois: string | null;
  criado_em: string;
  lida_em: string | null;
  arquivada_em: string | null;
}

/**
 * As janelas abertas hoje, no formato que `oport_gerar_avisos_janelas` recebe.
 * Mesma regra de "aberta" do catálogo (`ehAberta`): a que venceu hoje já não conta.
 */
export function abertasParaAvisos(payload: PayloadV2, hojeIso: string): Record<string, { titulo: string; prazo: string | null }> {
  const abertas: Record<string, { titulo: string; prazo: string | null }> = {};
  for (const o of payload.opportunities) {
    if (!ehAberta(o, hojeIso)) continue;
    const prazo = o.dates.deadline && /^\d{4}-\d{2}-\d{2}/.test(o.dates.deadline) ? o.dates.deadline.slice(0, 10) : null;
    abertas[o.id] = { titulo: o.title.slice(0, 300), prazo };
  }
  return abertas;
}

/** O retrato de uma janela na hora de seguir: é o que a primeira comparação usa. */
export function retratoDaJanela(payload: PayloadV2, id: string, hojeIso: string): { titulo: string; estado: { aberta: boolean; prazo: string | null } } | null {
  const o = payload.opportunities.find((x) => x.id === id);
  if (!o) return null;
  const prazo = o.dates.deadline && /^\d{4}-\d{2}-\d{2}/.test(o.dates.deadline) ? o.dates.deadline.slice(0, 10) : null;
  return { titulo: o.title.slice(0, 300), estado: { aberta: ehAberta(o, hojeIso), prazo } };
}

const numero = (t: string | null) => (t === null || t === "" || Number.isNaN(Number(t)) ? null : Number(t));
const data = (t: string | null) => (t ? formatarData(t) : "sem data");
const texto = (t: string | null) => t ?? "não informada";

export interface FraseAviso {
  /** O que aconteceu, curto. */
  rotulo: string;
  /** Antes e depois, ou o contexto. */
  detalhe: string;
}

/** As três decisões do painel fiscal, como o relatório do município as nomeia. */
const DECISAO_FISCAL: Record<string, string> = {
  fiscal_a: "declarações fiscais em dia",
  fiscal_b: "receber transferência voluntária",
  fiscal_c: "contratar operação de crédito",
};

const ROTULO_ESTADO_FISCAL: Record<string, string> = {
  atendido: "atendido",
  nao_atendido: "não atendido",
  atencao: "atenção",
  nao_verificavel: "não verificável",
  desatualizado: "desatualizado",
};

function contagem(antes: string | null, depois: string | null): string {
  return `${antes ?? "0"} → ${depois ?? "0"}`;
}

function pct(v: number | null): string {
  return v === null ? "sem dado" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * O aviso em palavras. Campo desconhecido (a tabela aceita campo novo antes da tela)
 * vira uma frase genérica com antes e depois, nunca some. Com `hoje`, o aviso de prazo
 * de uma janela que já fechou diz que fechou, em vez de repetir a contagem do dia do aviso.
 */
export function fraseDoAviso(a: Pick<AvisoItem, "tipo" | "evento" | "antes" | "depois">, hoje?: string): FraseAviso {
  const { antes, depois } = a;
  switch (a.evento) {
    case "situacao":
      return {
        rotulo: a.tipo === "proposta" ? "A proposta mudou de situação" : "O convênio mudou de situação",
        detalhe: `${texto(antes)} → ${texto(depois)}`,
      };
    case "subsituacao":
      return { rotulo: "Mudou a subsituação", detalhe: `${antes ?? "nenhuma"} → ${depois ?? "nenhuma"}` };
    case "vl_desembolsado": {
      const de = numero(antes) ?? 0;
      const para = numero(depois) ?? 0;
      return para > de
        ? { rotulo: "Novo desembolso", detalhe: `${moedaCurta(para - de)} a mais · total de ${moedaCurta(de)} para ${moedaCurta(para)}` }
        : { rotulo: "O total desembolsado mudou", detalhe: `${moedaCurta(de)} → ${moedaCurta(para)}` };
    }
    case "n_aditivos":
      return { rotulo: "Termo aditivo novo", detalhe: `${antes ?? "0"} → ${depois ?? "0"} termos aditivos` };
    case "n_prorrogas":
      return { rotulo: "Prorrogação de ofício", detalhe: `${antes ?? "0"} → ${depois ?? "0"} prorrogações` };
    case "dt_fim_vigencia":
      return { rotulo: "A vigência mudou", detalhe: `até ${data(antes)} → até ${data(depois)}` };
    case "dt_limite_contas":
      return { rotulo: "O prazo de prestar contas mudou", detalhe: `${data(antes)} → ${data(depois)}` };
    case "dt_retirada_suspensiva":
      return depois
        ? { rotulo: "Cláusula suspensiva retirada", detalhe: `em ${data(depois)}` }
        : { rotulo: "A retirada da cláusula suspensiva saiu do registro", detalhe: `era ${data(antes)}` };
    case "pct_fisico":
      return { rotulo: "A execução física foi atualizada", detalhe: `${percentual(numero(antes))} → ${percentual(numero(depois))}` };
    case "desfecho":
      return {
        rotulo: "A proposta teve novo desfecho",
        detalhe: `${antes ? (ROTULO_DESFECHO[antes] ?? antes) : "sem desfecho"} → ${depois ? (ROTULO_DESFECHO[depois] ?? depois) : "sem desfecho"}`,
      };
    case "nr_convenio":
      return depois
        ? { rotulo: "A proposta virou convênio", detalhe: `convênio nº ${depois}` }
        : { rotulo: "O convênio saiu do registro da proposta", detalhe: `era o nº ${antes ?? "—"}` };
    case "em_execucao":
      return { rotulo: "Convênios em execução", detalhe: contagem(antes, depois) };
    case "instrumentos":
      return { rotulo: "Instrumentos no painel", detalhe: contagem(antes, depois) };
    case "propostas":
      return { rotulo: "Propostas no painel", detalhe: contagem(antes, depois) };
    case "em_suspensiva":
      return { rotulo: "Convênios em cláusula suspensiva", detalhe: contagem(antes, depois) };
    case "contas_atrasadas":
      return { rotulo: "Prestações de contas atrasadas", detalhe: contagem(antes, depois) };
    case "contas_rejeitadas":
      return { rotulo: "Contas rejeitadas ou inadimplência", detalhe: contagem(antes, depois) };
    case "saldo_parado":
      return { rotulo: "Convênios com saldo parado em conta", detalhe: contagem(antes, depois) };
    case "sem_desembolso":
      return { rotulo: "Convênios assinados sem desembolso", detalhe: contagem(antes, depois) };
    case "tce_tcu":
      return { rotulo: "Tomadas de Contas Especiais no TCU", detalhe: contagem(antes, depois) };
    case "fiscal_a":
    case "fiscal_b":
    case "fiscal_c":
      return {
        rotulo: `Painel fiscal: ${DECISAO_FISCAL[a.evento]}`,
        detalhe: `${ROTULO_ESTADO_FISCAL[antes ?? ""] ?? antes ?? "sem dado"} → ${ROTULO_ESTADO_FISCAL[depois ?? ""] ?? depois ?? "sem dado"}`,
      };
    case "cauc":
      return { rotulo: "Pendências no CAUC", detalhe: `${antes || "nenhuma"} → ${depois || "nenhuma"}` };
    case "pessoal_pct":
      return { rotulo: "Despesa com pessoal (% da RCL ajustada)", detalhe: `${pct(numero(antes))} → ${pct(numero(depois))}` };
    case "pix_vez_ente":
      return { rotulo: "Pix: planos à espera do município no ciclo", detalhe: contagem(antes, depois) };
    case "pix_vez_orgao":
      return { rotulo: "Pix: planos em análise no órgão federal", detalhe: contagem(antes, depois) };
    case "pix_prazo_ente":
      return { rotulo: "Pix: prazo da etapa do município", detalhe: `${antes ? data(antes) : "sem prazo"} → ${depois ? data(depois) : "sem prazo"}` };
    case "fora_do_recorte":
      return {
        rotulo: "Saiu da busca",
        detalhe: "Não está mais no recorte do painel: fora da Paraíba, a busca só guarda o que está em execução ou em prestação de contas.",
      };
    case "prazo":
      return { rotulo: "O prazo da janela mudou", detalhe: `${antes ? formatarData(antes) : "sem prazo"} → ${depois ? formatarData(depois) : "sem prazo"}` };
    case "encerrada":
      return { rotulo: FRASE_JANELA_FECHOU, detalhe: antes ? `O prazo era ${formatarData(antes)}.` : "Saiu das janelas abertas." };
    case "reaberta":
      return { rotulo: FRASE_JANELA_REABRIU, detalhe: depois ? `Fecha em ${formatarData(depois)}.` : "Sem prazo informado pela fonte." };
    case "fechando": {
      const dias = numero(depois);
      if (hoje && antes && antes < hoje) {
        return { rotulo: FRASE_JANELA_FECHOU, detalhe: `O prazo era ${formatarData(antes)}; o aviso foi do dia em que ${dias === 1 ? "faltava 1 dia" : `faltavam ${dias ?? "poucos"} dias`}.` };
      }
      const quando = dias === 0 ? "Fecha hoje" : dias === 1 ? "Falta 1 dia" : `Faltam ${dias ?? "poucos"} dias`;
      return { rotulo: quando, detalhe: antes ? `O prazo é ${formatarData(antes)}.` : "Prazo curto." };
    }
    default:
      return { rotulo: "O item mudou", detalhe: `${a.evento}: ${antes ?? "—"} → ${depois ?? "—"}` };
  }
}

export type AbaItens = "nao_lidas" | "todas" | "arquivadas";

export function filtrarAvisos<T extends Pick<AvisoItem, "lida_em" | "arquivada_em">>(avisos: readonly T[], aba: AbaItens): T[] {
  return avisos.filter((a) => (aba === "arquivadas" ? a.arquivada_em !== null : a.arquivada_em === null && (aba === "todas" || a.lida_em === null)));
}

/** A soma das duas filas de não lidos da aba. Se as duas falharam, não há número a mostrar. */
export function somaNaoLidos(janelas: number | null, itens: number | null): number | null {
  if (janelas === null && itens === null) return null;
  return (janelas ?? 0) + (itens ?? 0);
}
