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
  buscaSemFiltro,
  desfechosDoGrupo,
  situacoesDoGrupo,
  termosDaBusca,
  type EventoInstrumento,
  type Instrumento,
  type InstrumentoBusca,
  type LinhaInvestimento,
  type ParametrosBusca,
  type PropostaBusca,
  urlInstrumento,
} from "./busca";
import {
  CANDIDATOS_PB,
  casarMunicipios,
  municipiosDaBusca,
  ondeProcurarMunicipio,
  pareceMunicipio,
  regexMunicipio,
  type MunicipioAchado,
  type MunicipioNome,
} from "./busca-municipio";
import {
  LIMITE_GRUPO,
  MOTIVO_MUNICIPIO_FORA,
  casarEntidades,
  entidadeAchada,
  escopoUnificado,
  type EntidadeAchada,
  type Entrada,
  type GrupoLido,
  type ProponenteBusca,
} from "./busca-unificada";
import { VALIDADE_DADOS_MS } from "./cache-dados";
import { camadaDoCacheDeDados } from "./cache-dados.server";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import { nomeOsc, type FonteOsc } from "./osc";
import { buscarOsc, lerCadastroOsc, type OscBusca } from "./osc.server";
import { todas } from "./padroes.server";
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
      /** O cadastro do Mapa das OSC (E3); `fonteOsc` null quando não há cadastro. */
      organizacoes: OscBusca[];
      fonteOsc: FonteOsc | null;
      total: number;
      municipios: OpcaoMunicipioBusca[];
      /**
       * Os municípios cujo nome casa com o que se digitou (B12), para o grupo "Municípios" no topo, e se há mais
       * além dos mostrados. Vazio quando o termo não parece nome de município.
       */
      municipiosAchados: MunicipioAchado[];
      maisMunicipios: boolean;
      /** Convênios ou propostas sem termo nem filtro: nada foi consultado (`buscaSemFiltro`). */
      semFiltro?: boolean;
    };

/** Quantos nomes de fora da PB a peneira do banco traz; `casarMunicipios` escolhe os melhores entre eles. */
const LIMITE_NOMES_FORA_PB = 60;

/**
 * Os municípios de fora da PB cujo nome casa com o termo (B12), em `painel_municipio`: uma linha por município com
 * sinal no painel, 3,7 mil no total; com a peneira de `regexMunicipio`, de 4 a 13 ms medidos com EXPLAIN ANALYZE em
 * 08/10/2026 (no caso mais largo, "sao", 224 nomes casam e vêm os 60 primeiros). Se falhar, a busca segue sem eles:
 * null, para a busca unificada (C2) dizer que faltaram os de fora da PB.
 */
async function nomesForaDaPb(db: Banco, execucaoId: number, q: string): Promise<MunicipioNome[] | null> {
  const re = regexMunicipio(q);
  if (!re) return [];
  const r = await db
    .from("painel_municipio")
    .select("cod_ibge,municipio")
    .eq("execucao_id", execucaoId)
    .neq("uf", "PB")
    .regexIMatch("municipio", re)
    .order("municipio")
    .limit(LIMITE_NOMES_FORA_PB);
  if (r.error) {
    console.error("lerBusca (municípios pelo nome):", r.error.message);
    return null;
  }
  return ((r.data ?? []) as OpcaoMunicipioBusca[]).flatMap((m) => (m.municipio ? [{ ibge: m.cod_ibge, nome: m.municipio }] : []));
}

const comoCandidatos = (lista: OpcaoMunicipioBusca[]): MunicipioNome[] =>
  lista.flatMap((m) => (m.municipio ? [{ ibge: m.cod_ibge, nome: m.municipio }] : []));

