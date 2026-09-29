-- =============================================================================
-- oport_22 — dinheiro federal nas despesas dos municípios da PB (TCE-PB) × SICONV (onda 12, parte 3B)
--
-- As despesas abertas do TCE-PB (um arquivo por município e ano) trazem o credor, a fonte de recurso,
-- o código de acompanhamento da emenda, o grupo de natureza e o elemento de despesa, a licitação e a
-- obra, mas não o número do convênio. Duas frentes, decididas pelo titular em 29/09/2026:
--
--   · Pix: a transferência especial da União (fonte 706) como o município gastou — pessoal, dívida,
--     investimento (a CF, art. 166-A, § 1º, veda os dois primeiros; o § 5º pede ao menos 70% em capital), emenda,
--     licitação e obra, e as empresas que receberam;
--   · conciliação: o que o SICONV pagou a empresas nos convênios das prefeituras, casado com o TCE pelo
--     par (município, CNPJ, ano); e o dinheiro de convênio federal no TCE (fontes 700, 631, 570) sem par
--     no SICONV. No estudo, 93–98% do pago no SICONV aparece no TCE.
--
-- Privacidade: o TCE publica o CPF do credor pessoa física sem máscara (com "000" na frente). O job
-- não grava documento nem nome de pessoa física em lugar nenhum: só o valor somado por município e ano.
-- Empresa (inclusive MEI) com nome, só para administradores, com o CPF da razão social mascarado.
--
--   · tce_execucao e as funções tce_ultima_execucao / tce_concluir / tce_limpar (o desenho do Pix, oport_13);
--   · tce_cobertura: que arquivo (município × ano) foi lido, e por que não, quando não;
--   · tce_pix_municipio, tce_pix_credor, tce_federal_par e tce_federal_municipio.
--
-- ORDEM: esta migração ANTES do job novo chegar à `main` (sem as tabelas, a gravação falha inteira).
-- Leitura só pelo servidor, com a chave de serviço (grants explícitos). Aditiva e idempotente.
-- =============================================================================

create table if not exists public.tce_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- A data mais recente entre os arquivos do TCE-PB lidos.
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists tce_execucao_concluida_idx on public.tce_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.tce_cobertura (
  execucao_id bigint not null references public.tce_execucao (id) on delete cascade,
  ibge        text not null,
  ano         integer not null,
  lido        boolean not null default false,
  modificado  timestamptz,
  tamanho     bigint,
  coletado_em timestamptz,
  motivo      text,
  primary key (execucao_id, ibge, ano)
);

create table if not exists public.tce_pix_municipio (
  execucao_id            bigint not null references public.tce_execucao (id) on delete cascade,
  ibge                   text not null,
  ano                    integer not null,
  municipio              text,
  empenhado              numeric not null default 0,
  liquidado              numeric not null default 0,
  pago                   numeric not null default 0,
  -- Pago por grupo de natureza da despesa.
  pago_pessoal           numeric not null default 0,
  pago_juros             numeric not null default 0,
  pago_correntes         numeric not null default 0,
  pago_investimentos     numeric not null default 0,
  pago_inversoes         numeric not null default 0,
  pago_amortizacao       numeric not null default 0,
  -- Capital para a CF, art. 166-A, § 5º: investimentos e inversões sobre o pago. A amortização fica fora, porque o
  -- § 5º ressalva a vedação do serviço da dívida (§ 1º, II). Null sem pagamento.
  pct_capital            numeric,
  n_empenhos             integer not null default 0,
  n_credores_pj          integer not null default 0,
  pago_pj                numeric not null default 0,
  -- Pago a pessoa física ou a credor sem CNPJ: só a soma.
  pago_pf                numeric not null default 0,
  pago_emenda_individual numeric not null default 0,
  pago_emenda_bancada    numeric not null default 0,
  pago_emenda_comissao   numeric not null default 0,
  pago_com_licitacao     numeric not null default 0,
  pago_com_obra          numeric not null default 0,
  primary key (execucao_id, ibge, ano)
);

create table if not exists public.tce_pix_credor (
  execucao_id        bigint not null references public.tce_execucao (id) on delete cascade,
  ibge               text not null,
  ano                integer not null,
  cnpj               text not null,
  nome               text,
  pago               numeric not null default 0,
  pago_investimentos numeric not null default 0,
  n_empenhos         integer not null default 0,
  primary key (execucao_id, ibge, ano, cnpj)
);
create index if not exists tce_pix_credor_cnpj_idx on public.tce_pix_credor (execucao_id, cnpj);

create table if not exists public.tce_federal_par (
  execucao_id  bigint not null references public.tce_execucao (id) on delete cascade,
  ibge         text not null,
  ano          integer not null,
  cnpj         text not null,
  nome         text,
  -- O que o TCE registra pago a este CNPJ no município e ano: fonte de convênio federal, Pix e o resto.
  tce_convenio numeric not null default 0,
  tce_pix      numeric not null default 0,
  tce_outras   numeric not null default 0,
  -- O que o SICONV registra pago a este CNPJ nos convênios da administração municipal, no ano.
  siconv       numeric not null default 0,
  convenios    text[] not null default '{}',
  situacao     text not null check (situacao in ('casado', 'casado_ano_seguinte', 'casado_ano_anterior', 'so_siconv', 'so_tce',
                                                 'nao_verificado')),
  primary key (execucao_id, ibge, ano, cnpj)
);
create index if not exists tce_federal_par_cnpj_idx     on public.tce_federal_par (execucao_id, cnpj);
create index if not exists tce_federal_par_situacao_idx on public.tce_federal_par (execucao_id, situacao);

create table if not exists public.tce_federal_municipio (
  execucao_id           bigint not null references public.tce_execucao (id) on delete cascade,
  ibge                  text not null,
  ano                   integer not null,
  municipio             text,
  coberto               boolean not null default false,
  siconv_pj             numeric not null default 0,
  siconv_casado         numeric not null default 0,
  siconv_so             numeric not null default 0,
  siconv_nao_verificado numeric not null default 0,
  tce_convenio_pj       numeric not null default 0,
  tce_convenio_pf       numeric not null default 0,
  tce_convenio_casado   numeric not null default 0,
  tce_convenio_so       numeric not null default 0,
  n_so_siconv           integer not null default 0,
  n_so_tce              integer not null default 0,
  primary key (execucao_id, ibge, ano)
);

do $$
declare t text;
begin
  foreach t in array array['tce_execucao', 'tce_cobertura', 'tce_pix_municipio', 'tce_pix_credor', 'tce_federal_par',
                           'tce_federal_municipio'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.tce_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.tce_execucao_id_seq to service_role;


-- =============================================================================
-- Funções (o mesmo desenho de pix_ultima_execucao / pix_concluir / pix_limpar, oport_13)
-- =============================================================================

create or replace function public.tce_ultima_execucao()
returns setof public.tce_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.tce_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.tce_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.tce_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter. Devolve quantas apagou;
-- 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como histórico.
create or replace function public.tce_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.tce_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.tce_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['tce_cobertura', 'tce_pix_municipio', 'tce_pix_credor', 'tce_federal_par', 'tce_federal_municipio'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.tce_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.tce_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.tce_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.tce_ultima_execucao()                    to service_role;
grant  execute on function public.tce_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.tce_limpar(bigint, integer)               to service_role;
