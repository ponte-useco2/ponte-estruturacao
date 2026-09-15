"use server";

import { revalidatePath } from "next/cache";
import { clienteSessao, visitanteAtual } from "@/lib/supabase-auth";
import { lerCatalogo, lerCatalogoV2 } from "@/lib/oportunidades/catalogo.server";
import { hojeLocal } from "@/lib/oportunidades/contrato-v2";
import { LIMITE_SEGUIDOS, chaveValida, retratoDaJanela } from "@/lib/oportunidades/favoritos";
import { ehTemaConhecido } from "@/lib/oportunidades/temas";

/**
 * Ações da central: marcar como lida, arquivar, e o inverso de cada uma — que é
 * o que o botão "Desfazer" chama.
 *
 * Server action é endpoint HTTP. A verificação vale AQUI dentro, não na tela:
 * esconder um botão não esconde a ação. E a escrita usa o cliente da sessão,
 * então a RLS garante que um id alheio misturado na lista simplesmente não é
 * alcançado. O filtro por `user_id` abaixo é redundância deliberada.
 */

export interface ResultadoAcao {
  ok: boolean;
  erro?: string;
}

type Campo = "lida_em" | "arquivada_em";
/** A fila de avisos do catálogo (oport_3) ou a dos itens seguidos (oport_15): as duas marcam do mesmo jeito. */
type Fila = "oport_notificacao" | "oport_aviso";

/**
 * `/mapa` com escopo de LAYOUT, e não de página: desde 12/09/2026 o segmento tem
 * duas telas — o catálogo em `/mapa` e a central em `/mapa/avisos` — e as duas
 * dependem destas ações. A preferência de temas muda o destaque dos avisos E a
 * aderência do catálogo; revalidar só uma deixaria a outra mostrando o antes.
 */
const ROTA = "/mapa";
const LIMITE_POR_ACAO = 500;

function idsValidos(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= LIMITE_POR_ACAO &&
    ids.every((id) => typeof id === "string" && /^\d{1,18}$/.test(id))
  );
}

async function marcar(ids: unknown, campo: Campo, ligar: boolean, fila: Fila = "oport_notificacao"): Promise<ResultadoAcao> {
  if (!idsValidos(ids)) return { ok: false, erro: "Seleção inválida." };

  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return { ok: false, erro: "Sem permissão." };

  const db = await clienteSessao();
  const { error } = await db
    .from(fila)
    .update({ [campo]: ligar ? new Date().toISOString() : null })
    .in("id", ids)
    .eq("user_id", visitante.id);

  if (error) {
    console.error(`${fila} ${campo}:`, error.message);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }

  revalidatePath(ROTA, "layout");
  return { ok: true };
}

export async function marcarLidas(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "lida_em", true);
}

export async function marcarNaoLidas(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "lida_em", false);
}

export async function arquivar(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "arquivada_em", true);
}

export async function desarquivar(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "arquivada_em", false);
}

export async function marcarItensLidos(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "lida_em", true, "oport_aviso");
}

export async function marcarItensNaoLidos(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "lida_em", false, "oport_aviso");
}

export async function arquivarItens(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "arquivada_em", true, "oport_aviso");
}

export async function desarquivarItens(ids: unknown): Promise<ResultadoAcao> {
  return marcar(ids, "arquivada_em", false, "oport_aviso");
}

/* -------------------------------------------------------------------------
   Seguir um item (onda 7).

   A estrela grava pela sessão, e a RLS garante que é da própria pessoa aprovada.
   Convênio e proposta: o banco confere que o item está no painel e tira dele o
   título e o retrato (gatilho da oport_15). Janela: o id é conferido aqui no
   catálogo v2, e o retrato sai do catálogo lido no servidor, nunca do navegador.
   ------------------------------------------------------------------------- */

export async function seguir(tipo: unknown, chave: unknown): Promise<ResultadoAcao> {
  if (!chaveValida(tipo, chave)) return { ok: false, erro: "Item inválido." };
  const alvo = chave as string;

  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return { ok: false, erro: "Sem permissão." };

  const linha: Record<string, unknown> = { user_id: visitante.id, tipo, chave: alvo };
  if (tipo === "janela") {
    const leitura = await lerCatalogoV2();
    if (leitura.estado !== "ok") return { ok: false, erro: "O catálogo está indisponível agora. Tente de novo." };
    const retrato = retratoDaJanela(leitura.payload, alvo, hojeLocal(new Date()));
    if (!retrato) return { ok: false, erro: "Essa janela não está mais no catálogo." };
    Object.assign(linha, { titulo: retrato.titulo, estado: retrato.estado, referencia: leitura.payload.generated_at });
  }

  const db = await clienteSessao();
  const { error } = await db.from("oport_favorito").insert(linha);
  // 23505: já seguia (dois cliques, duas abas). O resultado pedido é o mesmo.
  if (error && error.code !== "23505") {
    if (error.code === "23514") {
      return { ok: false, erro: `Você já segue ${LIMITE_SEGUIDOS} itens. Deixe de seguir algum para seguir este.` };
    }
    if (error.code === "23503") return { ok: false, erro: "Este item não está mais na busca." };
    console.error("seguir:", error.message);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }

  revalidatePath(ROTA, "layout");
  return { ok: true };
}

