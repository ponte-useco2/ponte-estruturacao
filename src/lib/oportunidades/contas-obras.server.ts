/**
 * Leitura da prestação de contas e da obra das coletas do Acesso Livre (onda 13C.2 e 13C.3) — só servidor,
 * só chave de serviço. Cada recorte tem a sua última execução (`al_ultima_execucao`); um recorte sem carga
 * não tira o outro do laudo. As tabelas da oport_26 não aceitam `anon` nem `authenticated`.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import type { EntradaContasObras, LinhaImpugnacao, LinhaObraParada, ObraConvenio, PcConvenio, PcEvento, PcParecer } from "./contas-obras";
import { ehEsquemaAusente } from "./esquema";

type Banco = ReturnType<typeof clienteServidor>;
type Execucao = { id: number; referencia: string | null };
type Erro = { message: string; code?: string };

async function execucao(db: Banco, recorte: "prestacao" | "obras"): Promise<Execucao | null | Erro> {
  const r = await db.rpc("al_ultima_execucao", { p_recorte: recorte });
  if (r.error) return ehEsquemaAusente(r.error.code) ? null : r.error;
  return ((r.data as Execucao[] | null) ?? [])[0] ?? null;
}

const ehErro = (x: unknown): x is Erro => !!x && typeof x === "object" && "message" in (x as object);

/**
 * As duas coletas de um convênio, para o laudo. `undefined`: nenhuma coleta publicada ou a oport_26 não
 * foi aplicada (a seção não aparece); `null`: a leitura falhou (a falta vai em `faltas`).
 */
export async function lerContasObrasDoConvenio(db: Banco, numero: string, faltas: string[]): Promise<EntradaContasObras | null | undefined> {
  const nome = "prestação de contas e obra";
  const [exPc, exOb] = await Promise.all([execucao(db, "prestacao"), execucao(db, "obras")]);
  for (const x of [exPc, exOb]) {
    if (ehErro(x)) {
      console.error(`laudo do instrumento (${nome}):`, x.message);
      faltas.push(nome);
      return null;
    }
  }
  if (!exPc && !exOb) return undefined;
  const pc = exPc as Execucao | null;
  const ob = exOb as Execucao | null;
  const vazio = Promise.resolve({ data: [], error: null });
  const [conv, evs, pars, obra] = await Promise.all([
    pc ? db.from("al_pc_convenio").select("*").eq("execucao_id", pc.id).eq("nr_convenio", numero).limit(1) : vazio,
    pc ? db.from("al_pc_evento").select("ordem,evento,situacao,data_hora,valor").eq("execucao_id", pc.id).eq("nr_convenio", numero).limit(200) : vazio,
    pc ? db.from("al_pc_parecer").select("*").eq("execucao_id", pc.id).eq("nr_convenio", numero).limit(200) : vazio,
    ob ? db.from("al_obra_convenio").select("*").eq("execucao_id", ob.id).eq("nr_convenio", numero).limit(1) : vazio,
  ]);
  const erro = conv.error ?? evs.error ?? pars.error ?? obra.error;
  if (erro) {
    if (!ehEsquemaAusente(erro.code)) console.error(`laudo do instrumento (${nome}):`, erro.message);
    faltas.push(nome);
    return null;
  }
  const c = ((conv.data ?? []) as PcConvenio[])[0];
  const o = ((obra.data ?? []) as ObraConvenio[])[0];
  return {
    prestacao: c && pc ? { convenio: c, eventos: (evs.data ?? []) as PcEvento[], pareceres: (pars.data ?? []) as PcParecer[], referencia: pc.referencia } : null,
    obra: o && ob ? { convenio: o, referencia: ob.referencia } : null,
  };
}

/** Lotes do `.in()`: a lista de números vai na URL do PostgREST. */
const LOTE_CONVENIOS = 150;

/**
 * As duas coletas dos convênios de um município (relatório da onda 14), em lote. Só os convênios que estão
 * em alguma coleta entram no resultado; sem pareceres, que os riscos não leem. `undefined`: nenhuma coleta
 * publicada ou a oport_26 não aplicada; `null`: a leitura falhou (a falta vai em `faltas`).
 */
