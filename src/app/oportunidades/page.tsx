import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { OportunidadesClient, type Payload } from "./OportunidadesClient";
import { lerPayload } from "./dados.server";
import { visitanteAtual, authConfigurada } from "@/lib/supabase-auth";
import { registrarEvento } from "./eventos";

/**
 * `noindex`: a página virou área reservada. Manter metadados de indexação
 * numa rota que redireciona para login só produz resultado de busca que leva
 * a uma porta fechada — pior para quem clica do que não aparecer.
 */
export const metadata: Metadata = {
  title: "Oportunidades — janelas abertas de convênio | Ponte",
  description:
    "Painel das janelas de proposta e emenda abertas no Transferegov. Acesso mediante cadastro.",
  robots: { index: false, follow: false },
};

/**
 * Dinâmica, não mais estática.
 *
 * A página lia o JSON em build time e servia HTML pronto — ótimo para SEO e
 * velocidade, incompatível com controle de acesso: uma página pré-renderizada
 * é a mesma para todo mundo, inclusive para quem não entrou.
 *
 * O custo é baixo: o "banco de dados" é um arquivo JSON lido do disco.
 */
export const dynamic = "force-dynamic";

export default async function OportunidadesPage() {
  // Sem Supabase configurado, a porta fecha. Nunca abre por omissão.
  if (!authConfigurada()) redirect("/oportunidades/entrar?erro=config");

  const visitante = await visitanteAtual();
  if (!visitante) redirect("/oportunidades/entrar");
  if (visitante.status !== "aprovado") redirect("/oportunidades/aguardando");

  const payloadInicial: Payload | null = await lerPayload();

  // Registro da entrada. Sem `await` bloqueante seria mais rápido, mas em
  // serverless a função pode ser encerrada antes da gravação terminar — e um
  // registro de auditoria que às vezes não grava não é registro de auditoria.
  await registrarEvento("entrada", { versao: payloadInicial?.versao ?? null });

  return (
    <Suspense fallback={null}>
      <OportunidadesClient payloadInicial={payloadInicial} />
    </Suspense>
  );
}
