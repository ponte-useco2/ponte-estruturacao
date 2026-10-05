/**
 * Registro de uso do Mapa (MVP da carteira, 02/10/2026) — é o que mede o experimento de assinatura: se a pessoa
 * volta sem ser lembrada, que tarefa repete, que análise abre.
 *
 * Mesma tabela e mesma regra do registro do painel antigo (`app/oportunidades/eventos.ts`): quem (id e e-mail),
 * o quê (tipo), detalhe mínimo e quando. Endereço IP e aparelho NÃO são gravados. Só para quem está aprovado.
 * Falha de registro nunca derruba a página: vai para o log do servidor e a navegação segue.
 */
import { clienteServidor, visitanteAtual } from "@/lib/supabase-auth";

export type UsoMapa =
  | "mapa_carteira"
  | "mapa_relatorio_municipio"
  | "mapa_laudo_instrumento"
  | "mapa_seguir"
  | "mapa_deixar_de_seguir";

const TIPOS: readonly UsoMapa[] = ["mapa_carteira", "mapa_relatorio_municipio", "mapa_laudo_instrumento", "mapa_seguir", "mapa_deixar_de_seguir"];

/** Só texto curto e número: o detalhe diz o que interessou, não guarda conteúdo. */
export function detalheLimpo(detalhe: Record<string, unknown>): Record<string, string | number | boolean> {
  const limpo: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(detalhe).slice(0, 8)) {
    if (typeof v === "string") limpo[k.slice(0, 40)] = v.slice(0, 80);
    else if (typeof v === "number" && Number.isFinite(v)) limpo[k.slice(0, 40)] = v;
    else if (typeof v === "boolean") limpo[k.slice(0, 40)] = v;
  }
  return limpo;
}

export async function registrarUso(tipo: UsoMapa, detalhe: Record<string, unknown> = {}): Promise<void> {
  if (!TIPOS.includes(tipo)) return;
  try {
    const visitante = await visitanteAtual();
    if (!visitante || visitante.status !== "aprovado") return;
    const { error } = await clienteServidor().from("oport_evento").insert({
      user_id: visitante.id,
      email: visitante.email,
      tipo,
      detalhe: detalheLimpo(detalhe),
    });
    if (error) console.error("oport_evento (mapa):", error.message);
  } catch (e) {
    console.error("oport_evento (mapa):", e instanceof Error ? e.message : e);
  }
}
