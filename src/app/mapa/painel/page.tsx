import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { parametrosPainel } from "@/lib/oportunidades/painel";
import { lerPainel } from "@/lib/oportunidades/painel.server";
import { PainelConteudo, PainelIndisponivel } from "./PainelConteudo";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";

export const metadata: Metadata = {
  title: "Painel · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Painel de execução da PONTE — uso interno.
 *
 * Só administradores (OPORTUNIDADES_ADMINS). Quem não é vai para /mapa sem saber
 * que a página existe, como no Radar.
 *
 * Tudo aqui é Server Component: a visão, a UF e o órgão são links e um formulário
 * GET. A página funciona sem JavaScript, e cada recorte tem URL própria para ser
 * mandado a alguém. Só o botão de copiar o número do convênio roda no navegador.
 */
export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const p = parametrosPainel(await searchParams);
  const leitura = await lerPainel(p);

  if (leitura.estado !== "ok") {
    return <PainelIndisponivel estado={leitura.estado} />;
  }

  return <PainelConteudo p={p} leitura={leitura} />;
}
