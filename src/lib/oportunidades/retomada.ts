/**
 * Obras da educação no Pacto Nacional pela Retomada de Obras (Lei 14.719/2023), na Plataforma Antonieta de Barros do
 * FNDE (R2, 05/11/2026; plano em Site-Ponte/obras-retomada-fnde/PLANO.md). Puro, com teste. O job é `retomada_fnde/`
 * (oport_63, domingo no pb-local); aqui ficam as somas, os pontos da fila e as colunas da tabela.
 *
 * Regras que esta parte guarda:
 *   - SALDO É DO PROCESSO, não da obra: várias obras do mesmo processo repetem o mesmo extrato. Toda soma de saldo é
 *     uma vez por (processo_cnpj, processo), nunca por obra (somar por obra dava R$ 2,36 bi no Brasil; o certo é R$ 752 mi);
 *   - extrato com mais de um ano não vira ponto alto: há extratos parados desde 2010, e o saldo pode já ter saído;
 *   - a vez (`vez_util`) só existe com o pedido de repactuação aberto: "FNDE" com o pedido deferido não é pendência;
 *   - o Obrasgov (aba "Primeira infância") e o pacto ficam lado a lado, sem somar: não há chave comum obra a obra;
 *   - empresa contratada com nome fica fora daqui (só o administrador, no dossiê do fornecedor);
 *   - "ponto para olhar" não é irregularidade, e não há comparação entre municípios.
 */
import type { ColunaTabela, Ordem, ValorCelula } from "./tabela-filtro.ts";

export const VERSAO_REGRAS_RETOMADA = "2026-11-05.1";

/** As colunas de `ret_obra` que as telas leem. Sem a empresa e sem o comentário da vistoria (texto livre). */
export const COLUNAS_OBRA_RETOMADA =
  "obrid,ibge,uf,municipio,nome,ente_cnpj,ente_nome,situacao_obra,situacao_cadastro,situacao_pedido,situacao_repactuacao,vez_util," +
  "dt_ultimo_passo,n_diligencias,termo,termo_vigencia,termo_situacao,tipo_projeto,valor_pactuado,valor_repassado,dt_ultimo_repasse," +
  "saldo_processo,saldo_data,saldo_banco,processo,processo_cnpj,pct_executado,dt_vistoria,dt_os,dt_inicio_execucao";

export interface ObraRetomada {
  obrid: number;
  ibge: string | null;
  uf?: string;
  municipio: string;
  nome: string;
  ente_cnpj: string | null;
  ente_nome: string | null;
  situacao_obra: string | null;
  situacao_cadastro: string | null;
  situacao_pedido: string | null;
  situacao_repactuacao: string | null;
  vez_util: "Ente" | "FNDE" | null;
  dt_ultimo_passo: string | null;
  n_diligencias: number;
  termo: string | null;
  termo_vigencia: string | null;
  termo_situacao: string | null;
  tipo_projeto: string | null;
  valor_pactuado: number | null;
  valor_repassado: number | null;
  dt_ultimo_repasse: string | null;
  saldo_processo: number | null;
  saldo_data: string | null;
  saldo_banco: string | null;
  processo: string | null;
  processo_cnpj: string | null;
  pct_executado: number | null;
  dt_vistoria: string | null;
  dt_os: string | null;
  dt_inicio_execucao: string | null;
}

/** Abaixo disto o saldo é resto de rendimento (o mesmo piso do saldo parado do SICONV). */
export const SALDO_MINIMO_RETOMADA = 1000;
export const DIAS_EXTRATO_RECENTE = 365;
export const DIAS_LICITACAO_LONGA = 180;
export const DIAS_VISTORIA_ANTIGA = 365;
export const DIAS_VIGENCIA_PERTO = 90;

/** Obra que ainda anda: o dinheiro do processo pode ser dela. */
export const SITUACOES_ATIVAS = ["Em Execução", "Em Retomada", "Em Licitação"];
/** Obra que precisa de vistoria registrada (a licitação ainda não tem canteiro). */
const SITUACOES_COM_CANTEIRO = ["Em Execução", "Em Retomada", "Paralisada"];
const DESVINCULADA = "Obra desvinculada";

export function obraAtiva(o: Pick<ObraRetomada, "situacao_obra">): boolean {
  return SITUACOES_ATIVAS.includes(o.situacao_obra ?? "");
}

