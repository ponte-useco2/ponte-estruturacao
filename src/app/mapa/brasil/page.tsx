import type { Metadata } from "next";
import { after } from "next/server";
import { abaDoBrasil, nivelNoBrasil, urlBrasil } from "@/lib/oportunidades/pagina-brasil";
import { lerBrasil } from "@/lib/oportunidades/pagina-brasil.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../busca/BuscaConteudo";
import { BrasilConteudo } from "./BrasilConteudo";

export const metadata: Metadata = {
  title: "Brasil · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A página do Brasil (U2, desenho aprovado em 08/10/2026): o topo da descida, com as 27 UFs lado a lado em ordem
 * alfabética e o mapa por UF. Atrás do portão de aprovados do `/mapa` até a F1d; a aba vem de `?aba=`.
 *
 * Indisponível (C1b, 08/10/2026, com as saídas da B12): "Tentar de novo" volta à mesma aba; a outra saída é a carteira,
 * que não depende da leitura do painel que derrubou esta página (a da Paraíba depende).
 */
export default async function BrasilPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  const sp = await searchParams;
  const nivel = nivelNoBrasil(ehAdministrador(visitante.email));
  const aba = abaDoBrasil(sp.aba, nivel);
  const leitura = await lerBrasil();
  if (leitura.estado !== "ok")
    return (
      <DadoIndisponivel
        kicker="Brasil"
        titulo="A página do Brasil está indisponível agora"
        endereco={urlBrasil(aba)}
        voltarPara={{ rotulo: "Abrir a carteira", href: "/mapa/carteira" }}
      />
    );
  after(() => registrarUso(visitante, "mapa_brasil", { aba, nivel }));
  return <BrasilConteudo l={leitura} aba={aba} nivel={nivel} />;
}
