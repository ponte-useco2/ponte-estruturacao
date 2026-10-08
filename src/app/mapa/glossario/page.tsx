import type { Metadata } from "next";
import { after } from "next/server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { GlossarioConteudo } from "./GlossarioConteudo";

export const metadata: Metadata = {
  title: "Glossário · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O glossário do Mapa (B7, 08/10/2026): a explicação inteira de cada termo que o `<Termo>` marca nas páginas.
 * Atrás do mesmo portão de aprovados das outras páginas do `/mapa`. Não lê banco: o conteúdo é o de
 * `lib/oportunidades/glossario.ts`. O uso registrado diz se o glossário é aberto, não qual termo (a âncora não
 * chega ao servidor).
 */
export default async function GlossarioPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  after(() => registrarUso(visitante, "mapa_glossario"));
  return <GlossarioConteudo />;
}
