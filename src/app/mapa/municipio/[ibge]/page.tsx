import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { quemRecebe } from "@/lib/oportunidades/pagina-entidade";
import { PODE, abaEscolhida } from "@/lib/oportunidades/pagina-municipio";
import { nivelNoMunicipio } from "@/lib/oportunidades/pagina-municipio.server";
import { relatorioSemNomes } from "@/lib/oportunidades/relatorio-municipio";
import { lerEntidadesDoMunicipio, lerRelatorioMunicipio } from "@/lib/oportunidades/relatorio-municipio.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { MunicipioConteudo } from "./MunicipioConteudo";

export const metadata: Metadata = {
  title: "Município · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A página do município em abas (F1a, 06/10/2026). Por enquanto atrás do portão de aprovados do `/mapa`; o
 * que cada aprovado vê dentro das abas segue a decisão D1 (cadastrado, cliente do próprio município,
 * administrador). A aba vem da URL (`?aba=`), para o endereço levar direto a ela.
 */
export default async function MunicipioPage({
  params,
  searchParams,
}: {
  params: Promise<{ ibge: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { ibge } = await params;
  if (!/^25\d{5}$/.test(ibge)) notFound();
  const [leitura, nivel, sp] = await Promise.all([
    lerRelatorioMunicipio(ibge, diaBrasilia(new Date().toISOString())),
    nivelNoMunicipio(visitante, ibge),
    searchParams,
  ]);
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker="Município" titulo="A página do município está indisponível agora" />;
  const aba = abaEscolhida(sp.aba, nivel);
  const seguidas = await lerSeguidas();
  after(() => registrarUso(visitante, "mapa_municipio", { ibge, aba, nivel }));
  const r = PODE.interno(nivel) ? leitura.relatorio : relatorioSemNomes(leitura.relatorio);
  // "Quem recebe no município" (E1): só na aba do dinheiro, que é onde o bloco aparece.
  const linhas = aba === "dinheiro" ? await lerEntidadesDoMunicipio(ibge) : undefined;
  const entidades = linhas === undefined ? undefined : linhas ? quemRecebe(linhas) : null;
  return <MunicipioConteudo r={r} aba={aba} nivel={nivel} seguindo={seguidas?.has(chaveSeguida("municipio", ibge)) ?? false} entidades={entidades} />;
}
