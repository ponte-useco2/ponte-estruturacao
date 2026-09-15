-- =============================================================================
-- oport_9 — Ficha do município e filtros de município e período no painel
--
-- Acrescenta à oport_8:
--   · painel_proposta: as propostas recentes uma a uma, para a ficha do município;
--   · filtros de município (código IBGE), tipo de proponente e período de assinatura
--     nas funções de resumo e por órgão;
--   · painel_municipios(uf): a lista de municípios para o seletor;
--   · painel_propostas_por_ano(ibge, agente): o quadro de propostas da ficha.
--
-- Compatível com a página já publicada: os parâmetros novos têm default nulo, e a
-- chamada antiga painel_resumo(p_uf, p_orgao) continua valendo. Aplicar ANTES de o
-- job novo chegar à main — sem a tabela, a gravação da execução falha.
--
-- Mesmo desenho de acesso da oport_8: nada para anon ou authenticated. Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Propostas da ficha: enviadas no ano da referência e nos dois anteriores, mais as
-- antigas ainda sem desfecho com evento no último ano. A regra fica no job.
-- -----------------------------------------------------------------------------
create table if not exists public.painel_proposta (
  execucao_id      bigint not null references public.painel_execucao (id) on delete cascade,
  id_proposta      text not null,
  nr_proposta      text,
  uf               text,
  cod_ibge         text,
  municipio        text,
  proponente       text,
  tipo_agente      text,
  orgao_sup        text,
  cod_programa     text,
  programa         text,
  objeto           text,
  valor_repasse    numeric,
  com_emenda       boolean not null default false,
  dt_envio         date,
  ano_envio        integer,
  desfecho         text check (desfecho in ('assinada', 'reprovada', 'impedimento', 'eliminada', 'cancelada',
                                            'anulada', 'aberta_concedente', 'aberta_proponente',
                                            'aguardando_assinatura')),
  -- Só reprovação ou impedimento com 100 ou mais no mesmo dia e órgão.
  em_lote          boolean not null default false,
  limbo            boolean not null default false,
  situacao         text,
  dt_ultimo_evento date,
  dias_sem_evento  integer,
  dt_assinatura    date,
  nr_convenio      text
);

create index if not exists painel_proposta_ibge_idx on public.painel_proposta (execucao_id, cod_ibge);
create index if not exists painel_proposta_uf_idx   on public.painel_proposta (execucao_id, uf);
-- A ficha lê os convênios de um município: sem índice, cada bloco varreria a tabela.
create index if not exists painel_convenio_ibge_idx on public.painel_convenio (execucao_id, cod_ibge);

alter table public.painel_proposta enable row level security;
revoke all on table public.painel_proposta from anon, authenticated;
grant all on table public.painel_proposta to service_role;


-- -----------------------------------------------------------------------------
-- Fechar a execução passa a apagar também as propostas das anteriores.
-- -----------------------------------------------------------------------------
create or replace function public.painel_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.painel_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;

  delete from public.painel_convenio          where execucao_id <> p_execucao;
  delete from public.painel_municipio         where execucao_id <> p_execucao;
  delete from public.painel_etapa_tempo       where execucao_id <> p_execucao;
  delete from public.painel_programa_desfecho where execucao_id <> p_execucao;
  delete from public.painel_proposta          where execucao_id <> p_execucao;
end $$;


-- -----------------------------------------------------------------------------
-- Números de topo, agora também por município, tipo de proponente e período de
-- assinatura. A assinatura antiga (text, text) sai: com as duas no banco, a chamada
-- com só p_uf e p_orgao ficaria ambígua.
--   p_ibge     código IBGE de 7 dígitos (nulo = todos)
--   p_agente   tipo_agente do proponente, como 'municipio' (nulo = todos)
--   p_assinado_de / p_assinado_ate  datas, inclusivas; com qualquer uma, convênio
--              sem data de assinatura fica de fora
-- Os municípios (contagem de sinais) respeitam UF e IBGE, não órgão, agente ou período.
-- -----------------------------------------------------------------------------
drop function if exists public.painel_resumo(text, text);

