-- =============================================================================
-- fiscal_1 — Painel de Capacidade Fiscal e Elegibilidade (onda 8, MVP Paraíba)
--
-- Retrato diário dos 223 municípios da PB, gravado pelo job `fiscal/` do monorepo com a chave
-- de serviço, no fluxo em três tempos do painel e do Pix:
--   fiscal_execucao (gravando) → linhas por execução → fiscal_concluir → fiscal_limpar em lotes.
--
--   · fiscal_municipio:   uma linha por município, com o estado de cada verificação e as três
--                         conclusões (A declarações, B transferência voluntária, C crédito);
--   · fiscal_verificacao: cada verificação com frase, evidência (valores, cálculo, período),
--                         base legal e a versão da regra que a produziu;
--   · fiscal_fonte:       o que foi lido de cada fonte: URLs, situação HTTP, sha256 do corpo,
--                         quando, e o erro, se houve;
--   · fiscal_historico:   quando cada verificação mudou de estado. Não é apagado pela limpeza:
--                         é a memória do painel, uma linha por mudança e não por dia.
--
-- Uso EXCLUSIVO da PONTE no MVP (decisão do titular, 15/09/2026): nada acessível a anon ou
-- authenticated; a página lê no servidor depois de conferir o administrador.
--
-- Prefixo `fiscal_` e não `oport_16`: uma tarefa paralela pode criar a próxima `oport_N`.
-- Grants explícitos (seguranca_1). Idempotente. Independe das anteriores.
-- =============================================================================

create table if not exists public.fiscal_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- Quando a coleta terminou; cada fonte tem a sua data em fiscal_fonte.
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists fiscal_execucao_concluida_idx on public.fiscal_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.fiscal_municipio (
  execucao_id   bigint not null references public.fiscal_execucao (id) on delete cascade,
  ibge          text not null check (ibge ~ '^25[0-9]{5}$'),
  nome          text not null,
  populacao     integer,
  tce           text,
  -- {"G1": "atendido", "G2": "atencao", ...}
  estados       jsonb not null default '{}'::jsonb,
  -- [{"decisao": "A", "estado": ..., "bloqueantes": [...], "alertas": [...], "sem_dado": [...], "documentais": [...]}]
  conclusoes    jsonb not null default '[]'::jsonb,
  -- Os números que a tabela dos 223 mostra sem abrir a evidência.
  indicadores   jsonb not null default '{}'::jsonb,
  primary key (execucao_id, ibge)
);

create table if not exists public.fiscal_verificacao (
  execucao_id bigint not null references public.fiscal_execucao (id) on delete cascade,
  ibge        text not null,
  codigo      text not null check (codigo ~ '^G[0-9]+A?$'),
  nome        text not null,
  estado      text not null check (estado in ('atendido', 'nao_atendido', 'atencao', 'nao_verificavel', 'desatualizado')),
  resumo      text not null,
  decisoes    text[] not null default '{}',
  evidencia   jsonb not null default '{}'::jsonb,
  base_legal  text not null default '',
  documental  boolean not null default false,
  versao      text not null,
  primary key (execucao_id, ibge, codigo)
);

create table if not exists public.fiscal_fonte (
  execucao_id bigint not null references public.fiscal_execucao (id) on delete cascade,
  -- Nulo nas fontes lidas uma vez para a UF inteira (CAUC, SIOPE).
  ibge        text,
  chave       text not null,
  sistema     text not null,
  urls        text[] not null default '{}',
  situacoes   integer[] not null default '{}',
  sha256      text[] not null default '{}',
  coletado_em timestamptz,
  erro        text,
  extra       jsonb not null default '{}'::jsonb
);
create index if not exists fiscal_fonte_idx on public.fiscal_fonte (execucao_id, ibge);

create table if not exists public.fiscal_historico (
  ibge        text not null,
  codigo      text not null,
  estado      text not null,
  resumo      text not null,
  desde       date not null,
  visto_ate   date not null,
  execucao_id bigint,
  versao      text,
  primary key (ibge, codigo, desde)
);
create index if not exists fiscal_historico_recente_idx on public.fiscal_historico (ibge, codigo, visto_ate desc);


do $$
declare t text;
begin
  foreach t in array array['fiscal_execucao', 'fiscal_municipio', 'fiscal_verificacao', 'fiscal_fonte', 'fiscal_historico'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.fiscal_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.fiscal_execucao_id_seq to service_role;


-- =============================================================================
-- Funções (mesmo desenho de painel_concluir / painel_limpar e pix_concluir / pix_limpar)
-- =============================================================================

create or replace function public.fiscal_ultima_execucao()
returns setof public.fiscal_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.fiscal_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

-- Conclui a execução e atualiza o histórico: estado igual ao último registrado só estende
-- `visto_ate`; estado diferente abre uma linha nova. Tudo na mesma transação da conclusão.
create or replace function public.fiscal_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_ref date;
begin
  update public.fiscal_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando'
  returning referencia into v_ref;
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
  v_ref := coalesce(v_ref, current_date);

  with ultimo as (
    select distinct on (h.ibge, h.codigo) h.ibge, h.codigo, h.estado, h.desde
      from public.fiscal_historico h
     order by h.ibge, h.codigo, h.desde desc
  ),
  atual as (
    select v.ibge, v.codigo, v.estado, v.resumo, v.versao, u.estado as estado_antes, u.desde as desde_antes
      from public.fiscal_verificacao v
      left join ultimo u on u.ibge = v.ibge and u.codigo = v.codigo
     where v.execucao_id = p_execucao
  ),
  estende as (
    update public.fiscal_historico h
       set visto_ate = greatest(h.visto_ate, v_ref), execucao_id = p_execucao
      from atual a
     where a.estado = a.estado_antes and h.ibge = a.ibge and h.codigo = a.codigo and h.desde = a.desde_antes
    returning 1
  )
  insert into public.fiscal_historico (ibge, codigo, estado, resumo, desde, visto_ate, execucao_id, versao)
  select a.ibge, a.codigo, a.estado, a.resumo, v_ref, v_ref, p_execucao, a.versao
    from atual a
   where a.estado_antes is distinct from a.estado
  on conflict (ibge, codigo, desde) do update
    set estado = excluded.estado, resumo = excluded.resumo, visto_ate = excluded.visto_ate,
        execucao_id = excluded.execucao_id, versao = excluded.versao;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter. Devolve quantas
-- apagou; 0 = nada mais a limpar. O histórico fica.
create or replace function public.fiscal_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.fiscal_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.fiscal_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['fiscal_verificacao', 'fiscal_fonte', 'fiscal_municipio'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.fiscal_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.fiscal_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.fiscal_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.fiscal_ultima_execucao()                    to service_role;
grant  execute on function public.fiscal_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.fiscal_limpar(bigint, integer)               to service_role;
