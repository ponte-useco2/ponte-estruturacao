import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { areaDaUrl } from "@/lib/oportunidades/osc";
import { lerOscDoMunicipio } from "@/lib/oportunidades/osc.server";
import { lerEntidadesDoMunicipio } from "@/lib/oportunidades/relatorio-municipio.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { OrganizacoesConteudo } from "./OrganizacoesConteudo";

export const metadata: Metadata = {
  title: "Organizações da sociedade civil · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * As organizações da sociedade civil ativas de um município da PB (E3, 07/10/2026), pelo Mapa das OSC (Ipea): a
 * lista inteira que o resumo da aba do dinheiro não cabe. Para qualquer aprovado — o cadastro é público e não tem
 * endereço, dirigente nem contato. Filtro por área (`?area=`), por nome (`?q=`) e página (`?p=`) na URL.
 */
export default async function OrganizacoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ ibge: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const [{ ibge }, sp] = await Promise.all([params, searchParams]);
  if (!/^25\d{5}$/.test(ibge)) notFound();
  const [osc, linhas] = await Promise.all([lerOscDoMunicipio(ibge), lerEntidadesDoMunicipio(ibge)]);
  if (!osc) return <DadoIndisponivel kicker="Sociedade civil" titulo="O cadastro das organizações está indisponível agora" />;

  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const area = areaDaUrl(sp.area);
  const q = um(sp.q).trim().slice(0, 100);
  const pagina = Math.max(1, Math.min(Number.parseInt(um(sp.p), 10) || 1, 100));
  after(() => registrarUso(visitante, "mapa_organizacoes", { ibge, area: area ?? "", q: q ? "sim" : "", pagina }));

  // Instrumentos federais por CNPJ no município (todas as lentes): marca e põe primeiro quem tem.
  const instrumentos = new Map<string, number>();
  for (const l of linhas ?? []) if (l.cnpj) instrumentos.set(l.cnpj, (instrumentos.get(l.cnpj) ?? 0) + 1);

  return <OrganizacoesConteudo ibge={ibge} osc={osc} instrumentos={instrumentos} area={area} q={q} pagina={pagina} />;
}
