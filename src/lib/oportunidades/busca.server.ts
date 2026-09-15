/**
 * Leitura da busca, do instrumento, da proposta e dos investimentos — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página (usuário aprovado). As tabelas e funções da
 * `oport_14` não aceitam `anon` nem `authenticated`; daqui para baixo, a leitura é da chave de
 * serviço, e só da última execução concluída do painel.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import {
  LIMITE_POR_PAGINA,
  desfechosDoGrupo,
  situacoesDoGrupo,
  termosDaBusca,
  type EventoInstrumento,
  type Instrumento,
  type InstrumentoBusca,
  type LinhaInvestimento,
  type ParametrosBusca,
  type PropostaBusca,
} from "./busca";
import { ehEsquemaAusente } from "./esquema";
import type { LinhaEtapa, PropostaPainel } from "./painel";

export interface ExecucaoBusca {
  id: number;
  dado_ate: string;
  referencia: string;
}

export interface OpcaoMunicipioBusca {
  cod_ibge: string;
  municipio: string | null;
}

type Falha = { estado: "nao_ativado" } | { estado: "sem_execucao" } | { estado: "erro" };
type Banco = ReturnType<typeof clienteServidor>;

/** Máximo de eventos numa linha do tempo. O maior convênio da PB em 14/09/2026 tinha 1,3 mil. */
const LIMITE_EVENTOS = 5000;

async function execucaoAtual(db: Banco, onde: string): Promise<ExecucaoBusca | Falha> {
  const ultima = await db.rpc("painel_ultima_execucao");
  if (ultima.error) {
    if (ehEsquemaAusente(ultima.error.code)) return { estado: "nao_ativado" };
    console.error(`${onde}:`, ultima.error.message);
    return { estado: "erro" };
  }
  const ex = (ultima.data as ExecucaoBusca[] | null)?.[0];
  return ex ?? { estado: "sem_execucao" };
}

function ehFalha(x: ExecucaoBusca | Falha): x is Falha {
  return "estado" in x;
}

/** Erro de tabela ou função que ainda não existe (oport_14 não aplicada) vira "não ativado". */
function falhaDe(onde: string, erro: { message: string; code?: string }): Falha {
  if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
  console.error(`${onde}:`, erro.message);
  return { estado: "erro" };
}

// ============================ BUSCA ============================

export type LeituraBusca =
  | Falha
  | {
      estado: "ok";
      execucao: ExecucaoBusca;
      instrumentos: InstrumentoBusca[];
      propostas: PropostaBusca[];
      total: number;
      municipios: OpcaoMunicipioBusca[];
    };

