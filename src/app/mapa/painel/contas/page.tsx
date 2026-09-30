import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lerPainelContas } from "@/lib/oportunidades/tce-tcu.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { ContasConteudo } from "./ContasConteudo";

export const metadata: Metadata = {
  title: "Tomadas de Contas Especiais · Painel · PONTE",
  robots: { index: false, follow: false },
};

/**
 * As Tomadas de Contas Especiais dos convênios da PB no e-TCE do TCU (onda 13C). Só administradores,
 * como o resto do painel. A página confere no servidor antes de ler.
 */
export default async function ContasPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const leitura = await lerPainelContas();
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Painel · TCE no TCU"
        titulo={leitura.estado === "sem_execucao" || leitura.estado === "nao_ativado" ? "O e-TCE do TCU ainda não foi consultado" : "A lista de TCE está indisponível agora"}
      />
    );
  }
  return <ContasConteudo leitura={leitura} />;
}