export async function lerBusca(p: ParametrosBusca): Promise<LeituraBusca> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ex = await execucaoAtual(db, "lerBusca");
  if (ehFalha(ex)) return ex;

  const termos = termosDaBusca(p.q);
  const nenhumMunicipio = { municipiosAchados: [], maisMunicipios: false };
  if (buscaSemFiltro(p)) {
    return { estado: "ok", execucao: ex, instrumentos: [], propostas: [], organizacoes: [], fonteOsc: null, total: 0, municipios: [], ...nenhumMunicipio, semFiltro: true };
  }
  // B12: o nome do município. Na PB e com UF escolhida, das listas que já existem; sem UF, também a consulta pelo nome
  // fora da PB, em paralelo com a busca (não soma tempo: ela leva milissegundos, a busca leva segundos).
  const onde = ondeProcurarMunicipio(p);
  const fora =
    onde === "brasil"
      ? nomesForaDaPb(db, ex.id, p.q).then(
          (l) => l ?? [],
          (e: unknown) => {
            console.error("lerBusca (municípios pelo nome):", e instanceof Error ? e.message : e);
            return [] as MunicipioNome[];
          },
        )
      : Promise.resolve([] as MunicipioNome[]);
  const grupoDeMunicipios = (daUf: OpcaoMunicipioBusca[], deFora: MunicipioNome[]) => {
    if (!onde) return nenhumMunicipio;
    const candidatos = onde === "uf" ? comoCandidatos(daUf) : [...CANDIDATOS_PB, ...deFora];
    const r = municipiosDaBusca(p.q, candidatos);
    return { municipiosAchados: r.achados, maisMunicipios: r.mais };
  };

  if (p.aba === "organizacoes") {
    const [osc, municipios] = await Promise.all([
      buscarOsc(termos, p.municipio, LIMITE_POR_PAGINA, (p.pagina - 1) * LIMITE_POR_PAGINA),
      db.rpc("painel_municipios", { p_uf: "PB" }),
    ]);
    if (municipios.error) console.error("lerBusca (municípios):", municipios.error.message);
    return {
      estado: "ok",
      execucao: ex,
      instrumentos: [],
      propostas: [],
      organizacoes: osc?.linhas ?? [],
      fonteOsc: osc?.fonte ?? null,
      total: osc?.total ?? 0,
      municipios: ((municipios.data ?? []) as OpcaoMunicipioBusca[]).map((m) => ({ cod_ibge: m.cod_ibge, municipio: m.municipio })),
      ...grupoDeMunicipios([], []),
    };
  }
  const comuns = {
    p_termos: termos.length ? termos : null,
    p_uf: p.uf,
    p_ibge: p.municipio,
    p_tema: p.tema,
    p_limite: LIMITE_POR_PAGINA,
    p_offset: (p.pagina - 1) * LIMITE_POR_PAGINA,
  };
  const [lista, municipios, deFora] = await Promise.all([
    p.aba === "instrumentos"
      ? db.rpc("painel_busca_instrumentos", { ...comuns, p_situacoes: situacoesDoGrupo(p.grupo) })
      : db.rpc("painel_busca_propostas", { ...comuns, p_desfechos: desfechosDoGrupo(p.grupo) }),
    p.uf ? db.rpc("painel_municipios", { p_uf: p.uf }) : Promise.resolve({ data: [], error: null }),
    fora,
  ]);
  if (lista.error) return falhaDe("lerBusca", lista.error);
  // O seletor de município é conveniência: sem ele a busca continua.
  if (municipios.error) console.error("lerBusca (municípios):", municipios.error.message);

  const linhas = (lista.data ?? []) as (InstrumentoBusca | PropostaBusca)[];
  const daUf = ((municipios.data ?? []) as OpcaoMunicipioBusca[]).map((m) => ({ cod_ibge: m.cod_ibge, municipio: m.municipio }));
  return {
    estado: "ok",
    execucao: ex,
    instrumentos: p.aba === "instrumentos" ? (linhas as InstrumentoBusca[]) : [],
    propostas: p.aba === "propostas" ? (linhas as PropostaBusca[]) : [],
    organizacoes: [],
    fonteOsc: null,
    total: Number(linhas[0]?.total ?? 0),
    municipios: daUf,
    ...grupoDeMunicipios(daUf, deFora),
  };
}

// ============================ BUSCA UNIFICADA (C2) ============================

/**
 * Os proponentes da PB com convênio, para as entidades pelo nome (C2, 08/10/2026). É a mesma função da página da UF
 * (`painel_territorio_proponente`, pelo índice da UF): 498 linhas e 36 ms medidos com EXPLAIN ANALYZE na execução 42
 * (a primeira chamada, com a instância parada, levou 1,9 s com tudo no cache). A lista muda uma vez por dia: fica 10
 * minutos na memória da instância, e o casamento pelo nome (`casarEntidades`) é feito aqui, sem banco.
 *
 * Onda 7, A (09/10/2026): também no cache comum às instâncias (`cache-dados.server.ts`), 10 minutos, pela mesma chave
 * — a execução do painel, que a busca já leu: rodada nova, chave nova.
 */
