-- =============================================================================
-- oport_60 — Convite por e-mail para as salas que gravam (30/10/2026)
--
-- Pedido do titular: o Pablo só entra com o Google e já cai na sala, sem esperar alguém inseri-lo em `sala_membro`
-- depois do primeiro login. O convite fica guardado pelo e-mail (`sala_convite`, inserido pelo titular no SQL Editor);
-- quando a conta logada não é membro, a página chama `sala_aceitar_convite`, que:
--   - lê o e-mail da PRÓPRIA conta em auth.users (nunca um e-mail mandado pelo navegador);
--   - só aceita conta do Google com o e-mail confirmado (o Google garante a posse do endereço);
--   - cria a linha em `sala_membro` com o papel, o nome e a marca `so_sala` do convite (a trava da oport_59 continua:
--     conta só de sala já aprovada no portal é recusada), marca o convite como usado e grava o evento.
-- Sem convite, nada acontece e a página recusa como antes.
--
-- ORDEM: depois da oport_59; aplicar ANTES de o código chegar à `main`. Idempotente.
-- =============================================================================

create table if not exists public.sala_convite (
  sala       text not null,
  email      text not null check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  papel      text not null check (papel in ('cliente', 'ponte')),
  nome       text not null check (char_length(nome) between 1 and 80),
  so_sala    boolean not null default false,
  criado_em  timestamptz not null default now(),
  usado_em   timestamptz,
  usado_por  uuid,
  primary key (sala, email)
);

-- Ninguém da API lê ou grava convites (o e-mail não aparece na sala); só a função abaixo, e o titular pelo SQL Editor.
alter table public.sala_convite enable row level security;
revoke all on table public.sala_convite from public, anon, authenticated;
grant all on table public.sala_convite to service_role;

create or replace function public.sala_aceitar_convite(p_sala text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_provedor text;
  v_confirmado timestamptz;
  c public.sala_convite;
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.sala_eh_membro(p_sala) then
    return true;
  end if;
  select lower(u.email), u.raw_app_meta_data ->> 'provider', u.email_confirmed_at
    into v_email, v_provedor, v_confirmado
    from auth.users u where u.id = auth.uid();
  if v_email is null or v_provedor is distinct from 'google' or v_confirmado is null then
    return false;
  end if;
  select * into c from public.sala_convite where sala = p_sala and email = v_email and usado_em is null for update;
  if not found then
    return false;
  end if;
  insert into public.sala_membro (sala, user_id, papel, nome, so_sala)
  values (p_sala, auth.uid(), c.papel, c.nome, c.so_sala)
  on conflict (sala, user_id) do nothing;
  update public.sala_convite set usado_em = now(), usado_por = auth.uid() where sala = p_sala and email = v_email;
  insert into public.sala_evento (sala, quem, tipo, alvo, depois)
  values (p_sala, auth.uid(), 'entrou na sala pelo convite', 'membros/' || c.nome, jsonb_build_object('papel', c.papel));
  return true;
end;
$$;

revoke execute on function public.sala_aceitar_convite(text) from public, anon;
grant execute on function public.sala_aceitar_convite(text) to authenticated;

-- Os convites são DML do titular, à parte (o e-mail não entra no repositório nem no espelho):
--   insert into public.sala_convite (sala, email, papel, nome, so_sala) values
--     ('pablo', '<e-mail da PONTE>', 'ponte', 'Jonathan', false),
--     ('pablo', '<e-mail do Pablo>', 'cliente', 'Pablo', true)
--   on conflict (sala, email) do nothing;
