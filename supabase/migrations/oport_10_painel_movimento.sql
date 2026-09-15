-- =============================================================================
-- oport_10 — Painel: última movimentação, tempos por ano, motivos dos aditivos e
-- físico × financeiro
--
-- Acrescenta à oport_9:
--   · painel_convenio: última movimentação (data, dias, fonte), aditivos de vigência e
--     o motivo do mais recente, percentual físico e a marca financeiro_sem_fisico;
--   · painel_etapa_ano: medianas por ano em que a etapa terminou;
--   · painel_aditivo_motivo: aditivos de vigência por recorte, ano e motivo;
--   · painel_resumo e painel_por_orgao com o filtro p_movimento e a visão "fisico".
--
-- Compatível com a página publicada: colunas novas não entram no select explícito
-- dela, e os parâmetros novos têm default nulo. Aplicar ANTES do job novo chegar à
-- main — sem as tabelas, a gravação da execução falha.
--
-- Depois da seguranca_1, objeto novo nasce sem grant: os grants abaixo são explícitos.
-- Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Colunas novas do convênio
-- -----------------------------------------------------------------------------
alter table public.painel_convenio add column if not exists dt_ultima_movimentacao date;
alter table public.painel_convenio add column if not exists dias_sem_movimentacao integer;
alter table public.painel_convenio add column if not exists ultima_movimentacao_tipo text;
alter table public.painel_convenio add column if not exists n_aditivos_vigencia integer not null default 0;
alter table public.painel_convenio add column if not exists motivo_aditivo text;
alter table public.painel_convenio add column if not exists pct_fisico numeric;
alter table public.painel_convenio add column if not exists financeiro_sem_fisico boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'painel_convenio_movimentacao_tipo_check') then
    alter table public.painel_convenio add constraint painel_convenio_movimentacao_tipo_check
      check (ultima_movimentacao_tipo in ('pagamento', 'desembolso', 'aditivo', 'prorrogacao', 'licitacao', 'historico'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Tempos por ano de término. Sem "ainda nesta etapa" (isso é estoque de hoje) e sem
-- "de quem é a vez" (só existe na janela de 36 meses).
-- -----------------------------------------------------------------------------
create table if not exists public.painel_etapa_ano (
  execucao_id bigint not null references public.painel_execucao (id) on delete cascade,
  recorte     text not null,
  dimensao    text not null check (dimensao in ('orgao', 'programa')),
  chave       text not null,
  rotulo      text,
  orgao_sup   text,
  etapa       text not null,
  ano_fim     integer not null,
  n           integer not null,
  mediana     numeric,
  p90         numeric
);
create index if not exists painel_etapa_ano_idx on public.painel_etapa_ano (execucao_id, recorte, dimensao, ano_fim);

-- -----------------------------------------------------------------------------
-- Motivos dos aditivos de vigência. Só a categoria: o texto da justificativa não é
-- gravado (há CPF em parte deles).
-- -----------------------------------------------------------------------------
create table if not exists public.painel_aditivo_motivo (
  execucao_id bigint not null references public.painel_execucao (id) on delete cascade,
  recorte     text not null,
  ano         integer not null,
  motivo      text not null,
  aditivos    integer not null,
  convenios   integer not null
);
create index if not exists painel_aditivo_motivo_idx on public.painel_aditivo_motivo (execucao_id, recorte, ano);

do $$
declare t text;
begin
  foreach t in array array['painel_etapa_ano', 'painel_aditivo_motivo'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- Fechar a execução apaga também as tabelas novas das execuções anteriores.
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
  delete from public.painel_etapa_ano         where execucao_id <> p_execucao;
  delete from public.painel_programa_desfecho where execucao_id <> p_execucao;
  delete from public.painel_proposta          where execucao_id <> p_execucao;
  delete from public.painel_aditivo_motivo    where execucao_id <> p_execucao;
end $$;


-- -----------------------------------------------------------------------------
-- Números de topo, agora com p_movimento:
--   'parado_1ano'  nenhuma movimentação há mais de 365 dias
--   'recente_30d'  alguma movimentação nos últimos 30 dias
-- Convênio sem nenhuma data de movimentação fica fora dos dois filtros.
-- Visão nova "fisico": financeiro >= 80% com físico < 30% (valor = desembolsado).
-- Chaves novas em "vigencia": motivo_<categoria> do aditivo de vigência mais recente.
-- -----------------------------------------------------------------------------
drop function if exists public.painel_resumo(text, text, text, text, date, date);

create or replace function public.painel_resumo(
  p_uf text default null,
  p_orgao text default null,
  p_ibge text default null,
  p_agente text default null,
  p_assinado_de date default null,
  p_assinado_ate date default null,
  p_movimento text default null
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
       and (p_movimento is null
            or (p_movimento = 'parado_1ano' and c.dias_sem_movimentacao > 365)
            or (p_movimento = 'recente_30d' and c.dias_sem_movimentacao <= 30))
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
  select 'vigencia', 'motivo_' || motivo_aditivo, count(*)::int, sum(greatest(coalesce(repasse, 0) - coalesce(desembolsado, 0), 0))
    from c where vigencia_faixa is not null and motivo_aditivo is not null group by motivo_aditivo
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
  select 'fisico', 'total', count(*)::int, sum(desembolsado) from c where financeiro_sem_fisico
  union all
  select 'fisico', 'fisico_zero', count(*)::int, sum(desembolsado) from c where financeiro_sem_fisico and pct_fisico = 0
  union all
  select 'fisico', 'parado_1ano', count(*)::int, sum(desembolsado) from c where financeiro_sem_fisico and dias_sem_movimentacao > 365
  union all
  select 'municipios', n_sinais::text, count(*)::int, null::numeric
    from public.painel_municipio m, ex
   where m.execucao_id = ex.id and (p_uf is null or m.uf = p_uf) and (p_ibge is null or m.cod_ibge = p_ibge)
   group by n_sinais
$$;


-- -----------------------------------------------------------------------------
-- Por órgão, com p_movimento e a visão "fisico" (destaque: sem movimentação há +1 ano).
-- -----------------------------------------------------------------------------
drop function if exists public.painel_por_orgao(text, text, integer, text, date, date);

create or replace function public.painel_por_orgao(
  p_visao text,
  p_uf text default null,
  p_limite integer default 15,
  p_ibge text default null,
  p_assinado_de date default null,
  p_assinado_ate date default null,
  p_movimento text default null
)
returns table (orgao text, n integer, valor numeric, destaque integer)
language plpgsql stable
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  if p_visao not in ('suspensiva', 'nunca', 'vigencia', 'contas', 'saldo', 'fisico') then
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
       and (p_movimento is null
            or (p_movimento = 'parado_1ano' and c.dias_sem_movimentacao > 365)
            or (p_movimento = 'recente_30d' and c.dias_sem_movimentacao <= 30))
  ),
  v as (
    select coalesce(orgao_sup, '(sem órgão)') orgao,
           case p_visao when 'vigencia' then greatest(coalesce(repasse, 0) - coalesce(desembolsado, 0), 0)
                        when 'saldo' then coalesce(saldo_conta, 0)
                        when 'fisico' then coalesce(desembolsado, 0)
                        else coalesce(repasse, 0) end valor,
           case p_visao when 'suspensiva' then suspensiva_faixa in ('vencido', 'ate_30', '31_90')
                        when 'nunca' then aceite_parado
                        when 'vigencia' then vigencia_faixa in ('vencida', 'ate_90')
                        when 'contas' then coalesce(contas_parada_1ano, false)
                        when 'fisico' then coalesce(dias_sem_movimentacao > 365, false)
                        else coalesce(nunca_pagou, false) end destaque
      from c
     where case p_visao when 'suspensiva' then em_suspensiva
                        when 'nunca' then nunca_desembolsado
                        when 'vigencia' then vigencia_faixa is not null
                        when 'contas' then contas_lado is not null or tce
                        when 'fisico' then financeiro_sem_fisico
                        else saldo_parado end
  )
  select v.orgao, count(*)::int, sum(v.valor), (count(*) filter (where v.destaque))::int
    from v
   group by v.orgao
   order by 2 desc, 3 desc
   limit greatest(1, least(coalesce(p_limite, 15), 100));
end $$;


revoke execute on function public.painel_concluir(bigint, timestamptz, jsonb)                    from public, anon, authenticated;
revoke execute on function public.painel_resumo(text, text, text, text, date, date, text)        from public, anon, authenticated;
revoke execute on function public.painel_por_orgao(text, text, integer, text, date, date, text)  from public, anon, authenticated;
grant  execute on function public.painel_concluir(bigint, timestamptz, jsonb)                    to service_role;
grant  execute on function public.painel_resumo(text, text, text, text, date, date, text)        to service_role;
grant  execute on function public.painel_por_orgao(text, text, integer, text, date, date, text)  to service_role;
