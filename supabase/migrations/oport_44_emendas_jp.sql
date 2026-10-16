-- =============================================================================
-- oport_44 — Emendas impositivas da Câmara Municipal de João Pessoa: painel, SAPL, TCE-PB e histórico
-- (emendas de João Pessoa, J1, 16/10/2026)
--
-- O job `emendas_jp/` (diário, `emendas-jp.yml`, no runner da máquina do titular) lê:
--   · o painel oficial da Prefeitura (transparenciaemendas.joaopessoa.pb.gov.br → Google Apps Script): as linhas do
--     exercício corrente, com dotação, empenhado, liquidado e pago, e os credores dos empenhos listados. Os pagamentos
--     do painel trazem banco, agência e conta, que saem NA CHEGADA, em memória: não há coluna para isso;
--   · o SAPL da Câmara: a matéria de cada emenda (o link da linha do painel) e o código do autor;
--   · a despesa de João Pessoa no TCE-PB com o código de acompanhamento 3310 (emenda de vereador, desde 2026): o
--     empenho com número, data e valor. Pessoa física só somada (`ejp_pf`);
--   · o histórico de 2021 a 2025, dos arquivos do portal conferidos (`emendas_jp/historico/`): a execução por emenda
--     e a lista da LOA, de onde vem o vereador pelo número da emenda no ano.
--
-- A LINHA do painel é código + unidade gestora (o código repete quando a emenda é remanejada; a linha antiga fica com
-- dotação zero). O vereador vem pela matéria do SAPL e pela semente curada `emendas_jp/seeds/vereador.csv`, nunca por
-- semelhança de nome. Vereador é agente público.
--
--   · ejp_execucao e as funções ejp_ultima_execucao / ejp_concluir / ejp_limpar (o desenho da oport_39/41);
--   · ejp_vereador, ejp_materia, ejp_linha, ejp_dotacao, ejp_credor, ejp_empenho, ejp_pf: o retrato da rodada;
--   · ejp_hist_emenda, ejp_hist_loa: o histórico (republicado a cada rodada, como o resto do retrato);
--   · ejp_movimento: o que mudou em cada linha desde a rodada anterior. É a SÉRIE (o painel só mostra o dia), e por
--     isso a `ejp_limpar` NÃO a apaga: fica de todas as execuções.
--
-- Acesso: administrador e sala de cliente (decisão do titular, 16/10/2026), sempre pelo servidor. RLS ligada sem
-- nenhuma política, e grants só para `service_role` (tabelas, sequência e funções).
--
-- ORDEM: esta migração ANTES da primeira rodada (sem `ejp_ultima_execucao`, o job para antes de ler as fontes).
-- Aditiva e idempotente. Pré-requisitos: nenhum.
-- =============================================================================

create table if not exists public.ejp_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- A `ultimaAtualizacao` do painel.
  dado_ate     timestamptz,
  -- O dia da rodada, em Brasília.
  referencia   date,
  -- {"painel", "apps_script" (a URL lida no HTML), "sha256" (do JSON original, que não é gravado), "sapl", "tce"}
  arquivos     jsonb not null default '{}'::jsonb,
  -- `ejp_painel` (linhas, kpis, soma, remanejadas, sem_materia...), `ejp_tce` (por ano), `ejp_hist` (por ano),
  -- `ejp_sapl`, `ejp_vereadores`, `ejp_sem_pessoa`, `ejp_movimentos`, `ejp_removidos_na_chegada`, `ejp_pedidos`...
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists ejp_execucao_concluida_idx on public.ejp_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.ejp_vereador (
  execucao_id    bigint not null references public.ejp_execucao (id) on delete cascade,
  -- O nome parlamentar (do painel) ou, para quem não está no painel de 2026, o nome da lista da LOA.
  pessoa         text not null,
  tipo           text not null check (tipo in ('vereador', 'colegiado')),
  sapl_autor     integer,
  grafias_painel text[] not null default '{}',
  grafias_loa    text[] not null default '{}',
  anos           integer[] not null default '{}',
  linhas_painel  integer not null default 0,
  primary key (execucao_id, pessoa)
);

