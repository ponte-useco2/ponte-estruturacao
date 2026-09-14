-- =============================================================================
-- oport_7 — Radar de propostas da PONTE
--
-- Agregados diários do Transferegov: propostas novas, em revisão e revisadas nas
-- últimas 24h, 7 e 30 dias, por programa, tipo de proponente e canal; a disputa
-- por programa aberto; e os municípios da Paraíba.
--
-- Uso EXCLUSIVO da PONTE. Quem grava é o job `radar_propostas/` do monorepo
-- privado, com a chave de serviço; quem lê é a página `/mapa/radar`, no servidor,
-- também com a chave de serviço, depois de conferir que o e-mail está em
-- OPORTUNIDADES_ADMINS.
--
-- Por isso NENHUMA destas tabelas e funções é acessível a `anon` ou
-- `authenticated`: não há política de RLS a escrever porque não há leitor
-- autenticado a autorizar. Quem decide "administrador" é o site, não o banco —
-- mesmo desenho de /oportunidades/admin.
--
-- Idempotente. Independe das migrations anteriores.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Execuções. A página lê sempre a última CONCLUÍDA: uma gravação que cai no meio
-- deixa o retrato anterior inteiro no ar.
-- -----------------------------------------------------------------------------
create table if not exists public.radar_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- Carimbo mais recente do histórico do Transferegov: é até ele que as janelas
  -- contam, e não até agora. O arquivo é atualizado uma vez por dia.
  dado_ate     timestamptz,
  -- "Hoje" usado para os dias restantes das janelas abertas.
  referencia   date,
  -- Last-Modified de cada arquivo baixado.
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);

create index if not exists radar_execucao_concluida_idx
  on public.radar_execucao (concluida_em desc) where status = 'concluida';

-- -----------------------------------------------------------------------------
-- Eventos dos últimos 60 dias (30 do período atual + 30 do anterior).
-- -----------------------------------------------------------------------------
create table if not exists public.radar_evento (
  execucao_id    bigint not null references public.radar_execucao (id) on delete cascade,
  id_proposta    text not null,
  categoria      text not null check (categoria in ('nova', 'em_revisao', 'revisada')),
  ocorrido_em    timestamptz not null,
  uf             text,
  municipio      text,
  cod_ibge       text,
  proponente     text,
  natureza       text,
  tipo_agente    text,
  id_programa    text,
  cod_programa   text,
  programa       text,
  orgao          text,
  canal          text check (canal in ('voluntaria', 'emenda_parlamentar', 'beneficiario_especifico', 'ambiguo', 'nao_determinado')),
  canal_inferido boolean,
  valor_repasse  numeric
);

create index if not exists radar_evento_janela_idx on public.radar_evento (execucao_id, categoria, ocorrido_em);
create index if not exists radar_evento_uf_idx on public.radar_evento (execucao_id, uf);

-- -----------------------------------------------------------------------------
-- Janelas abertas no dia da execução, com a disputa desde a abertura.
-- -----------------------------------------------------------------------------
create table if not exists public.radar_programa_aberto (
  execucao_id          bigint not null references public.radar_execucao (id) on delete cascade,
  uf                   text not null,
  cod_programa         text,
  programa             text,
  orgao                text,
  canal                text not null check (canal in ('voluntaria', 'emenda_parlamentar', 'beneficiario_especifico')),
  abre                 date,
  fecha                date,
  dias_restantes       integer,
  naturezas            text[] not null default '{}',
  novas_desde_abertura integer not null default 0,
  novas_30d            integer not null default 0,
  valor_pedido         numeric not null default 0
);

create index if not exists radar_programa_aberto_idx on public.radar_programa_aberto (execucao_id, uf);

-- -----------------------------------------------------------------------------
-- Os 223 municípios da Paraíba.
-- -----------------------------------------------------------------------------
create table if not exists public.radar_municipio_pb (
  execucao_id    bigint not null references public.radar_execucao (id) on delete cascade,
  cod_ibge       text not null,
  municipio      text not null,
  novas_30d      integer not null default 0,
  em_revisao_30d integer not null default 0,
  revisadas_30d  integer not null default 0,
  ultimo_envio   timestamptz
);

create index if not exists radar_municipio_pb_idx on public.radar_municipio_pb (execucao_id);

-- -----------------------------------------------------------------------------
-- Acesso: só a chave de serviço.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['radar_execucao', 'radar_evento', 'radar_programa_aberto', 'radar_municipio_pb'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.radar_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.radar_execucao_id_seq to service_role;


-- =============================================================================
-- Funções
-- =============================================================================

-- Fecha a execução e apaga os dados das anteriores, na mesma transação.
create or replace function public.radar_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.radar_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;

  delete from public.radar_evento          where execucao_id <> p_execucao;
  delete from public.radar_programa_aberto where execucao_id <> p_execucao;
  delete from public.radar_municipio_pb    where execucao_id <> p_execucao;
end $$;


create or replace function public.radar_ultima_execucao()
returns setof public.radar_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.radar_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;


-- -----------------------------------------------------------------------------
-- Placar: propostas distintas por categoria, em 24h, 7 e 30 dias, e no período
-- anterior de mesmo tamanho. `p_uf` nulo = Brasil.
-- -----------------------------------------------------------------------------
create or replace function public.radar_placar(p_uf text default null)
returns table (categoria text, dias integer, atual integer, anterior integer)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id, dado_ate from public.radar_ultima_execucao()),
       cat as (select unnest(array['nova', 'em_revisao', 'revisada']) categoria),
       jan as (select unnest(array[1, 7, 30]) dias)
  select cat.categoria, jan.dias,
         (select count(distinct e.id_proposta)::int
            from public.radar_evento e, ex
           where e.execucao_id = ex.id and e.categoria = cat.categoria
             and (p_uf is null or e.uf = p_uf)
             and e.ocorrido_em >  ex.dado_ate - make_interval(days => jan.dias)
             and e.ocorrido_em <= ex.dado_ate),
         (select count(distinct e.id_proposta)::int
            from public.radar_evento e, ex
           where e.execucao_id = ex.id and e.categoria = cat.categoria
             and (p_uf is null or e.uf = p_uf)
             and e.ocorrido_em >  ex.dado_ate - make_interval(days => 2 * jan.dias)
             and e.ocorrido_em <= ex.dado_ate - make_interval(days => jan.dias))
    from cat cross join jan
   where exists (select 1 from ex)
