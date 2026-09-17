import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { lerFiscalMunicipio } from "@/lib/oportunidades/fiscal.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { FiscalIndisponivel } from "../../FiscalConteudo";
import { SimuladorConteudo } from "./SimuladorConteudo";

export const metadata: Metadata = {
  title: "Simular um projeto · Capacidade fiscal · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Simulador de operação de crédito e diagnóstico por projeto (onda 9), só administradores como o
 * resto do painel fiscal. Formulário GET: cada simulação tem URL própria, e a mesma página imprime.
 */
export default async function SimularPage({
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
  if (!/^25\d{5}$/.test(ibge)) notFound();
  const leitura = await lerFiscalMunicipio(ibge);
  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Capacidade fiscal · IBGE {ibge}</p>
          <h1 className="pa-titulo">Este código não está entre os 223 municípios da Paraíba</h1>
          <p>
            <Link href="/mapa/fiscal">Voltar à lista</Link>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") return <FiscalIndisponivel estado={leitura.estado} />;
  return <SimuladorConteudo leitura={leitura} sp={await searchParams} />;
}
