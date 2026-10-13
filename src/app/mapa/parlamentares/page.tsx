import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lerParlamentares } from "@/lib/oportunidades/emendas.server";
import { tipoDaUrl, tituloParlamentares, urlParlamentares } from "@/lib/oportunidades/parlamentares-tela";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../busca/BuscaConteudo";
import { ParlamentaresConteudo } from "./ParlamentaresConteudo";
import { SemEmendasPublicadas } from "./PecasParlamentares";

const NAO_INDEXAR: Metadata["robots"] = { index: false, follow: false };

/**
 * O título leva o tipo filtrado, que está no endereço (onda 14, parte 2, B, 13/10/2026): "Parlamentares · Comissão ·
 * Mapa de Oportunidades · PONTE". Não lê o banco nem a sessão.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  return { title: tituloParlamentares(tipoDaUrl(sp.tipo)), robots: NAO_INDEXAR };
}

/**
 * Os autores de emendas com recurso para a Paraíba (onda 14, parte 2, B, 13/10/2026): a lista por tipo e nome, com os
 * canais, os municípios atendidos, os caducados e a fila. Só administradores até a revisão jurídica, como o resto do
 * painel: a página confere no servidor antes de ler qualquer dado. Sem posição, nota ou ranking.
 */
export default async function ParlamentaresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const tipo = tipoDaUrl((await searchParams).tipo);
  const leitura = await lerParlamentares();
  if (leitura.estado === "sem_dado") {
    return <SemEmendasPublicadas kicker="Parlamentares · Paraíba" voltar={{ rotulo: "Voltar ao painel de execução", href: "/mapa/painel" }} />;
  }
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Parlamentares · Paraíba"
        titulo="A lista dos autores de emendas está indisponível agora"
        endereco={urlParlamentares(tipo)}
        voltarPara={{ rotulo: "Voltar ao painel de execução", href: "/mapa/painel" }}
      />
    );
  }
  return <ParlamentaresConteudo execucao={leitura.execucao} autores={leitura.autores} tipo={tipo} />;
}
