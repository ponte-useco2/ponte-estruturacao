/**
 * Leitura da página do Brasil (U2, 08/10/2026) — só servidor, só chave de serviço.
 *
 * Tudo vem pronto de tabelas agregadas, sem somar instrumento a instrumento: as somas por UF e para o Brasil
 * (`painel_territorio`, do job), o funil das propostas por UF (`painel_programa_desfecho`), o tempo das etapas
 * (`painel_etapa_tempo`), o Pix e o fundo a fundo por ano e as janelas abertas por UF (`radar_programa_aberto`).
 * Cada fonte falha sozinha; memória de 10 minutos.
 *
 * Onda 7, A (09/10/2026): a memória ganha a camada comum às instâncias (`cache-dados.server.ts`), também de 10 minutos.
 * Lá só entra a leitura inteira (sem faltas); a com falta fica só nesta instância, como antes. As janelas por UF são
 * um `Map`, que o JSON do cache não guarda: vão como lista de pares e voltam `Map`.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { VALIDADE_DADOS_MS } from "./cache-dados";
import { camadaDoCacheDeDados } from "./cache-dados.server";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import { janelasPorUf } from "./pagina-brasil";
import type { LinhaTerritorio } from "./pagina-uf";
import type { LeituraUfOk } from "./pagina-uf.server";
import { todas } from "./padroes.server";
import type { LinhaDesfecho, LinhaEtapa } from "./painel";
import type { LinhaEspecialAno, LinhaFundoAno } from "./pix";

type Resposta = { data: unknown; error: { message: string; code?: string } | null };

export interface LeituraBrasilOk {
  estado: "ok";
  execucao: LeituraUfOk["execucao"];
  /** Total e situação de todas as UFs e do Brasil; órgão e tema só do Brasil. */
  territorio: LinhaTerritorio[] | null;
  desfechos: LinhaDesfecho[] | null;
  etapas: LinhaEtapa[] | null;
  pix: LinhaEspecialAno[] | null;
  fundo: LinhaFundoAno[] | null;
  janelas: Map<string, number> | null;
  /** Programas distintos com janela aberta em alguma UF. */
  programasAbertos: number | null;
  /**
   * A data do dado do Pix e a das janelas (C1b, 08/10/2026), para as fontes do relatório dizerem a de cada uma. Vêm na
   * mesma chamada que já dava o id da última execução: nenhuma leitura a mais.
   */
  pixDadoAte: string | null;
  janelasDadoAte: string | null;
  faltas: string[];
}

export type LeituraBrasil = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" } | LeituraBrasilOk;

async function ler<T>(faltas: string[], nome: string, consulta: PromiseLike<Resposta>): Promise<T | null> {
  const r = await consulta;
  if (r.error) {
    if (!ehEsquemaAusente(r.error.code)) {
      console.error(`página do Brasil (${nome}):`, r.error.message);
      faltas.push(nome);
    }
    return null;
  }
  return r.data as T;
}

/** O `Map` das janelas por UF vai ao cache como lista de pares (o JSON não guarda `Map`) e volta `Map`. */
const paraGuardar = (l: LeituraBrasil): unknown => (l.estado === "ok" && l.janelas ? { ...l, janelas: [...l.janelas] } : l);
const doGuardado = (x: unknown): LeituraBrasil => {
  const l = x as LeituraBrasil;
  const janelas = (x as { janelas?: unknown }).janelas;
  return l.estado === "ok" && Array.isArray(janelas) ? { ...l, janelas: new Map(janelas as [string, number][]) } : l;
};

const memoria = criarMemoria<LeituraBrasil>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 2,
  guardar: (l) => l.estado === "ok",
  compartilhada: camadaDoCacheDeDados<LeituraBrasil>({
    leitor: "brasil",
    guardavel: (l) => l.estado === "ok" && l.faltas.length === 0,
    paraGuardar,
    doGuardado,
  }),
});