export async function lerContasObrasDosConvenios(
  db: Banco,
  numeros: string[],
  faltas: string[],
): Promise<Record<string, EntradaContasObras> | null | undefined> {
  const nome = "prestação de contas e obra";
  const [exPc, exOb] = await Promise.all([execucao(db, "prestacao"), execucao(db, "obras")]);
  for (const x of [exPc, exOb]) {
    if (ehErro(x)) {
      console.error(`relatório do município (${nome}):`, x.message);
      faltas.push(nome);
      return null;
    }
  }
  if (!exPc && !exOb) return undefined;
  const pc = exPc as Execucao | null;
  const ob = exOb as Execucao | null;
  const saida: Record<string, EntradaContasObras> = {};
  for (let k = 0; k < numeros.length; k += LOTE_CONVENIOS) {
    const lote = numeros.slice(k, k + LOTE_CONVENIOS);
    const vazio = Promise.resolve({ data: [], error: null });
    const [conv, evs, obra] = await Promise.all([
      pc ? db.from("al_pc_convenio").select("*").eq("execucao_id", pc.id).in("nr_convenio", lote).limit(1000) : vazio,
      pc ? db.from("al_pc_evento").select("nr_convenio,ordem,evento,situacao,data_hora,valor").eq("execucao_id", pc.id).in("nr_convenio", lote).limit(5000) : vazio,
      ob ? db.from("al_obra_convenio").select("*").eq("execucao_id", ob.id).in("nr_convenio", lote).limit(1000) : vazio,
    ]);
    const erro = conv.error ?? evs.error ?? obra.error;
    if (erro) {
      if (!ehEsquemaAusente(erro.code)) console.error(`relatório do município (${nome}):`, erro.message);
      faltas.push(nome);
      return null;
    }
    const eventos = (evs.data ?? []) as (PcEvento & { nr_convenio: string })[];
    for (const c of (conv.data ?? []) as PcConvenio[]) {
      saida[c.nr_convenio] = {
        prestacao: { convenio: c, eventos: eventos.filter((e) => e.nr_convenio === c.nr_convenio), pareceres: [], referencia: pc?.referencia ?? null },
        obra: null,
      };
    }
    for (const o of (obra.data ?? []) as ObraConvenio[]) {
      saida[o.nr_convenio] = { prestacao: saida[o.nr_convenio]?.prestacao ?? null, obra: { convenio: o, referencia: ob?.referencia ?? null } };
    }
  }
  return saida;
}

// ================================================================ painel (administrador)

export interface PainelContasObras {
  impugnacoes: LinhaImpugnacao[] | null;
  obras: LinhaObraParada[] | null;
  referenciaPrestacao: string | null;
  referenciaObras: string | null;
}

type Info = { nr_convenio: string; municipio: string | null; proponente: string | null; situacao: string | null };

/** Impugnações e obras paradas das últimas coletas, com município e proponente do painel. Cada parte falha sozinha. */
export async function lerPainelContasObras(db: Banco, idPainel: number | null): Promise<PainelContasObras> {
  const saida: PainelContasObras = { impugnacoes: null, obras: null, referenciaPrestacao: null, referenciaObras: null };
  const [exPc, exOb] = await Promise.all([execucao(db, "prestacao"), execucao(db, "obras")]);
  const [imp, obr] = await Promise.all([
    exPc && !ehErro(exPc)
      ? db.from("al_pc_convenio").select("*").eq("execucao_id", exPc.id).gt("valor_impugnado", 0).order("valor_impugnado", { ascending: false }).limit(1000)
      : Promise.resolve(null),
    exOb && !ehErro(exOb)
      ? db.from("al_obra_convenio").select("*").eq("execucao_id", exOb.id).eq("codigo", "ok").or("paralisado.eq.true,dias_sem_medicao.gte.90").limit(2000)
      : Promise.resolve(null),
  ]);
  const impugnacoes = imp && !imp.error ? ((imp.data ?? []) as PcConvenio[]) : null;
  const obras = obr && !obr.error ? ((obr.data ?? []) as ObraConvenio[]) : null;
  if (imp?.error) console.error("painel de contas (impugnações):", imp.error.message);
  if (obr?.error) console.error("painel de contas (obras):", obr.error.message);

  const nrs = [...new Set([...(impugnacoes ?? []), ...(obras ?? [])].map((x) => x.nr_convenio))];
  const info = new Map<string, Info>();
  if (idPainel && nrs.length) {
    for (let k = 0; k < nrs.length; k += 200) {
      const r = await db.from("painel_instrumento").select("nr_convenio,municipio,proponente,situacao").eq("execucao_id", idPainel).in("nr_convenio", nrs.slice(k, k + 200));
      if (r.error) {
        console.error("painel de contas (painel):", r.error.message);
        break;
      }
      for (const x of (r.data ?? []) as Info[]) info.set(x.nr_convenio, x);
    }
  }
  if (impugnacoes) {
    saida.impugnacoes = impugnacoes.map((c) => ({
      ...c,
      municipio: info.get(c.nr_convenio)?.municipio ?? null,
      proponente: info.get(c.nr_convenio)?.proponente ?? null,
      situacao_convenio: info.get(c.nr_convenio)?.situacao ?? null,
    }));
    saida.referenciaPrestacao = (exPc as Execucao).referencia;
  }
  if (obras) {
    saida.obras = obras.map((o) => ({ ...o, municipio: info.get(o.nr_convenio)?.municipio ?? null, proponente: info.get(o.nr_convenio)?.proponente ?? null }));
    saida.referenciaObras = (exOb as Execucao).referencia;
  }
  return saida;
}

/** O painel das duas coletas, com o próprio cliente do banco. `null` sem Supabase configurado. */
export async function lerPainelDasColetas(): Promise<PainelContasObras | null> {
  if (!authConfigurada()) return null;
  const db = clienteServidor();
  const painel = await db.rpc("painel_ultima_execucao");
  const idPainel = (painel.data as { id: number }[] | null)?.[0]?.id ?? null;
  return lerPainelContasObras(db, idPainel);
}
