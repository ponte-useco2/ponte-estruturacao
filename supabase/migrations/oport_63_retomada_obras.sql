-- =============================================================================
-- oport_63 — Obras da educação no Pacto de Retomada (FNDE, Plataforma Antonieta de Barros): R1 (04/11/2026; plano e
-- estudo em Site-Ponte/obras-retomada-fnde/)
--
-- O job `retomada_fnde/` (semanal, `retomada-fnde.yml`, no runner da máquina do titular) lê a API aberta da plataforma:
-- ~3.900 fichas do Brasil, uma a uma. Decisões do titular (01/11/2026): Brasil inteiro; bloco para usuário logado; o
-- saldo em conta entra (saldo, data e banco; nunca agência nem conta).
--
--   · ret_execucao e as funções ret_ultima_execucao / ret_concluir / ret_limpar (o desenho da oport_47);
--   · ret_obra: uma linha por obra do Brasil;
--   · ret_historico e ret_pagamento: os passos do pedido e o dinheiro, SÓ da PB (o que as telas do município leem);
--   · ret_resumo_uf: uma linha por UF e uma do Brasil ('BR').
--
-- ARMADILHA DO SALDO: `saldo_processo` é do PROCESSO, não da obra. 446 processos têm mais de uma obra e o extrato vem
-- repetido em cada uma: somar a coluna por obra dá R$ 2,36 bi, quando o certo é R$ 752 mi. Toda soma é por
-- (processo_cnpj, processo); `ret_resumo_uf` já vem assim.
--
-- ARMADILHA DA VEZ: `vez_util` só existe com o pedido em aberto. "FNDE" com o pedido deferido é só o último ato e não
-- é guardado como vez.
--
-- ARMADILHA DO DINHEIRO: em `ret_pagamento`, `ob` e `repasse` são o mesmo dinheiro visto de dois lados. O
-- `valor_repassado` da obra é a soma de `repasse`. Não somar os dois tipos.
--
-- Empresa contratada com nome: só para administrador, na tela (regra de fornecedores). Sem dado pessoal: o job só lê
-- campos listados um a um e não publica se a varredura achar CPF, e-mail, telefone ou conta.
--
-- Acesso: pelo servidor. RLS ligada sem política, grants só para `service_role`.
--
-- ORDEM: esta migração ANTES da primeira rodada (sem `ret_ultima_execucao`, o job para antes de ler a fonte).
-- Aditiva e idempotente. Pré-requisitos: nenhum.
-- =============================================================================

create table if not exists public.ret_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  dado_ate     timestamptz,
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  -- ret_obras, ret_obras_pb, ret_por_situacao, ret_saldo_brasil, ret_saldo_pb, ret_fichas_com_falha, ret_segundos...
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists ret_execucao_concluida_idx on public.ret_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.ret_obra (
  execucao_id            bigint not null references public.ret_execucao (id) on delete cascade,
  obrid                  bigint not null,
  ibge                   text check (ibge is null or ibge ~ '^\d{7}$'),
  uf                     text not null check (uf ~ '^[A-Z]{2}$'),
  municipio              text not null,
  nome                   text not null,
  esfera                 text,
  -- A prefeitura ou o órgão estadual: CNPJ e nome institucional, nada de contato.
  ente_cnpj              text check (ente_cnpj is null or ente_cnpj ~ '^\d{14}$'),
  ente_nome              text,
  -- Como o FNDE escreve. situacao_obra: Em Execução, Concluída, Obra Cancelada, Em Licitação, Em Retomada, Paralisada...
  situacao_obra          text,
  situacao_cadastro      text,
  situacao_pedido        text,
  situacao_repactuacao   text,
  vez_util               text check (vez_util is null or vez_util in ('Ente', 'FNDE')),
  dt_ultimo_passo        date,
  dt_pedido              date,
  n_diligencias          integer not null default 0,
  dias_vez_ente          integer not null default 0,
  dias_vez_fnde          integer not null default 0,
  termo                  text,
  termo_vigencia         date,
  termo_situacao         text,
  etapa                  text,
  tipo_projeto           text,
  tipo_obra              text,
  valor_pactuado         numeric,
  valor_repassado        numeric,
  n_repasses             integer not null default 0,
  dt_ultimo_repasse      date,
  n_ob                   integer not null default 0,
  dt_ultima_ob           date,
  -- O saldo do PROCESSO (ver o cabeçalho): somar só uma vez por (processo_cnpj, processo).
  saldo_processo         numeric,
  saldo_data             date,
  saldo_banco            text,
  processo               text,
  processo_cnpj          text check (processo_cnpj is null or processo_cnpj ~ '^\d{14}$'),
  pct_executado          numeric check (pct_executado is null or pct_executado between 0 and 100),
  dt_vistoria            date,
  situacao_vistoria      text,
  comentario_vistoria    text,
  latitude               double precision check (latitude is null or latitude between -34 and 6),
  longitude              double precision check (longitude is null or longitude between -74.5 and -28),
  -- Só com CNPJ válido; sem ele, a contratada é "não identificada" (nulos).
  empresa_cnpj           text check (empresa_cnpj is null or empresa_cnpj ~ '^\d{14}$'),
  empresa_nome           text,
  valor_contrato         numeric,
  dt_assinatura_contrato date,
  dt_fim_contrato        date,
  dt_os                  date,
  dt_inicio_execucao     date,
  licitacao_modalidade   text,
  n_aditivos             integer not null default 0,
  n_medicoes             integer not null default 0,
  dt_ultima_medicao      date,
  primary key (execucao_id, obrid)
);
create index if not exists ret_obra_ibge_idx    on public.ret_obra (execucao_id, ibge);
create index if not exists ret_obra_uf_idx      on public.ret_obra (execucao_id, uf);
create index if not exists ret_obra_ente_idx    on public.ret_obra (execucao_id, ente_cnpj);
create index if not exists ret_obra_empresa_idx on public.ret_obra (execucao_id, empresa_cnpj);

