import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
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
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { ConvitePublico } from "../../_componentes/MapaFrame";
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
  const [visitanteOuNao, { cnpj: bruto }, sp] = await Promise.all([visitanteAtual(), params, searchParams]);
  const acesso = quemAPaginaAtende(visitanteOuNao, chaveDoAmbiente(), `/mapa/entidade/${encodeURIComponent(bruto)}`);
  if (!acesso) return null;
  const visitante = acesso.aprovado;

  const cnpj = cnpjDaUrl(decodeURIComponent(bruto));
  if (!cnpj) notFound();
  const pedida = ABAS_ENTIDADE.find((a) => a.id === (Array.isArray(sp.aba) ? sp.aba[0] : sp.aba))?.id as AbaEntidade | undefined;
  if (cnpj !== bruto) redirect(urlEntidade(cnpj, pedida));

  const leitura = await lerRelatorioEntidade(cnpj, diaBrasilia(new Date().toISOString()));
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
