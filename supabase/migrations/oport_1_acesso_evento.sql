-- =============================================================================
-- oport_1 — Acesso e registro de uso da /oportunidades: ESQUEMA EXPORTADO
--
-- Estas tabelas estão em produção desde setembro de 2026, mas nunca tiveram
-- migration no repositório: foram criadas direto no SQL Editor. Este arquivo foi
-- escrito a partir do esquema LIDO no banco em 11/09/2026 — colunas, restrições,
-- índices, política, funções e a permissão de execução de cada uma — para que o
-- repositório volte a descrever o que roda.
--
-- Idempotente e SEM MUDANÇA DE COMPORTAMENTO: sobre o banco atual, não altera
-- nada. Num banco novo, reproduz fielmente o de produção — inclusive a fraqueza
-- corrigida em oport_2_endurecimento.sql, que fica separado de propósito:
-- registrar o que existe e mudar a segurança não cabem no mesmo passo.
--
-- Ordem: 1 → 2 → 3.
-- =============================================================================

create table if not exists public.oport_acesso (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  nome          text,
  avatar_url    text,
  status        text not null default 'pendente'
                  check (status in ('pendente', 'aprovado', 'bloqueado')),
  origem        text,
  observacao    text,
  solicitado_em timestamptz not null default now(),
  decidido_em   timestamptz,
  decidido_por  text,
  ultimo_acesso timestamptz
);

create index if not exists oport_acesso_status_idx
  on public.oport_acesso (status, solicitado_em desc);

alter table public.oport_acesso enable row level security;

-- Criada só se faltar: recriar a política abriria um instante sem ela.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'oport_acesso' and policyname = 'acesso: le a propria linha'
  ) then
    create policy "acesso: le a propria linha" on public.oport_acesso
      for select to authenticated using (auth.uid() = id);
  end if;
end $$;


create table if not exists public.oport_evento (
  id        bigserial primary key,
  user_id   uuid references auth.users (id) on delete set null,
  email     text,
  tipo      text not null,
  detalhe   jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists oport_evento_user_idx on public.oport_evento (user_id, criado_em desc);
create index if not exists oport_evento_tipo_idx on public.oport_evento (tipo, criado_em desc);

-- RLS ligada e SEM política, de propósito: só a service role lê e grava.
alter table public.oport_evento enable row level security;


-- Registra ou atualiza quem entrou, e devolve o status. Nunca promove ninguém:
-- o `on conflict` não toca em `status`.
create or replace function public.oport_registrar_solicitacao(p_id uuid, p_email text, p_nome text, p_avatar text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_status text;
begin
  insert into public.oport_acesso (id, email, nome, avatar_url)
  values (p_id, p_email, p_nome, p_avatar)
  on conflict (id) do update
    set email = excluded.email,
        nome = coalesce(excluded.nome, oport_acesso.nome),
        avatar_url = coalesce(excluded.avatar_url, oport_acesso.avatar_url),
        ultimo_acesso = now()
  returning status into v_status;
  return v_status;
end $function$;

-- Direito ao esquecimento (LGPD): apaga eventos e acesso de um e-mail.
create or replace function public.oport_esquecer(p_email text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  delete from public.oport_evento where email = p_email;
  get diagnostics n = row_count;
  delete from public.oport_acesso where email = p_email;
  return n;
end $function$;

-- Em produção, `oport_esquecer` NÃO é executável por anon nem por authenticated.
-- Num banco novo o Supabase concede execução por padrão — então a revogação
-- precisa estar escrita, ou o ambiente novo nasceria menos seguro que o de produção.
revoke execute on function public.oport_esquecer(text) from public, anon, authenticated;
