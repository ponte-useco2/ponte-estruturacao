-- =============================================================================
-- oport_39 — Emendas parlamentares com destino à PB: catálogo, canais, autores e pessoa física somada
-- (onda 14, C, 12/10/2026)
--
-- O job `emendas/` (semanal, `emendas.yml`) junta, pelo CÓDIGO DA EMENDA de 12 dígitos (ano + autor + número),
-- nunca por nome:
--   · o catálogo do Portal da Transparência (arquivo em lote `EmendasParlamentares.zip`): a execução orçamentária
--     da emenda (empenhado, liquidado, pago e restos a pagar);
--   · os canais com destino e entrega: convênio (SICONV, `painel_instrumento_emenda`), Pix (`pix_especial_plano`),
--     saúde fundo a fundo (FNS) e, no resto, o favorecido do arquivo do Portal.
--
-- O CATÁLOGO E O CANAL NUNCA SE SOMAM: é o mesmo dinheiro visto de dois lugares. Dentro de `emd_canal`, só somam as
-- linhas com `coberto_por is null` (o favorecido que outro canal da mesma emenda já mostra, e o plano "gêmeo" do Pix,
-- ficam gravados para conferência e não somam). As funções de leitura abaixo seguem essas duas regras.
--
--   · emd_execucao e as funções emd_ultima_execucao / emd_concluir / emd_limpar (o desenho da oport_25 e da oport_36);
--   · emd_autor: um por código de 4 dígitos (o código é do MANDATO), com o nome publicado, o tipo, a marca de autoria
--     coletiva (bancada, comissão e relator-geral, que nunca recebem pessoa) e a pessoa da tabela curada
--     `emendas/seeds/autor_pessoa.csv`, com a fonte de cada ligação;
--   · emd_emenda: o catálogo, uma linha por linha do Portal (a emenda pode ter várias localidades ou ações), com o
--     `pago_total` (pago + restos pagos, definição do titular) e o `a_pagar` (empenhado − pago − rp_pago −
--     rp_cancelado) gerados no banco. O `rp_inscrito` soma cada reinscrição do mesmo saldo e não se soma com nada;
--   · emd_canal: emenda × canal × instrumento (convênio, plano de ação, proposta ou favorecido × ano), com IBGE, tipo
--     do ente, indicado, empenhado, pago, situação, etapa, "de quem é a vez" quando o dado diz e o "caducou";
--   · emd_pf: a pessoa física só somada, por emenda × ano × UF. Não há coluna para nome, documento ou município;
--   · emd_fns_proposta: as propostas do FNS como vieram (autores e pagamentos), que a rodada seguinte lê de volta
--     para só reler o detalhe do que mudou.
--
-- "Caducou" (decisão do titular, 12/10/2026): a proposta do SICONV com emenda que nunca foi assinada deixa de contar
-- como pendente depois de 31/12 do ano seguinte ao da emenda. Fica com `caducou`, `caducou_em` e o valor, sem vez.
--
-- Acesso: SÓ ADMINISTRADOR até a revisão jurídica. RLS ligada sem nenhuma política, e grants só para `service_role`
-- (tabelas, sequência e funções): o site lê pela chave de serviço, numa rota de administrador. O nome de pessoa
-- jurídica (`emd_canal.ente_nome` do favorecido) só aparece nesse painel.
--
-- ORDEM: esta migração ANTES do job chegar à `main` (sem as tabelas, o job para antes de baixar o arquivo).
-- Aditiva e idempotente. Pré-requisitos: nenhum (o job lê `painel_*` e `pix_*`, das oport_8, 13, 14 e 23, pela API).
-- =============================================================================

create table if not exists public.emd_execucao (
  id           bigint generated always as identity primary key,
  iniciada_em  timestamptz not null default now(),
  concluida_em timestamptz,
  status       text not null check (status in ('gravando', 'concluida', 'erro')),
  -- A data do arquivo do Portal (Last-Modified do zip).
  dado_ate     timestamptz,
  -- O dia da rodada, em Brasília: é contra ele que o "caducou" é medido.
  referencia   date,
  arquivos     jsonb not null default '{}'::jsonb,
  -- As contagens e as conferências do job (`emd_conf_*`): teto, código fora do catálogo, ano do SICONV, FNS sem
  -- detalhe. Ver `emendas/montar.py`.
  contagens    jsonb not null default '{}'::jsonb,
  erro         text
);
create index if not exists emd_execucao_concluida_idx on public.emd_execucao (concluida_em desc) where status = 'concluida';

