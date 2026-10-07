/**
 * Carteira (MVP da tarefa recorrente aprovada em 02/10/2026): acompanhar uma carteira de municípios e
 * instrumentos, entender o que mudou e chegar à próxima ação com o fato que a sustenta.
 *
 * Tudo sai do que o banco já guarda por pessoa: os itens seguidos, com o último retrato comparado
 * (`oport_favorito.estado`, mantido pelo job do painel), e os avisos gerados a cada rodada (`oport_aviso`).
 * Nenhuma leitura pesada por item: a carteira abre rápido com dezenas de itens.
 *
 * Duas regras de redação, as do relatório e do laudo: "a conferir" é ponto para olhar, nunca irregularidade;
 * cada recomendação diz o fato e a data do dado que a sustentam, e o caminho até a análise completa.
 * Função pura, sem banco e sem relógio.
 */
import { formatarData } from "./central.ts";
import { fraseDoAviso, urlDoItem, type AvisoItem, type FraseAviso, type TipoItem } from "./favoritos.ts";
import { percentual } from "./painel.ts";

export type Consequencia = "alto" | "moderado" | "informativo";

export interface SeguidoCarteira {
  tipo: TipoItem;
  chave: string;
  titulo: string | null;
  /** O último retrato comparado pelo job do painel (ou montado na hora de seguir). */
  estado: Record<string, unknown> | null;
  /** `painel:<dado_ate>` ou, na janela, o `generated_at` do catálogo. */
  referencia: string | null;
  criado_em: string;
}

export interface Recomendacao {
  nivel: Consequencia;
  acao: string;
  /** O fato que sustenta a ação, com a data do dado. */
  fato: string;
}

export interface MudancaCarteira extends FraseAviso {
  id: string;
  evento: string;
  consequencia: Consequencia;
  /** Se a mudança melhorou a situação; null quando não há direção (situação nova, prazo mudou). */
  melhora: boolean | null;
  criado_em: string;
  lida: boolean;
}

export interface ItemCarteira {
  tipo: TipoItem;
  chave: string;
  titulo: string;
  url: string;
  /** Saiu do recorte das fontes: o retrato guardado é o último que houve. */
  ausente: boolean;
  /** Data do dado do retrato. */
  dadoDe: string | null;
  numeros: { rotulo: string; valor: string; nivel: Consequencia | null }[];
  /** As primeiras `MAX_RECOMENDACOES`, do que destrava mais. */
  recomendacoes: Recomendacao[];
  /** Quantos pontos ficaram de fora da carteira (estão na página do item). */
  restantes: number;
  mudancas: MudancaCarteira[];
  /** A pior consequência entre as mudanças não lidas; null sem mudança nova. */
  pior: Consequencia | null;
}

export interface Carteira {
  itens: ItemCarteira[];
  /** Os itens com mudança não lida, da pior consequência para a mais branda. */
  comMudanca: ItemCarteira[];
  porTipo: Record<TipoItem, ItemCarteira[]>;
  naoLidas: number;
  vazia: boolean;
}

export const MAX_RECOMENDACOES = 3;
export const LIMITE_PESSOAL = 54;

const ORDEM: Record<Consequencia, number> = { alto: 0, moderado: 1, informativo: 2 };

