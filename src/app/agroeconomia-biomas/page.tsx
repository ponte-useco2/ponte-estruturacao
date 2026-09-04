import type { Metadata } from "next";
import { AgroeconomiaBiomasClient } from "./AgroeconomiaBiomasClient";

/**
 * Programa Agroeconomia Biomas — página pública e indexável.
 *
 * Nasceu como "Paraíba Produtiva" (protótipo Claude Design) e foi renomeada
 * em 03/09/2026. A rota antiga /paraiba-produtiva redireciona para cá
 * (301, em next.config.ts) porque chegou a ser publicada.
 *
 * Narrativa da proposta em 19 blocos, para diretoria e conselho do Sebrae/PB
 * e pequenos empresários. Não é landing de conversão: sem formulário, sem
 * CTA de cadastro, sem número que não esteja no briefing.
 *
 * Toda a página é estática — o único estado é o slider α/β, no cliente.
 */
export const metadata: Metadata = {
  title: "Programa Agroeconomia Biomas — inteligência empresarial para prosperidade territorial",
  // Frase-tese do protótipo (bloco 18, "A proposta de valor em uma frase"), com o nome novo.
  description:
    "O Agroeconomia Biomas transforma cada interação com um pequeno negócio em duas coisas ao mesmo tempo: uma informação imediatamente útil para o empresário e uma peça de inteligência que ajuda o Sebrae a descobrir quando um problema individual se tornou um problema territorial.",
  alternates: { canonical: "https://ponteprojetos.com.br/agroeconomia-biomas" },
  openGraph: {
    title: "Programa Agroeconomia Biomas — inteligência empresarial para prosperidade territorial",
    description:
      "Um programa de desenvolvimento produtivo territorial que oferece ao pequeno negócio uma referência que ele não possui sozinho, transforma milhares dessas referências em inteligência para o Sebrae e converte gargalos recorrentes em ações empresariais e projetos coletivos mensuráveis.",
    url: "https://ponteprojetos.com.br/agroeconomia-biomas",
    siteName: "Ponte Projetos",
    locale: "pt_BR",
    type: "website",
  },
};

export default function AgroeconomiaBiomasPage() {
  return <AgroeconomiaBiomasClient />;
}
