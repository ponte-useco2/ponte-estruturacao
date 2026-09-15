-- =============================================================================
-- oport_14 — Instrumentos, busca e investimentos do município (onda 6)
--
--   · painel_instrumento: um convênio por linha — TODOS os de proponente da PB e os vivos
--     (em execução, prestação de contas ou TCE) do resto do Brasil —, com tema e texto de
--     busca já sem acento e em minúsculas (a busca não depende de unaccent nem pg_trgm);
--   · painel_instrumento_evento: a linha do tempo dos convênios da PB (situação, desembolso,
--     pagamento somado por dia e documento, tributo, aditivo, prorrogação, licitação).
--     Sem favorecido: há pagamento a pessoa física com nome completo no arquivo;
--   · painel_proposta ganha cnpj, temas e texto_busca, e passa a ter todas as propostas
--     da PB enviadas desde 2019;
--   · painel_limpar recolhe também as duas tabelas novas;
--   · painel_busca_instrumentos, painel_busca_propostas e painel_investimentos_municipio.
--
-- A página que lê é de usuário APROVADO (decisão do titular em 15/09/2026), mas a leitura
-- continua no servidor, pela chave de serviço: nada aqui é acessível a anon/authenticated.
--
-- Aplicar ANTES do job novo chegar à main: sem as tabelas e colunas, a gravação falha.
-- Grants explícitos (seguranca_1). Idempotente.
-- =============================================================================

create table if not exists public.painel_instrumento (
  execucao_id            bigint not null references public.painel_execucao (id) on delete cascade,
  nr_convenio            text not null,
  id_proposta            text,
  nr_proposta            text,
  modalidade             text,
  situacao               text,
  subsituacao            text,
  vivo                   boolean not null default false,
  -- UF detalhada: tem linha do tempo e está no universo completo.
  detalhe                boolean not null default false,
  uf                     text,
  cod_ibge               text,
  municipio              text,
  proponente             text,
  cnpj                   text,
  tipo_agente            text,
  orgao_sup              text,
  orgao                  text,
  cod_programa           text,
  programa               text,
  temas                  text[] not null default '{}',
  objeto                 text,
  com_emenda             boolean not null default false,
  vl_global              numeric,
  vl_repasse             numeric,
  vl_contrapartida       numeric,
  vl_empenhado           numeric,
  vl_desembolsado        numeric,
  vl_pago                numeric,
  vl_saldo_conta         numeric,
  pct_desembolsado       numeric,
  pct_fisico             numeric,
  dt_assinatura          date,
  dt_inicio_vigencia     date,
  dt_fim_vigencia        date,
  dt_limite_contas       date,
  dt_suspensiva          date,
  dt_retirada_suspensiva date,
  n_aditivos             integer not null default 0,
  n_prorrogas            integer not null default 0,
  dt_primeiro_desembolso date,
  dt_ultimo_desembolso   date,
  dt_ultimo_pagamento    date,
  texto_busca            text not null default ''
);
create index if not exists painel_instrumento_nr_idx   on public.painel_instrumento (execucao_id, nr_convenio);
create index if not exists painel_instrumento_ibge_idx on public.painel_instrumento (execucao_id, cod_ibge);
create index if not exists painel_instrumento_uf_idx   on public.painel_instrumento (execucao_id, uf);
create index if not exists painel_instrumento_prop_idx on public.painel_instrumento (execucao_id, id_proposta);

create table if not exists public.painel_instrumento_evento (
  execucao_id bigint not null references public.painel_execucao (id) on delete cascade,
  nr_convenio text not null,
  data        date not null,
  tipo        text not null check (tipo in ('situacao', 'desembolso', 'pagamento', 'tributo', 'aditivo', 'prorrogacao',
                                            'licitacao')),
  descricao   text,
  categoria   text,
  valor       numeric,
  quantidade  integer,
  data_fim    date
);
create index if not exists painel_instrumento_evento_idx on public.painel_instrumento_evento (execucao_id, nr_convenio, data);

alter table public.painel_proposta add column if not exists cnpj text;
alter table public.painel_proposta add column if not exists temas text[] not null default '{}';
alter table public.painel_proposta add column if not exists texto_busca text;

