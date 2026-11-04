-- =============================================================================
-- oport_65 — Rede de atores de inovação da PB: N1 (04/11/2026; plano em Site-Ponte/rede-atores/PLANO.md)
--
-- O job `rede_atores/` (semanal, `rede-atores.yml`, no runner da máquina do titular) junta, para uma lista curada de ICT,
-- FAP, fundações de apoio, parques e OSC de inovação: os TED da API aberta do Transferegov (as ICT federais não usam
-- convênio) e os convênios e emendas da última execução do painel. Decisões do titular (04/11/2026): reabrir o TED, lista
-- curada e só administrador.
--
--   · rede_execucao e as funções rede_ultima_execucao / rede_concluir / rede_limpar (o desenho da oport_47);
--   · rede_ator: um ator da lista por linha, com as somas; ator sem ligação fica, com zeros;
--   · rede_aresta: uma linha por instrumento ou emenda, com fonte e número.
--
-- É UMA REDE DE DINHEIRO. Duas organizações com o mesmo financiador não ficam ligadas por isso: não prova parceria. Ligação
-- é fato de fonte pública, não suspeita; não constar nas fontes lidas não quer dizer que o ator não atue.
--
-- AS SOMAS: só `papel = 'financia'` com `conta = true`. `destina` (emenda) é parte do mesmo dinheiro do convênio, visto pelo
-- autor, e nunca soma com `financia`.
--
-- Só pessoa jurídica, órgão e parlamentar (agente público). Sem pesquisador, bolsista, servidor ou sócio.
--
-- Acesso: pelo servidor, só administrador. RLS ligada sem política, grants só para `service_role`.
--
-- ORDEM: esta migração ANTES da primeira rodada (sem `rede_ultima_execucao`, o job para antes de ler a fonte).
-- Aditiva e idempotente. Pré-requisitos: nenhum.
-- =============================================================================

create table if not exists public.rede_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  -- rede_atores, rede_arestas, rede_por_fonte, rede_valor, rede_painel_execucao, rede_ted_atualizado_em...
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists rede_execucao_concluida_idx on public.rede_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.rede_ator (
  execucao_id      bigint not null references public.rede_execucao (id) on delete cascade,
  id_ator          text not null,
  nome             text not null,
  sigla            text,
  cnpj             text check (cnpj is null or cnpj ~ '^\d{14}$'),
  categoria        text not null check (categoria in ('ict_federal', 'ict_estadual', 'fap', 'fundacao_apoio', 'parque', 'osc_inovacao')),
  municipio        text,
  -- 'a_revisar': o titular ainda não confirmou que o ator pertence à lista.
  conferencia      text not null check (conferencia in ('confirmado', 'a_revisar')),
  fonte_semente    text not null,
  n_instrumentos   integer not null default 0,
  n_financiadores  integer not null default 0,
  valor_total      numeric not null default 0,
  maior_financiador text,
  -- Do total recebido, a fatia do maior financiador (0 a 1).
  fatia_maior      numeric check (fatia_maior is null or fatia_maior between 0 and 1),
  ano_primeiro     integer,
  ano_ultimo       integer,
  n_autores_emenda integer not null default 0,
  valor_emendas    numeric not null default 0,
  -- O grupo ligado no grafo financiador-ator. Não é comunidade nem parceria.
  componente       integer,
  primary key (execucao_id, id_ator)
);

create table if not exists public.rede_aresta (
  execucao_id  bigint not null references public.rede_execucao (id) on delete cascade,
  ordem        integer not null,
  id_ator      text not null,
  papel        text not null check (papel in ('financia', 'destina')),
  fonte        text not null check (fonte in ('ted', 'convenio', 'emenda')),
  origem       text,
  -- O nome sem acento e com os apelidos resolvidos: o mesmo ministério, escrito de dois jeitos, é um só.
  origem_chave text not null,
  numero       text not null,
  valor        numeric not null,
  ano          integer,
  situacao     text,
  -- false: plano rejeitado ou em elaboração; convênio anulado, cancelado ou sem assinatura.
  conta        boolean not null,
  inicio       date,
  fim          date,
  programa     text,
  objeto       text,
  primary key (execucao_id, ordem)
);
create index if not exists rede_aresta_ator_idx   on public.rede_aresta (execucao_id, id_ator);
create index if not exists rede_aresta_origem_idx on public.rede_aresta (execucao_id, origem_chave);

do $$
declare
  t text;
begin
  foreach t in array array['rede_execucao', 'rede_ator', 'rede_aresta'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.rede_execucao_id_seq from public, anon, authenticated;
grant usage, select on sequence public.rede_execucao_id_seq to service_role;

create or replace function public.rede_ultima_execucao()
returns setof public.rede_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.rede_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.rede_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.rede_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter, até p_limite linhas por chamada (dentro dos
-- 8 s da API). Devolve quantas apagou; 0 = nada mais a limpar. As execuções antigas ficam, como histórico.
create or replace function public.rede_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.rede_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.rede_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['rede_aresta', 'rede_ator'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.rede_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.rede_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.rede_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.rede_ultima_execucao()                    to service_role;
grant  execute on function public.rede_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.rede_limpar(bigint, integer)               to service_role;
