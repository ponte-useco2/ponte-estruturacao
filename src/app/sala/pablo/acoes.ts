"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { authConfigurada, clienteServidor, clienteSessao } from "@/lib/supabase-auth";
import { mensagemDoErro, montarChamada, nomeSeguro, problemaNoArquivo, SALA_PABLO, tipoDoArquivo, type Ato } from "@/lib/oportunidades/sala-escrita";

/**
 * Atos da sala do Pablo (oport_59). Tudo pelo cliente da SESSÃO: a função do banco confere se a conta é membro, a
 * transição e a versão, e grava o evento na mesma transação. Nada aqui grava tabela direto — o papel `authenticated`
 * nem tem permissão para isso.
 *
 * Arquivos (adendo 1): o bucket `salas` é privado e não tem política para ninguém da API. Por isso a chave de serviço
 * aparece em três pontos, sempre DEPOIS de o banco confirmar quem é pela sessão: gerar o link assinado de envio, gerar
 * o link assinado de download (60 s, como anexo, sem pré-visualização) e apagar os bytes (só a PONTE). Os bytes não
 * passam pelo servidor do site: o navegador sobe direto ao armazenamento.
 */

type Resultado = { ok: true } | { ok: false; erro: string };
const BUCKET = "salas";
const ERRO_GERAL = "Não foi possível concluir agora. Tente de novo; se continuar, recarregue a página.";

export async function executarAto(ato: Ato): Promise<Resultado> {
  if (!authConfigurada()) return { ok: false, erro: "A sala está indisponível agora." };
  let chamada: ReturnType<typeof montarChamada>;
  try {
    chamada = montarChamada(SALA_PABLO, ato);
  } catch {
    return { ok: false, erro: "Ação desconhecida." };
  }
  const db = await clienteSessao();
  const { error } = await db.rpc(chamada.funcao, chamada.args);
  if (error) {
    if (!/sala: /.test(error.message)) console.error("sala: ato", chamada.funcao, error.code, error.message);
    return { ok: false, erro: mensagemDoErro(error.message) };
  }
  revalidatePath("/sala/pablo");
  return { ok: true };
}

/** O envio de arquivo está ligado? Desligável por `SALA_PABLO_ARQUIVOS=desligado` (decisão aberta sobre CPF em PDF). */
function arquivosLigados(): boolean {
  return process.env.SALA_PABLO_ARQUIVOS !== "desligado";
}

/** A conta logada é membro da sala? (pela RLS: quem não é membro não lê nenhuma linha). Devolve o papel, ou null. */
async function papelNaSala(): Promise<"ponte" | "cliente" | null> {
  const db = await clienteSessao();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("sala_membro").select("papel").eq("sala", SALA_PABLO).eq("user_id", user.id).maybeSingle();
  return (data?.papel as "ponte" | "cliente" | undefined) ?? null;
}

/**
 * Passo 1 do envio de arquivo: confere membro, projeto, tipo e tamanho, e devolve o caminho e o token do link assinado
 * de envio. O registro (passo 3, `registrar_arquivo`) confere de novo, no banco, o que de fato chegou.
 */
export async function prepararArquivo(
  objeto: string,
  nome: string,
  tamanho: number,
): Promise<{ ok: true; id: string; caminho: string; token: string; tipo: string } | { ok: false; erro: string }> {
  if (!authConfigurada() || !arquivosLigados()) return { ok: false, erro: "O envio de arquivos está desligado nesta sala." };
  if (!/^[A-Z]{2}-\d{2}$/.test(objeto)) return { ok: false, erro: "Projeto inválido." };
  const problema = problemaNoArquivo(nome, tamanho);
  if (problema) return { ok: false, erro: problema };
  if (!(await papelNaSala())) return { ok: false, erro: "Esta conta não é membro da sala." };
  const db = await clienteSessao();
  const { data: obj } = await db.from("sala_objeto").select("id").eq("sala", SALA_PABLO).eq("id", objeto).maybeSingle();
  if (!obj) return { ok: false, erro: "Projeto não encontrado." };

  const id = `e-${randomBytes(5).toString("hex")}`;
  const caminho = `${SALA_PABLO}/${objeto}/${id}/${nomeSeguro(nome)}`;
  const { data, error } = await clienteServidor().storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data) {
    console.error("sala: link de envio", error?.message);
    return { ok: false, erro: ERRO_GERAL };
  }
  return { ok: true, id, caminho, token: data.token, tipo: tipoDoArquivo(nome) ?? "application/octet-stream" };
}

/** Download: o membro lê o envio pela RLS; só então sai um link assinado de 60 s, como anexo. */
export async function linkDoArquivo(id: string): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  if (!authConfigurada()) return { ok: false, erro: "A sala está indisponível agora." };
  const db = await clienteSessao();
  const { data: e } = await db
    .from("sala_envio")
    .select("caminho_storage,nome_arquivo,tipo,arquivo_apagado")
    .eq("sala", SALA_PABLO)
    .eq("id", id)
    .maybeSingle();
  if (!e || e.tipo !== "arquivo" || e.arquivo_apagado || !e.caminho_storage) return { ok: false, erro: "Arquivo indisponível." };
  const { data, error } = await clienteServidor()
    .storage.from(BUCKET)
    .createSignedUrl(e.caminho_storage, 60, { download: e.nome_arquivo || true });
  if (error || !data) {
    console.error("sala: link de download", error?.message);
    return { ok: false, erro: ERRO_GERAL };
  }
  return { ok: true, url: data.signedUrl };
}

/** Apagar os bytes: só a PONTE, com motivo. O banco confere e devolve o caminho; apaga-se; o banco confere que saiu. */
export async function apagarArquivo(id: string, motivo: string): Promise<Resultado> {
  if (!authConfigurada()) return { ok: false, erro: "A sala está indisponível agora." };
  const db = await clienteSessao();
  const preparo = await db.rpc("sala_arquivo_para_apagar", { p_sala: SALA_PABLO, p_id: id, p_motivo: motivo });
  if (preparo.error || typeof preparo.data !== "string") {
    if (preparo.error && !/sala: /.test(preparo.error.message)) console.error("sala: apagar", preparo.error.message);
    return { ok: false, erro: mensagemDoErro(preparo.error?.message) };
  }
  const { error: erroStorage } = await clienteServidor().storage.from(BUCKET).remove([preparo.data]);
  if (erroStorage) {
    console.error("sala: apagar no armazenamento", erroStorage.message);
    return { ok: false, erro: "O arquivo não foi apagado. Nada mudou; tente de novo." };
  }
  const fim = await db.rpc("sala_arquivo_apagado", { p_sala: SALA_PABLO, p_id: id, p_motivo: motivo });
  if (fim.error) {
    console.error("sala: marcar apagado", fim.error.message);
    return { ok: false, erro: mensagemDoErro(fim.error.message) };
  }
  revalidatePath("/sala/pablo");
  return { ok: true };
}
