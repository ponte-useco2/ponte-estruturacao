import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { numeroValido, urlInstrumento } from "@/lib/oportunidades/busca";
import { diaBrasilia, lerLaudo } from "@/lib/oportunidades/laudo";
import { lerLaudoInstrumento } from "@/lib/oportunidades/laudo.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { LaudoConteudo } from "./LaudoConteudo";

export const metadata: Metadata = {
  title: "Laudo da cláusula suspensiva · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Laudo das exigências da suspensiva de um convênio (onda 11, parte 2). Só administradores: nomeia
 * servidores e interpreta o andamento. A mesma página é o relatório para imprimir.
 */
export default async function LaudoPage({ params }: { params: Promise<{ numero: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const { numero } = await params;
  if (!numeroValido(numero)) notFound();
  const leitura = await lerLaudoInstrumento(numero);

  if (leitura.estado === "sem_coleta") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Laudo da cláusula suspensiva · convênio nº {numero}</p>
          <h1 className="pa-titulo">Este convênio não está na coleta das suspensivas</h1>
          <p>
            A coleta no Acesso Livre do Transferegov cobre os convênios de proponente da Paraíba em cláusula suspensiva
            {leitura.coletadoEm ? ` na data em que foi feita` : ""}. Um convênio que entrou em suspensiva depois, ou que é de outro
            estado, só aparece aqui na próxima coleta.
          </p>
          <p className="pa-nota">
            <Link href={urlInstrumento(numero)}>Ver o convênio</Link> · <Link href="/mapa/suspensivas">Ver todas as suspensivas</Link>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") {
    return <DadoIndisponivel kicker={`Laudo · convênio nº ${numero}`} titulo="O laudo está indisponível agora" />;
  }

  const hoje = diaBrasilia(new Date().toISOString());
  return <LaudoConteudo laudo={lerLaudo(leitura.dossie, leitura.contexto, hoje)} dossie={leitura.dossie} contexto={leitura.contexto} hoje={hoje} />;
}
