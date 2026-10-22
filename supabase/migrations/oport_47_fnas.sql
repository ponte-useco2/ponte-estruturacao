-- =============================================================================
-- oport_47 — Assistência social (FNAS/MDS) na PB: saldos das contas, repasses fundo a fundo e emendas
-- (primeira infância, P1, 22/10/2026; plano em Site-Ponte/primeira-infancia/PLANO.md)
--
-- O job `fnas/` (diário, `fnas.yml`, no runner da máquina do titular) lê o Portal de Dados do FNAS
-- (paineis.mds.gov.br, Qlik Sense com acesso público anônimo) pedindo ao próprio servidor as SOMAS da PB:
--   · saldos: os últimos 25 meses, por entidade (CNPJ) × tipo de conta (o programa ou bloco da conta);
--   · repasses: de 2023 em diante, por entidade × programa × mês;
--   · emendas parlamentares ao FNAS: todas (2018 em diante), por entidade × programa × ano × parlamentar.
-- Banco, agência e conta NUNCA saem do servidor do MDS: o job não os pede (as somas são por tipo de conta).
-- Parlamentar é agente público. A coluna `primeira_infancia` marca as contas e os programas do Programa Primeira
-- Infância no SUAS / Criança Feliz (regra em `fnas/montar.py`).
--
--   · fnas_execucao e as funções fnas_ultima_execucao / fnas_concluir / fnas_limpar (o desenho da oport_44);
--   · fnas_entidade, fnas_saldo, fnas_repasse, fnas_emenda: o retrato da rodada.
--
-- Acesso: pelo servidor (administrador e cadastrado, decisão do titular de 22/10/2026). RLS ligada sem nenhuma
-- política, e grants só para `service_role` (tabelas, sequência e funções).
--
-- ORDEM: esta migração ANTES da primeira rodada (sem `fnas_ultima_execucao`, o job para antes de ler a fonte).
-- Aditiva e idempotente. Pré-requisitos: nenhum.
-- =============================================================================

create table if not exists public.fnas_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- A carga do MDS (`DH_CARGA` do painel de saldos).
  dado_ate     timestamptz,
  -- O dia da rodada, em Brasília.
  referencia   date,
  -- {"portal", "apps": {saldos, repasses, emendas}}
  arquivos     jsonb not null default '{}'::jsonb,
  -- `fnas_saldos` (meses, linhas, soma por mês conferida), `fnas_repasses` (por ano), `fnas_emendas`, `fnas_pedidos`...
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists fnas_execucao_concluida_idx on public.fnas_execucao (concluida_em desc) where status = 'concluida';

-- As entidades que aparecem nos saldos ou nos repasses: prefeitura, fundo municipal, fundo ou governo estadual.
create table if not exists public.fnas_entidade (
  execucao_id bigint not null references public.fnas_execucao (id) on delete cascade,
  cnpj        text not null check (cnpj ~ '^\d{14}$'),
  nome        text,
  tipo        text,
  estadual    boolean not null default false,
  -- O município (IBGE de 7 dígitos, pela semente `fiscal/seeds/entes_pb.csv`); nas estaduais, o da sede.
  ibge        text check (ibge is null or ibge ~ '^\d{7}$'),
  primary key (execucao_id, cnpj)
);
create index if not exists fnas_entidade_ibge_idx on public.fnas_entidade (execucao_id, ibge);

create table if not exists public.fnas_saldo (
  execucao_id       bigint not null references public.fnas_execucao (id) on delete cascade,
  cnpj              text not null check (cnpj ~ '^\d{14}$'),
  ibge              text check (ibge is null or ibge ~ '^\d{7}$'),
  -- AAAAMM.
  ano_mes           integer not null check (ano_mes between 200001 and 210012),
  -- O nome da conta no painel (o programa ou o bloco de financiamento) e o agrupamento do painel (BL PSB FNAS...).
  tipo_conta        text not null,
  bloco             text,
  primeira_infancia boolean not null default false,
  -- Quantas linhas do painel (contas no mês) a soma juntou.
  contas            integer not null default 0,
  conta_corrente    numeric not null default 0,
  poupanca          numeric not null default 0,
  fundos            numeric not null default 0,
  cdb_rdb           numeric not null default 0,
  total             numeric not null default 0,
  primary key (execucao_id, cnpj, ano_mes, tipo_conta)
);
create index if not exists fnas_saldo_ibge_idx on public.fnas_saldo (execucao_id, ibge, ano_mes);
create index if not exists fnas_saldo_pi_idx on public.fnas_saldo (execucao_id, ano_mes) where primeira_infancia;

create table if not exists public.fnas_repasse (
  execucao_id       bigint not null references public.fnas_execucao (id) on delete cascade,
  cnpj              text not null check (cnpj ~ '^\d{14}$'),
  ibge              text check (ibge is null or ibge ~ '^\d{7}$'),
  ano               integer not null,
  mes               integer not null check (mes between 1 and 12),
  programa          text not null,
  programa_resumido text,
  bloco             text,
  primeira_infancia boolean not null default false,
  -- Quantas ordens bancárias (linhas do painel) a soma juntou.
  ordens            integer not null default 0,
  valor             numeric not null default 0,
  primary key (execucao_id, cnpj, ano, mes, programa)
);
create index if not exists fnas_repasse_ibge_idx on public.fnas_repasse (execucao_id, ibge, ano);

create table if not exists public.fnas_emenda (
  execucao_id       bigint not null references public.fnas_execucao (id) on delete cascade,
  seq               integer not null check (seq >= 1),
  cnpj              text check (cnpj is null or cnpj ~ '^\d{14}$'),
  ibge              text check (ibge is null or ibge ~ '^\d{7}$'),
  ano               integer not null,
  programa          text,
  parlamentar       text,
  partido           text,
  tipo_emenda       text,
  primeira_infancia boolean not null default false,
  registros         integer not null default 0,
  valor             numeric not null default 0,
  primary key (execucao_id, seq)
);
create index if not exists fnas_emenda_ibge_idx on public.fnas_emenda (execucao_id, ibge);

do $$
declare
  t text;
begin
  foreach t in array array['fnas_execucao', 'fnas_entidade', 'fnas_saldo', 'fnas_repasse', 'fnas_emenda'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.fnas_execucao_id_seq from public, anon, authenticated;
grant usage, select on sequence public.fnas_execucao_id_seq to service_role;

-- -----------------------------------------------------------------------------
-- Execução: a última concluída, concluir e limpar (o desenho da oport_44).
-- -----------------------------------------------------------------------------

create or replace function public.fnas_ultima_execucao()
returns setof public.fnas_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.fnas_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.fnas_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.fnas_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas do retrato de todas as execuções, menos a última concluída e p_manter, até p_limite linhas por chamada
-- (dentro dos 8 s da API). Devolve quantas apagou; 0 = nada mais a limpar. As execuções antigas ficam, como histórico.
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

  foreach t in array array['fnas_saldo', 'fnas_repasse', 'fnas_emenda', 'fnas_entidade'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.fnas_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.fnas_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.fnas_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.fnas_ultima_execucao()                    to service_role;
grant  execute on function public.fnas_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.fnas_limpar(bigint, integer)               to service_role;
