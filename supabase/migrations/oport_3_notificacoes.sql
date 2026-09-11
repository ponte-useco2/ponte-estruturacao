-- =============================================================================
-- oport_3 — Central de notificações (aba Mapa de Oportunidades)
--
-- Idempotente. Pré-requisito: oport_1 aplicado (usa oport_acesso).
--
-- Quatro tabelas, e o motivo de cada uma existir:
--   oport_publicacao   uma linha por publicação processada. `gerado_em` único é
--                      a trava contra processar a mesma publicação duas vezes.
--   oport_estado       o EstadoProcessado de lib/oportunidades/diff.ts: o que o
--                      sistema viu por último. Uma linha só.
--   oport_mudanca      o fato global: o que mudou, sem dono.
--   oport_notificacao  a mudança como chegou a cada pessoa, com lida e arquivada.
-- =============================================================================

create table if not exists public.oport_publicacao (
  id            bigint generated always as identity primary key,
  -- Texto, como o radar grava: sem fuso, em UTC. O diff compara como string, e
  -- converter aqui abriria espaço para duas representações do mesmo instante.
  gerado_em     text not null unique,
  processada_em timestamptz not null default now(),
  total_abertas integer not null,
  linha_de_base boolean not null default false,
  suspeita      text
);

create table if not exists public.oport_estado (
  id            smallint primary key default 1 check (id = 1),
  gerado_em     text not null,
  abertas       jsonb not null,
  saidas        jsonb not null,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.oport_mudanca (
  id            bigint generated always as identity primary key,
  publicacao_id bigint not null references public.oport_publicacao (id) on delete cascade,
  tipo          text not null check (tipo in
                  ('nova', 'reaberta', 'prazo_alterado', 'fechando', 'situacao_mudou', 'encerrada', 'removida')),
  chave         text not null,
  programa      text not null,
  orgao         text not null,
  fecha         text not null,
  limiar        smallint,
  antes         text,
  depois        text,
  criado_em     timestamptz not null default now()
);

-- "Três avisos, não vinte e um": a mesma marca de prazo, para a mesma janela e o
-- mesmo prazo, existe uma vez só — mesmo que a gravação rode de novo.
create unique index if not exists oport_mudanca_fechando_uniq
  on public.oport_mudanca (chave, limiar, fecha) where tipo = 'fechando';
create unique index if not exists oport_mudanca_demais_uniq
  on public.oport_mudanca (publicacao_id, chave, tipo) where tipo <> 'fechando';

create table if not exists public.oport_notificacao (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  mudanca_id   bigint not null references public.oport_mudanca (id) on delete cascade,
  criado_em    timestamptz not null default now(),
  lida_em      timestamptz,
  arquivada_em timestamptz,
  unique (user_id, mudanca_id)
);

create index if not exists oport_notificacao_user_idx
  on public.oport_notificacao (user_id, criado_em desc);
create index if not exists oport_notificacao_nao_lidas_idx
  on public.oport_notificacao (user_id) where lida_em is null and arquivada_em is null;


-- -----------------------------------------------------------------------------
-- Quem está aprovado. `security definer` porque o status não está no JWT, e a
-- política precisa lê-lo sem esbarrar na RLS de oport_acesso. Só revela o status
-- de quem pergunta.
-- -----------------------------------------------------------------------------
create or replace function public.oport_aprovado()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.oport_acesso where id = auth.uid() and status = 'aprovado');
$$;

revoke execute on function public.oport_aprovado() from public, anon;
grant execute on function public.oport_aprovado() to authenticated;


-- -----------------------------------------------------------------------------
-- RLS e permissões. Começa fechado e abre só o necessário.
-- -----------------------------------------------------------------------------
alter table public.oport_publicacao  enable row level security;
alter table public.oport_estado      enable row level security;
alter table public.oport_mudanca     enable row level security;
alter table public.oport_notificacao enable row level security;

revoke all on table public.oport_publicacao, public.oport_estado, public.oport_mudanca, public.oport_notificacao
  from anon, authenticated;

-- A service role lê o estado e grava pela função. No Supabase ela já recebe tudo
-- por padrão; fica escrito para o arquivo não depender dessa configuração.
grant all on table public.oport_publicacao, public.oport_estado, public.oport_mudanca, public.oport_notificacao
  to service_role;

grant select on table public.oport_publicacao, public.oport_mudanca, public.oport_notificacao to authenticated;
-- Só as duas marcações. Nenhum usuário cria, apaga nem reescreve notificação.
grant update (lida_em, arquivada_em) on table public.oport_notificacao to authenticated;

drop policy if exists "publicacao: aprovados leem" on public.oport_publicacao;
create policy "publicacao: aprovados leem" on public.oport_publicacao
  for select to authenticated using ((select public.oport_aprovado()));

drop policy if exists "mudanca: aprovados leem" on public.oport_mudanca;
create policy "mudanca: aprovados leem" on public.oport_mudanca
  for select to authenticated using ((select public.oport_aprovado()));

drop policy if exists "notificacao: le as proprias" on public.oport_notificacao;
create policy "notificacao: le as proprias" on public.oport_notificacao
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()));

drop policy if exists "notificacao: marca as proprias" on public.oport_notificacao;
create policy "notificacao: marca as proprias" on public.oport_notificacao
  for update to authenticated
  using ((select auth.uid()) = user_id and (select public.oport_aprovado()))
  with check ((select auth.uid()) = user_id);

-- oport_estado fica sem política: só a service role, que ignora RLS.


-- -----------------------------------------------------------------------------
-- Gravação atômica de uma publicação. O supabase-js não tem transação; a função
-- tem. Chamada por lib/oportunidades/sincronizar.server.ts, com a chave de serviço.
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
  -- Trava otimista: se outro processo avançou o estado depois da leitura, não
  -- sobrescreve o trabalho dele.
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

  insert into oport_mudanca (publicacao_id, tipo, chave, programa, orgao, fecha, limiar, antes, depois)
  select v_publicacao, m ->> 'tipo', m ->> 'chave', m ->> 'programa', m ->> 'orgao', m ->> 'fecha',
         (m ->> 'limiar')::smallint, m ->> 'antes', m ->> 'depois'
  from jsonb_array_elements(coalesce(p_mudancas, '[]'::jsonb)) as m
  on conflict do nothing;
  get diagnostics v_mudancas = row_count;

  -- Distribui para quem está aprovado AGORA. Ficam fora:
  --   encerrada  desligada por padrão no brief (§4.1) — sinal de parar, não de agir;
  --   removida   janela que saiu antes do prazo é cancelamento ou dado quebrado,
  --              e não pode virar alarme para todo mundo antes de alguém olhar.
  --              Fica registrada em oport_mudanca para revisão.
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

-- Só a service role. Esta função distribui notificação para todo mundo.
revoke execute on function public.oport_aplicar_publicacao(text, integer, boolean, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.oport_aplicar_publicacao(text, integer, boolean, text, jsonb, jsonb, text)
  to service_role;
