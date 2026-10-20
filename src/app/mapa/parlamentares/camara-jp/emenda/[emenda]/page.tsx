import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tituloEmendaJp } from "@/lib/oportunidades/camara-jp-tela";
import { URL_CAMARA_JP, chaveEmendaJp, emendaJpDaUrl } from "@/lib/oportunidades/emendas-jp";
import { lerEmendaJp } from "@/lib/oportunidades/emendas-jp.server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../../busca/BuscaConteudo";
import { SemEjpPublicadas } from "../../PecasCamaraJp";
import { EmendaJpConteudo } from "./EmendaJpConteudo";

type Props = { params: Promise<{ emenda: string }> };

/** O título só com o que está no endereço ("Emenda 171/2026"), sem ler o banco nem a sessão. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const alvo = emendaJpDaUrl((await params).emenda);
  return { title: tituloEmendaJp(alvo?.ano ?? null, alvo?.codigo ?? null), robots: { index: false, follow: false } };
}

/**
 * Uma emenda da Câmara de João Pessoa (J2, 16/10/2026). O endereço é `AAAA-NNNN` (ano do exercício e número); fora disso,
 * ou fora da última rodada, o 404 de sempre. Só administradores.
 */
export default async function EmendaJpPage({ params }: Props) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const daUrl = (await params).emenda;
  const alvo = emendaJpDaUrl(daUrl);
  if (!alvo) notFound();
  const [leitura, seguidas] = await Promise.all([lerEmendaJp(daUrl), lerSeguidas()]);
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado === "sem_dado") return <SemEjpPublicadas kicker="Câmara de João Pessoa · emenda" />;
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Câmara de João Pessoa · emenda"
        titulo="A emenda está indisponível agora"
        endereco={`${URL_CAMARA_JP}/emenda/${daUrl}`}
        voltarPara={{ rotulo: "Ver a lista dos vereadores", href: URL_CAMARA_JP }}
      />
    );
  }
  // J4 (oport_45): a chave do item seguido é a do endereço normalizado (`AAAA-NNNN`).
  const chave = chaveEmendaJp(alvo.ano, alvo.codigo);
  return <EmendaJpConteudo leitura={leitura} chave={chave} seguindo={seguidas ? seguidas.has(chaveSeguida("emenda_municipal", chave)) : null} />;
}
