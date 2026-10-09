import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
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
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { voltarParaUf } from "@/lib/oportunidades/vazios";
import { visitanteAtual } from "@/lib/supabase-auth";
import { ConvitePublico } from "../../_componentes/MapaFrame";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { MunicipioConteudo } from "./MunicipioConteudo";

export const metadata: Metadata = {
  title: "Município · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

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
 */
export default async function MunicipioPage({
  params,
  searchParams,
}: {
  params: Promise<{ ibge: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [visitanteOuNao, { ibge }] = await Promise.all([visitanteAtual(), params]);
  const acesso = quemAPaginaAtende(visitanteOuNao, chaveDoAmbiente(), `/mapa/municipio/${encodeURIComponent(ibge)}`);
  if (!acesso) return null;
  const visitante = acesso.aprovado;

  if (!/^25\d{5}$/.test(ibge)) notFound();
  const [leitura, nivel, sp] = await Promise.all([
    lerRelatorioMunicipio(ibge, diaBrasilia(new Date().toISOString())),
    nivelNoMunicipio(visitante, ibge),
    searchParams,
  ]);
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
