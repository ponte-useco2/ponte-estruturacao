import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { cnpjDaUrl, podeAbaEntidade, urlEntidade, urlRelatorioEntidade } from "@/lib/oportunidades/pagina-entidade";
import { PODE } from "@/lib/oportunidades/pagina-municipio";
import { relatorioSemNomes } from "@/lib/oportunidades/relatorio-municipio";
import { lerRelatorioEntidade } from "@/lib/oportunidades/relatorio-municipio.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { nivelDoVisitanteNaEntidade } from "../nivel.server";
import { RelatorioEntidadeConteudo } from "./RelatorioEntidadeConteudo";

export const metadata: Metadata = {
  title: "Relatório da entidade · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O relatório da entidade para imprimir (C1c, 08/10/2026), no modelo do relatório do município: a mesma leitura da
 * página da entidade (`lerRelatorioEntidade`, da memória de 10 minutos quando há) e o mesmo acesso da aba "Relatório e
 * dados" (D1: todo aprovado com cadastro; quem não alcança a aba volta à página). Quem não é administrador recebe o
 * relatório sem nomes de fornecedor. A OSC só do cadastro do Mapa das OSC tem o relatório do cadastro.
 */
export default async function RelatorioEntidadePage({ params }: { params: Promise<{ cnpj: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { cnpj: bruto } = await params;
  const cnpj = cnpjDaUrl(decodeURIComponent(bruto));
  if (!cnpj) notFound();
  if (cnpj !== bruto) redirect(urlRelatorioEntidade(cnpj));

  const leitura = await lerRelatorioEntidade(cnpj, diaBrasilia(new Date().toISOString()));
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Relatório da entidade"
        titulo="O relatório está indisponível agora"
        endereco={urlRelatorioEntidade(cnpj)}
        voltarPara={{ rotulo: "Abrir a página da entidade", href: urlEntidade(cnpj) }}
      />
    );
  }

  const nivel = await nivelDoVisitanteNaEntidade(visitante, leitura.entidade);
  if (!podeAbaEntidade("relatorio", nivel)) redirect(urlEntidade(cnpj));
  const soCadastro = !leitura.instrumentos.length && !leitura.propostas.length;
  after(() => registrarUso(visitante, "mapa_entidade_relatorio", { cnpj, nivel, soCadastro }));

  const r = PODE.interno(nivel) ? leitura.relatorio : relatorioSemNomes(leitura.relatorio);
  const seguidas = await lerSeguidas();
  return (
    <RelatorioEntidadeConteudo
      e={leitura.entidade}
      r={r}
      instrumentos={leitura.instrumentos}
      propostas={leitura.propostas}
      osc={leitura.osc}
      nivel={nivel}
      seguindo={seguidas?.has(chaveSeguida("entidade", cnpj)) ?? false}
    />
  );
}
