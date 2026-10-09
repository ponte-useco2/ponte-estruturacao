/**
 * Leitura do relatório crítico do município (onda 14, camadas 1 e 2) — só servidor, só chave de serviço.
 *
 * Quem decide se a pessoa pode ver é a página (só administradores, decisão de 01/10/2026). Cada fonte é
 * lida pela sua última execução e falha sozinha: o que cair entra em `faltas` e o relatório sai sem a
 * seção, dizendo o que faltou. O município é a prefeitura e os seus fundos (`tipo_agente = municipio`).
 *
 * Volume (Patos, 01/10/2026): ~110 instrumentos e ~100 propostas desde 2008 — uma página de mil linhas.
 * Os cruzamentos por convênio (emendas, TCU, Acesso Livre) vão em lotes de números. Os indicadores da
 * camada 2 são ~45 linhas do município e ~200 referências da PB e do Brasil.
 *
 * Memória de 10 minutos (06/10/2026): a página do município relia tudo a cada troca de aba (~3 s). O
 * relatório montado fica guardado por município e dia na memória da instância do servidor (`memoria.ts`); o
 * que cada visitante vê (sem nomes, nível de acesso) é aplicado DEPOIS, na página, sobre uma cópia. Erro e
 * leitura com fonte fora do ar (nome em `faltas`) não ficam guardados (`leituraGuardavel`). As fontes mudam uma
 * vez por dia, então 10 minutos não escondem nada.
 *
 * Página da entidade (E1, 07/10/2026): o mesmo relatório, lido por CNPJ (`lerRelatorioEntidade`). TCU, emendas,
 * Acesso Livre e fornecedores vão pelos números dos convênios da entidade; Pix, fundo a fundo e o ciclo, pelo CNPJ;
 * o fiscal entra só para entidade municipal (o CAUC e a LRF são do ente federativo), o TCE-PB só para a
 * prefeitura; janelas e indicadores são do território e ficam fora.
 *
 * Onda 7, A (09/10/2026; R2 de 09/10, §5.1): duas mudanças para a abertura ao público.
 *   - **Leitura leve para o nível 0** (`{ publico: true }`): lê só as fontes de `fontesDoNivel(0)` — convênios,
 *     propostas, emendas, indicadores e janelas —, e passa a entrada por `entradaDasFontes`, a mesma regra que o teste
 *     usa para provar que o relatório do público sai igual ao recortado da leitura completa. O município cai de ~50
 *     pedidos ao banco para 8 ou 9; a entidade, de 25–40 para 5–7. Do nível 1 em diante, a leitura de sempre.
 *   - **Cache compartilhado** (`cache-dados.server.ts`): a memória de cada leitor ganha uma segunda camada, comum a
 *     todas as instâncias, com a mesma validade de 10 minutos e a mesma regra do que se guarda (`leituraGuardavel`).
 *     A leitura pública tem memória e chave próprias. O que se guarda não depende de quem visita: o recorte por nível
 *     continua na página, a cada pedido, sobre o objeto que voltou (que ninguém pode alterar).
 *
 * Onda 8, B (09/10/2026; R2 de 09/10, §4.2 e §5.5 item 5): duas mudanças de velocidade, sem mudar o que se vê.
 *   - **Falta com validade curta**: a leitura com uma fonte em `faltas` fica 1 minuto na memória desta instância
 *     (`VALIDADE_FALTA_MS`), e não zero; nunca no cache compartilhado. Uma fonte fora do ar deixava cada visita reler
 *     o pacote inteiro (~50 pedidos no município completo). O "tente de novo em alguns minutos" da página continua
 *     valendo: depois de 1 minuto, a leitura é refeita.
 *   - **Fornecedores do município** (`lerInidoneosDoMunicipio`): o relatório lê só o que usa — a concentração e os
 *     inidôneos que receberam lá —, em 3 pedidos e 2 idas e voltas, no lugar da lista do painel (de 13 a 29 pedidos,
 *     com 4 contagens exatas, o CEIS/CNEP e todos os pares do município por OFFSET). O resultado é o mesmo.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { VALIDADE_DADOS_MS, VALIDADE_FALTA_MS, leituraComFalta } from "./cache-dados";
import { camadaDoCacheDeDados } from "./cache-dados.server";
import { montarCatalogo } from "./catalogo-v2";
import { lerCatalogo, lerCatalogoV2 } from "./catalogo.server";
import { codigosPorJanela } from "./codigos-transferegov";
import { lerContasObrasDosConvenios } from "./contas-obras.server";
import { portaServe } from "./diagnostico";
import { ehEsquemaAusente } from "./esquema";
import { lerFiscalMunicipio } from "./fiscal.server";
import { criarMemoria } from "./memoria";
import { areaExcetuadaDe, ehMunicipal, especieDe, type EspecieEntidade, type LinhaEntidadeMunicipio } from "./pagina-entidade";
import { cnpjDaMatriz, nomeOsc, type CadastroOsc } from "./osc";
import { lerCadastroOsc, type LeituraCadastroOsc } from "./osc.server";
import catalogoIndicadores from "./indicadores-municipio.json";
import type { EntradaIndicadores, GrupoMunicipio, ItemCatalogo, LinhaIndicador, ReferenciaIndicador } from "./indicadores-municipio";
import { lerInidoneosDoMunicipio } from "./fornecedores.server";
import { MUNICIPIOS_PB } from "./municipios-pb";
import { todas } from "./padroes.server";
import type { PlanoFundo } from "./pix";
import type { PlanoCicloPix } from "./pix-ciclo";
import { lerLaudoEntePix } from "./pix-laudo.server";
import {
  VERSAO_RELATORIO,
  entradaDasFontes,
  fontesDoNivel,
  leituraGuardavel,
  montarRelatorio,
  type EmendaRelatorio,
  type EntradaRelatorio,
  type FonteRelatorio,
  type InstrumentoRelatorio,
  type PropostaRelatorio,
  type Relatorio,
  type SeriePessoal,
} from "./relatorio-municipio";
import { lerTceMunicipio } from "./tce.server";
import type { ConsultaTcu, TceTcu } from "./tce-tcu";

type Banco = ReturnType<typeof clienteServidor>;
type Resposta = { data: unknown; error: { message: string; code?: string } | null };

export type LeituraRelatorio =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro" }
  | { estado: "nao_encontrado" }
  | { estado: "ok"; relatorio: Relatorio };

const COLUNAS_INSTRUMENTO =
  "nr_convenio,municipio,modalidade,situacao,subsituacao,orgao_sup,programa,objeto,vl_global,vl_repasse,vl_desembolsado,vl_pago,vl_saldo_conta," +
  "pct_fisico,dt_assinatura,dt_fim_vigencia,dt_limite_contas,dt_primeiro_desembolso,dt_ultimo_desembolso,dt_ultimo_pagamento,situacao_contratacao," +
  "pc33_regime,pc33_nivel,pc33_pior,pc33_itens";
const COLUNAS_PROPOSTA = "id_proposta,ano_envio,desfecho,orgao_sup,programa,valor_repasse,dias_sem_evento,dt_ultimo_evento,limbo";
const LOTE = 150;

async function paginas<T>(faltas: string[], nome: string, consulta: (inicio: number, fim: number) => PromiseLike<Resposta>): Promise<T[] | null> {
  const r = await todas<T>(`relatório do município (${nome})`, consulta);
  if (Array.isArray(r)) return r;
  faltas.push(nome);
  return null;
}

async function emLotes<T>(faltas: string[], nome: string, numeros: string[], consulta: (lote: string[]) => PromiseLike<Resposta>): Promise<T[] | null> {
  const saida: T[] = [];
  for (let k = 0; k < numeros.length; k += LOTE) {
    const r = await consulta(numeros.slice(k, k + LOTE));
    if (r.error) {
      if (!ehEsquemaAusente(r.error.code)) console.error(`relatório do município (${nome}):`, r.error.message);
      faltas.push(nome);
      return null;
    }
    saida.push(...((r.data ?? []) as T[]));
  }
  return saida;
}

/** A última execução de um job pela RPC `<prefixo>_ultima_execucao`; null sem execução ou sem a migração. */
async function execucao(db: Banco, rpc: string, faltas: string[], nome: string): Promise<{ id: number; referencia: string | null; dado_ate?: string | null } | null> {
  const r = await db.rpc(rpc);
  if (r.error) {
    if (!ehEsquemaAusente(r.error.code)) {
      console.error(`relatório do município (${nome}):`, r.error.message);
      faltas.push(nome);
    }
    return null;
  }
  return ((r.data as { id: number; referencia: string | null }[] | null) ?? [])[0] ?? null;
}