create or replace function public.painel_resumo(
  p_uf text default null,
  p_orgao text default null,
  p_ibge text default null,
  p_agente text default null,
  p_assinado_de date default null,
  p_assinado_ate date default null
)
returns table (visao text, chave text, n integer, valor numeric)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao()),
  c as (
    select c.* from public.painel_convenio c, ex
     where c.execucao_id = ex.id and (p_uf is null or c.uf = p_uf)
       and (p_orgao is null or c.orgao_sup = p_orgao)
       and (p_ibge is null or c.cod_ibge = p_ibge)
       and (p_agente is null or c.tipo_agente = p_agente)
       and (p_assinado_de is null or c.dt_assinatura >= p_assinado_de)
       and (p_assinado_ate is null or c.dt_assinatura <= p_assinado_ate)
  )
  select 'suspensiva', coalesce(suspensiva_faixa, 'total'), count(*)::int, sum(repasse)
    from c where em_suspensiva group by grouping sets ((suspensiva_faixa), ())
  union all
  select 'suspensiva', e.chave, count(*)::int, sum(c.repasse)
    from c cross join lateral (values
      ('exige_titularidade', c.exige_titularidade), ('exige_projeto', c.exige_projeto),
      ('exige_licenca', c.exige_licenca), ('exige_sustentabilidade', c.exige_sustentabilidade),
      ('exige_termo_referencia', c.exige_termo_referencia)) e(chave, marca)
   where c.em_suspensiva and e.marca
   group by e.chave
  union all
  select 'nunca', 'total', count(*)::int, sum(repasse) from c where nunca_desembolsado
  union all
  select 'nunca', 'grupo_' || grupo_suspensiva, count(*)::int, sum(repasse) from c where nunca_desembolsado group by grupo_suspensiva
  union all
  select 'nunca', 'etapa_' || etapa_licitacao, count(*)::int, sum(repasse) from c where nunca_desembolsado and etapa_licitacao is not null group by etapa_licitacao
  union all
  select 'nunca', 'aceite_parado', count(*)::int, sum(repasse) from c where aceite_parado
  union all
  select 'vigencia', coalesce(vigencia_faixa, 'total'), count(*)::int, sum(greatest(coalesce(repasse, 0) - coalesce(desembolsado, 0), 0))
    from c where vigencia_faixa is not null group by grouping sets ((vigencia_faixa), ())
  union all
  select 'contas', contas_lado, count(*)::int, sum(repasse) from c where contas_lado is not null group by contas_lado
  union all
  select 'contas', 'atrasada', count(*)::int, sum(repasse) from c where contas_atrasada
  union all
  select 'contas', contas_lado || '_1ano', count(*)::int, sum(repasse) from c where contas_parada_1ano group by contas_lado
  union all
  select 'contas', 'tce', count(*)::int, sum(repasse) from c where tce
  union all
  select 'saldo', saldo_faixa, count(*)::int, sum(saldo_conta) from c where saldo_faixa is not null group by saldo_faixa
  union all
  select 'saldo', 'parado', count(*)::int, sum(saldo_conta) from c where saldo_parado
  union all
  select 'saldo', 'parado_nunca_pagou', count(*)::int, sum(saldo_conta) from c where saldo_parado and nunca_pagou
  union all
  select 'saldo', 'rendimento_parado', count(*)::int, sum(rendimento_implicito) from c where saldo_parado
  union all
  select 'municipios', n_sinais::text, count(*)::int, null::numeric
    from public.painel_municipio m, ex
   where m.execucao_id = ex.id and (p_uf is null or m.uf = p_uf) and (p_ibge is null or m.cod_ibge = p_ibge)
   group by n_sinais
$$;


-- -----------------------------------------------------------------------------
-- Visão por órgão concedente, com os mesmos filtros de município e período.
-- -----------------------------------------------------------------------------
drop function if exists public.painel_por_orgao(text, text, integer);

create or replace function public.painel_por_orgao(
  p_visao text,
  p_uf text default null,
  p_limite integer default 15,
  p_ibge text default null,
  p_assinado_de date default null,
  p_assinado_ate date default null
)
returns table (orgao text, n integer, valor numeric, destaque integer)
language plpgsql stable
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  if p_visao not in ('suspensiva', 'nunca', 'vigencia', 'contas', 'saldo') then
    raise exception 'visão inválida: %', p_visao;
  end if;

  return query
  with ex as (select id from public.painel_ultima_execucao()),
  c as (
    select c.* from public.painel_convenio c, ex
     where c.execucao_id = ex.id and (p_uf is null or c.uf = p_uf)
       and (p_ibge is null or c.cod_ibge = p_ibge)
       and (p_assinado_de is null or c.dt_assinatura >= p_assinado_de)
       and (p_assinado_ate is null or c.dt_assinatura <= p_assinado_ate)
  ),
  v as (
    select coalesce(orgao_sup, '(sem órgão)') orgao,
           case p_visao when 'vigencia' then greatest(coalesce(repasse, 0) - coalesce(desembolsado, 0), 0)
                        when 'saldo' then coalesce(saldo_conta, 0)
                        else coalesce(repasse, 0) end valor,
           case p_visao when 'suspensiva' then suspensiva_faixa in ('vencido', 'ate_30', '31_90')
                        when 'nunca' then aceite_parado
                        when 'vigencia' then vigencia_faixa in ('vencida', 'ate_90')
                        when 'contas' then coalesce(contas_parada_1ano, false)
                        else coalesce(nunca_pagou, false) end destaque
      from c
     where case p_visao when 'suspensiva' then em_suspensiva
                        when 'nunca' then nunca_desembolsado
                        when 'vigencia' then vigencia_faixa is not null
                        when 'contas' then contas_lado is not null or tce
                        else saldo_parado end
  )
  select v.orgao, count(*)::int, sum(v.valor), (count(*) filter (where v.destaque))::int
    from v
   group by v.orgao
   order by 2 desc, 3 desc
   limit greatest(1, least(coalesce(p_limite, 15), 100));
