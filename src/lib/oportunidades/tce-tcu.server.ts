/**
 * Leitura da Tomada de Contas Especial no e-TCE do TCU (onda 13C) — só servidor, só chave de serviço.
 *
 * Execução própria (`tcu_ultima_execucao`), semanal, separada da do painel. As tabelas da oport_25 não
 * aceitam `anon` nem `authenticated`. Volume: ~6,4 mil consultas por rodada e dezenas de TCE na PB.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { todas } from "./padroes.server";
import type { ConsultaTcu, EntradaTceTcu, ExecucaoTcu, LinhaTcePainel, TceTcu } from "./tce-tcu";

type Banco = ReturnType<typeof clienteServidor>;
type Falha = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" };

function falha(onde: string, erro: { message: string; code?: string }): Falha {
  if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
  console.error(`${onde}:`, erro.message);
  return { estado: "erro" };
}

async function execucaoTcu(db: Banco, onde: string): Promise<ExecucaoTcu | Falha> {
  const r = await db.rpc("tcu_ultima_execucao");
  if (r.error) return falha(`${onde} (execução)`, r.error);
  return ((r.data as ExecucaoTcu[] | null)?.[0] ?? { estado: "sem_execucao" }) as ExecucaoTcu | Falha;
}

const ehFalha = (x: unknown): x is Falha => !!x && typeof x === "object" && !Array.isArray(x) && "estado" in (x as object);

/**
 * A TCE de um convênio, para o laudo. `undefined`: o job ainda não rodou ou a oport_25 não foi aplicada
 * (a seção não aparece); `null`: a leitura falhou (a falta vai em `faltas`).
 */
export async function lerTceTcuDoConvenio(db: Banco, numero: string, faltas: string[]): Promise<EntradaTceTcu | null | undefined> {
  // O nome aparece no laudo quando a leitura falha: por extenso, sem a sigla de dois sentidos (B14, 08/10/2026).
  const nome = "tomadas de contas especiais (TCU)";
  const ex = await execucaoTcu(db, `laudo do instrumento (${nome})`);
  if (ehFalha(ex)) {
    if (ex.estado === "erro") {
      faltas.push(nome);
      return null;
    }
    return undefined;
  }
  const [consulta, tces] = await Promise.all([
    db.from("tcu_consulta").select("*").eq("execucao_id", ex.id).eq("nr_convenio", numero).limit(1),
    db.from("tcu_tce").select("*").eq("execucao_id", ex.id).eq("nr_convenio", numero).limit(100),
  ]);
  const erro = consulta.error ?? tces.error;
  if (erro) {
    if (!ehEsquemaAusente(erro.code)) console.error(`laudo do instrumento (${nome}):`, erro.message);
    faltas.push(nome);
    return null;
  }
  return {
    consulta: ((consulta.data ?? []) as ConsultaTcu[])[0] ?? null,
    tces: (tces.data ?? []) as TceTcu[],
    referencia: ex.referencia,
  };
}

// ================================================================ painel (administrador)

export type LeituraContas =
  | Falha
  | { estado: "ok"; execucao: ExecucaoTcu; linhas: LinhaTcePainel[] };

/** Todas as TCE da última rodada, com município, proponente e órgão do painel de execução. */
export async function lerPainelContas(): Promise<LeituraContas> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ex = await execucaoTcu(db, "lerPainelContas");
  if (ehFalha(ex)) return ex;
  const tces = await todas<TceTcu>("lerPainelContas (TCE)", (a, b) =>
    db.from("tcu_tce").select("*").eq("execucao_id", ex.id).order("nr_convenio").order("codigo").range(a, b),
  );
  if (!Array.isArray(tces)) return { estado: "erro" };

  // O nome do município e do proponente vêm do painel (última execução); faltar não derruba a lista.
  const nrs = [...new Set(tces.map((t) => t.nr_convenio))];
  const info = new Map<string, { municipio: string | null; proponente: string | null; orgao_sup: string | null; situacao: string | null }>();
  const painel = await db.rpc("painel_ultima_execucao");
  const idPainel = (painel.data as { id: number }[] | null)?.[0]?.id;
  if (idPainel && nrs.length) {
    for (let k = 0; k < nrs.length; k += 200) {
      const r = await db
        .from("painel_instrumento")
        .select("nr_convenio,municipio,proponente,orgao_sup,situacao")
        .eq("execucao_id", idPainel)
        .in("nr_convenio", nrs.slice(k, k + 200));
      if (r.error) {
        console.error("lerPainelContas (painel):", r.error.message);
        break;
      }
      for (const x of (r.data ?? []) as { nr_convenio: string; municipio: string | null; proponente: string | null; orgao_sup: string | null; situacao: string | null }[])
        info.set(x.nr_convenio, x);
    }
  }
  return {
    estado: "ok",
    execucao: ex,
    linhas: tces.map((t) => {
      const i = info.get(t.nr_convenio);
      return { ...t, municipio: i?.municipio ?? null, proponente: i?.proponente ?? null, orgao_sup: i?.orgao_sup ?? null, situacao_convenio: i?.situacao ?? null };
    }),
  };
}