async function lerTcu(db: Banco, filtro: { ibge: string } | { numeros: string[] }, faltas: string[]): Promise<EntradaRelatorio["tcu"]> {
  const nome = "e-TCE do TCU";
  const ex = await execucao(db, "tcu_ultima_execucao", faltas, nome);
  if (!ex) return null;
  const colunas = "nr_convenio,situacao_convenio,cod_ibge,n_tce,erro";
  const consultas =
    "ibge" in filtro
      ? await paginas<ConsultaTcu>(faltas, nome, (a, b) =>
          db.from("tcu_consulta").select(colunas).eq("execucao_id", ex.id).eq("cod_ibge", filtro.ibge).order("nr_convenio").range(a, b),
        )
      : await emLotes<ConsultaTcu>(faltas, nome, filtro.numeros, (lote) => db.from("tcu_consulta").select(colunas).eq("execucao_id", ex.id).in("nr_convenio", lote).limit(1000));
  if (!consultas) return null;
  const comTce = consultas.filter((c) => (c.n_tce ?? 0) > 0).map((c) => c.nr_convenio);
  const tces = comTce.length
    ? await emLotes<TceTcu>(faltas, nome, comTce, (lote) => db.from("tcu_tce").select("*").eq("execucao_id", ex.id).in("nr_convenio", lote).limit(1000))
    : [];
  if (!tces) return null;
  return { consultas, tces, referencia: ex.referencia };
}

