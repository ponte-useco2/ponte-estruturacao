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
import { lerCatalogo, lerCatalogoV2 } from "./catalogo.server";
import { calcularDiff, type EstadoProcessado } from "./diff";
import { ehEsquemaAusente } from "./esquema";
import { gerarAvisosJanelas } from "./favoritos.server";

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

export type OrigemSincronizacao = "cron" | "aba";

/**
 * Registra a tentativa, tenha ela dado certo ou não.
 *
 * Falha de sincronização que só aparece no log do servidor é falha que a tela
 * não consegue contar para quem está lendo — e foi isso que obrigou a central a
 * dizer "não foi possível verificar" sem saber quando tentou.
 *
 * O registro nunca derruba a sincronização: se ele falhar, o que importa já
 * aconteceu.
 */
async function registrarTentativa(
  origem: OrigemSincronizacao,
  iniciadaEm: string,
  r: ResultadoSincronizacao,
): Promise<void> {
  if (!authConfigurada()) return;

  const linha = {
    iniciada_em: iniciadaEm,
    origem,
    resultado: r.status,
    publicacao: r.status === "aplicada" || r.status === "sem_novidade" ? r.publicacao : null,
    mudancas: r.status === "aplicada" ? r.mudancas : null,
    notificacoes: r.status === "aplicada" ? r.notificacoes : null,
    mensagem: r.status === "erro" ? r.mensagem : null,
  };

  const { error } = await clienteServidor().from("oport_sincronizacao").insert(linha);
  if (error && !ehEsquemaAusente(error.code)) console.error("registrarTentativa:", error.message);
}

export async function sincronizarCentral(origem: OrigemSincronizacao = "cron"): Promise<ResultadoSincronizacao> {
  const iniciadaEm = new Date().toISOString();
  const r = await executarSincronizacao();
  await registrarTentativa(origem, iniciadaEm, r);
  // Onda 7: avisos de quem segue janela, pelo catálogo v2. Roda também sem publicação
  // nova, porque "fecha em N dias" muda com o dia; a função do banco não repete aviso.
  if (r.status !== "nao_ativada") {
    const v2 = await lerCatalogoV2();
    if (v2.estado === "ok") await gerarAvisosJanelas(v2.payload);
  }
  return r;
}

async function executarSincronizacao(): Promise<ResultadoSincronizacao> {
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
