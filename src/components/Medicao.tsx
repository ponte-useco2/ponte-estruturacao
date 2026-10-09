"use client";

/**
 * O Vercel Web Analytics (sem cookie) com o endereço sem a consulta nas áreas de dado.
 *
 * Na busca do Mapa e na lista das OSC o termo digitado vai na URL (`?q=`), e pode ser nome de pessoa ou
 * CPF. A medição precisa da página, não do que se buscou (09/10/2026, revisão R3 da onda 6). Fora do
 * Mapa e da área de oportunidades a URL segue inteira, como antes (campanhas usam `utm_*`).
 */
import { Analytics } from "@vercel/analytics/react";
import { semConsultaNasAreasDeDado } from "@/lib/oportunidades/medicao";

export function Medicao() {
  return <Analytics beforeSend={(evento) => ({ ...evento, url: semConsultaNasAreasDeDado(evento.url) })} />;
}