create table if not exists public.emd_autor (
  execucao_id      bigint not null references public.emd_execucao (id) on delete cascade,
  -- O código do autor no MANDATO (4 dígitos). A mesma pessoa pode ter dois (deputado e depois senador).
  codigo           text not null check (codigo ~ '^\d{4}$'),
  -- O nome publicado para o código (Portal; na falta, SICONV ou Pix). Agente público.
  nome             text,
  tipo             text not null check (tipo in ('individual', 'bancada', 'comissao', 'relator', 'outro')),
  -- Bancada, comissão e relator-geral: autoria coletiva, sem "padrinho".
  coletivo         boolean not null,
  -- Da tabela curada, nunca de cruzamento por nome.
  pessoa           text,
  pessoa_fonte     text,
  -- Onde o código aparece: portal, convenio, pix, fns, favorecido.
  fontes           text[] not null default '{}',
  -- Nomes distintos (sem acento, em maiúsculas) publicados para o código nas fontes: conferência (deve ser 1).
  nomes_publicados integer not null default 0,
  primary key (execucao_id, codigo),
  check (not (coletivo and pessoa is not null)),
  check ((pessoa is null) = (pessoa_fonte is null))
);

create table if not exists public.emd_emenda (
  execucao_id   bigint not null references public.emd_execucao (id) on delete cascade,
  linha         integer not null,
  -- null nas linhas do Portal fora do padrão de 12 dígitos (ficam só as com a PB na localidade).
  codigo        text check (codigo is null or codigo ~ '^\d{12}$'),
  ano           integer,
  -- Como o Portal escreve ("Emenda Individual - Transferências Especiais", "Emenda de Bancada"...).
  tipo          text,
  autor_codigo  text check (autor_codigo is null or autor_codigo ~ '^\d{4}$'),
  autor_nome    text,
  numero        text,
  -- "SANTA RITA - PB", "PARAÍBA (UF)", "Múltiplo", "Nacional"...
  localidade    text,
  uf            text check (uf is null or uf ~ '^[A-Z]{2}$'),
  ibge          text check (ibge is null or ibge ~ '^\d{7}$'),
  funcao        text,
  subfuncao     text,
  programa      text,
  acao          text,
  empenhado     numeric not null default 0,
  liquidado     numeric not null default 0,
  pago          numeric not null default 0,
  -- Acumula a inscrição e cada reinscrição anual do mesmo saldo (onda 14, A): NÃO somar com nada.
  rp_inscrito   numeric not null default 0,
  rp_cancelado  numeric not null default 0,
  rp_pago       numeric not null default 0,
  -- Definição do titular (12/10/2026): o pago no exercício mais os restos a pagar pagos depois.
  pago_total    numeric generated always as (pago + rp_pago) stored,
  -- O que falta pagar: empenhado − pago − rp_pago − rp_cancelado, nunca abaixo de zero (nunca o rp_inscrito).
  a_pagar       numeric generated always as (greatest(empenhado - pago - rp_pago - rp_cancelado, 0)) stored,
  -- A linha tem a PB na localidade.
  pb_localidade boolean not null,
  -- A emenda tem algum canal na PB (inclusive favorecido coberto ou pessoa física).
  com_canal_pb  boolean not null,
  primary key (execucao_id, linha)
);
create index if not exists emd_emenda_codigo_idx on public.emd_emenda (execucao_id, codigo);
create index if not exists emd_emenda_autor_idx on public.emd_emenda (execucao_id, autor_codigo);
create index if not exists emd_emenda_ibge_idx on public.emd_emenda (execucao_id, ibge) where ibge is not null;

