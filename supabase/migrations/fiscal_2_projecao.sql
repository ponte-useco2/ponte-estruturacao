-- =============================================================================
-- fiscal_2 — Projeção da dívida para o simulador de operação de crédito (onda 9)
--
-- `fiscal_projecao`: ano a ano, o serviço da dívida e as liberações do cronograma do PVL de
-- referência de cada município (o pedido mais recente dos últimos 5 anos no SADIPEM):
--   · servico_demais:    amortização e encargos da dívida consolidada e das operações contratadas;
--   · servico_pleiteada: da operação pedida, só enquanto o pedido está em curso;
--   · liberacoes:        desembolsos previstos de todas as operações, sem ARO.
-- Na PB, em 16/09/2026, só 6 municípios tinham pedido nesse prazo. Para os outros, o simulador
-- parte do empenhado em juros e amortização no último exercício (fiscal_municipio.indicadores).
--
-- Uso EXCLUSIVO da PONTE, como o resto do painel fiscal. `fiscal_limpar` passa a apagar também
-- esta tabela. Grants explícitos. Idempotente. Pré-requisito: fiscal_1.
-- =============================================================================

create table if not exists public.fiscal_projecao (
  execucao_id       bigint not null references public.fiscal_execucao (id) on delete cascade,
  ibge              text not null check (ibge ~ '^25[0-9]{5}$'),
  id_pleito         bigint,
  ano               integer not null check (ano between 1990 and 2100),
  servico_demais    numeric not null default 0,
  servico_pleiteada numeric not null default 0,
  liberacoes        numeric not null default 0,
  primary key (execucao_id, ibge, ano)
);

alter table public.fiscal_projecao enable row level security;
revoke all on table public.fiscal_projecao from anon, authenticated;
grant all on table public.fiscal_projecao to service_role;

create or replace function public.fiscal_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.fiscal_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.fiscal_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['fiscal_verificacao', 'fiscal_fonte', 'fiscal_projecao', 'fiscal_municipio'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.fiscal_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.fiscal_limpar(bigint, integer) to service_role;
