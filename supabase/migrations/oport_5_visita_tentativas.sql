-- =============================================================================
-- oport_5 — Carimbo de visita e registro de sincronizações
--
-- Duas frases que a tela já dizia e o banco não sustentava:
--
--   "desde a sua última visita"  → precisava de uma marca de quando a aba foi
--                                  aberta. Antes, a aproximação era "não lidas".
--   "a leitura falhou"           → precisava de um registro por tentativa. Antes,
--                                  falha de sincronização não deixava rastro
--                                  nenhum fora do log do servidor.
--
-- Idempotente. Pré-requisito: oport_3.
-- =============================================================================

alter table public.oport_acesso add column if not exists central_vista_em timestamptz;


create table if not exists public.oport_sincronizacao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  -- De onde veio: o cron diário ou a abertura da aba.
  origem       text not null check (origem in ('cron', 'aba')),
  resultado    text not null check (resultado in ('aplicada', 'sem_novidade', 'nao_ativada', 'erro')),
  publicacao   text,
  mudancas     integer,
  notificacoes integer,
  mensagem     text
);

create index if not exists oport_sincronizacao_idx on public.oport_sincronizacao (iniciada_em desc);

alter table public.oport_sincronizacao enable row level security;

revoke all on table public.oport_sincronizacao from anon, authenticated;
grant all on table public.oport_sincronizacao to service_role;
-- Quem está aprovado LÊ o histórico de tentativas: é dele a tela que precisa
-- dizer "tentamos às 13:31 e falhou". Ninguém escreve por fora da chave de serviço.
grant select on table public.oport_sincronizacao to authenticated;

drop policy if exists "sincronizacao: aprovados leem" on public.oport_sincronizacao;
create policy "sincronizacao: aprovados leem" on public.oport_sincronizacao
  for select to authenticated
  using ((select public.oport_aprovado()));


-- -----------------------------------------------------------------------------
-- Marca a visita e devolve a ANTERIOR — é a anterior que define onde a divisória
-- "desde a sua última visita" entra na lista.
--
-- Janela de 30 minutos: recarregar a página no meio da leitura não pode apagar a
-- divisória que a pessoa está usando para se orientar.
-- -----------------------------------------------------------------------------
create or replace function public.oport_registrar_visita(p_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_anterior timestamptz;
begin
  select central_vista_em into v_anterior from public.oport_acesso where id = p_id for update;

  if v_anterior is null or v_anterior < now() - interval '30 minutes' then
    update public.oport_acesso set central_vista_em = now() where id = p_id;
  end if;

  return v_anterior;
end $$;

revoke execute on function public.oport_registrar_visita(uuid) from public, anon, authenticated;
grant execute on function public.oport_registrar_visita(uuid) to service_role;