do $$
declare t text;
begin
  foreach t in array array['painel_instrumento', 'painel_instrumento_evento'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- Limpeza em lotes (oport_10b + oport_11) com as tabelas novas. As mudanças seguem a
-- regra da oport_11: saem as de execução sem conclusão e as com mais de 60 dias.
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
                             'painel_etapa_ano', 'painel_programa_desfecho', 'painel_proposta',
                             'painel_instrumento', 'painel_instrumento_evento'] loop
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
-- Busca. `p_termos` já chega sem acento, em minúsculas e sem % ou _ (o site normaliza):
-- a linha precisa conter TODOS os termos. Número exato de convênio ou proposta vem primeiro.
-- `total` é o total de linhas do filtro, para a paginação.
-- -----------------------------------------------------------------------------
create or replace function public.painel_busca_instrumentos(
  p_termos     text[]  default null,
  p_uf         text    default null,
  p_ibge       text    default null,
  p_tema       text    default null,
  p_situacoes  text[]  default null,
  p_orgao      text    default null,
  p_limite     integer default 30,
  p_offset     integer default 0
)
returns table (
  nr_convenio text, nr_proposta text, modalidade text, situacao text, vivo boolean, detalhe boolean, uf text,
  cod_ibge text, municipio text, proponente text, orgao_sup text, programa text, temas text[], objeto text,
  vl_repasse numeric, vl_desembolsado numeric, dt_assinatura date, dt_fim_vigencia date, total bigint
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao()),
  f as (
    select i.* from public.painel_instrumento i, ex
     where i.execucao_id = ex.id
       and (p_termos is null or cardinality(p_termos) = 0
            or i.texto_busca like all (array(select '%' || t || '%' from unnest(p_termos) t)))
       and (p_uf is null or i.uf = p_uf)
       and (p_ibge is null or i.cod_ibge = p_ibge)
       and (p_tema is null or p_tema = any (i.temas))
       and (p_situacoes is null or cardinality(p_situacoes) = 0 or i.situacao = any (p_situacoes))
       and (p_orgao is null or i.orgao_sup = p_orgao)
  )
  select f.nr_convenio, f.nr_proposta, f.modalidade, f.situacao, f.vivo, f.detalhe, f.uf, f.cod_ibge, f.municipio,
         f.proponente, f.orgao_sup, f.programa, f.temas, f.objeto, f.vl_repasse, f.vl_desembolsado, f.dt_assinatura,
         f.dt_fim_vigencia, count(*) over ()
    from f
   order by (p_termos is not null and cardinality(p_termos) = 1 and (f.nr_convenio = p_termos[1] or f.nr_proposta = p_termos[1])) desc,
            f.vivo desc, f.dt_assinatura desc nulls last, f.nr_convenio
   limit greatest(1, least(coalesce(p_limite, 30), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 10000))
$$;

create or replace function public.painel_busca_propostas(
  p_termos    text[]  default null,
  p_uf        text    default null,
  p_ibge      text    default null,
  p_tema      text    default null,
  p_desfechos text[]  default null,
  p_orgao     text    default null,
  p_limite    integer default 30,
  p_offset    integer default 0
)
returns table (
  id_proposta text, nr_proposta text, uf text, cod_ibge text, municipio text, proponente text, orgao_sup text,
  programa text, temas text[], objeto text, valor_repasse numeric, dt_envio date, ano_envio integer, desfecho text,
  situacao text, nr_convenio text, total bigint
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao()),
  f as (
    select p.* from public.painel_proposta p, ex
     where p.execucao_id = ex.id
       and (p_termos is null or cardinality(p_termos) = 0
            or coalesce(p.texto_busca, '') like all (array(select '%' || t || '%' from unnest(p_termos) t)))
       and (p_uf is null or p.uf = p_uf)
       and (p_ibge is null or p.cod_ibge = p_ibge)
       and (p_tema is null or p_tema = any (p.temas))
       and (p_desfechos is null or cardinality(p_desfechos) = 0 or p.desfecho = any (p_desfechos))
       and (p_orgao is null or p.orgao_sup = p_orgao)
  )
  select f.id_proposta, f.nr_proposta, f.uf, f.cod_ibge, f.municipio, f.proponente, f.orgao_sup, f.programa, f.temas,
         f.objeto, f.valor_repasse, f.dt_envio, f.ano_envio, f.desfecho, f.situacao, f.nr_convenio, count(*) over ()
    from f
   order by (p_termos is not null and cardinality(p_termos) = 1 and (f.nr_proposta = p_termos[1] or f.id_proposta = p_termos[1])) desc,
            f.dt_envio desc nulls last, f.id_proposta
   limit greatest(1, least(coalesce(p_limite, 30), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 10000))