create table if not exists public.ejp_materia (
  execucao_id       bigint not null references public.ejp_execucao (id) on delete cascade,
  sapl_id           integer not null,
  -- 65: "Emenda ao PL Orçamentário Anual - IMPOSITIVA"; 66: "Emenda Impositiva à LOA (CORRIGIDA)".
  tipo              smallint,
  numero            integer not null,
  -- O ano da matéria (apresentação); a LOA é o ano seguinte.
  ano               integer not null,
  loa               integer not null,
  sapl_autor        integer,
  autor_publicado   text,
  pessoa            text,
  ementa            text,
  data_apresentacao date,
  em_tramitacao     boolean,
  texto_url         text,
  primary key (execucao_id, sapl_id)
);
create index if not exists ejp_materia_numero_idx on public.ejp_materia (execucao_id, loa, numero);

create table if not exists public.ejp_linha (
  execucao_id          bigint not null references public.ejp_execucao (id) on delete cascade,
  ano                  integer not null,
  codigo               integer not null,
  ug                   text not null,
  vereador_publicado   text,
  pessoa               text,
  sapl_materia         integer,
  objeto               text,
  -- O CNPJ citado no objeto, só com dígito verificador válido.
  cnpj_objeto          text check (cnpj_objeto is null or cnpj_objeto ~ '^\d{14}$'),
  cnpj_objeto_invalido boolean not null default false,
  -- G (valor da emenda atual), H, I e J do painel.
  dotacao              numeric not null default 0,
  empenhado            numeric not null default 0,
  liquidado            numeric not null default 0,
  pago                 numeric not null default 0,
  impositiva           boolean,
  situacao             text,
  -- Dotação zero e o mesmo código em outra unidade: a emenda saiu desta unidade.
  remanejada           boolean not null default false,
  empenhos_n           integer not null default 0,
  pagamentos_n         integer not null default 0,
  primary key (execucao_id, ano, codigo, ug)
);
create index if not exists ejp_linha_pessoa_idx on public.ejp_linha (execucao_id, pessoa);
create index if not exists ejp_linha_cnpj_idx on public.ejp_linha (execucao_id, cnpj_objeto) where cnpj_objeto is not null;

create table if not exists public.ejp_dotacao (
  execucao_id    bigint not null references public.ejp_execucao (id) on delete cascade,
  ano            integer not null,
  codigo         integer not null,
  seq            integer not null check (seq >= 1),
  data           date,
  valor_original numeric not null default 0,
  valor_atual    numeric not null default 0,
  primary key (execucao_id, ano, codigo, seq)
);

-- Os credores dos empenhos que o painel lista (só pessoa jurídica: o credor que não é CNPJ sai na chegada).
create table if not exists public.ejp_credor (
  execucao_id          bigint not null references public.ejp_execucao (id) on delete cascade,
  ano                  integer not null,
  codigo               integer not null,
  ug                   text not null,
  seq                  integer not null check (seq >= 1),
  credor_cnpj          text not null check (credor_cnpj ~ '^\d{14}$'),
  -- Razão social; dígitos de CPF no fim viram ***. Nome de credor só em tela de administrador.
  credor_nome          text,
  funcao               text,
  acao                 text,
  objetivo             text,
  fonte                text,
  modalidade_licitacao text,
  historico            text,
  primary key (execucao_id, ano, codigo, ug, seq)
);
create index if not exists ejp_credor_cnpj_idx on public.ejp_credor (execucao_id, credor_cnpj);

-- O empenho do TCE-PB com o código de acompanhamento 3310, a pessoa jurídica.
create table if not exists public.ejp_empenho (
  execucao_id          bigint not null references public.ejp_execucao (id) on delete cascade,
  ano                  integer not null,
  ug_codigo            text not null,
  ug_nome              text,
  numero_empenho       text not null,
  seq                  integer not null check (seq >= 1),
  data_empenho         date,
  credor_cnpj          text not null check (credor_cnpj ~ '^\d{14}$'),
  credor_nome          text,
  empenhado            numeric not null default 0,
  liquidado            numeric not null default 0,
  pago                 numeric not null default 0,
  funcao               text,
  acao                 text,
  elemento             text,
  modalidade_licitacao text,
  numero_licitacao     text,
  historico            text,
  -- O número da emenda citado no histórico ("emenda impositiva nº 171/2025") e o ano citado (o da apresentação).
  codigo_citado        integer,
  ano_citado           integer,
  primary key (execucao_id, ano, ug_codigo, numero_empenho, seq)
);
create index if not exists ejp_empenho_codigo_idx on public.ejp_empenho (execucao_id, ano, codigo_citado);
create index if not exists ejp_empenho_cnpj_idx on public.ejp_empenho (execucao_id, credor_cnpj);

