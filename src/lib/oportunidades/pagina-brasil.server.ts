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
 *
 * Onda 8, B (09/10/2026; R2 de 09/10, §4.1): a leitura a frio passa de 6 idas e voltas em série para 2, com os mesmos 13
 * pedidos. As três últimas execuções (painel, Pix e radar) vão juntas, e as janelas, em quatro faixas da UF ao mesmo
 * tempo (`lerJanelasEmFaixas`), em vez de 4 páginas por OFFSET uma depois da outra. O resultado é o mesmo.
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

  const ultima = async (rpc: string) => {
    const r = await db.rpc(rpc);
    return r.error ? null : (((r.data as { id: number; dado_ate: string | null }[] | null) ?? [])[0] ?? null);
  };
  // Onda 8, B (09/10/2026): as três últimas execuções numa ida só. Antes, a do Pix e a do radar esperavam a do painel,
  // uma ida e volta a mais (~300 ms de iad1 a Oregon, R2 §2.9). Sem o painel, o resultado é o mesmo de antes: as outras
  // duas leituras se perdem, e a página diz "não ativado", "erro" ou "sem execução".
  const [painel, pixEx, radarEx] = await Promise.all([db.rpc("painel_ultima_execucao"), ultima("pix_ultima_execucao"), ultima("radar_ultima_execucao")]);
  if (painel.error) {
    if (ehEsquemaAusente(painel.error.code)) return { estado: "nao_ativado" };
    console.error("página do Brasil (painel):", painel.error.message);
    return { estado: "erro" };
  }
  const ex = ((painel.data as LeituraBrasilOk["execucao"][] | null) ?? [])[0];
  if (!ex) return { estado: "sem_execucao" };

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
    radarId ? lerJanelasEmFaixas(db, radarId).then((r) => r ?? (faltas.push("janelas"), null)) : Promise.resolve(null),
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

type LinhaJanela = { uf: string | null; cod_programa: string | null };

/**
 * As faixas da UF em que as janelas abertas são lidas (onda 8, B, 09/10/2026). Cobrem a chave inteira, sem buraco nem
 * sobreposição: cada faixa vai de `de` (inclusive) a `ate` (exclusive), e a última leva também a UF nula. Em 09/10, com
 * 7, 6, 7 e 7 UFs, tinham 841, 717, 843 e 844 linhas (de 117 a 126 janelas por UF, na execução 44 do radar).
 */
const FAIXAS_UF: readonly { de: string | null; ate: string | null }[] = [
  { de: null, ate: "ES" }, // AC AL AM AP BA CE DF
  { de: "ES", ate: "PA" }, // ES GO MA MG MS MT
  { de: "PA", ate: "RO" }, // PA PB PE PI PR RJ RN
  { de: "RO", ate: null }, // RO RR RS SC SE SP TO, e a UF nula
];

/**
 * As janelas abertas, em quatro leituras ao mesmo tempo, uma por faixa da UF (onda 8, B, 09/10/2026; R2 de 09/10, §2.1
 * e §5.5 item 4). Antes eram as 3.245 linhas em 4 páginas de mil por OFFSET, uma depois da outra: 4 idas e voltas em
 * série (~1,2 s só de rede, de iad1 a Oregon), e cada página refazia a ordenação inteira (a 4ª lia as 3.245 linhas).
 * Agora: os mesmos 4 pedidos, numa ida só, cada um pelo índice `(execucao_id, uf)`, só na sua faixa.
 *
 * O resultado é o mesmo: as faixas cobrem a chave inteira e, juntas na ordem, dão as mesmas linhas, na mesma ordem, da
 * leitura única ordenada por UF e programa (com a UF nula no fim, como no `order=uf.asc` do banco). Conferido pelo MCP
 * em 09/10: 3.245 linhas e o mesmo md5 nas duas formas. A faixa que passar de mil linhas pagina sozinha, como antes.
 * Qualquer faixa que falhe vira a falta "janelas", como a leitura inteira fazia.
 */
async function lerJanelasEmFaixas(db: ReturnType<typeof clienteServidor>, radarId: number): Promise<LinhaJanela[] | null> {
  const partes = await Promise.all(
    FAIXAS_UF.map(({ de, ate }) =>
      todas<LinhaJanela>(`página do Brasil (janelas, ${de ?? "início"} a ${ate ?? "fim"})`, (a, b) => {
        let q = db.from("radar_programa_aberto").select("uf,cod_programa").eq("execucao_id", radarId);
        if (de && ate) q = q.gte("uf", de).lt("uf", ate);
        else if (ate) q = q.lt("uf", ate);
        else if (de) q = q.or(`uf.gte.${de},uf.is.null`);
        return q.order("uf").order("cod_programa").range(a, b);
      }),
    ),
  );
  const linhas: LinhaJanela[] = [];
  for (const p of partes) {
    if (!Array.isArray(p)) return null;
    linhas.push(...p);
  }
  return linhas;
}
