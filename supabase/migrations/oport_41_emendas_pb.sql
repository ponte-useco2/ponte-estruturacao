-- =============================================================================
-- oport_41 — Emendas impositivas da Assembleia da PB: catálogo, ficha, caminho, destino e pessoa física somada
-- (emendas estaduais, E1, 16/10/2026)
--
-- O job `emendas_pb/` (semanal, terça, `emendas-pb.yml`, no runner da máquina do titular: a API da PB não responde ao
-- GitHub) lê a API de dados abertos do Estado (https://api.dados.pb.gov.br/api/v1), de 2021 ao ano corrente:
--   · `orcamento/execucao_emendas`: o catálogo, a execução orçamentária de cada emenda (uma linha por classificação);
--   · `orcamento/listagem_emendas`: a ficha da emenda, com o objeto, o tipo e o caminho datado
--     envio → SEPLAG → secretário da SEPLAG → cronograma da SEFAZ → secretário da SEFAZ;
--   · `despesas/notas_empenho` com `numeroEmenda`: o credor (CNPJ) e o município de cada empenho.
--
-- A chave é a EMENDA (`NNNN/AAAA`). O CATÁLOGO E O DESTINO NUNCA SE SOMAM: é o mesmo dinheiro visto de dois lugares
-- (em 16/10/2026 batiam em todas as emendas de 2022 a 2025; ver `emendas_pb/montar.py`).
--
--   · epb_execucao e as funções epb_ultima_execucao / epb_concluir / epb_limpar (o desenho da oport_39);
--   · epb_autor: uma pessoa por deputado, da semente curada `emendas_pb/seeds/deputado_estadual.csv` (o nome civil do
--     catálogo ligado ao nome parlamentar da ficha PELO CÓDIGO DA EMENDA, nunca por semelhança), com as grafias
--     publicadas. Autor fora da semente fica com a grafia e `pessoa_fonte` vazia. Deputado é agente público;
--   · epb_emenda: o catálogo, uma linha por classificação (`seq`);
--   · epb_ficha: uma por emenda, com o passo atual (o último passo datado; "empenhada" com empenho; "paga" com o pago
--     igual ao valor), os dias nele, "devolvida" (pelo texto do parecer) e a marca de datas fora de ordem;
--   · epb_tramite: os passos da ficha com data, o texto do parecer (com CPF, e-mail e telefone mascarados) e o
--     RESPONSÁVEL — o nome do servidor que enviou ou deu o parecer. SÓ ADMINISTRADOR (decisão do titular, 16/10/2026);
--     nunca no modo cliente nem em sala;
--   · epb_destino: emenda × credor pessoa jurídica × município × órgão, com o empenhado (o valor atualizado da nota),
--     o liquidado e o pago. O nome do credor só aparece no painel de administrador;
--   · epb_pf: a pessoa física credora só somada, por emenda. Não há coluna para nome, documento ou município.
--
-- O beneficiário final da ficha é texto livre: só é gravado quando é entidade ou município. O resto pode ser nome de
-- pessoa e fica retido (`beneficiario_retido`).
--
-- Acesso: SÓ ADMINISTRADOR. RLS ligada sem nenhuma política, e grants só para `service_role` (tabelas, sequência e
-- funções): o site lê pela chave de serviço, numa rota de administrador (E2).
--
-- ORDEM: esta migração ANTES da primeira rodada (sem `epb_ultima_execucao`, o job para antes de ler a API).
-- Aditiva e idempotente. Pré-requisitos: nenhum.
-- =============================================================================

create table if not exists public.epb_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- A hora da leitura (a API não publica a data do dado).
  dado_ate     timestamptz,
  -- O dia da rodada, em Brasília: é contra ele que os dias no passo são contados.
  referencia   date,
  -- {"api": "https://api.dados.pb.gov.br/api/v1", "anos": "2021,...,2026"}
  arquivos     jsonb not null default '{}'::jsonb,
  -- `epb_anos` (por ano: linhas, emendas, fichas, empenhos, a conferência catálogo × destino, passos, retidos),
  -- `epb_autores`, `epb_autor_sem_pessoa`, `epb_pedidos`, `epb_segundos`, `epb_anos_lidos`.
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists epb_execucao_concluida_idx on public.epb_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.epb_autor (
  execucao_id      bigint not null references public.epb_execucao (id) on delete cascade,
  -- O nome parlamentar da semente; fora dela, a grafia publicada (em maiúsculas, sem acento).
  pessoa           text not null,
  -- A origem da ligação na semente; vazia = autor fora da semente (vira alerta na rodada).
  pessoa_fonte     text,
  grafias_catalogo text[] not null default '{}',
  grafias_ficha    text[] not null default '{}',
  emendas          integer not null default 0,
  anos             integer[] not null default '{}',
  primary key (execucao_id, pessoa)
);

create table if not exists public.epb_emenda (
  execucao_id           bigint not null references public.epb_execucao (id) on delete cascade,
  ano                   integer not null,
  emenda                text not null check (emenda ~ '^\d{4}/\d{4}$'),
  -- A mesma emenda pode ter mais de uma classificação (2 em 2025, 9 em 2024).
  seq                   integer not null check (seq >= 1),
  numero                text not null check (numero ~ '^\d{4}$'),
  -- O nome civil, como o catálogo publica.
  autor_publicado       text,
  pessoa                text,
  orgao_codigo          integer,
  orgao                 text,
  unidade               text,
  funcao                text,
  subfuncao             text,
  programa              text,
  acao                  text,
  natureza              text,
  fonte_recurso         text,
  categoria             text,
  grupo                 text,
  -- "TRANSFERÊNCIAS A MUNICÍPIOS", "TRANSFERÊNCIAS A INSTITUIÇÕES PRIVADAS SEM FINS LUCRATIVOS"...
  modalidade            text,
  elemento              text,
  orcamento_democratico boolean,
  valor_emenda          numeric not null default 0,
  empenhado             numeric not null default 0,
  liquidado             numeric not null default 0,
  pago                  numeric not null default 0,
  primary key (execucao_id, emenda, seq)
);
create index if not exists epb_emenda_pessoa_idx on public.epb_emenda (execucao_id, pessoa);
create index if not exists epb_emenda_ano_idx on public.epb_emenda (execucao_id, ano);

create table if not exists public.epb_ficha (
  execucao_id         bigint not null references public.epb_execucao (id) on delete cascade,
  ano                 integer not null,
  emenda              text not null check (emenda ~ '^\d{4}/\d{4}$'),
  prioridade          integer,
  -- O nome parlamentar, como a ficha publica.
  deputado_publicado  text,
  pessoa              text,
  -- O catálogo e a ficha dão pessoas diferentes para a mesma emenda.
  autoria_divergente  boolean not null default false,
  no_catalogo         boolean not null,
  -- IMPOSITIVA, APROPRIAÇÃO (2021), Especial, Convênio/Parceria, Execução Própria (2026)...
  tipo                text,
  secretaria          text,
  objeto              text,
  retificacao_objeto  text,
  -- Só entidade ou município; o resto fica retido (pode ser nome de pessoa).
  beneficiario_final  text,
  beneficiario_retido boolean not null default false,
  tipo_entidade       text,
  valor               numeric not null default 0,
  passo               text not null check (passo in ('nenhum', 'envio', 'seplag', 'sec_seplag', 'cronograma_sefaz',
                                                     'sec_sefaz', 'empenhada', 'paga')),
  passo_em            date,
  -- Dias desde `passo_em`, contados na `referencia` da execução; vazio quando paga.
  dias_no_passo       integer,
  devolvida           boolean not null default false,
  datas_fora_de_ordem boolean not null default false,
  primary key (execucao_id, emenda),
  check (beneficiario_final is null or not beneficiario_retido),
  check (passo <> 'paga' or dias_no_passo is null)
);
create index if not exists epb_ficha_pessoa_idx on public.epb_ficha (execucao_id, pessoa);
create index if not exists epb_ficha_passo_idx on public.epb_ficha (execucao_id, ano, passo);

create table if not exists public.epb_tramite (
  execucao_id bigint not null references public.epb_execucao (id) on delete cascade,
  ano         integer not null,
  emenda      text not null check (emenda ~ '^\d{4}/\d{4}$'),
  ordem       smallint not null check (ordem between 1 and 5),
  passo       text not null check (passo in ('envio', 'seplag', 'sec_seplag', 'cronograma_sefaz', 'sec_sefaz')),
  data        date,
  -- O parecer, com CPF, e-mail e telefone mascarados.
  texto       text,
  -- Nome do servidor (quem enviou, quem deu o parecer). SÓ ADMINISTRADOR.
  responsavel text,
  primary key (execucao_id, emenda, ordem)
);

create table if not exists public.epb_destino (
  execucao_id  bigint not null references public.epb_execucao (id) on delete cascade,
  ano          integer not null,
  emenda       text not null check (emenda ~ '^\d{4}/\d{4}$'),
  numero       text not null check (numero ~ '^\d{4}$'),
  credor_cnpj  text not null check (credor_cnpj ~ '^\d{14}$'),
  -- Pessoa jurídica; dígitos de CPF no fim da razão social viram ***. Só no painel de administrador.
  credor_nome  text,
  -- O IBGE de 7 dígitos (o empenho traz 6); vazio quando o município não está na semente.
  ibge         text check (ibge is null or ibge ~ '^\d{7}$'),
  municipio    text,
  orgao_codigo integer,
  orgao        text,
  -- O `valorDespesa` (valor atualizado da nota), nunca o `valorEmpenhado` original.
  empenhado    numeric not null default 0,
  -- O liquidado e o pago do CATÁLOGO repartidos pelo empenhado de cada credor na emenda (as notas do mesmo empenho
  -- repetem o pago do empenho inteiro e não se somam; ver `emendas_pb/montar.py`). Exatos com um credor só.
  liquidado    numeric not null default 0,
  pago         numeric not null default 0,
  notas        integer not null default 0,
  primeira     date,
  ultima       date
);
create unique index if not exists epb_destino_chave_idx
  on public.epb_destino (execucao_id, emenda, credor_cnpj, ibge, orgao_codigo) nulls not distinct;
create index if not exists epb_destino_ibge_idx on public.epb_destino (execucao_id, ibge) where ibge is not null;
create index if not exists epb_destino_cnpj_idx on public.epb_destino (execucao_id, credor_cnpj);

-- Pessoa física: só a soma, por emenda. Não há coluna para nome, documento ou município, por desenho.
create table if not exists public.epb_pf (
  execucao_id bigint not null references public.epb_execucao (id) on delete cascade,
  ano         integer not null,
  emenda      text not null check (emenda ~ '^\d{4}/\d{4}$'),
  numero      text not null check (numero ~ '^\d{4}$'),
  empenhado   numeric not null default 0,
  pago        numeric not null default 0,
  notas       integer not null default 0,
  primary key (execucao_id, emenda)
);

do $$
declare
  t text;
begin
  foreach t in array array['epb_execucao', 'epb_autor', 'epb_emenda', 'epb_ficha', 'epb_tramite', 'epb_destino', 'epb_pf'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.epb_execucao_id_seq from public, anon, authenticated;
grant usage, select on sequence public.epb_execucao_id_seq to service_role;

-- -----------------------------------------------------------------------------
-- Execução: a última concluída, concluir e limpar (o desenho da oport_39).
-- -----------------------------------------------------------------------------

create or replace function public.epb_ultima_execucao()
returns setof public.epb_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.epb_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.epb_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.epb_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter, até p_limite linhas por chamada (dentro
-- dos 8 s da API). Devolve quantas apagou; 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como
-- histórico.
create or replace function public.epb_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.epb_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.epb_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['epb_tramite', 'epb_destino', 'epb_pf', 'epb_ficha', 'epb_emenda', 'epb_autor'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

revoke execute on function public.epb_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.epb_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.epb_limpar(bigint, integer)               from public, anon, authenticated;
grant  execute on function public.epb_ultima_execucao()                    to service_role;
grant  execute on function public.epb_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.epb_limpar(bigint, integer)               to service_role;