$$;


-- -----------------------------------------------------------------------------
-- Recorte por canal, tipo de proponente ou programa. O valor é somado por
-- PROPOSTA distinta: uma proposta que entrou duas vezes em revisão na janela não
-- dobra o dinheiro pedido.
-- -----------------------------------------------------------------------------
create or replace function public.radar_recorte(
  p_uf text, p_dimensao text, p_dias integer, p_categoria text default 'nova')
returns table (chave text, rotulo text, atual integer, anterior integer, valor_atual numeric, inferidos integer)
language plpgsql stable
set search_path to 'public'
as $$
-- As colunas de saída (chave, rotulo, atual…) são variáveis em PL/pgSQL e colidem
-- com as colunas de mesmo nome das CTEs. Sem esta diretiva, "column reference is
-- ambiguous".
#variable_conflict use_column
begin
  if p_dimensao not in ('canal', 'tipo_agente', 'programa') then
    raise exception 'dimensão inválida: %', p_dimensao;
  end if;
  if p_dias not in (1, 7, 30) then
    raise exception 'janela inválida: % dias', p_dias;
  end if;
  if p_categoria not in ('nova', 'em_revisao', 'revisada') then
    raise exception 'categoria inválida: %', p_categoria;
  end if;

  return query
  with ex as (select id, dado_ate from public.radar_ultima_execucao()),
  base as (
    select e.id_proposta,
           case p_dimensao when 'canal' then e.canal when 'tipo_agente' then e.tipo_agente else e.cod_programa end chave,
           case p_dimensao when 'programa' then e.programa end rotulo,
           e.valor_repasse, e.canal_inferido,
           (e.ocorrido_em > ex.dado_ate - make_interval(days => p_dias)) no_atual
      from public.radar_evento e, ex
     where e.execucao_id = ex.id and e.categoria = p_categoria
       and (p_uf is null or e.uf = p_uf)
       and e.ocorrido_em > ex.dado_ate - make_interval(days => 2 * p_dias)
       and e.ocorrido_em <= ex.dado_ate
  ),
  -- Uma linha por proposta por período, para contagem e soma não duplicarem.
  por_proposta as (
    select chave, no_atual, id_proposta, max(rotulo) rotulo, max(valor_repasse) valor, bool_or(canal_inferido) inferido
      from base group by chave, no_atual, id_proposta
  )
  select p.chave,
         max(p.rotulo),
         (count(*) filter (where p.no_atual))::int,
         (count(*) filter (where not p.no_atual))::int,
         coalesce(sum(p.valor) filter (where p.no_atual), 0),
         (count(*) filter (where p.no_atual and p.inferido))::int
    from por_proposta p
   group by p.chave
   order by 3 desc, 4 desc, 1;
end $$;


-- -----------------------------------------------------------------------------
-- Disputa por programa aberto. Com UF, as janelas dela; sem UF, somadas por
-- programa e canal no Brasil.
-- -----------------------------------------------------------------------------
create or replace function public.radar_disputa(p_uf text default null, p_limite integer default 50)
returns table (cod_programa text, programa text, orgao text, canal text, abre date, fecha date,
               dias_restantes integer, ufs integer, novas_desde_abertura integer, novas_30d integer, valor_pedido numeric)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.radar_ultima_execucao())
  select a.cod_programa, max(a.programa), max(a.orgao), a.canal, min(a.abre), max(a.fecha),
         min(a.dias_restantes), count(distinct a.uf)::int,
         sum(a.novas_desde_abertura)::int, sum(a.novas_30d)::int, sum(a.valor_pedido)
    from public.radar_programa_aberto a, ex
   where a.execucao_id = ex.id and (p_uf is null or a.uf = p_uf)
   group by a.cod_programa, a.canal
   order by 9 desc, 7 asc, 2
   limit greatest(1, least(coalesce(p_limite, 50), 500))
$$;


-- Só a chave de serviço executa. O Supabase concede EXECUTE a anon e
-- authenticated em toda função nova; sem este revoke, as funções ficariam
-- chamáveis pela API pública.
revoke execute on function public.radar_concluir(bigint, timestamptz, jsonb)      from public, anon, authenticated;
revoke execute on function public.radar_ultima_execucao()                         from public, anon, authenticated;
revoke execute on function public.radar_placar(text)                              from public, anon, authenticated;
revoke execute on function public.radar_recorte(text, text, integer, text)        from public, anon, authenticated;
revoke execute on function public.radar_disputa(text, integer)                    from public, anon, authenticated;
grant  execute on function public.radar_concluir(bigint, timestamptz, jsonb)      to service_role;
grant  execute on function public.radar_ultima_execucao()                         to service_role;
grant  execute on function public.radar_placar(text)                              to service_role;
grant  execute on function public.radar_recorte(text, text, integer, text)        to service_role;
grant  execute on function public.radar_disputa(text, integer)                    to service_role;
