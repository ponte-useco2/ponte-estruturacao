import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EXPLICACAO_SEM_FICHA } from "@/lib/oportunidades/cliente";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { podeVerPlanoPix } from "@/lib/oportunidades/pix-laudo";
import { lerLaudoPlanoPix } from "@/lib/oportunidades/pix-laudo.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { PlanoPixConteudo } from "./PlanoPixConteudo";

export const metadata: Metadata = {
  title: "Laudo do Pix · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Laudo de um plano de ação das transferências especiais da PB (onda 13A).
 *
 *   · administrador: qualquer plano da PB;
 *   · cliente ("Meu município"): só os planos do município confirmado (`podeVerPlanoPix`). O plano de
 *     outro ente é "não disponível", sem dizer se existe. O conteúdo é o mesmo — o laudo do Pix não tem
 *     nome de servidor nem de fornecedor —, sem os atalhos de administrador.
 * A mesma página é o relatório para imprimir.
 */
export default async function LaudoPixPage({ params }: { params: Promise<{ id: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();

  const admin = ehAdministrador(visitante.email);
  let podeVer: Parameters<typeof lerLaudoPlanoPix>[1];
  if (!admin) {
    const { acesso, organizacao } = await lerAcessoFicha(visitante);
    if (!acesso.ok) {
      const e = EXPLICACAO_SEM_FICHA[acesso.motivo];
      return <SemLaudo kicker={organizacao?.nome ?? "Laudo do Pix"} titulo={e.titulo} texto={e.texto} />;
    }
    podeVer = (p) => podeVerPlanoPix(acesso, p);
  }

  const leitura = await lerLaudoPlanoPix(Number(id), podeVer);
  if (leitura.estado === "nao_encontrado") {
    return admin ? (
      <SemLaudo
        kicker={`Laudo do Pix · plano ${id}`}
        titulo="Este plano não está no laudo"
        texto="O laudo cobre os planos de ação das transferências especiais de beneficiários da Paraíba, na última leitura semanal da API."
      />
    ) : (
      <SemLaudo
        kicker="Laudo do Pix"
        titulo="Este laudo não está disponível para a sua organização"
        texto="O laudo do Pix mostra os planos de ação do seu município."
      />
    );
  }
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker="Laudo do Pix" titulo="O laudo do Pix está indisponível agora" />;
  return <PlanoPixConteudo leitura={leitura} cliente={!admin} />;
}

function SemLaudo({ kicker, titulo, texto }: { kicker: string; titulo: string; texto: string }) {
  return (
    <div className="pa-pagina mp-radar">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">{kicker}</p>
        <h1 className="pa-titulo">{titulo}</h1>
        <p className="pa-sub">{texto}</p>
        <p className="pa-sub">
          <Link href="/mapa/meu-municipio">Voltar ao Meu município</Link>
        </p>
      </div>
    </div>
  );
}
