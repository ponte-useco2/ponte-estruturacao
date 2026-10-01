-- =============================================================================
-- oport_27 — indicadores dos 223 municípios da PB para o relatório crítico do município (onda 14, camada 2)
--
-- O job `municipios` (mensal, `municipios.yml`) lê fontes oficiais em lote — IBGE, Ministério da Saúde,
-- INEP, MDS, MJSP, MTE, Ministério das Cidades, MIDR, ANA, Anatel, Senatran, Atricon e TCE-PB — e grava
-- um valor por município e indicador, com o ano de referência, a fonte e o endereço. Os nomes, unidades
-- e a direção de cada indicador ficam no catálogo do site (`indicadores-municipio.json`).
--
--   · mun_execucao e as funções mun_ultima_execucao / mun_concluir / mun_limpar (o desenho da oport_22);
--   · mun_indicador: ibge × indicador. `valor` nulo é ausência, com o porquê em `nota` (nunca zero); com
--     a posição na PB e as medianas do porte e da região imediata, calculadas pelo job;
--   · mun_referencia: as referências de cada indicador — PB e Brasil quando a fonte traz, e sempre a
--     mediana e os quartis dos 223 (q1_pb, mediana_pb, q3_pb);
--   · mun_grupo: os grupos de comparação de cada município — porte (tercil da população), região
--     geográfica imediata e intermediária (IBGE 2017) e hierarquia da REGIC 2018.
--
-- Privacidade: só agregados por município. Microdados (SIM, SINASC, Caged) e arquivos com nome ou CPF
-- (licitações do TCE-PB) são agregados na chegada e nunca gravados.
-- ORDEM: esta migração ANTES do job chegar à `main`. Leitura só pelo servidor, com a chave de serviço
-- (grants explícitos). Aditiva e idempotente.
-- =============================================================================

create table if not exists public.mun_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists mun_execucao_concluida_idx on public.mun_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.mun_indicador (
  execucao_id bigint not null references public.mun_execucao (id) on delete cascade,
  ibge        text not null check (ibge ~ '^25[0-9]{5}$'),
  indicador   text not null,
  ano         text not null,
  valor       double precision,
  fonte       text not null,
  url         text,
  nota        text,
  -- Posição na PB (1 = melhor, pela direção do catálogo) entre os do mesmo ano; nula sem direção ou sem valor.
  posicao_pb  integer,
  total_pb    integer,
  -- Mediana do porte (tercil da população) e da região geográfica imediata do município, no mesmo ano.
  mediana_porte  double precision,
  mediana_regiao double precision,
  primary key (execucao_id, ibge, indicador)
);

create table if not exists public.mun_referencia (
  execucao_id bigint not null references public.mun_execucao (id) on delete cascade,
  indicador   text not null,
  ano         text not null,
  recorte     text not null check (recorte in ('PB', 'BR', 'q1_pb', 'mediana_pb', 'q3_pb')),
  valor       double precision not null,
  primary key (execucao_id, indicador, recorte)
);

create table if not exists public.mun_grupo (
  execucao_id          bigint not null references public.mun_execucao (id) on delete cascade,
  ibge                 text not null check (ibge ~ '^25[0-9]{5}$'),
  porte                text check (porte in ('pequeno', 'médio', 'grande')),
  regiao_imediata      text,
  regiao_imediata_id   text,
  regiao_intermediaria text,
  regic                text,
  regic_grupo          text,
  arranjo              text,
  polo                 boolean not null default false,
  primary key (execucao_id, ibge)
);

do $$
declare
  t text;
begin
  foreach t in array array['mun_execucao', 'mun_indicador', 'mun_referencia', 'mun_grupo'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.mun_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.mun_execucao_id_seq to service_role;

create or replace function public.mun_ultima_execucao()
returns setof public.mun_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.mun_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.mun_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.mun_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter. Devolve quantas apagou;
-- 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como histórico.
create or replace function public.mun_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.mun_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.mun_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['mun_indicador', 'mun_referencia', 'mun_grupo'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.mun_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.mun_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.mun_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.mun_ultima_execucao()                    to service_role;
grant  execute on function public.mun_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.mun_limpar(bigint, integer)               to service_role;
