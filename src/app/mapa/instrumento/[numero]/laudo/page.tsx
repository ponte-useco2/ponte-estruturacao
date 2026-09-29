import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { numeroValido } from "@/lib/oportunidades/busca";
import { EXPLICACAO_SEM_FICHA, podeVerInstrumento } from "@/lib/oportunidades/cliente";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { lerDiagnostico } from "@/lib/oportunidades/diagnostico";
import { lerEntradaDiagnostico, type OpcoesLeitura } from "@/lib/oportunidades/diagnostico.server";
import { diaBrasilia, dossieSemNomes, lerAcessoLivre, lerLaudo } from "@/lib/oportunidades/laudo";
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
 * proponente, emenda, situação fiscal, fornecedores, riscos e estratégia. Para os convênios da coleta do
 * Acesso Livre, os registros do concedente entram também.
 *
 * Duas leituras (onda 12, parte 3):
 *   · administrador: tudo, inclusive nomes de servidores, fornecedores e painel fiscal;
 *   · cliente ("Meu município"): só os instrumentos da administração municipal do município confirmado,
 *     sem nomes de servidores, sem fornecedores, sem instrumentos de outros entes, sem painel fiscal e
 *     sem atalhos para páginas de administrador. O que não se mostra, não se lê.
 * A mesma página é o relatório para imprimir.
 */
export default async function LaudoPage({ params }: { params: Promise<{ numero: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { numero } = await params;
  if (!numeroValido(numero)) notFound();

  const admin = ehAdministrador(visitante.email);
  let opcoes: OpcoesLeitura = {};
  if (!admin) {
    const { acesso, organizacao } = await lerAcessoFicha(visitante);
    if (!acesso.ok) {
      const e = EXPLICACAO_SEM_FICHA[acesso.motivo];
      return (
        <SemLaudo numero={numero} kicker={organizacao?.nome ?? null} titulo={e.titulo}>
          {e.texto}
        </SemLaudo>
      );
    }
    opcoes = { semFornecedores: true, semFiscal: true, podeVer: (i) => podeVerInstrumento(acesso, i).ok };
  }
  const cliente = !admin;

  const hoje = diaBrasilia(new Date().toISOString());
  // Administrador: dossiê em paralelo com o resto. Cliente: só depois de o instrumento passar pela conferência.
  const dossieAdiantado = admin ? lerLaudoInstrumento(numero) : null;
  const leitura = await lerEntradaDiagnostico(numero, hoje, opcoes);

  if (leitura.estado === "nao_encontrado") {
    // Para o cliente, "não encontrado" também é "de outro proponente": a página não diz qual dos dois.
    return cliente ? (
      <SemLaudo numero={numero} kicker={null} titulo="Este laudo não está disponível para a sua organização">
        O laudo mostra os instrumentos da prefeitura do seu município (e dos fundos e autarquias municipais). Os convênios estão na ficha do{" "}
        <Link href="/mapa/meu-municipio">Meu município</Link>.
      </SemLaudo>
    ) : (
      <SemLaudo numero={numero} kicker={null} titulo="Este instrumento não está na busca">
        O laudo cobre os instrumentos da busca: todos os de proponente da Paraíba e, no resto do país, os que estão em execução ou em prestação
        de contas. Confira o número ou <Link href={`/mapa/busca?q=${encodeURIComponent(numero)}`}>procure por “{numero}”</Link>.
      </SemLaudo>
    );
  }
  if (leitura.estado !== "ok") {
    return <DadoIndisponivel kicker={`Laudo · instrumento nº ${numero}`} titulo="O laudo está indisponível agora" />;
  }

  const suspensiva = await (dossieAdiantado ?? lerLaudoInstrumento(numero));
  const { entrada, execucao } = leitura;
  const referencia = diaBrasilia(execucao.referencia ?? execucao.dado_ate ?? hoje);
  // O dossiê da suspensiva é complemento deste laudo, não condição: se a leitura dele falhar, o laudo sai sem.
  if (suspensiva.estado !== "ok" && suspensiva.estado !== "sem_coleta") entrada.faltas.push("dossiê da suspensiva (Acesso Livre)");

  if (suspensiva.estado === "ok") {
    // No laudo do cliente, nenhum nome de servidor: sai do dossiê antes de qualquer leitura.
    const dossie = cliente ? dossieSemNomes(suspensiva.dossie) : suspensiva.dossie;

    // Coleta dos aprovados sem assinatura (onda 12, parte 2): os requisitos para celebração entram no
    // diagnóstico, que decide a vez e o próximo passo por eles. A página é a de qualquer instrumento.
    if (dossie.recorte === "assinatura") {
      const d = lerDiagnostico({ ...entrada, acessoLivre: lerAcessoLivre(dossie, hoje) }, hoje);
      return <DiagnosticoConteudo d={d} i={entrada.instrumento} referencia={referencia} hoje={hoje} dossie={dossie} cliente={cliente} />;
    }

    const laudo = lerLaudo(dossie, suspensiva.contexto, hoje, tempoNoOrgao(suspensiva.contexto, suspensiva.historicoOrgao, hoje));
    const d = lerDiagnostico(entrada, hoje, { comDossie: true });
    return (
      <LaudoConteudo
        laudo={laudo}
        dossie={dossie}
        contexto={suspensiva.contexto}
        hoje={hoje}
        cliente={cliente}
        complemento={<DiagnosticoComplemento d={d} i={entrada.instrumento} cliente={cliente} />}
        fontesExtras={<FontesDiagnostico d={d} referencia={referencia} hoje={hoje} />}
      />
    );
  }

  const d = lerDiagnostico(entrada, hoje);
  return <DiagnosticoConteudo d={d} i={entrada.instrumento} referencia={referencia} hoje={hoje} cliente={cliente} />;
}

function SemLaudo({ numero, kicker, titulo, children }: { numero: string; kicker: string | null; titulo: string; children: ReactNode }) {
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">
          Laudo · instrumento nº {numero}
          {kicker ? ` · ${kicker}` : ""}
        </p>
        <h1 className="pa-titulo">{titulo}</h1>
        <p>{children}</p>
      </div>
    </div>
  );
}
