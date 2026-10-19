import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { tituloCamaraJp } from "@/lib/oportunidades/camara-jp-tela";
import { URL_CAMARA_JP, URL_FILA_EJP } from "@/lib/oportunidades/emendas-jp";
import { lerCamaraJp } from "@/lib/oportunidades/emendas-jp.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { SemEjpPublicadas } from "../PecasCamaraJp";
import { FilaJpConteudo } from "./FilaJpConteudo";

export const metadata: Metadata = { title: tituloCamaraJp("Fila da execução"), robots: { index: false, follow: false } };

/** A fila da execução das emendas de João Pessoa (J2, 16/10/2026). Só administradores. */
export default async function FilaJpPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const leitura = await lerCamaraJp();
  if (leitura.estado === "sem_dado") return <SemEjpPublicadas kicker="Câmara de João Pessoa · fila" />;
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Câmara de João Pessoa · fila"
        titulo="A fila das emendas de João Pessoa está indisponível agora"
        endereco={URL_FILA_EJP}
        voltarPara={{ rotulo: "Ver a lista dos vereadores", href: URL_CAMARA_JP }}
      />
    );
  }
  return <FilaJpConteudo retrato={leitura.retrato} />;
}
