import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { parametrosFicha } from "@/lib/oportunidades/painel";
import { lerFichaMunicipio } from "@/lib/oportunidades/painel.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { FichaConteudo } from "../../FichaMunicipio";
import { PainelIndisponivel } from "../../PainelConteudo";

export const metadata: Metadata = {
  title: "Ficha do município · Painel · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Ficha do município — uso interno, com o mesmo portão do painel: só administradores,
 * e quem não é vai para /mapa sem saber que a página existe. Código IBGE que não é de
 * município volta ao painel.
 */
export default async function FichaMunicipioPage({
  params,
  searchParams,
}: {
  params: Promise<{ ibge: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const { ibge } = await params;
  const f = parametrosFicha(ibge, await searchParams);
  if (!f) redirect("/mapa/painel");

  const leitura = await lerFichaMunicipio(f);
  if (leitura.estado !== "ok") return <PainelIndisponivel estado={leitura.estado} />;

  return <FichaConteudo f={f} ficha={leitura} />;
}
