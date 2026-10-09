import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { PODE, abaEscolhida, podeAbaMunicipio, urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
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
 */
export default async function RelatorioMunicipioPage({ params }: { params: Promise<{ ibge: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { ibge } = await params;
  if (!/^25\d{5}$/.test(ibge)) notFound();
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
  const seguidas = await lerSeguidas();
  after(() => registrarUso(visitante, "mapa_relatorio_municipio", { ibge, nivel }));
  const r = PODE.interno(nivel) ? leitura.relatorio : relatorioSemNomes(leitura.relatorio);
  return <RelatorioConteudo r={r} nivel={nivel} seguindo={seguidas?.has(chaveSeguida("municipio", ibge)) ?? false} />;
}
