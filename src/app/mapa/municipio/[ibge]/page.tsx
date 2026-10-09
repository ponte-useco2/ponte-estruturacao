import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { quemRecebe } from "@/lib/oportunidades/pagina-entidade";
import { ABAS_MUNICIPIO, PODE, abaEscolhida, urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { nivelNoMunicipio } from "@/lib/oportunidades/pagina-municipio.server";
import { abasSoComCadastro, chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { relatorioSemNomes } from "@/lib/oportunidades/relatorio-municipio";
import { lerResumoOscMunicipio } from "@/lib/oportunidades/osc.server";
import { lerEntidadesDoMunicipio, lerRelatorioMunicipio } from "@/lib/oportunidades/relatorio-municipio.server";
import { tituloDaPagina } from "@/lib/oportunidades/titulo-pagina";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { voltarParaUf } from "@/lib/oportunidades/vazios";
import { visitanteAtual } from "@/lib/supabase-auth";
import { ConvitePublico } from "../../_componentes/MapaFrame";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { MunicipioConteudo } from "./MunicipioConteudo";

const NAO_INDEXAR: Metadata["robots"] = { index: false, follow: false };

/**
 * Quem a página atende, a leitura e o nível, uma vez por pedido (onda 7, A, 09/10/2026): o `cache` do React divide o
 * resultado entre o título (`generateMetadata`) e a página, sem leitura a mais. A leitura é a leve quando a página
 * atende o público (`acesso.aprovado === null`, nível 0): só as fontes que o nível 0 desenha, com chave própria no
 * cache (`relatorio-municipio.server.ts`). O aprovado, de qualquer nível, recebe a leitura completa de sempre.
 */
const lerPagina = cache(async (ibge: string) => {
  const visitante = await visitanteAtual();
  const acesso = quemAPaginaAtende(visitante, chaveDoAmbiente(), `/mapa/municipio/${encodeURIComponent(ibge)}`);
  if (!acesso || !/^25\d{5}$/.test(ibge)) return { acesso, leitura: null, nivel: null };
  const [leitura, nivel] = await Promise.all([
    lerRelatorioMunicipio(ibge, diaBrasilia(new Date().toISOString()), { publico: acesso.aprovado === null }),
    nivelNoMunicipio(acesso.aprovado, ibge),
  ]);
  return { acesso, leitura, nivel };
});

/**
 * O título com o nome e a aba (onda 7, A; achado N01 da auditoria R1, WCAG 2.4.2): "Patos (PB) · Dinheiro federal ·
 * Mapa de Oportunidades · PONTE". A aba é a que a página abre para o nível (`abaEscolhida`). Quando a página não mostra
 * o município — sem acesso (a página devolve null), IBGE que não vale, leitura que falhou ou município que não existe —,
 * o título genérico de antes, sem nada do endereço.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ ibge: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ ibge }, sp] = await Promise.all([params, searchParams]);
  const { leitura, nivel } = await lerPagina(ibge);
  if (leitura?.estado !== "ok" || nivel === null) return { title: tituloDaPagina("Município"), robots: NAO_INDEXAR };
  const aba = ABAS_MUNICIPIO.find((a) => a.id === abaEscolhida(sp.aba, nivel))?.nome;
  return { title: tituloDaPagina(`${leitura.relatorio.nome} (PB)`, aba), robots: NAO_INDEXAR };
}

/**
 * A página do município em abas (F1a, 06/10/2026). Por enquanto atrás do portão de aprovados do `/mapa`; o
 * que cada aprovado vê dentro das abas segue a decisão D1 (cadastrado, cliente do próprio município,
 * administrador). A aba vem da URL (`?aba=`), para o endereço levar direto a ela.
 *
 * C4a (09/10/2026): com a chave `MAPA_PUBLICO` ligada, também o público, com nível 0 (D1: o resumo, o dinheiro federal
 * e os indicadores; `nivelNoMunicipio` já dava 0 a quem não é aprovado). O fiscal ("Contas públicas"), o controle, o
 * que trava e o relatório completo somem pelo `minimo` de `ABAS_MUNICIPIO`; os nomes já saem por `relatorioSemNomes`,
 * como para o cadastrado, e o resto do recorte (fiscal e controle no resumo, Pix, TCE-PB, fornecedores e análise no
 * dinheiro) é do `MunicipioConteudo` (`relatorioDoNivel`). Sem conta, não há o que seguir: a leitura das seguidas não
 * é feita.
 *
 * Onda 7, A (09/10/2026): o público recebe a leitura leve (ver `lerPagina`), e o recorte continua aqui e no
 * `MunicipioConteudo`, a cada pedido, sobre o objeto que veio da memória ou do cache.
 */
export default async function MunicipioPage({
  params,
  searchParams,
}: {
  params: Promise<{ ibge: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ibge } = await params;
  const [{ acesso, leitura, nivel }, sp] = await Promise.all([lerPagina(ibge), searchParams]);
  if (!acesso) return null;
  const visitante = acesso.aprovado;

  if (!leitura || nivel === null) notFound();
  if (leitura.estado === "nao_encontrado") notFound();
  const aba = abaEscolhida(sp.aba, nivel);
  if (leitura.estado !== "ok") {
    // B12b: "Tentar de novo" na mesma aba; a volta é a Paraíba, um nível acima (a região imediata viria da leitura que falhou).
    return (
      <DadoIndisponivel
        kicker="Município"
        titulo="A página do município está indisponível agora"
        endereco={urlMunicipio(ibge, aba)}
        voltarPara={voltarParaUf("PB") ?? undefined}
        publico={!visitante}
      />
    );
  }
  const seguidas = visitante ? await lerSeguidas() : null;
  after(() => registrarUso(visitante, "mapa_municipio", { ibge, aba, nivel }));
  const r = PODE.interno(nivel) ? leitura.relatorio : relatorioSemNomes(leitura.relatorio);
  // "Quem recebe no município" (E1) e as OSC do Mapa (E3): só na aba do dinheiro, que é onde o bloco aparece.
  const [linhas, osc] = aba === "dinheiro" ? await Promise.all([lerEntidadesDoMunicipio(ibge), lerResumoOscMunicipio(ibge)]) : [undefined, null];
  const entidades = linhas === undefined ? undefined : linhas ? quemRecebe(linhas) : null;
  const conteudo = (
    <MunicipioConteudo
      r={r}
      aba={aba}
      nivel={nivel}
      seguindo={seguidas?.has(chaveSeguida("municipio", ibge)) ?? false}
      entidades={entidades}
      osc={osc}
    />
  );
  if (!acesso.sessao) return conteudo;
  return (
    <>
      <ConvitePublico
        sessao={acesso.sessao}
        caminho={urlMunicipio(ibge, aba)}
        acao={`ver também as abas ${abasSoComCadastro(ABAS_MUNICIPIO)} (com o relatório completo para imprimir ou salvar em PDF e o CSV), o Pix, o TCE-PB e os fornecedores no dinheiro federal, e seguir o município`}
      />
      {conteudo}
    </>
  );
}
