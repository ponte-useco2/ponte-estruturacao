/**
 * A leitura da primeira infância (P2, 22/10/2026): os termos de creche do painel (SICONV), os planos do Pix, as tabelas
 * do job `fnas/` (Criança Feliz, SIOPE, saúde) e a creche de 0 a 3 anos da camada 2. Cada fonte falha sozinha: o que
 * não leu vai em `faltas`, e a página diz. Sem município, os 223 (a lista estadual); com município, só ele (a aba).
 *
 * Volume da lista estadual (22/10/2026): ~60 termos, ~25 planos, ~200 saldos, ~2.400 repasses dos 12 meses, ~2.400
 * valores do SIOPE, ~1.000 saldos da saúde e 223 indicadores — páginas de mil, todas em paralelo.
 */
import "server-only";
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import { MUNICIPIOS_PB } from "./municipios-pb";
import {
  PADROES_CRECHE,
  classePix,
  ehCreche,
  type ContextoPI,
  type MunicipioPI,
  type PlanoPixPI,
  type Siope,
  type TermoCreche,
} from "./primeira-infancia";

type Banco = ReturnType<typeof clienteServidor>;
type Resposta = { data: unknown; error: { message: string; code?: string } | null };

export interface DatasPI {
  /** O dia do arquivo do SICONV no painel. */
  siconv: string | null;
  /** O mês do saldo do FNAS (AAAAMM) e a carga do portal do MDS. */
  fnasMes: number | null;
  fnasCarga: string | null;
  siopeAno: number | null;
  saudeData: string | null;
}

export type LeituraPI =
  | { estado: "ok"; municipios: MunicipioPI[]; datas: DatasPI; faltas: string[] }
  | { estado: "nao_ativado" | "erro" };

async function paginas<T>(consulta: (de: number, ate: number) => PromiseLike<Resposta>): Promise<T[]> {
  const saida: T[] = [];
  for (let de = 0; de < 50_000; de += 1000) {
    const r = await consulta(de, de + 999);
    if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
    const lote = (r.data ?? []) as T[];
    saida.push(...lote);
    if (lote.length < 1000) break;
  }
  return saida;
}

async function ultima(db: Banco, funcao: string): Promise<{ id: number; referencia?: string; dado_ate?: string } | null> {
  const r = await db.rpc(funcao);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
  return ((r.data as { id: number; referencia?: string; dado_ate?: string }[] | null) ?? [])[0] ?? null;
}

/** Roda uma fonte; a falha vira nome em `faltas` (o esquema ausente também, sem barulho no log). */
async function fonte<T>(nome: string, faltas: string[], vazio: T, ler: () => Promise<T>): Promise<T> {
  try {
    return await ler();
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (!ehEsquemaAusente(codigo)) console.error(`primeira infância (${nome}):`, e instanceof Error ? e.message : e);
    faltas.push(nome);
    return vazio;
  }
}

const orCandidatos = PADROES_CRECHE.flatMap((p) => [`programa.ilike.*${p}*`, `objeto.ilike.*${p}*`]).join(",");

async function lerTermos(db: Banco, ibge: string | null): Promise<{ termos: TermoCreche[]; data: string | null }> {
  const ex = await ultima(db, "painel_ultima_execucao");
  if (!ex) return { termos: [], data: null };
  const cols =
    "nr_convenio,cod_ibge,municipio,programa,objeto,situacao,vl_repasse,vl_desembolsado,vl_saldo_conta,dt_assinatura,dt_fim_vigencia,pct_fisico";
  type Linha = {
    nr_convenio: string; cod_ibge: string | null; municipio: string | null; programa: string | null; objeto: string | null;
    situacao: string | null; vl_repasse: number | null; vl_desembolsado: number | null; vl_saldo_conta: number | null;
    dt_assinatura: string | null; dt_fim_vigencia: string | null; pct_fisico: number | null;
  };
  const linhas = await paginas<Linha>((de, ate) => {
    let q = db.from("painel_instrumento").select(cols).eq("execucao_id", ex.id).eq("uf", "PB").or(orCandidatos);
    if (ibge) q = q.eq("cod_ibge", ibge);
    return q.order("nr_convenio").range(de, ate);
  });
  // Os vivos em execução e os que ainda têm saldo em conta (os do PAR4, "aprovados" com a vigência vencida).
  const creches = linhas.filter(
    (l) => l.cod_ibge && ehCreche(l.programa, l.objeto) && (l.situacao === "Em execução" || (l.vl_saldo_conta ?? 0) > 0),
  );
  type Conv = { nr_convenio: string; dias_sem_movimento: number | null; nunca_pagou: boolean | null; etapa_licitacao: string | null };
  const conv = new Map<string, Conv>();
  for (let i = 0; i < creches.length; i += 200) {
    const nrs = creches.slice(i, i + 200).map((c) => c.nr_convenio);
    const r = await db.from("painel_convenio").select("nr_convenio,dias_sem_movimento,nunca_pagou,etapa_licitacao")
      .eq("execucao_id", ex.id).in("nr_convenio", nrs).limit(1000);
    if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
    for (const c of (r.data ?? []) as Conv[]) conv.set(c.nr_convenio, c);
  }
  return {
    data: ex.referencia ?? null,
    termos: creches.map((l) => {
      const c = conv.get(l.nr_convenio);
      return {
        nr: l.nr_convenio, ibge: l.cod_ibge, municipio: l.municipio, programa: l.programa, situacao: l.situacao,
        repasse: l.vl_repasse, desembolsado: l.vl_desembolsado, saldo: l.vl_saldo_conta, assinatura: l.dt_assinatura,
        vigencia: l.dt_fim_vigencia, fisico: l.pct_fisico, dias: c?.dias_sem_movimento ?? null, nuncaPagou: c?.nunca_pagou ?? null,
        licitacao: c?.etapa_licitacao ?? null,
      };
    }),
  };
}