$$;


-- -----------------------------------------------------------------------------
-- Investimentos no município: convênios (por tema, grupo de situação e modalidade) e,
-- da última execução de Pix e fundo a fundo, os planos do ente — ligados pelo CNPJ dos
-- proponentes daquele município.
--
-- Proponente ESTADUAL fica de fora: o SICONV registra o Governo do Estado com o IBGE da
-- capital, e João Pessoa receberia R$ 1 bi de termos de compromisso e os planos de fundo a
-- fundo do Estado (medido com o dado de 14/09/2026).
--   dimensao 'tipo'     chave convenio | especial | fundo
--   dimensao 'tema'     chave = id do tema, ou '' sem tema   (só convênios)
--   dimensao 'situacao' chave execucao | contas | concluido | encerrado | outros
--   dimensao 'modalidade'
-- Tema conta o convênio em cada tema que ele tem: a soma das linhas não é o total.
-- -----------------------------------------------------------------------------
create or replace function public.painel_investimentos_municipio(p_ibge text)
returns table (dimensao text, chave text, n integer, valor numeric, executado numeric)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao()),
  px as (select id from public.pix_ultima_execucao()),
  c as (
    select i.* from public.painel_instrumento i, ex
     where i.execucao_id = ex.id and i.cod_ibge = p_ibge and i.tipo_agente is distinct from 'estado'
  ),
  cnpjs as (
    select distinct cnpj from c where cnpj is not null and tipo_agente = 'municipio'
    union
    select distinct p.cnpj from public.painel_proposta p, ex
     where p.execucao_id = ex.id and p.cod_ibge = p_ibge and p.cnpj is not null and p.tipo_agente = 'municipio'
  )
  select 'tipo', 'convenio', count(*)::int, sum(vl_repasse), sum(vl_desembolsado) from c
  union all
  select 'tipo', 'especial', count(*)::int, sum(e.valor), sum(e.pago)
    from public.pix_especial_plano e, px where e.execucao_id = px.id and e.cnpj in (select cnpj from cnpjs)
  union all
  select 'tipo', 'fundo', count(*)::int, sum(f.repasse), sum(f.repasse_creditado)
    from public.pix_fundo_plano f, px where f.execucao_id = px.id and f.cnpj in (select cnpj from cnpjs)
  union all
  select 'tema', coalesce(t.tema, ''), count(*)::int, sum(c.vl_repasse), sum(c.vl_desembolsado)
    from c left join lateral unnest(c.temas) as t(tema) on true
   group by coalesce(t.tema, '')
  union all
  select 'situacao',
         case when c.situacao = 'Em execução' then 'execucao'
              when c.situacao in ('Prestação de Contas Aprovada', 'Prestação de Contas Aprovada com Ressalvas',
                                  'Prestação de Contas Concluída') then 'concluido'
              when c.situacao ilike '%prestação de contas%' or c.situacao = 'Inadimplente' then 'contas'
              when c.situacao in ('Convênio Anulado', 'Convênio Rescindido', 'Cancelado') then 'encerrado'
              else 'outros' end,
         count(*)::int, sum(c.vl_repasse), sum(c.vl_desembolsado)
    from c group by 2
  union all
  select 'modalidade', coalesce(c.modalidade, ''), count(*)::int, sum(c.vl_repasse), sum(c.vl_desembolsado)
    from c group by 2
$$;


revoke execute on function public.painel_limpar(bigint, integer) from public, anon, authenticated;
revoke execute on function public.painel_busca_instrumentos(text[], text, text, text, text[], text, integer, integer) from public, anon, authenticated;
revoke execute on function public.painel_busca_propostas(text[], text, text, text, text[], text, integer, integer) from public, anon, authenticated;
revoke execute on function public.painel_investimentos_municipio(text) from public, anon, authenticated;
grant  execute on function public.painel_limpar(bigint, integer) to service_role;
grant  execute on function public.painel_busca_instrumentos(text[], text, text, text, text[], text, integer, integer) to service_role;
grant  execute on function public.painel_busca_propostas(text[], text, text, text, text[], text, integer, integer) to service_role;
grant  execute on function public.painel_investimentos_municipio(text) to service_role;
