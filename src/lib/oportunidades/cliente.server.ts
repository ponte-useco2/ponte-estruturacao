/**
 * Visão do cliente: o vínculo confirmado entre organização e município (oport_12).
 *
 * A organização ativa vem da SESSÃO (`lerContexto`, sob a RLS da oport_6): a pessoa só
 * enxerga as entidades a que pertence. O vínculo vem da chave de serviço, porque a
 * tabela não aceita `authenticated` — quem confirma é o administrador, não o membro.
 */
import { authConfigurada, clienteServidor, type Visitante } from "@/lib/supabase-auth";
import { podeVerEntidadePropria, podeVerMunicipio, type AcessoCnpj, type AcessoFicha, type VinculoCnpj, type VinculoMunicipio } from "./cliente";
import { ehEsquemaAusente } from "./esquema";
import type { Organizacao } from "./organizacao";
import { lerContexto } from "./organizacao.server";

/** O vínculo confirmado da organização, ou null (sem confirmação, ou oport_12 ainda não aplicada). */
export async function lerVinculo(organizacaoId: string): Promise<VinculoMunicipio | null> {
  if (!authConfigurada()) return null;
  const { data, error } = await clienteServidor()
    .from("oport_vinculo_municipio")
    .select("municipio_ibge, confirmado_em")
    .eq("organizacao_id", organizacaoId)
    .maybeSingle();
  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("lerVinculo:", error.message);
    return null;
  }
  return (data as VinculoMunicipio | null) ?? null;
}

/** Se a pessoa pode ver a ficha, e de qual município — sempre a partir da organização ativa. */
export async function lerAcessoFicha(visitante: Pick<Visitante, "status">): Promise<{
  acesso: AcessoFicha;
  organizacao: Organizacao | null;
}> {
  const { ativa } = await lerContexto();
  const vinculo = ativa && ativa.tipo === "municipio" ? await lerVinculo(ativa.id) : null;
  return { acesso: podeVerMunicipio(visitante.status, ativa, vinculo), organizacao: ativa };
}

/** O vínculo confirmado entre organização e CNPJ (oport_31), ou null (sem confirmação, ou sem a migração). */
export async function lerVinculoCnpj(organizacaoId: string): Promise<VinculoCnpj | null> {
  if (!authConfigurada()) return null;
  const { data, error } = await clienteServidor()
    .from("oport_vinculo_cnpj")
    .select("cnpj, confirmado_em")
    .eq("organizacao_id", organizacaoId)
    .maybeSingle();
  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("lerVinculoCnpj:", error.message);
    return null;
  }
  return (data as VinculoCnpj | null) ?? null;
}

/**
 * Os dois portões do cliente, a partir da organização ativa: o do município (prefeitura com IBGE confirmado,
 * oport_12) e o do CNPJ (as outras organizações, oport_31). Quem é prefeitura entra pelo primeiro; o resto, pelo
 * segundo.
 */
export async function lerAcessoCliente(visitante: Pick<Visitante, "status">): Promise<{
  municipio: AcessoFicha;
  cnpj: AcessoCnpj;
  organizacao: Organizacao | null;
}> {
  const { ativa } = await lerContexto();
  const prefeitura = ativa?.tipo === "municipio";
  const [vm, vc] = await Promise.all([
    prefeitura && ativa ? lerVinculo(ativa.id) : Promise.resolve(null),
    !prefeitura && ativa?.cnpj ? lerVinculoCnpj(ativa.id) : Promise.resolve(null),
  ]);
  return {
    municipio: podeVerMunicipio(visitante.status, ativa, vm),
    cnpj: podeVerEntidadePropria(visitante.status, prefeitura ? null : ativa, vc),
    organizacao: ativa,
  };
}

// ============================================================================ administração

export interface OrganizacaoMunicipio {
  id: string;
  nome: string;
  uf: string | null;
  municipioIbge: string | null;
  criadaEm: string;
  membros: { email: string; papel: string }[];
  vinculo: (VinculoMunicipio & { confirmado_por: string }) | null;
  /** Nome do município no painel, quando há convênio ou proposta dele. */
  nomeMunicipio: string | null;
}

