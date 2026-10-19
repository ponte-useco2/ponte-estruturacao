import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tituloVereadorJp } from "@/lib/oportunidades/camara-jp-tela";
import { URL_CAMARA_JP, emendasDoRetrato, vereadorDoSlug, vereadoresDoRetrato } from "@/lib/oportunidades/emendas-jp";
import { lerCamaraJp } from "@/lib/oportunidades/emendas-jp.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { SemEjpPublicadas } from "../PecasCamaraJp";
import { VereadorJpConteudo } from "./VereadorJpConteudo";

type Props = { params: Promise<{ vereador: string }> };

/** O título só com o que está no endereço, sem ler o banco nem a sessão. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vereador } = await params;
  return { title: tituloVereadorJp(/^[a-z0-9-]{1,80}$/.test(vereador) ? vereador : null), robots: { index: false, follow: false } };
}

/** A ficha de um vereador (ou colegiado) da Câmara de João Pessoa (J2, 16/10/2026). Só administradores. */
export default async function VereadorJpPage({ params }: Props) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const slug = (await params).vereador;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const leitura = await lerCamaraJp();
  if (leitura.estado === "sem_dado") return <SemEjpPublicadas kicker="Câmara de João Pessoa · vereador" />;
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Câmara de João Pessoa · vereador"
        titulo="A ficha do vereador está indisponível agora"
        endereco={`${URL_CAMARA_JP}/${slug}`}
        voltarPara={{ rotulo: "Ver a lista dos vereadores", href: URL_CAMARA_JP }}
      />
    );
  }
  const emendas = emendasDoRetrato(leitura.retrato);
  const vereador = vereadorDoSlug(vereadoresDoRetrato(leitura.retrato, emendas), slug);
  if (!vereador) notFound();
  return <VereadorJpConteudo retrato={leitura.retrato} vereador={vereador} emendas={emendas.filter((e) => e.pessoa === vereador.pessoa)} />;
}