async function lerPix(db: Banco, ibge: string | null): Promise<PlanoPixPI[]> {
  const ex = await ultima(db, "pix_ultima_execucao");
  if (!ex) return [];
  type Linha = {
    id_plano_acao: number; codigo_plano_acao: string; cod_ibge: string | null; ano: number; pago: number | null;
    saldo: number | null; dt_saldo: string | null; objeto: string | null; primeira_infancia: string | null;
  };
  const padroes = ["creche", "infantil", "pré-escola", "pre-escola", "primeira inf", "cmei", "pró infância", "pro infancia", "proinf"];
  const linhas = await paginas<Linha>((de, ate) => {
    let q = db.from("pix_laudo_plano")
      .select("id_plano_acao,codigo_plano_acao,cod_ibge,ano,pago,saldo,dt_saldo,objeto,primeira_infancia")
      .eq("execucao_id", ex.id)
      .or(["primeira_infancia.not.is.null", ...padroes.map((p) => `objeto.ilike.*${p}*`)].join(","));
    if (ibge) q = q.eq("cod_ibge", ibge);
    return q.order("id_plano_acao").range(de, ate);
  });
  const saida: PlanoPixPI[] = [];
  for (const l of linhas) {
    const classe = classePix(l.objeto, l.primeira_infancia);
    if (!classe) continue;
    saida.push({
      id: l.id_plano_acao, codigo: l.codigo_plano_acao, ibge: l.cod_ibge, ano: l.ano, pago: l.pago ?? 0, saldo: l.saldo,
      dataSaldo: l.dt_saldo, objeto: l.objeto, classe,
    });
  }
  return saida;
}

interface Fnas {
  cf: Map<string, number>;
  cfRepasse12: Map<string, number>;
  siope: Map<string, Siope>;
  saude: Map<string, NonNullable<ContextoPI["saude"]>>;
  mes: number | null;
  carga: string | null;
  siopeAno: number | null;
  saudeData: string | null;
}