/** Pix do exercício com o plano de trabalho pendente (oport_30). Antes da primeira coleta do ciclo, nada. */
type Chave = { campo: "cod_ibge" | "cnpj"; valor: string };

async function lerCiclo(db: Banco, chave: Chave, faltas: string[]): Promise<PlanoCicloPix[] | null> {
  const nome = "Pix em curso";
  const ex = await execucao(db, "pixc_ultima_execucao", faltas, nome);
  if (!ex) return null;
  return paginas<PlanoCicloPix>(faltas, nome, (a, b) =>
    db.from("pix_ciclo_plano").select("*").eq("execucao_id", ex.id).eq(chave.campo, chave.valor).order("id_plano_acao").range(a, b),
  );
}

async function lerFundo(db: Banco, chave: Chave, faltas: string[]): Promise<PlanoFundo[] | null> {
  const nome = "fundo a fundo";
  const ex = await execucao(db, "pix_ultima_execucao", faltas, nome);
  if (!ex) return null;
  return paginas<PlanoFundo>(faltas, nome, (a, b) =>
    db.from("pix_fundo_plano").select("*").eq("execucao_id", ex.id).eq(chave.campo, chave.valor).order("id_plano_acao").range(a, b),
  );
}

/** Camada 2: a última execução do job `municipios/`. Sem a `oport_27` ou sem execução, null sem falta. */
async function lerIndicadores(db: Banco, ibge: string, faltas: string[]): Promise<EntradaIndicadores | null> {
  const nome = "indicadores do município";
  const r = await db.rpc("mun_ultima_execucao");
  if (r.error) {
    if (!ehEsquemaAusente(r.error.code)) {
      console.error(`relatório do município (${nome}):`, r.error.message);
      faltas.push(nome);
    }
    return null;
  }
  const ex = ((r.data as { id: number; concluida_em: string | null }[] | null) ?? [])[0];
  if (!ex) return null;
  const [linhas, referencias, grupo] = await Promise.all([
    db
      .from("mun_indicador")
      .select("indicador,ano,valor,fonte,url,nota,posicao_pb,total_pb,mediana_porte,mediana_regiao")
      .eq("execucao_id", ex.id)
      .eq("ibge", ibge)
      .limit(1000),
    db.from("mun_referencia").select("indicador,ano,recorte,valor").eq("execucao_id", ex.id).limit(5000),
    db.from("mun_grupo").select("porte,regiao_imediata,regiao_intermediaria,regic,arranjo,polo").eq("execucao_id", ex.id).eq("ibge", ibge).limit(1),
  ]);
  const erro = linhas.error ?? referencias.error ?? grupo.error;
  if (erro) {
    console.error(`relatório do município (${nome}):`, erro.message);
    faltas.push(nome);
    return null;
  }
  return {
    catalogo: (catalogoIndicadores as { indicadores: ItemCatalogo[] }).indicadores,
    linhas: (linhas.data ?? []) as LinhaIndicador[],
    referencias: (referencias.data ?? []) as ReferenciaIndicador[],
    grupo: ((grupo.data ?? []) as GrupoMunicipio[])[0] ?? null,
    coletadoEm: ex.concluida_em,
  };
}

