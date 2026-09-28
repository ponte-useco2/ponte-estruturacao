-- =============================================================================
-- oport_19 — o laudo de qualquer instrumento (onda 12, parte 1)
--
-- O laudo existia só para os convênios em cláusula suspensiva da coleta do Acesso Livre. A
-- onda 12 abre um laudo para qualquer instrumento da busca, montado com o que a base já tem.
-- O caso que puxou: o 962210 (Estado da PB, Ministério da Cultura, R$ 450 mil), plano aprovado
-- em 06/06/2024 e nunca assinado — a mediana do MinC na PB entre aprovar e assinar é de 14 dias.
--
--   · painel_instrumento ganha:
--       - os marcos da proposta, que o job já calculava para as medianas e descartava:
--         dt_envio, dt_aprovacao (PLANO_TRABALHO_APROVADO) e dt_conclusao;
--       - o último registro do histórico (dt_ultimo_historico, ultimo_historico);
--       - campos do siconv_convenio já baixado e não lido: situacao_contratacao ("Normal",
--         "Cláusula Suspensiva", "Liminar Judicial"…), dt_fim_vigencia_original,
--         vl_global_original e vl_ingresso_contrapartida;
--   · painel_instrumento_emenda: a emenda parlamentar de origem de cada instrumento (número,
--     autor, tipo, se é impositiva e o valor indicado). O autor é agente público: o nome entra;
--   · índices por programa e por CNPJ, para os pares do programa e a carteira do proponente;
--   · painel_limpar recolhe também a tabela nova (o resto é o mesmo da oport_14).
--
-- ORDEM: esta migração ANTES do job novo chegar à `main`. Sem as colunas e a tabela, a gravação do
-- painel falha inteira (o PostgREST recusa coluna desconhecida). O site tolera as duas ordens.
--
-- Leitura só pelo servidor, com a chave de serviço (grants explícitos, como na seguranca_1).
-- Aditiva e idempotente.
-- =============================================================================

alter table public.painel_instrumento add column if not exists situacao_contratacao     text;
alter table public.painel_instrumento add column if not exists dt_fim_vigencia_original date;
alter table public.painel_instrumento add column if not exists vl_global_original       numeric;
alter table public.painel_instrumento add column if not exists vl_ingresso_contrapartida numeric;
alter table public.painel_instrumento add column if not exists dt_envio                 date;
alter table public.painel_instrumento add column if not exists dt_aprovacao             date;
alter table public.painel_instrumento add column if not exists dt_conclusao             date;
alter table public.painel_instrumento add column if not exists dt_ultimo_historico      date;
alter table public.painel_instrumento add column if not exists ultimo_historico         text;

comment on column public.painel_instrumento.dt_envio is
  'Primeiro envio da proposta para análise (ou envio em chamamento), do histórico do SICONV.';
comment on column public.painel_instrumento.dt_aprovacao is
  'Primeiro PLANO_TRABALHO_APROVADO do histórico: o marco firme da aprovação.';
comment on column public.painel_instrumento.dt_conclusao is
  'Primeira prestação de contas aprovada (com ou sem ressalvas) ou concluída, do histórico.';
comment on column public.painel_instrumento.situacao_contratacao is
  'SITUACAO_CONTRATACAO do SICONV: Normal, Cláusula Suspensiva, Liminar Judicial ou as duas últimas.';

create index if not exists painel_instrumento_programa_idx on public.painel_instrumento (execucao_id, cod_programa);
create index if not exists painel_instrumento_cnpj_idx     on public.painel_instrumento (execucao_id, cnpj);

create table if not exists public.painel_instrumento_emenda (
  execucao_id      bigint not null references public.painel_execucao (id) on delete cascade,
  nr_convenio      text not null,
  nr_emenda        text not null,
  parlamentar      text,
  tipo_parlamentar text,
  impositiva       boolean,
  valor            numeric
);
create index if not exists painel_instrumento_emenda_idx on public.painel_instrumento_emenda (execucao_id, nr_convenio);

alter table public.painel_instrumento_emenda enable row level security;
revoke all on table public.painel_instrumento_emenda from anon, authenticated;
grant all on table public.painel_instrumento_emenda to service_role;


-- -----------------------------------------------------------------------------
-- Limpeza em lotes: a mesma da oport_14, com a tabela nova na lista.
-- -----------------------------------------------------------------------------
create or replace function public.painel_limpar(p_manter bigint default null, p_limite integer default 5000)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  ultima        public.painel_execucao;
  manter        bigint[];
  apagar        bigint[];
  sem_conclusao bigint[];
  resta         integer := greatest(1, least(coalesce(p_limite, 5000), 20000));
  total         integer := 0;
  n             integer;
  t             text;
begin
  select * into ultima from public.painel_ultima_execucao();
  manter := array_remove(array[ultima.id, p_manter], null);
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(id) filter (where status <> 'concluida'), '{}')
    into apagar, sem_conclusao
    from public.painel_execucao where id <> all (manter);

  if cardinality(apagar) > 0 then
    foreach t in array array['painel_convenio', 'painel_municipio', 'painel_aditivo_motivo', 'painel_etapa_tempo',
                             'painel_etapa_ano', 'painel_programa_desfecho', 'painel_proposta',
                             'painel_instrumento', 'painel_instrumento_evento', 'painel_instrumento_emenda'] loop
      execute format('delete from public.%I where ctid = any (array(select ctid from public.%I where execucao_id = any ($1) limit $2))', t, t)
        using apagar, resta;
      get diagnostics n = row_count;
      total := total + n;
      resta := resta - n;
      exit when resta <= 0;
    end loop;
  end if;

  if resta > 0 then
    delete from public.painel_mudanca where ctid = any (array(
      select ctid from public.painel_mudanca
       where execucao_id = any (sem_conclusao)
          or dado_ate < ultima.dado_ate - interval '60 days'
       limit resta));
    get diagnostics n = row_count;
    total := total + n;
  end if;
  return total;
end $$;

revoke execute on function public.painel_limpar(bigint, integer) from public, anon, authenticated;
grant  execute on function public.painel_limpar(bigint, integer) to service_role;
