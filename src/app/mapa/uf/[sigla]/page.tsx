import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { urlBrasil } from "@/lib/oportunidades/pagina-brasil";
import { ABAS_UF, abaDaUf, siglaDaUrl, urlUf, type AbaUf } from "@/lib/oportunidades/pagina-uf";
import { lerUf } from "@/lib/oportunidades/pagina-uf.server";
import { nivelSemCliente } from "@/lib/oportunidades/pagina-municipio";
import { abasSoComCadastro, chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { tituloUf } from "@/lib/oportunidades/titulo-pagina";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { ConvitePublico } from "../../_componentes/MapaFrame";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { UfConteudo } from "./UfConteudo";

type Parametros = {
  params: Promise<{ sigla: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Quem a página atende e com que nível: a mesma conta da página e do título. `visitanteAtual` é `cache()` do React (uma
 * leitura da sessão por pedido); nada aqui vai ao banco do Mapa.
 */
async function acessoDaUf(bruto: string) {
  const acesso = quemAPaginaAtende(await visitanteAtual(), chaveDoAmbiente(), `/mapa/uf/${encodeURIComponent(bruto)}`);
  if (!acesso) return null;
  const administrador = ehAdministrador(acesso.aprovado?.email);
  // C4a (B1 da R3): era `administrador ? 3 : 1`; a regra única dá 0 a quem não é aprovado (`aprovado` null).
  return { ...acesso, administrador, nivel: nivelSemCliente({ aprovado: acesso.aprovado !== null, administrador }) };
}

/**
 * Onda 7, C (09/10/2026; N01 da auditoria R1, WCAG 2.4.2): o título diz a UF e a aba ("Paraíba (PB) · Municípios"). Era
 * "Estado" para as 27, e o leitor de tela não anunciava a troca de uma UF para outra nem de uma aba para outra. A aba é
 * a que a página abre para este nível (`abaDaUf`); sem acesso ou com sigla que não existe, o título genérico.
 */
export async function generateMetadata({ params, searchParams }: Parametros): Promise<Metadata> {
  const [{ sigla: bruto }, sp] = await Promise.all([params, searchParams]);
  const acesso = await acessoDaUf(bruto);
  let sigla: string | null = null;
  try {
    sigla = acesso ? siglaDaUrl(decodeURIComponent(bruto)) : null;
  } catch {
    sigla = null; // "%E0" e afins: a página cai no erro; o título fica o genérico
  }
  return {
    title: tituloUf(sigla, sigla && acesso ? abaDaUf(sp.aba, acesso.nivel) : null),
    robots: { index: false, follow: false },
  };
}

/**
 * A página da UF (U1, desenho aprovado em 08/10/2026): o território acima do município, em abas. Atrás do portão de
 * aprovados do `/mapa` até a F1d. A sigla vem da URL em minúsculas (com maiúscula, redireciona); a aba, de `?aba=`.
 * O administrador vê, na lista dos municípios, a decisão B do fiscal e os sinais do painel, e pode ordenar por eles
 * (`?ordem=sinais`); para os outros, a lista é neutra (ranking público rejeitado em 02/10).
 *
 * C4a (09/10/2026): com a chave `MAPA_PUBLICO` ligada, também o público, com nível 0 (D1: a UF em resumo). As abas de
 * nível 1 somem pelo `minimo` de `ABAS_UF`, e o "Dinheiro federal" já mostra ao nível 0 só os 10 maiores órgãos. A
 * leitura é a de quem não é administrador: sem a decisão B do fiscal e sem os sinais do painel.
 */
export default async function UfPage({ params, searchParams }: Parametros) {
  const [{ sigla: bruto }, sp] = await Promise.all([params, searchParams]);
  const acesso = await acessoDaUf(bruto);
  if (!acesso) return null;
  const visitante = acesso.aprovado;

  const sigla = siglaDaUrl(decodeURIComponent(bruto));
  if (!sigla) notFound();
  if (bruto !== sigla.toLowerCase()) {
    const pedida = ABAS_UF.find((a) => a.id === (Array.isArray(sp.aba) ? sp.aba[0] : sp.aba))?.id as AbaUf | undefined;
    redirect(urlUf(sigla, pedida));
  }

  const { administrador, nivel } = acesso;
  const aba = abaDaUf(sp.aba, nivel);
  const porSinais = administrador && sp.ordem === "sinais";
  const leitura = await lerUf(sigla, administrador);
  // B12 (C1a, 08/10/2026): "Tentar de novo" volta à mesma aba; a outra saída sobe um nível, ao Brasil.
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Estado"
        titulo="A página do estado está indisponível agora"
        endereco={urlUf(sigla, aba)}
        voltarPara={{ rotulo: "Abrir a página do Brasil", href: urlBrasil() }}
        publico={!visitante}
      />
    );
  }
  after(() => registrarUso(visitante, "mapa_uf", { uf: sigla, aba, nivel }));
  if (!acesso.sessao) return <UfConteudo l={leitura} aba={aba} nivel={nivel} porSinais={porSinais} />;
  return (
    <>
      <ConvitePublico
        sessao={acesso.sessao}
        caminho={urlUf(sigla, aba)}
        acao={`ver também as abas ${abasSoComCadastro(ABAS_UF)} (com o relatório completo para imprimir ou salvar em PDF e o CSV) e o dinheiro federal completo, com todos os órgãos, os temas, o Pix e o fundo a fundo`}
      />
      <UfConteudo l={leitura} aba={aba} nivel={nivel} porSinais={porSinais} />
    </>
  );
}
