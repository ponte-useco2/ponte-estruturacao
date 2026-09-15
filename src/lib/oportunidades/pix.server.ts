/**
 * Leitura de "Pix e fundo a fundo" no Supabase — só servidor, só chave de serviço.
 *
 * As tabelas da `oport_13` não aceitam `anon` nem `authenticated`. Quem decide se a
 * pessoa pode ver é a página, com `ehAdministrador`. Os agregados são poucas centenas de
 * linhas por recorte; as listas de planos (só da UF que o job detalha) vêm já filtradas e
 * ordenadas pelo banco, porque a API devolve no máximo 1.000 linhas por chamada.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import type {
  ExecucaoPix,
  LinhaEspecialAno,
  LinhaEspecialMotivo,
  LinhaFundoAno,
  LinhaFundoRelatorio,
  ParametrosPix,
  PlanoEspecial,
  PlanoFundo,
} from "./pix";

export const LIMITE_LISTA = 50;
/** O mesmo piso do job (pix_fundo/fundo.py, SALDO_MINIMO). */
const SALDO_MINIMO = 1000;
const DESC = { ascending: false, nullsFirst: false } as const;

export interface ListasEspeciais {
  semRelatorio: PlanoEspecial[];
  impedidos: PlanoEspecial[];
  encerradaSemFinal: PlanoEspecial[];
}

export interface ListasFundo {
  parados: PlanoFundo[];
  encerradosComSaldo: PlanoFundo[];
  aguardandoAnalise: PlanoFundo[];
}

export type LeituraPix =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro"; mensagem: string }
  | {
      estado: "ok";
      execucao: ExecucaoPix;
      /** A UF que o job detalha plano a plano (PB). */
      ufLista: string;
      anos: LinhaEspecialAno[];
      motivos: LinhaEspecialMotivo[];
      fundoAnos: LinhaFundoAno[];
      relatorios: LinhaFundoRelatorio[];
      /** Só quando o recorte é a UF da lista. */
      especiais: ListasEspeciais | null;
      fundo: ListasFundo | null;
    };

type Resposta<T> = { data: T[] | null; error: { message: string; code?: string } | null };

export async function lerPix(p: ParametrosPix): Promise<LeituraPix> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();

  const ultima = await db.rpc("pix_ultima_execucao");
  if (ultima.error) {
    if (ehEsquemaAusente(ultima.error.code)) return { estado: "nao_ativado" };
    console.error("lerPix:", ultima.error.message);
    return { estado: "erro", mensagem: ultima.error.message };
  }
  const execucao = (ultima.data as ExecucaoPix[] | null)?.[0];
  if (!execucao) return { estado: "sem_execucao" };

  const recorte = p.uf ?? "BR";
  const ufLista = typeof execucao.contagens.uf_lista === "string" ? execucao.contagens.uf_lista : "PB";
  const detalhe = p.uf === ufLista;
  const doRecorte = (tabela: string) => db.from(tabela).select("*").eq("execucao_id", execucao.id).eq("recorte", recorte).limit(1000);
  const planos = (tabela: string) => db.from(tabela).select("*").eq("execucao_id", execucao.id).limit(LIMITE_LISTA);
  const vazio = Promise.resolve({ data: [], error: null });

  const consultas = await Promise.all([
    doRecorte("pix_especial_ano"),
    doRecorte("pix_especial_motivo"),
    doRecorte("pix_fundo_ano"),
    doRecorte("pix_fundo_relatorio"),
    detalhe && p.aba === "especiais" ? planos("pix_especial_plano").eq("sem_relatorio_12m", true).order("pago", DESC) : vazio,
    detalhe && p.aba === "especiais"
      ? planos("pix_especial_plano").like("situacao", "IMPEDIDO%").order("ano", DESC).order("valor", DESC)
      : vazio,
    detalhe && p.aba === "especiais" ? planos("pix_especial_plano").eq("encerrada_sem_final", true).order("pago", DESC) : vazio,
    detalhe && p.aba === "fundo" ? planos("pix_fundo_plano").eq("parado_12m", true).order("saldo_contas", DESC) : vazio,
    detalhe && p.aba === "fundo"
      ? planos("pix_fundo_plano").eq("vigencia_encerrada", true).gt("saldo_contas", SALDO_MINIMO).order("saldo_contas", DESC)
      : vazio,
    detalhe && p.aba === "fundo"
      ? planos("pix_fundo_plano").eq("situacao_relatorio", "ENVIADO_ANALISE").order("dt_relatorio", { ascending: true })
      : vazio,
  ] as PromiseLike<Resposta<unknown>>[]);

  const erro = consultas.find((c) => c.error)?.error;
  if (erro) {
    console.error("lerPix:", erro.message);
    return { estado: "erro", mensagem: erro.message };
  }
  const [anos, motivos, fundoAnos, relatorios, semRelatorio, impedidos, encerradaSemFinal, parados, encerradosComSaldo, aguardando] =
    consultas.map((c) => c.data ?? []);

  return {
    estado: "ok",
    execucao,
    ufLista,
    anos: anos as LinhaEspecialAno[],
    motivos: motivos as LinhaEspecialMotivo[],
    fundoAnos: fundoAnos as LinhaFundoAno[],
    relatorios: relatorios as LinhaFundoRelatorio[],
    especiais:
      detalhe && p.aba === "especiais"
        ? {
            semRelatorio: semRelatorio as PlanoEspecial[],
            impedidos: impedidos as PlanoEspecial[],
            encerradaSemFinal: encerradaSemFinal as PlanoEspecial[],
          }
        : null,
    fundo:
      detalhe && p.aba === "fundo"
        ? {
            parados: parados as PlanoFundo[],
            encerradosComSaldo: encerradosComSaldo as PlanoFundo[],
            aguardandoAnalise: aguardando as PlanoFundo[],
          }
        : null,
  };
}
