-- =============================================================================
-- oport_48 — Primeira infância: SIOPE e FNS no job `fnas/`, e a classe do plano do Pix
-- (primeira infância, P1, 22/10/2026; plano em Site-Ponte/primeira-infancia/PLANO.md)
--
-- O job `fnas/` (o `fnas.yml`, diário, no runner da máquina do titular; oport_47) passa a ler também:
--   · o SIOPE (FNDE, OData aberto): indicadores de FUNDEB e educação infantil e o saldo do salário-educação, por
--     município, no 6º bimestre dos dois últimos anos fechados → `fnas_siope`;
--   · a consulta pública de contas do FNS: o saldo das contas dos fundos de saúde da PB, SOMADO NA CHEGADA por
--     entidade e grupo de conta (custeio, investimento, emenda, outras). Banco, agência e conta não são gravados:
--     não há coluna para isso → `fnas_saude_saldo`.
-- Se uma dessas fontes falhar, a rodada repete as linhas dela da execução anterior (`contagens.fnas_herdado`).
--
-- E o job do Pix (`pix-fundo.yml`) passa a gravar `pix_laudo_plano.primeira_infancia`: 'exclusivo' quando o objeto do
-- plano é só creche, pré-escola ou educação infantil; 'misto' quando cita a primeira infância junto com outras obras
-- (o saldo da conta do plano não é só dela); nulo quando não cita.
--
-- Acesso: o de sempre, pelo servidor; RLS ligada sem política, grants só para `service_role`.
-- ORDEM: esta migração ANTES das rodadas com o código novo (o job grava colunas e tabelas que só existem aqui).
-- Aditiva e idempotente. Pré-requisito: oport_47 (fnas_execucao) e oport_23 (pix_laudo_plano).
-- =============================================================================

create table if not exists public.fnas_siope (
  execucao_id bigint not null references public.fnas_execucao (id) on delete cascade,
  ibge        text not null check (ibge ~ '^\d{7}$'),
  ano         integer not null,
  -- 'indicador' (Indicadores_Siope: 1.4, 1.6, 1.7, 2.1, 2.4, 4.1, 4.15, 7.2, 7.3) ou 'complementar'
  -- (Informacoes_Complementares_Siope: 11 = saldo do FUNDEB no fim do ano anterior; 166 = saldo do salário-educação).
  tipo        text not null check (tipo in ('indicador', 'complementar')),
  codigo      text not null,
  valor       numeric not null,
  primary key (execucao_id, ibge, ano, tipo, codigo)
);
create index if not exists fnas_siope_codigo_idx on public.fnas_siope (execucao_id, ano, codigo);

create table if not exists public.fnas_saude_saldo (
  execucao_id bigint not null references public.fnas_execucao (id) on delete cascade,
  cnpj        text not null check (cnpj ~ '^\d{14}$'),
  ibge        text check (ibge is null or ibge ~ '^\d{7}$'),
  entidade    text,
  estadual    boolean not null default false,
  grupo       text not null check (grupo in ('custeio', 'investimento', 'emenda', 'outras')),
  contas      integer not null default 0,
  saldo       numeric not null default 0,
  -- A data de atualização do saldo no FNS (mensal).
  data_saldo  date,
  primary key (execucao_id, cnpj, grupo)
);
create index if not exists fnas_saude_saldo_ibge_idx on public.fnas_saude_saldo (execucao_id, ibge);

do $$
declare
  t text;
begin
  foreach t in array array['fnas_siope', 'fnas_saude_saldo'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

alter table public.pix_laudo_plano add column if not exists primeira_infancia text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pix_laudo_plano_primeira_infancia_check') then
    alter table public.pix_laudo_plano
      add constraint pix_laudo_plano_primeira_infancia_check check (primeira_infancia in ('exclusivo', 'misto'));
  end if;
end $$;

-- A limpeza passa a apagar também as duas tabelas novas (o resto igual à oport_47).
create or replace function public.fnas_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.fnas_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.fnas_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['fnas_saldo', 'fnas_repasse', 'fnas_emenda', 'fnas_siope', 'fnas_saude_saldo', 'fnas_entidade'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.fnas_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.fnas_limpar(bigint, integer) to service_role;
