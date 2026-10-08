import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ehMunicipioPb, urlInvestimentos } from "@/lib/oportunidades/busca";
import { lerInvestimentos } from "@/lib/oportunidades/busca.server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { ufDoIbge } from "@/lib/oportunidades/painel";
import { voltarParaUf } from "@/lib/oportunidades/vazios";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { InvestimentosConteudo } from "./InvestimentosConteudo";

export const metadata: Metadata = {
  title: "Investimentos no município · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Investimentos federais num município — para qualquer usuário aprovado.
 *
 * Diferente da ficha do painel (só administradores, com os sinais de problema), aqui só há
 * totais e listas de instrumentos: o que o município recebe, não o que trava.
 */
export default async function InvestimentosPage({ params }: { params: Promise<{ ibge: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { ibge } = await params;
  const uf = ufDoIbge(ibge);
  if (!uf) notFound();
  const leitura = await lerInvestimentos(ibge);
  if (leitura.estado !== "ok") {
    // B12b: "Tentar de novo" na própria página; a volta é o nível acima — o município na PB, a UF fora dela.
    const voltar = ehMunicipioPb(ibge) ? { rotulo: "Voltar ao município", href: urlMunicipio(ibge, "dinheiro") } : voltarParaUf(uf);
    return (
      <DadoIndisponivel
        kicker="Investimentos federais"
        titulo="Os investimentos estão indisponíveis agora"
        endereco={urlInvestimentos(ibge)}
        voltarPara={voltar ?? undefined}
      />
    );
  }
  const seguidas = await lerSeguidas();
  return <InvestimentosConteudo ibge={ibge} uf={uf} leitura={leitura} seguindo={seguidas?.has(chaveSeguida("municipio", ibge)) ?? false} />;
}