// ================================================================ utilidades

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const plural = (q: number, um: string, varios: string) => `${q.toLocaleString("pt-BR")} ${q === 1 ? um : varios}`;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** "painel:2026-10-01T23:00:00Z" → "2026-10-01". */
export function dataDaReferencia(ref: string | null): string | null {
  if (!ref) return null;
  const m = ref.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function diasAte(dataIso: string | null, hoje: string): number | null {
  if (!dataIso) return null;
  const d = (Date.parse(`${dataIso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(d) ? Math.round(d) : null;
}

const conjunto = (s: string | null) => new Set((s ?? "").split(",").map((x) => x.trim()).filter(Boolean));

const PIOR_ESTADO_FISCAL: Record<string, number> = { atendido: 0, nao_verificavel: 1, desatualizado: 1, atencao: 2, nao_atendido: 3 };

// ================================================================ consequência de uma mudança

/**
 * Quanto uma mudança pesa para quem acompanha. Piora que trava recurso (CAUC, decisão fiscal, TCE, contas)
 * é alta; piora que pede atenção é moderada; o resto, inclusive toda melhora, é informação.
 */
export function consequenciaDoAviso(a: Pick<AvisoItem, "tipo" | "evento" | "antes" | "depois">, hoje: string): { nivel: Consequencia; melhora: boolean | null } {
  const de = num(a.antes);
  const para = num(a.depois);
  const subiu = de !== null && para !== null ? para > de : null;
  switch (a.evento) {
    case "tce_tcu":
    case "contas_atrasadas":
    case "contas_rejeitadas":
      return subiu ? { nivel: "alto", melhora: false } : { nivel: "informativo", melhora: subiu === false ? true : null };
    case "em_suspensiva":
    case "saldo_parado":
    case "sem_desembolso":
      return subiu ? { nivel: "moderado", melhora: false } : { nivel: "informativo", melhora: subiu === false ? true : null };
    case "em_execucao":
      return { nivel: "informativo", melhora: null };
    case "fiscal_a":
    case "fiscal_b":
    case "fiscal_c": {
      const antes = PIOR_ESTADO_FISCAL[a.antes ?? ""] ?? 1;
      const depois = PIOR_ESTADO_FISCAL[a.depois ?? ""] ?? 1;
      if (depois > antes) return { nivel: a.depois === "nao_atendido" ? "alto" : "moderado", melhora: false };
      return { nivel: "informativo", melhora: depois < antes ? true : null };
    }
    case "cauc": {
      const antes = conjunto(a.antes);
      const novos = [...conjunto(a.depois)].filter((x) => !antes.has(x));
      if (novos.length) return { nivel: "alto", melhora: false };
      return { nivel: "informativo", melhora: true };
    }
    case "pix_vez_ente":
      // Plano do Pix à espera do município: sem resposta no prazo, o plano fica impedido e o dinheiro não vem.
      return subiu ? { nivel: "alto", melhora: false } : { nivel: "informativo", melhora: subiu === false ? true : null };
    case "pix_vez_orgao":
      return { nivel: "informativo", melhora: null };
    case "pix_prazo_ente":
      return a.depois ? { nivel: "moderado", melhora: null } : { nivel: "informativo", melhora: null };
    case "pessoal_pct":
      if (para !== null && para >= LIMITE_PESSOAL && (de === null || de < LIMITE_PESSOAL)) return { nivel: "alto", melhora: false };
      if (subiu) return { nivel: "moderado", melhora: false };
      return { nivel: "informativo", melhora: subiu === false ? true : null };
    case "situacao": {
      const s = (a.depois ?? "").toLowerCase();
      if (/rejeitad|inadimplent|tomada de contas/.test(s)) return { nivel: "alto", melhora: false };
      if (/aprovad|conclu/.test(s)) return { nivel: "informativo", melhora: true };
      return { nivel: "moderado", melhora: null };
    }
    case "desfecho":
      if (a.depois === "assinada") return { nivel: "informativo", melhora: true };
      if (["reprovada", "impedimento", "eliminada", "cancelada", "anulada"].includes(a.depois ?? "")) return { nivel: "alto", melhora: false };
      return { nivel: "moderado", melhora: null };
    case "dt_limite_contas":
    case "fora_do_recorte":
      return { nivel: "moderado", melhora: null };
    case "dt_retirada_suspensiva":
      return a.depois ? { nivel: "informativo", melhora: true } : { nivel: "moderado", melhora: false };
    case "fechando": {
      if (a.antes && a.antes < hoje) return { nivel: "informativo", melhora: null };
      const dias = num(a.depois);
      return { nivel: dias !== null && dias <= 3 ? "alto" : "moderado", melhora: null };
    }
    case "prazo":
    case "reaberta":
      return { nivel: "moderado", melhora: null };
    default:
      return { nivel: "informativo", melhora: null };
  }
}

// ================================================================ recomendações a partir do retrato

/** Município: o que fazer, pelo retrato do painel, do fiscal e do TCU, do que destrava mais. A carteira mostra as três primeiras. */
export function recomendacoesMunicipio(e: Record<string, unknown>, dadoDe: string | null): Recomendacao[] {
  const em = dadoDe ? ` (dado de ${formatarData(dadoDe)})` : "";
  const r: Recomendacao[] = [];
  const cauc = txt(e.cauc);
  if (cauc) {
    r.push({
      nivel: "alto",
      acao: `Regularizar ${cauc.includes(",") ? "os itens" : "o item"} ${cauc} do CAUC`,
      fato: `O CAUC registra pendência${cauc.includes(",") ? "s" : ""} em ${cauc}${em}. Sem regularizar, cada transferência voluntária depende de exceção; saúde, educação e assistência social ficam fora da suspensão (LRF, art. 25, § 3º).`,
    });
  } else if (e.fiscal_b === "nao_atendido") {
    r.push({
      nivel: "alto",
      acao: "Ver no painel fiscal o que bloqueia a transferência voluntária",
      fato: `A decisão "receber transferência voluntária" está não atendida no painel fiscal${em}, sem pendência no CAUC.`,
    });
  }
  // Pix à espera do município: o prazo do comunicado decide; logo depois do bloqueio fiscal, antes das TCE.
  const pixEnte = num(e.pix_vez_ente) ?? 0;
  if (pixEnte > 0) {
    const prazo = txt(e.pix_prazo_ente);
    r.push({
      nivel: "alto",
      acao: `Responder no Transferegov ${pixEnte === 1 ? "ao plano do Pix que espera" : `aos ${pixEnte} planos do Pix que esperam`} o município` +
        (prazo ? ` até ${formatarData(prazo)}` : ""),
      fato: `${plural(pixEnte, "plano de transferência especial", "planos de transferência especial")} do exercício com a vez do município ` +
        `(ciência, envio ou complementação do plano de trabalho)${em}. Sem resposta no prazo do comunicado, o plano fica impedido e o dinheiro não vem.` +
        (prazo ? "" : " O prazo do comunicado ainda não foi cadastrado: conferir no Transferegov."),
    });
  }
  const tce = num(e.tce_tcu) ?? 0;
  if (tce > 0) {
    r.push({
      nivel: "alto",
      acao: `Acompanhar ${tce === 1 ? "a TCE" : `as ${tce} TCE`} no TCU e reunir a defesa ou o recolhimento`,
      fato: `${plural(tce, "Tomada de Contas Especial", "Tomadas de Contas Especiais")} no e-TCE do TCU para convênios do município${em}. TCE não é julgamento: o Tribunal ainda decide.`,
    });
  }
  const atrasadas = num(e.contas_atrasadas) ?? 0;
  if (atrasadas > 0) {
    r.push({
      nivel: "alto",
      acao: `Enviar ${atrasadas === 1 ? "a prestação de contas atrasada" : `as ${atrasadas} prestações de contas atrasadas`}`,
      fato: `${plural(atrasadas, "convênio", "convênios")} com o prazo de prestar contas vencido no SICONV${em}. Prazo vencido sem prestação é motivo de TCE.`,
    });
  }
  const rejeitadas = num(e.contas_rejeitadas) ?? 0;
  if (rejeitadas > 0) {
    r.push({
      nivel: "alto",
      acao: "Tratar as contas rejeitadas ou a inadimplência",
      fato: `${plural(rejeitadas, "convênio", "convênios")} com contas rejeitadas ou inadimplência no SICONV${em}.`,
    });
  }
  const pessoal = num(e.pessoal_pct);
  if (pessoal !== null && pessoal > LIMITE_PESSOAL) {
    r.push({
      nivel: "alto",
      acao: "Apresentar um plano de recondução da despesa com pessoal",
      fato: `Despesa com pessoal em ${pct(pessoal)} da RCL ajustada no último RGF, acima do limite de ${LIMITE_PESSOAL}% (LRF, arts. 20 e 23)${em}.`,
    });
  }
  const suspensiva = num(e.em_suspensiva) ?? 0;
  if (suspensiva > 0) {
    r.push({
      nivel: "moderado",
      acao: `Cumprir as exigências ${suspensiva === 1 ? "da cláusula suspensiva" : `das ${suspensiva} cláusulas suspensivas`} antes do prazo`,
      fato: `${plural(suspensiva, "convênio", "convênios")} ainda em cláusula suspensiva${em}.`,
    });
  }
  const saldo = num(e.saldo_parado) ?? 0;
  if (saldo > 0) {
    r.push({
      nivel: "moderado",
      acao: "Executar ou devolver o saldo parado em conta",
      fato: `${plural(saldo, "convênio", "convênios")} com saldo parado em conta${em}.`,
    });
  }
  return r.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}

/** Convênio: o que fazer pela situação e pelos prazos do retrato, contados até hoje. */
export function recomendacoesInstrumento(e: Record<string, unknown>, hoje: string, dadoDe: string | null): Recomendacao[] {
  const em = dadoDe ? `; situação no SICONV de ${formatarData(dadoDe)}` : "";
  const r: Recomendacao[] = [];
  const situacao = txt(e.situacao) ?? "";
  const fim = txt(e.dt_fim_vigencia);
  const limite = txt(e.dt_limite_contas);
  const diasFim = diasAte(fim, hoje);
  const diasLimite = diasAte(limite, hoje);
  if (/rejeitad|inadimplent/i.test(situacao)) {
    r.push({ nivel: "alto", acao: "Tratar a rejeição das contas antes que vire TCE", fato: `Situação: ${situacao}${em}.` });
  }
  if (/aguardando presta/i.test(situacao) && diasLimite !== null) {
    r.push(
      diasLimite < 0
        ? { nivel: "alto", acao: "Enviar a prestação de contas", fato: `O prazo venceu em ${formatarData(limite as string)}, há ${plural(-diasLimite, "dia", "dias")}${em}.` }
        : { nivel: diasLimite <= 30 ? "alto" : "moderado", acao: `Enviar a prestação de contas até ${formatarData(limite as string)}`, fato: `${diasLimite === 1 ? "Falta" : "Faltam"} ${plural(diasLimite, "dia", "dias")}${em}.` },
    );
  }
  if (/em execu/i.test(situacao) && diasFim !== null && diasFim <= 60) {
    const aditivo = /aditiva/i.test(txt(e.subsituacao) ?? "");
    r.push(
      diasFim < 0
        ? aditivo
          ? { nivel: "alto", acao: "Acompanhar a aprovação do aditivo; sem ele, preparar a prestação de contas e a devolução do saldo", fato: `A vigência terminou em ${formatarData(fim as string)} com um aditivo em andamento ("${txt(e.subsituacao)}")${em}.` }
          : { nivel: "alto", acao: "Pedir a prorrogação (se há objeto a executar) ou preparar a prestação de contas e a devolução do saldo", fato: `A vigência terminou em ${formatarData(fim as string)} e o SICONV ainda mostra "Em execução"${em}.` }
        : aditivo
          ? { nivel: "moderado", acao: "Acompanhar o aditivo antes do fim da vigência", fato: `A vigência termina em ${formatarData(fim as string)}, daqui a ${plural(diasFim, "dia", "dias")}, com um aditivo em andamento${em}.` }
          : { nivel: "moderado", acao: "Decidir entre pedir prorrogação e preparar a prestação de contas", fato: `A vigência termina em ${formatarData(fim as string)}, daqui a ${plural(diasFim, "dia", "dias")}${em}.` },
    );
  }
  return r.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}

/** Janela aberta: a decisão que ela pede. */
export function recomendacoesJanela(e: Record<string, unknown>, hoje: string): Recomendacao[] {
  const prazo = txt(e.prazo);
  if (e.aberta !== true) return [];
  const dias = diasAte(prazo, hoje);
  if (prazo && dias !== null && dias >= 0) {
    return [{ nivel: dias <= 7 ? "alto" : "moderado", acao: `Decidir se vale preparar a proposta até ${formatarData(prazo)}`, fato: dias === 0 ? "Fecha hoje." : `${dias === 1 ? "Falta" : "Faltam"} ${plural(dias, "dia", "dias")}.` }];
  }
  return [];
}

// ================================================================ números do retrato

function numerosDoMunicipio(e: Record<string, unknown>): ItemCarteira["numeros"] {
  const n: ItemCarteira["numeros"] = [];
  const b = txt(e.fiscal_b);
  if (b) n.push({ rotulo: "Transferência voluntária", valor: b === "nao_atendido" ? "bloqueada" : b === "atendido" ? "sem bloqueio" : b === "atencao" ? "com alertas" : "em aberto", nivel: b === "nao_atendido" ? "alto" : b === "atencao" ? "moderado" : null });
  if ("cauc" in e) n.push({ rotulo: "CAUC", valor: txt(e.cauc) ?? "sem pendência", nivel: txt(e.cauc) ? "alto" : null });
  n.push({ rotulo: "Em execução", valor: String(num(e.em_execucao) ?? 0), nivel: null });
  const tce = num(e.tce_tcu) ?? 0;
  n.push({ rotulo: "TCE no TCU", valor: String(tce), nivel: tce > 0 ? "alto" : null });
  const pixEnte = num(e.pix_vez_ente) ?? 0;
  if (pixEnte > 0) n.push({ rotulo: "Pix à espera do município", valor: String(pixEnte), nivel: "alto" });
  return n;
}

function numerosDoInstrumento(e: Record<string, unknown>, hoje: string): ItemCarteira["numeros"] {
  const n: ItemCarteira["numeros"] = [{ rotulo: "Situação", valor: txt(e.situacao) ?? "—", nivel: null }];
  const fim = txt(e.dt_fim_vigencia);
  const d = diasAte(fim, hoje);
  if (fim) n.push({ rotulo: "Vigência", valor: `até ${formatarData(fim)}`, nivel: d !== null && d < 0 && /execu/i.test(txt(e.situacao) ?? "") ? "alto" : d !== null && d <= 60 ? "moderado" : null });
  const fisico = num(e.pct_fisico);
  if (fisico !== null) n.push({ rotulo: "Físico", valor: percentual(fisico), nivel: null });
  return n;
}

// ================================================================ montagem

export function montarCarteira(
  entrada: { seguidos: SeguidoCarteira[]; avisos: AvisoItem[] },
  hoje: string,
): Carteira {
  const avisosPorItem = new Map<string, AvisoItem[]>();
  for (const a of entrada.avisos) {
    if (a.arquivada_em) continue;
    const k = `${a.tipo}:${a.chave}`;
    avisosPorItem.set(k, [...(avisosPorItem.get(k) ?? []), a]);
  }

  const itens: ItemCarteira[] = entrada.seguidos.map((s) => {
    const e = s.estado ?? {};
    const dadoDe = dataDaReferencia(s.referencia);
    const mudancas: MudancaCarteira[] = (avisosPorItem.get(`${s.tipo}:${s.chave}`) ?? [])
      .map((a) => {
        const c = consequenciaDoAviso(a, hoje);
        return { id: a.id, evento: a.evento, ...fraseDoAviso(a, hoje), consequencia: c.nivel, melhora: c.melhora, criado_em: a.criado_em, lida: a.lida_em !== null };
      })
      .sort((a, b) => Number(a.lida) - Number(b.lida) || ORDEM[a.consequencia] - ORDEM[b.consequencia] || b.criado_em.localeCompare(a.criado_em));
    const naoLidas = mudancas.filter((m) => !m.lida);
    const pior = naoLidas.length ? naoLidas.reduce<Consequencia>((p, m) => (ORDEM[m.consequencia] < ORDEM[p] ? m.consequencia : p), "informativo") : null;
    const todas =
      s.tipo === "municipio" ? recomendacoesMunicipio(e, dadoDe) : s.tipo === "instrumento" ? recomendacoesInstrumento(e, hoje, dadoDe) : s.tipo === "janela" ? recomendacoesJanela(e, hoje) : [];
    const numeros = s.tipo === "municipio" ? numerosDoMunicipio(e) : s.tipo === "instrumento" ? numerosDoInstrumento(e, hoje) : [];
    return {
      tipo: s.tipo,
      chave: s.chave,
      titulo: s.titulo ?? `${s.tipo === "municipio" ? "Município" : s.tipo === "instrumento" ? "Convênio" : s.tipo === "proposta" ? "Proposta" : "Janela"} ${s.chave}`,
      url: urlDoItem(s.tipo, s.chave),
      ausente: e.ausente === true,
      dadoDe,
      numeros,
      recomendacoes: todas.slice(0, MAX_RECOMENDACOES),
      restantes: Math.max(0, todas.length - MAX_RECOMENDACOES),
      mudancas,
      pior,
    };
  });

  const comMudanca = itens
    .filter((i) => i.pior !== null)
    .sort((a, b) => ORDEM[a.pior as Consequencia] - ORDEM[b.pior as Consequencia] || a.titulo.localeCompare(b.titulo, "pt-BR"));
  const porTipo: Record<TipoItem, ItemCarteira[]> = { municipio: [], instrumento: [], proposta: [], janela: [] };
  for (const i of itens) porTipo[i.tipo].push(i);
  for (const t of Object.keys(porTipo) as TipoItem[]) {
    porTipo[t].sort((a, b) => ORDEM[a.recomendacoes[0]?.nivel ?? "informativo"] - ORDEM[b.recomendacoes[0]?.nivel ?? "informativo"] || a.titulo.localeCompare(b.titulo, "pt-BR"));
  }
  return {
    itens,
    comMudanca,
    porTipo,
    naoLidas: itens.reduce((t, i) => t + i.mudancas.filter((m) => !m.lida).length, 0),
    vazia: itens.length === 0,
  };
}
