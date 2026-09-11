/**
 * Aplica a publicação atual do catálogo à central de notificações.
 *
 * Roda com o cliente de SERVIÇO: grava o estado global e distribui notificações
 * para todos os aprovados, coisa que nenhum usuário pode fazer por conta própria.
 * Por isso é chamada só de dois lugares — a rota do cron, protegida por segredo,
 * e o `after()` da própria aba — e nunca recebe dado vindo do navegador.
 *
 * Pode rodar de novo sem efeito: publicação já processada não gera nada, porque
 * o diff devolve vazio e o banco recusa `gerado_em` repetido.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { lerCatalogo } from "./catalogo.server";
import { calcularDiff, type EstadoProcessado } from "./diff";
import { ehEsquemaAusente } from "./esquema";

export type ResultadoSincronizacao =
  | {
      status: "aplicada";
      publicacao: string;
      mudancas: number;
      notificacoes: number;
      linhaDeBase: boolean;
      suspeita: string | null;
    }
  | { status: "sem_novidade"; publicacao: string }
  | { status: "nao_ativada" }
  | { status: "erro"; mensagem: string };

export async function sincronizarCentral(): Promise<ResultadoSincronizacao> {
  if (!authConfigurada()) return { status: "nao_ativada" };

  const catalogo = await lerCatalogo();
  if (!catalogo) return { status: "erro", mensagem: "catálogo indisponível" };

  const db = clienteServidor();
  const leitura = await db.from("oport_estado").select("gerado_em, abertas, saidas").eq("id", 1).maybeSingle();
  if (leitura.error) {
    if (ehEsquemaAusente(leitura.error.code)) return { status: "nao_ativada" };
    console.error("sincronizarCentral:", leitura.error.message);
    return { status: "erro", mensagem: leitura.error.message };
  }
  const anterior = (leitura.data as EstadoProcessado | null) ?? null;

  if (anterior && catalogo.gerado_em <= anterior.gerado_em) {
    return { status: "sem_novidade", publicacao: anterior.gerado_em };
  }

  let diff;
  try {
    diff = calcularDiff(anterior, catalogo);
  } catch (e) {
    // Chave de janela duplicada: o contrato mudou. Não grava nada e deixa rastro.
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error("sincronizarCentral:", mensagem);
    return { status: "erro", mensagem };
  }

  const { data, error } = await db.rpc("oport_aplicar_publicacao", {
    p_gerado_em: catalogo.gerado_em,
    p_total_abertas: catalogo.oportunidades.length,
    p_linha_de_base: diff.linhaDeBase,
    p_suspeita: diff.suspeita,
    p_mudancas: diff.mudancas,
    p_estado: diff.proximoEstado,
    p_estado_anterior_gerado_em: anterior?.gerado_em ?? null,
  });
  if (error) {
    if (ehEsquemaAusente(error.code)) return { status: "nao_ativada" };
    console.error("oport_aplicar_publicacao:", error.message);
    return { status: "erro", mensagem: error.message };
  }

  const r = data as { aplicada: boolean; mudancas?: number; notificacoes?: number };
  // Outro processo chegou antes. O banco é quem decide; aqui só se relata.
  if (!r.aplicada) return { status: "sem_novidade", publicacao: catalogo.gerado_em };

  return {
    status: "aplicada",
    publicacao: catalogo.gerado_em,
    mudancas: r.mudancas ?? 0,
    notificacoes: r.notificacoes ?? 0,
    linhaDeBase: diff.linhaDeBase,
    suspeita: diff.suspeita,
  };
}
