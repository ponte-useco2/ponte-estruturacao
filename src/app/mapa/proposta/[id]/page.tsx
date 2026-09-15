import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lerProposta } from "@/lib/oportunidades/busca.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { PropostaConteudo } from "./PropostaConteudo";

export const metadata: Metadata = {
  title: "Proposta · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/** Uma proposta pelo id do SICONV — para qualquer usuário aprovado. */
export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const leitura = await lerProposta(id);

  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Proposta {id}</p>
          <h1 className="pa-titulo">Esta proposta não está na busca</h1>
          <p>
            A busca traz as propostas enviadas da Paraíba desde 2019 e, no resto do país, as dos últimos três anos e as antigas
            que ainda se movem. Rascunhos que nunca foram enviados não entram.
          </p>
          <p className="pa-nota">
            <Link href="/mapa/busca?aba=propostas">Buscar propostas</Link>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") return <DadoIndisponivel kicker={`Proposta ${id}`} titulo="A proposta está indisponível agora" />;
  return <PropostaConteudo leitura={leitura} />;
}