/**
 * Paralisada, cancelada ou inacabada HOJE (`situacao_obra`), ou fora do pacto sem ter sido concluída. O cadastro
 * "Inacabada - PC Técnica Concluída" é o estado de antes da retomada e aparece em obra que hoje anda: não serve.
 */
export function obraParada(o: Pick<ObraRetomada, "situacao_obra" | "situacao_repactuacao">): boolean {
  return (
    o.situacao_obra === "Paralisada" ||
    o.situacao_obra === "Obra Cancelada" ||
    o.situacao_obra === "Inacabada" ||
    (o.situacao_repactuacao === DESVINCULADA && o.situacao_obra !== "Concluída")
  );
}

const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
const num = (x: number | null | undefined) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const somaNula = (xs: (number | null | undefined)[]) => {
  const v = xs.map(num).filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((a, x) => a + x, 0) * 100) / 100 : null;
};
const dataBr = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const plural = (q: number, um: string, varios: string) => `${q.toLocaleString("pt-BR")} ${q === 1 ? um : varios}`;
const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nomes = (os: { nome: string }[], max = 3) =>
  os.length <= max ? os.map((o) => o.nome).join("; ") : `${os.slice(0, max).map((o) => o.nome).join("; ")} e mais ${os.length - max}`;

export interface ProcessoRetomada {
  processo: string;
  processo_cnpj: string | null;
  saldo: number;
  saldoData: string | null;
  banco: string | null;
  obras: ObraRetomada[];
  /** Nenhuma obra do processo anda (nem está em licitação). */
  semObraAtiva: boolean;
  /** Sem obra que ande e com alguma parada, cancelada, inacabada ou fora do pacto. */
  comObraParada: boolean;
  /** Extrato com até um ano na data de referência. */
  extratoRecente: boolean;
}

/** Os processos com saldo, uma linha por (CNPJ do extrato, processo). O saldo é o do extrato, não somado por obra. */
export function processosComSaldo(obras: ObraRetomada[], hoje: string): ProcessoRetomada[] {
  const m = new Map<string, ProcessoRetomada>();
  for (const o of obras) {
    if (!o.processo) continue;
    const k = `${o.processo_cnpj ?? ""}|${o.processo}`;
    const p = m.get(k) ?? {
      processo: o.processo,
      processo_cnpj: o.processo_cnpj,
      saldo: 0,
      saldoData: null,
      banco: null,
      obras: [],
      semObraAtiva: false,
      comObraParada: false,
      extratoRecente: false,
    };
    p.obras.push(o);
    // O mesmo extrato vem em cada obra: fica o maior (as linhas são iguais; o máximo protege de uma obra sem o campo).
    const s = num(o.saldo_processo) ?? 0;
    if (s > p.saldo) {
      p.saldo = s;
      p.saldoData = o.saldo_data;
      p.banco = o.saldo_banco;
    }
    m.set(k, p);
  }
  return [...m.values()]
    .filter((p) => p.saldo > SALDO_MINIMO_RETOMADA)
    .map((p) => ({
      ...p,
      semObraAtiva: !p.obras.some(obraAtiva),
      comObraParada: !p.obras.some(obraAtiva) && p.obras.some(obraParada),
      extratoRecente: !!p.saldoData && dias(p.saldoData, hoje) <= DIAS_EXTRATO_RECENTE,
    }))
    .sort((a, b) => a.processo.localeCompare(b.processo));
}

export interface SecaoRetomada {
  /** A data do dado (a rodada do job). */
  referencia: string | null;
  obras: ObraRetomada[];
  porSituacao: { situacao: string; obras: number }[];
  pactuado: number | null;
  repassado: number | null;
  processos: ProcessoRetomada[];
  saldo: number;
  desvinculadas: number;
}

export function secaoRetomada(obras: ObraRetomada[], referencia: string | null, hoje: string): SecaoRetomada {
  const porSituacao = new Map<string, number>();
  for (const o of obras) porSituacao.set(o.situacao_obra ?? "Sem situação", (porSituacao.get(o.situacao_obra ?? "Sem situação") ?? 0) + 1);
  const processos = processosComSaldo(obras, hoje);
  return {
    referencia,
    obras: [...obras].sort((a, b) => a.nome.localeCompare(b.nome) || a.obrid - b.obrid),
    porSituacao: [...porSituacao.entries()].map(([situacao, n]) => ({ situacao, obras: n })).sort((a, b) => a.situacao.localeCompare(b.situacao)),
    pactuado: somaNula(obras.map((o) => o.valor_pactuado)),
    repassado: somaNula(obras.map((o) => o.valor_repassado)),
    processos,
    saldo: Math.round(processos.reduce((a, p) => a + p.saldo, 0) * 100) / 100,
    desvinculadas: obras.filter((o) => o.situacao_repactuacao === DESVINCULADA).length,
  };
}