export async function lerBusca(p: ParametrosBusca): Promise<LeituraBusca> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ex = await execucaoAtual(db, "lerBusca");
  if (ehFalha(ex)) return ex;

  const termos = termosDaBusca(p.q);
  const comuns = {
    p_termos: termos.length ? termos : null,
    p_uf: p.uf,
    p_ibge: p.municipio,
    p_tema: p.tema,
    p_limite: LIMITE_POR_PAGINA,
    p_offset: (p.pagina - 1) * LIMITE_POR_PAGINA,
  };
  const [lista, municipios] = await Promise.all([
    p.aba === "instrumentos"
      ? db.rpc("painel_busca_instrumentos", { ...comuns, p_situacoes: situacoesDoGrupo(p.grupo) })
      : db.rpc("painel_busca_propostas", { ...comuns, p_desfechos: desfechosDoGrupo(p.grupo) }),
    p.uf ? db.rpc("painel_municipios", { p_uf: p.uf }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (lista.error) return falhaDe("lerBusca", lista.error);
  // O seletor de município é conveniência: sem ele a busca continua.
  if (municipios.error) console.error("lerBusca (municípios):", municipios.error.message);

  const linhas = (lista.data ?? []) as (InstrumentoBusca | PropostaBusca)[];
  return {
    estado: "ok",
    execucao: ex,
    instrumentos: p.aba === "instrumentos" ? (linhas as InstrumentoBusca[]) : [],
    propostas: p.aba === "propostas" ? (linhas as PropostaBusca[]) : [],
    total: Number(linhas[0]?.total ?? 0),
    municipios: ((municipios.data ?? []) as OpcaoMunicipioBusca[]).map((m) => ({ cod_ibge: m.cod_ibge, municipio: m.municipio })),
  };
}

// ============================ INSTRUMENTO ============================

export type LeituraInstrumento =
  | Falha
  | { estado: "nao_encontrado"; execucao: ExecucaoBusca }
  | { estado: "ok"; execucao: ExecucaoBusca; instrumento: Instrumento; eventos: EventoInstrumento[]; eventosTruncados: boolean };

export async function lerInstrumento(nr: string): Promise<LeituraInstrumento> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ex = await execucaoAtual(db, "lerInstrumento");
  if (ehFalha(ex)) return ex;

  const linha = await db.from("painel_instrumento").select("*").eq("execucao_id", ex.id).eq("nr_convenio", nr).limit(1);
  if (linha.error) return falhaDe("lerInstrumento", linha.error);
  const instrumento = (linha.data as Instrumento[] | null)?.[0];
  if (!instrumento) return { estado: "nao_encontrado", execucao: ex };

  // A API devolve no máximo 1.000 linhas por chamada: a linha do tempo vem em páginas.
  const eventos: EventoInstrumento[] = [];
  if (instrumento.detalhe) {
    for (let inicio = 0; inicio < LIMITE_EVENTOS; inicio += 1000) {
      const pagina = await db
        .from("painel_instrumento_evento")
        .select("data,tipo,descricao,categoria,valor,quantidade,data_fim")
        .eq("execucao_id", ex.id)
        .eq("nr_convenio", nr)
        .order("data", { ascending: true })
        .order("tipo", { ascending: true })
        .range(inicio, inicio + 999);
      if (pagina.error) return falhaDe("lerInstrumento (eventos)", pagina.error);
      const lote = (pagina.data ?? []) as EventoInstrumento[];
      eventos.push(...lote);
      if (lote.length < 1000) break;
    }
  }
  return { estado: "ok", execucao: ex, instrumento, eventos, eventosTruncados: eventos.length >= LIMITE_EVENTOS };
}

// ============================ PROPOSTA ============================

export interface PropostaCompleta extends PropostaPainel {
  uf: string | null;
  cod_ibge: string | null;
  municipio: string | null;
  temas: string[];
}

export type LeituraProposta =
  | Falha
  | { estado: "nao_encontrado"; execucao: ExecucaoBusca }
  | {
      estado: "ok";
      execucao: ExecucaoBusca;
      proposta: PropostaCompleta;
      /** Medianas do órgão da proposta: na UF dela e no Brasil. */
      etapasUf: LinhaEtapa[];
      etapasBr: LinhaEtapa[];
      /** O convênio que a proposta virou, quando está na busca. */
      convenioNaBusca: boolean;
    };

export async function lerProposta(id: string): Promise<LeituraProposta> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ex = await execucaoAtual(db, "lerProposta");
  if (ehFalha(ex)) return ex;

  const linha = await db.from("painel_proposta").select("*").eq("execucao_id", ex.id).eq("id_proposta", id).limit(1);
  if (linha.error) return falhaDe("lerProposta", linha.error);
  const proposta = (linha.data as PropostaCompleta[] | null)?.[0];
  if (!proposta) return { estado: "nao_encontrado", execucao: ex };

  const etapas = (recorte: string) =>
    proposta.orgao_sup
      ? db
          .from("painel_etapa_tempo")
          .select("*")
          .eq("execucao_id", ex.id)
          .eq("recorte", recorte)
          .eq("dimensao", "orgao")
          .eq("chave", proposta.orgao_sup)
          .limit(50)
      : Promise.resolve({ data: [], error: null });
  const [uf, br, conv] = await Promise.all([
    proposta.uf ? etapas(proposta.uf) : Promise.resolve({ data: [], error: null }),
    etapas("BR"),
    proposta.nr_convenio
      ? db.from("painel_instrumento").select("nr_convenio").eq("execucao_id", ex.id).eq("nr_convenio", proposta.nr_convenio).limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const erro = uf.error ?? br.error ?? conv.error;
  if (erro) return falhaDe("lerProposta (etapas)", erro);
  return {
    estado: "ok",
    execucao: ex,
    proposta,
    etapasUf: (uf.data ?? []) as LinhaEtapa[],
    etapasBr: (br.data ?? []) as LinhaEtapa[],
    convenioNaBusca: (conv.data ?? []).length > 0,
  };
}

// ============================ INVESTIMENTOS ============================

export type LeituraInvestimentos =
  | Falha
  | { estado: "ok"; execucao: ExecucaoBusca; linhas: LinhaInvestimento[]; municipio: string | null };

export async function lerInvestimentos(ibge: string): Promise<LeituraInvestimentos> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ex = await execucaoAtual(db, "lerInvestimentos");
  if (ehFalha(ex)) return ex;

  const [linhas, nome, nomeProposta] = await Promise.all([
    db.rpc("painel_investimentos_municipio", { p_ibge: ibge }),
    db.from("painel_instrumento").select("municipio").eq("execucao_id", ex.id).eq("cod_ibge", ibge).not("municipio", "is", null).limit(1),
    db.from("painel_proposta").select("municipio").eq("execucao_id", ex.id).eq("cod_ibge", ibge).not("municipio", "is", null).limit(1),
  ]);
  if (linhas.error) return falhaDe("lerInvestimentos", linhas.error);
  const municipio =
    (nome.data as { municipio: string }[] | null)?.[0]?.municipio ??
    (nomeProposta.data as { municipio: string }[] | null)?.[0]?.municipio ??
    null;
  return { estado: "ok", execucao: ex, linhas: (linhas.data ?? []) as LinhaInvestimento[], municipio };
}
