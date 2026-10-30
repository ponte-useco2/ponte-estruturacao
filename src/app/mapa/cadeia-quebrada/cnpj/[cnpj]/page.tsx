import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cnpjDaUrl } from "@/lib/oportunidades/cadeia-quebrada";
import { lerCnpjCadeia } from "@/lib/oportunidades/cadeia-quebrada.server";
import { nivelSemCliente } from "@/lib/oportunidades/pagina-municipio";
import { chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { tituloDaPagina } from "@/lib/oportunidades/titulo-pagina";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { CnpjConteudo } from "../../CnpjConteudo";

export const metadata: Metadata = {
  title: tituloDaPagina("Cadeia do gasto: CNPJ"),
  robots: { index: false, follow: false },
};

/** Um CNPJ na cadeia do gasto (30/10/2026): o último nível, com os endereços de origem. Mesmo portão da página de entrada. */
export default async function CnpjCadeiaPage({ params }: { params: Promise<{ cnpj: string }> }) {
  const acesso = quemAPaginaAtende(await visitanteAtual(), chaveDoAmbiente(), "/mapa/cadeia-quebrada");
  if (!acesso) return null;
  const nivel = nivelSemCliente({ aprovado: acesso.aprovado !== null, administrador: ehAdministrador(acesso.aprovado?.email) });
  if (nivel < 1) redirect("/mapa");

  const cnpj = cnpjDaUrl((await params).cnpj);
  if (!cnpj) notFound();
  const leitura = await lerCnpjCadeia(cnpj);
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Cadeia do gasto"
        titulo="O CNPJ não pôde ser lido agora"
        endereco="/mapa/cadeia-quebrada"
        voltarPara={{ rotulo: "Voltar à cadeia do gasto", href: "/mapa/cadeia-quebrada" }}
        publico={false}
      />
    );
  }
  return <CnpjConteudo cnpj={cnpj} casos={leitura.casos} noPainelFederal={leitura.noPainelFederal} />;
}
