-- =============================================================================
-- oport_42 — O dinheiro do Estado no TCE-PB: o que cada município registrou como recebido e o que gastou com fonte
-- estadual (emendas estaduais, E3, 16/10/2026)
--
-- O job `tce_federal/` (no `radar-propostas.yml`, diário, na mesma execução `tce_*` da oport_22) passa a ler também os
-- arquivos de RECEITAS do TCE-PB (`dados-por-municipio/<código>/receitas/receitas-<ano>.zip`) e a parte estadual das
-- DESPESAS. Medido em 8 municípios (2025, estudo de 16/10/2026):
--   · as fontes do Estado são 701 (convênios), 710 (transferência especial dos Estados, o "Pix estadual"), 571 e 576
--     (educação), 621 e 632 (saúde) e 661 (assistência); o CO 3210 marca a emenda parlamentar individual estadual;
--   · o principal recebido com o CO 3210 fechou EXATO com o que o Estado pagou a prefeitura e fundos (emendas estaduais,
--     `epb_destino`) em 7 dos 8 municípios; o oitavo registrou R$ 400 mil a menos. A emenda paga no fim do ano entra
--     como receita do ano seguinte (Bayeux recebeu em janeiro de 2025 a de 2024).
--
--   · tce_estado_cobertura: se a receita e a parte estadual da despesa de cada município e ano foram lidas. Não lido é
--     "não verificado" na tela, nunca zero;
--   · tce_estado_receita: o recebido por fonte estadual, CO e tipo (principal, rendimento da conta, dedução);
--   · tce_estado_despesa: o gasto com fonte estadual, por fonte, CO e grupo de natureza (4 e 5 = capital). Sem credor.
--
-- Nenhuma pessoa: a receita não tem credor, e a despesa estadual vai só agregada.
--
-- Acesso: SÓ ADMINISTRADOR. RLS ligada sem política, grants só para `service_role`. A `tce_limpar` passa a apagar as
-- três tabelas novas, em lotes.
--
-- ORDEM: esta migração ANTES do job chegar à `main` — sem as tabelas, a gravação do TCE-PB inteira falharia, e o
-- retrato federal anterior ficaria no ar. Aditiva e idempotente. Pré-requisito: oport_22.
-- =============================================================================

create table if not exists public.tce_estado_cobertura (
  execucao_id    bigint not null references public.tce_execucao (id) on delete cascade,
  ibge           text not null check (ibge ~ '^\d{7}$'),
  ano            integer not null,
  receitas_lidas boolean not null,
  despesas_lidas boolean not null,
  motivo         text,
  primary key (execucao_id, ibge, ano)
);

create table if not exists public.tce_estado_receita (
  execucao_id bigint not null references public.tce_execucao (id) on delete cascade,
  ibge        text not null check (ibge ~ '^\d{7}$'),
  ano         integer not null,
  fonte       text not null,
  -- Só o código numérico (3210 = emenda individual estadual); "Não aplicável" vira vazio.
  co          text check (co is null or co ~ '^\d+$'),
  tipo        text not null check (tipo in ('principal', 'rendimento', 'deducao')),
  valor       numeric not null,
  n           integer not null default 0
);
create unique index if not exists tce_estado_receita_chave_idx
  on public.tce_estado_receita (execucao_id, ibge, ano, fonte, co, tipo) nulls not distinct;

create table if not exists public.tce_estado_despesa (
  execucao_id bigint not null references public.tce_execucao (id) on delete cascade,
  ibge        text not null check (ibge ~ '^\d{7}$'),
  ano         integer not null,
  fonte       text not null,
  co          text check (co is null or co ~ '^\d+$'),
  -- O grupo de natureza da despesa: 1 pessoal, 2 juros, 3 correntes, 4 investimentos, 5 inversões, 6 amortização.
  grupo       text,
  empenhado   numeric,
  liquidado   numeric,
  pago        numeric,
  n           integer not null default 0
);
create unique index if not exists tce_estado_despesa_chave_idx
  on public.tce_estado_despesa (execucao_id, ibge, ano, fonte, co, grupo) nulls not distinct;

do $$
declare t text;
begin
  foreach t in array array['tce_estado_cobertura', 'tce_estado_receita', 'tce_estado_despesa'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- A limpeza da oport_22 com as três tabelas novas (o resto igual).
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
                           'tce_estado_cobertura', 'tce_estado_receita', 'tce_estado_despesa'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.tce_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.tce_limpar(bigint, integer) to service_role;