create table if not exists public.emd_canal (
  execucao_id           bigint not null references public.emd_execucao (id) on delete cascade,
  linha                 integer not null,
  canal                 text not null check (canal in ('convenio', 'pix', 'fns', 'favorecido')),
  -- nr_convenio (convênio), id_plano_acao (Pix), nuProposta (FNS) ou CNPJ do favorecido.
  instrumento           text not null,
  -- null só na proposta do FNS ainda sem o detalhe (conta no município, não no autor).
  codigo                text check (codigo is null or codigo ~ '^\d{12}$'),
  -- O ano da emenda (do código).
  ano                   integer,
  autor_codigo          text check (autor_codigo is null or autor_codigo ~ '^\d{4}$'),
  -- Só no favorecido: o ano do recebimento.
  ano_pagamento         integer,
  uf                    text check (uf is null or uf ~ '^[A-Z]{2}$'),
  -- O município do ente. Governo e fundo estadual: sempre null (a sede não é o destino).
  ibge                  text check (ibge is null or ibge ~ '^\d{7}$'),
  ente_tipo             text check (ente_tipo is null or ente_tipo in ('municipio', 'fundo_municipal', 'estado', 'fundo_estadual',
                                                                       'consorcio', 'osc', 'empresa', 'orgao_federal', 'outro')),
  ente_cnpj             text check (ente_cnpj is null or ente_cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  -- O ente ou a entidade (pessoa jurídica). Só no painel de administrador.
  ente_nome             text,
  -- A escada indicado → válido → pago. O favorecido só tem o pago.
  indicado              numeric,
  empenhado             numeric,
  -- Convênio: desembolsado × fatia. Pix: pago. FNS: pago da proposta × fatia. Favorecido: recebido no ano.
  pago                  numeric not null default 0,
  -- Convênio: valor da emenda ÷ repasse (no máximo 1). FNS: o rateio por autor.
  fatia                 numeric,
  -- Autores no mesmo instrumento ("dividido com N autores").
  n_autores             integer,
  -- Convênio assinado e não extinto; Pix CIENTE; FNS não cancelado nem arquivado; favorecido sempre.
  valido                boolean not null,
  situacao              text,
  -- convênio: proposta, assinatura, suspensiva, execucao, contas, concluido, extinto (as de `diagnostico.ts`);
  -- Pix: impedido, reapresentado; Pix, FNS e favorecido: pago, pago_parcial, sem_pagamento.
  etapa                 text,
  -- De quem é a vez, só quando o dado diz.
  vez                   text check (vez is null or vez in ('concedente', 'proponente', 'autor')),
  -- Pix impedido: o motivo.
  motivo                text,
  caducou               boolean not null default false,
  caducou_em            date,
  dt_assinatura         date,
  dt_primeiro_pagamento date,
  dt_ultimo_pagamento   date,
  -- O canal que já mostra este dinheiro: a linha fica para conferência e NÃO SOMA.
  coberto_por           text check (coberto_por is null or coberto_por in ('convenio', 'pix', 'fns')),
  -- Convênio: ano tirado do programa sem confirmação do arquivo de convênios do Portal.
  ano_inferido          boolean not null default false,
  primary key (execucao_id, linha),
  check (codigo is null or autor_codigo = substr(codigo, 5, 4)),
  check (ente_tipo is null or ente_tipo not in ('estado', 'fundo_estadual') or ibge is null),
  check (canal = 'favorecido' or ano_pagamento is null),
  check (coberto_por is null or canal in ('favorecido', 'pix')),
  check (not caducou or (canal = 'convenio' and dt_assinatura is null and vez is null and caducou_em is not null))
);
create unique index if not exists emd_canal_chave_idx
  on public.emd_canal (execucao_id, canal, instrumento, codigo, ano_pagamento) nulls not distinct;
create index if not exists emd_canal_codigo_idx on public.emd_canal (execucao_id, codigo);
create index if not exists emd_canal_autor_idx on public.emd_canal (execucao_id, autor_codigo);
create index if not exists emd_canal_ibge_idx on public.emd_canal (execucao_id, ibge) where ibge is not null;

-- Pessoa física: só a soma. Não há coluna para nome, documento ou município, por desenho.
create table if not exists public.emd_pf (
  execucao_id  bigint not null references public.emd_execucao (id) on delete cascade,
  codigo       text not null check (codigo ~ '^\d{12}$'),
  ano          integer not null,
  uf           text not null check (uf ~ '^[A-Z]{2}$'),
  n_pagamentos integer not null,
  valor        numeric not null,
  primary key (execucao_id, codigo, ano, uf)
);

create table if not exists public.emd_fns_proposta (
  execucao_id    bigint not null references public.emd_execucao (id) on delete cascade,
  nu_proposta    text not null,
  ano            integer not null,
  ibge           text check (ibge is null or ibge ~ '^\d{7}$'),
  cnpj_fundo     text check (cnpj_fundo is null or cnpj_fundo ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  entidade       text,
  tipo_proposta  text,
  tipo_recurso   text,
  situacao       text,
  valor_proposta numeric not null default 0,
  valor_pago     numeric not null default 0,
  -- [{"codigo": "202442700003", "valor_indicado": 100000.0}] — só o código do autor, sem nome.
  autores        jsonb not null default '[]'::jsonb,
  -- [["2024OB000123", "2024-05-02", 100000.0]] — ordem bancária, data, valor.
  pagamentos     jsonb not null default '[]'::jsonb,
  -- Vazia = detalhe nunca lido (relido na próxima rodada).
  assinatura     text not null default '',
  primary key (execucao_id, nu_proposta)
);

do $$
declare
  t text;
begin
  foreach t in array array['emd_execucao', 'emd_autor', 'emd_emenda', 'emd_canal', 'emd_pf', 'emd_fns_proposta'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on sequence public.emd_execucao_id_seq from public, anon, authenticated;
grant usage, select on sequence public.emd_execucao_id_seq to service_role;

-- -----------------------------------------------------------------------------
-- Execução: a última concluída, concluir e limpar (o desenho da oport_36).
-- -----------------------------------------------------------------------------

create or replace function public.emd_ultima_execucao()
returns setof public.emd_execucao
language sql stable
set search_path to 'public'
as $$
  select * from public.emd_execucao
   where status = 'concluida'
   order by concluida_em desc
   limit 1
$$;

create or replace function public.emd_concluir(p_execucao bigint, p_dado_ate timestamptz, p_contagens jsonb)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update public.emd_execucao
     set status = 'concluida', concluida_em = now(), dado_ate = p_dado_ate, contagens = coalesce(p_contagens, '{}'::jsonb)
   where id = p_execucao and status = 'gravando';
  if not found then
    raise exception 'execução % não existe ou não está gravando', p_execucao;
  end if;
end $$;

-- Apaga linhas de todas as execuções, menos a última concluída e p_manter, até p_limite linhas por chamada (dentro
-- dos 8 s da API). Devolve quantas apagou; 0 = nada mais a limpar. As execuções antigas (sem linhas) ficam como
-- histórico.
create or replace function public.emd_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  manter bigint[] := array_remove(array[(select id from public.emd_ultima_execucao()), p_manter], null);
  apagar bigint[];
  resta  integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total  integer := 0;
  n      integer;
  t      text;
begin
  select coalesce(array_agg(id), '{}') into apagar from public.emd_execucao where id <> all (manter);
  if cardinality(apagar) = 0 then
    return 0;
  end if;

  foreach t in array array['emd_canal', 'emd_emenda', 'emd_autor', 'emd_pf', 'emd_fns_proposta'] loop
    execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
      using apagar, resta;
    get diagnostics n = row_count;
    total := total + n;
    resta := resta - n;
    exit when resta <= 0;
  end loop;
  return total;
end $$;

-- -----------------------------------------------------------------------------
-- Leitura agregada para as telas de administrador (parte 2). Todas leem a execução pedida ou, sem ela, a última
-- concluída; somam só `coberto_por is null`; o pago é o das linhas válidas; nenhuma soma catálogo com canal (as
-- colunas `catalogo_*` são a execução orçamentária, à parte); a ordem é por tipo e nome, nunca por valor ou posição.
-- -----------------------------------------------------------------------------

-- A lista dos autores: acesso por canal, caducados, fila e municípios atendidos.
create or replace function public.emd_autores(p_execucao bigint default null)
returns table (
  codigo             text,
  nome               text,
  tipo               text,
  coletivo           boolean,
  pessoa             text,
  emendas            integer,
  ano_min            integer,
  ano_max            integer,
  convenio_indicado  numeric,
  convenio_valido    numeric,
  convenio_pago      numeric,
  pix_indicado       numeric,
  pix_valido         numeric,
  pix_pago           numeric,
  fns_indicado       numeric,
  fns_valido         numeric,
  fns_pago           numeric,
  favorecido_pago    numeric,
  caducados          integer,
  caducado_valor     numeric,
  na_fila            integer,
  municipios         integer,
  catalogo_empenhado numeric,
  catalogo_pago_total numeric,
  catalogo_a_pagar   numeric,
  catalogo_empenhado_pb numeric,
  catalogo_pago_total_pb numeric
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select coalesce(p_execucao, (select id from public.emd_ultima_execucao())) id),
  c as (
    select * from public.emd_canal where execucao_id = (select id from ex) and coberto_por is null and autor_codigo is not null),
  porc as (
    select c.autor_codigo,
           count(distinct c.codigo)::integer emendas, min(c.ano) ano_min, max(c.ano) ano_max,
           coalesce(sum(c.indicado) filter (where c.canal = 'convenio'), 0) convenio_indicado,
           coalesce(sum(c.indicado) filter (where c.canal = 'convenio' and c.valido), 0) convenio_valido,
           coalesce(sum(c.pago) filter (where c.canal = 'convenio' and c.valido), 0) convenio_pago,
           coalesce(sum(c.indicado) filter (where c.canal = 'pix'), 0) pix_indicado,
           coalesce(sum(c.indicado) filter (where c.canal = 'pix' and c.valido), 0) pix_valido,
           coalesce(sum(c.pago) filter (where c.canal = 'pix' and c.valido), 0) pix_pago,
           coalesce(sum(c.indicado) filter (where c.canal = 'fns'), 0) fns_indicado,
           coalesce(sum(c.indicado) filter (where c.canal = 'fns' and c.valido), 0) fns_valido,
           coalesce(sum(c.pago) filter (where c.canal = 'fns' and c.valido), 0) fns_pago,
           coalesce(sum(c.pago) filter (where c.canal = 'favorecido'), 0) favorecido_pago,
           (count(*) filter (where c.caducou))::integer caducados,
           coalesce(sum(c.indicado) filter (where c.caducou), 0) caducado_valor,
           (count(*) filter (where c.vez is not null and not c.caducou))::integer na_fila,
           (count(distinct c.ibge) filter (where c.ente_tipo in ('municipio', 'fundo_municipal')
                                             and (c.canal = 'favorecido' or c.valido)))::integer municipios
      from c group by c.autor_codigo),
  cat as (
    select e.autor_codigo,
           sum(e.empenhado) catalogo_empenhado, sum(e.pago_total) catalogo_pago_total, sum(e.a_pagar) catalogo_a_pagar,
           coalesce(sum(e.empenhado) filter (where e.pb_localidade), 0) catalogo_empenhado_pb,
           coalesce(sum(e.pago_total) filter (where e.pb_localidade), 0) catalogo_pago_total_pb
      from public.emd_emenda e
     where e.execucao_id = (select id from ex) and e.autor_codigo is not null
     group by e.autor_codigo)
  select a.codigo, a.nome, a.tipo, a.coletivo, a.pessoa,
         coalesce(p.emendas, 0), p.ano_min, p.ano_max,
         coalesce(p.convenio_indicado, 0), coalesce(p.convenio_valido, 0), coalesce(p.convenio_pago, 0),
         coalesce(p.pix_indicado, 0), coalesce(p.pix_valido, 0), coalesce(p.pix_pago, 0),
         coalesce(p.fns_indicado, 0), coalesce(p.fns_valido, 0), coalesce(p.fns_pago, 0),
         coalesce(p.favorecido_pago, 0), coalesce(p.caducados, 0), coalesce(p.caducado_valor, 0),
         coalesce(p.na_fila, 0), coalesce(p.municipios, 0),
         coalesce(t.catalogo_empenhado, 0), coalesce(t.catalogo_pago_total, 0), coalesce(t.catalogo_a_pagar, 0),
         coalesce(t.catalogo_empenhado_pb, 0), coalesce(t.catalogo_pago_total_pb, 0)
    from public.emd_autor a
    left join porc p on p.autor_codigo = a.codigo
    left join cat t on t.autor_codigo = a.codigo
   where a.execucao_id = (select id from ex)
   order by a.tipo, a.nome nulls last, a.codigo
$$;

-- Destino: por município × autor × canal × tipo do ente. Com p_autor, o mapa dos 223 de um autor; com p_ibge, o
-- bloco "de onde vêm as emendas" do município (autor null = proposta do FNS ainda sem detalhe). O governo e o fundo
-- estadual vêm SEM IBGE (a sede, João Pessoa, não é o destino): aparecem com `ibge` null e `ente_tipo` estadual, à parte.
create or replace function public.emd_destino(p_autor text default null, p_ibge text default null, p_execucao bigint default null)
returns table (
  ibge         text,
  autor_codigo text,
  canal        text,
  ente_tipo    text,
  instrumentos integer,
  emendas      integer,
  indicado     numeric,
  valido       numeric,
  pago         numeric,
  caducado     numeric
)
language sql stable
set search_path to 'public'
as $$
  select c.ibge, c.autor_codigo, c.canal, c.ente_tipo,
         count(distinct c.instrumento)::integer, count(distinct c.codigo)::integer,
         coalesce(sum(c.indicado), 0),
         coalesce(sum(c.indicado) filter (where c.valido), 0),
         coalesce(sum(c.pago) filter (where c.valido), 0),
         coalesce(sum(c.indicado) filter (where c.caducou), 0)
    from public.emd_canal c
   where c.execucao_id = coalesce(p_execucao, (select id from public.emd_ultima_execucao()))
     and c.coberto_por is null
     and (p_autor is null or c.autor_codigo = p_autor)
     and (p_ibge is null or c.ibge = p_ibge)
   group by c.ibge, c.autor_codigo, c.canal, c.ente_tipo
   order by c.ibge nulls last, c.autor_codigo nulls last, c.canal, c.ente_tipo
$$;

-- Acesso de um autor por ano da emenda e canal.
create or replace function public.emd_autor_anos(p_autor text, p_execucao bigint default null)
returns table (
  ano      integer,
  canal    text,
  emendas  integer,
  indicado numeric,
  valido   numeric,
  pago     numeric,
  caducado numeric
)
language sql stable
set search_path to 'public'
as $$
  select c.ano, c.canal, count(distinct c.codigo)::integer,
         coalesce(sum(c.indicado), 0),
         coalesce(sum(c.indicado) filter (where c.valido), 0),
         coalesce(sum(c.pago) filter (where c.valido), 0),
         coalesce(sum(c.indicado) filter (where c.caducou), 0)
    from public.emd_canal c
   where c.execucao_id = coalesce(p_execucao, (select id from public.emd_ultima_execucao()))
     and c.coberto_por is null
     and c.autor_codigo = p_autor
   group by c.ano, c.canal
   order by c.ano, c.canal
$$;

-- A safra: o válido e o pago de toda a PB por ano da emenda, canal e tipo do autor. É a base para comparar a execução
-- de um autor "na mesma safra" (estudo B, armadilha 12), nunca entre safras diferentes.
create or replace function public.emd_safra(p_execucao bigint default null)
returns table (
  ano      integer,
  canal    text,
  tipo     text,
  autores  integer,
  emendas  integer,
  valido   numeric,
  pago     numeric
)
language sql stable
set search_path to 'public'
as $$
  with ex as (select coalesce(p_execucao, (select id from public.emd_ultima_execucao())) id)
  select c.ano, c.canal, coalesce(a.tipo, 'outro'), count(distinct c.autor_codigo)::integer, count(distinct c.codigo)::integer,
         coalesce(sum(c.indicado) filter (where c.valido), 0),
         coalesce(sum(c.pago) filter (where c.valido), 0)
    from public.emd_canal c
    left join public.emd_autor a on a.execucao_id = c.execucao_id and a.codigo = c.autor_codigo
   where c.execucao_id = (select id from ex)
     and c.coberto_por is null
     and c.autor_codigo is not null
   group by c.ano, c.canal, coalesce(a.tipo, 'outro')
   order by c.ano, c.canal, 3
$$;

revoke execute on function public.emd_ultima_execucao()                    from public, anon, authenticated;
revoke execute on function public.emd_concluir(bigint, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.emd_limpar(bigint, integer)               from public, anon, authenticated;
revoke execute on function public.emd_autores(bigint)                       from public, anon, authenticated;
revoke execute on function public.emd_destino(text, text, bigint)           from public, anon, authenticated;
revoke execute on function public.emd_autor_anos(text, bigint)              from public, anon, authenticated;
revoke execute on function public.emd_safra(bigint)                         from public, anon, authenticated;
grant  execute on function public.emd_ultima_execucao()                    to service_role;
grant  execute on function public.emd_concluir(bigint, timestamptz, jsonb) to service_role;
grant  execute on function public.emd_limpar(bigint, integer)               to service_role;
grant  execute on function public.emd_autores(bigint)                       to service_role;
grant  execute on function public.emd_destino(text, text, bigint)           to service_role;
grant  execute on function public.emd_autor_anos(text, bigint)              to service_role;
grant  execute on function public.emd_safra(bigint)                         to service_role;