/** Os pontos do pacto como a fila do relatório os lê (`Achado` de `relatorio-municipio.ts`, sem importar de lá). */
export interface PontoRetomada {
  nivel: "alto" | "moderado" | "informativo" | "em_dia";
  classe?: "cobranca" | "prazo" | "atencao";
  quem?: "municipio" | "orgao";
  titulo: string;
  fato: string;
  acao: string | null;
  peso: number;
  prazo?: string | null;
}

const ACAO_SALDO =
  "Pedir ao FNDE orientação sobre o saldo do processo: obra cancelada, paralisada ou fora do pacto não usa o recurso, que segue em conta.";

export function pontosRetomada(s: SecaoRetomada, hoje: string): PontoRetomada[] {
  const out: PontoRetomada[] = [];

  // 1. Saldo em conta sem obra que ande no processo. Extrato antigo vira informação: o saldo pode já ter saído.
  const comSituacao = (os: ObraRetomada[]) => nomes(os.map((o) => ({ nome: `${o.nome} (${(o.situacao_obra ?? "sem situação").toLowerCase()})` })));
  const parados = s.processos.filter((p) => p.comObraParada);
  const recentes = parados.filter((p) => p.extratoRecente);
  const antigos = s.processos.filter((p) => p.semObraAtiva && !p.extratoRecente);
  const concluidos = s.processos.filter((p) => p.semObraAtiva && !p.comObraParada && p.extratoRecente);
  if (recentes.length) {
    const v = recentes.reduce((a, p) => a + p.saldo, 0);
    out.push({
      nivel: "alto",
      classe: "cobranca",
      quem: "municipio",
      titulo: `Pacto de Retomada: saldo em conta sem obra em andamento (${plural(recentes.length, "processo", "processos")})`,
      fato:
        `${reais(v)} em conta em ${plural(recentes.length, "processo", "processos")} do FNDE sem obra em execução, em retomada ou em licitação: ` +
        `${comSituacao(recentes.flatMap((p) => p.obras))}. Saldo do extrato mais recente de cada processo (${recentes.map((p) => dataBr(p.saldoData)).join(", ")}), somado uma vez por processo.`,
      acao: ACAO_SALDO,
      peso: 3,
    });
  }
  if (concluidos.length) {
    out.push({
      nivel: "moderado",
      classe: "cobranca",
      quem: "municipio",
      titulo: `Pacto de Retomada: saldo em conta depois da obra concluída (${plural(concluidos.length, "processo", "processos")})`,
      fato: `${reais(concluidos.reduce((a, p) => a + p.saldo, 0))} no último extrato de processos em que todas as obras estão concluídas: ${comSituacao(concluidos.flatMap((p) => p.obras))}.`,
      acao: "Conferir com o FNDE o destino do saldo que sobrou depois da obra concluída.",
      peso: 5,
    });
  }
  if (antigos.length) {
    out.push({
      nivel: "informativo",
      classe: "atencao",
      quem: "municipio",
      titulo: `Pacto de Retomada: saldo de extrato antigo em processo sem obra em andamento (${plural(antigos.length, "processo", "processos")})`,
      fato: `${reais(antigos.reduce((a, p) => a + p.saldo, 0))} no último extrato publicado, com mais de um ano (o mais antigo de ${dataBr(antigos.map((p) => p.saldoData ?? "").sort()[0] || null)}). O saldo pode já ter saído.`,
      acao: null,
      peso: 8,
    });
  }
  // Processo com obra parada e obra que anda: o saldo pode ser da que anda. Só informação.
  const mistos = s.processos.filter((p) => !p.semObraAtiva && p.obras.some(obraParada) && p.extratoRecente);
  if (mistos.length) {
    out.push({
      nivel: "informativo",
      classe: "atencao",
      quem: "municipio",
      titulo: `Pacto de Retomada: saldo em processo com obra parada e obra em andamento (${plural(mistos.length, "processo", "processos")})`,
      fato: `${reais(mistos.reduce((a, p) => a + p.saldo, 0))} em conta; o saldo é do processo e pode ser da obra que anda.`,
      acao: null,
      peso: 8,
    });
  }

  // 2. Vigência do termo: vencida com obra que anda (alto) ou vencendo em até 90 dias (alto, com prazo).
  const ativas = s.obras.filter(obraAtiva).concat(s.obras.filter((o) => o.situacao_obra === "Paralisada"));
  const vencidas = ativas.filter((o) => o.termo_vigencia && o.termo_vigencia.slice(0, 10) < hoje);
  const perto = ativas.filter((o) => o.termo_vigencia && o.termo_vigencia.slice(0, 10) >= hoje && dias(hoje, o.termo_vigencia) <= DIAS_VIGENCIA_PERTO);
  if (vencidas.length) {
    out.push({
      nivel: "alto",
      classe: "prazo",
      quem: "municipio",
      titulo: `Pacto de Retomada: vigência do termo vencida com obra em andamento (${plural(vencidas.length, "obra", "obras")})`,
      fato: `${nomes(vencidas)}: termo ${vencidas.map((o) => `${o.termo ?? "—"} até ${dataBr(o.termo_vigencia)}`).join(", ")}.`,
      acao: "Pedir ao FNDE a prorrogação ou a regularização do termo de compromisso.",
      peso: 2,
    });
  }
  if (perto.length) {
    const prazo = perto.map((o) => (o.termo_vigencia as string).slice(0, 10)).sort()[0];
    out.push({
      nivel: "alto",
      classe: "prazo",
      quem: "municipio",
      prazo,
      titulo: `Pacto de Retomada: termo vence em até 90 dias (${plural(perto.length, "obra", "obras")})`,
      fato: `${nomes(perto)}: ${perto.map((o) => `termo ${o.termo ?? "—"} até ${dataBr(o.termo_vigencia)}`).join(", ")}.`,
      acao: "Pedir ao FNDE a prorrogação do termo antes do fim da vigência.",
      peso: 2,
    });
  }

  // 3. Diligência no pedido de repactuação com a vez do município.
  const diligencia = s.obras.filter((o) => o.vez_util === "Ente");
  if (diligencia.length) {
    out.push({
      nivel: "moderado",
      classe: "prazo",
      quem: "municipio",
      titulo: `Pacto de Retomada: pedido em diligência esperando o município (${plural(diligencia.length, "obra", "obras")})`,
      fato: `${nomes(diligencia)}: o FNDE pediu complemento no pedido de repactuação, e a vez é do município desde ${dataBr(diligencia.map((o) => o.dt_ultimo_passo ?? "").sort()[0] || null)}.`,
      acao: "Responder à diligência do FNDE no pedido de repactuação.",
      peso: 4,
    });
  }

  // 4. Em licitação há mais de 6 meses depois do deferimento do pedido.
  const licitacao = s.obras.filter(
    // Com ordem de serviço a licitação já acabou, mesmo que a situação ainda não tenha mudado.
    (o) => o.situacao_obra === "Em Licitação" && o.situacao_pedido === "Deferido" && !o.dt_os && o.dt_ultimo_passo && dias(o.dt_ultimo_passo, hoje) > DIAS_LICITACAO_LONGA,
  );
  if (licitacao.length) {
    out.push({
      nivel: "moderado",
      classe: "atencao",
      quem: "municipio",
      titulo: `Pacto de Retomada: obra em licitação há mais de 6 meses depois do deferimento (${plural(licitacao.length, "obra", "obras")})`,
      fato: `${nomes(licitacao)}: pedido deferido em ${licitacao.map((o) => dataBr(o.dt_ultimo_passo)).join(", ")} e a obra segue em licitação.`,
      acao: "Concluir a licitação e registrar o contrato e a ordem de serviço no SIMEC (Obras 2.0).",
      peso: 5,
    });
  }

  // 5. Vistoria antiga ou ausente em obra com canteiro.
  const vistoria = s.obras.filter(
    (o) => SITUACOES_COM_CANTEIRO.includes(o.situacao_obra ?? "") && (!o.dt_vistoria || dias(o.dt_vistoria, hoje) > DIAS_VISTORIA_ANTIGA),
  );
  if (vistoria.length) {
    out.push({
      nivel: "moderado",
      classe: "atencao",
      quem: "municipio",
      titulo: `Pacto de Retomada: vistoria com mais de um ano ou sem vistoria (${plural(vistoria.length, "obra", "obras")})`,
      fato: `${nomes(vistoria)}: última vistoria ${vistoria.map((o) => (o.dt_vistoria ? `em ${dataBr(o.dt_vistoria)}` : "não registrada")).join(", ")}.`,
      acao: "Registrar no SIMEC (Obras 2.0) uma vistoria atualizada da obra.",
      peso: 6,
    });
  }

  // 6. Fora do pacto: só informação.
  if (s.desvinculadas) {
    out.push({
      nivel: "informativo",
      classe: "atencao",
      quem: "orgao",
      titulo: `Pacto de Retomada: ${plural(s.desvinculadas, "obra desvinculada", "obras desvinculadas")} do pacto`,
      fato: `${plural(s.desvinculadas, "obra saiu", "obras saíram")} do pacto (pedido indeferido ou cancelado, ou obra retirada) e ${s.desvinculadas === 1 ? "segue listada" : "seguem listadas"}, sem somar no que está em andamento.`,
      acao: null,
      peso: 9,
    });
  }

  if (s.obras.length && !out.some((p) => p.nivel === "alto" || p.nivel === "moderado")) {
    out.push({
      nivel: "em_dia",
      titulo: "Obras do Pacto de Retomada sem ponto para olhar",
      fato: `${plural(s.obras.length, "obra", "obras")} no pacto, sem saldo parado recente, termo vencendo, diligência esperando o município, licitação longa nem vistoria antiga.`,
      acao: null,
      peso: 9,
    });
  }
  return out;
}

