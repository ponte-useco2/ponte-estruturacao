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
    // B14b (08/10/2026): a tomada de contas especial por extenso (H06), "Tentar de novo" e a volta ao painel (props da B12).
    return (
      <DadoIndisponivel
        kicker="Painel · Tomadas de contas especiais (TCU)"
        titulo={
          leitura.estado === "sem_execucao" || leitura.estado === "nao_ativado"
            ? "O sistema e-TCE do TCU ainda não foi consultado"
            : "A lista de tomadas de contas especiais está indisponível agora"
        }
        endereco="/mapa/painel/contas"
        voltarPara={{ rotulo: "Voltar ao painel de execução", href: "/mapa/painel" }}
      />
    );
  }
  return <ContasConteudo leitura={leitura.estado === "ok" ? leitura : null} coletas={coletas} />;
}
