import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { codigoAutorDaUrl } from "@/lib/oportunidades/emendas";
import { lerParlamentar } from "@/lib/oportunidades/emendas.server";
import { abaDoParlamentar, tituloParlamentar, urlParlamentar } from "@/lib/oportunidades/parlamentares-tela";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { SemEmendasPublicadas } from "../../parlamentares/PecasParlamentares";
import { ParlamentarConteudo } from "./ParlamentarConteudo";

const NAO_INDEXAR: Metadata["robots"] = { index: false, follow: false };

type Props = {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * O título com o código e a aba (onda 14, parte 2, B, 13/10/2026), no padrão de `titulo-pagina.ts`: só o que está no
 * endereço, sem ler o banco nem a sessão. Código que não é de 4 dígitos fica com o título genérico, sem repetir a URL.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ codigo }, sp] = await Promise.all([params, searchParams]);
  return { title: tituloParlamentar(codigoAutorDaUrl(codigo), abaDoParlamentar(sp.aba)), robots: NAO_INDEXAR };
}

/**
 * A ficha de um autor de emendas (onda 14, parte 2, B, 13/10/2026), em abas pela URL (`?aba=`), como a página do
 * município: Acesso, Destinação, Execução e Contexto e método. Só administradores até a revisão jurídica: a página
 * confere no servidor antes de ler qualquer dado.
 *
 * O código é o do autor no mandato, exatamente 4 dígitos (`codigoAutorDaUrl`); qualquer outra coisa dá o 404 de sempre
 * sem ler o banco. O autor que não está na última rodada também dá o 404.
 */
export default async function ParlamentarPage({ params, searchParams }: Props) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const [{ codigo: daUrl }, sp] = await Promise.all([params, searchParams]);
  const codigo = codigoAutorDaUrl(daUrl);
  if (!codigo) notFound();
  const aba = abaDoParlamentar(sp.aba);

  const leitura = await lerParlamentar(codigo);
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado === "sem_dado") {
    return <SemEmendasPublicadas kicker={`Parlamentares · autor ${codigo}`} voltar={{ rotulo: "Ver a lista dos autores", href: "/mapa/parlamentares" }} />;
  }
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker={`Parlamentares · autor ${codigo}`}
        titulo="A ficha do autor está indisponível agora"
        endereco={urlParlamentar(codigo, aba)}
        voltarPara={{ rotulo: "Ver a lista dos autores", href: "/mapa/parlamentares" }}
      />
    );
  }
  return <ParlamentarConteudo leitura={leitura} aba={aba} />;
}