const memoriaProponentesPb = criarMemoria<ProponenteBusca[] | null>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 3,
  guardar: (l) => l !== null,
  compartilhada: camadaDoCacheDeDados<ProponenteBusca[] | null>({ leitor: "proponentes-pb", guardavel: (l) => l !== null }),
});

function proponentesDaPb(db: Banco, execucaoId: number): Promise<ProponenteBusca[] | null> {
  return memoriaProponentesPb.obter(String(execucaoId), async () => {
    const r = await todas<ProponenteBusca>("busca unificada (entidades da PB)", (a, b) =>
      db.rpc("painel_territorio_proponente", { p_execucao: execucaoId, p_uf: "PB" }).order("cnpj").range(a, b),
    );
    return Array.isArray(r) ? r : null;
  });
}

type LinhaProponente = { proponente: string | null; tipo_agente: string | null; uf: string | null; municipio: string | null };

/**
 * A entidade de um CNPJ completo, de qualquer UF: o primeiro convênio, a primeira proposta ou o cadastro das OSC — os
 * mesmos três lugares que decidem se a página da entidade existe (`lerRelatorioEntidade`). Três leituras por índice,
 * em paralelo (de 0,1 a 2 ms cada, medidas em 08/10/2026). Sem ordenar: com ordem, o CNPJ de 188 convênios lia todos.
 */
async function entidadePorCnpj(db: Banco, execucaoId: number, cnpj: string): Promise<EntidadeAchada | null> {
  const colunas = "proponente,tipo_agente,uf,municipio";
  const [ins, pro, osc] = await Promise.all([
    db.from("painel_instrumento").select(colunas).eq("execucao_id", execucaoId).eq("cnpj", cnpj).limit(1),
    db.from("painel_proposta").select(colunas).eq("execucao_id", execucaoId).eq("cnpj", cnpj).limit(1),
    lerCadastroOsc(cnpj, null),
  ]);
  if (ins.error) throw new Error(ins.error.message);
  if (pro.error) throw new Error(pro.error.message);
  const l = ((ins.data ?? []) as LinhaProponente[])[0] ?? ((pro.data ?? []) as LinhaProponente[])[0];
  // A OSC do Mapa das OSC é OSC, qualquer que seja o tipo gravado no painel (a mesma regra da página da entidade).
  const ehOsc = osc.estado === "ok";
  if (l) return entidadeAchada({ cnpj, nome: l.proponente, tipo_agente: l.tipo_agente, especie: ehOsc ? "osc" : undefined, municipio: l.municipio, uf: l.uf });
  if (osc.estado === "ok") return entidadeAchada({ cnpj, nome: nomeOsc(osc.cadastro), especie: "osc", municipio: osc.cadastro.municipio, uf: "PB" });
  return null;
}

/** O convênio de um número exato, pelo índice `(execucao_id, nr_convenio)`: 5,6 ms medidos. */
async function convenioPeloNumero(db: Banco, execucaoId: number, numero: string): Promise<string | null> {
  const r = await db
    .from("painel_instrumento")
    .select("nr_convenio")
    .eq("execucao_id", execucaoId)
    .in("nr_convenio", [...new Set([numero, numero.toUpperCase()])])
    .limit(1);
  if (r.error) {
    console.error("busca unificada (número do convênio):", r.error.message);
    return null;
  }
  return ((r.data ?? []) as { nr_convenio: string }[])[0]?.nr_convenio ?? null;
}

/** Os cinco grupos, cada um uma leitura em andamento: a página mostra cada grupo quando o dele chega. */
export interface GruposUnificados {
  municipios: Promise<GrupoLido<MunicipioAchado>>;
  entidades: Promise<GrupoLido<EntidadeAchada>>;
  organizacoes: Promise<GrupoLido<OscBusca>>;
  convenios: Promise<GrupoLido<InstrumentoBusca>>;
  propostas: Promise<GrupoLido<PropostaBusca>>;
}

export type LeituraUnificada =
  | Falha
  /** A entrada exata achou a página: a página da busca redireciona. */
  | { estado: "direto"; destino: string }
  /** `grupos` null: nada que procurar (campo vazio ou só curinga). */
  | { estado: "ok"; execucao: ExecucaoBusca; grupos: GruposUnificados | null };

/** Cada grupo falha sozinho: o erro vai para o log e vira `{ estado: "erro" }`, sem derrubar os outros. */
function sozinho<T>(onde: string, ler: () => Promise<GrupoLido<T>>): Promise<GrupoLido<T>> {
  return ler().catch((e: unknown) => {
    console.error(`busca unificada (${onde}):`, e instanceof Error ? e.message : e);
    return { estado: "erro" } as const;
  });
}

