import type { Metadata } from "next";
import { after } from "next/server";
import { ABAS_BRASIL, abaDoBrasil, nivelNoBrasil, urlBrasil } from "@/lib/oportunidades/pagina-brasil";
import { lerBrasil } from "@/lib/oportunidades/pagina-brasil.server";
import { abasSoComCadastro, chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { tituloBrasil } from "@/lib/oportunidades/titulo-pagina";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { ConvitePublico } from "../_componentes/MapaFrame";
import { DadoIndisponivel } from "../busca/BuscaConteudo";
import { BrasilConteudo } from "./BrasilConteudo";

type Busca = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Quem a página atende e com que nível: a mesma conta da página e do título. `visitanteAtual` é `cache()` do React (uma
 * leitura da sessão por pedido); nada aqui vai ao banco do Mapa.
 */
async function acessoDoBrasil() {
  const acesso = quemAPaginaAtende(await visitanteAtual(), chaveDoAmbiente(), "/mapa/brasil");
  if (!acesso) return null;
  // `aprovado` é o aprovado ou null (o público): a regra única dá 0 a quem não é aprovado (B1 da R3).
  return { ...acesso, nivel: nivelNoBrasil({ aprovado: acesso.aprovado !== null, administrador: ehAdministrador(acesso.aprovado?.email) }) };
}

/**
 * Onda 7, C (09/10/2026; N01 da auditoria R1, WCAG 2.4.2): o título diz a aba ("Brasil · As 27 UFs"). Era o mesmo nas
 * cinco, e o leitor de tela não anunciava a troca de aba. A aba é a que a página abre para este nível (`abaDoBrasil`).
 */
export async function generateMetadata({ searchParams }: Busca): Promise<Metadata> {
  const [acesso, sp] = await Promise.all([acessoDoBrasil(), searchParams]);
  return {
    title: tituloBrasil(acesso ? abaDoBrasil(sp.aba, acesso.nivel) : null),
    robots: { index: false, follow: false },
  };
}

/**
 * A página do Brasil (U2, desenho aprovado em 08/10/2026): o topo da descida, com as 27 UFs lado a lado em ordem
 * alfabética e o mapa por UF. Atrás do portão de aprovados do `/mapa` até a F1d; a aba vem de `?aba=`.
 *
 * Indisponível (C1b, 08/10/2026, com as saídas da B12): "Tentar de novo" volta à mesma aba; a outra saída é a carteira,
 * que não depende da leitura do painel que derrubou esta página (a da Paraíba depende).
 *
 * C4a (09/10/2026): com a chave `MAPA_PUBLICO` ligada, também o público, com nível 0 (D1: o Brasil em resumo). As abas
 * de nível 1 ("Tempos e funil" e "Relatório e dados") somem pelo `minimo` de `ABAS_BRASIL`, e o convite do topo diz o
 * que o cadastro abre. A saída do indisponível vira as janelas: a carteira pede login.
 */
export default async function BrasilPage({ searchParams }: Busca) {
  const acesso = await acessoDoBrasil();
  if (!acesso) return null;
  const visitante = acesso.aprovado;
  const sp = await searchParams;
  const { nivel } = acesso;
  const aba = abaDoBrasil(sp.aba, nivel);
  const leitura = await lerBrasil();
  if (leitura.estado !== "ok")
    return (
      <DadoIndisponivel
        kicker="Brasil"
        titulo="A página do Brasil está indisponível agora"
        endereco={urlBrasil(aba)}
        voltarPara={visitante ? { rotulo: "Abrir a carteira", href: "/mapa/carteira" } : { rotulo: "Ver as janelas abertas", href: "/mapa" }}
        publico={!visitante}
      />
    );
  after(() => registrarUso(visitante, "mapa_brasil", { aba, nivel }));
  if (!acesso.sessao) return <BrasilConteudo l={leitura} aba={aba} nivel={nivel} />;
  return (
    <>
      <ConvitePublico
        sessao={acesso.sessao}
        caminho={urlBrasil(aba)}
        acao={`ver também as abas ${abasSoComCadastro(ABAS_BRASIL)}, com o relatório completo para imprimir ou salvar em PDF e o CSV`}
      />
      <BrasilConteudo l={leitura} aba={aba} nivel={nivel} />
    </>
  );
}