end $$;


-- -----------------------------------------------------------------------------
-- Municípios de uma UF que têm convênio no painel ou proposta recente, para o
-- seletor. Nome do arquivo de propostas quando o município só aparece lá.
-- -----------------------------------------------------------------------------
create or replace function public.painel_municipios(p_uf text)
returns table (cod_ibge text, municipio text, convenios integer, propostas integer)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao()),
  c as (
    select c.cod_ibge, max(c.municipio) municipio, count(*)::int n
      from public.painel_convenio c, ex
     where c.execucao_id = ex.id and c.uf = p_uf and c.cod_ibge is not null
     group by c.cod_ibge
  ),
  p as (
    select p.cod_ibge, max(p.municipio) municipio, count(*)::int n
      from public.painel_proposta p, ex
     where p.execucao_id = ex.id and p.uf = p_uf and p.cod_ibge is not null
     group by p.cod_ibge
  )
  select coalesce(c.cod_ibge, p.cod_ibge), coalesce(c.municipio, p.municipio), coalesce(c.n, 0), coalesce(p.n, 0)
    from c full join p on p.cod_ibge = c.cod_ibge
   order by 2
$$;


-- -----------------------------------------------------------------------------
-- Quadro de propostas da ficha, por ano de envio. Somado no banco: com todos os
-- proponentes, Brasília passa de 2.500 propostas, e a lista da página traz só as 50
-- mais relevantes de cada tipo.
-- -----------------------------------------------------------------------------
create or replace function public.painel_propostas_por_ano(p_ibge text, p_agente text default null)
returns table (
  ano_envio integer, enviadas integer, assinadas integer, reprovadas integer, reprovadas_lote integer,
  impedimento integer, impedimento_lote integer, eliminadas integer, sem_desfecho integer, limbo integer,
  com_emenda integer, valor_pedido numeric
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao())
  select p.ano_envio,
         count(*)::int,
         (count(*) filter (where p.desfecho = 'assinada'))::int,
         (count(*) filter (where p.desfecho = 'reprovada'))::int,
         (count(*) filter (where p.desfecho = 'reprovada' and p.em_lote))::int,
         (count(*) filter (where p.desfecho = 'impedimento'))::int,
         (count(*) filter (where p.desfecho = 'impedimento' and p.em_lote))::int,
         (count(*) filter (where p.desfecho = 'eliminada'))::int,
         (count(*) filter (where p.desfecho in ('aberta_concedente', 'aberta_proponente', 'aguardando_assinatura')))::int,
         (count(*) filter (where p.limbo))::int,
         (count(*) filter (where p.com_emenda))::int,
         coalesce(sum(p.valor_repasse), 0)
    from public.painel_proposta p, ex
   where p.execucao_id = ex.id and p.cod_ibge = p_ibge and (p_agente is null or p.tipo_agente = p_agente)
   group by p.ano_envio
   order by p.ano_envio desc
$$;


-- Só a chave de serviço executa (o Supabase concede EXECUTE a anon e authenticated
-- em toda função nova).
revoke execute on function public.painel_concluir(bigint, timestamptz, jsonb)                from public, anon, authenticated;
revoke execute on function public.painel_resumo(text, text, text, text, date, date)          from public, anon, authenticated;
revoke execute on function public.painel_por_orgao(text, text, integer, text, date, date)    from public, anon, authenticated;
revoke execute on function public.painel_municipios(text)                                    from public, anon, authenticated;
revoke execute on function public.painel_propostas_por_ano(text, text)                       from public, anon, authenticated;
grant  execute on function public.painel_concluir(bigint, timestamptz, jsonb)                to service_role;
grant  execute on function public.painel_resumo(text, text, text, text, date, date)          to service_role;
grant  execute on function public.painel_por_orgao(text, text, integer, text, date, date)    to service_role;
grant  execute on function public.painel_municipios(text)                                    to service_role;
grant  execute on function public.painel_propostas_por_ano(text, text)                       to service_role;
