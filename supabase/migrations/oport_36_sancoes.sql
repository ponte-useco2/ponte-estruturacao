-- =============================================================================
-- oport_36 — Sanções CEIS e CNEP dos fornecedores da PB, pela API do Portal da Transparência (D1, 08/10/2026)
--
-- Decisão do titular (29/09/2026): CEIS e CNEP entram só pela API de dados do Portal da Transparência, com a
-- chave dele (segredo PORTAL_TRANSPARENCIA_CHAVE do GitHub). O download direto tem CAPTCHA, que não se contorna.
-- O job `sancoes` (semanal, `sancoes.yml`) consulta por CNPJ as empresas de `painel_fornecedor` da última execução
-- do painel (~4,4 mil; a filial leva junto a consulta da matriz, porque a sanção vale para a empresa inteira):
--
--   · sancao_execucao e as funções sancao_ultima_execucao / sancao_concluir / sancao_limpar (o desenho da oport_25);
--   · sancao_consulta: a cobertura — cada CNPJ consultado, quando, quantos registros, ou o erro. É o que permite
--     dizer "sem registro no CEIS/CNEP na consulta de DD/MM" em vez de só "não há linha";
--   · sancao_registro: uma linha por sanção de pessoa jurídica: cadastro, tipo, órgão sancionador e UF dele,
--     vigência, processo, link da publicação e se está vigente na data da consulta.
--
-- Privacidade: a consulta é só por CNPJ. O job descarta na chegada qualquer registro cujo sancionado não seja um
-- CNPJ da mesma empresa, e de todo registro guarda só os campos abaixo: nenhum nome, CPF, texto da publicação ou
-- informação adicional do órgão. O `check` dos CNPJs (14 posições) impede, também no banco, que um CPF entre.
--
-- ORDEM: esta migração ANTES do job chegar à `main`. Leitura só pelo servidor, com a chave de serviço (grants
-- explícitos). Aditiva e idempotente. Pré-requisito: nenhum (o job lê `painel_fornecedor`, da oport_21).
-- =============================================================================

create table if not exists public.sancao_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- A hora em que a rodada começou (a API responde o cadastro do momento).
  dado_ate     timestamptz,
  -- A data da consulta, em Brasília: é contra ela que "vigente" é medido.
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists sancao_execucao_concluida_idx on public.sancao_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.sancao_consulta (
  execucao_id   bigint not null references public.sancao_execucao (id) on delete cascade,
  -- O fornecedor (14 posições; aceita o alfanumérico: 12 letras ou dígitos + 2 dígitos verificadores).
  cnpj          text not null check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  -- Filial: o CNPJ da matriz, consultado também. null na matriz.
  matriz        text check (matriz is null or matriz ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  consultado_em timestamptz,
  -- null quando a consulta falhou ou não coube na rodada (o motivo em `erro`).
  n_ceis        integer,
  n_cnep        integer,
  n_vigentes    integer,
  erro          text,
  primary key (execucao_id, cnpj)
);

create table if not exists public.sancao_registro (
  execucao_id     bigint not null references public.sancao_execucao (id) on delete cascade,
  -- O fornecedor a que a sanção se aplica.
  cnpj            text not null check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  -- O CNPJ no registro: o próprio fornecedor ou outro estabelecimento da mesma empresa (a matriz da filial).
  cnpj_sancionado text not null check (cnpj_sancionado ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  cadastro        text not null check (cadastro in ('CEIS', 'CNEP')),
  -- O id do registro na API (`/api-de-dados/ceis/{id}`).
  id_portal       bigint,
  -- tipoSancao.descricaoResumida ("Impedimento/proibição de contratar com prazo determinado", "Inidoneidade"...)
  tipo            text,
  orgao           text,
  orgao_uf        text,
  orgao_esfera    text,
  -- abrangenciaDefinidaDecisaoJudicial: até onde a sanção alcança, quando a decisão diz.
  abrangencia     text,
  dt_inicio       date,
  dt_fim          date,
  dt_publicacao   date,
  processo        text,
  -- linkPublicacao (a publicação da sanção, em geral no Diário Oficial).
  link            text,
  -- Só o CNEP traz multa.
  valor_multa     numeric,
  -- Na data da consulta (sancao_execucao.referencia): sem data final, conta como vigente.
  vigente         boolean not null
);
create index if not exists sancao_registro_cnpj_idx on public.sancao_registro (execucao_id, cnpj);
create index if not exists sancao_registro_vigente_idx on public.sancao_registro (execucao_id, cnpj) where vigente;

do $$
declare
  t text;
begin
  foreach t in array array['sancao_execucao', 'sancao_consulta', 'sancao_registro'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.sancao_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.sancao_execucao_id_seq to service_role;

create or replace function public.sancao_ultima_execucao()
returns setof public.sancao_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.sancao_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.sancao_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.sancao_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter. Devolve quantas apagou;
-- 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como histórico.
create or replace function public.sancao_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.sancao_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.sancao_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['sancao_consulta', 'sancao_registro'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.sancao_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.sancao_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.sancao_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.sancao_ultima_execucao()                    to service_role;
grant  execute on function public.sancao_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.sancao_limpar(bigint, integer)               to service_role;
