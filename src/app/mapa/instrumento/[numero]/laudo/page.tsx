import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { numeroValido } from "@/lib/oportunidades/busca";
import { lerDiagnostico } from "@/lib/oportunidades/diagnostico";
import { lerEntradaDiagnostico } from "@/lib/oportunidades/diagnostico.server";
import { diaBrasilia, lerAcessoLivre, lerLaudo } from "@/lib/oportunidades/laudo";
import { lerLaudoInstrumento } from "@/lib/oportunidades/laudo.server";
import { tempoNoOrgao } from "@/lib/oportunidades/padroes";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../../busca/BuscaConteudo";
import { DiagnosticoComplemento, DiagnosticoConteudo, FontesDiagnostico } from "./DiagnosticoConteudo";
import { LaudoConteudo } from "./LaudoConteudo";

export const metadata: Metadata = {
  title: "Laudo do instrumento · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Laudo de qualquer instrumento da busca (onda 12): etapa, tempo contra o típico, dinheiro, programa,
 * proponente, emenda, situação fiscal, riscos e estratégia. Para os convênios em cláusula suspensiva da
 * coleta do Acesso Livre (onda 11), o laudo da suspensiva vem por inteiro e o resto entra como complemento.
 *
 * Só administradores: nomeia servidores e interpreta o andamento. A mesma página é o relatório para imprimir.
 */
export default async function LaudoPage({ params }: { params: Promise<{ numero: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;
  if (!ehAdministrador(visitante.email)) redirect("/mapa");

  const { numero } = await params;
  if (!numeroValido(numero)) notFound();
  const hoje = diaBrasilia(new Date().toISOString());
  const [leitura, suspensiva] = await Promise.all([lerEntradaDiagnostico(numero, hoje), lerLaudoInstrumento(numero)]);

  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Laudo · instrumento nº {numero}</p>
          <h1 className="pa-titulo">Este instrumento não está na busca</h1>
          <p>
            O laudo cobre os instrumentos da busca: todos os de proponente da Paraíba e, no resto do país, os que estão em execução ou em
            prestação de contas. Confira o número ou procure pelo programa.
          </p>
          <p className="pa-nota">
            <Link href={`/mapa/busca?q=${encodeURIComponent(numero)}`}>Buscar por “{numero}”</Link>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") {
    return <DadoIndisponivel kicker={`Laudo · instrumento nº ${numero}`} titulo="O laudo está indisponível agora" />;
  }

  const { entrada, execucao } = leitura;
  const referencia = diaBrasilia(execucao.referencia ?? execucao.dado_ate ?? hoje);
  // O dossiê da suspensiva é complemento deste laudo, não condição: se a leitura dele falhar, o laudo sai sem.
  if (suspensiva.estado !== "ok" && suspensiva.estado !== "sem_coleta") entrada.faltas.push("dossiê da suspensiva (Acesso Livre)");

  // Coleta dos aprovados sem assinatura (onda 12, parte 2): os requisitos para celebração entram no
  // diagnóstico, que decide a vez e o próximo passo por eles. A página é a de qualquer instrumento.
  if (suspensiva.estado === "ok" && suspensiva.dossie.recorte === "assinatura") {
    const d = lerDiagnostico({ ...entrada, acessoLivre: lerAcessoLivre(suspensiva.dossie, hoje) }, hoje);
    return <DiagnosticoConteudo d={d} i={entrada.instrumento} referencia={referencia} hoje={hoje} dossie={suspensiva.dossie} />;
  }

  if (suspensiva.estado === "ok") {
    const laudo = lerLaudo(suspensiva.dossie, suspensiva.contexto, hoje, tempoNoOrgao(suspensiva.contexto, suspensiva.historicoOrgao, hoje));
    const d = lerDiagnostico(entrada, hoje, { comDossie: true });
    return (
      <LaudoConteudo
        laudo={laudo}
        dossie={suspensiva.dossie}
        contexto={suspensiva.contexto}
        hoje={hoje}
        complemento={<DiagnosticoComplemento d={d} i={entrada.instrumento} />}
        fontesExtras={<FontesDiagnostico d={d} referencia={referencia} hoje={hoje} />}
      />
    );
  }

  const d = lerDiagnostico(entrada, hoje);
  return <DiagnosticoConteudo d={d} i={entrada.instrumento} referencia={referencia} hoje={hoje} />;
}
