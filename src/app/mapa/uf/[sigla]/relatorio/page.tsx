import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { podeRelatorioUf, siglaDaUrl, urlRelatorioUf, urlUf } from "@/lib/oportunidades/pagina-uf";
import { lerUf } from "@/lib/oportunidades/pagina-uf.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { RelatorioUfConteudo } from "./RelatorioUfConteudo";

export const metadata: Metadata = {
  title: "Relatório do estado · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O relatório da UF, inteiro, para imprimir (C1a, onda 3 de UX, 08/10/2026), no modelo do relatório do município.
 * Abre para quem vê a aba "Relatório e dados" (o mesmo nível mínimo, `podeRelatorioUf`); quem não pode vai à página
 * da UF. A sigla vem da URL em minúsculas (com maiúscula, redireciona), como na página da UF. Fora da PB, o relatório
 * é tão raso quanto a página e diz a cobertura. Mesma leitura da página (`lerUf`, com memória de 10 minutos).
 */
export default async function RelatorioUfPage({ params }: { params: Promise<{ sigla: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { sigla: bruto } = await params;
  const sigla = siglaDaUrl(decodeURIComponent(bruto));
  if (!sigla) notFound();
  if (bruto !== sigla.toLowerCase()) redirect(urlRelatorioUf(sigla));

  const administrador = ehAdministrador(visitante.email);
  const nivel = administrador ? 3 : 1;
  if (!podeRelatorioUf(nivel)) redirect(urlUf(sigla));

  const leitura = await lerUf(sigla, administrador);
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Relatório do estado"
        titulo="O relatório do estado está indisponível agora"
        endereco={urlRelatorioUf(sigla)}
        voltarPara={{ rotulo: "Abrir a página do estado", href: urlUf(sigla) }}
      />
    );
  }
  after(() => registrarUso(visitante, "mapa_uf_relatorio", { uf: sigla, nivel }));
  return <RelatorioUfConteudo l={leitura} nivel={nivel} hoje={diaBrasilia(new Date().toISOString())} />;
}
