import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tituloDeputado } from "@/lib/oportunidades/assembleia-tela";
import { diaBrasilia } from "@/lib/oportunidades/datas";
import { URL_ASSEMBLEIA, pessoaDoSlug, slugDaUrl } from "@/lib/oportunidades/emendas-pb";
import { lerAssembleia } from "@/lib/oportunidades/emendas-pb.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { SemEpbPublicadas } from "../PecasAssembleia";
import { DeputadoConteudo } from "./DeputadoConteudo";

type Props = { params: Promise<{ deputado: string }> };

/** O título só com o que está no endereço (o slug), sem ler o banco nem a sessão. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { deputado } = await params;
  return { title: tituloDeputado(slugDaUrl(deputado)), robots: { index: false, follow: false } };
}

/**
 * A ficha de um deputado estadual (E2, 16/10/2026): as emendas ano a ano ao lado da Assembleia na mesma safra, cada
 * emenda com o passo do caminho, e o destino pelo empenho. Só administradores. O slug fora da forma, ou que não é de
 * nenhuma pessoa da última rodada, dá o 404 de sempre.
 */
export default async function DeputadoPage({ params }: Props) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const slug = slugDaUrl((await params).deputado);
  if (!slug) notFound();
  const leitura = await lerAssembleia();
  if (leitura.estado === "sem_dado") return <SemEpbPublicadas kicker="Assembleia (PB) · deputado estadual" />;
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Assembleia (PB) · deputado estadual"
        titulo="A ficha do deputado está indisponível agora"
        endereco={`${URL_ASSEMBLEIA}/${slug}`}
        voltarPara={{ rotulo: "Ver a lista dos deputados", href: URL_ASSEMBLEIA }}
      />
    );
  }
  const pessoa = pessoaDoSlug(leitura.retrato, slug);
  if (!pessoa) notFound();
  return <DeputadoConteudo retrato={leitura.retrato} pessoa={pessoa} hoje={diaBrasilia(new Date().toISOString())} />;
}