async function lerJanelas(nome: string, hoje: string, faltas: string[]): Promise<EntradaRelatorio["janelas"]> {
  try {
    const [v2, v1] = await Promise.all([lerCatalogoV2(), lerCatalogo()]);
    if (v2.estado !== "ok") {
      faltas.push("janelas abertas");
      return null;
    }
    const codigos = v1 ? codigosPorJanela(v2.payload, v1) : new Map<string, string[]>();
    const c = montarCatalogo(v2.payload, { tipo: "municipio", uf: "PB", temas: [] }, hoje, codigos);
    const servem = c.janelas.filter((j) => portaServe(j, nome));
    return {
      elegiveis: servem.length,
      urgentes: servem
        .filter((j) => j.urgente)
        .slice(0, 8)
        .map((j) => ({ titulo: j.titulo, orgao: j.financiador, fim: j.prazo })),
    };
  } catch (e) {
    console.error("relatório do município (janelas abertas):", e instanceof Error ? e.message : e);
    faltas.push("janelas abertas");
    return null;
  }
}

/** Como ler: `publico` é a leitura leve do nível 0 (onda 7, A); sem ele, a completa de sempre. */
export interface OpcoesLeitura {
  publico?: boolean;
}

/** As fontes da leitura: as do nível 0 para o público; do nível 1 em diante, todas (`fontesDoNivel`). */
const fontesDaLeitura = (o: OpcoesLeitura) => fontesDoNivel(o.publico ? 0 : 1);

/** Nada a ler: a fonte fora da lista da leitura. */
const NADA = Promise.resolve(null);

/** Onda 8, B: a leitura com fonte em `faltas` fica 1 minuto nesta instância (e nunca no cache comum, que a recusa). */
const FALTA_CURTA = { validadeMs: VALIDADE_FALTA_MS, e: leituraComFalta };

// Onda 7, A: cada memória ganha a camada comum às instâncias; a leitura pública tem memória e chave próprias.
const memoria = criarMemoria<LeituraRelatorio>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 30,
  guardar: leituraGuardavel,
  falta: FALTA_CURTA,
  compartilhada: camadaDoCacheDeDados<LeituraRelatorio>({ leitor: "municipio", guardavel: leituraGuardavel }),
});
const memoriaPublica = criarMemoria<LeituraRelatorio>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 30,
  guardar: leituraGuardavel,
  falta: FALTA_CURTA,
  compartilhada: camadaDoCacheDeDados<LeituraRelatorio>({ leitor: "municipio-publico", guardavel: leituraGuardavel }),
});

/**
 * O relatório do município, da memória ou do cache quando há (ver o cabeçalho). Não altere o objeto devolvido. A
 * chave leva a versão das regras do relatório: publicação com regra nova não lê o relatório montado pela antiga.
 */
export function lerRelatorioMunicipio(ibge: string, hoje: string, opcoes: OpcoesLeitura = {}): Promise<LeituraRelatorio> {
  const chave = `${ibge}|${hoje}|${VERSAO_RELATORIO}`;
  const fontes = fontesDaLeitura(opcoes);
  return (opcoes.publico ? memoriaPublica : memoria).obter(chave, () => lerDoBanco(ibge, hoje, fontes));
}

/** O nome da lista fixa dos 223 (`municipios-pb.ts`): a mesma semente do job fiscal, 223 de 223 iguais em 09/10/2026. */
const nomeDaListaPb = (ibge: string) => MUNICIPIOS_PB.find(([i]) => i === ibge)?.[1] ?? null;

