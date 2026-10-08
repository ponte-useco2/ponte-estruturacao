import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { urlMunicipioFiscal } from "@/lib/oportunidades/fiscal";
import { lerFiscalMunicipio } from "@/lib/oportunidades/fiscal.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { FiscalIndisponivel } from "../FiscalConteudo";
import { FiscalMunicipioConteudo } from "./FiscalMunicipioConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: "Capacidade fiscal do município · Painel · PONTE",
  robots: { index: false, follow: false },
};

/** Um município da PB: as três decisões, cada verificação com evidência, base legal e histórico. */
export default async function FiscalMunicipioPage({ params }: { params: Promise<{ ibge: string }> }) {
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
            <LinkMapa href="/mapa/fiscal">Voltar à lista dos 223 municípios</LinkMapa>
          </p>
        </div>
      </div>
    );
  }
  // B14b (08/10/2026): "Tentar de novo" e a volta à lista fiscal.
  if (leitura.estado !== "ok") {
    return (
      <FiscalIndisponivel
        estado={leitura.estado}
        endereco={urlMunicipioFiscal(ibge)}
        voltarPara={{ rotulo: "Voltar à lista dos 223 municípios", href: "/mapa/fiscal" }}
      />
    );
  }
  return <FiscalMunicipioConteudo leitura={leitura} />;
}
