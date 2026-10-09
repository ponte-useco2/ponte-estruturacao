import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { URL_RELATORIO_BRASIL, nivelNoBrasil, podeAbaBrasil, urlBrasil } from "@/lib/oportunidades/pagina-brasil";
import { lerBrasil } from "@/lib/oportunidades/pagina-brasil.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { RelatorioBrasilConteudo } from "./RelatorioBrasilConteudo";

export const metadata: Metadata = {
  title: "Relatório do Brasil · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O relatório do Brasil, inteiro, para imprimir (C1b, 08/10/2026). Abre com o mesmo nível da aba "Relatório e dados"
 * (`ABAS_BRASIL`, pelo `nivelNoBrasil` da página): quem não vê a aba é levado à página do Brasil. A leitura é a da
 * página (`lerBrasil`, com memória de 10 minutos): nenhuma consulta nova.
 */
export default async function RelatorioBrasilPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  // C4a (B1 da R3): o nível sai da regra única, com o status de verdade; sem aprovação seria 0, e o relatório pede 1.
  const nivel = nivelNoBrasil({ aprovado: visitante.status === "aprovado", administrador: ehAdministrador(visitante.email) });
  if (!podeAbaBrasil("relatorio", nivel)) redirect(urlBrasil());
  const leitura = await lerBrasil();
  if (leitura.estado !== "ok")
    return (
      <DadoIndisponivel
        kicker="Relatório do Brasil"
        titulo="O relatório está indisponível agora"
        endereco={URL_RELATORIO_BRASIL}
        voltarPara={{ rotulo: "Voltar à página do Brasil", href: urlBrasil() }}
      />
    );
  after(() => registrarUso(visitante, "mapa_brasil_relatorio", { nivel }));
  return <RelatorioBrasilConteudo l={leitura} nivel={nivel} hoje={diaBrasilia(new Date().toISOString())} />;
}
