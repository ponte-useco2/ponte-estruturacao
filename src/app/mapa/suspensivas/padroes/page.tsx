import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { lerPadroes } from "@/lib/oportunidades/padroes.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { PadroesConteudo } from "./PadroesConteudo";

export const metadata: Metadata = {
  title: "Padrões das suspensivas · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/** Destino, tempo típico, condições, analistas e documentos das suspensivas da PB (onda 11, parte 3). */
export default async function PadroesPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const leitura = await lerPadroes();
  if (leitura.estado !== "ok") {
    // B14b (08/10/2026): "Tentar de novo" e a volta à lista das suspensivas (props da B12).
    return (
      <DadoIndisponivel
        kicker="Padrões das suspensivas"
        titulo="Os padrões estão indisponíveis agora"
        endereco="/mapa/suspensivas/padroes"
        voltarPara={{ rotulo: "Ver a lista das suspensivas", href: "/mapa/suspensivas" }}
      />
    );
  }
  return <PadroesConteudo leitura={leitura} hoje={diaBrasilia(new Date().toISOString())} />;
}
