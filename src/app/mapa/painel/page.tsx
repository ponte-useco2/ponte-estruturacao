import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { parametrosPainel, urlPainel } from "@/lib/oportunidades/painel";
import { lerPainel } from "@/lib/oportunidades/painel.server";
import { estadosDaVisao, parametrosDaPagina } from "@/lib/oportunidades/painel-tabelas";
import { PainelConteudo, PainelIndisponivel } from "./PainelConteudo";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";

export const metadata: Metadata = {
  title: "Painel · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Painel de execução da PONTE — uso interno.
 *
 * Só administradores (OPORTUNIDADES_ADMINS). Quem não é vai para /mapa sem saber
 * que a página existe, como no Radar.
 *
 * Tudo aqui é Server Component: a visão, a UF e o órgão são links e um formulário
 * GET. A página funciona sem JavaScript, e cada recorte tem URL própria para ser
 * mandado a alguém. Só o botão de copiar o número do convênio roda no navegador.
 */
export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const sp = await searchParams;
  const p = parametrosPainel(sp);
  // F3.2: o filtro e a ordem das tabelas de convênio vão à consulta (o endereço guarda o estado de cada tabela).
  const leitura = await lerPainel(p, estadosDaVisao(p.visao, parametrosDaPagina(sp)));

  if (leitura.estado !== "ok") {
    // B14b (08/10/2026): o mesmo recorte vira "Tentar de novo".
    return <PainelIndisponivel estado={leitura.estado} endereco={urlPainel(p, {})} />;
  }

  return <PainelConteudo p={p} leitura={leitura} />;
}
