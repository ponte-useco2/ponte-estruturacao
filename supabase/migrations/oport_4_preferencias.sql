-- =============================================================================
-- oport_4 — Preferências de acompanhamento (o destaque "aderente")
--
-- Decisão de 11/09/2026, em docs/superpowers/specs/aderente-decisao-privacidade.md:
-- a pessoa marca na própria aba o que prefere acompanhar, e a escolha serve só
-- para destacar janelas PARA ELA. Nada vem marcado, desmarcar apaga, e nada é
-- deduzido do uso.
--
-- Três mudanças:
--   1. `oport_mudanca` passa a carregar os eixos da janela (temas, natureza,
--      canal). A aderência é calculada na leitura, e a janela pode já ter saído
--      do catálogo quando alguém abrir a central.
--   2. `oport_preferencia`: uma linha por pessoa, só dela.
--   3. `oport_esquecer` passa a apagar preferências e avisos, para cumprir o
--      que o aviso de privacidade promete.
--
-- Idempotente. Pré-requisito: oport_3.
-- =============================================================================

alter table public.oport_mudanca add column if not exists temas    text[] not null default '{}'::text[];
alter table public.oport_mudanca add column if not exists natureza text;
alter table public.oport_mudanca add column if not exists canal    text;


create table if not exists public.oport_preferencia (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  -- Ids estáveis de src/lib/oportunidades/temas.ts, nunca os radicais do radar:
  -- "inovacao", não "inovaç". Radical é dado interno e muda com o motor.
  temas         text[] not null default '{}'::text[],
  orgaos        text[] not null default '{}'::text[],
  naturezas     text[] not null default '{}'::text[],
  atualizado_em timestamptz not null default now()
);

alter table public.oport_preferencia enable row level security;

revoke all on table public.oport_preferencia from anon, authenticated;
grant all on table public.oport_preferencia to service_role;
-- A pessoa cria, lê, muda e apaga a PRÓPRIA linha. Desmarcar tudo apaga a linha,
-- e é por isso que o delete está aqui: a promessa é "desmarcar apaga", não
-- "desmarcar esconde".
grant select, insert, update, delete on table public.oport_preferencia to authenticated;

drop policy if exists "preferencia: le a propria" on public.oport_preferencia;
create policy "preferencia: le a propria" on public.oport_preferencia
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()));

drop policy if exists "preferencia: cria a propria" on public.oport_preferencia;
create policy "preferencia: cria a propria" on public.oport_preferencia
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.oport_aprovado()));

drop policy if exists "preferencia: muda a propria" on public.oport_preferencia;
create policy "preferencia: muda a propria" on public.oport_preferencia
  for update to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()))
  with check ((select auth.uid()) = user_id);

-- Apagar não exige aprovação: quem foi bloqueado depois de escolher ainda pode
-- retirar a escolha. Revogar consentimento nunca depende de permissão.
drop policy if exists "preferencia: apaga a propria" on public.oport_preferencia;
create policy "preferencia: apaga a propria" on public.oport_preferencia
  for delete to authenticated
  using ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- A gravação da publicação passa a levar os eixos de cada janela. Resto idêntico
-- ao de oport_3.
-- -----------------------------------------------------------------------------
create or replace function public.oport_aplicar_publicacao(
  p_gerado_em                 text,
  p_total_abertas             integer,
  p_linha_de_base             boolean,
  p_suspeita                  text,
  p_mudancas                  jsonb,
  p_estado                    jsonb,
  p_estado_anterior_gerado_em text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_publicacao   bigint;
  v_atual        text;
  v_mudancas     integer := 0;
  v_notificacoes integer := 0;
begin
  select gerado_em into v_atual from oport_estado where id = 1 for update;
  if v_atual is distinct from p_estado_anterior_gerado_em then
    return jsonb_build_object('aplicada', false, 'motivo', 'estado mudou desde a leitura');
  end if;

  insert into oport_publicacao (gerado_em, total_abertas, linha_de_base, suspeita)
  values (p_gerado_em, p_total_abertas, p_linha_de_base, p_suspeita)
  on conflict (gerado_em) do nothing
  returning id into v_publicacao;

  if v_publicacao is null then
    return jsonb_build_object('aplicada', false, 'motivo', 'publicação já processada');
  end if;

  insert into oport_mudanca (publicacao_id, tipo, chave, programa, orgao, fecha, limiar, antes, depois,
                             temas, natureza, canal)
  select v_publicacao, m ->> 'tipo', m ->> 'chave', m ->> 'programa', m ->> 'orgao', m ->> 'fecha',
         (m ->> 'limiar')::smallint, m ->> 'antes', m ->> 'depois',
         coalesce(
           (select array_agg(t) from jsonb_array_elements_text(coalesce(m -> 'temas', '[]'::jsonb)) as t),
           '{}'::text[]
         ),
         m ->> 'natureza', m ->> 'canal'
  from jsonb_array_elements(coalesce(p_mudancas, '[]'::jsonb)) as m
  on conflict do nothing;
  get diagnostics v_mudancas = row_count;

  insert into oport_notificacao (user_id, mudanca_id)
  select a.id, mu.id
  from oport_mudanca mu
  cross join oport_acesso a
  where mu.publicacao_id = v_publicacao
    and mu.tipo not in ('encerrada', 'removida')
    and a.status = 'aprovado'
  on conflict do nothing;
  get diagnostics v_notificacoes = row_count;

  insert into oport_estado (id, gerado_em, abertas, saidas)
  values (1, p_estado ->> 'gerado_em', p_estado -> 'abertas', p_estado -> 'saidas')
  on conflict (id) do update
    set gerado_em = excluded.gerado_em,
        abertas = excluded.abertas,
        saidas = excluded.saidas,
        atualizado_em = now();

  return jsonb_build_object(
    'aplicada', true,
    'publicacao_id', v_publicacao,
    'mudancas', v_mudancas,
    'notificacoes', v_notificacoes
  );
end $$;

revoke execute on function public.oport_aplicar_publicacao(text, integer, boolean, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.oport_aplicar_publicacao(text, integer, boolean, text, jsonb, jsonb, text)
  to service_role;


-- -----------------------------------------------------------------------------
-- Direito ao esquecimento (LGPD). Antes apagava registro de uso e linha de
-- acesso; agora apaga também as preferências e os avisos, que são dado pessoal
-- ligado à conta. O que continua fora: a conta em auth.users, que é apagada no
-- painel do Supabase — a chave estrangeira leva o resto junto.
-- -----------------------------------------------------------------------------
create or replace function public.oport_esquecer(p_email text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n     integer;
  v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.oport_acesso where email = p_email;

  delete from public.oport_evento where email = p_email;
  get diagnostics n = row_count;

  if v_ids is not null then
    delete from public.oport_notificacao where user_id = any(v_ids);
    delete from public.oport_preferencia where user_id = any(v_ids);
  end if;

  delete from public.oport_acesso where email = p_email;
  return n;
end $function$;

revoke execute on function public.oport_esquecer(text) from public, anon, authenticated;
