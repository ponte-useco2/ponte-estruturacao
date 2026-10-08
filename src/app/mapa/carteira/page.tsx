import type { Metadata } from "next";
import { after } from "next/server";
import { montarCarteira } from "@/lib/oportunidades/carteira";
import { lerCarteira } from "@/lib/oportunidades/carteira.server";
import { diaBrasilia } from "@/lib/oportunidades/laudo";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../busca/BuscaConteudo";
import { CarteiraConteudo } from "./CarteiraConteudo";

export const metadata: Metadata = {
  title: "Carteira · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/** A carteira de quem está aprovado: os itens que segue, o que mudou e a próxima ação de cada um. */
export default async function CarteiraPage() {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  const leitura = await lerCarteira();
  if (leitura.estado !== "ok") {
    // B12b: a carteira é o topo da descida; a volta é a lista do que se segue, em Avisos ("Meus itens").
    return (
      <DadoIndisponivel
        kicker="Carteira"
        titulo="A carteira está indisponível agora"
        endereco="/mapa/carteira"
        voltarPara={{ rotulo: "Ver os meus itens em Avisos", href: "/mapa/avisos?mural=itens" }}
      />
    );
  }
  const hoje = diaBrasilia(new Date().toISOString());
  const carteira = montarCarteira({ seguidos: leitura.seguidos, avisos: leitura.avisos }, hoje);
  after(() => registrarUso(visitante, "mapa_carteira", { itens: carteira.itens.length, nao_lidas: carteira.naoLidas }));
  return <CarteiraConteudo c={carteira} hoje={hoje} truncada={leitura.truncada} />;
}
