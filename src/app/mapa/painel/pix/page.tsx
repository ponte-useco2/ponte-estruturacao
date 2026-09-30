import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { parametrosPix } from "@/lib/oportunidades/pix";
import { lerResumoLaudoPix } from "@/lib/oportunidades/pix-laudo.server";
import { lerPix } from "@/lib/oportunidades/pix.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { PixConteudo, PixIndisponivel } from "./PixConteudo";

export const metadata: Metadata = {
  title: "Pix e fundo a fundo · Painel · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Transferências especiais ("emendas Pix") e fundo a fundo — uso interno.
 *
 * Mesmo portão do painel de execução: só administradores. Server Component com links e
 * formulário GET; cada recorte tem URL própria.
 */
export default async function PixPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const p = parametrosPix(await searchParams);
  const leitura = await lerPix(p);
  if (leitura.estado !== "ok") return <PixIndisponivel estado={leitura.estado} />;
  // O resumo do laudo (onda 13A) só entra no recorte plano a plano (PB, especiais).
  const laudo = leitura.especiais && p.aba === "especiais" ? await lerResumoLaudoPix(leitura.execucao.id) : null;
  return <PixConteudo p={p} leitura={leitura} laudo={laudo} />;
}
