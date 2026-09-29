import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { lerTceMunicipio } from "@/lib/oportunidades/tce.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { TceMunicipioConteudo } from "./TceMunicipioConteudo";

export const metadata: Metadata = {
  title: "Município no TCE-PB · Painel · PONTE",
  robots: { index: false, follow: false },
};

/** O Pix e a conciliação SICONV × TCE-PB de um município, ano a ano, com as empresas. Só administradores. */
export default async function TceMunicipioPage({ params }: { params: Promise<{ ibge: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const { ibge } = await params;
  if (!/^25\d{5}$/.test(ibge)) notFound();
  const leitura = await lerTceMunicipio(ibge);
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker="Painel · TCE-PB" titulo="O município no TCE-PB está indisponível agora" />;
  if (!leitura.cobertura.length) notFound();
  return <TceMunicipioConteudo leitura={leitura} />;
}
