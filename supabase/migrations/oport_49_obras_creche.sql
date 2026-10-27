-- =============================================================================
-- oport_49 — Obras de creche e educação infantil da PB no Obrasgov.br (primeira infância, P0.4, 27/10/2026;
-- estudo em Site-Ponte/primeira-infancia/RESULTADO-P0.4.md)
--
-- O job `obras/` (semanal, `obras.yml`, no runner da máquina do titular) lê a API pública do Obrasgov.br, o cadastro
-- federal de obras que espelha o SIMEC-FNDE e o Transferegov.br (o painel do SIMEC fica atrás do Cloudflare e não é
-- lido): situação, % de execução física, datas e, nas paralisadas e canceladas, a data e a justificativa da situação.
-- Não há número de termo do SICONV nem do PAR na fonte: a tela liga obra e termo só pelo município.
--
-- O município (`ibge`) vem do tomador pelo CNPJ, do nome com contexto ("<município>/PB") ou da geometria fora de João
-- Pessoa (a fonte põe João Pessoa quando não sabe); `ibge_origem` diz qual. Sem nenhum, fica nulo: a obra entra no
-- total do estado, nunca num município.
--
--   · obr_execucao e as funções obr_ultima_execucao / obr_concluir / obr_limpar (o desenho da oport_47);
--   · obr_obra: uma linha por obra.
--
-- Acesso: pelo servidor (administrador e cadastrado, como a página da primeira infância). RLS ligada sem política,
-- grants só para `service_role`.
--
-- ORDEM: esta migração ANTES da primeira rodada. Aditiva e idempotente. Pré-requisitos: nenhum.
-- =============================================================================

create table if not exists public.obr_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  -- obr_projetos_pb, obr_obras, obr_por_situacao, obr_ibge_origem, obr_municipios, obr_segundos.
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists obr_execucao_concluida_idx on public.obr_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.obr_obra (
  execucao_id           bigint not null references public.obr_execucao (id) on delete cascade,
  -- O id do Obrasgov ("87529.25-60").
  id_projeto            text not null check (id_projeto ~ '^[0-9.]+-[0-9]+$'),
  ibge                  text check (ibge is null or ibge ~ '^\d{7}$'),
  ibge_origem           text not null check (ibge_origem in ('tomador', 'nome', 'geometria', 'nao_identificado')),
  nome                  text not null,
  -- Como o Obrasgov escreve: Cadastrada, Em execução, Paralisada, Concluída, Cancelada...
  situacao              text,
  -- SIMEC-FNDE, Transferegov.br...
  sistema               text,
  especie               text,
  tomador               text,
  tomador_cnpj          text check (tomador_cnpj is null or tomador_cnpj ~ '^\d{14}$'),
  pct_fisico            numeric check (pct_fisico is null or pct_fisico between 0 and 100),
  dt_inicio             date,
  dt_fim_prevista       date,
  dt_atualizacao        date,
  -- A data e a justificativa do último registro de paralisação ou cancelamento.
  dt_situacao           date,
  justificativa         text,
  dt_cadastro           date,
  investimento_previsto numeric,
  primary key (execucao_id, id_projeto)
);
create index if not exists obr_obra_ibge_idx on public.obr_obra (execucao_id, ibge);

do $$
declare
  t text;
begin
  foreach t in array array['obr_execucao', 'obr_obra'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.obr_execucao_id_seq from public, anon, authenticated;
grant usage, select on sequence public.obr_execucao_id_seq to service_role;

create or replace function public.obr_ultima_execucao()
returns setof public.obr_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.obr_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.obr_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.obr_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter, até p_limite linhas por chamada (dentro dos
-- 8 s da API). Devolve quantas apagou; 0 = nada mais a limpar. As execuções antigas ficam, como histórico.
create or replace function public.obr_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.obr_ultima_execucao()), p_manter], null);
  apagar bigint[];
  n      integer;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.obr_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;
  delete from public.obr_obra
   where ctid = any (array(select ctid from public.obr_obra where execucao_id = any (apagar)
                           limit greatest(1, least(coalesce(p_limite, 5000), 20000))));
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.obr_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.obr_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.obr_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.obr_ultima_execucao()                    to service_role;
grant  execute on function public.obr_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.obr_limpar(bigint, integer)               to service_role;