/**
 * A busca unificada (C2, 08/10/2026). Lê a execução do painel e, se a entrada é exata e veio do formulário (`direto`),
 * procura a página dela antes de tudo: o convênio pelo número, a entidade pelo CNPJ. Achou: devolve o destino e não
 * dispara mais nada. Senão, dispara os cinco grupos em paralelo e devolve as leituras em andamento, sem esperar.
 * Medições (EXPLAIN ANALYZE, PB, "patos"): municípios de fora 4–61 ms, entidades da memória 0 ms (36 ms ao ler),
 * organizações 10 ms (752 ms com o disco frio), convênios e propostas 23 ms cada.
 */
export async function lerBuscaUnificada(p: ParametrosBusca, entrada: Entrada, direto: boolean): Promise<LeituraUnificada> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const ex = await execucaoAtual(db, "lerBuscaUnificada");
  if (ehFalha(ex)) return ex;
  const termos = termosDaBusca(p.q);
  if (!termos.length) return { estado: "ok", execucao: ex, grupos: null };

  const exata = entrada.tipo === "cnpj" ? entidadePorCnpj(db, ex.id, entrada.cnpj) : null;
  // Sem isto, um erro da leitura exata sem ninguém esperando (o caso sem `direto`, antes do grupo) sairia como rejeição solta.
  exata?.catch(() => undefined);
  if (direto && entrada.tipo === "numero") {
    const nr = await convenioPeloNumero(db, ex.id, entrada.numero);
    if (nr) return { estado: "direto", destino: urlInstrumento(nr) };
  }
  if (direto && exata) {
    const e = await exata.catch((erro: unknown) => {
      console.error("busca unificada (CNPJ):", erro instanceof Error ? erro.message : erro);
      return null;
    });
    if (e) return { estado: "direto", destino: e.href };
  }

  const escopo = escopoUnificado(p);
  const rpcComuns = { p_termos: termos, p_uf: escopo.uf, p_ibge: null, p_tema: null, p_limite: LIMITE_GRUPO, p_offset: 0 };
  const grupos: GruposUnificados = {
    municipios: sozinho("municípios", async () => {
      if (!pareceMunicipio(p.q)) return { estado: "fora", motivo: MOTIVO_MUNICIPIO_FORA };
      const fora = await nomesForaDaPb(db, ex.id, p.q);
      const achados = casarMunicipios(p.q, [...CANDIDATOS_PB, ...(fora ?? [])]);
      return {
        estado: "ok",
        itens: achados,
        total: achados.length,
        mais: (fora?.length ?? 0) >= LIMITE_NOMES_FORA_PB,
        aviso: fora === null ? "Os municípios de fora da Paraíba não puderam ser lidos agora; aparecem só os da Paraíba." : undefined,
      };
    }),
    entidades: sozinho("entidades", async () => {
      if (exata) {
        const e = await exata;
        return { estado: "ok", itens: e ? [e] : [], total: e ? 1 : 0 };
      }
      const lista = await proponentesDaPb(db, ex.id);
      if (!lista) return { estado: "erro" };
      const achadas = casarEntidades(p.q, lista);
      return { estado: "ok", itens: achadas, total: achadas.length };
    }),
    organizacoes: sozinho("organizações", async () => {
      const r = await buscarOsc(termos, null, LIMITE_GRUPO, 0);
      return r ? { estado: "ok", itens: r.linhas, total: r.total } : { estado: "erro" };
    }),
    convenios: sozinho("convênios", async () => {
      const r = await db.rpc("painel_busca_instrumentos", { ...rpcComuns, p_situacoes: null });
      if (r.error) throw new Error(r.error.message);
      const linhas = (r.data ?? []) as InstrumentoBusca[];
      return { estado: "ok", itens: linhas, total: Number(linhas[0]?.total ?? 0) };
    }),
    propostas: sozinho("propostas", async () => {
      const r = await db.rpc("painel_busca_propostas", { ...rpcComuns, p_desfechos: null });
      if (r.error) throw new Error(r.error.message);
      const linhas = (r.data ?? []) as PropostaBusca[];
      return { estado: "ok", itens: linhas, total: Number(linhas[0]?.total ?? 0) };
    }),
  };
  return { estado: "ok", execucao: ex, grupos };
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
