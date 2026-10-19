import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { PODE, abaEscolhida, ibgeDaUrl, podeAbaMunicipio, urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { lerAssembleia, lerFederalPorAno, lerTceEstadoDoMunicipio } from "@/lib/oportunidades/emendas-pb.server";
import { IBGE_JOAO_PESSOA } from "@/lib/oportunidades/emendas-jp";
import { lerCamaraJp } from "@/lib/oportunidades/emendas-jp.server";
import { nivelNoMunicipio } from "@/lib/oportunidades/pagina-municipio.server";
import { relatorioSemNomes } from "@/lib/oportunidades/relatorio-municipio";
import { lerRelatorioMunicipio } from "@/lib/oportunidades/relatorio-municipio.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { RelatorioConteudo } from "./RelatorioConteudo";

export const metadata: Metadata = {
  title: "Relatório do município · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O relatório crítico de um município da PB (onda 14), inteiro, para imprimir. Desde a F1 (decisão D1 de
 * 06/10/2026) abre para todo aprovado; quem não é administrador recebe a versão sem nomes de fornecedor, e os
 * convênios apontam para a página do instrumento, salvo o cliente do próprio município, que vai ao laudo.
 *
 * C4a (09/10/2026; achado B1 da revisão R3): passa a conferir o nível, como o relatório da entidade e o da UF — quem
 * não alcança a aba "Relatório e dados" (`podeAbaMunicipio`) volta à página do município. Até aqui só o portão de
 * aprovados fechava a rota; com a versão pública, o nível 0 existe e não abre o relatório completo (D1).
 *
 * Onda 12, A (12/10/2026; M1 da revisão de segurança da onda 11): o IBGE tem de ser um dos 223 da PB (`ibgeDaUrl`),
 * como na página do município; o que não é dá o 404 de sempre, sem ler o banco.
 */
export default async function RelatorioMunicipioPage({ params }: { params: Promise<{ ibge: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { ibge } = await params;
  if (!ibgeDaUrl(ibge)) notFound();
  const [leitura, nivel] = await Promise.all([lerRelatorioMunicipio(ibge, diaBrasilia(new Date().toISOString())), nivelNoMunicipio(visitante, ibge)]);
  if (leitura.estado === "nao_encontrado") notFound();
  if (!podeAbaMunicipio("relatorio", nivel)) redirect(urlMunicipio(ibge));
  if (leitura.estado !== "ok") {
    // B12b: "Tentar de novo" no próprio relatório; a volta é o município, na aba de onde o relatório se abre (ou na que o
    // nível de acesso alcança).
    return (
      <DadoIndisponivel
        kicker="Relatório do município"
        titulo="O relatório está indisponível agora"
        endereco={`/mapa/municipio/${ibge}/relatorio`}
        voltarPara={{ rotulo: "Voltar ao município", href: urlMunicipio(ibge, abaEscolhida("relatorio", nivel)) }}
      />
    );
  }
  // As emendas estaduais (E2, 16/10/2026): só o administrador lê; a rejeição inesperada vira "falha", numa linha.
  const [seguidas, assembleia, tceEstado, federalPorAno, camaraJp] = await Promise.all([
    lerSeguidas(),
    PODE.interno(nivel) ? lerAssembleia().catch(() => ({ estado: "falha" as const })) : Promise.resolve(undefined),
    PODE.interno(nivel) ? lerTceEstadoDoMunicipio(ibge).catch(() => ({ estado: "falha" as const })) : Promise.resolve(undefined),
    PODE.interno(nivel) ? lerFederalPorAno({ ibge }).catch(() => ({ estado: "falha" as const })) : Promise.resolve(undefined),
    // J2 das emendas de João Pessoa (16/10/2026): a Câmara Municipal, só no relatório de João Pessoa.
    PODE.interno(nivel) && ibge === IBGE_JOAO_PESSOA ? lerCamaraJp().catch(() => ({ estado: "falha" as const })) : Promise.resolve(undefined),
  ]);
  after(() => registrarUso(visitante, "mapa_relatorio_municipio", { ibge, nivel }));
  const r = PODE.interno(nivel) ? leitura.relatorio : relatorioSemNomes(leitura.relatorio);
  return <RelatorioConteudo r={r} nivel={nivel} seguindo={seguidas?.has(chaveSeguida("municipio", ibge)) ?? false} assembleia={assembleia} tceEstado={tceEstado} federalPorAno={federalPorAno} camaraJp={camaraJp} />;
}
