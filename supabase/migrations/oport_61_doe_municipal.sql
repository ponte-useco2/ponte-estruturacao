-- =============================================================================
-- oport_61 — Diário Oficial do Estado e Transparência PB no relatório do município (30/10/2026)
--
-- A sessão DOE-PB ("Reconhecimento de padrões DOEPB", D:\doe_PB) classifica os atos do Diário Oficial do Estado e lê a
-- API da Transparência PB; o modelo é `docs/municipios/modelo_relatorio_municipal.md` (v0.2, aprovado pelo titular em
-- 30/10). Ela NÃO escreve no Supabase: exporta um pacote (JSONL + manifesto com sha256), e `doe_municipal/carregar.py`
-- (monorepo) confere e grava aqui, pelo `publicar_execucao` (prefixo `doe`).
--
-- Cinco conjuntos, todos pelo IBGE de 7 dígitos:
--   doe_ato_municipio           um ato de prefeitura ou câmara publicado no DOE, com o PDF público e a página. Sem
--                               texto, sem título, sem nome de pessoa; "pessoal" só conta (sem número). CNPJ só de PJ
--                               com dígito verificador válido; valor sempre "a conferir". O `ato_id` é da execução do
--                               DOE-PB: nunca ligar entre execuções.
--   doe_mes_municipio           os mesmos atos por mês × classe (o que a página lê; a lista ato a ato é só admin).
--   tpb_repasse_municipio       o que o Estado pagou ao CNPJ da prefeitura (confiança alta) ou a fundo/órgão municipal
--                               pelo nome do credor (média), sem nota de emenda (essas estão em `epb_*`). Cada linha diz
--                               se é transferência ou pagamento direto à prefeitura (tributo, tarifa, ressarcimento).
--   tpb_despesa_local_municipio a despesa do Estado com o município informado na nota: "a conferir" (o campo não é o
--                               do credor, e sem local a nota cai na capital — por isso João Pessoa fica FORA).
--   tpb_convenio_municipio      os convênios do Estado (CGE), com o tipo do convenente: "ente municipal" ou "sediado
--                               no município" — duas listas que nunca se somam.
--
-- Só `service_role` lê e grava: a página lê pelo servidor, depois de conferir o acesso.
-- ORDEM: aplicar ANTES de carregar o primeiro pacote. Idempotente. Sem pré-requisito.
-- =============================================================================

create table if not exists public.doe_execucao (
  id             bigint generated always as identity primary key,
  iniciada_em    timestamptz not null default now(),
  concluida_em   timestamptz,
  status         text not null check (status in ('gravando', 'concluida', 'erro')),
  dado_ate       timestamptz,
  referencia     date,
  arquivos       jsonb not null default '{}'::jsonb,
  contagens      jsonb not null default '{}'::jsonb,
  erro           text,
  versao_pacote  text,
  sha256_pacote  text check (sha256_pacote ~ '^[0-9a-f]{64}$'),
  escopo         jsonb not null default '[]'::jsonb,   -- os IBGE do pacote (amostra) ou os 223
  regras         jsonb not null default '{}'::jsonb    -- as regras do manifesto (classes, confiança, município, OCR)
);
create index if not exists doe_execucao_concluida_idx on public.doe_execucao (concluida_em desc) where status = 'concluida';
create unique index if not exists doe_execucao_pacote_idx on public.doe_execucao (sha256_pacote) where status = 'concluida';

create table if not exists public.doe_ato_municipio (
  execucao_id       bigint not null references public.doe_execucao (id) on delete cascade,
  cod_ibge          text not null check (cod_ibge ~ '^25[0-9]{5}$'),
  ato_id            bigint not null,
  data_ato          date,
  data_edicao       date not null,
  pagina            integer,
  link              text not null check (link ~ '^https://'),
  link_edicao       text,
  esfera            text not null,
  orgao             text,
  tipo              text,
  classe            text not null,
  subclasse         text,
  numero            text,
  cnpjs             text[] not null default '{}',
  valor_max         numeric,
  origem_texto      text,
  confianca         text not null,
  ligacao_municipio text,
  primary key (execucao_id, cod_ibge, ato_id)
);
create index if not exists doe_ato_municipio_data_idx on public.doe_ato_municipio (execucao_id, cod_ibge, data_edicao desc);

