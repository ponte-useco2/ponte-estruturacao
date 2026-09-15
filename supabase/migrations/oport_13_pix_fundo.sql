-- =============================================================================
-- oport_13 — Pix (transferências especiais) e fundo a fundo
--
-- Retrato semanal das APIs novas do Transferegov, gravado pelo job `pix_fundo/` do
-- monorepo com a chave de serviço, no mesmo fluxo em três tempos do painel:
--   pix_execucao (gravando) → linhas por execução → pix_concluir → pix_limpar em lotes.
--
--   · pix_especial_ano:     Brasil ('BR') e cada UF × ano do plano: tamanho, funil,
--                           impedidos, duplicados de ciclo, lacuna de relatório;
--   · pix_especial_motivo:  impedidos por motivo e reapresentação no mesmo exercício;
--   · pix_especial_plano:   os planos da UF da lista (PB), um por linha;
--   · pix_fundo_ano:        Brasil e UF × ano do programa × órgão: repasse e saldo;
--   · pix_fundo_relatorio:  situação do último relatório de gestão dos planos em execução;
--   · pix_fundo_plano:      os planos da UF da lista, com o extrato resumido.
--
-- Uso EXCLUSIVO da PONTE: nada acessível a anon ou authenticated; a página lê no
-- servidor, depois de conferir que o e-mail é de administrador. Sem nome de pessoa,
-- documento de favorecido ou número de conta.
--
-- Grants explícitos (seguranca_1). Idempotente. Independe das anteriores.
-- =============================================================================

create table if not exists public.pix_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- A data mais recente dos dois módulos. Cada um guarda a sua em contagens
  -- (especiais_dado_ate, especiais_ultimo_pagamento, fundo_dado_ate).
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists pix_execucao_concluida_idx on public.pix_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.pix_especial_ano (
  execucao_id                bigint not null references public.pix_execucao (id) on delete cascade,
  recorte                    text not null,
  ano                        integer,
  planos                     integer not null,
  indicado                   numeric not null default 0,
  nao_impedido               numeric not null default 0,
  impedidos                  integer not null default 0,
  valor_impedido             numeric not null default 0,
  duplicados                 integer not null default 0,
  valor_duplicado            numeric not null default 0,
  empenhado                  numeric not null default 0,
  planos_pagos               integer not null default 0,
  pago                       numeric not null default 0,
  pago_pt_aprovado           numeric not null default 0,
  pago_com_relatorio         numeric not null default 0,
  pago_com_final             numeric not null default 0,
  executado_declarado        numeric not null default 0,
  planos_pagos_12m           integer not null default 0,
  pago_12m                   numeric not null default 0,
  planos_12m_sem_relatorio   integer not null default 0,
  pago_12m_sem_relatorio     numeric not null default 0,
  planos_execucao_encerrada  integer not null default 0,
  planos_encerrada_sem_final integer not null default 0,
  pago_encerrada_sem_final   numeric not null default 0
);
create index if not exists pix_especial_ano_idx on public.pix_especial_ano (execucao_id, recorte);

create table if not exists public.pix_especial_motivo (
  execucao_id         bigint not null references public.pix_execucao (id) on delete cascade,
  recorte             text not null,
  ano                 integer,
  motivo              text,
  impedidos           integer not null,
  valor_impedido      numeric not null default 0,
  impedidos_ciclo1    integer not null default 0,
  reapresentados      integer not null default 0,
  valor_reapresentado numeric not null default 0,
  pago_no_gemeo       numeric not null default 0
);
create index if not exists pix_especial_motivo_idx on public.pix_especial_motivo (execucao_id, recorte);

create table if not exists public.pix_especial_plano (
  execucao_id         bigint not null references public.pix_execucao (id) on delete cascade,
  id_plano_acao       bigint not null,
  codigo_plano_acao   text,
  ano                 integer,
  beneficiario        text,
  cnpj                text,
  numero_emenda       bigint,
  situacao            text,
  motivo              text,
  valor               numeric,
  empenhado           numeric,
  pago                numeric,
  dt_primeira_ob      date,
  situacao_pt         text,
  fim_execucao        date,
  relatorio_entregue  boolean not null default false,
  final_entregue      boolean not null default false,
  duplicado           boolean not null default false,
  reapresentado       boolean not null default false,
  sem_relatorio_12m   boolean not null default false,
  encerrada_sem_final boolean not null default false
);
create index if not exists pix_especial_plano_idx on public.pix_especial_plano (execucao_id, ano);

create table if not exists public.pix_fundo_ano (
  execucao_id                bigint not null references public.pix_execucao (id) on delete cascade,
  recorte                    text not null,
  ano                        integer,
  orgao                      text,
  planos                     integer not null,
  entes                      integer not null default 0,
  repasse                    numeric not null default 0,
  planos_autorizados         integer not null default 0,
  repasse_autorizado         numeric not null default 0,
  planos_com_saldo           integer not null default 0,
  saldo_contas               numeric not null default 0,
  planos_vigencia_encerrada  integer not null default 0,
  planos_encerrada_com_saldo integer not null default 0,
  saldo_encerrada            numeric not null default 0
);
create index if not exists pix_fundo_ano_idx on public.pix_fundo_ano (execucao_id, recorte);

create table if not exists public.pix_fundo_relatorio (
  execucao_id           bigint not null references public.pix_execucao (id) on delete cascade,
  recorte               text not null,
  ano                   integer,
  orgao                 text,
  situacao              text not null,
  tipo                  text not null,
  planos                integer not null,
  repasse               numeric not null default 0,
  relatorio_mais_antigo date
);
create index if not exists pix_fundo_relatorio_idx on public.pix_fundo_relatorio (execucao_id, recorte);

create table if not exists public.pix_fundo_plano (
  execucao_id         bigint not null references public.pix_execucao (id) on delete cascade,
  id_plano_acao       bigint not null,
  codigo_plano_acao   text,
  ano                 integer,
  orgao               text,
  programa            text,
  ente                text,
  cnpj                text,
  cod_ibge            text,
  situacao            text,
  repasse             numeric,
  fim_vigencia        date,
  saldo_contas        numeric,
  contas              integer not null default 0,
  repasse_creditado   numeric,
  pago                numeric,
  dt_primeiro_credito date,
  dt_ultimo_pagamento date,
  dt_ultimo_movimento date,
  situacao_relatorio  text,
  tipo_relatorio      text,
  dt_relatorio        date,
  parado_12m          boolean not null default false,
  nunca_pagou         boolean not null default false,
  vigencia_encerrada  boolean not null default false
);
create index if not exists pix_fundo_plano_idx on public.pix_fundo_plano (execucao_id, ano);

do $$
declare t text;
begin
  foreach t in array array['pix_execucao', 'pix_especial_ano', 'pix_especial_motivo', 'pix_especial_plano',
                           'pix_fundo_ano', 'pix_fundo_relatorio', 'pix_fundo_plano'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.pix_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.pix_execucao_id_seq to service_role;


-- =============================================================================
-- Funções (mesmo desenho de painel_concluir / painel_limpar da oport_10b)
-- =============================================================================

create or replace function public.pix_ultima_execucao()
returns setof public.pix_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.pix_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.pix_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.pix_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter. Devolve quantas
-- apagou; 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como histórico.
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
                           'pix_fundo_ano', 'pix_fundo_relatorio', 'pix_fundo_plano'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.pix_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.pix_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.pix_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.pix_ultima_execucao()                    to service_role;
grant  execute on function public.pix_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.pix_limpar(bigint, integer)               to service_role;
