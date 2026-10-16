import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tituloEmendaEpb } from "@/lib/oportunidades/assembleia-tela";
import { diaBrasilia } from "@/lib/oportunidades/datas";
import { URL_ASSEMBLEIA, emendaDaUrl } from "@/lib/oportunidades/emendas-pb";
import { lerEmendaEpb } from "@/lib/oportunidades/emendas-pb.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../../busca/BuscaConteudo";
import { SemEpbPublicadas } from "../../PecasAssembleia";
import { EmendaConteudo } from "./EmendaConteudo";

type Props = { params: Promise<{ emenda: string }> };

/** O título só com o que está no endereço ("Emenda 0075/2025"), sem ler o banco nem a sessão. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { emenda } = await params;
  return { title: tituloEmendaEpb(emendaDaUrl(emenda)), robots: { index: false, follow: false } };
}

/**
 * Uma emenda estadual (E2, 16/10/2026): o catálogo, a ficha, o caminho com os pareceres e o responsável de cada passo
 * (nome de servidor: só administrador) e o destino pelo empenho. O endereço é `AAAA-NNNN`; fora disso, ou fora da
 * última rodada, o 404 de sempre.
 */
export default async function EmendaEpbPage({ params }: Props) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const daUrl = (await params).emenda;
  if (!emendaDaUrl(daUrl)) notFound();
  const leitura = await lerEmendaEpb(daUrl);
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado === "sem_dado") return <SemEpbPublicadas kicker="Assembleia (PB) · emenda" />;
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Assembleia (PB) · emenda"
        titulo="A emenda está indisponível agora"
        endereco={`${URL_ASSEMBLEIA}/emenda/${daUrl}`}
        voltarPara={{ rotulo: "Ver a lista dos deputados", href: URL_ASSEMBLEIA }}
      />
    );
  }
  return <EmendaConteudo leitura={leitura} hoje={diaBrasilia(new Date().toISOString())} />;
}
