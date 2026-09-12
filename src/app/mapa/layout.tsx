import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MapaFrame } from "./_componentes/MapaFrame";
import { authConfigurada, visitanteAtual } from "@/lib/supabase-auth";
import "../_design/estilos.css";
import "../_design/componentes.css";
import "./mapa.css";

/**
 * `noindex`: a rota é área reservada. Indexar endereço que redireciona para
 * login só produz resultado de busca levando a porta fechada — mesma razão
 * registrada em `/oportunidades` e na `/carteira`.
 */
export const metadata: Metadata = {
  title: "Mapa de Oportunidades · PONTE",
  description:
    "Janelas abertas de convênio e emenda, com central de avisos do que mudou desde a sua última visita. Acesso mediante cadastro.",
  robots: { index: false, follow: false },
};

/**
 * O portão vive no layout, não em cada página — rota nova neste segmento nasce
 * protegida. Custo: o segmento inteiro é dinâmico, o que já era verdade porque
 * tudo aqui depende de sessão.
 */
export const dynamic = "force-dynamic";

export default async function MapaLayout({ children }: { children: React.ReactNode }) {
  // Sem Supabase configurado, a porta fecha. Nunca abre por omissão.
  if (!authConfigurada()) {
    redirect("/oportunidades/entrar?erro=config&next=/mapa");
  }

  const visitante = await visitanteAtual();
  if (!visitante) redirect("/oportunidades/entrar?next=/mapa");
  if (visitante.status !== "aprovado") redirect("/oportunidades/aguardando");

  return (
    <MapaFrame email={visitante.email} nome={visitante.nome}>
      {children}
    </MapaFrame>
  );
}
