import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MapaFrame } from "./_componentes/MapaFrame";
import { CABECALHO_CAMINHO } from "@/lib/oportunidades/destino";
import { acessoDoLayout, chaveDoAmbiente } from "@/lib/oportunidades/publico";
import { authConfigurada, visitanteAtual } from "@/lib/supabase-auth";
import "../_design/estilos.css";
import "../_design/componentes.css";
import "./mapa.css";

/**
 * `noindex`: a rota é área reservada. Indexar endereço que redireciona para
 * login só produz resultado de busca levando a porta fechada — mesma razão
 * registrada em `/oportunidades` e na `/carteira`.
 *
 * C4a (09/10/2026): continua `noindex` com a versão pública ligada. Abrir ao
 * público não é abrir à busca; indexar é outra decisão.
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
  // Volta para onde a pessoa ia (a ficha, o painel), não para a raiz do Mapa.
  const caminho = (await headers()).get(CABECALHO_CAMINHO);

  // Sem Supabase configurado, a porta fecha. Nunca abre por omissão.
  const configurado = authConfigurada();
  const visitante = configurado ? await visitanteAtual() : null;

  // C4a (09/10/2026): a decisão mora em `publico.ts`, com teste. Com a chave `MAPA_PUBLICO` desligada (o padrão), é a
  // de antes, caso a caso: sem Supabase, à entrada com `erro=config`; sem sessão, à entrada com o `next`; cadastro não
  // aprovado, à sala de espera; aprovado entra. Ligada, quem não é aprovado entra com nível 0 nas rotas da lista branca.
  const acesso = acessoDoLayout({ configurado, visitante, chave: chaveDoAmbiente(), caminho });
  if (acesso.tipo === "redirecionar") redirect(acesso.destino);
  if (acesso.tipo === "publico") return <MapaFrame publico={acesso.sessao}>{children}</MapaFrame>;

  return (
    <MapaFrame email={acesso.visitante.email} nome={acesso.visitante.nome}>
      {children}
    </MapaFrame>
  );
}
