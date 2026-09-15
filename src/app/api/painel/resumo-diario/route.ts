import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import type { ContagemMudanca, MudancaPainel } from "@/lib/oportunidades/painel";
import type { ExecucaoPainel } from "@/lib/oportunidades/painel.server";
import { LEITURA_DESTAQUES, UF_DESTAQUE, montarResumoDiario } from "@/lib/oportunidades/resumo-diario";
import { administradores, authConfigurada, clienteServidor } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Comparação em tempo constante, como em /api/oportunidades/sincronizar. */
function autorizado(cabecalho: string | null, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho ?? "");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

const resposta = (corpo: Record<string, unknown>, status = 200) => NextResponse.json(corpo, { status });

/**
 * Envia aos administradores o que mudou no último dado do painel.
 *
 * Chamada pelo último passo do workflow radar-propostas, depois de o painel gravar,
 * com `Authorization: Bearer <PAINEL_RESUMO_SECRET>`. Sem o segredo configurado a rota
 * fecha. Sai uma vez por execução (`resumo_enviado_em`): repetir a chamada não repete o
 * e-mail.
 *
 * `?somente=<e-mail>` manda só para esse endereço, que precisa estar entre os
 * administradores, e não marca a execução — é o teste antes de ligar o envio para todos.
 */
export async function POST(request: Request) {
  const segredo = process.env.PAINEL_RESUMO_SECRET;
  if (!segredo || !autorizado(request.headers.get("authorization"), segredo)) {
    return resposta({ erro: "Não autorizado." }, 401);
  }
  if (!authConfigurada()) return resposta({ erro: "Supabase não configurado." }, 503);

  const admins = administradores();
  if (admins.length === 0) return resposta({ erro: "OPORTUNIDADES_ADMINS vazio." }, 500);
  const somente = new URL(request.url).searchParams.get("somente")?.trim().toLowerCase() || null;
  if (somente && !admins.includes(somente)) return resposta({ erro: "Endereço fora dos administradores." }, 400);

  const db = clienteServidor();
  const ultima = await db.rpc("painel_ultima_execucao");
  if (ultima.error) return resposta({ erro: ultima.error.message }, 500);
  const execucao = (ultima.data as (ExecucaoPainel & { resumo_enviado_em: string | null })[] | null)?.[0];
  if (!execucao) return resposta({ status: "sem_execucao" });
  if (!somente && execucao.resumo_enviado_em) return resposta({ status: "ja_enviado", execucao: execucao.id });
  // Para todos, só execução que comparou arquivo novo: a reexecução com o mesmo arquivo
  // não manda de novo o e-mail daquele dia. O teste (`somente`) usa as mudanças do último
  // dado, mesmo que a última execução tenha sido uma reexecução.
  if (!somente && Number(execucao.contagens?.mudancas_total ?? 0) === 0) {
    return resposta({ status: "sem_mudancas", execucao: execucao.id });
  }

  const [brasil, uf, destaques] = await Promise.all([
    db.rpc("painel_mudancas_resumo", { p_dias: 1 }),
    db.rpc("painel_mudancas_resumo", { p_dias: 1, p_uf: UF_DESTAQUE }),
    db.rpc("painel_mudancas", { p_dias: 1, p_uf: UF_DESTAQUE, p_limite: LEITURA_DESTAQUES }),
  ]);
  const erro = brasil.error ?? uf.error ?? destaques.error;
  if (erro) return resposta({ erro: erro.message }, 500);
  if (((brasil.data ?? []) as ContagemMudanca[]).every((l) => l.n === 0)) {
    return resposta({ status: "sem_mudancas", execucao: execucao.id });
  }

  // Marca antes de enviar: duas chamadas ao mesmo tempo não mandam dois e-mails. Se o
  // envio falhar, desmarca, e a próxima chamada tenta de novo.
  if (!somente) {
    const marca = await db
      .from("painel_execucao")
      .update({ resumo_enviado_em: new Date().toISOString() })
      .eq("id", execucao.id)
      .is("resumo_enviado_em", null)
      .select("id");
    if (marca.error) return resposta({ erro: marca.error.message }, 500);
    if (!marca.data?.length) return resposta({ status: "ja_enviado", execucao: execucao.id });
  }

  const contagens = (brasil.data ?? []) as ContagemMudanca[];
  const email = montarResumoDiario({
    dadoAte: execucao.dado_ate,
    desde: contagens.reduce<string | null>((m, l) => (l.desde && (!m || Date.parse(l.desde) < Date.parse(m)) ? l.desde : m), null),
    brasil: contagens,
    uf: (uf.data ?? []) as ContagemMudanca[],
    destaques: (destaques.data ?? []) as MudancaPainel[],
    urlBase: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ponteprojetos.com.br").replace(/\/+$/, ""),
  });
  const envio = await sendEmail({
    to: somente ?? admins.join(", "),
    subject: email.assunto,
    html: email.html,
    text: email.texto,
    fromName: "Painel da PONTE",
  });
  if (!envio.success) {
    if (!somente) await db.from("painel_execucao").update({ resumo_enviado_em: null }).eq("id", execucao.id);
    return resposta({ erro: envio.error ?? "Falha no envio." }, 502);
  }
  return resposta({ status: somente ? "teste_enviado" : "enviado", execucao: execucao.id, destinatarios: somente ? 1 : admins.length });
}
