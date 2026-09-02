"use server";

import { clienteServidor, visitanteAtual } from "@/lib/supabase-auth";

/**
 * Registro de uso do painel.
 *
 * O que é gravado: quem (id e e-mail), o quê (tipo do evento), detalhe
 * mínimo, e quando. O que NÃO é gravado, deliberadamente: endereço IP e
 * user-agent. Ambos são dado pessoal e nenhum dos dois responde a pergunta
 * que este registro existe para responder — que é "quem usou e o que
 * procurou", não "de onde e com qual aparelho".
 *
 * Só grava para quem está aprovado. Quem está pendente não gera rastro além
 * da própria solicitação.
 */

export type TipoEvento =
  | "entrada"
  | "filtro"
  | "abrir_oportunidade"
  | "link_externo"
  | "busca";

const TIPOS: TipoEvento[] = [
  "entrada",
  "filtro",
  "abrir_oportunidade",
  "link_externo",
  "busca",
];

/** Corta texto longo: o detalhe é para saber o que interessou, não para
 *  armazenar o que a pessoa digitou por inteiro. */
function enxugar(valor: unknown, limite = 120): unknown {
  if (typeof valor === "string") return valor.slice(0, limite);
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => enxugar(v, 60));
  return valor;
}

export async function registrarEvento(
  tipo: TipoEvento,
  detalhe: Record<string, unknown> = {}
): Promise<void> {
  // Tipo vem do cliente: só aceitamos os conhecidos, para o painel de uso não
  // virar depósito de string arbitrária.
  if (!TIPOS.includes(tipo)) return;

  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return;

  const limpo: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detalhe).slice(0, 10)) {
    limpo[k.slice(0, 40)] = enxugar(v);
  }

  const admin = clienteServidor();
  const { error } = await admin.from("oport_evento").insert({
    user_id: visitante.id,
    email: visitante.email,
    tipo,
    detalhe: limpo,
  });

  // Falha de registro não pode derrubar a navegação de quem está usando o
  // painel. Registra no log do servidor e segue.
  if (error) console.error("oport_evento:", error.message);
}
