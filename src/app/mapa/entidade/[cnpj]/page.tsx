import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { parametrosBusca, urlBusca } from "@/lib/oportunidades/busca";
import { urlBrasil } from "@/lib/oportunidades/pagina-brasil";
import { ABAS_ENTIDADE, abaDaEntidade, cnpjDaUrl, urlEntidade, type AbaEntidade } from "@/lib/oportunidades/pagina-entidade";
import { PODE } from "@/lib/oportunidades/pagina-municipio";
import { abasSoComCadastro, chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { relatorioSemNomes } from "@/lib/oportunidades/relatorio-municipio";
import { lerRelatorioEntidade } from "@/lib/oportunidades/relatorio-municipio.server";
import { tituloDaPagina } from "@/lib/oportunidades/titulo-pagina";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { ConvitePublico } from "../../_componentes/MapaFrame";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { EntidadeConteudo } from "./EntidadeConteudo";
import { nivelDoVisitanteNaEntidade } from "./nivel.server";

const NAO_INDEXAR: Metadata["robots"] = { index: false, follow: false };

/**
 * Quem a página atende, a leitura e o nível, uma vez por pedido (onda 7, A, 09/10/2026): o `cache` do React divide o
 * resultado entre o título (`generateMetadata`) e a página, sem leitura a mais. `bruto` é o CNPJ como veio no endereço
 * (a conferência do acesso usa o caminho pedido); `cnpj`, o de 14 caracteres. A leitura é a leve quando a página atende
 * o público (`acesso.aprovado === null`, nível 0), com chave própria no cache; o aprovado recebe a completa de sempre.
 * O nível depende da identidade lida (`nivelDoVisitanteNaEntidade`): vem depois da leitura, como antes.
 */
const lerPagina = cache(async (bruto: string) => {
  const visitante = await visitanteAtual();
  const acesso = quemAPaginaAtende(visitante, chaveDoAmbiente(), `/mapa/entidade/${encodeURIComponent(bruto)}`);
  const cnpj = acesso ? cnpjDaUrl(decodeURIComponent(bruto)) : null;
  if (!acesso || !cnpj || cnpj !== bruto) return { acesso, cnpj, leitura: null, nivel: null };
  const leitura = await lerRelatorioEntidade(cnpj, diaBrasilia(new Date().toISOString()), { publico: acesso.aprovado === null });
  const nivel = leitura.estado === "ok" ? await nivelDoVisitanteNaEntidade(acesso.aprovado, leitura.entidade) : null;
  return { acesso, cnpj, leitura, nivel };
});

/**
 * O título com o nome e a aba (onda 7, A; achado N01 da auditoria R1, WCAG 2.4.2): "<nome> · Instrumentos · Mapa de
 * Oportunidades · PONTE", o nome como o `h1` o mostra. A aba é a que a página abre para o nível (`abaDaEntidade`; a OSC
 * só do cadastro abre só o resumo). Quando a página não mostra a entidade — sem acesso, CNPJ que não vale ou que vai
 * ser redirecionado, leitura que falhou ou entidade que não existe —, o título genérico de antes.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ cnpj: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ cnpj: bruto }, sp] = await Promise.all([params, searchParams]);
  const { leitura, nivel } = await lerPagina(bruto);
  if (leitura?.estado !== "ok" || nivel === null) return { title: tituloDaPagina("Entidade"), robots: NAO_INDEXAR };
  const soCadastro = !leitura.instrumentos.length && !leitura.propostas.length;
  const aba = ABAS_ENTIDADE.find((a) => a.id === (soCadastro ? "resumo" : abaDaEntidade(sp.aba, nivel)))?.nome;
  return { title: tituloDaPagina(leitura.entidade.nome, aba), robots: NAO_INDEXAR };
}

/**
 * A página da entidade (E1, 07/10/2026): um CNPJ proponente em abas. Atrás do portão de aprovados do `/mapa` até a
 * F1d; o que cada aprovado vê segue a decisão D1 (cadastrado, cliente, administrador). O CNPJ vem da URL, com ou
 * sem máscara (com máscara, redireciona para os 14 caracteres); a aba vem de `?aba=`.
 *
 * C4a (09/10/2026): com a chave `MAPA_PUBLICO` ligada, também o público, com nível 0 (D1: a entidade e a lista dos
 * instrumentos dela). O que trava, o controle e o relatório somem pelo `minimo` de `ABAS_ENTIDADE`; dentro das abas,
 * os blocos de nível 1 (Pix, TCE-PB, fornecedores, convênios e propostas em análise) já pediam `nivel >= 1`, e o
 * resumo chega sem o fiscal (`EntidadeConteudo` aplica `relatorioDoNivel`). A OSC segue sem endereço nem dirigentes,
 * como em todo nível.
 */
export default async function EntidadePage({
  params,
  searchParams,
}: {
  params: Promise<{ cnpj: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ cnpj: bruto }, sp] = await Promise.all([params, searchParams]);
  const { acesso, cnpj, leitura, nivel: nivelLido } = await lerPagina(bruto);
  if (!acesso) return null;
  const visitante = acesso.aprovado;

  if (!cnpj) notFound();
  const pedida = ABAS_ENTIDADE.find((a) => a.id === (Array.isArray(sp.aba) ? sp.aba[0] : sp.aba))?.id as AbaEntidade | undefined;
  if (cnpj !== bruto) redirect(urlEntidade(cnpj, pedida));

  if (!leitura) notFound();
  if (leitura.estado === "nao_encontrado") notFound();
  if (leitura.estado !== "ok") {
    // C1c (B12): "Tentar de novo" relê a mesma aba; a volta é a busca pelo CNPJ, que lê outra consulta e lista os convênios dele.
    // C4a: a busca pede cadastro; no nível 0, a volta é o topo do território.
    return (
      <DadoIndisponivel
        kicker="Entidade"
        titulo="A página da entidade está indisponível agora"
        endereco={urlEntidade(cnpj, pedida)}
        voltarPara={
          visitante
            ? { rotulo: "Procurar o CNPJ na busca", href: urlBusca(parametrosBusca({}), { q: cnpj }) }
            : { rotulo: "Abrir a página do Brasil", href: urlBrasil() }
        }
        publico={!visitante}
      />
    );
  }

  // O nível (D1) mora em `nivel.server.ts` desde a C1c: o relatório para imprimir usa a mesma regra. Lido em
  // `lerPagina` com a leitura "ok"; o `?? 0` só existe para o tipo, e na dúvida fica o nível mais fechado.
  const nivel = nivelLido ?? 0;
  // A OSC que só está no cadastro do Mapa das OSC (E3) tem só o resumo.
  const soCadastro = !leitura.instrumentos.length && !leitura.propostas.length;
  const aba = soCadastro ? "resumo" : abaDaEntidade(sp.aba, nivel);
  after(() => registrarUso(visitante, "mapa_entidade", { cnpj, aba, nivel }));

  const r = PODE.interno(nivel) ? leitura.relatorio : relatorioSemNomes(leitura.relatorio);
  const seguidas = visitante ? await lerSeguidas() : null;
  const conteudo = (
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
  if (!acesso.sessao) return conteudo;
  return (
    <>
      <ConvitePublico
        sessao={acesso.sessao}
        caminho={urlEntidade(cnpj, aba)}
        acao={`ver também as abas ${abasSoComCadastro(ABAS_ENTIDADE)} (com o relatório completo para imprimir ou salvar em PDF e o CSV), o Pix, o TCE-PB e os fornecedores no dinheiro federal, e seguir a entidade`}
      />
      {conteudo}
    </>
  );
}
