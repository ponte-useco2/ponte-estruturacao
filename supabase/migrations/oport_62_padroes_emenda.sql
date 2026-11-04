-- oport_62: os dados dos padrões depois da emenda (P2, 03/11/2026). Só o que os jobs gravam; a tela é outra etapa.
--
--   · pix_favorecido: para quem cada plano do Pix pagou, pelo extrato. Só empresa, sem o próprio ente e sem órgão público.
--     n_planos_conta = 1 é ligação exata com o plano; acima de 1, o valor é rateio pela `fatia` do pago (conta dividida);
--   · tce_sus_cobertura, tce_sus_marcada, tce_sus_classe e tce_sus_credor: a despesa dos municípios nas fontes do SUS.
--     O CO de emenda não diz o autor, e marca só parte do dinheiro: ano não lido é "não verificado", nunca zero, e a despesa
--     sem CO não é "sem emenda". Pessoa física só somada (cnpj nulo); o histórico do empenho vira classe e não é guardado;
--   · sancao_universo_extra: as empresas do Pix e do SUS que o job de CEIS/CNEP consulta depois das do painel.
--
-- ORDEM: esta migração ANTES dos jobs chegarem à `main`. Leitura só pelo servidor, com a chave de serviço. Idempotente.

create table if not exists public.pix_favorecido (
  execucao_id    bigint not null references public.pix_execucao (id) on delete cascade,
  id_plano_acao  bigint not null,
  cnpj           text not null,
  nome           text,
  valor          numeric not null default 0,
  n_lancamentos  integer not null default 0,
  primeiro       date,
  ultimo         date,
  n_planos_conta integer not null default 1,
  fatia          numeric not null default 1,
  primary key (execucao_id, id_plano_acao, cnpj)
);
create index if not exists pix_favorecido_cnpj_idx on public.pix_favorecido (execucao_id, cnpj);

create table if not exists public.tce_sus_cobertura (
  execucao_id bigint not null references public.tce_execucao (id) on delete cascade,
  ibge        text not null,
  ano         integer not null,
  lido        boolean not null default false,
  primary key (execucao_id, ibge, ano)
);

create table if not exists public.tce_sus_marcada (
  execucao_id        bigint not null references public.tce_execucao (id) on delete cascade,
  ibge               text not null,
  ano                integer not null,
  ordem              integer not null,
  fonte              text not null,
  co                 text not null,
  grupo              text,
  elemento           text,
  classe             text not null,
  modalidade         text,
  cnpj               text,
  nome               text,
  pago               numeric,
  empenhado          numeric,
  n                  integer not null default 0,
  pago_com_licitacao numeric,
  primary key (execucao_id, ibge, ano, ordem)
);
create index if not exists tce_sus_marcada_cnpj_idx on public.tce_sus_marcada (execucao_id, cnpj) where cnpj is not null;

create table if not exists public.tce_sus_classe (
  execucao_id bigint not null references public.tce_execucao (id) on delete cascade,
  ibge        text not null,
  ano         integer not null,
  co          text not null default '',
  classe      text not null,
  grupo       text not null default '',
  pago        numeric,
  empenhado   numeric,
  n           integer not null default 0,
  primary key (execucao_id, ibge, ano, co, classe, grupo)
);

create table if not exists public.tce_sus_credor (
  execucao_id bigint not null references public.tce_execucao (id) on delete cascade,
  ibge        text not null,
  ano         integer not null,
  cnpj        text not null,
  nome        text,
  pago        numeric not null default 0,
  marcado     numeric not null default 0,
  n           integer not null default 0,
  primary key (execucao_id, ibge, ano, cnpj)
);
create index if not exists tce_sus_credor_cnpj_idx on public.tce_sus_credor (execucao_id, cnpj);

do $$
declare t text;
begin
  foreach t in array array['pix_favorecido', 'tce_sus_cobertura', 'tce_sus_marcada', 'tce_sus_classe', 'tce_sus_credor'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- As tabelas novas entram na limpeza de cada família, em lotes, como as outras.
create or replace function public.pix_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.pix_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.pix_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['pix_especial_ano', 'pix_especial_motivo', 'pix_especial_plano',
                           'pix_fundo_ano', 'pix_fundo_relatorio', 'pix_fundo_plano',
                           'pix_laudo_plano', 'pix_laudo_autor', 'pix_laudo_resumo', 'pix_favorecido'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

create or replace function public.tce_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.tce_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.tce_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['tce_cobertura', 'tce_pix_municipio', 'tce_pix_credor', 'tce_federal_par', 'tce_federal_municipio',
                           'tce_estado_cobertura', 'tce_estado_receita', 'tce_estado_despesa',
                           'tce_sus_cobertura', 'tce_sus_marcada', 'tce_sus_classe', 'tce_sus_credor'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

-- A lista extra do CEIS/CNEP: um CNPJ por linha, do maior valor para o menor. O painel fica de fora no job.
create or replace function public.sancao_universo_extra(p_piso numeric default 5000)
returns table (cnpj text, valor numeric)
language sql
stable
set search_path to 'public'
as $$
  with px as (select id from public.pix_ultima_execucao()),
       tc as (select id from public.tce_ultima_execucao()),
       u as (
         select f.cnpj, f.valor from public.pix_favorecido f, px where f.execucao_id = px.id
         union all
         select c.cnpj, c.pago from public.tce_pix_credor c, tc where c.execucao_id = tc.id
         union all
         select s.cnpj, s.pago from public.tce_sus_credor s, tc where s.execucao_id = tc.id
       )
  select u.cnpj, sum(u.valor) from u group by u.cnpj
  having sum(u.valor) >= coalesce(p_piso, 0)
  order by 2 desc, 1
$$;

revoke execute on function public.pix_limpar(bigint, integer) from public, anon, authenticated;
revoke execute on function public.tce_limpar(bigint, integer) from public, anon, authenticated;
revoke execute on function public.sancao_universo_extra(numeric) from public, anon, authenticated;
grant  execute on function public.pix_limpar(bigint, integer) to service_role;
grant  execute on function public.tce_limpar(bigint, integer) to service_role;
grant  execute on function public.sancao_universo_extra(numeric) to service_role;
