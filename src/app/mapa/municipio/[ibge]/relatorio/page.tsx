import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { lerRelatorioMunicipio } from "@/lib/oportunidades/relatorio-municipio.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { RelatorioConteudo } from "./RelatorioConteudo";

export const metadata: Metadata = {
  title: "Relatório do município · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/** O relatório crítico de um município da PB (onda 14). Só administradores. */
export default async function RelatorioMunicipioPage({ params }: { params: Promise<{ ibge: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const { ibge } = await params;
  if (!/^25\d{5}$/.test(ibge)) notFound();
  const leitura = await lerRelatorioMunicipio(ibge, diaBrasilia(new Date().toISOString()));
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker="Relatório do município" titulo="O relatório está indisponível agora" />;
  return <RelatorioConteudo r={leitura.relatorio} />;
}
