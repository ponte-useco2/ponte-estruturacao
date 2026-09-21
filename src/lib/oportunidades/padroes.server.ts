/**
 * Leitura dos padrões das suspensivas e do checklist — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página (só administradores). Lê a última coleta concluída
 * das exigências e a última execução concluída do painel; nunca mistura retratos.
 *
 * Volume em 18/09/2026: ~5,1 mil convênios da PB com suspensiva no histórico, 288 na coleta, 3,5 mil
 * documentos, 1,5 mil eventos e um detalhe por evento colhido (até 964) — umas dez chamadas de mil
 * linhas. Página de uso interno.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import type { AtualSuspensiva, DetalheComNumero, DocumentoComNumero, EventoComNumero, HistoricoSuspensiva } from "./padroes";

type Falha = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" };
type Banco = ReturnType<typeof clienteServidor>;
type Resposta = { data: unknown; error: { message: string; code?: string } | null };

export type LeituraPadroes =
  | {
      estado: "ok";
      coletadoEm: string;
      referencia: string | null;
      historico: HistoricoSuspensiva[];
      atuais: AtualSuspensiva[];
      eventos: EventoComNumero[];
      detalhes: DetalheComNumero[];
      documentos: DocumentoComNumero[];
    }
  | Falha;

function falha(onde: string, erro: { message: string; code?: string }): Falha {
  if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
  console.error(`${onde}:`, erro.message);
  return { estado: "erro" };
}

/** Todas as linhas de uma consulta, em páginas de mil (o limite da API). O laudo também usa. */
export async function todas<T>(onde: string, consulta: (inicio: number, fim: number) => PromiseLike<Resposta>): Promise<T[] | Falha> {
  const saida: T[] = [];
  for (let inicio = 0; inicio < 50_000; inicio += 1000) {
    const r = await consulta(inicio, inicio + 999);
    if (r.error) return falha(onde, r.error);
    const lote = (r.data ?? []) as T[];
    saida.push(...lote);
    if (lote.length < 1000) return saida;
  }
  return saida;
}

function ehFalha<T>(x: T[] | Falha): x is Falha {
  return !Array.isArray(x);
}

export const COLUNAS_HISTORICO =
  "nr_convenio,orgao_sup,programa,situacao,dt_assinatura,dt_suspensiva,dt_retirada_suspensiva,vl_repasse,vl_desembolsado";

export async function lerPadroes(): Promise<LeituraPadroes> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db: Banco = clienteServidor();

  const [exig, painel] = await Promise.all([db.rpc("exigencia_ultima_execucao"), db.rpc("painel_ultima_execucao")]);
  if (exig.error) return falha("lerPadroes (coleta)", exig.error);
  if (painel.error) return falha("lerPadroes (painel)", painel.error);
  const coleta = (exig.data as { id: number; concluida_em: string; referencia: string | null }[] | null)?.[0];
  const execPainel = (painel.data as { id: number }[] | null)?.[0];
  if (!coleta || !execPainel) return { estado: "sem_execucao" };

  const [instrumentos, eventos, detalhes, documentos, historico] = await Promise.all([
    todas<{ numero: string; parado_desde: string | null; rodadas_de_exigencia: number }>("lerPadroes (instrumentos)", (i, f) =>
      db.from("exigencia_instrumento").select("numero,parado_desde,rodadas_de_exigencia").eq("execucao_id", coleta.id).is("erro", null).order("numero").range(i, f),
    ),
    todas<EventoComNumero>("lerPadroes (eventos)", (i, f) =>
      db
        .from("exigencia_evento")
        .select("numero,ordem,evento,lado,resultado,responsavel,ocorrido_em,id_situacao")
        .eq("execucao_id", coleta.id)
        .order("numero")
        .order("ordem")
        .range(i, f),
    ),
    todas<DetalheComNumero>("lerPadroes (detalhes)", (i, f) =>
      db
        .from("exigencia_detalhe")
        .select("numero,id_situacao,analise,responsavel,atribuicao,analisada_em,situacao,observacao,solicitacao")
        .eq("execucao_id", coleta.id)
        .order("numero")
        .order("id_situacao")
        .range(i, f),
    ),
    todas<DocumentoComNumero>("lerPadroes (documentos)", (i, f) =>
      db
        .from("exigencia_documento")
        .select("numero,ordem,grupo,arquivo,descricao,requisito,enviado_em,validade")
        .eq("execucao_id", coleta.id)
        .order("numero")
        .order("ordem")
        .range(i, f),
    ),
    // Todo convênio da PB que já teve suspensiva: prazo (segue ou morreu nela) ou retirada (saiu).
    todas<HistoricoSuspensiva & { motivo_suspensao?: string | null }>("lerPadroes (histórico)", (i, f) =>
      db
        .from("painel_instrumento")
        .select(`${COLUNAS_HISTORICO},motivo_suspensao`)
        .eq("execucao_id", execPainel.id)
        .eq("uf", "PB")
        .or("dt_suspensiva.not.is.null,dt_retirada_suspensiva.not.is.null")
        .order("nr_convenio")
        .range(i, f),
    ),
  ]);
  if (ehFalha(instrumentos)) return instrumentos;
  if (ehFalha(eventos)) return eventos;
  if (ehFalha(detalhes)) return detalhes;
  if (ehFalha(documentos)) return documentos;
  if (ehFalha(historico)) return historico;
  const inst = instrumentos;
  const hist = historico;

  const porNumero = new Map(hist.map((h) => [h.nr_convenio, h]));
  const atuais: AtualSuspensiva[] = inst.map((i) => {
    const h = porNumero.get(i.numero);
    return {
      numero: i.numero,
      orgao_sup: h?.orgao_sup ?? null,
      programa: h?.programa ?? null,
      motivo_suspensao: h?.motivo_suspensao ?? null,
      dt_assinatura: h?.dt_assinatura ?? null,
      dt_suspensiva: h?.dt_suspensiva ?? null,
      vl_repasse: h?.vl_repasse ?? null,
      parado_desde: i.parado_desde,
      rodadas_de_exigencia: i.rodadas_de_exigencia,
    };
  });

  return {
    estado: "ok",
    coletadoEm: coleta.concluida_em,
    referencia: coleta.referencia,
    historico: hist,
    atuais,
    eventos,
    detalhes,
    documentos,
  };
}
