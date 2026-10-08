import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { urlMunicipioFiscal, urlSimularFiscal } from "@/lib/oportunidades/fiscal";
import { lerFiscalMunicipio } from "@/lib/oportunidades/fiscal.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { FiscalIndisponivel } from "../../FiscalConteudo";
import { SimuladorConteudo } from "./SimuladorConteudo";
import { LinkMapa } from "../../../_componentes/LinkMapa";

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
  const sp = await searchParams;
  const leitura = await lerFiscalMunicipio(ibge);
  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Capacidade fiscal · IBGE {ibge}</p>
          <h1 className="pa-titulo">Este código não está entre os 223 municípios da Paraíba</h1>
          <p>
            <LinkMapa href="/mapa/fiscal">Voltar à lista dos 223 municípios</LinkMapa>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") {
    // B14b (08/10/2026): "Tentar de novo" refaz a mesma simulação (a URL guarda o formulário); a volta é o município.
    const consulta = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((x): [string, string] => [k, x])),
    ).toString();
    return (
      <FiscalIndisponivel
        estado={leitura.estado}
        endereco={`${urlSimularFiscal(ibge)}${consulta ? `?${consulta}` : ""}`}
        voltarPara={{ rotulo: "Voltar à capacidade fiscal do município", href: urlMunicipioFiscal(ibge) }}
      />
    );
  }
  return <SimuladorConteudo leitura={leitura} sp={sp} />;
}
