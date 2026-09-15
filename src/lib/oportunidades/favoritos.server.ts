/**
 * Leitura dos itens seguidos, dos avisos sobre eles e das normas (onda 7).
 *
 * Tudo pelo cliente da SESSÃO, como a central: a RLS da oport_15 limita às linhas da
 * própria pessoa aprovada. A única escrita com a chave de serviço é a geração dos
 * avisos de janela, que roda na sincronização e nunca recebe dado do navegador.
 *
 * Sem a oport_15 no banco, as leituras devolvem "não ativado" e a tela esconde a
 * estrela, em vez de oferecer um botão que falharia.
 */
import { authConfigurada, clienteServidor, clienteSessao } from "@/lib/supabase-auth";
import { hojeLocal, type PayloadV2 } from "./contrato-v2";
import { ehEsquemaAusente } from "./esquema";
import { abertasParaAvisos, chaveSeguida, type AvisoItem, type ItemSeguido, type TipoItem } from "./favoritos";

/** Acima disto a tela diz que não mostra tudo. */
export const LIMITE_AVISOS_ITENS = 500;

/**
 * As chaves `tipo:chave` que a pessoa segue. Null quando não dá para saber (sem banco,
 * sem a oport_15 ou falha): a tela esconde a estrela.
 */
export async function lerSeguidas(): Promise<Set<string> | null> {
  if (!authConfigurada()) return null;
  const db = await clienteSessao();
  const { data, error } = await db.from("oport_favorito").select("tipo, chave").limit(1000);
  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("lerSeguidas:", error.message);
    return null;
  }
  return new Set(((data ?? []) as { tipo: TipoItem; chave: string }[]).map((l) => chaveSeguida(l.tipo, l.chave)));
}

export type LeituraItens =
  | { estado: "ok"; seguidos: ItemSeguido[]; avisos: AvisoItem[]; truncada: boolean }
  | { estado: "nao_ativado" }
  | { estado: "erro" };

interface LinhaSeguido {
  tipo: TipoItem;
  chave: string;
  titulo: string | null;
  criado_em: string;
  estado: Record<string, unknown> | null;
}

interface LinhaAviso extends Omit<AvisoItem, "id"> {
  id: number;
}

export async function lerItensSeguidos(): Promise<LeituraItens> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = await clienteSessao();
  const [seguidos, avisos] = await Promise.all([
    db.from("oport_favorito").select("tipo, chave, titulo, criado_em, estado").order("criado_em", { ascending: false }),
    db
      .from("oport_aviso")
      .select("id, tipo, chave, evento, titulo, antes, depois, criado_em, lida_em, arquivada_em")
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(LIMITE_AVISOS_ITENS + 1),
  ]);
  const erro = seguidos.error ?? avisos.error;
  if (erro) {
    if (ehEsquemaAusente(erro.code)) return { estado: "nao_ativado" };
    console.error("lerItensSeguidos:", erro.message);
    return { estado: "erro" };
  }
  const linhas = (avisos.data ?? []) as LinhaAviso[];
  return {
    estado: "ok",
    seguidos: ((seguidos.data ?? []) as LinhaSeguido[]).map((l) => ({
      tipo: l.tipo,
      chave: l.chave,
      titulo: l.titulo,
      criado_em: l.criado_em,
      ausente: l.estado?.ausente === true,
    })),
    avisos: linhas.slice(0, LIMITE_AVISOS_ITENS).map((l) => ({ ...l, id: String(l.id) })),
    truncada: linhas.length > LIMITE_AVISOS_ITENS,
  };
}

/**
 * Quantos avisos de itens seguidos estão sem ler. Soma-se ao número da aba "Avisos",
 * que a moldura mostra em toda tela do Mapa: só a contagem, pelo índice parcial.
 */
export async function contarAvisosItensNaoLidos(): Promise<number | null> {
  if (!authConfigurada()) return null;
  const db = await clienteSessao();
  const { count, error } = await db
    .from("oport_aviso")
    .select("id", { count: "exact", head: true })
    .is("lida_em", null)
    .is("arquivada_em", null);
  if (error) {
    if (!ehEsquemaAusente(error.code)) console.error("contarAvisosItensNaoLidos:", error.message);
    return null;
  }
  return count ?? 0;
}

export interface Norma {
  id: string;
  titulo: string;
  orgao: string | null;
  publicada_em: string;
  link: string;
  resumo: string | null;
  temas: string[];
}

export type LeituraNormas = { estado: "ok"; normas: Norma[] } | { estado: "nao_ativado" } | { estado: "erro" };

export async function lerNormas(limite = 100): Promise<LeituraNormas> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = await clienteSessao();
  const { data, error } = await db
    .from("oport_norma")
    .select("id, titulo, orgao, publicada_em, link, resumo, temas")
    .order("publicada_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(limite);
  if (error) {
    if (ehEsquemaAusente(error.code)) return { estado: "nao_ativado" };
    console.error("lerNormas:", error.message);
    return { estado: "erro" };
  }
  return {
    estado: "ok",
    normas: ((data ?? []) as (Omit<Norma, "id"> & { id: number })[]).map((n) => ({ ...n, id: String(n.id), temas: n.temas ?? [] })),
  };
}

/**
 * Avisos das janelas seguidas contra o catálogo do dia. Roda em toda sincronização,
 * com publicação nova ou não: o "fecha em N dias" depende do dia, não do arquivo.
 * Falha só vai para o log: a sincronização da central já aconteceu.
 */
export async function gerarAvisosJanelas(payload: PayloadV2, agora: Date = new Date()): Promise<void> {
  if (!authConfigurada()) return;
  const hoje = hojeLocal(agora);
  const { error } = await clienteServidor().rpc("oport_gerar_avisos_janelas", {
    p_referencia: payload.generated_at,
    p_hoje: hoje,
    p_abertas: abertasParaAvisos(payload, hoje),
  });
  if (error && !ehEsquemaAusente(error.code)) console.error("oport_gerar_avisos_janelas:", error.message);
}
