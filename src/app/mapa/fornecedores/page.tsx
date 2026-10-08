import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lerPainelFornecedores, type Marca, type Ordem } from "@/lib/oportunidades/fornecedores.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../busca/BuscaConteudo";
import { FornecedoresConteudo } from "./FornecedoresConteudo";

export const metadata: Metadata = {
  title: "Fornecedores · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * Fornecedores dos convênios da PB (onda 12, parte 3): quem recebeu, em quantos municípios, com que
 * contratos, e onde um só fornecedor concentra as compras da prefeitura.
 *
 * Só administradores: mostra nome de empresa, inclusive de MEI e empresário individual (decisão do titular
 * em 29/09/2026). A página confere no servidor antes de ler qualquer dado.
 */
export default async function FornecedoresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const sp = await searchParams;
  const q = (um(sp.q) ?? "").trim().slice(0, 80) || null;
  const municipio = /^\d{7}$/.test(um(sp.municipio) ?? "") ? um(sp.municipio) : null;
  const ordem: Ordem = um(sp.ordem) === "valor" ? "valor" : "municipios";
  const marcaUrl = um(sp.marca);
  const marca: Marca | null = marcaUrl === "inidoneos" || marcaUrl === "mei" ? marcaUrl : null;
  const filtro = { q, municipio, ordem, marca };

  const leitura = await lerPainelFornecedores(filtro);
  if (leitura.estado !== "ok") {
    // B14b (08/10/2026): "Tentar de novo" com o mesmo filtro e a volta ao painel (props da B12).
    const consulta = new URLSearchParams(
      Object.entries({ q, municipio, ordem: ordem === "valor" ? ordem : null, marca }).filter((e): e is [string, string] => !!e[1]),
    ).toString();
    return (
      <DadoIndisponivel
        kicker="Fornecedores · Paraíba"
        titulo="Os fornecedores estão indisponíveis agora"
        endereco={`/mapa/fornecedores${consulta ? `?${consulta}` : ""}`}
        voltarPara={{ rotulo: "Voltar ao painel de execução", href: "/mapa/painel" }}
      />
    );
  }
  return <FornecedoresConteudo leitura={leitura} filtro={filtro} />;
}
