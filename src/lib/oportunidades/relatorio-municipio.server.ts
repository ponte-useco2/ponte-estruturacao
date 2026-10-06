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
 * fonte fora do ar não ficam guardados. As fontes mudam uma vez por dia, então 10 minutos não escondem nada.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { montarCatalogo } from "./catalogo-v2";
import { lerCatalogo, lerCatalogoV2 } from "./catalogo.server";
import { codigosPorJanela } from "./codigos-transferegov";
import { lerContasObrasDosConvenios } from "./contas-obras.server";
import { portaServe } from "./diagnostico";
import { ehEsquemaAusente } from "./esquema";
import { lerFiscalMunicipio } from "./fiscal.server";
import { criarMemoria } from "./memoria";
import catalogoIndicadores from "./indicadores-municipio.json";
import type { EntradaIndicadores, GrupoMunicipio, ItemCatalogo, LinhaIndicador, ReferenciaIndicador } from "./indicadores-municipio";
import { lerPainelFornecedores } from "./fornecedores.server";
import { todas } from "./padroes.server";
import type { PlanoFundo } from "./pix";
import { lerLaudoEntePix } from "./pix-laudo.server";
import {
  montarRelatorio,
  type EmendaRelatorio,
  type EntradaRelatorio,
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

async function lerTcu(db: Banco, ibge: string, faltas: string[]): Promise<EntradaRelatorio["tcu"]> {
  const nome = "e-TCE do TCU";
  const ex = await execucao(db, "tcu_ultima_execucao", faltas, nome);
  if (!ex) return null;
  const consultas = await paginas<ConsultaTcu>(faltas, nome, (a, b) =>
    db.from("tcu_consulta").select("nr_convenio,situacao_convenio,cod_ibge,n_tce,erro").eq("execucao_id", ex.id).eq("cod_ibge", ibge).order("nr_convenio").range(a, b),
  );
  if (!consultas) return null;
  const comTce = consultas.filter((c) => (c.n_tce ?? 0) > 0).map((c) => c.nr_convenio);
  const tces = comTce.length
    ? await emLotes<TceTcu>(faltas, nome, comTce, (lote) => db.from("tcu_tce").select("*").eq("execucao_id", ex.id).in("nr_convenio", lote).limit(1000))
    : [];
  if (!tces) return null;
  return { consultas, tces, referencia: ex.referencia };
}

async function lerFundo(db: Banco, ibge: string, faltas: string[]): Promise<PlanoFundo[] | null> {
  const nome = "fundo a fundo";
  const ex = await execucao(db, "pix_ultima_execucao", faltas, nome);
  if (!ex) return null;
  return paginas<PlanoFundo>(faltas, nome, (a, b) => db.from("pix_fundo_plano").select("*").eq("execucao_id", ex.id).eq("cod_ibge", ibge).order("id_plano_acao").range(a, b));
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

/** Tudo o que o relatório de um município cruza. */
const memoria = criarMemoria<LeituraRelatorio>({
  validadeMs: 10 * 60 * 1000,
  maximo: 30,
  guardar: (l) => l.estado === "ok" || l.estado === "nao_encontrado",
});

/** O relatório do município, da memória quando há (ver o cabeçalho). Não altere o objeto devolvido. */
export function lerRelatorioMunicipio(ibge: string, hoje: string): Promise<LeituraRelatorio> {
  return memoria.obter(`${ibge}|${hoje}`, () => lerDoBanco(ibge, hoje));
}

async function lerDoBanco(ibge: string, hoje: string): Promise<LeituraRelatorio> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const faltas: string[] = [];

  const painel = await db.rpc("painel_ultima_execucao");
  if (painel.error) {
    if (ehEsquemaAusente(painel.error.code)) return { estado: "nao_ativado" };
    console.error("relatório do município (painel):", painel.error.message);
    return { estado: "erro" };
  }
  const ex = ((painel.data as { id: number; dado_ate: string; referencia: string }[] | null) ?? [])[0];
  if (!ex) return { estado: "sem_execucao" };

  const [fiscal, instrumentos, propostas, tcu, pix, tce, fornecedores, fundo, indicadores] = await Promise.all([
    lerFiscalMunicipio(ibge),
    paginas<InstrumentoRelatorio & { municipio: string | null }>(faltas, "convênios", (a, b) =>
      db.from("painel_instrumento").select(COLUNAS_INSTRUMENTO).eq("execucao_id", ex.id).eq("cod_ibge", ibge).eq("tipo_agente", "municipio").order("nr_convenio").range(a, b),
    ),
    paginas<PropostaRelatorio>(faltas, "propostas", (a, b) =>
      db.from("painel_proposta").select(COLUNAS_PROPOSTA).eq("execucao_id", ex.id).eq("cod_ibge", ibge).eq("tipo_agente", "municipio").order("id_proposta").range(a, b),
    ),
    lerTcu(db, ibge, faltas),
    lerLaudoEntePix({ tipo: "ibge", valor: ibge }),
    lerTceMunicipio(ibge),
    lerPainelFornecedores({ q: null, municipio: ibge, ordem: "valor", marca: "inidoneos" }),
    lerFundo(db, ibge, faltas),
    lerIndicadores(db, ibge, faltas),
  ]);

  const nome = (fiscal.estado === "ok" ? fiscal.municipio.nome : null) ?? instrumentos?.[0]?.municipio ?? null;
  if (!nome) return { estado: "nao_encontrado" };
  if (fiscal.estado !== "ok" && fiscal.estado !== "nao_encontrado") faltas.push("painel fiscal");

  const numeros = (instrumentos ?? []).map((i) => i.nr_convenio);
  const [emendas, contasObras, janelas] = await Promise.all([
    numeros.length
      ? emLotes<EmendaRelatorio>(faltas, "emendas", numeros, (lote) =>
          db.from("painel_instrumento_emenda").select("nr_convenio,parlamentar,tipo_parlamentar,valor").eq("execucao_id", ex.id).in("nr_convenio", lote).limit(5000),
        )
      : Promise.resolve([] as EmendaRelatorio[]),
    numeros.length ? lerContasObrasDosConvenios(db, numeros, faltas) : Promise.resolve(undefined),
    lerJanelas(nome, hoje, faltas),
  ]);

  if (pix.estado === "erro") faltas.push("Pix");
  if (tce.estado === "erro") faltas.push("TCE-PB");
  if (fornecedores.estado === "erro") faltas.push("fornecedores");

  const g2 = fiscal.estado === "ok" ? fiscal.verificacoes.find((v) => v.codigo === "G2") : undefined;
  const serie = (g2?.evidencia as { serie?: SeriePessoal } | undefined)?.serie ?? null;

  const entrada: EntradaRelatorio = {
    ibge,
    nome,
    fiscal: fiscal.estado === "ok" ? { municipio: fiscal.municipio, verificacoes: fiscal.verificacoes, referencia: fiscal.execucao.referencia ?? null } : null,
    serie,
    instrumentos,
    referenciaPainel: ex.referencia ?? ex.dado_ate ?? null,
    emendas,
    propostas,
    tcu,
    contasObras: contasObras === undefined ? null : contasObras,
    pix: pix.estado === "ok" ? pix.planos : pix.estado === "nao_encontrado" ? [] : null,
    pixTce: tce.estado === "ok" ? tce.pix : pix.estado === "ok" ? pix.tce : null,
    fundo,
    conciliacao: tce.estado === "ok" ? tce.municipios : null,
    fornecedores:
      fornecedores.estado === "ok"
        ? {
            concentracao: fornecedores.municipios.find((m) => m.cod_ibge === ibge) ?? null,
            inidoneos: fornecedores.linhas.map((f) => ({ cnpj: f.cnpj, nome: f.nome, pago: f.noMunicipio?.pago ?? 0 })).filter((f) => f.pago > 0),
          }
        : null,
    janelas,
    indicadores,
    faltas,
  };
  return { estado: "ok", relatorio: montarRelatorio(entrada, hoje) };
}
