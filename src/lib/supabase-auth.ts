import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Clientes Supabase para a área autenticada da /oportunidades.
 *
 * Três clientes, três papéis — e misturá-los é a origem da maioria dos furos
 * de segurança em app com Supabase:
 *
 *   clienteSessao()   chave ANÔNIMA + cookies. Sabe quem é o usuário e
 *                     obedece RLS. É o que decide se alguém está logado.
 *
 *   clienteServidor() chave SERVICE ROLE. Ignora RLS por completo. Só para
 *                     gravar evento e mudar status de acesso — operações que
 *                     o usuário jamais pode fazer por conta própria.
 *
 * A chave de service role NUNCA pode chegar ao navegador. Ela não tem
 * prefixo NEXT_PUBLIC_ justamente por isso: o Next recusa expor o resto.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function authConfigurada(): boolean {
  return Boolean(URL && ANON && SERVICE);
}

/** Cliente ligado à sessão do visitante. Respeita RLS. */
export async function clienteSessao() {
  const jar = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server Component não pode escrever cookie. O refresh de sessão
          // acontece no proxy, que pode — aqui a falha é esperada e inócua.
        }
      },
    },
  });
}

/** Cliente administrativo. Ignora RLS. Nunca exponha ao cliente. */
export function clienteServidor() {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type StatusAcesso = "pendente" | "aprovado" | "bloqueado" | "sem_conta";

export interface Visitante {
  id: string;
  email: string;
  nome: string | null;
  avatar: string | null;
  status: StatusAcesso;
}

/**
 * Quem está acessando, e se pode entrar.
 *
 * Devolve null quando não há sessão. Quando há, garante que existe linha em
 * `oport_acesso` — criando como `pendente` no primeiro login — e devolve o
 * status atual. Nunca promove ninguém: a função do banco usa
 * `on conflict do update` sem tocar em `status`, então uma decisão sua não é
 * desfeita por um novo login.
 */
export async function visitanteAtual(): Promise<Visitante | null> {
  if (!authConfigurada()) return null;

  const supabase = await clienteSessao();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const nome =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    null;
  const avatar = (user.user_metadata?.avatar_url as string) || null;

  const admin = clienteServidor();
  const { data, error } = await admin.rpc("oport_registrar_solicitacao", {
    p_id: user.id,
    p_email: user.email,
    p_nome: nome,
    p_avatar: avatar,
  });

  if (error) {
    // Falha ao consultar autorização não pode virar autorização. Trata como
    // pendente: fecha a porta e mostra a tela de espera.
    console.error("oport_registrar_solicitacao:", error.message);
    return { id: user.id, email: user.email, nome, avatar, status: "pendente" };
  }

  return {
    id: user.id,
    email: user.email,
    nome,
    avatar,
    status: (data as StatusAcesso) || "pendente",
  };
}

/** E-mails que administram as aprovações. Lista curta, em env var. */
export function ehAdministrador(email: string | null | undefined): boolean {
  if (!email) return false;
  const lista = (process.env.OPORTUNIDADES_ADMINS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.toLowerCase());
}
