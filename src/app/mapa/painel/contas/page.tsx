import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lerPainelDasColetas } from "@/lib/oportunidades/contas-obras.server";
import { lerPainelContas } from "@/lib/oportunidades/tce-tcu.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { ContasConteudo } from "./ContasConteudo";

export const metadata: Metadata = {
  title: "Contas e obras · Painel · PONTE",
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

  const [leitura, coletas] = await Promise.all([lerPainelContas(), lerPainelDasColetas()]);
  const temColeta = !!coletas && (coletas.impugnacoes !== null || coletas.obras !== null);
  if (leitura.estado !== "ok" && !temColeta) {
    return (
      <DadoIndisponivel
        kicker="Painel · TCE no TCU"
        titulo={leitura.estado === "sem_execucao" || leitura.estado === "nao_ativado" ? "O e-TCE do TCU ainda não foi consultado" : "A lista de TCE está indisponível agora"}
      />
    );
  }
  return <ContasConteudo leitura={leitura.estado === "ok" ? leitura : null} coletas={coletas} />;
}
