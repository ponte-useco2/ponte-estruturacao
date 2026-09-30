-- =============================================================================
-- tramita_1 — o banco do TRAMITA (TCE-PB) dentro da plataforma (29/09/2026)
--
-- O coletor do TRAMITA (tramita/ no monorepo) grava processos do TCE-PB: contas anuais,
-- tramitações, comunicações com prazo, sanções (multa e débito) e o menu dos autos. Até
-- 29/09/2026 o schema `tramita` morava no projeto de staging do datahub; a decisão do titular
-- foi trazê-lo para cá. Esta migração cria o schema VAZIO, igual ao de lá (conferido pelo
-- catálogo em 29/09), com três diferenças:
--   · pessoa.cpf NÃO existe: a regra da plataforma é nunca guardar CPF (lá a coluna existia e
--     estava 100% nula). A chave de pessoa passa a ser o nome, que já era único (2.653 de 2.653);
--   · vw_prazo_defesa NÃO é recriada: ignora prorrogação e conta a citação tácita, que não tem
--     prazo (tramita/docs/DICIONARIO_DADOS.md);
--   · as views usam security_invoker.
--
-- Os dados vêm DEPOIS, por pg_restore --data-only (tramita/migracao/COPIA.md), por isso aqui
-- não há semente de dimensão: as linhas de dim_* vêm da cópia, e um INSERT aqui colidiria.
--
-- Nomes: guardados como o TCE publica, em todos os papéis (decisão do titular, 29/09/2026).
-- Só administrador os vê, e nunca se cruza fonte por nome (o cruzamento é pelo IBGE de
-- dim_ente.codigo_ibge, preenchido na cópia a partir de tramita/fila/entes_ibge.csv).
--
-- Acesso: RLS ligado e nenhuma política; nada para anon/authenticated; service_role só lê
-- (o site lerá por funções no public, na tramita_2). Quem grava é o coletor, como `postgres`,
-- dono das tabelas (o Supavisor recusa o papel coletor_tramita).
-- Idempotente. Independe das migrações oport_* e fiscal_*.
-- =============================================================================

create schema if not exists tramita;

-- ------------------------------------------------------------------ dimensões

create table if not exists tramita.dim_ente (
  id_ente      integer primary key,                 -- código interno do TRAMITA
  nome         text not null,
  codigo_ibge  character(7),                        -- de tramita/fila/entes_ibge.csv
  eh_municipio boolean not null default true
);

create table if not exists tramita.dim_tipo_jurisdicionado (
  id_tipo   integer primary key,
  nome      text not null,
  cancelado boolean not null default false
);

create table if not exists tramita.dim_categoria (
  id_categoria integer primary key,
  nome         text not null,
  cancelado    boolean not null default false
);

create table if not exists tramita.dim_subcategoria (
  id_subcategoria integer primary key,
  id_categoria    integer references tramita.dim_categoria (id_categoria),
  nome            text not null,
  cancelado       boolean not null default false
);

create table if not exists tramita.dim_fase (
  id_fase integer primary key,
  nome    text not null,
  ordem   smallint
);

create table if not exists tramita.dim_estagio (
  id_estagio integer primary key,
  nome       text not null
);

create table if not exists tramita.dim_relator (
  id_relator integer primary key,
  nome       text not null
);

create table if not exists tramita.dim_setor (
  id_setor serial primary key,
  sigla    text not null unique,
  nome     text
);

-- ------------------------------------------------------------------ entidades

create table if not exists tramita.jurisdicionado (
  id_jurisdicionado serial primary key,
  id_tramita        integer unique,
  nome              text not null unique,
  id_tipo           integer references tramita.dim_tipo_jurisdicionado (id_tipo),
  id_ente           integer references tramita.dim_ente (id_ente)
);

-- Gestores, relatores, advogados, contadores, imputados — como o TCE publica. Sem CPF.
create table if not exists tramita.pessoa (
  id_pessoa serial primary key,
  nome      text not null unique
);

create table if not exists tramita.processo (
  id_processo         serial primary key,
  protocolo           text not null unique,         -- 'NNNNN/AA'
  numero              integer not null,
  ano_protocolo       smallint not null,
  id_categoria        integer references tramita.dim_categoria (id_categoria),
  id_subcategoria     integer references tramita.dim_subcategoria (id_subcategoria),
  id_jurisdicionado   integer references tramita.jurisdicionado (id_jurisdicionado),
  id_gestor           integer references tramita.pessoa (id_pessoa),
  id_relator          integer references tramita.dim_relator (id_relator),
  data_entrada        timestamp,
  exercicio           smallint,
  valor_processo      numeric(18, 2),
  assunto             text,
  id_fase             integer references tramita.dim_fase (id_fase),
  id_estagio          integer references tramita.dim_estagio (id_estagio),
  estado              text check (estado in ('Em trâmite', 'Arquivado', 'Expurgado', 'Sobrestado')),
  situacao_juntada    text check (situacao_juntada in ('Livre', 'Apensado', 'Anexado')),
  setor_atual         text,
  julgado             boolean,                      -- 100% nulo: a página não expõe
  previdenciario      boolean,
  digital             text,
  cancelado           boolean default false,
  volumes             smallint,
  coletado_lista_em   timestamptz,
  coletado_detalhe_em timestamptz,
  hash_detalhe        text,
  tramitavel          integer,                      -- id interno das URLs de autos
  outros_arquivos     text
);
create index if not exists ix_processo_jur  on tramita.processo (id_jurisdicionado, exercicio);
create index if not exists ix_processo_cat  on tramita.processo (id_categoria, id_subcategoria);
create index if not exists ix_processo_data on tramita.processo (data_entrada);