/** Tudo o que o relatório de um município cruza, das fontes da leitura. */
async function lerDoBanco(ibge: string, hoje: string, fontes: readonly FonteRelatorio[]): Promise<LeituraRelatorio> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const faltas: string[] = [];
  const le = (f: FonteRelatorio) => fontes.includes(f);

  const painel = await db.rpc("painel_ultima_execucao");
  if (painel.error) {
    if (ehEsquemaAusente(painel.error.code)) return { estado: "nao_ativado" };
    console.error("relatório do município (painel):", painel.error.message);
    return { estado: "erro" };
  }
  const ex = ((painel.data as { id: number; dado_ate: string; referencia: string }[] | null) ?? [])[0];
  if (!ex) return { estado: "sem_execucao" };

  const [fiscal, instrumentos, propostas, tcu, pix, tce, fornecedores, fundo, indicadores, pixCiclo] = await Promise.all([
    le("fiscal") ? lerFiscalMunicipio(ibge) : NADA,
    le("convenios")
      ? paginas<InstrumentoRelatorio & { municipio: string | null }>(faltas, "convênios", (a, b) =>
          db.from("painel_instrumento").select(COLUNAS_INSTRUMENTO).eq("execucao_id", ex.id).eq("cod_ibge", ibge).eq("tipo_agente", "municipio").order("nr_convenio").range(a, b),
        )
      : NADA,
    le("propostas")
      ? paginas<PropostaRelatorio>(faltas, "propostas", (a, b) =>
          db.from("painel_proposta").select(COLUNAS_PROPOSTA).eq("execucao_id", ex.id).eq("cod_ibge", ibge).eq("tipo_agente", "municipio").order("id_proposta").range(a, b),
        )
      : NADA,
    le("tcu") ? lerTcu(db, { ibge }, faltas) : NADA,
    le("pix") ? lerLaudoEntePix({ tipo: "ibge", valor: ibge }) : NADA,
    le("tce_pb") ? lerTceMunicipio(ibge) : NADA,
    // Onda 8, B: só o que o relatório usa (a concentração e os inidôneos de lá), pela execução que esta leitura já tem.
    le("fornecedores") ? lerInidoneosDoMunicipio(db, ex.id, ibge) : NADA,
    le("fundo") ? lerFundo(db, { campo: "cod_ibge", valor: ibge }, faltas) : NADA,
    le("indicadores") ? lerIndicadores(db, ibge, faltas) : NADA,
    le("pix_ciclo") ? lerCiclo(db, { campo: "cod_ibge", valor: ibge }, faltas) : NADA,
  ]);

  // O nome com acento vem do fiscal. A leitura pública não lê o fiscal: vai à lista fixa dos 223, que dá o mesmo nome.
  // A completa segue como sempre (sem o fiscal, o nome do SICONV).
  const nome =
    (fiscal?.estado === "ok" ? fiscal.municipio.nome : null) ?? (le("fiscal") ? null : nomeDaListaPb(ibge)) ?? instrumentos?.[0]?.municipio ?? null;
  if (!nome) return { estado: "nao_encontrado" };
  if (fiscal && fiscal.estado !== "ok" && fiscal.estado !== "nao_encontrado") faltas.push("painel fiscal");

  const numeros = (instrumentos ?? []).map((i) => i.nr_convenio);
  const [emendas, contasObras, janelas] = await Promise.all([
    !le("emendas")
      ? NADA
      : numeros.length
        ? emLotes<EmendaRelatorio>(faltas, "emendas", numeros, (lote) =>
            db.from("painel_instrumento_emenda").select("nr_convenio,parlamentar,tipo_parlamentar,valor").eq("execucao_id", ex.id).in("nr_convenio", lote).limit(5000),
          )
        : Promise.resolve([] as EmendaRelatorio[]),
    le("contas_obras") && numeros.length ? lerContasObrasDosConvenios(db, numeros, faltas) : Promise.resolve(undefined),
    le("janelas") ? lerJanelas(nome, hoje, faltas) : NADA,
  ]);

  if (pix?.estado === "erro") faltas.push("Pix");
  if (tce?.estado === "erro") faltas.push("TCE-PB");
  if (fornecedores?.estado === "erro") faltas.push("fornecedores");

  const g2 = fiscal?.estado === "ok" ? fiscal.verificacoes.find((v) => v.codigo === "G2") : undefined;
  const serie = (g2?.evidencia as { serie?: SeriePessoal } | undefined)?.serie ?? null;

  const entrada: EntradaRelatorio = {
    ibge,
    nome,
    fiscal: fiscal?.estado === "ok" ? { municipio: fiscal.municipio, verificacoes: fiscal.verificacoes, referencia: fiscal.execucao.referencia ?? null } : null,
    serie,
    instrumentos,
    referenciaPainel: ex.referencia ?? ex.dado_ate ?? null,
    emendas,
    propostas,
    tcu,
    contasObras: contasObras === undefined ? null : contasObras,
    pix: pix?.estado === "ok" ? pix.planos : pix?.estado === "nao_encontrado" ? [] : null,
    pixCiclo,
    pixTce: tce?.estado === "ok" ? tce.pix : pix?.estado === "ok" ? pix.tce : null,
    fundo,
    conciliacao: tce?.estado === "ok" ? tce.municipios : null,
    fornecedores: fornecedores?.estado === "ok" ? { concentracao: fornecedores.concentracao, inidoneos: fornecedores.inidoneos } : null,
    janelas,
    indicadores,
    faltas,
  };
  // Com todas as fontes, `entradaDasFontes` devolve a entrada como está; com as do público, zera o que não foi lido.
  return { estado: "ok", relatorio: montarRelatorio(entradaDasFontes(entrada, fontes), hoje) };
}

// ================================================================ entidade (E1, 07/10/2026)