/** A página do Brasil, da memória quando há. Não altere o objeto devolvido. */
export function lerBrasil(): Promise<LeituraBrasil> {
  return memoria.obter("BR", lerDoBanco);
}

async function lerDoBanco(): Promise<LeituraBrasil> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const faltas: string[] = [];

  const painel = await db.rpc("painel_ultima_execucao");
  if (painel.error) {
    if (ehEsquemaAusente(painel.error.code)) return { estado: "nao_ativado" };
    console.error("página do Brasil (painel):", painel.error.message);
    return { estado: "erro" };
  }
  const ex = ((painel.data as LeituraBrasilOk["execucao"][] | null) ?? [])[0];
  if (!ex) return { estado: "sem_execucao" };

  const ultima = async (rpc: string) => {
    const r = await db.rpc(rpc);
    return r.error ? null : (((r.data as { id: number; dado_ate: string | null }[] | null) ?? [])[0] ?? null);
  };
  const [pixEx, radarEx] = await Promise.all([ultima("pix_ultima_execucao"), ultima("radar_ultima_execucao")]);
  const pixId = pixEx?.id ?? null;
  const radarId = radarEx?.id ?? null;
  const colunas = "recorte,dimensao,chave,vivo,n,em_execucao,valor,desembolsado,municipios,proponentes";

  const [ufs, nacional, desfechos, etapas, pix, fundo, janelas] = await Promise.all([
    ler<LinhaTerritorio[]>(faltas, "somas por UF", db.from("painel_territorio").select(colunas).eq("execucao_id", ex.id).in("dimensao", ["total", "situacao"]).limit(1000)),
    ler<LinhaTerritorio[]>(faltas, "somas do Brasil", db.from("painel_territorio").select(colunas).eq("execucao_id", ex.id).eq("recorte", "BR").in("dimensao", ["orgao", "tema"]).limit(1000)),
    ler<LinhaDesfecho[]>(faltas, "funil", db.from("painel_programa_desfecho").select("*").eq("execucao_id", ex.id).is("cod_programa", null).is("orgao_sup", null).limit(1000)),
    ler<LinhaEtapa[]>(faltas, "tempos", db.from("painel_etapa_tempo").select("*").eq("execucao_id", ex.id).eq("recorte", "BR").eq("dimensao", "orgao").limit(1000)),
    pixId ? ler<LinhaEspecialAno[]>(faltas, "Pix", db.from("pix_especial_ano").select("*").eq("execucao_id", pixId).limit(1000)) : Promise.resolve(null),
    pixId ? ler<LinhaFundoAno[]>(faltas, "fundo a fundo", db.from("pix_fundo_ano").select("*").eq("execucao_id", pixId).eq("recorte", "BR").limit(1000)) : Promise.resolve(null),
    radarId
      ? todas<{ uf: string | null; cod_programa: string | null }>("página do Brasil (janelas)", (a, b) =>
          db.from("radar_programa_aberto").select("uf,cod_programa").eq("execucao_id", radarId).order("uf").order("cod_programa").range(a, b),
        ).then((r) => (Array.isArray(r) ? r : (faltas.push("janelas"), null)))
      : Promise.resolve(null),
  ]);

  const territorio = ufs || nacional ? [...(ufs ?? []), ...(nacional ?? [])].map((l) => ({ ...l, valor: Number(l.valor), desembolsado: Number(l.desembolsado) })) : null;
  return {
    estado: "ok",
    execucao: ex,
    territorio: territorio?.length ? territorio : null,
    desfechos,
    etapas,
    pix: pix ? pix.map((p) => ({ ...p, pago: Number(p.pago) })) : null,
    fundo,
    janelas: janelas ? janelasPorUf(janelas) : null,
    programasAbertos: janelas ? new Set(janelas.map((j) => j.cod_programa).filter(Boolean)).size : null,
    pixDadoAte: pixEx?.dado_ate ?? null,
    janelasDadoAte: radarEx?.dado_ate ?? null,
    faltas,
  };
}
