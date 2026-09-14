-- =============================================================================
-- oport_8 — Painel de execução da PONTE
--
-- Onde o dinheiro dos convênios trava, a partir dos arquivos do Transferegov:
-- cláusula suspensiva, nunca desembolsado, vigência em risco, prestação de contas,
-- saldo parado, municípios com sinais (Parte A), tempos por etapa e desfecho das
-- propostas por programa (Parte B).
--
-- Uso EXCLUSIVO da PONTE. Quem grava é o job `painel_execucao/` do monorepo
-- privado, com a chave de serviço; quem lê é a página `/mapa/painel`, no servidor,
-- também com a chave de serviço, depois de conferir que o e-mail está em
-- OPORTUNIDADES_ADMINS. Nenhuma tabela ou função é acessível a `anon` ou
-- `authenticated` — mesmo desenho da oport_7.
--
-- Idempotente. Independe das migrations anteriores. As tabelas da Parte B nascem
-- vazias e passam a ser gravadas quando o job ganhar a Parte B, sem nova migração.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Execuções. A página lê sempre a última CONCLUÍDA.
-- -----------------------------------------------------------------------------
create table if not exists public.painel_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- Último carimbo do histórico. As faixas ("vence em 30 dias") contam a partir do
  -- dia que o arquivo retrata, não do dia em que o job rodou.
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);

create index if not exists painel_execucao_concluida_idx
  on public.painel_execucao (concluida_em desc) where status = 'concluida';

-- -----------------------------------------------------------------------------
-- Uma linha por convênio que entra em alguma visão. As marcas de cada visão ficam
-- nas próprias colunas; nulo quer dizer "não se aplica", e não "falso".
-- -----------------------------------------------------------------------------
create table if not exists public.painel_convenio (
  execucao_id            bigint not null references public.painel_execucao (id) on delete cascade,
  nr_convenio            text not null,
  id_proposta            text,
  uf                     text,
  municipio              text,
  cod_ibge               text,
  proponente             text,
  natureza               text,
  tipo_agente            text,
  orgao_sup              text,
  cod_programa           text,
  programa               text,
  modalidade             text,
  objeto                 text,
  situacao               text,
  subsituacao            text,
  situacao_contratacao   text,
  dt_assinatura          date,
  dt_fim_vigencia        date,
  repasse                numeric,
  empenhado              numeric,
  desembolsado           numeric,
  saldo_conta            numeric,
  rendimento_implicito   numeric,
  dt_primeiro_desembolso date,
  dt_ultimo_pagamento    date,
  dias_sem_movimento     integer,
  n_extensoes            integer,
  -- 1 · cláusula suspensiva
  em_suspensiva          boolean not null default false,
  suspensiva_prazo       date,
  suspensiva_dias        integer,
  suspensiva_faixa       text check (suspensiva_faixa in ('vencido', 'ate_30', '31_90', '91_180', 'mais_180')),
  exige_titularidade     boolean,
  exige_projeto          boolean,
  exige_licenca          boolean,
  exige_sustentabilidade boolean,
  exige_termo_referencia boolean,
  -- 2 · nunca desembolsado
  nunca_desembolsado     boolean not null default false,
  grupo_suspensiva       text check (grupo_suspensiva in ('pendente', 'retirada', 'nunca_teve')),
  etapa_licitacao        text check (etapa_licitacao in ('suspensiva', 'sem_licitacao', 'sem_homologacao', 'sem_aceite', 'aceita')),
  dt_aceite              date,
  aceite_parado          boolean not null default false,
  -- 3 · vigência
  vigencia_faixa         text check (vigencia_faixa in ('vencida', 'ate_90', '91_180')),
  dias_para_fim          integer,
  pct_desembolsado       numeric,
  -- 4 · prestação de contas
  contas_lado            text check (contas_lado in ('convenente', 'concedente', 'negativo')),
  contas_atrasada        boolean,
  contas_parada_1ano     boolean,
  tce                    boolean not null default false,
  dias_apos_limite       integer,
  dias_com_concedente    integer,
  -- 7 · saldo
  saldo_faixa            text check (saldo_faixa in ('ate_90', '91_180', '181_365', 'mais_365')),
  saldo_parado           boolean not null default false,
  nunca_pagou            boolean
);

create index if not exists painel_convenio_uf_idx on public.painel_convenio (execucao_id, uf);
create index if not exists painel_convenio_orgao_idx on public.painel_convenio (execucao_id, orgao_sup);

-- -----------------------------------------------------------------------------
-- Municípios com pelo menos um sinal. Contagem de sinais, sem índice ponderado.
-- -----------------------------------------------------------------------------
create table if not exists public.painel_municipio (
  execucao_id            bigint not null references public.painel_execucao (id) on delete cascade,
  cod_ibge               text not null,
  uf                     text,
  municipio              text,
  n_sinais               integer not null,
  sinal_saldo            boolean not null,
  n_saldo                integer not null default 0,
  valor_saldo            numeric not null default 0,
  sinal_suspensiva       boolean not null,
  n_suspensiva           integer not null default 0,
  valor_suspensiva       numeric not null default 0,
  sinal_contas_atrasadas boolean not null,
  n_contas_atrasadas     integer not null default 0,
  sinal_contas_negativas boolean not null,
  n_contas_negativas     integer not null default 0,
  sinal_sem_desembolso   boolean not null,
  n_sem_desembolso       integer not null default 0,
  valor_sem_desembolso   numeric not null default 0
);

