import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EXPLICACAO_SEM_FICHA } from "@/lib/oportunidades/cliente";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { chaveEnteValida, podeVerPlanoPix } from "@/lib/oportunidades/pix-laudo";
import { lerLaudoEntePix } from "@/lib/oportunidades/pix-laudo.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { EntePixConteudo } from "./EntePixConteudo";

export const metadata: Metadata = {
  title: "Pix do ente · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Os planos de ação do Pix de um ente da PB, um por linha, com o pior ponto e o estado dos itens (onda 13A).
 * O ente vem pelo CNPJ (a lista do painel) ou pelo IBGE (o "Meu município"). Mesmo portão do laudo do
 * plano: administrador vê qualquer ente; o cliente, só o próprio município.
 */
export default async function EntePixPage({ params }: { params: Promise<{ chave: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { chave } = await params;
  const k = chaveEnteValida(chave);
  if (!k) notFound();

  const admin = ehAdministrador(visitante.email);
  let podeVer: Parameters<typeof lerLaudoEntePix>[1];
  if (!admin) {
    const { acesso } = await lerAcessoFicha(visitante);
    if (!acesso.ok) return <Aviso titulo={EXPLICACAO_SEM_FICHA[acesso.motivo].titulo} texto={EXPLICACAO_SEM_FICHA[acesso.motivo].texto} />;
    podeVer = (p) => podeVerPlanoPix(acesso, p);
  }

  const leitura = await lerLaudoEntePix(k, podeVer);
  if (leitura.estado === "nao_encontrado") {
    return admin ? (
      <Aviso titulo="Nenhum plano do Pix para este ente" texto="O laudo cobre os planos de ação das transferências especiais de beneficiários da Paraíba." />
    ) : (
      <Aviso titulo="Este laudo não está disponível para a sua organização" texto="O laudo do Pix mostra os planos de ação do seu município." />
    );
  }
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker="Pix do ente" titulo="O laudo do Pix está indisponível agora" />;
  return <EntePixConteudo leitura={leitura} chave={chave} cliente={!admin} />;
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Pix do ente</p>
        <h1 className="pa-titulo">{titulo}</h1>
        <p className="pa-sub">{texto}</p>
        <p className="pa-sub">
          <Link href="/mapa/meu-municipio">Voltar ao Meu município</Link>
        </p>
      </div>
    </div>
  );
}
