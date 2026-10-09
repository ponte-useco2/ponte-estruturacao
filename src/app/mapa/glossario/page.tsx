import type { Metadata } from "next";
import { after } from "next/server";
import { chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
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
 *
 * C4a (09/10/2026; item 8 da revisão R3 e 4.1 da auditoria R1): com a chave `MAPA_PUBLICO` ligada, também o público.
 * Não há dado aqui, e o "Ver no glossário" de cada `<Termo>` das páginas abertas leva para cá. O uso do público não é
 * registrado (`registrarUso` só grava o aprovado).
 */
export default async function GlossarioPage() {
  const acesso = quemAPaginaAtende(await visitanteAtual(), chaveDoAmbiente(), "/mapa/glossario");
  if (!acesso) return null;
  const visitante = acesso.aprovado;
  after(() => registrarUso(visitante, "mapa_glossario"));
  return <GlossarioConteudo />;
}
