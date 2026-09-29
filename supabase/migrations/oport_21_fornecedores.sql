-- =============================================================================
-- oport_21 — fornecedores dos convênios da PB (onda 12, parte 3)
--
-- O painel administrativo de fornecedores cruza cada empresa com todos os instrumentos da PB,
-- mostra a concentração por município e marca quem está na lista de inidôneos do TCU. O laudo do
-- instrumento ganha a seção "Fornecedores". Decisão do titular (29/09/2026): pessoa física só
-- somada, sem nome; pessoa jurídica com nome, inclusive MEI e empresário individual, só para
-- administradores, com qualquer CPF da razão social trocado por "***".
--
--   · painel_fornecedor: uma empresa por linha — atuação na PB (convênios, municípios,
--     proponentes, órgãos, valor pago, contratos) e no Brasil (convênios, UFs, valor), com a
--     marca do TCU (vazia quando a lista não pôde ser lida: "não verificado" não é "limpo");
--   · painel_fornecedor_convenio: empresa × convênio da PB, com o valor pago, a fatia no que o
--     convênio pagou a pessoa jurídica e os contratos;
--   · painel_contrato: os contratos dos convênios da PB. Contrato com pessoa física fica sem
--     fornecedor (só tipo, objeto mascarado, valor e datas);
--   · painel_fornecedor_municipio: concentração nos convênios de cada prefeitura (o Estado e as
--     entidades têm o IBGE do município-sede e ficam fora): maior fornecedor, fatia dele e HHI;
--   · painel_instrumento ganha, para os da PB: o que foi pago a pessoa jurídica, a pessoa física
--     (ou sem CNPJ) e ao próprio convenente; quantos fornecedores; empenho corrente × capital;
--     datas do ingresso da contrapartida; e a coordenada da obra;
--   · painel_limpar recolhe também as quatro tabelas novas.
--
-- ORDEM: esta migração ANTES do job novo chegar à `main`. Sem as colunas e as tabelas, a gravação
-- do painel falha inteira (o PostgREST recusa coluna desconhecida). O site tolera as duas ordens.
--
-- Leitura só pelo servidor, com a chave de serviço (grants explícitos, como na seguranca_1).
-- Aditiva e idempotente.
-- =============================================================================

alter table public.painel_instrumento add column if not exists pago_pj                            numeric;
alter table public.painel_instrumento add column if not exists pago_pf                            numeric;
alter table public.painel_instrumento add column if not exists n_pagamentos_pf                    integer;
alter table public.painel_instrumento add column if not exists pago_convenente                    numeric;
alter table public.painel_instrumento add column if not exists n_fornecedores_pj                  integer;
alter table public.painel_instrumento add column if not exists empenhado_corrente                 numeric;
alter table public.painel_instrumento add column if not exists empenhado_capital                  numeric;
alter table public.painel_instrumento add column if not exists dt_primeiro_ingresso_contrapartida date;
alter table public.painel_instrumento add column if not exists dt_ultimo_ingresso_contrapartida   date;
alter table public.painel_instrumento add column if not exists n_ingressos_contrapartida          integer;
alter table public.painel_instrumento add column if not exists latitude                           numeric;
alter table public.painel_instrumento add column if not exists longitude                          numeric;

comment on column public.painel_instrumento.pago_pf is
  'Pago a pessoa física ou a favorecido sem CNPJ (CPF mascarado, vazio, estrangeiro). Só a soma: sem nome.';
comment on column public.painel_instrumento.pago_convenente is
  'OBTV para o convenente ou para o executor, e pagamento ao próprio CNPJ do proponente: não é fornecedor.';

