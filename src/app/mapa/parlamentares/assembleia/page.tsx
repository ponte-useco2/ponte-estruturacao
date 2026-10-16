import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { tituloAssembleia } from "@/lib/oportunidades/assembleia-tela";
import { URL_ASSEMBLEIA } from "@/lib/oportunidades/emendas-pb";
import { lerAssembleia } from "@/lib/oportunidades/emendas-pb.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { AssembleiaConteudo } from "./AssembleiaConteudo";
import { SemEpbPublicadas } from "./PecasAssembleia";

export const metadata: Metadata = { title: tituloAssembleia(), robots: { index: false, follow: false } };

/**
 * As emendas impositivas da Assembleia da PB (emendas estaduais, E2, 16/10/2026): os deputados, a safra de cada ano e
 * o atalho para a fila do caminho. Só administradores até a revisão jurídica: a página confere no servidor antes de ler
 * qualquer dado.
 */
export default async function AssembleiaPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const leitura = await lerAssembleia();
  if (leitura.estado === "sem_dado") return <SemEpbPublicadas kicker="Parlamentares · Assembleia (PB)" />;
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Parlamentares · Assembleia (PB)"
        titulo="As emendas estaduais estão indisponíveis agora"
        endereco={URL_ASSEMBLEIA}
        voltarPara={{ rotulo: "Ver as emendas federais", href: "/mapa/parlamentares" }}
      />
    );
  }
  return <AssembleiaConteudo retrato={leitura.retrato} />;
}
