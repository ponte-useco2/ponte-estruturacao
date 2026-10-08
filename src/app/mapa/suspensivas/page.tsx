import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { lerSuspensivas } from "@/lib/oportunidades/laudo.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../busca/BuscaConteudo";
import { SuspensivasConteudo } from "./SuspensivasConteudo";

export const metadata: Metadata = {
  title: "Cláusulas suspensivas · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/** Os convênios da PB em cláusula suspensiva, do mais urgente ao menos, cada um com o seu laudo. */
export default async function SuspensivasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filtro = { prazo: um(sp.prazo) ?? null, orgao: um(sp.orgao) ?? null };

  const leitura = await lerSuspensivas();
  if (leitura.estado !== "ok") {
    // B14b (08/10/2026): "Tentar de novo" com o mesmo filtro e a volta ao painel (props da B12).
    const consulta = new URLSearchParams(Object.entries(filtro).filter((e): e is [string, string] => !!e[1])).toString();
    return (
      <DadoIndisponivel
        kicker="Cláusulas suspensivas"
        titulo="A lista das suspensivas está indisponível agora"
        endereco={`/mapa/suspensivas${consulta ? `?${consulta}` : ""}`}
        voltarPara={{ rotulo: "Voltar ao painel de execução", href: "/mapa/painel" }}
      />
    );
  }

  return <SuspensivasConteudo leitura={leitura} hoje={diaBrasilia(new Date().toISOString())} filtro={filtro} />;
}