-- Pessoa física: só a soma, por emenda citada (vazia quando o histórico não cita). Sem nome, documento nem conta.
create table if not exists public.ejp_pf (
  execucao_id bigint not null references public.ejp_execucao (id) on delete cascade,
  ano         integer not null,
  codigo      integer,
  empenhado   numeric not null default 0,
  liquidado   numeric not null default 0,
  pago        numeric not null default 0,
  notas       integer not null default 0
);
create unique index if not exists ejp_pf_chave_idx on public.ejp_pf (execucao_id, ano, codigo) nulls not distinct;

create table if not exists public.ejp_hist_emenda (
  execucao_id          bigint not null references public.ejp_execucao (id) on delete cascade,
  ano                  integer not null,
  -- A posição do arquivo do portal (2023 só até agosto).
  mes_referencia       text,
  ug_codigo            text not null,
  ug_nome              text,
  codigo               integer not null,
  objetivo             text,
  cnpj_objeto          text check (cnpj_objeto is null or cnpj_objeto ~ '^\d{14}$'),
  cnpj_objeto_invalido boolean not null default false,
  -- Da lista da LOA pelo número no ano; vazio = não publicado na lista (2025 não tem lista).
  autor_publicado      text,
  pessoa               text,
  original             numeric not null default 0,
  atual                numeric not null default 0,
  pre_empenhado        numeric not null default 0,
  empenhado            numeric not null default 0,
  liquidado            numeric not null default 0,
  pago                 numeric not null default 0,
  primary key (execucao_id, ano, ug_codigo, codigo)
);
create index if not exists ejp_hist_emenda_pessoa_idx on public.ejp_hist_emenda (execucao_id, pessoa);

create table if not exists public.ejp_hist_loa (
  execucao_id     bigint not null references public.ejp_execucao (id) on delete cascade,
  ano             integer not null,
  codigo          integer not null,
  seq             integer not null check (seq >= 1),
  autor_publicado text,
  pessoa          text,
  funcional       text,
  natureza        text,
  fonte           text,
  objetivo        text,
  valor           numeric not null default 0,
  primary key (execucao_id, ano, codigo, seq)
);

-- A série: o que mudou em cada linha do painel desde a rodada anterior. Nunca apagada pela limpeza.
create table if not exists public.ejp_movimento (
  execucao_id bigint not null references public.ejp_execucao (id) on delete cascade,
  ano         integer not null,
  codigo      integer not null,
  ug          text not null,
  -- dotacao, empenhado, liquidado, pago, empenhos_n, pagamentos_n; "linha" = a linha apareceu (antes vazio) ou sumiu.
  campo       text not null check (campo in ('linha', 'dotacao', 'empenhado', 'liquidado', 'pago', 'empenhos_n',
                                             'pagamentos_n')),
  antes       numeric,
  depois      numeric,
  primary key (execucao_id, ano, codigo, ug, campo)
);
create index if not exists ejp_movimento_linha_idx on public.ejp_movimento (ano, codigo, ug);

do $$
declare
  t text;
begin
  foreach t in array array['ejp_execucao', 'ejp_vereador', 'ejp_materia', 'ejp_linha', 'ejp_dotacao', 'ejp_credor',
                           'ejp_empenho', 'ejp_pf', 'ejp_hist_emenda', 'ejp_hist_loa', 'ejp_movimento'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.ejp_execucao_id_seq from public, anon, authenticated;
grant usage, select on sequence public.ejp_execucao_id_seq to service_role;

-- -----------------------------------------------------------------------------
-- Execução: a última concluída, concluir e limpar (o desenho da oport_39/41).
-- -----------------------------------------------------------------------------

create or replace function public.ejp_ultima_execucao()
returns setof public.ejp_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.ejp_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.ejp_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.ejp_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas do retrato de todas as execuções, menos a última concluída e p_manter, até p_limite linhas por chamada
-- (dentro dos 8 s da API). Devolve quantas apagou; 0 = nada mais a limpar. A `ejp_movimento` (a série) fica, de
-- todas as execuções; as execuções antigas também ficam, como histórico.
create or replace function public.ejp_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.ejp_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.ejp_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['ejp_hist_loa', 'ejp_hist_emenda', 'ejp_pf', 'ejp_empenho', 'ejp_credor', 'ejp_dotacao',
                           'ejp_linha', 'ejp_materia', 'ejp_vereador'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.ejp_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.ejp_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.ejp_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.ejp_ultima_execucao()                    to service_role;
grant  execute on function public.ejp_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.ejp_limpar(bigint, integer)               to service_role;
