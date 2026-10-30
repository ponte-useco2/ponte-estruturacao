import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { blocoDaUrl } from "@/lib/oportunidades/cadeia-quebrada";
import { lerSituacaoCadeia } from "@/lib/oportunidades/cadeia-quebrada.server";
import { nivelSemCliente } from "@/lib/oportunidades/pagina-municipio";
import { chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { tituloDaPagina } from "@/lib/oportunidades/titulo-pagina";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { SituacaoConteudo } from "../SituacaoConteudo";

export const metadata: Metadata = {
  title: tituloDaPagina("Cadeia do gasto: situação"),
  robots: { index: false, follow: false },
};

/** Uma situação da cadeia do gasto (30/10/2026): órgãos ou motivos e os casos por CNPJ. Mesmo portão da página de entrada. */
export default async function SituacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ bloco: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const acesso = quemAPaginaAtende(await visitanteAtual(), chaveDoAmbiente(), "/mapa/cadeia-quebrada");
  if (!acesso) return null;
  const nivel = nivelSemCliente({ aprovado: acesso.aprovado !== null, administrador: ehAdministrador(acesso.aprovado?.email) });
  if (nivel < 1) redirect("/mapa");

  const bloco = blocoDaUrl((await params).bloco);
  const sp = await searchParams;
  const situacao = typeof sp.s === "string" ? sp.s : null;
  const orgao = typeof sp.o === "string" && sp.o.trim() ? sp.o : null;
  if (!bloco || !situacao) notFound();
  const leitura = await lerSituacaoCadeia(bloco, situacao, orgao);
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Cadeia do gasto"
        titulo="A situação não pôde ser lida agora"
        endereco="/mapa/cadeia-quebrada"
        voltarPara={{ rotulo: "Voltar à cadeia do gasto", href: "/mapa/cadeia-quebrada" }}
        publico={false}
      />
    );
  }
  return (
    <SituacaoConteudo
      ex={leitura.execucao}
      bloco={bloco}
      linha={leitura.linha}
      orgao={orgao}
      porOrgao={leitura.porOrgao}
      motivos={leitura.motivos}
      casos={leitura.casos}
    />
  );
}