// ================================================================ a tabela das obras

export const TABELA_RETOMADA = "rel-retomada";

export const COLUNAS_RETOMADA: ColunaTabela[] = [
  { id: "obra", titulo: "Obra", tipo: "texto" },
  { id: "tipo", titulo: "Tipo", tipo: "categoria", oculta: true },
  { id: "situacao", titulo: "Situação", tipo: "categoria" },
  { id: "pedido", titulo: "No pacto", tipo: "categoria" },
  { id: "executado", titulo: "Executado (%)", tipo: "numero", alinhar: "direita" },
  { id: "pactuado", titulo: "Pactuado", tipo: "numero", alinhar: "direita" },
  { id: "repassado", titulo: "Repassado", tipo: "numero", alinhar: "direita" },
  { id: "vigencia", titulo: "Vigência do termo", tipo: "data", alinhar: "direita" },
  { id: "vistoria", titulo: "Última vistoria", tipo: "data", alinhar: "direita" },
  { id: "termo", titulo: "Termo", tipo: "texto", oculta: true, textoNoCsv: true },
  { id: "processo", titulo: "Processo", tipo: "texto", oculta: true, textoNoCsv: true },
];

export const ORDEM_RETOMADA: Ordem = { coluna: "obra", sentido: "asc" };

export function valoresDaObraRetomada(o: ObraRetomada): Record<string, ValorCelula> {
  return {
    obra: o.nome,
    tipo: o.tipo_projeto,
    situacao: o.situacao_obra,
    pedido: o.situacao_repactuacao ?? o.situacao_pedido,
    executado: num(o.pct_executado),
    pactuado: num(o.valor_pactuado),
    repassado: num(o.valor_repassado),
    vigencia: o.termo_vigencia?.slice(0, 10) ?? null,
    vistoria: o.dt_vistoria?.slice(0, 10) ?? null,
    termo: o.termo,
    processo: o.processo,
  };
}

/** O resumo de uma UF (`ret_resumo_uf`), para a página da UF e do Brasil. */
export interface ResumoRetomadaUf {
  uf: string;
  obras: number;
  municipios: number;
  valor_pactuado: number;
  valor_repassado: number;
  processos_com_saldo: number;
  saldo: number;
  processos_saldo_recente: number;
  saldo_recente: number;
  diligencias_abertas: number;
  por_situacao: Record<string, { obras: number; pactuado: number; repassado: number }>;
}

export function situacoesDoResumo(r: Pick<ResumoRetomadaUf, "por_situacao">): { situacao: string; obras: number; pactuado: number }[] {
  return Object.entries(r.por_situacao ?? {})
    .map(([situacao, v]) => ({ situacao, obras: Number(v?.obras) || 0, pactuado: Number(v?.pactuado) || 0 }))
    .sort((a, b) => a.situacao.localeCompare(b.situacao));
}
