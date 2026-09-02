import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppFrame } from "./_componentes/AppFrame";
import { visitanteAtual, authConfigurada } from "@/lib/supabase-auth";
import "./estilos.css";
import "./componentes.css";

/**
 * `noindex`: o app é um protótipo com dados ilustrativos. Quem indexa
 * /plataforma é a apresentação pública, não esta camada.
 */
export const metadata: Metadata = {
  title: "Plataforma PONTE — protótipo do app",
  description:
    "Protótipo navegável do app da Plataforma PONTE: descobrir capital, apresentar problema ou capacidade, compor coalizão e construir com evidência.",
  robots: { index: false, follow: false },
};

/**
 * O portão vive no layout, não em cada página.
 *
 * São oito rotas neste segmento. Repetir a verificação em cada uma é oito
 * chances de esquecer numa — e a que faltar não avisa: ela simplesmente abre
 * para qualquer um. No layout, rota nova nasce protegida.
 *
 * Custo: o segmento inteiro passa a ser dinâmico. Aceitável, porque o app já
 * dependia de sessão do lado do cliente e nada aqui era cacheável de verdade.
 */
export const dynamic = "force-dynamic";

export default async function PlataformaAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sem Supabase configurado, a porta fecha. Nunca abre por omissão.
  if (!authConfigurada()) {
    redirect("/oportunidades/entrar?erro=config&next=/plataforma/app");
  }

  const visitante = await visitanteAtual();
  if (!visitante) redirect("/oportunidades/entrar?next=/plataforma/app");
  if (visitante.status !== "aprovado") redirect("/oportunidades/aguardando");

  return <AppFrame>{children}</AppFrame>;
}