// `municipio` já vem nas colunas do instrumento; na proposta, não.
const IDENTIDADE_INSTRUMENTO = "proponente,tipo_agente,cod_ibge,uf";
const IDENTIDADE_PROPOSTA = "proponente,tipo_agente,cod_ibge,municipio,uf";
type ComIdentidade = { proponente: string | null; tipo_agente: string | null; cod_ibge: string | null; municipio: string | null; uf: string | null };

export interface IdentidadeEntidade {
  cnpj: string;
  nome: string;
  especie: EspecieEntidade;
  tipoAgente: string | null;
  cod_ibge: string | null;
  municipio: string | null;
  uf: string | null;
  /** Ano do primeiro instrumento assinado ou da primeira proposta na base. */
  desde: number | null;
}

export type LeituraEntidade =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro" }
  | { estado: "nao_encontrado" }
  | {
      estado: "ok";
      entidade: IdentidadeEntidade;
      relatorio: Relatorio;
      instrumentos: InstrumentoRelatorio[];
      propostas: PropostaRelatorio[];
      /** O cadastro no Mapa das OSC (E3, oport_32): só faz sentido para OSC; `indisponivel` sem a migração ou sem carga. */
      osc: LeituraCadastroOsc;
    };

/** Nome, tipo e sede pelo instrumento mais recente (a razão social muda com o tempo); sem instrumento, pela proposta. */
function identidade(
  cnpj: string,
  instrumentos: (InstrumentoRelatorio & ComIdentidade)[],
  propostas: (PropostaRelatorio & ComIdentidade)[],
): IdentidadeEntidade {
  const recente = [...instrumentos].sort((a, b) => (b.dt_assinatura ?? "").localeCompare(a.dt_assinatura ?? ""))[0];
  const ref: ComIdentidade | undefined = recente ?? [...propostas].sort((a, b) => (b.ano_envio ?? 0) - (a.ano_envio ?? 0))[0];
  const anos = [
    ...instrumentos.map((i) => (i.dt_assinatura ? Number(i.dt_assinatura.slice(0, 4)) : null)),
    ...propostas.map((p) => p.ano_envio ?? null),
  ].filter((x): x is number => typeof x === "number" && x > 1990);
  const nome = ref?.proponente ?? cnpj;
  return {
    cnpj,
    nome,
    especie: especieDe(nome, ref?.tipo_agente),
    tipoAgente: ref?.tipo_agente ?? null,
    cod_ibge: ref?.cod_ibge ?? null,
    municipio: ref?.municipio ?? null,
    uf: ref?.uf ?? null,
    desde: anos.length ? Math.min(...anos) : null,
  };
}

/** A OSC que só está no cadastro do Mapa das OSC (E3): sem proposta nem instrumento na base. */
function identidadeDoCadastro(c: CadastroOsc): IdentidadeEntidade {
  return {
    cnpj: c.cnpj,
    nome: nomeOsc(c),
    especie: "osc",
    tipoAgente: "osc",
    cod_ibge: c.cod_ibge,
    municipio: c.municipio,
    uf: "PB",
    desde: null,
  };
}

/** Fornecedores inidôneos nos convênios da entidade, com o que receberam neles. A concentração fica para depois. */
async function lerInidoneosDosConvenios(db: Banco, execucaoId: number, numeros: string[], faltas: string[]): Promise<EntradaRelatorio["fornecedores"]> {
  if (!numeros.length) return { concentracao: null, inidoneos: [] };
  const pares = await emLotes<{ cnpj: string; pago: number | null }>(faltas, "fornecedores", numeros, (lote) =>
    db.from("painel_fornecedor_convenio").select("cnpj,pago").eq("execucao_id", execucaoId).in("nr_convenio", lote).limit(5000),
  );
  if (!pares) return null;
  const pago = new Map<string, number>();
  for (const p of pares) pago.set(p.cnpj, (pago.get(p.cnpj) ?? 0) + (p.pago ?? 0));
  const marcados = pago.size
    ? await emLotes<{ cnpj: string; nome: string | null }>(faltas, "fornecedores", [...pago.keys()], (lote) =>
        db.from("painel_fornecedor").select("cnpj,nome").eq("execucao_id", execucaoId).eq("inidoneo_tcu", true).in("cnpj", lote).limit(1000),
      )
    : [];
  if (!marcados) return null;
  return {
    concentracao: null,
    inidoneos: marcados.map((m) => ({ cnpj: m.cnpj, nome: m.nome, pago: pago.get(m.cnpj) ?? 0 })).filter((f) => f.pago > 0),
  };
}

