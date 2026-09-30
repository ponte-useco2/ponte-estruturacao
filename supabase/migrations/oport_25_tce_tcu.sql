-- =============================================================================
-- oport_25 — Tomada de Contas Especial dos convênios da PB, pelo e-TCE do TCU (onda 13C)
--
-- A API pública do e-TCE (`tce.apps.tcu.gov.br/api/publico/tces?numeroSiafiSiconv=`) é a que a página
-- "Consultar TCE Instaurada no e-TCE" do Acesso Livre chama no navegador: uma consulta por convênio. A aba
-- "TCE" do convênio no Transferegov fica vazia mesmo quando há TCE, porque a TCE hoje corre no e-TCE.
-- O job `tce_tcu` (semanal, `tce-tcu.yml`) consulta os convênios assinados da PB da última execução do
-- painel, menos anulados e cancelados.
--
--   · tcu_execucao e as funções tcu_ultima_execucao / tcu_concluir / tcu_limpar (o desenho da oport_22);
--   · tcu_consulta: a cobertura — cada convênio consultado, quantas TCE, ou o erro. É o que permite dizer
--     "consultado em DD/MM: nenhuma TCE" em vez de só "não há linha";
--   · tcu_tce: uma linha por TCE que não esteja "Excluída": motivo, débito, processo e acórdão.
--
-- Privacidade: a resposta da API não traz nome nem CPF de responsável, e o job não grava nada disso.
-- ORDEM: esta migração ANTES do job chegar à `main`. Leitura só pelo servidor, com a chave de serviço
-- (grants explícitos). Aditiva e idempotente.
-- =============================================================================

create table if not exists public.tcu_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- A hora da consulta (a API responde o estado do dia).
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists tcu_execucao_concluida_idx on public.tcu_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.tcu_consulta (
  execucao_id       bigint not null references public.tcu_execucao (id) on delete cascade,
  nr_convenio       text not null,
  situacao_convenio text,
  cod_ibge          text,
  -- null quando a consulta falhou ou não coube na rodada (o motivo em `erro`).
  n_tce             integer,
  erro              text,
  primary key (execucao_id, nr_convenio)
);

create table if not exists public.tcu_tce (
  execucao_id              bigint not null references public.tcu_execucao (id) on delete cascade,
  nr_convenio              text not null,
  codigo                   bigint,
  numero                   text,
  ano                      integer,
  situacao                 text,
  origem_recursos          text,
  motivo                   text,
  submotivo                text,
  iniciativa               text,
  dt_instauracao           date,
  dt_inicio_prazo          date,
  dt_prestacao_contas      date,
  dt_atualizacao_debito    date,
  debito_original          numeric,
  debito_sem_juros         numeric,
  debito_com_juros         numeric,
  numero_processo          text,
  url_processo             text,
  numero_acordao           text,
  origem_acordao           text,
  parecer_controle_interno text,
  analise_boa_fe           boolean
);
create index if not exists tcu_tce_convenio_idx on public.tcu_tce (execucao_id, nr_convenio);

do $$
declare
  t text;
begin
  foreach t in array array['tcu_execucao', 'tcu_consulta', 'tcu_tce'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.tcu_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.tcu_execucao_id_seq to service_role;

create or replace function public.tcu_ultima_execucao()
returns setof public.tcu_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.tcu_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.tcu_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.tcu_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter. Devolve quantas apagou;
-- 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como histórico.
create or replace function public.tcu_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.tcu_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.tcu_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['tcu_consulta', 'tcu_tce'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.tcu_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.tcu_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.tcu_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.tcu_ultima_execucao()                    to service_role;
grant  execute on function public.tcu_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.tcu_limpar(bigint, integer)               to service_role;