create table if not exists tramita.processo_interessado (
  id_processo    integer not null references tramita.processo (id_processo) on delete cascade,
  id_pessoa      integer not null references tramita.pessoa (id_pessoa),
  interesse      text not null,                     -- Gestor(a) / Contador(a) / Advogado(a)…
  periodo_inicio date,
  periodo_fim    date,
  observacao     text,
  primary key (id_processo, id_pessoa, interesse)
);

-- ------------------------------------------------------------------ fatos

create table if not exists tramita.tramitacao (
  id_tramitacao bigserial primary key,
  id_processo   integer not null references tramita.processo (id_processo) on delete cascade,
  seq           integer not null,
  evento        text not null,
  data_hora     timestamp not null,
  setor_origem  text,
  setor_destino text,
  motivo        text,
  estagio       text,
  observacao    text,
  unique (id_processo, seq)
);
create index if not exists ix_tram_proc_data on tramita.tramitacao (id_processo, data_hora);

create table if not exists tramita.comunicacao (
  id_comunicacao   bigserial primary key,
  id_processo      integer not null references tramita.processo (id_processo) on delete cascade,
  tipo             text not null,
  meio             text,
  data_emissao     date,
  id_pessoa        integer references tramita.pessoa (id_pessoa),
  papel_pessoa     text,
  inicio_prazo     date,
  marco_inicio     text,
  final_prazo      date,
  suprido_em       date,                            -- preenchido em só ~7% (não é "defesa não apresentada")
  orgao            text,
  usuario_registro text
);
create index if not exists ix_com_proc on tramita.comunicacao (id_processo, tipo);

create table if not exists tramita.peca (
  id_peca       bigserial primary key,
  id_processo   integer not null references tramita.processo (id_processo) on delete cascade,
  num_peca      integer,
  data          date,
  descricao     text,
  tipo_doc      text,
  responsavel   text,
  pagina_ini    integer,
  pagina_fim    integer,
  doc_vinculado text,
  pdf_baixado   boolean default false,
  pdf_caminho   text
);
create index if not exists ix_peca_proc on tramita.peca (id_processo, num_peca);

create table if not exists tramita.vinculo (
  id_vinculo        bigserial primary key,
  id_processo       integer not null references tramita.processo (id_processo) on delete cascade,
  protocolo_alvo    text not null,
  tipo_alvo         text check (tipo_alvo in ('processo', 'documento')),
  natureza          text,
  subcategoria_alvo text,
  situacao_juntada  text,
  data              date
);

-- Projeção de `sancao` (só decisões sancionatórias): não é a lista de julgamentos.
create table if not exists tramita.decisao (
  id_decisao      bigserial primary key,
  id_processo     integer not null references tramita.processo (id_processo) on delete cascade,
  numero          text,
  tipo            text,
  data_publicacao date,
  orgao           text,
  fonte           text
);

-- Linhas repetidas para a mesma decisão são imputações DISTINTAS: não deduplicar.
create table if not exists tramita.sancao (
  id_sancao       bigserial primary key,
  id_processo     integer not null references tramita.processo (id_processo) on delete cascade,
  id_pessoa       integer references tramita.pessoa (id_pessoa),
  tipo            text check (tipo in ('Multa', 'Débito', 'Restituição', 'Outro')),
  valor           numeric(18, 2),
  numero_decisao  text,
  data_publicacao date,
  situacao        text,
  cda             text
);
create index if not exists ix_sancao_pessoa on tramita.sancao (id_pessoa);

create table if not exists tramita.coleta_ente (
  id_ente         integer not null references tramita.dim_ente (id_ente),
  id_tipo         integer not null references tramita.dim_tipo_jurisdicionado (id_tipo),
  total_informado integer not null,
  coletados       integer not null,
  coletado_em     timestamptz not null default now(),
  primary key (id_ente, id_tipo)
);

-- Menu "Autos Eletrônicos": o par (tramitavel, acao) é estável; o hash da URL é de sessão.
create table if not exists tramita.acao_autos (
  id_processo integer not null references tramita.processo (id_processo) on delete cascade,
  acao        integer not null,
  rotulo      text not null,
  primary key (id_processo, acao)
);

