/**
 * Chamadas caras a funções do banco, guardadas por execução (M-01 e A3-05 da investigação do portal, 29/10/2026).
 *
 * A medição de 29/10 mostrou o painel e a busca a 1–3 s do corte de 8 s da API: `painel_resumo` 2,6 s de média (91
 * chamadas, máximo 7,97 s), `painel_por_orgao` 2,4 s, `painel_busca_instrumentos_v2` 2,8 s; e "saude" levou 10 s com o
 * disco frio (a instância tem ~1 GB de memória para 1,2 GB de dados). O resultado só muda quando a execução muda, e
 * cada troca de visão do painel refazia o resumo inteiro. Aqui a chamada fica 10 minutos na memória da instância e no
 * cache comum (`cache-dados.server.ts`), com a execução na chave: execução nova, chave nova.
 *
 * Só leitura com a chave de serviço, sem cookie. Erro não se guarda: volta ao chamador como antes.
 */
import type { clienteServidor } from "@/lib/supabase-auth";
import { VALIDADE_DADOS_MS, chaveDaChamada } from "./cache-dados";
import { camadaDoCacheDeDados } from "./cache-dados.server";
import { criarMemoria } from "./memoria";

/** O que o chamador lê da resposta do PostgREST: os dados ou o erro (mensagem e código). */
export interface RespostaGuardada {
  data: unknown;
  error: { message: string; code?: string } | null;
}

type Banco = ReturnType<typeof clienteServidor>;

/** Uma memória por leitor (`painel`, `busca`), com `maximo` chaves por instância. */
export function criarRpcGuardada(leitor: string, maximo: number) {
  const memoria = criarMemoria<RespostaGuardada>({
    validadeMs: VALIDADE_DADOS_MS,
    maximo,
    guardar: (r) => r.error === null,
    compartilhada: camadaDoCacheDeDados<RespostaGuardada>({ leitor: `rpc-${leitor}`, guardavel: (r) => r.error === null }),
  });
  return (db: Banco, execucaoId: number, funcao: string, args: Record<string, unknown>): Promise<RespostaGuardada> =>
    memoria.obter(chaveDaChamada(execucaoId, funcao, args), async () => {
      const r = await db.rpc(funcao, args);
      return { data: r.data ?? null, error: r.error ? { message: r.error.message, code: r.error.code } : null };
    });
}