// Como a do município: leitura com fonte faltando não fica os 10 minutos (B12b, 08/10/2026). Onda 7, A: com a camada
// comum às instâncias, e a leitura pública com memória e chave próprias. Onda 8, B: a falta fica 1 minuto, só aqui.
const memoriaEntidade = criarMemoria<LeituraEntidade>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 30,
  guardar: leituraGuardavel,
  falta: FALTA_CURTA,
  compartilhada: camadaDoCacheDeDados<LeituraEntidade>({ leitor: "entidade", guardavel: leituraGuardavel }),
});
const memoriaEntidadePublica = criarMemoria<LeituraEntidade>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 30,
  guardar: leituraGuardavel,
  falta: FALTA_CURTA,
  compartilhada: camadaDoCacheDeDados<LeituraEntidade>({ leitor: "entidade-publica", guardavel: leituraGuardavel }),
});

/** O relatório de uma entidade (um CNPJ), da memória ou do cache quando há. Não altere o objeto devolvido. */
export function lerRelatorioEntidade(cnpj: string, hoje: string, opcoes: OpcoesLeitura = {}): Promise<LeituraEntidade> {
  const chave = `${cnpj}|${hoje}|${VERSAO_RELATORIO}`;
  const fontes = fontesDaLeitura(opcoes);
  return (opcoes.publico ? memoriaEntidadePublica : memoriaEntidade).obter(chave, () => lerEntidadeDoBanco(cnpj, hoje, fontes));
}

async function lerEntidadeDoBanco(cnpj: string, hoje: string, fontes: readonly FonteRelatorio[]): Promise<LeituraEntidade> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const faltas: string[] = [];
  const le = (f: FonteRelatorio) => fontes.includes(f);

  const painel = await db.rpc("painel_ultima_execucao");
  if (painel.error) {
    if (ehEsquemaAusente(painel.error.code)) return { estado: "nao_ativado" };
    console.error("relatório da entidade (painel):", painel.error.message);
    return { estado: "erro" };
  }
  const ex = ((painel.data as { id: number; dado_ate: string; referencia: string }[] | null) ?? [])[0];
  if (!ex) return { estado: "sem_execucao" };

  // Os instrumentos, as propostas e o cadastro do Mapa das OSC dizem quem é a entidade e se a página existe: toda
  // leitura os lê, a pública também (D1: a entidade e a lista dos instrumentos dela).
  const [instrumentos, propostas, osc] = await Promise.all([
    paginas<InstrumentoRelatorio & ComIdentidade>(faltas, "convênios", (a, b) =>
      db.from("painel_instrumento").select(`${COLUNAS_INSTRUMENTO},${IDENTIDADE_INSTRUMENTO}`).eq("execucao_id", ex.id).eq("cnpj", cnpj).order("nr_convenio").range(a, b),
    ),
    // `nr_proposta` (onda 7, 09/10/2026; N07 da R1): a lista da entidade mostra o número que a pessoa conhece.
    paginas<PropostaRelatorio & ComIdentidade & { nr_proposta: string | null }>(faltas, "propostas", (a, b) =>
      db
        .from("painel_proposta")
        .select(`${COLUNAS_PROPOSTA},nr_proposta,${IDENTIDADE_PROPOSTA}`)
        .eq("execucao_id", ex.id)
        .eq("cnpj", cnpj)
        .order("id_proposta")
        .range(a, b),
    ),
    lerCadastroOsc(cnpj, cnpjDaMatriz(cnpj)),
  ]);
  if (!instrumentos && !propostas) return { estado: "erro" };
  // Sem nada na base, a página existe só para a OSC do cadastro do Mapa das OSC (E3).
  const naBase = (instrumentos ?? []).length > 0 || (propostas ?? []).length > 0;
  if (!naBase && osc.estado !== "ok") return { estado: "nao_encontrado" };

  const ent = naBase ? identidade(cnpj, instrumentos ?? [], propostas ?? []) : identidadeDoCadastro((osc as { cadastro: CadastroOsc }).cadastro);
  // Quem está no cadastro do Mapa é OSC (as naturezas do grupo 3 da Receita), seja qual for o tipo no painel.
  if (osc.estado === "ok") ent.especie = "osc";
  if (!ent.municipio && osc.estado === "ok") ent.municipio = osc.cadastro.municipio;
  const ibge = ent.cod_ibge;
  const municipal = ehMunicipal(ent.especie) && !!ibge;
  const prefeitura = ent.especie === "prefeitura" && !!ibge;
  const numeros = (instrumentos ?? []).map((i) => i.nr_convenio);

  const [fiscal, tcu, pix, tce, fundo, pixCiclo, emendas, contasObras, fornecedores] = await Promise.all([
    municipal && le("fiscal") ? lerFiscalMunicipio(ibge as string) : NADA,
    numeros.length && le("tcu") ? lerTcu(db, { numeros }, faltas) : NADA,
    le("pix") ? lerLaudoEntePix({ tipo: "cnpj", valor: cnpj }) : NADA,
    prefeitura && le("tce_pb") ? lerTceMunicipio(ibge as string) : NADA,
    le("fundo") ? lerFundo(db, { campo: "cnpj", valor: cnpj }, faltas) : NADA,
    le("pix_ciclo") ? lerCiclo(db, { campo: "cnpj", valor: cnpj }, faltas) : NADA,
    !le("emendas")
      ? NADA
      : numeros.length
        ? emLotes<EmendaRelatorio>(faltas, "emendas", numeros, (lote) =>
            db.from("painel_instrumento_emenda").select("nr_convenio,parlamentar,tipo_parlamentar,valor").eq("execucao_id", ex.id).in("nr_convenio", lote).limit(5000),
          )
        : Promise.resolve([] as EmendaRelatorio[]),
    numeros.length && le("contas_obras") ? lerContasObrasDosConvenios(db, numeros, faltas) : Promise.resolve(undefined),
    le("fornecedores") ? lerInidoneosDosConvenios(db, ex.id, numeros, faltas) : NADA,
  ]);

  if (fiscal && fiscal.estado !== "ok" && fiscal.estado !== "nao_encontrado") faltas.push("painel fiscal");
  if (pix?.estado === "erro") faltas.push("Pix");
  if (tce && tce.estado === "erro") faltas.push("TCE-PB");
  const g2 = fiscal?.estado === "ok" ? fiscal.verificacoes.find((v) => v.codigo === "G2") : undefined;

  const entrada: EntradaRelatorio = {
    ibge: ibge ?? "",
    nome: ent.nome,
    fiscal: fiscal?.estado === "ok" ? { municipio: fiscal.municipio, verificacoes: fiscal.verificacoes, referencia: fiscal.execucao.referencia ?? null } : null,
    serie: (g2?.evidencia as { serie?: SeriePessoal } | undefined)?.serie ?? null,
    instrumentos,
    referenciaPainel: ex.referencia ?? ex.dado_ate ?? null,
    emendas,
    propostas,
    tcu,
    contasObras: contasObras === undefined ? null : contasObras,
    pix: pix?.estado === "ok" ? pix.planos : pix?.estado === "nao_encontrado" ? [] : null,
    pixCiclo,
    pixTce: prefeitura ? (tce?.estado === "ok" ? tce.pix : pix?.estado === "ok" ? pix.tce : null) : null,
    fundo,
    conciliacao: prefeitura && tce?.estado === "ok" ? tce.municipios : null,
    fornecedores,
    janelas: null,
    indicadores: null,
    escopo: "entidade",
    areaExcetuada: areaExcetuadaDe(ent.nome, ent.especie),
    faltas,
  };
  const relatorio = montarRelatorio(entradaDasFontes(entrada, fontes), hoje);
  return { estado: "ok", entidade: ent, relatorio, instrumentos: instrumentos ?? [], propostas: propostas ?? [], osc };
}

