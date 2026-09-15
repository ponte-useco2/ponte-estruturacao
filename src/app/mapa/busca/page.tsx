import type { Metadata } from "next";
import { parametrosBusca } from "@/lib/oportunidades/busca";
import { lerBusca } from "@/lib/oportunidades/busca.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { BuscaConteudo, DadoIndisponivel } from "./BuscaConteudo";

export const metadata: Metadata = {
  title: "Busca · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Busca de convênios e propostas — para qualquer usuário aprovado.
 *
 * O portão de login e aprovação é do layout de `/mapa`; a página repete a checagem porque
 * layout e página renderizam em paralelo. Formulário GET: funciona sem JavaScript e cada
 * busca tem URL própria para ser mandada a alguém.
 */
export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const p = parametrosBusca(await searchParams);
  const leitura = await lerBusca(p);
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker="Busca" titulo="A busca está indisponível agora" />;
  return <BuscaConteudo p={p} leitura={leitura} />;
}
