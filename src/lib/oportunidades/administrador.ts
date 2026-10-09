/**
 * Quando o e-mail da sessão pode ser comparado com a lista de administradores (C6 da R3, onda 7, 09/10/2026).
 *
 * `ehAdministrador(email)` compara só o e-mail com `OPORTUNIDADES_ADMINS`. Se o provedor de e-mail e senha
 * estiver ligado no Supabase (o verificador acusa "Leaked password protection disabled"), qualquer um cadastra
 * pela API pública o e-mail de um administrador que ainda não entrou; com a confirmação desligada, o Supabase
 * já marca o e-mail como confirmado. Por isso o e-mail confirmado não basta: a regra exige também que a conta
 * seja do Google desde o primeiro acesso, sem outro provedor ligado, e que a identidade do Google tenha o
 * mesmo e-mail da conta (troca de e-mail sem confirmação não herda o administrador).
 *
 * A porta de entrada (`app/oportunidades/entrar`) só oferece o Google (`BotaoGoogle`, `signInWithOAuth` com
 * `provider: "google"`), e o retorno (`app/auth/callback`) só troca o código do OAuth: a conta de quem
 * administra hoje nasceu assim e passa na regra (ver o teste). Abrir exceção para outro provedor é acrescentar
 * o nome a `PROVEDORES_DO_ADMINISTRADOR`, com teste.
 *
 * Módulo puro: recebe o usuário que `auth.getUser()` devolve (dado do servidor do Supabase, não do cookie) e
 * não lê nada.
 */

/** Os provedores que reconhecem administrador. Hoje só o Google, a única porta da tela de entrada. */
export const PROVEDORES_DO_ADMINISTRADOR: readonly string[] = ["google"];

/** O pedaço do `User` do Supabase que a regra lê. `app_metadata` só a chave de serviço muda. */
export interface UsuarioDaSessao {
  email?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
  identities?: readonly { provider?: unknown; identity_data?: { [chave: string]: unknown } | null }[] | null;
}

const normalizado = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase() : "");
const doAdministrador = (provedor: unknown): boolean => PROVEDORES_DO_ADMINISTRADOR.includes(normalizado(provedor));

/**
 * Por que a identidade não serve para administrador, em poucas palavras (vai para o log, sem o e-mail);
 * null quando serve.
 */
export function recusaDeAdministrador(u: UsuarioDaSessao | null | undefined): string | null {
  if (!u) return "sem sessão";
  const email = normalizado(u.email);
  if (!email) return "sem e-mail";

  const confirmado = typeof u.email_confirmed_at === "string" ? Date.parse(u.email_confirmed_at) : Number.NaN;
  if (!Number.isFinite(confirmado)) return "e-mail não confirmado";

  const meta = u.app_metadata ?? {};
  // `provider` é o do primeiro acesso: a conta criada por e-mail e senha e depois ligada ao Google fica de fora.
  if (!doAdministrador(meta.provider)) return "a conta não nasceu pelo Google";
  if (Array.isArray(meta.providers) && !meta.providers.every(doAdministrador)) return "a conta tem outro provedor ligado";

  const identidades = Array.isArray(u.identities) ? u.identities : [];
  if (!identidades.every((i) => doAdministrador(i?.provider))) return "a conta tem outra identidade ligada";
  const emails = identidades.map((i) => normalizado(i?.identity_data?.email)).filter(Boolean);
  if (emails.length > 0 && !emails.includes(email)) return "o e-mail da conta não é o da identidade do Google";

  return null;
}

export function identidadeDeAdministrador(u: UsuarioDaSessao | null | undefined): boolean {
  return recusaDeAdministrador(u) === null;
}
