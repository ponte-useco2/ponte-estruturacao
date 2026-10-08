import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { ABAS_UF, abaDaUf, siglaDaUrl, urlUf, type AbaUf } from "@/lib/oportunidades/pagina-uf";
import { lerUf } from "@/lib/oportunidades/pagina-uf.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { UfConteudo } from "./UfConteudo";

export const metadata: Metadata = {
  title: "Estado · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A página da UF (U1, desenho aprovado em 08/10/2026): o território acima do município, em abas. Atrás do portão de
 * aprovados do `/mapa` até a F1d. A sigla vem da URL em minúsculas (com maiúscula, redireciona); a aba, de `?aba=`.
 * O administrador vê, na lista dos municípios, a decisão B do fiscal e os sinais do painel, e pode ordenar por eles
 * (`?ordem=sinais`); para os outros, a lista é neutra (ranking público rejeitado em 02/10).
 */
export default async function UfPage({
  params,
  searchParams,
}: {
  params: Promise<{ sigla: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const [{ sigla: bruto }, sp] = await Promise.all([params, searchParams]);
  const sigla = siglaDaUrl(decodeURIComponent(bruto));
  if (!sigla) notFound();
  if (bruto !== sigla.toLowerCase()) {
    const pedida = ABAS_UF.find((a) => a.id === (Array.isArray(sp.aba) ? sp.aba[0] : sp.aba))?.id as AbaUf | undefined;
    redirect(urlUf(sigla, pedida));
  }

  const administrador = ehAdministrador(visitante.email);
  const nivel = administrador ? 3 : 1;
  const aba = abaDaUf(sp.aba, nivel);
  const porSinais = administrador && sp.ordem === "sinais";
  const leitura = await lerUf(sigla, administrador);
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker="Estado" titulo="A página do estado está indisponível agora" />;
  after(() => registrarUso(visitante, "mapa_uf", { uf: sigla, aba, nivel }));
  return <UfConteudo l={leitura} aba={aba} nivel={nivel} porSinais={porSinais} />;
}
