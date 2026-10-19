import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { tituloCamaraJp } from "@/lib/oportunidades/camara-jp-tela";
import { URL_CAMARA_JP } from "@/lib/oportunidades/emendas-jp";
import { lerCamaraJp } from "@/lib/oportunidades/emendas-jp.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { CamaraJpConteudo } from "./CamaraJpConteudo";
import { SemEjpPublicadas } from "./PecasCamaraJp";

export const metadata: Metadata = { title: tituloCamaraJp(), robots: { index: false, follow: false } };

/**
 * As emendas impositivas da Câmara de João Pessoa (J2, 16/10/2026): os vereadores, cada ano e o atalho para a fila da
 * execução. Só administradores: a página confere no servidor antes de ler qualquer dado.
 */
export default async function CamaraJpPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const leitura = await lerCamaraJp();
  if (leitura.estado === "sem_dado") return <SemEjpPublicadas kicker="Parlamentares · Câmara de João Pessoa" />;
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Parlamentares · Câmara de João Pessoa"
        titulo="As emendas da Câmara de João Pessoa estão indisponíveis agora"
        endereco={URL_CAMARA_JP}
        voltarPara={{ rotulo: "Ver as emendas federais", href: "/mapa/parlamentares" }}
      />
    );
  }
  return <CamaraJpConteudo retrato={leitura.retrato} />;
}
