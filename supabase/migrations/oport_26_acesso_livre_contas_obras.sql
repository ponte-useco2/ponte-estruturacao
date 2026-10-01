-- =============================================================================
-- oport_26 — prestação de contas e obras dos convênios da PB, pelo Acesso Livre (onda 13C.2 e 13C.3)
--
-- Duas coletas assistidas no navegador (`acesso_livre/coletor_navegador.js`), cada uma com o seu recorte e
-- a sua última execução — publicar uma não apaga a outra:
--
--   · 'prestacao': os convênios em prestação de contas. Da tela da prestação de contas saem os eventos SIAFI
--     (comprovação, aprovação e impugnação, com data e valor), o cumprimento do objeto que o convenente
--     declarou e os pareceres (tipo, situação — "Em Diligência", por exemplo — e o texto curto);
--   · 'obras': os convênios em execução, pelo backend do Acompanhamento de Obras (módulo de medição): a última
--     medição, os dias sem medição, a marca de atraso e de paralisação e o executado atestado pelo convenente
--     × pela concedente/mandatária.
--
-- Nada disso está nos dados abertos do SICONV (conferido em 30/09/2026).
--
-- Privacidade: o nome, a atribuição e a função do servidor que deu o parecer ficam (decisão de 17/09/2026:
-- é por eles que se acha padrão de análise; o laudo do cliente não os mostra). O CPF do responsável nunca é
-- lido pelo coletor; CPF, e-mail e telefone no texto saem mascarados. A medição não traz nome.
--
--   · al_execucao (com `recorte`) e as funções al_ultima_execucao(recorte) / al_concluir / al_limpar;
--   · al_pc_convenio, al_pc_evento, al_pc_parecer (prestação de contas);
--   · al_obra_convenio, al_obra_lote (obras).
--
-- ORDEM: esta migração ANTES da primeira carga. Leitura só pelo servidor, com a chave de serviço (grants
-- explícitos). Aditiva e idempotente.
-- =============================================================================

create table if not exists public.al_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  recorte      text not null check (recorte in ('prestacao', 'obras')),
  -- A hora do último convênio coletado.
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists al_execucao_recorte_idx on public.al_execucao (recorte, concluida_em desc) where status = 'concluida';

-- ---------------------------------------------------------------- prestação de contas

create table if not exists public.al_pc_convenio (
  execucao_id           bigint not null references public.al_execucao (id) on delete cascade,
  nr_convenio           text not null,
  id_convenio           text,
  n_eventos             integer not null default 0,
  -- Soma dos eventos enviados de cada tipo (o SIAFI registra o valor comprovado, aprovado e impugnado).
  valor_comprovado      numeric,
  valor_aprovado        numeric,
  valor_impugnado       numeric,
  dt_comprovacao        timestamptz,
  dt_ultimo_evento      timestamptz,
  ultimo_evento         text,
  -- O que o convenente declarou no cumprimento do objeto.
  cumprimento           text,
  pct_fisico_declarado  numeric,
  n_pareceres           integer not null default 0,
  parecer_data          date,
  parecer_tipo          text,
  parecer_situacao      text,
  erro                  text,
  primary key (execucao_id, nr_convenio)
);

create table if not exists public.al_pc_evento (
  execucao_id    bigint not null references public.al_execucao (id) on delete cascade,
  nr_convenio    text not null,
  ordem          integer not null,
  evento         text,
  situacao       text,
  numero_siafi   text,
  numero_minuta  text,
  data_hora      timestamptz,
  valor          numeric,
  informatizada  text,
  primary key (execucao_id, nr_convenio, ordem)
);

create table if not exists public.al_pc_parecer (
  execucao_id  bigint not null references public.al_execucao (id) on delete cascade,
  nr_convenio  text not null,
  ordem        integer not null,
  data         date,
  tipo         text,
  situacao     text,
  emitido_por  text,
  -- Servidor público: nome, atribuição e função, como o Transferegov publica. Sem CPF.
  responsavel  text,
  atribuicao   text,
  funcao       text,
  texto        text,
  n_anexos     integer,
  detalhado    boolean not null default false,
  primary key (execucao_id, nr_convenio, ordem)
);

-- ---------------------------------------------------------------- obras

create table if not exists public.al_obra_convenio (
  execucao_id           bigint not null references public.al_execucao (id) on delete cascade,
  nr_convenio           text not null,
  id_proposta           text,
  -- 'ok' com dado; 'err005' sem licitação aceita no VRPL; 'err007' fora do fluxo VRPL/AIO; outro código da API.
  codigo                text not null,
  mensagem              text,
  n_lotes               integer not null default 0,
  ultima_medicao        integer,
  -- O maior tempo sem medição entre os contratos aptos a iniciar.
  dias_sem_medicao      integer,
  atrasado              boolean,
  paralisado            boolean,
  valor_total           numeric,
  realizado_convenente  numeric,
  realizado_concedente  numeric,
  pct_convenente        numeric,
  pct_concedente        numeric,
  primary key (execucao_id, nr_convenio)
);

create table if not exists public.al_obra_lote (
  execucao_id           bigint not null references public.al_execucao (id) on delete cascade,
  nr_convenio           text not null,
  lote_id               bigint not null,
  tipo                  text,
  numero                text,
  apto_iniciar          boolean,
  ultima_medicao        integer,
  dias_sem_medicao      integer,
  atrasado              boolean,
  paralisado            boolean,
  valor_total           numeric,
  realizado_empresa     numeric,
  realizado_convenente  numeric,
  realizado_concedente  numeric,
  primary key (execucao_id, nr_convenio, lote_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['al_execucao', 'al_pc_convenio', 'al_pc_evento', 'al_pc_parecer', 'al_obra_convenio', 'al_obra_lote'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.al_execucao_id_seq from anon, authenticated;
grant usage, select on sequence public.al_execucao_id_seq to service_role;

-- Última execução concluída de um recorte.
create or replace function public.al_ultima_execucao(p_recorte text)
returns setof public.al_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.al_execucao
   where status = 'concluida' and recorte = p_recorte
   order by concluida_em desc
   limit 1
$$;

create or replace function public.al_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.al_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída de CADA recorte e p_manter. Devolve quantas
-- apagou; 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como histórico.
create or replace function public.al_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(
    array[(select id from public.al_ultima_execucao('prestacao')), (select id from public.al_ultima_execucao('obras')), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.al_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['al_pc_convenio', 'al_pc_evento', 'al_pc_parecer', 'al_obra_convenio', 'al_obra_lote'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.al_ultima_execucao(text)                from public, anon, authenticated;
revoke execute on function public.al_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.al_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.al_ultima_execucao(text)                to service_role;
grant  execute on function public.al_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.al_limpar(bigint, integer)               to service_role;