create table if not exists public.ret_historico (
  execucao_id bigint not null references public.ret_execucao (id) on delete cascade,
  obrid       bigint not null,
  ordem       integer not null,
  status      text not null,
  data        timestamp not null,
  responsavel text,
  primary key (execucao_id, obrid, ordem)
);

create table if not exists public.ret_pagamento (
  execucao_id bigint not null references public.ret_execucao (id) on delete cascade,
  obrid       bigint not null,
  ordem       integer not null,
  tipo        text not null check (tipo in ('empenho', 'ob', 'repasse', 'repasse_antigo')),
  numero      text,
  data        date,
  valor       numeric,
  situacao    text,
  primary key (execucao_id, obrid, ordem)
);

create table if not exists public.ret_resumo_uf (
  execucao_id             bigint not null references public.ret_execucao (id) on delete cascade,
  -- A sigla da UF, ou 'BR' para o Brasil.
  uf                      text not null check (uf ~ '^[A-Z]{2}$'),
  obras                   integer not null,
  municipios              integer not null,
  valor_pactuado          numeric not null,
  valor_repassado         numeric not null,
  processos_com_saldo     integer not null,
  saldo                   numeric not null,
  -- Só de extrato com até 365 dias: há extratos parados desde 2010.
  processos_saldo_recente integer not null,
  saldo_recente           numeric not null,
  diligencias_abertas     integer not null,
  -- {"Em Execução": {"obras": 37, "pactuado": ..., "repassado": ...}, ...}
  por_situacao            jsonb not null default '{}'::jsonb,
  -- {"Obra aprovada": 60, "Obra desvinculada": 58}
  por_repactuacao         jsonb not null default '{}'::jsonb,
  primary key (execucao_id, uf)
);

do $$
declare
  t text;
begin
  foreach t in array array['ret_execucao', 'ret_obra', 'ret_historico', 'ret_pagamento', 'ret_resumo_uf'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.ret_execucao_id_seq from public, anon, authenticated;
grant usage, select on sequence public.ret_execucao_id_seq to service_role;

create or replace function public.ret_ultima_execucao()
returns setof public.ret_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.ret_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.ret_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.ret_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter, até p_limite linhas por chamada (dentro dos
-- 8 s da API). Devolve quantas apagou; 0 = nada mais a limpar. As execuções antigas ficam, como histórico.
create or replace function public.ret_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.ret_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.ret_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['ret_pagamento', 'ret_historico', 'ret_resumo_uf', 'ret_obra'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.ret_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.ret_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.ret_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.ret_ultima_execucao()                    to service_role;
grant  execute on function public.ret_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.ret_limpar(bigint, integer)               to service_role;