create table if not exists public.doe_mes_municipio (
  execucao_id      bigint not null references public.doe_execucao (id) on delete cascade,
  cod_ibge         text not null,
  mes              text not null check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  esfera           text not null,
  classe           text not null,
  subclasse        text not null default '',
  n_atos           integer not null,
  valor_max_soma   numeric,
  confianca_classe text,
  primary key (execucao_id, cod_ibge, mes, esfera, classe, subclasse)
);

create table if not exists public.tpb_repasse_municipio (
  execucao_id    bigint not null references public.doe_execucao (id) on delete cascade,
  ordem          integer not null,
  cod_ibge       text not null,
  mes            text not null check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  orgao          text,
  funcao         text,
  grupo_natureza text,
  modalidade     text,
  tipo_pagamento text not null,
  credor         text not null,
  confianca      text not null,
  n_notas        integer,
  empenhado      numeric,
  pago           numeric,
  primary key (execucao_id, ordem)
);
create index if not exists tpb_repasse_municipio_ibge_idx on public.tpb_repasse_municipio (execucao_id, cod_ibge);

create table if not exists public.tpb_despesa_local_municipio (
  execucao_id    bigint not null references public.doe_execucao (id) on delete cascade,
  ordem          integer not null,
  cod_ibge       text not null,
  mes            text not null check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  orgao          text,
  funcao         text,
  grupo_natureza text,
  modalidade     text,
  confianca      text not null,
  n_notas        integer,
  empenhado      numeric,
  pago           numeric,
  primary key (execucao_id, ordem)
);
create index if not exists tpb_despesa_local_municipio_ibge_idx on public.tpb_despesa_local_municipio (execucao_id, cod_ibge);

create table if not exists public.tpb_convenio_municipio (
  execucao_id         bigint not null references public.doe_execucao (id) on delete cascade,
  ordem               integer not null,
  cod_ibge            text not null,
  ano                 integer,
  cadastro_cge        text,
  numero              text,
  instrumento         text,
  concedente          text,
  convenente          text,
  convenente_tipo     text not null check (convenente_tipo in ('ente municipal', 'sediado no município')),
  objeto              text,
  inicio              date,
  fim                 date,
  valor_concedente    numeric,
  valor_contrapartida numeric,
  valor_aditivos      numeric,
  valor_total         numeric,
  link                text,
  primary key (execucao_id, ordem)
);
create index if not exists tpb_convenio_municipio_ibge_idx on public.tpb_convenio_municipio (execucao_id, cod_ibge);

do $$
declare
  t text;
begin
  foreach t in array array['doe_execucao', 'doe_ato_municipio', 'doe_mes_municipio', 'tpb_repasse_municipio',
                           'tpb_despesa_local_municipio', 'tpb_convenio_municipio'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.doe_execucao_id_seq from public, anon, authenticated;
grant usage, select on sequence public.doe_execucao_id_seq to service_role;

create or replace function public.doe_ultima_execucao()
returns setof public.doe_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.doe_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.doe_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.doe_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga, em lotes, as linhas de execuções que não são a última concluída nem `p_manter`, uma tabela por vez; o
-- carregador chama até voltar 0.
create or replace function public.doe_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.doe_ultima_execucao()), p_manter], null);
  lim    integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  t      text;
  n      integer;
begin
  foreach t in array array['doe_ato_municipio', 'doe_mes_municipio', 'tpb_repasse_municipio',
                           'tpb_despesa_local_municipio', 'tpb_convenio_municipio'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id <> all ($1) limit $2))', t, t)
      using manter, lim;
    get diagnostics n = row_count;
    if n > 0 then
      return n;
    end if;
  end loop;
  return 0;
end $$;

revoke execute on function public.doe_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.doe_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.doe_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.doe_ultima_execucao()                    to service_role;
grant  execute on function public.doe_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.doe_limpar(bigint, integer)               to service_role;

notify pgrst, 'reload schema';
