/**
 * Leitura da sala que grava (oport_59). Tudo pelo cliente da SESSÃO: a RLS (`sala_eh_membro`) só devolve linha a quem é
 * membro da sala, e a chave de serviço não passa por aqui. Quem não é membro recebe `membro: null` e a página recusa sem
 * dizer o que há dentro.
 *
 * Decisão do titular (30/10/2026): o Pablo entra SÓ na sala. Por isso não há `visitanteAtual` aqui — ele registraria a
 * conta como pedido de acesso ao portal (`oport_acesso`); a sala só pergunta quem está logado.
 */
import { authConfigurada, clienteSessao } from "@/lib/supabase-auth";
import { objetoDaLinha, type DadosSala, type Membro } from "./sala-escrita";

export interface LeituraSala {
  /** Sem sessão: a página mostra a entrada com o Google. */
  logado: boolean;
  /** O membro logado, ou null (não é membro, ou a oport_59 não está no banco). */
  membro: Membro | null;
  dados: DadosSala | null;
  /** Falha de leitura que não é "não é membro": a página avisa, sem conteúdo. */
  falha: boolean;
}

const LIMITE_EVENTOS = 500;

export async function lerSalaQueGrava(sala: string): Promise<LeituraSala> {
  if (!authConfigurada()) return { logado: false, membro: null, dados: null, falha: true };
  const db = await clienteSessao();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { logado: false, membro: null, dados: null, falha: false };

  const membros = await db.from("sala_membro").select("user_id,papel,nome").eq("sala", sala);
  if (membros.error) {
    console.error("sala: leitura dos membros", membros.error.code, membros.error.message);
    return { logado: true, membro: null, dados: null, falha: true };
  }
  const lista = (membros.data ?? []) as Membro[];
  const membro = lista.find((m) => m.user_id === user.id) ?? null;
  if (!membro) return { logado: true, membro: null, dados: null, falha: false };

  const [objetos, demandas, decisoes, reunioes, eventos, melhorias, envios] = await Promise.all([
    db.from("sala_objeto").select("id,ordem,dados,atualizado_em,atualizado_por").eq("sala", sala).order("ordem"),
    db
      .from("sala_demanda")
      .select(
        "id,objeto,estado,titulo,descricao,prioridade,data_desejada,data_combinada,responsavel,criterio,referencia,dependencia,entrega,validacao,datas_anteriores,motivo_cancelamento,autor_rotulo,criado_em,criado_por,atualizado_em",
      )
      .eq("sala", sala)
      .order("criado_em"),
    db
      .from("sala_decisao")
      .select("id,objeto,questao,alternativas,decisor,estado,decisao,efeito,autor_rotulo,decidido_rotulo,criado_por,decidido_em,decidido_por")
      .eq("sala", sala)
      .order("criado_em"),
    db.from("sala_reuniao").select("data,pauta,trabalho_da_manha,decisoes_tomadas,compromissos,notas,atualizado_em").eq("sala", sala).order("data", { ascending: false }),
    db.from("sala_evento").select("id,quando,quem,autor_rotulo,tipo,alvo,objeto,motivo").eq("sala", sala).order("quando", { ascending: false }).order("id", { ascending: false }).limit(LIMITE_EVENTOS),
    db.from("sala_melhoria").select("id,pagina,texto,estado,resposta,criado_em,criado_por,respondido_em").eq("sala", sala).order("criado_em", { ascending: false }),
    // O caminho no armazenamento não vai para a tela: o download passa pelo servidor (`linkDoArquivo`).
    db
      .from("sala_envio")
      .select("id,objeto,tipo,titulo,nota,url,nome_arquivo,tipo_conteudo,tamanho,sha256,estado,retirado_motivo,arquivo_apagado,criado_em,criado_por")
      .eq("sala", sala)
      .order("criado_em", { ascending: false }),
  ]);
  const erro = [objetos, demandas, decisoes, reunioes, eventos, melhorias, envios].find((r) => r.error);
  if (erro?.error) {
    console.error("sala: leitura", erro.error.code, erro.error.message);
    return { logado: true, membro, dados: null, falha: true };
  }
  return {
    logado: true,
    membro,
    falha: false,
    dados: {
      objetos: (objetos.data ?? []).map(objetoDaLinha),
      demandas: (demandas.data ?? []) as DadosSala["demandas"],
      decisoes: (decisoes.data ?? []) as DadosSala["decisoes"],
      reunioes: (reunioes.data ?? []) as DadosSala["reunioes"],
      eventos: (eventos.data ?? []) as DadosSala["eventos"],
      melhorias: (melhorias.data ?? []) as DadosSala["melhorias"],
      envios: (envios.data ?? []) as DadosSala["envios"],
      membros: lista,
    },
  };
}