-- Cálculo de prescrição do próprio TRAMITA, informativo por declaração da fonte.
create table if not exists tramita.prescricao_evento (
  id_processo         integer not null references tramita.processo (id_processo) on delete cascade,
  seq                 integer not null,
  data                date,
  evento              text,
  situacao            text,
  prazo_intercorrente text,
  prazo_quinquenal    text,
  primary key (id_processo, seq)
);

-- ------------------------------------------------------------------ views

create or replace view tramita.vw_cobertura_inventario with (security_invoker = on) as
select e.id_ente, e.nome as ente, tj.nome as tipo,
       c.total_informado, c.coletados,
       (c.coletados = c.total_informado) as completo,
       c.coletado_em
  from tramita.dim_ente e
  left join tramita.coleta_ente c              on c.id_ente = e.id_ente
  left join tramita.dim_tipo_jurisdicionado tj on tj.id_tipo = c.id_tipo
 order by completo nulls first, e.id_ente;

create or replace view tramita.vw_processo_analitico with (security_invoker = on) as
select p.id_processo, p.protocolo, p.exercicio, p.data_entrada,
       e.nome  as municipio,
       tj.nome as tipo_jurisdicionado,
       j.nome  as jurisdicionado,
       c.nome  as categoria,
       sc.nome as subcategoria,
       p.assunto,
       g.nome  as gestor,
       r.nome  as relator,
       f.nome  as fase, es.nome as estagio, p.estado, p.julgado,
       p.valor_processo,
       (select min(t.data_hora) from tramita.tramitacao t where t.id_processo = p.id_processo) as primeira_movimentacao,
       (select max(t.data_hora) from tramita.tramitacao t where t.id_processo = p.id_processo) as ultima_movimentacao,
       (select count(*) from tramita.tramitacao t where t.id_processo = p.id_processo)         as qtd_movimentos,
       (select min(d.data_publicacao) from tramita.decisao d where d.id_processo = p.id_processo) as primeira_decisao_publicada,
       (select coalesce(sum(s.valor), 0) from tramita.sancao s where s.id_processo = p.id_processo and s.tipo = 'Multa')  as total_multas,
       (select coalesce(sum(s.valor), 0) from tramita.sancao s where s.id_processo = p.id_processo and s.tipo = 'Débito') as total_debitos
  from tramita.processo p
  left join tramita.jurisdicionado j          on j.id_jurisdicionado = p.id_jurisdicionado
  left join tramita.dim_ente e                on e.id_ente = j.id_ente
  left join tramita.dim_tipo_jurisdicionado tj on tj.id_tipo = j.id_tipo
  left join tramita.dim_categoria c           on c.id_categoria = p.id_categoria
  left join tramita.dim_subcategoria sc       on sc.id_subcategoria = p.id_subcategoria
  left join tramita.pessoa g                  on g.id_pessoa = p.id_gestor
  left join tramita.dim_relator r             on r.id_relator = p.id_relator
  left join tramita.dim_fase f                on f.id_fase = p.id_fase
  left join tramita.dim_estagio es            on es.id_estagio = p.id_estagio;

create or replace view tramita.vw_tempo_por_setor with (security_invoker = on) as
with mov as (
  select id_processo, data_hora, setor_origem, setor_destino,
         lead(data_hora) over (partition by id_processo order by data_hora) as proxima
    from tramita.tramitacao
   where evento in ('RECEBIMENTO', 'ENCAMINHAMENTO')
)
select p.protocolo, e.nome as municipio,
       coalesce(m.setor_destino, m.setor_origem) as setor,
       m.data_hora as entrada_no_setor,
       m.proxima   as saida_do_setor,
       extract(epoch from (m.proxima - m.data_hora)) / 86400.0 as dias_no_setor
  from mov m
  join tramita.processo p          on p.id_processo = m.id_processo
  left join tramita.jurisdicionado j on j.id_jurisdicionado = p.id_jurisdicionado
  left join tramita.dim_ente e       on e.id_ente = j.id_ente;

-- ------------------------------------------------------------------ acesso

revoke all on schema tramita from public, anon, authenticated;
grant usage on schema tramita to service_role;

do $$
declare
  t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'tramita' and c.relkind = 'r'
  loop
    execute format('alter table tramita.%I enable row level security', t);
    execute format('revoke all on table tramita.%I from public, anon, authenticated', t);
    execute format('grant select on table tramita.%I to service_role', t);
  end loop;
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'tramita' and c.relkind = 'v'
  loop
    execute format('revoke all on table tramita.%I from public, anon, authenticated', t);
    execute format('grant select on table tramita.%I to service_role', t);
  end loop;
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'tramita' and c.relkind = 'S'
  loop
    execute format('revoke all on sequence tramita.%I from public, anon, authenticated', t);
  end loop;
end
$$;
