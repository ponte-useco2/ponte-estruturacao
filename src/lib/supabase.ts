import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase do lado do servidor, com chave de service role.
 *
 * POR QUE ISTO LANÇA EM VEZ DE AVISAR
 * A versão anterior caía de service role para a chave anônima quando
 * `SUPABASE_SERVICE_ROLE_KEY` faltava, e para string vazia quando faltavam as
 * duas — emitia `console.warn` e seguia. O efeito era o pior possível:
 * configuração incompleta virava falha de gravação intermitente, difícil de
 * diagnosticar, em vez de erro claro no primeiro uso.
 *
 * Pior ainda em termos de segurança: um caminho escrito supondo service role
 * passava a rodar com chave anônima, e o que devia ser "gravação privilegiada
 * controlada pelo servidor" virava "gravação sujeita a RLS que ninguém revisou
 * para esse caso".
 *
 * A regra do projeto, já adotada em `auth-area.ts` e em `supabase-auth.ts`, é
 * que configuração ausente FECHA a porta. Aqui fechar significa lançar.
 *
 * ATENÇÃO: esta chave ignora RLS por completo. Todo caminho que a usa é
 * responsável pela própria validação — não há rede de proteção no banco.
 */
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase não configurado: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY " +
        "são obrigatórias. Defina as duas na Vercel (e em .env.local para desenvolvimento)."
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
