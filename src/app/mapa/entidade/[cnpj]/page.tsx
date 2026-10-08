import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { parametrosBusca, urlBusca } from "@/lib/oportunidades/busca";
import { ABAS_ENTIDADE, abaDaEntidade, cnpjDaUrl, urlEntidade, type AbaEntidade } from "@/lib/oportunidades/pagina-entidade";
import { PODE } from "@/lib/oportunidades/pagina-municipio";
import { relatorioSemNomes } from "@/lib/oportunidades/relatorio-municipio";
import { lerRelatorioEntidade } from "@/lib/oportunidades/relatorio-municipio.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { EntidadeConteudo } from "./EntidadeConteudo";
import { nivelDoVisitanteNaEntidade } from "./nivel.server";

export const metadata: Metadata = {
  title: "Entidade · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A página da entidade (E1, 07/10/2026): um CNPJ proponente em abas. Atrás do portão de aprovados do `/mapa` até a
 * F1d; o que cada aprovado vê segue a decisão D1 (cadastrado, cliente, administrador). O CNPJ vem da URL, com ou
 * sem máscara (com máscara, redireciona para os 14 caracteres); a aba vem de `?aba=`.
 */
export default async function EntidadePage({
  params,
  searchParams,
}: {
  params: Promise<{ cnpj: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const [{ cnpj: bruto }, sp] = await Promise.all([params, searchParams]);
  const cnpj = cnpjDaUrl(decodeURIComponent(bruto));
  if (!cnpj) notFound();
  const pedida = ABAS_ENTIDADE.find((a) => a.id === (Array.isArray(sp.aba) ? sp.aba[0] : sp.aba))?.id as AbaEntidade | undefined;
  if (cnpj !== bruto) redirect(urlEntidade(cnpj, pedida));

  const leitura = await lerRelatorioEntidade(cnpj, diaBrasilia(new Date().toISOString()));
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado !== "ok") {
    // C1c (B12): "Tentar de novo" relê a mesma aba; a volta é a busca pelo CNPJ, que lê outra consulta e lista os convênios dele.
    return (
      <DadoIndisponivel
        kicker="Entidade"
        titulo="A página da entidade está indisponível agora"
        endereco={urlEntidade(cnpj, pedida)}
        voltarPara={{ rotulo: "Procurar o CNPJ na busca", href: urlBusca(parametrosBusca({}), { q: cnpj }) }}
      />
    );
  }

  // O nível (D1) mora em `nivel.server.ts` desde a C1c: o relatório para imprimir usa a mesma regra.
  const nivel = await nivelDoVisitanteNaEntidade(visitante, leitura.entidade);
  // A OSC que só está no cadastro do Mapa das OSC (E3) tem só o resumo.
  const soCadastro = !leitura.instrumentos.length && !leitura.propostas.length;
  const aba = soCadastro ? "resumo" : abaDaEntidade(sp.aba, nivel);
  after(() => registrarUso(visitante, "mapa_entidade", { cnpj, aba, nivel }));

  const r = PODE.interno(nivel) ? leitura.relatorio : relatorioSemNomes(leitura.relatorio);
  const seguidas = await lerSeguidas();
  return (
    <EntidadeConteudo
      e={leitura.entidade}
      r={r}
      instrumentos={leitura.instrumentos}
      propostas={leitura.propostas}
      osc={leitura.osc}
      aba={aba}
      nivel={nivel}
      seguindo={seguidas?.has(chaveSeguida("entidade", cnpj)) ?? false}
    />
  );
}
