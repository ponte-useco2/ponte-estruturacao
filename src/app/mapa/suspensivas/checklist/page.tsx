import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { lerPadroes } from "@/lib/oportunidades/padroes.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { ChecklistConteudo } from "./ChecklistConteudo";

export const metadata: Metadata = {
  title: "Checklist preventivo · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Checklist preventivo por órgão (onda 11, parte 3): o que ter pronto antes de mandar uma proposta,
 * aprendido com quem está preso na suspensiva. GET puro: cada órgão tem URL própria e a página imprime.
 */
export default async function ChecklistPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const leitura = await lerPadroes();
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker="Checklist preventivo" titulo="O checklist está indisponível agora" />;

  const sp = await searchParams;
  const orgao = Array.isArray(sp.orgao) ? sp.orgao[0] : sp.orgao;
  return <ChecklistConteudo leitura={leitura} hoje={diaBrasilia(new Date().toISOString())} orgao={orgao ?? null} />;
}
