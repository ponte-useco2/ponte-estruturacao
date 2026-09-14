import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { parametrosRadar } from "@/lib/oportunidades/radar";
import { lerRadar } from "@/lib/oportunidades/radar.server";
import { RadarConteudo, RadarIndisponivel } from "./RadarConteudo";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";

export const metadata: Metadata = {
  title: "Radar · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Radar de propostas da PONTE — uso interno.
 *
 * Só administradores (OPORTUNIDADES_ADMINS). Quem não é vai para /mapa sem saber
 * que a página existe, como no painel de acessos.
 *
 * Tudo aqui é Server Component: os filtros são links e um formulário GET. A
 * página não precisa de JavaScript para funcionar, e cada recorte tem URL própria
 * para ser mandado a alguém.
 */
export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const p = parametrosRadar(await searchParams);
  const leitura = await lerRadar(p);

  if (leitura.estado !== "ok") {
    return <RadarIndisponivel estado={leitura.estado} />;
  }

  return <RadarConteudo p={p} leitura={leitura} />;
}