export async function deixarDeSeguir(tipo: unknown, chave: unknown): Promise<ResultadoAcao> {
  if (!chaveValida(tipo, chave)) return { ok: false, erro: "Item inválido." };

  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return { ok: false, erro: "Sem permissão." };

  const db = await clienteSessao();
  const { error } = await db
    .from("oport_favorito")
    .delete()
    .eq("user_id", visitante.id)
    .eq("tipo", tipo)
    .eq("chave", chave as string);
  if (error) {
    console.error("deixarDeSeguir:", error.message);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }

  revalidatePath(ROTA, "layout");
  return { ok: true };
}

/* -------------------------------------------------------------------------
   Preferências de acompanhamento.

   Marcar é consentir; desmarcar é revogar, e revogar APAGA — quando a última
   escolha sai, a linha inteira vai embora, em vez de ficar uma linha vazia
   dizendo que a pessoa ainda está ali.

   O valor é conferido aqui: tema tem de ser um id conhecido, e órgão ou
   natureza têm de existir no catálogo. Sem isso, esta ação seria um campo
   aberto para gravar qualquer texto na conta de quem chamou.
   ------------------------------------------------------------------------- */

const EIXOS = ["temas", "orgaos", "naturezas"] as const;
type Eixo = (typeof EIXOS)[number];

interface LinhaPreferencia {
  temas: string[] | null;
  orgaos: string[] | null;
  naturezas: string[] | null;
}

async function valorExisteNoCatalogo(eixo: Eixo, valor: string): Promise<boolean> {
  const catalogo = await lerCatalogo();
  if (!catalogo) return false;
  const campo = eixo === "orgaos" ? "orgao" : "natureza";
  return catalogo.oportunidades.some((o) => o[campo] === valor);
}

export async function alternarPreferencia(eixo: unknown, valor: unknown, marcado: unknown): Promise<ResultadoAcao> {
  if (typeof eixo !== "string" || !EIXOS.includes(eixo as Eixo)) return { ok: false, erro: "Opção inválida." };
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 200) {
    return { ok: false, erro: "Opção inválida." };
  }
  if (typeof marcado !== "boolean") return { ok: false, erro: "Opção inválida." };

  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return { ok: false, erro: "Sem permissão." };

  const campo = eixo as Eixo;
  if (marcado) {
    const conhecido = campo === "temas" ? ehTemaConhecido(valor) : await valorExisteNoCatalogo(campo, valor);
    if (!conhecido) return { ok: false, erro: "Essa opção não existe no catálogo." };
  }

  const db = await clienteSessao();
  const atual = await db
    .from("oport_preferencia")
    .select("temas, orgaos, naturezas")
    .eq("user_id", visitante.id)
    .maybeSingle();

  if (atual.error) {
    console.error("preferencia leitura:", atual.error.message);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }

  const linha = atual.data as LinhaPreferencia | null;
  const prefs = {
    temas: linha?.temas ?? [],
    orgaos: linha?.orgaos ?? [],
    naturezas: linha?.naturezas ?? [],
  };

  const conjunto = new Set(prefs[campo]);
  if (marcado) conjunto.add(valor);
  else conjunto.delete(valor);
  prefs[campo] = [...conjunto].sort();

  const nadaMarcado = !prefs.temas.length && !prefs.orgaos.length && !prefs.naturezas.length;

  const { error } = nadaMarcado
    ? await db.from("oport_preferencia").delete().eq("user_id", visitante.id)
    : await db
        .from("oport_preferencia")
        .upsert({ user_id: visitante.id, ...prefs, atualizado_em: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) {
    console.error("preferencia gravacao:", error.message);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }

  revalidatePath(ROTA, "layout");
  return { ok: true };
}

/**
 * Desmarcar tudo de uma vez: apaga a linha, como desmarcar uma a uma faria.
 *
 * Não exige aprovação: quem foi bloqueado com a aba aberta ainda retira a escolha.
 * Por isso vai pela função da oport_16, e não por `.delete()`. DELETE com filtro
 * passa pela política de SELECT, que exige aprovação: para o bloqueado, apagava 0
 * linhas sem erro, e a tela dizia "Preferências apagadas.". A função apaga pela
 * `auth.uid()` sem RLS no caminho, então 0 aqui quer dizer que não havia linha.
 */
export async function limparPreferencias(): Promise<ResultadoAcao> {
  const visitante = await visitanteAtual();
  if (!visitante) return { ok: false, erro: "Sem permissão." };

  const db = await clienteSessao();
  const { error } = await db.rpc("oport_apagar_minhas_preferencias");

  if (error) {
    console.error("preferencia limpeza:", error.message);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }

  revalidatePath(ROTA, "layout");
  return { ok: true };
}