create index if not exists painel_municipio_idx on public.painel_municipio (execucao_id, uf, n_sinais desc);

-- -----------------------------------------------------------------------------
-- Parte B · tempos por etapa. `recorte` é 'BR' ou a UF; `dimensao` é órgão ou programa.
-- -----------------------------------------------------------------------------
create table if not exists public.painel_etapa_tempo (
  execucao_id          bigint not null references public.painel_execucao (id) on delete cascade,
  recorte              text not null,
  dimensao             text not null check (dimensao in ('orgao', 'programa')),
  chave                text not null,
  rotulo               text,
  orgao_sup            text,
  etapa                text not null,
  n                    integer not null,
  mediana              numeric,
  p90                  numeric,
  em_aberto            integer,
  idade_mediana_aberto numeric
);

create index if not exists painel_etapa_tempo_idx on public.painel_etapa_tempo (execucao_id, recorte, dimensao);

-- -----------------------------------------------------------------------------
-- Parte B · desfecho das propostas enviadas, por programa × ano do 1º envio × UF.
-- -----------------------------------------------------------------------------
create table if not exists public.painel_programa_desfecho (
  execucao_id           bigint not null references public.painel_execucao (id) on delete cascade,
  cod_programa          text,
  programa              text,
  orgao_sup             text,
  ano_envio             integer not null,
  uf                    text,
  enviadas              integer not null default 0,
  assinadas             integer not null default 0,
  reprovadas            integer not null default 0,
  reprovadas_lote       integer not null default 0,
  impedimento           integer not null default 0,
  impedimento_lote      integer not null default 0,
  eliminadas            integer not null default 0,
  abertas_concedente    integer not null default 0,
  limbo                 integer not null default 0,
  abertas_proponente    integer not null default 0,
  aguardando_assinatura integer not null default 0,
  com_emenda            integer not null default 0,
  assinadas_com_emenda  integer not null default 0,
  valor_pedido          numeric not null default 0
);

create index if not exists painel_programa_desfecho_idx on public.painel_programa_desfecho (execucao_id, uf, ano_envio);

-- -----------------------------------------------------------------------------
-- Acesso: só a chave de serviço.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['painel_execucao', 'painel_convenio', 'painel_municipio', 'painel_etapa_tempo', 'painel_programa_desfecho'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.painel_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.painel_execucao_id_seq to service_role;


-- =============================================================================
-- Funções
-- =============================================================================

-- Fecha a execução e apaga os dados das anteriores, na mesma transação.
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
end $$;


create or replace function public.painel_ultima_execucao()
returns setof public.painel_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.painel_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;


-- -----------------------------------------------------------------------------
-- Números de topo das visões de convênio. `p_uf` nulo = Brasil; `p_orgao` nulo =
-- todos os órgãos (não se aplica aos municípios, que somam todos os órgãos).
-- Uma linha por (visão, chave); `valor` é o dinheiro que a visão mede:
--   suspensiva, nunca, contas → repasse
--   vigencia                  → repasse ainda a desembolsar
--   saldo                     → saldo em conta (e rendimento, na chave própria)
-- -----------------------------------------------------------------------------
create or replace function public.painel_resumo(p_uf text default null, p_orgao text default null)
returns table (visao text, chave text, n integer, valor numeric)
language sql stable
set search_path to 'public'
as $$
  with ex as (select id from public.painel_ultima_execucao()),
  c as (
    select c.* from public.painel_convenio c, ex
     where c.execucao_id = ex.id and (p_uf is null or c.uf = p_uf)
       and (p_orgao is null or c.orgao_sup = p_orgao)
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
   where m.execucao_id = ex.id and (p_uf is null or m.uf = p_uf)
   group by n_sinais
$$;


-- -----------------------------------------------------------------------------
-- Visão por órgão concedente. `destaque` é o subconjunto urgente de cada visão:
--   suspensiva → vence em até 90 dias (inclui vencidas)
--   nunca      → aceite da licitação há +90 dias
--   vigencia   → vence em até 90 dias (inclui vencidas)
--   contas     → parada há mais de um ano
--   saldo      → parado sem nunca ter pago
-- -----------------------------------------------------------------------------
create or replace function public.painel_por_orgao(p_visao text, p_uf text default null, p_limite integer default 15)
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


-- Só a chave de serviço executa. O Supabase concede EXECUTE a anon e
-- authenticated em toda função nova; sem este revoke, ficariam chamáveis pela API.
revoke execute on function public.painel_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.painel_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.painel_resumo(text, text)                   from public, anon, authenticated;
revoke execute on function public.painel_por_orgao(text, text, integer)       from public, anon, authenticated;
grant  execute on function public.painel_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.painel_ultima_execucao()                    to service_role;
grant  execute on function public.painel_resumo(text, text)                   to service_role;
grant  execute on function public.painel_por_orgao(text, text, integer)       to service_role;