/** As organizações do tipo município, com membros e confirmação — para a tela de acessos. */
export async function listarOrganizacoesMunicipio(): Promise<OrganizacaoMunicipio[] | null> {
  if (!authConfigurada()) return null;
  const db = clienteServidor();

  const orgs = await db
    .from("oport_organizacao")
    .select("id, nome, uf, municipio_ibge, criada_em, oport_membro (user_id, papel)")
    .eq("tipo", "municipio")
    .order("criada_em", { ascending: false })
    .limit(300);
  if (orgs.error) {
    if (!ehEsquemaAusente(orgs.error.code)) console.error("listarOrganizacoesMunicipio:", orgs.error.message);
    return null;
  }
  const linhas = (orgs.data ?? []) as {
    id: string;
    nome: string;
    uf: string | null;
    municipio_ibge: string | null;
    criada_em: string;
    oport_membro: { user_id: string; papel: string }[] | null;
  }[];
  if (linhas.length === 0) return [];

  const ids = linhas.map((o) => o.id);
  const usuarios = [...new Set(linhas.flatMap((o) => (o.oport_membro ?? []).map((m) => m.user_id)))];
  const ibges = [...new Set(linhas.map((o) => o.municipio_ibge).filter((x): x is string => Boolean(x)))];

  const [vinculos, acessos, ...nomes] = await Promise.all([
    db.from("oport_vinculo_municipio").select("organizacao_id, municipio_ibge, confirmado_em, confirmado_por").in("organizacao_id", ids),
    usuarios.length ? db.from("oport_acesso").select("id, email").in("id", usuarios) : Promise.resolve({ data: [], error: null }),
    // Um nome por município, de qualquer linha do painel; sem ele a tela mostra só o código.
    ...ibges.map((ibge) =>
      db.from("painel_proposta").select("cod_ibge, municipio").eq("cod_ibge", ibge).not("municipio", "is", null).limit(1),
    ),
  ]);
  if (vinculos.error && !ehEsquemaAusente(vinculos.error.code)) console.error("vínculos:", vinculos.error.message);

  const porOrg = new Map(
    ((vinculos.error ? [] : vinculos.data) ?? []).map((v) => [
      (v as { organizacao_id: string }).organizacao_id,
      v as VinculoMunicipio & { confirmado_por: string },
    ]),
  );
  const emailPorUsuario = new Map(((acessos.data ?? []) as { id: string; email: string }[]).map((a) => [a.id, a.email]));
  const nomePorIbge = new Map(
    nomes.flatMap((n) => ((n.data ?? []) as { cod_ibge: string; municipio: string }[]).map((x) => [x.cod_ibge, x.municipio] as const)),
  );

  return linhas.map((o) => ({
    id: o.id,
    nome: o.nome,
    uf: o.uf,
    municipioIbge: o.municipio_ibge,
    criadaEm: o.criada_em,
    membros: (o.oport_membro ?? []).map((m) => ({ email: emailPorUsuario.get(m.user_id) ?? "(sem e-mail)", papel: m.papel })),
    vinculo: porOrg.get(o.id) ?? null,
    nomeMunicipio: o.municipio_ibge ? (nomePorIbge.get(o.municipio_ibge) ?? null) : null,
  }));
}

export interface OrganizacaoCnpj {
  id: string;
  nome: string;
  tipo: string;
  cnpj: string | null;
  membros: { email: string; papel: string }[];
  vinculo: (VinculoCnpj & { confirmado_por: string }) | null;
  /** O nome que o painel dá a esse CNPJ, quando ele tem instrumento ou proposta: ajuda a conferir. */
  nomeNoPainel: string | null;
}

/** As organizações que não são prefeitura e têm CNPJ, com membros e confirmação — para a tela de acessos. */
export async function listarOrganizacoesComCnpj(): Promise<OrganizacaoCnpj[] | null> {
  if (!authConfigurada()) return null;
  const db = clienteServidor();
  const orgs = await db
    .from("oport_organizacao")
    .select("id, nome, tipo, cnpj, oport_membro (user_id, papel)")
    .neq("tipo", "municipio")
    .not("cnpj", "is", null)
    .order("criada_em", { ascending: false })
    .limit(300);
  if (orgs.error) {
    if (!ehEsquemaAusente(orgs.error.code)) console.error("listarOrganizacoesComCnpj:", orgs.error.message);
    return null;
  }
  const linhas = (orgs.data ?? []) as { id: string; nome: string; tipo: string; cnpj: string | null; oport_membro: { user_id: string; papel: string }[] | null }[];
  if (linhas.length === 0) return [];
  const ids = linhas.map((o) => o.id);
  const usuarios = [...new Set(linhas.flatMap((o) => (o.oport_membro ?? []).map((m) => m.user_id)))];
  const cnpjs = [...new Set(linhas.map((o) => o.cnpj).filter((x): x is string => Boolean(x)))];
  const [vinculos, acessos, nomes] = await Promise.all([
    db.from("oport_vinculo_cnpj").select("organizacao_id, cnpj, confirmado_em, confirmado_por").in("organizacao_id", ids),
    usuarios.length ? db.from("oport_acesso").select("id, email").in("id", usuarios) : Promise.resolve({ data: [], error: null }),
    db.from("painel_instrumento").select("cnpj, proponente").in("cnpj", cnpjs).not("proponente", "is", null).limit(1000),
  ]);
  if (vinculos.error && !ehEsquemaAusente(vinculos.error.code)) console.error("vínculos por CNPJ:", vinculos.error.message);
  const porOrg = new Map(
    ((vinculos.error ? [] : vinculos.data) ?? []).map((v) => [(v as { organizacao_id: string }).organizacao_id, v as VinculoCnpj & { confirmado_por: string }]),
  );
  const emailPorUsuario = new Map(((acessos.data ?? []) as { id: string; email: string }[]).map((a) => [a.id, a.email]));
  const nomePorCnpj = new Map(((nomes.data ?? []) as { cnpj: string; proponente: string }[]).map((x) => [x.cnpj, x.proponente] as const));
  return linhas.map((o) => ({
    id: o.id,
    nome: o.nome,
    tipo: o.tipo,
    cnpj: o.cnpj,
    membros: (o.oport_membro ?? []).map((m) => ({ email: emailPorUsuario.get(m.user_id) ?? "(sem e-mail)", papel: m.papel })),
    vinculo: porOrg.get(o.id) ?? null,
    nomeNoPainel: o.cnpj ? (nomePorCnpj.get(o.cnpj) ?? null) : null,
  }));
}
