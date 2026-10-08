-- =============================================================================
-- oport_34 — Somas do território para as páginas da UF e do Brasil (U1, 08/10/2026)
--
-- As páginas `/mapa/uf/[sigla]` e `/mapa/brasil` mostram os instrumentos somados por UF e para o país. Somar as
-- 79 mil linhas de `painel_instrumento` a cada visita leva 2 s com o banco aquecido e 6 s logo depois da rodada
-- diária (medido em 08/10, perto do corte de 8 s da API). Por isso:
--
--   · painel_territorio: o job do painel soma, na mesma execução, por recorte (cada UF e "BR") e dimensão —
--     situação (com a marca de vivo), órgão concedente e tema (só os vivos) e os totais (municípios e
--     proponentes distintos, vivos e todos). ~2 mil linhas por execução; entra no `painel_limpar`;
--   · painel_territorio_municipio / painel_territorio_proponente: as somas de UMA UF (por município e por CNPJ),
--     no banco, pelo índice por UF (9 a 160 ms medidos).
--
-- Cobertura (o site diz isso na página): a Paraíba tem todos os instrumentos desde 2008; as outras UFs, só os
-- vivos (em execução e em prestação de contas). As comparações entre UFs usam só os vivos.
--
-- ORDEM: esta migração ANTES do job chegar à `main` (sem a tabela, a gravação do painel falha). Leitura só pelo
-- servidor, com a chave de serviço. Idempotente. Pré-requisitos: oport_14 e oport_21.
-- =============================================================================

create table if not exists public.painel_territorio (
  execucao_id   bigint not null references public.painel_execucao (id) on delete cascade,
  -- a sigla da UF, ou 'BR' para o país
  recorte       text not null check (recorte ~ '^[A-Z]{2}$'),
  dimensao      text not null check (dimensao in ('situacao', 'orgao', 'tema', 'total')),
  -- a situação, o órgão, o tema; no total, 'vivos' ou 'todos'
  chave         text not null,
  -- na situação, se é instrumento vivo; nas outras dimensões, null
  vivo          boolean,
  n             integer not null,
  em_execucao   integer not null default 0,
  valor         numeric not null default 0,
  desembolsado  numeric not null default 0,
  -- só no total: municípios e proponentes (CNPJ) distintos
  municipios    integer,
  proponentes   integer
);
create index if not exists painel_territorio_idx on public.painel_territorio (execucao_id, recorte, dimensao);

alter table public.painel_territorio enable row level security;
revoke all on table public.painel_territorio from anon, authenticated;
grant all on table public.painel_territorio to service_role;

-- Por município de uma UF: instrumentos (todos e vivos), em execução e o valor em execução.
create or replace function public.painel_territorio_municipio(p_execucao bigint, p_uf text)
returns table (cod_ibge text, municipio text, instrumentos bigint, vivos bigint, em_execucao bigint, valor_execucao numeric,
               ultimo_ano integer)
language sql stable
set search_path to 'public'
as $$
  select i.cod_ibge, max(i.municipio), count(*), count(*) filter (where i.vivo),
         count(*) filter (where i.situacao = 'Em execução'),
         coalesce(sum(i.vl_global) filter (where i.situacao = 'Em execução'), 0),
         max(extract(year from i.dt_assinatura))::integer
    from public.painel_instrumento i
   where i.execucao_id = p_execucao and i.uf = p_uf and i.cod_ibge is not null
   group by i.cod_ibge
$$;

-- Por proponente (CNPJ) de uma UF, de um tipo (`tipo_agente`) ou de todos (p_tipo nulo). O nome é o do
-- instrumento mais recente (a razão social muda com o tempo), como na página da entidade.
create or replace function public.painel_territorio_proponente(p_execucao bigint, p_uf text, p_tipo text default null)
returns table (cnpj text, proponente text, tipo_agente text, cod_ibge text, municipio text, instrumentos bigint,
               em_execucao bigint, valor numeric, ultimo_ano integer)
language sql stable
set search_path to 'public'
as $$
  select i.cnpj,
         (array_agg(i.proponente order by i.dt_assinatura desc nulls last))[1],
         (array_agg(i.tipo_agente order by i.dt_assinatura desc nulls last))[1],
         (array_agg(i.cod_ibge order by i.dt_assinatura desc nulls last))[1],
         (array_agg(i.municipio order by i.dt_assinatura desc nulls last))[1],
         count(*), count(*) filter (where i.situacao = 'Em execução'), coalesce(sum(i.vl_global), 0),
         max(extract(year from i.dt_assinatura))::integer
    from public.painel_instrumento i
   where i.execucao_id = p_execucao and i.uf = p_uf and i.cnpj is not null and (p_tipo is null or i.tipo_agente = p_tipo)
   group by i.cnpj
$$;

revoke execute on function public.painel_territorio_municipio(bigint, text)         from public, anon, authenticated;
revoke execute on function public.painel_territorio_proponente(bigint, text, text)  from public, anon, authenticated;
grant  execute on function public.painel_territorio_municipio(bigint, text)         to service_role;
grant  execute on function public.painel_territorio_proponente(bigint, text, text)  to service_role;

-- A limpeza das execuções antigas passa a apagar também `painel_territorio`. Mesmo corpo da oport_21; muda só a
-- lista de tabelas.
create or replace function public.painel_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  ultima        public.painel_execucao;
  manter        bigint[];
  apagar        bigint[];
  sem_conclusao bigint[];
  resta         integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total         integer := 0;
  n             integer;
  t             text;
begin
  select * into ultima from public.painel_ultima_execucao();
  manter := array_remove(array[ultima.id, p_manter], null);
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(id) filter (where status <> 'concluida'), '{}')
    into apagar, sem_conclusao
    from public.painel_execucao where id <> all (manter);

  if cardinality(apagar) > 0 then
    foreach t in array array['painel_convenio', 'painel_municipio', 'painel_aditivo_motivo', 'painel_etapa_tempo',
                             'painel_etapa_ano', 'painel_programa_desfecho', 'painel_proposta',
                             'painel_instrumento', 'painel_instrumento_evento', 'painel_instrumento_emenda',
                             'painel_fornecedor', 'painel_fornecedor_convenio', 'painel_contrato',
                             'painel_fornecedor_municipio', 'painel_territorio'] loop
      execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
        using apagar, resta;
      get diagnostics n = row_count;
      total := total + n;
      resta := resta - n;
      exit when resta <= 0;
    end loop;
  end if;

  if resta > 0 then
    delete from public.painel_mudanca where ctid = any (array(
      select ctid from public.painel_mudanca
       where execucao_id = any (sem_conclusao)
          or dado_ate < ultima.dado_ate - interval '60 days'
       limit resta));
    get diagnostics n = row_count;
    total := total + n;
  end if;
  return total;
end $function$;

revoke execute on function public.painel_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.painel_limpar(bigint, integer) to service_role;
