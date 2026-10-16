import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { tituloAssembleia } from "@/lib/oportunidades/assembleia-tela";
import { URL_FILA_EPB } from "@/lib/oportunidades/emendas-pb";
import { lerAssembleia } from "@/lib/oportunidades/emendas-pb.server";
import { diaBrasilia } from "@/lib/oportunidades/datas";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { SemEpbPublicadas } from "../PecasAssembleia";
import { FilaConteudo } from "./FilaConteudo";

export const metadata: Metadata = { title: tituloAssembleia("Fila do caminho"), robots: { index: false, follow: false } };

/**
 * A fila do caminho das emendas estaduais (E2, 16/10/2026): as emendas com ficha que ainda não estão pagas, em cada
 * passo, com os dias contados hoje. O "onde está travado" das estaduais. Só administradores.
 */
export default async function FilaPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const leitura = await lerAssembleia();
  if (leitura.estado === "sem_dado") return <SemEpbPublicadas kicker="Assembleia (PB) · fila do caminho" />;
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Assembleia (PB) · fila do caminho"
        titulo="A fila das emendas estaduais está indisponível agora"
        endereco={URL_FILA_EPB}
        voltarPara={{ rotulo: "Ver a lista dos deputados", href: "/mapa/parlamentares/assembleia" }}
      />
    );
  }
  return <FilaConteudo retrato={leitura.retrato} hoje={diaBrasilia(new Date().toISOString())} />;
}