create table if not exists public.painel_fornecedor (
  execucao_id           bigint not null references public.painel_execucao (id) on delete cascade,
  cnpj                  text not null,
  nome                  text,
  -- Razão social com CPF ou começando pela raiz do CNPJ ("12.345.678 FULANO"): o padrão do MEI.
  mei                   boolean not null default false,
  pb_convenios          integer not null default 0,
  pb_municipios         integer not null default 0,
  pb_proponentes        integer not null default 0,
  pb_orgaos             integer not null default 0,
  pb_pago               numeric not null default 0,
  pb_n_pagamentos       integer not null default 0,
  pb_primeiro_pagamento date,
  pb_ultimo_pagamento   date,
  pb_contratos          integer not null default 0,
  pb_contratado         numeric not null default 0,
  br_convenios          integer not null default 0,
  br_ufs                integer not null default 0,
  br_pago               numeric not null default 0,
  -- Null = lista do TCU não verificada nesta execução.
  inidoneo_tcu          boolean,
  tcu_acordao           text,
  tcu_inicio            date,
  tcu_data_final        date,
  tcu_link              text,
  primary key (execucao_id, cnpj)
);

create table if not exists public.painel_fornecedor_convenio (
  execucao_id        bigint not null references public.painel_execucao (id) on delete cascade,
  cnpj               text not null,
  nr_convenio        text not null,
  cod_ibge           text,
  municipio          text,
  proponente         text,
  tipo_agente        text,
  orgao_sup          text,
  cod_programa       text,
  pago               numeric not null default 0,
  n_pagamentos       integer not null default 0,
  primeiro_pagamento date,
  ultimo_pagamento   date,
  -- Fatia no que o convênio pagou a pessoa jurídica (0 a 1).
  fatia              numeric,
  n_contratos        integer not null default 0,
  contratado         numeric not null default 0
);
create index if not exists painel_fornecedor_convenio_cnpj_idx on public.painel_fornecedor_convenio (execucao_id, cnpj);
create index if not exists painel_fornecedor_convenio_nr_idx   on public.painel_fornecedor_convenio (execucao_id, nr_convenio);

create table if not exists public.painel_contrato (
  execucao_id        bigint not null references public.painel_execucao (id) on delete cascade,
  nr_convenio        text not null,
  -- O ID_CONTRATO do SICONV não é único (o mesmo número aparece em licitações e fornecedores diferentes).
  id_licitacao       text not null,
  id_contrato        text not null,
  nr_contrato        text,
  cnpj               text,
  fornecedor         text,
  pessoa_fisica      boolean not null default false,
  tipo_aquisicao     text,
  objeto             text,
  valor              numeric,
  dt_assinatura      date,
  dt_publicacao      date,
  dt_inicio_vigencia date,
  dt_fim_vigencia    date
);
create index if not exists painel_contrato_nr_idx   on public.painel_contrato (execucao_id, nr_convenio);
create index if not exists painel_contrato_cnpj_idx on public.painel_contrato (execucao_id, cnpj);

create table if not exists public.painel_fornecedor_municipio (
  execucao_id    bigint not null references public.painel_execucao (id) on delete cascade,
  cod_ibge       text not null,
  municipio      text,
  convenios      integer not null default 0,
  n_fornecedores integer not null default 0,
  pago_pj        numeric not null default 0,
  pago_pf        numeric not null default 0,
  maior_cnpj     text,
  maior_nome     text,
  maior_pago     numeric,
  maior_fatia    numeric,
  -- Índice Herfindahl-Hirschman: soma dos quadrados das fatias (1 = um fornecedor só).
  hhi            numeric,
  primary key (execucao_id, cod_ibge)
);

do $$
declare t text;
begin
  foreach t in array array['painel_fornecedor', 'painel_fornecedor_convenio', 'painel_contrato',
                           'painel_fornecedor_municipio'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- Limpeza em lotes: a mesma da oport_19, com as tabelas novas na lista.
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
                             'painel_instrumento', 'painel_instrumento_evento', 'painel_instrumento_emenda',
                             'painel_fornecedor', 'painel_fornecedor_convenio', 'painel_contrato',
                             'painel_fornecedor_municipio'] loop
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

revoke execute on function public.painel_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.painel_limpar(bigint, integer) to service_role;