const memoriaEntidades = criarMemoria<LinhaEntidadeMunicipio[] | null>({
  validadeMs: VALIDADE_DADOS_MS,
  maximo: 30,
  guardar: (l) => l !== null,
  compartilhada: camadaDoCacheDeDados({ leitor: "entidades-do-municipio", guardavel: (l) => l !== null }),
});

/** Os instrumentos de um município, de todos os proponentes, para o bloco "Quem recebe no município". */
export function lerEntidadesDoMunicipio(ibge: string): Promise<LinhaEntidadeMunicipio[] | null> {
  return memoriaEntidades.obter(ibge, async () => {
    if (!authConfigurada()) return null;
    const db = clienteServidor();
    const painel = await db.rpc("painel_ultima_execucao");
    if (painel.error) {
      if (!ehEsquemaAusente(painel.error.code)) console.error("entidades do município (painel):", painel.error.message);
      return null;
    }
    const ex = ((painel.data as { id: number }[] | null) ?? [])[0];
    if (!ex) return null;
    const r = await todas<LinhaEntidadeMunicipio>("entidades do município", (a, b) =>
      db.from("painel_instrumento").select("cnpj,proponente,tipo_agente,situacao,vl_global,dt_assinatura").eq("execucao_id", ex.id).eq("cod_ibge", ibge).order("nr_convenio").range(a, b),
    );
    return Array.isArray(r) ? r : null;
  });
}
