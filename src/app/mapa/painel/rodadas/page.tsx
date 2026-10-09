import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lerRodadas } from "@/lib/oportunidades/rodadas.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { RodadasConteudo } from "./RodadasConteudo";

export const metadata: Metadata = {
  title: "Saúde das rodadas · Painel · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A saúde das rodadas dos jobs (onda 9, C, 09/10/2026): o que o supervisor conferia à mão pelo MCP e pelo `gh`. Só
 * administradores, como o resto do painel: a página confere no servidor antes de ler. Não há "indisponível" da página
 * inteira: cada job falha sozinho e a linha dele diz "não lido".
 */
export default async function RodadasPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  return <RodadasConteudo painel={await lerRodadas()} />;
}
