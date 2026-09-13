import type { Metadata } from "next";
import { after } from "next/server";
import { lerCatalogo } from "@/lib/oportunidades/catalogo.server";
import { lerCentral, lerPreferencias, lerTentativasFalhas, registrarVisita } from "@/lib/oportunidades/notificacoes.server";
import { opcoesDePreferencia } from "@/lib/oportunidades/opcoes";
import { sincronizarCentral } from "@/lib/oportunidades/sincronizar.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { MapaClient } from "./MapaClient";

export const metadata: Metadata = {
  title: "Avisos · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O portão de acesso que decide a RESPOSTA vem do layout do segmento. A página
 * lê — e decide o que a tela pode afirmar.
 */
export default async function MapaDeOportunidadesPage() {
  // No App Router, layout e página renderizam em PARALELO: o redirect do layout
  // decide o que volta ao navegador, mas não impede esta função de rodar. Sem
  // esta checagem, uma visita anônima lia a central vazia pela RLS, concluía que
  // havia publicação pendente e disparava a sincronização com a chave de serviço.
  // Achado ao verificar o build no navegador, em 11/09/2026.
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  // `registrarVisita` devolve a marca ANTERIOR e só então carimba a de agora: é a
  // anterior que posiciona a divisória na lista.
  const [catalogo, central, preferencias, visitaAnterior, tentativas] = await Promise.all([
    lerCatalogo(),
    lerCentral(),
    lerPreferencias(),
    registrarVisita(visitante.id),
    lerTentativasFalhas(),
  ]);

  // Publicação nova no disco que a central ainda não processou. Sincroniza DEPOIS
  // de responder, para não prender quem abriu a aba — e a tela avisa que há
  // processamento pendente, em vez de fingir que está em dia.
  const pendente =
    central.status === "ok" &&
    catalogo !== null &&
    (central.ultimaProcessada === null || catalogo.gerado_em > central.ultimaProcessada);

  if (pendente) {
    after(async () => {
      await sincronizarCentral("aba");
    });
  }

  // O universo do catálogo: quantas janelas existem, quantas fecham na semana e
  // quantas não têm tema. Sem isso a tela não consegue dizer que as janelas
  // continuam lá quando a fila de avisos está vazia.
  const agora = new Date();
  const ate = new Date(agora.getTime());
  ate.setUTCDate(ate.getUTCDate() + 7);
  const ateIso = ate.toISOString().slice(0, 10);
  const resumoCatalogo = catalogo
    ? {
        total: catalogo.oportunidades.length,
        fecham7: catalogo.oportunidades.filter((o) => o.fecha <= ateIso).length,
        ate: ateIso,
        semTema: catalogo.oportunidades.filter((o) => (o.temas ?? []).length === 0).length,
      }
    : null;

  // O instante vem do servidor: calcular frescor com o relógio do navegador faria
  // servidor e cliente discordarem na hidratação, e o relógio do cliente é o menos
  // confiável dos dois.
  // As opções vêm do catálogo de hoje: oferecer órgão que não está em janela
  // nenhuma é prometer um destaque que nunca apareceria.
  return (
    <MapaClient
        central={central}
        pendente={pendente}
        agoraIso={agora.toISOString()}
        resumoCatalogo={resumoCatalogo}
        visitaAnterior={visitaAnterior}
        tentativas={tentativas}
        preferencias={preferencias}
        opcoes={opcoesDePreferencia(catalogo?.oportunidades ?? [])}
      />
  );
}
