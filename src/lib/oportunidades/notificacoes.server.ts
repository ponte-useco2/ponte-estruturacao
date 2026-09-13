/**
 * Leitura da central de notificações para quem está logado.
 *
 * Usa o cliente da SESSÃO, não o de serviço: aqui a RLS é a barreira de verdade.
 * Mesmo que esta função esquecesse de filtrar por usuário, o banco só devolveria
 * as linhas da própria pessoa — e só se ela estiver aprovada.
 */
import { authConfigurada, clienteServidor, clienteSessao } from "@/lib/supabase-auth";
import type { TipoMudanca } from "./diff";
import type { ItemCentral } from "./central";
import { ehEsquemaAusente } from "./esquema";
import { PREFERENCIAS_VAZIAS, type Preferencias } from "./aderencia.ts";

/** Acima disto a tela avisa que não está mostrando tudo, em vez de cortar calada. */
export const LIMITE_ITENS = 500;

export type LeituraCentral =
  | { status: "ok"; itens: ItemCentral[]; truncada: boolean; ultimaProcessada: string | null }
  | { status: "nao_ativada" }
  | { status: "erro" };

interface LinhaNotificacao {
  id: number;
  lida_em: string | null;
  arquivada_em: string | null;
  mudanca: {
    tipo: TipoMudanca;
    chave: string;
    programa: string;
    orgao: string;
    fecha: string;
    limiar: number | null;
    antes: string | null;
    depois: string | null;
    temas: string[] | null;
    natureza: string | null;
    canal: string | null;
    publicacao: { gerado_em: string } | null;
  } | null;
}

/**
 * As preferências de quem está lendo. A RLS já limita à própria linha; sem
 * linha, ninguém marcou nada ainda, e isso não é erro.
 *
 * Falha de leitura devolve "sem preferência": a central precisa abrir mesmo
 * quando o destaque não pode ser calculado. Deixar de destacar é perda pequena;
 * deixar de mostrar o que mudou é o contrário do que esta tela existe para fazer.
 */
export async function lerPreferencias(): Promise<Preferencias> {
  if (!authConfigurada()) return PREFERENCIAS_VAZIAS;

  const db = await clienteSessao();
  const { data, error } = await db.from("oport_preferencia").select("temas, orgaos, naturezas").maybeSingle();

  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("lerPreferencias:", error.message);
    return PREFERENCIAS_VAZIAS;
  }

  const linha = data as { temas: string[] | null; orgaos: string[] | null; naturezas: string[] | null } | null;
  return {
    temas: linha?.temas ?? [],
    orgaos: linha?.orgaos ?? [],
    naturezas: linha?.naturezas ?? [],
  };
}

/**
 * Marca que a aba foi aberta e devolve a marca ANTERIOR — é ela que posiciona a
 * divisória "desde a sua última visita".
 *
 * Usa a chave de serviço porque `oport_acesso` não é escrita por usuário: a
 * linha de acesso é decisão da diretoria, e deixar o navegador escrever nela
 * seria abrir a porta que a oport_2 fechou.
 */
export async function registrarVisita(userId: string): Promise<string | null> {
  if (!authConfigurada()) return null;

  const { data, error } = await clienteServidor().rpc("oport_registrar_visita", { p_id: userId });
  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("registrarVisita:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

export interface TentativaFalha {
  quando: string;
  mensagem: string | null;
}

/**
 * As últimas tentativas de sincronização que falharam.
 *
 * Serve à tela de dado velho: "tentamos às 13:31 e às 13:34, e falhou". Sem
 * isso, o silêncio da fila fica indistinguível de calmaria.
 */
export async function lerTentativasFalhas(): Promise<TentativaFalha[]> {
  if (!authConfigurada()) return [];

  const db = await clienteSessao();
  const { data, error } = await db
    .from("oport_sincronizacao")
    .select("iniciada_em, mensagem")
    .eq("resultado", "erro")
    .order("iniciada_em", { ascending: false })
    .limit(3);

  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("lerTentativasFalhas:", error.message);
    return [];
  }

  const linhas = (data ?? []) as { iniciada_em: string; mensagem: string | null }[];
  return linhas.map((l) => ({ quando: l.iniciada_em, mensagem: l.mensagem }));
}

export async function lerCentral(): Promise<LeituraCentral> {
  // Sem Supabase configurado não há central. Criar o cliente assim lançaria
  // exceção em vez de responder.
  if (!authConfigurada()) return { status: "nao_ativada" };
  const db = await clienteSessao();
  const [notificacoes, publicacao] = await Promise.all([
    db
      .from("oport_notificacao")
      .select(
        "id, lida_em, arquivada_em, mudanca:oport_mudanca(tipo, chave, programa, orgao, fecha, limiar, antes, depois, temas, natureza, canal, publicacao:oport_publicacao(gerado_em))",
      )
      .order("criado_em", { ascending: false })
      .limit(LIMITE_ITENS + 1),
    db.from("oport_publicacao").select("gerado_em").order("gerado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const erro = notificacoes.error ?? publicacao.error;
  if (erro) {
    if (ehEsquemaAusente(erro.code)) return { status: "nao_ativada" };
    console.error("lerCentral:", erro.message);
    return { status: "erro" };
  }

  const linhas = (notificacoes.data ?? []) as unknown as LinhaNotificacao[];
  const itens: ItemCentral[] = [];
  for (const l of linhas.slice(0, LIMITE_ITENS)) {
    // Sem a mudança não há o que mostrar. Com a RLS, isso só acontece se a pessoa
    // perdeu a aprovação entre as duas leituras.
    if (!l.mudanca) continue;
    const m = l.mudanca;
    itens.push({
      id: String(l.id),
      tipo: m.tipo,
      chave: m.chave,
      programa: m.programa,
      orgao: m.orgao,
      fecha: m.fecha,
      limiar: m.limiar ?? undefined,
      antes: m.antes ?? undefined,
      depois: m.depois ?? undefined,
      // Linhas gravadas antes de oport_4 não têm os eixos. A chave é
      // `canal|natureza|códigos`, e é de lá que os dois voltam.
      temas: m.temas ?? [],
      natureza: m.natureza ?? m.chave.split("|")[1] ?? "",
      canal: (m.canal ?? m.chave.split("|")[0]) as ItemCentral["canal"],
      publicado_em: m.publicacao?.gerado_em ?? "",
      lida_em: l.lida_em,
      arquivada_em: l.arquivada_em,
    });
  }

  return {
    status: "ok",
    itens,
    truncada: linhas.length > LIMITE_ITENS,
    ultimaProcessada: (publicacao.data as { gerado_em: string } | null)?.gerado_em ?? null,
  };
}

/**
 * Quantos avisos não lidos e não arquivados a pessoa tem — o número da aba.
 *
 * `head: true` com `count: "exact"`: pede só a contagem, sem trazer linha
 * nenhuma. A moldura chama isto em toda tela do `/mapa`, então precisa ser
 * barato. A RLS limita às linhas da própria pessoa.
 *
 * Falha devolve null, não zero: "0 não lidas" afirmaria que está tudo lido, e
 * a verdade é que não foi possível contar. A aba mostra o nome sem número.
 */
export async function contarNaoLidas(): Promise<number | null> {
  if (!authConfigurada()) return null;

  const db = await clienteSessao();
  const { count, error } = await db
    .from("oport_notificacao")
    .select("id", { count: "exact", head: true })
    .is("lida_em", null)
    .is("arquivada_em", null);

  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("contarNaoLidas:", error.message);
    return null;
  }
  return count ?? 0;
}
