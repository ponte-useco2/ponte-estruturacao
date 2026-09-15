/**
 * Visão do cliente: o vínculo confirmado entre organização e município (oport_12).
 *
 * A organização ativa vem da SESSÃO (`lerContexto`, sob a RLS da oport_6): a pessoa só
 * enxerga as entidades a que pertence. O vínculo vem da chave de serviço, porque a
 * tabela não aceita `authenticated` — quem confirma é o administrador, não o membro.
 */
import { authConfigurada, clienteServidor, type Visitante } from "@/lib/supabase-auth";
import { podeVerMunicipio, type AcessoFicha, type VinculoMunicipio } from "./cliente";
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
