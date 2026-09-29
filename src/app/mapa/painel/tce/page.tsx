import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lerPainelTce } from "@/lib/oportunidades/tce.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { TceConteudo } from "./TceConteudo";

export const metadata: Metadata = {
  title: "Dinheiro federal no TCE-PB · Painel · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O Pix como os municípios da PB o gastaram e a conciliação dos convênios SICONV × TCE-PB (onda 12,
 * parte 3B). Só administradores: mostra nomes de empresa. A página confere no servidor antes de ler.
 */
export default async function TcePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const leitura = await lerPainelTce();
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Painel · TCE-PB"
        titulo={leitura.estado === "sem_execucao" || leitura.estado === "nao_ativado" ? "O TCE-PB ainda não foi lido" : "O painel do TCE-PB está indisponível agora"}
      />
    );
  }
  const sp = await searchParams;
  const ano = Number(Array.isArray(sp.ano) ? sp.ano[0] : sp.ano);
  return <TceConteudo leitura={leitura} anoPedido={Number.isInteger(ano) ? ano : null} />;
}