async function lerFnas(db: Banco, ibge: string | null, faltas: string[]): Promise<Fnas> {
  const vazio: Fnas = { cf: new Map(), cfRepasse12: new Map(), siope: new Map(), saude: new Map(), mes: null, carga: null, siopeAno: null, saudeData: null };
  const ex = await fonte("assistência e contexto (job FNAS)", faltas, null, () => ultima(db, "fnas_ultima_execucao"));
  if (!ex) return vazio;
  // Com município, o filtro do IBGE em cada leitura; sem ele, os 223 (a coluna nunca é nula nos municipais).
  const so = ibge ?? "";
  const op = ibge ? "eq" : "neq";
  const saida = { ...vazio, carga: ex.dado_ate ?? null };

  await Promise.all([
    fonte("Criança Feliz (FNAS)", faltas, null, async () => {
      const m = await db.from("fnas_saldo").select("ano_mes").eq("execucao_id", ex.id).order("ano_mes", { ascending: false }).limit(1);
      if (m.error) throw Object.assign(new Error(m.error.message), { code: m.error.code });
      const mes = ((m.data ?? []) as { ano_mes: number }[])[0]?.ano_mes ?? null;
      if (mes === null) return null;
      saida.mes = mes;
      const [saldos, repasses] = await Promise.all([
        paginas<{ ibge: string | null; total: number }>((de, ate) =>
          db.from("fnas_saldo").select("ibge,total").eq("execucao_id", ex.id).eq("primeira_infancia", true).eq("ano_mes", mes)
            .filter("ibge", op, so).order("cnpj").range(de, ate)),
        paginas<{ ibge: string | null; ano: number; mes: number; valor: number }>((de, ate) =>
          db.from("fnas_repasse").select("ibge,ano,mes,valor").eq("execucao_id", ex.id).eq("primeira_infancia", true)
            .gte("ano", Math.floor(mes / 100) - 1).filter("ibge", op, so)
            .order("cnpj").order("ano").order("mes").range(de, ate)),
      ]);
      // Os 12 meses que terminam no mês do saldo.
      const fim = Math.floor(mes / 100) * 12 + (mes % 100);
      for (const s of saldos) if (s.ibge) saida.cf.set(s.ibge, (saida.cf.get(s.ibge) ?? 0) + Number(s.total));
      for (const r of repasses) {
        const m12 = r.ano * 12 + r.mes;
        if (r.ibge && m12 > fim - 12 && m12 <= fim) saida.cfRepasse12.set(r.ibge, (saida.cfRepasse12.get(r.ibge) ?? 0) + Number(r.valor));
      }
      return null;
    }),
    fonte("FUNDEB e salário-educação (SIOPE)", faltas, null, async () => {
      const a = await db.from("fnas_siope").select("ano").eq("execucao_id", ex.id).order("ano", { ascending: false }).limit(1);
      if (a.error) throw Object.assign(new Error(a.error.message), { code: a.error.code });
      const ano = ((a.data ?? []) as { ano: number }[])[0]?.ano ?? null;
      if (ano === null) return null;
      saida.siopeAno = ano;
      const linhas = await paginas<{ ibge: string; codigo: string; valor: number }>((de, ate) =>
        db.from("fnas_siope").select("ibge,codigo,valor").eq("execucao_id", ex.id).eq("ano", ano).filter("ibge", op, so)
          .order("ibge").order("tipo").order("codigo").range(de, ate));
      for (const l of linhas) {
        const s = saida.siope.get(l.ibge) ?? {};
        (s as Record<string, number>)[l.codigo] = Number(l.valor);
        saida.siope.set(l.ibge, s);
      }
      return null;
    }),
    fonte("saúde (FNS)", faltas, null, async () => {
      const linhas = await paginas<{ ibge: string | null; grupo: "custeio" | "investimento" | "emenda" | "outras"; saldo: number; data_saldo: string | null }>(
        (de, ate) =>
          db.from("fnas_saude_saldo").select("ibge,grupo,saldo,data_saldo").eq("execucao_id", ex.id).eq("estadual", false)
            .filter("ibge", op, so).order("cnpj").order("grupo").range(de, ate),
      );
      for (const l of linhas) {
        if (!l.ibge) continue;
        const s = saida.saude.get(l.ibge) ?? {};
        s[l.grupo] = (s[l.grupo] ?? 0) + Number(l.saldo);
        saida.saude.set(l.ibge, s);
        if (l.data_saldo && (!saida.saudeData || l.data_saldo > saida.saudeData)) saida.saudeData = l.data_saldo;
      }
      return null;
    }),
  ]);
  return saida;
}

async function lerCreche03(db: Banco, ibge: string | null): Promise<Map<string, number>> {
  const ex = await ultima(db, "mun_ultima_execucao");
  const m = new Map<string, number>();
  if (!ex) return m;
  let q = db.from("mun_indicador").select("ibge,valor").eq("execucao_id", ex.id).eq("indicador", "creche_0a3");
  if (ibge) q = q.eq("ibge", ibge);
  const r = await q.limit(1000);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
  for (const l of (r.data ?? []) as { ibge: string; valor: number | null }[]) if (l.valor !== null) m.set(l.ibge, Number(l.valor));
  return m;
}

/** A primeira infância dos 223 (sem `ibge`) ou de um município. */
export async function lerPrimeiraInfancia(ibge: string | null = null): Promise<LeituraPI> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();
  const faltas: string[] = [];
  const [termos, pix, fnas, creche] = await Promise.all([
    fonte("creches no SICONV", faltas, { termos: [] as TermoCreche[], data: null as string | null }, () => lerTermos(db, ibge)),
    fonte("planos do Pix", faltas, [] as PlanoPixPI[], () => lerPix(db, ibge)),
    lerFnas(db, ibge, faltas),
    fonte("creche de 0 a 3 anos (indicadores)", faltas, new Map<string, number>(), () => lerCreche03(db, ibge)),
  ]);
  const lista = MUNICIPIOS_PB.filter(([codigo]) => !ibge || codigo === ibge);
  const municipios: MunicipioPI[] = lista.map(([codigo, nome]) => ({
    ibge: codigo,
    nome,
    termos: termos.termos.filter((t) => t.ibge === codigo),
    pix: pix.filter((p) => p.ibge === codigo),
    contexto: {
      cfSaldo: fnas.cf.get(codigo) ?? null,
      cfRepasse12: fnas.cfRepasse12.get(codigo) ?? null,
      siope: fnas.siope.get(codigo) ?? null,
      saude: fnas.saude.get(codigo) ?? null,
    },
    creche03: creche.get(codigo) ?? null,
  }));
  return {
    estado: "ok",
    municipios,
    faltas,
    datas: { siconv: termos.data, fnasMes: fnas.mes, fnasCarga: fnas.carga, siopeAno: fnas.siopeAno, saudeData: fnas.saudeData },
  };
}
