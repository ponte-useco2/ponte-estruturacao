import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { parametrosFiscal } from "@/lib/oportunidades/fiscal";
import { lerFiscal } from "@/lib/oportunidades/fiscal.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { FiscalConteudo, FiscalIndisponivel } from "./FiscalConteudo";

export const metadata: Metadata = {
  title: "Capacidade fiscal · Painel · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Painel de Capacidade Fiscal e Elegibilidade — os 223 municípios da PB, uso interno.
 *
 * Mesmo portão do painel de execução e do Pix: só administradores (decisão do titular para o
 * MVP). Formulário GET: cada recorte tem URL própria.
 */
export default async function FiscalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const p = parametrosFiscal(await searchParams);
  const leitura = await lerFiscal();
  if (leitura.estado !== "ok") return <FiscalIndisponivel estado={leitura.estado} />;
  return <FiscalConteudo p={p} leitura={leitura} />;
}
