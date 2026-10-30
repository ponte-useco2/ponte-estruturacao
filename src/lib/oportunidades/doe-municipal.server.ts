/**
 * Leitura do Diário Oficial do Estado e da Transparência PB de um município (oport_61), pela última execução `doe_*`.
 * Só servidor, só chave de serviço; a página decide quem vê (por ora, só o administrador). IBGE fora do formato:
 * `sem_dado`, sem ler o banco. Município fora do escopo do pacote (a amostra tem dois): `fora_do_escopo`, que a tela
 * diz como "não lido" — nunca zero. Sem a oport_61 no banco: `sem_dado`. Memória de 10 minutos, como as vizinhas.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { criarMemoria } from "./memoria";
import { ATOS_NA_LISTA, type AtoDoe, type ConvenioTpb, type DespesaLocalTpb, type LeituraDoeMunicipio, type MesDoe, type RepasseTpb } from "./doe-municipal";

const memoria = criarMemoria<LeituraDoeMunicipio>({ validadeMs: 10 * 60 * 1000, maximo: 50, guardar: (l) => l.estado === "ok" || l.estado === "fora_do_escopo" });
const LIMITE = 5000;

export function lerDoeDoMunicipio(ibge: string): Promise<LeituraDoeMunicipio> {
  if (typeof ibge !== "string" || !/^25\d{5}$/.test(ibge)) return Promise.resolve({ estado: "sem_dado" });
  return memoria.obter(ibge, () => lerDoBanco(ibge));
}

type Resposta<T> = { data: T | null; error: { code?: string; message: string } | null };

function falhou(nome: string, r: Resposta<unknown>): LeituraDoeMunicipio | null {
  if (!r.error) return null;
  if (ehEsquemaAusente(r.error.code)) return { estado: "sem_dado" };
  console.error("doe-municipal:", nome, r.error.code, r.error.message);
  return { estado: "falha" };
}

const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));

async function lerDoBanco(ibge: string): Promise<LeituraDoeMunicipio> {
  if (!authConfigurada()) return { estado: "sem_dado" };
  const db = clienteServidor();
  const ex = (await db.rpc("doe_ultima_execucao").select("id,dado_ate,escopo").limit(1)) as Resposta<{ id: number; dado_ate: string | null; escopo: string[] | null }[]>;
  const f0 = falhou("execução", ex);
  if (f0) return f0;
  const e = (ex.data ?? [])[0];
  if (!e) return { estado: "sem_dado" };
  if (!(e.escopo ?? []).includes(ibge)) return { estado: "fora_do_escopo", dadoAte: e.dado_ate };

  const [meses, atos, repasses, locais, convenios] = (await Promise.all([
    db.from("doe_mes_municipio").select("mes,esfera,classe,subclasse,n_atos,valor_max_soma,confianca_classe").eq("execucao_id", e.id).eq("cod_ibge", ibge).limit(LIMITE),
    db
      .from("doe_ato_municipio")
      .select("ato_id,data_edicao,pagina,link,orgao,tipo,classe,subclasse,numero,cnpjs,valor_max,origem_texto,confianca")
      .eq("execucao_id", e.id)
      .eq("cod_ibge", ibge)
      .neq("classe", "pessoal")
      .order("data_edicao", { ascending: false })
      .limit(ATOS_NA_LISTA),
    db
      .from("tpb_repasse_municipio")
      .select("mes,orgao,funcao,grupo_natureza,modalidade,tipo_pagamento,credor,confianca,pago,empenhado")
      .eq("execucao_id", e.id)
      .eq("cod_ibge", ibge)
      .limit(LIMITE),
    db.from("tpb_despesa_local_municipio").select("mes,orgao,funcao,pago,empenhado").eq("execucao_id", e.id).eq("cod_ibge", ibge).limit(LIMITE),
    db
      .from("tpb_convenio_municipio")
      .select("ano,numero,instrumento,concedente,convenente,convenente_tipo,objeto,inicio,fim,valor_concedente,valor_total,link")
      .eq("execucao_id", e.id)
      .eq("cod_ibge", ibge)
      .limit(LIMITE),
  ])) as Resposta<Record<string, unknown>[]>[];
  for (const [nome, r] of [["meses", meses], ["atos", atos], ["repasses", repasses], ["despesa local", locais], ["convênios", convenios]] as const) {
    const f = falhou(nome, r);
    if (f) return f;
  }
  return {
    estado: "ok",
    dadoAte: e.dado_ate,
    meses: (meses.data ?? []).map((m) => ({ ...m, n_atos: Number(m.n_atos) || 0, valor_max_soma: num(m.valor_max_soma) }) as MesDoe),
    atos: (atos.data ?? []).map((a) => ({ ...a, valor_max: num(a.valor_max), cnpjs: (a.cnpjs as string[] | null) ?? [] }) as AtoDoe),
    repasses: (repasses.data ?? []).map((r) => ({ ...r, pago: num(r.pago), empenhado: num(r.empenhado) }) as RepasseTpb),
    despesaLocal: (locais.data ?? []).map((r) => ({ ...r, pago: num(r.pago), empenhado: num(r.empenhado) }) as DespesaLocalTpb),
    convenios: (convenios.data ?? []).map((c) => ({ ...c, ano: num(c.ano), valor_concedente: num(c.valor_concedente), valor_total: num(c.valor_total) }) as ConvenioTpb),
  };
}
