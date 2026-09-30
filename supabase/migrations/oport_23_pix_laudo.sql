-- =============================================================================
-- oport_23 — laudo do plano de ação das transferências especiais (Pix), onda 13A
--
-- Gravado pelo job `pix_fundo/` (laudo.py) na mesma execução `pix_` da oport_13:
--   · pix_laudo_plano:  um plano da UF da lista (PB) por linha, com o estado de cada item do
--                       roteiro (IN-TCU 93/2024, LC 210/2024, PC MF/MGI 15/2025, ADPF 854,
--                       CF art. 166-A) em `itens` e o pior nível para ordenar e filtrar;
--   · pix_laudo_autor:  os 70% em capital por autor e ano (LC 210, art. 10, XIX), somando as
--                       especiais do autor no Brasil, para os autores com plano na UF;
--   · pix_laudo_resumo: quantos planos (e quanto pago) em cada estado de cada item.
--
-- Pessoal e dívida (CF art. 166-A, §1º) não estão aqui: a página cruza com o TCE-PB
-- (tce_pix_municipio, oport_22) pelo cod_ibge.
--
-- Uso da PONTE: nada para anon ou authenticated; a página lê no servidor (administrador, ou o
-- cliente do próprio município). Sem pessoa física: pagamento a CPF entra só como soma, e o
-- autor da emenda entra com nome (agente público).
--
-- Grants explícitos (seguranca_1). Idempotente. Depende da oport_13 (pix_execucao).
-- =============================================================================

create table if not exists public.pix_laudo_plano (
  execucao_id       bigint not null references public.pix_execucao (id) on delete cascade,
  id_plano_acao     bigint not null,
  codigo_plano_acao text,
  ano               integer,
  beneficiario      text,
  cnpj              text,
  cod_ibge          text,
  autor             text,
  codigo_emenda     text,
  situacao          text,
  valor             numeric,
  custeio           numeric,
  investimento      numeric,
  pago              numeric,
  dt_primeira_ob    date,
  fim_execucao      date,
  limite_execucao   date,
  area              text,
  objeto            text,
  saldo             numeric,
  dt_saldo          date,
  pior              text check (pior is null or pior in ('critico', 'alto', 'moderado')),
  n_critico         integer not null default 0,
  n_alto            integer not null default 0,
  n_moderado        integer not null default 0,
  n_pendente        integer not null default 0,
  -- [{"item": "A4b", "titulo": ..., "dispositivo": ..., "estado": ..., "nivel": ..., "fato": ...}]
  itens             jsonb not null default '[]'::jsonb,
  versao            text,
  primary key (execucao_id, id_plano_acao)
);
create index if not exists pix_laudo_plano_cnpj_idx on public.pix_laudo_plano (execucao_id, cnpj);
create index if not exists pix_laudo_plano_ibge_idx on public.pix_laudo_plano (execucao_id, cod_ibge);

create table if not exists public.pix_laudo_autor (
  execucao_id        bigint not null references public.pix_execucao (id) on delete cascade,
  ano                integer not null,
  codigo_parlamentar bigint not null,
  autor              text,
  planos             integer not null default 0,
  valor              numeric not null default 0,
  investimento       numeric not null default 0,
  pct_capital        numeric,
  planos_uf          integer not null default 0,
  primary key (execucao_id, ano, codigo_parlamentar)
);

create table if not exists public.pix_laudo_resumo (
  execucao_id bigint not null references public.pix_execucao (id) on delete cascade,
  item        text not null,
  estado      text not null,
  nivel       text,
  planos      integer not null,
  valor       numeric not null default 0
);
create index if not exists pix_laudo_resumo_idx on public.pix_laudo_resumo (execucao_id, item);

do $$
declare t text;
begin
  foreach t in array array['pix_laudo_plano', 'pix_laudo_autor', 'pix_laudo_resumo'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- A limpeza em lotes passa a incluir as três tabelas (mesma assinatura da oport_13).
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
                           'pix_laudo_plano', 'pix_laudo_autor', 'pix_laudo_resumo'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.pix_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.pix_limpar(bigint, integer) to service_role;
