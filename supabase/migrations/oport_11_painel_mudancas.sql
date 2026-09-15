-- =============================================================================
-- oport_11 — Painel: o que mudou desde o último retrato, e o resumo diário
--
--   · painel_mudanca: uma linha por evento (suspensiva retirada, primeiro desembolso,
--     contas rejeitadas, proposta assinada…), gravada pelo job comparando o retrato
--     novo com o último concluído. Não é apagada com a execução: fica 60 dias;
--   · painel_execucao.resumo_enviado_em: o e-mail diário sai uma vez por execução;
--   · índices (execucao_id, chave) para o job ler o retrato anterior em páginas;
--   · painel_limpar também recolhe mudanças de execução que não concluiu e as
--     mais velhas que a retenção;
--   · painel_mudancas e painel_mudancas_resumo: lista e contagem por tipo, só de
--     execuções concluídas.
--
-- Compatível com o site e o job publicados: nada do que eles usam muda de forma.
-- Aplicar ANTES do job novo chegar à main — sem a tabela, a gravação falha.
--
-- Grants explícitos (seguranca_1). Idempotente.
-- =============================================================================

create table if not exists public.painel_mudanca (
  execucao_id       bigint not null references public.painel_execucao (id) on delete cascade,
  dado_ate_anterior timestamptz not null,
  dado_ate          timestamptz not null,
  alvo              text not null check (alvo in ('convenio', 'proposta')),
  tipo              text not null,
  chave             text not null,
  numero            text,
  uf                text,
  cod_ibge          text,
  municipio         text,
  proponente        text,
  tipo_agente       text,
  orgao_sup         text,
  programa          text,
  objeto            text,
  antes             text,
  depois            text,
  valor             numeric
);
create index if not exists painel_mudanca_data_idx     on public.painel_mudanca (dado_ate desc, uf);
create index if not exists painel_mudanca_ibge_idx     on public.painel_mudanca (cod_ibge, dado_ate desc);
create index if not exists painel_mudanca_execucao_idx on public.painel_mudanca (execucao_id);

alter table public.painel_mudanca enable row level security;
revoke all on table public.painel_mudanca from anon, authenticated;
grant all on table public.painel_mudanca to service_role;

alter table public.painel_execucao add column if not exists resumo_enviado_em timestamptz;

-- O job lê o retrato anterior por "chave maior que a última da página".
create index if not exists painel_convenio_nr_idx on public.painel_convenio (execucao_id, nr_convenio);
create index if not exists painel_proposta_id_idx on public.painel_proposta (execucao_id, id_proposta);


-- -----------------------------------------------------------------------------
-- Limpeza em lotes (oport_10b) + mudanças. As mudanças de execuções concluídas não
-- saem com a execução: são o histórico. Saem as de execução com erro e as com mais
-- de 60 dias contados da data do dado mais recente (não do relógio: se o job parar
-- uma semana, a tela não perde a última semana que tinha).
-- -----------------------------------------------------------------------------
create or replace function public.painel_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
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
                             'painel_etapa_ano', 'painel_programa_desfecho', 'painel_proposta'] loop
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
end $$;


-- -----------------------------------------------------------------------------
-- Leitura, só de execuções concluídas. p_dias = 1: as mudanças do dado da última
-- execução concluída (igualdade, e não "24 horas": o horário do último carimbo varia
-- de um dia para o outro e puxaria o dia anterior); 7 ou 30: os últimos dias de dado.
-- -----------------------------------------------------------------------------
create or replace function public.painel_mudancas(
  p_dias integer default 1,
  p_uf text default null,
  p_ibge text default null,
  p_tipo text default null,
  p_limite integer default 50,
  p_agente text default null
)
returns setof public.painel_mudanca
language sql stable
set search_path to 'public'
as $$
  select m.*
    from public.painel_mudanca m
    join public.painel_execucao e on e.id = m.execucao_id and e.status = 'concluida'
   cross join (select dado_ate from public.painel_ultima_execucao()) u
   where case when coalesce(p_dias, 1) <= 1 then m.dado_ate = u.dado_ate
              else m.dado_ate > u.dado_ate - make_interval(days => least(p_dias, 60)) end
     and (p_uf is null or m.uf = p_uf)
     and (p_ibge is null or m.cod_ibge = p_ibge)
     and (p_agente is null or m.tipo_agente = p_agente)
     and (p_tipo is null or m.tipo = p_tipo)
   order by m.dado_ate desc, m.valor desc nulls last, m.tipo, m.chave
   limit greatest(1, least(coalesce(p_limite, 50), 500))
$$;

create or replace function public.painel_mudancas_resumo(
  p_dias integer default 1,
  p_uf text default null,
  p_ibge text default null,
  p_agente text default null
)
returns table (tipo text, n integer, valor numeric, desde timestamptz, ate timestamptz)
language sql stable
set search_path to 'public'
as $$
  select m.tipo, count(*)::int, sum(m.valor), min(m.dado_ate_anterior), max(m.dado_ate)
    from public.painel_mudanca m
    join public.painel_execucao e on e.id = m.execucao_id and e.status = 'concluida'
   cross join (select dado_ate from public.painel_ultima_execucao()) u
   where case when coalesce(p_dias, 1) <= 1 then m.dado_ate = u.dado_ate
              else m.dado_ate > u.dado_ate - make_interval(days => least(p_dias, 60)) end
     and (p_uf is null or m.uf = p_uf)
     and (p_ibge is null or m.cod_ibge = p_ibge)
     and (p_agente is null or m.tipo_agente = p_agente)
   group by m.tipo
$$;


revoke execute on function public.painel_limpar(bigint, integer)                        from public, anon, authenticated;
revoke execute on function public.painel_mudancas(integer, text, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.painel_mudancas_resumo(integer, text, text, text)      from public, anon, authenticated;
grant  execute on function public.painel_limpar(bigint, integer)                        to service_role;
grant  execute on function public.painel_mudancas(integer, text, text, text, integer, text) to service_role;
grant  execute on function public.painel_mudancas_resumo(integer, text, text, text)      to service_role;
